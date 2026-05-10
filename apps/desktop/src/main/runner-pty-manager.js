// runner-pty-manager.js
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
// the caller decides what prompt to push via writePrompt().

const { EventEmitter } = require("events");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

let pty;
try {
  // node-pty is a native module; require lazily so the rest of main.js still
  // boots if rebuild was skipped.
  pty = require("node-pty");
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

function buildShellEnv(extraEnv) {
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
  // Disable some CLIs' "do you want to update?" prompts by default.
  merged.NO_UPDATE_NOTIFIER = "1";
  return merged;
}

class PtyRunnerManager extends EventEmitter {
  constructor(options = {}) {
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
      startedAt: runner.startedAt
    }));
  }

  get(runnerId) {
    return this.runners.get(runnerId);
  }

  // Start a runner. The agent CLI is typed into the shell after spawn so the
  // shell's profile (PATH etc.) is loaded first. Caller passes the literal
  // shell string to type, e.g. `claude --dangerously-skip-permissions ...`.
  start(runnerId, opts = {}) {
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

    const client = pty.spawn(shell, [], {
      name: "xterm-256color",
      cwd,
      cols,
      rows,
      env
    });

    const runner = {
      id: runnerId,
      status: STATUS.STARTING,
      pid: client.pid,
      cwd,
      command,
      shell,
      startedAt: new Date().toISOString(),
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
  writePrompt(runnerId, text, opts = {}) {
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

  _drainStdin(runner) {
    if (runner.stdinDraining) return;
    runner.stdinDraining = true;
    const tick = () => {
      if (!runner.stdinQueue.length || runner.status !== STATUS.RUNNING) {
        runner.stdinDraining = false;
        return;
      }
      const next = runner.stdinQueue.shift();
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

  _onData(runner, data) {
    runner.lastDataAt = Date.now();
    // Append to ring buffer (cap at maxBufferBytes).
    runner.buffer.push(data);
    runner.bufferBytes += Buffer.byteLength(data, "utf8");
    while (runner.bufferBytes > this.maxBufferBytes && runner.buffer.length > 1) {
      const dropped = runner.buffer.shift();
      runner.bufferBytes -= Buffer.byteLength(dropped, "utf8");
    }
    this.emit("bytes", { runnerId: runner.id, data });
  }

  _onExit(runner, exitCode, signal) {
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
  snapshot(runnerId) {
    const runner = this.runners.get(runnerId);
    if (!runner) return "";
    return runner.buffer.join("");
  }

  // Resize the PTY's notion of the terminal window. Must be called whenever
  // the renderer's xterm fits to a new size, otherwise the agent CLI keeps
  // wrapping at the original cols and its cursor-up redraws (claude's
  // "thinking..." spinner, codex's TUI footer, gemini's input frame) leave
  // leftover characters behind.
  resize(runnerId, cols, rows) {
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

  stop(runnerId, opts = {}) {
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

module.exports = {
  PtyRunnerManager,
  PTY_RUNNER_STATUS: STATUS
};
