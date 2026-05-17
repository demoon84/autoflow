// runner-pty-manager.ts
//
// Long-lived PTY-based runner manager. One pty.spawn() per runner. The runner
// holds a shell that the user's environment (PATH/PROFILE) is loaded into;
// inside that shell we type the agent CLI command (claude / codex / gemini)
// just like a human would. Stdin is internal-only — the renderer-side
// LiveTerminalView is read-only by design.
//
// Lifecycle (per runner):
//   start()    → spawn shell, type CLI command, status='running'
//   write()    → write a prompt + Enter to the stdin queue
//   stop()     → send SIGTERM, kill subtree, status='stopped'
//
// fs.watch wakes are mediated by the caller — when a board change fires,
// the caller decides what prompt or raw stdin bytes to push.

import { EventEmitter } from "node:events";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import type { IDisposable, IPty } from "node-pty";
import {
  enhanceNodePtySpawnError,
  fixNodePtySpawnHelperPermissions
} from "./node-pty-permissions";

type NodePtyModule = typeof import("node-pty");

type PtyRunnerManagerOptions = {
  maxBufferBytes?: number;
};

type RunnerStartOptions = {
  shell?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
  env?: NodeJS.ProcessEnv;
  command?: string;
  logsDir?: string;
};

type WritePromptOptions = {
  paste?: "bracketed" | "plain";
};

type ContextResetMode = "compact" | "clear";

type StopOptions = {
  force?: boolean;
};

type RunnerStatus = (typeof STATUS)[keyof typeof STATUS];

type PtyRunner = {
  id: string;
  status: RunnerStatus;
  pid: number;
  cwd: string;
  command: string;
  shell: string;
  startedAt: string;
  liveStdoutLog: string;
  client: IPty;
  buffer: string[];
  bufferBytes: number;
  stdinQueue: string[];
  stdinDraining: boolean;
  lastDataAt: number;
  exitCode?: number;
  signal?: number;
  _dataSub?: IDisposable;
  _exitSub?: IDisposable;
};

let pty: NodePtyModule | null;
try {
  // node-pty is a native module; require lazily so the rest of main.ts still
  // boots if rebuild was skipped.
  pty = require("node-pty") as NodePtyModule;
} catch (err) {
  pty = null;
}

const STATUS = Object.freeze({
  STARTING: "starting",
  RUNNING: "running",
  STOPPING: "stopping",
  STOPPED: "stopped",
  ERRORED: "errored"
});

