import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendRunnerLog } from "./board-queue";
import { defaultBoardDirName, ptyRunnerMeta, ptyRunnerPublicId, shortHash } from "./pty-scope";

const { app } = require("electron");

const codexRunnerHistoryModes = new Set(["isolated", "shared"]);

const codexHookTrustPromptAccepted = new Set<string>();
const codexHookTrustPromptAttempts = new Map<string, number>();
const codexHookTrustPromptTimers = new Map<string, NodeJS.Timeout>();
const codexHookTrustPromptWatchdogs = new Map<string, NodeJS.Timeout>();

export function safeCodexHomeSegment(value: unknown, fallback = "runner"): string {
  const cleaned = String(value || "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 64) || fallback;
}

export function normalizeCodexHistoryMode(value: unknown): string {
  const mode = String(value || "").trim().toLowerCase();
  return codexRunnerHistoryModes.has(mode) ? mode : "isolated";
}

export function defaultCodexHomePath(): string {
  const fromEnv = String(process.env.CODEX_HOME || "").trim();
  return fromEnv || path.join(os.homedir(), ".codex");
}

export function defaultClaudeHomePath(): string {
  const fromEnv = String(process.env.CLAUDE_HOME || process.env.CLAUDE_CONFIG_DIR || "").trim();
  return fromEnv || path.join(os.homedir(), ".claude");
}

export function copyCodexHomeFileIfFresh(sourceHome: string, targetHome: string, fileName: string, required = false): boolean {
  const source = path.join(sourceHome, fileName);
  const target = path.join(targetHome, fileName);
  try {
    const sourceStat = fsSync.statSync(source);
    if (!sourceStat.isFile()) return !required;
    let shouldCopy = true;
    try {
      const targetStat = fsSync.statSync(target);
      shouldCopy = sourceStat.mtimeMs > targetStat.mtimeMs;
    } catch {
      shouldCopy = true;
    }
    if (shouldCopy) {
      fsSync.copyFileSync(source, target);
      try { fsSync.chmodSync(target, 0o600); } catch {}
    }
    return true;
  } catch {
    return !required;
  }
}

export function ensureCodexRunnerHome(
  { projectRoot, boardDirName, runnerId }: { projectRoot: string; boardDirName: string; runnerId: string }
): { codexHome: string; authOk: boolean; sourceHome: string } {
  const sourceHome = defaultCodexHomePath();
  const projectSlug = safeCodexHomeSegment(path.basename(projectRoot || "project"), "project");
  const scopeHash = shortHash(`${path.resolve(projectRoot || "")}\0${boardDirName || defaultBoardDirName()}`);
  const targetHome = path.join(
    app.getPath("userData"),
    "codex-runners",
    `${projectSlug}-${scopeHash}`,
    safeCodexHomeSegment(runnerId, "runner")
  );
  fsSync.mkdirSync(targetHome, { recursive: true, mode: 0o700 });
  try { fsSync.chmodSync(targetHome, 0o700); } catch {}

  const authOk = copyCodexHomeFileIfFresh(sourceHome, targetHome, "auth.json", true);
  copyCodexHomeFileIfFresh(sourceHome, targetHome, "config.toml");
  // Autoflow 는 stop hook 을 사용하지 않는다. isolated codex home 에 hooks.json
  // 을 복사하지 않으며, 이전 설치에서 남은 잔존 파일을 정리한다.
  try { fsSync.rmSync(path.join(targetHome, "hooks.json"), { force: true }); } catch {}

  return { codexHome: targetHome, authOk, sourceHome };
}

export function normalizeRunnerReasoningValue(agent: unknown, value: unknown): string {
  const normalizedAgent = String(agent || "").toLowerCase();
  const normalized = String(value || "").trim().toLowerCase();
  const mediumPlus: Record<string, Set<string>> = {
    codex: new Set(["medium", "high", "xhigh"]),
    claude: new Set(["medium", "high", "xhigh", "max"])
  };
  const allowed = mediumPlus[normalizedAgent];
  if (!allowed) return normalized;
  return allowed.has(normalized) ? normalized : "medium";
}

export function supportedCodexProfile(model: string, reasoning: string): { model: string; reasoning: string } {
  return {
    model,
    reasoning: normalizeRunnerReasoningValue("codex", reasoning)
  };
}

export function stripTerminalControlSequences(text: unknown): string {
  return String(text || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[>=][0-9;?]*/g, "");
}

export function hasActiveCodexHookTrustPrompt(text: unknown): boolean {
  const clean = stripTerminalControlSequences(text).replace(/\s+/g, " ");
  const promptIndex = clean.lastIndexOf("Hooks need review");
  if (promptIndex < 0) return false;
  const tail = clean.slice(promptIndex);
  if (
    !/Trust\s*all\s*and\s*continue/i.test(tail) ||
    !/(Press\s*enter\s*to\s*(?:confirm|continue)|esc\s*to\s*go\s*back)/i.test(tail)
  ) {
    return false;
  }
  return !/(Use \/skills|Working|Ran |exec codex)/.test(tail);
}

type PtyManagerLike = {
  snapshot?: (runnerKey: string) => string | undefined;
  writeInput?: (runnerKey: string, sequence: string) => void;
  get?: (runnerKey: string) => { status?: string } | null | undefined;
};

export function scheduleCodexHookTrustPromptAccept(ptyManager: PtyManagerLike, runnerKey: string, chunk = ""): void {
  if (codexHookTrustPromptAccepted.has(runnerKey) || codexHookTrustPromptTimers.has(runnerKey)) return;
  const meta = ptyRunnerMeta.get(runnerKey);
  if (String(meta?.agent || "").toLowerCase() !== "codex") return;
  if ((codexHookTrustPromptAttempts.get(runnerKey) || 0) >= 4) return;

  const snapshot = typeof ptyManager.snapshot === "function" ? ptyManager.snapshot(runnerKey) || "" : "";
  const candidate = `${snapshot.slice(-3000)}\n${String(chunk || "")}`;
  if (!hasActiveCodexHookTrustPrompt(candidate)) return;

  const promptVisible = () => {
    const live = typeof ptyManager.snapshot === "function" ? ptyManager.snapshot(runnerKey) || "" : "";
    return hasActiveCodexHookTrustPrompt(live.slice(-3000));
  };

  const send = (sequence: string) => {
    try { ptyManager.writeInput?.(runnerKey, sequence); } catch {}
  };
  const sendIfPromptVisible = (sequence: string) => {
    if (!promptVisible()) return false;
    send(sequence);
    return true;
  };

  // Each variant re-checks the prompt before the follow-up key so we never
  // leak a stray "2" / Enter into a normal "›" prompt after the trust dialog
  // has already closed.
  const variants = [
    () => {
      if (!sendIfPromptVisible("2")) return;
      setTimeout(() => { sendIfPromptVisible("\r"); }, 80);
    },
    () => {
      if (!sendIfPromptVisible("\x1b[B")) return;
      setTimeout(() => { sendIfPromptVisible("\r"); }, 80);
    },
    () => {
      if (!sendIfPromptVisible("j")) return;
      setTimeout(() => { sendIfPromptVisible("\r"); }, 80);
    },
  ];

  const timer = setTimeout(() => {
    codexHookTrustPromptTimers.delete(runnerKey);
    if (codexHookTrustPromptAccepted.has(runnerKey)) return;
    if (!promptVisible()) return;
    codexHookTrustPromptAttempts.set(runnerKey, (codexHookTrustPromptAttempts.get(runnerKey) || 0) + 1);

    let attempt = 0;
    const tryNext = () => {
      if (attempt >= variants.length) return;
      const idx = attempt;
      attempt += 1;
      variants[idx]();
      setTimeout(() => {
        if (!promptVisible()) {
          codexHookTrustPromptAccepted.add(runnerKey);
          const currentMeta = ptyRunnerMeta.get(runnerKey) || meta;
          const publicRunnerId = currentMeta?.runnerId || ptyRunnerPublicId(runnerKey);
          if (currentMeta?.projectRoot) {
            const boardRoot = path.join(
              String(currentMeta.projectRoot),
              String(currentMeta.boardDirName || defaultBoardDirName())
            );
            appendRunnerLog(boardRoot, publicRunnerId, {
              event: "codex_hook_trust_prompt_auto_accepted",
              runner_id: publicRunnerId,
              variant: String(idx)
            });
          }
          return;
        }
        tryNext();
      }, 1500);
    };
    tryNext();
  }, 200);
  codexHookTrustPromptTimers.set(runnerKey, timer);
}

export function startCodexHookTrustPromptWatchdog(ptyManager: PtyManagerLike, runnerKey: string): void {
  if (codexHookTrustPromptWatchdogs.has(runnerKey)) return;
  let ticks = 0;
  const interval = setInterval(() => {
    ticks += 1;
    const runner = typeof ptyManager.get === "function" ? ptyManager.get(runnerKey) : null;
    if (
      ticks > 60 ||
      codexHookTrustPromptAccepted.has(runnerKey) ||
      !runner ||
      runner.status !== "running"
    ) {
      clearInterval(interval);
      codexHookTrustPromptWatchdogs.delete(runnerKey);
      return;
    }
    scheduleCodexHookTrustPromptAccept(ptyManager, runnerKey);
  }, 500);
  codexHookTrustPromptWatchdogs.set(runnerKey, interval);
}

export function clearCodexHookTrustPromptAutomation(runnerKey: string): void {
  codexHookTrustPromptAccepted.delete(runnerKey);
  codexHookTrustPromptAttempts.delete(runnerKey);
  const trustPromptTimer = codexHookTrustPromptTimers.get(runnerKey);
  if (trustPromptTimer) clearTimeout(trustPromptTimer);
  codexHookTrustPromptTimers.delete(runnerKey);
  const watchdog = codexHookTrustPromptWatchdogs.get(runnerKey);
  if (watchdog) clearInterval(watchdog);
  codexHookTrustPromptWatchdogs.delete(runnerKey);
}