function getDefaultShell() {
  if (process.platform === "win32") {
    return process.env.COMSPEC || "cmd.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

function buildShellEnv(extraEnv?: NodeJS.ProcessEnv) {
  const merged = { ...process.env, ...(extraEnv || {}) };
  // Force xterm-256color + truecolor unconditionally. The original `||`
  // form preserved a user-set TERM=dumb / empty / non-color value and then
  // the agent CLIs (chalk-based: claude / codex / gemini) saw a non-color
  // terminal and emitted plain text. Override.
  merged.TERM = "xterm-256color";
  merged.COLORTERM = "truecolor";
  // Defense in depth — Node.js (chalk) respects FORCE_COLOR; macOS BSD
  // tools respect CLICOLOR_FORCE. Setting both means the CLI emits color
  // even if isatty() detection fails inside the shell→CLI hop.
  merged.FORCE_COLOR = "3";       // truecolor
  merged.CLICOLOR = "1";
  merged.CLICOLOR_FORCE = "1";
  // Strip color-killers that some CI/dev shells set.
  delete merged.NO_COLOR;
  delete merged.CI;
  delete merged.npm_config_prefix;
  delete merged.NPM_CONFIG_PREFIX;
  // Disable some CLIs' "do you want to update?" prompts by default.
  merged.NO_UPDATE_NOTIFIER = "1";
  return merged;
}

function safeRunnerLogSegment(value: string) {
  return String(value || "runner").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "runner";
}

function timestampForLogFile(date = new Date()) {
  return date.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "-");
}

export class PtyRunnerManager extends EventEmitter {
  runners: Map<string, PtyRunner>;
  maxBufferBytes: number;

  constructor(options: PtyRunnerManagerOptions = {}) {
    super();
    this.runners = new Map();
    this.maxBufferBytes = options.maxBufferBytes || 256 * 1024;
  }

  isAvailable() {
    return Boolean(pty);
  }

  list() {
    return Array.from(this.runners.entries()).map(([id, runner]) => ({
      id,
      status: runner.status,
      pid: runner.pid,
      cwd: runner.cwd,
      command: runner.command,
      startedAt: runner.startedAt,
      liveStdoutLog: runner.liveStdoutLog || ""
    }));
  }

  get(runnerId: string) {
    return this.runners.get(runnerId);
  }

  // Start a runner. The agent CLI is typed into the shell after spawn so the
  // shell's profile (PATH etc.) is loaded first. Caller passes the literal
  // shell string to type, e.g. `claude --dangerously-skip-permissions ...`.
  start(runnerId: string, opts: RunnerStartOptions = {}) {
    if (!pty) {
      throw new Error("node-pty not available — rebuild required");
    }
    if (!runnerId || typeof runnerId !== "string") {
      throw new Error("runnerId required");
    }
    const existing = this.runners.get(runnerId);
    if (existing && existing.status === STATUS.RUNNING) {
      return existing;
    }

    const shell = opts.shell || getDefaultShell();
    const cwd = opts.cwd || process.env.HOME || os.homedir();
    if (!fs.existsSync(cwd)) {
      throw new Error(`cwd does not exist: ${cwd}`);
    }
    const cols = Number.isFinite(opts.cols) ? opts.cols : 120;
    const rows = Number.isFinite(opts.rows) ? opts.rows : 30;
    const env = buildShellEnv(opts.env);
    const command = String(opts.command || "").trim();
    const logsDir = typeof opts.logsDir === "string" && opts.logsDir ? opts.logsDir : "";
    let liveStdoutLog = "";
    if (logsDir) {
      try {
        fs.mkdirSync(logsDir, { recursive: true });
        liveStdoutLog = path.join(
          logsDir,
          `${safeRunnerLogSegment(runnerId)}_${timestampForLogFile()}_live_stdout.log`
        );
        fs.writeFileSync(liveStdoutLog, "");
      } catch {
        liveStdoutLog = "";
      }
    }

    const permissionFix = fixNodePtySpawnHelperPermissions({
      log: (message) => console.log(`[node-pty] ${message}`)
    });
    if (permissionFix.errors.length) {
      console.warn("[node-pty] spawn-helper permission repair warning", permissionFix.errors);
    }

    let client;
    try {
      client = pty.spawn(shell, [], {
        name: "xterm-256color",
        cwd,
        cols,
        rows,
        env
      });
    } catch (err) {
      throw enhanceNodePtySpawnError(err);
    }

    const runner: PtyRunner = {
      id: runnerId,
      status: STATUS.STARTING,
      pid: client.pid,
      cwd,
      command,
      shell,
      startedAt: new Date().toISOString(),
      liveStdoutLog,
      client,
      buffer: [],
      bufferBytes: 0,
      stdinQueue: [],
      stdinDraining: false,
      lastDataAt: 0
    };
    this.runners.set(runnerId, runner);

    runner._dataSub = client.onData((data) => this._onData(runner, data));
    runner._exitSub = client.onExit(({ exitCode, signal }) =>
      this._onExit(runner, exitCode, signal)
    );

    // After the shell prompt is ready, type the agent CLI command. We add a
    // short delay so the shell's startup banner doesn't race with the typed
    // command; vibe-terminal does this implicitly because users type after the
    // prompt appears. 250ms is conservative and below the human-perceptible
    // threshold for "delayed response".
    if (command) {
      setTimeout(() => {
        if (runner.status === STATUS.STOPPED) return;
        try {
          client.write(`${command}\r`);
        } catch (err) {
          this.emit("error", { runnerId, error: err });
        }
      }, 250);
    }

    runner.status = STATUS.RUNNING;
    this.emit("status", { runnerId, status: runner.status, pid: runner.pid });
    return runner;
  }

  // Write a prompt to the runner.
  //
  // Multi-line prompts arrive as a "paste" in claude / codex TUIs (heuristic:
  // many bytes in one read = bracketed paste). The TUI then collapses to a
  // "[Pasted N lines] paste again to expand / ctrl+g to edit in Vim" placeholder
  // and waits for the user to press Enter to submit. If we tack `\r` onto the
  // payload, it gets interpreted as part of the paste body, not as the submit
  // keystroke — the prompt sits unsent.
  //
  // Fix: write the text body in one chunk, then schedule a SEPARATE `\r` write
  // a short delay later. The TUI sees the second write as "user pressed Enter"
  // and submits the collapsed paste.
  writePrompt(runnerId: string, text: string, opts: WritePromptOptions = {}) {
    const runner = this.runners.get(runnerId);
    if (!runner || runner.status !== STATUS.RUNNING) {
      return false;
    }
    const raw = String(text || "");
    if (!raw) return false;
    const body = raw.replace(/[\r\n]+$/, "");
    // Paste mode is agent-specific:
    //   - "bracketed" (claude): wrap body in \e[200~...\e[201~ so the TUI
    //     treats it as a real paste and a separate \r afterwards submits.
    //     Without the envelope, claude parks content in a "[Pasted N lines]"
    //     placeholder and ignores \r.
    //   - "plain" (codex / gemini / default): write body as-is. These TUIs
    //     do NOT recognize \e[200~ markers and would render them as raw
    //     mojibake bytes if we sent them.
    const pasteMode = opts.paste === "bracketed" ? "bracketed" : "plain";
    if (pasteMode === "bracketed") {
      const PASTE_START = "\x1b[200~";
      const PASTE_END = "\x1b[201~";
      runner.stdinQueue.push(`${PASTE_START}${body}${PASTE_END}`);
    } else {
      runner.stdinQueue.push(body);
    }
    this._drainStdin(runner);
    // Defer the submit keystroke so the TUI processes the body first.
    setTimeout(() => {
      if (runner.status !== STATUS.RUNNING) return;
      runner.stdinQueue.push("\r");
      this._drainStdin(runner);
    }, 400);
    return true;
  }

  // Forward literal user stdin bytes to the runner PTY.
  // Unlike writePrompt(), this does not append Enter or wrap bracketed paste.
  writeInput(runnerId: string, data: string) {
    const runner = this.runners.get(runnerId);
    if (!runner || runner.status !== STATUS.RUNNING) {
      return false;
    }
    const raw = String(data || "");
    if (!raw) return false;
    runner.stdinQueue.push(raw);
    this._drainStdin(runner);
    return true;
  }

  // Inject a context-reset slash command into the runner's PTY input.
  // mode='compact' (default): summarise and compress context in-place.
  // mode='clear': discard context entirely (escalation path).
  // Agent mapping:
  //   claude  compact→/compact  clear→/clear
  //   codex   compact→/compact  clear→/new
  //   gemini  compact→/compress clear→/clear
  //           (set AUTOFLOW_GEMINI_CLEAR_MODE=new to opt into /new)
  // Slash commands are single-line, so no bracketed-paste envelope.
  injectContextReset(runnerId: string, mode: ContextResetMode = "compact") {
    const runner = this.runners.get(runnerId);
    if (!runner || runner.status !== STATUS.RUNNING) return false;
    const cmd = String(runner.command || "").trimStart().toLowerCase();
    let slashCmd;
    if (cmd.startsWith("gemini")) {
      const geminiClearMode = String(process.env.AUTOFLOW_GEMINI_CLEAR_MODE || "clear").toLowerCase();
      slashCmd = mode === "clear" && geminiClearMode === "new" ? "/new" : (mode === "clear" ? "/clear" : "/compress");
    } else if (cmd.startsWith("codex")) {
      slashCmd = mode === "clear" ? "/new" : "/compact";
    } else {
      // claude (default)
      slashCmd = mode === "clear" ? "/clear" : "/compact";
    }
    // Plain text + carriage return. No bracketed-paste — slash commands must
    // not be wrapped in \e[200~...\e[201~ or they render as literal text.
    runner.stdinQueue.push(`${slashCmd}\r`);
    this._drainStdin(runner);
    return true;
  }

  _drainStdin(runner: PtyRunner) {
    if (runner.stdinDraining) return;
    runner.stdinDraining = true;
    const tick = () => {
      if (!runner.stdinQueue.length || runner.status !== STATUS.RUNNING) {
        runner.stdinDraining = false;
        return;
      }
      const next = runner.stdinQueue.shift();
      if (typeof next !== "string") {
        runner.stdinDraining = false;
        return;
      }
      try {
        runner.client.write(next);
      } catch (err) {
        runner.stdinDraining = false;
        this.emit("error", { runnerId: runner.id, error: err });
        return;
      }
      // node-pty has no flow control callback; advance on next tick.
      setImmediate(tick);
    };
    tick();
  }

  _onData(runner: PtyRunner, data: string) {
    if (this.runners.get(runner.id) !== runner) return;
    runner.lastDataAt = Date.now();
    // Append to ring buffer (cap at maxBufferBytes).
    runner.buffer.push(data);
    runner.bufferBytes += Buffer.byteLength(data, "utf8");
    while (runner.bufferBytes > this.maxBufferBytes && runner.buffer.length > 1) {
      const dropped = runner.buffer.shift() || "";
      runner.bufferBytes -= Buffer.byteLength(dropped, "utf8");
    }
    if (runner.liveStdoutLog) {
      try {
        fs.appendFileSync(runner.liveStdoutLog, data);
      } catch {
        // Logging must never break the live PTY.
      }
    }
    this.emit("bytes", { runnerId: runner.id, data });
  }

  _onExit(runner: PtyRunner, exitCode: number, signal?: number) {
    if (this.runners.get(runner.id) !== runner) return;
    runner.status = STATUS.STOPPED;
    runner.exitCode = exitCode;
    runner.signal = signal;
    if (runner._dataSub) {
      try { runner._dataSub.dispose(); } catch {}
    }
    if (runner._exitSub) {
      try { runner._exitSub.dispose(); } catch {}
    }
    this.emit("status", {
      runnerId: runner.id,
      status: runner.status,
      pid: runner.pid,
      exitCode,
      signal
    });
  }

  // Return the buffered bytes (for restoring xterm scrollback when the
  // renderer subscribes mid-session).
  snapshot(runnerId: string) {
    const runner = this.runners.get(runnerId);
    if (!runner) return "";
    return runner.buffer.join("");
  }

  // Resize the PTY's notion of the terminal window. Must be called whenever
  // the renderer's xterm fits to a new size, otherwise the agent CLI keeps
  // wrapping at the original cols and its cursor-up redraws (claude's
  // "thinking..." spinner, codex's TUI footer, gemini's input frame) leave
  // leftover characters behind.
  resize(runnerId: string, cols: number, rows: number) {
    const runner = this.runners.get(runnerId);
    if (!runner || runner.status !== STATUS.RUNNING) return false;
    const c = Math.max(1, Math.floor(Number(cols) || 0));
    const r = Math.max(1, Math.floor(Number(rows) || 0));
    if (!c || !r) return false;
    try {
      runner.client.resize(c, r);
      return true;
    } catch {
      return false;
    }
  }

  stop(runnerId: string, opts: StopOptions = {}) {
    const runner = this.runners.get(runnerId);
    if (!runner) return false;
    if (runner.status === STATUS.STOPPED) return true;
    runner.status = STATUS.STOPPING;
    const force = Boolean(opts.force);
    try {
      if (force) {
        runner.client.kill("SIGKILL");
      } else {
        runner.client.kill();
      }
    } catch {
      // already gone
    }
    return true;
  }

  shutdown() {
    for (const id of Array.from(this.runners.keys())) {
      this.stop(id, { force: true });
    }
  }
}

export const PTY_RUNNER_STATUS = STATUS;

export default {
  PtyRunnerManager,
  PTY_RUNNER_STATUS
};
