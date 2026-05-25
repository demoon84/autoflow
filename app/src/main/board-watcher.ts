import fsSync from "node:fs";
import path from "node:path";
import * as parcelWatcher from "@parcel/watcher";
import { appendRunnerLog } from "./board-queue";
import {
  contextResetEventIsSchedulable,
  readPendingRunnerContextResetEvents,
  runnerIdForContextResetQueueChange,
  scheduleContextReset
} from "./context-reset";
import { scheduleAllHandoffTurnsForScope } from "./handoff-turns";
import { defaultBoardDirName, ptyRunnerKey, ptyRunnerMeta } from "./pty-scope";

const { BrowserWindow } = require("electron");

type Scope = { projectRoot?: string; boardDirName?: string };

type BoardWatcherEntry = {
  subscription: { unsubscribe: () => Promise<void> } | null;
  snapshotRefreshTimer: NodeJS.Timeout | null;
  handoffSweepTimer: NodeJS.Timeout | null;
  debounceTimer: NodeJS.Timeout | null;
  lastReason: string;
  pendingReasons: Set<string>;
};

type BoardWatcherDeps = {
  clearReadBoardCachesForScope: (scope: Scope) => void;
  reconcileCliRunnerControlRequestsForScope: (scope: Scope, reasons: string[]) => Promise<unknown>;
};

let deps: BoardWatcherDeps | null = null;

export function initBoardWatcher(injected: BoardWatcherDeps): void {
  deps = injected;
}

const boardWatchersByScope = new Map<string, BoardWatcherEntry>();
const boardWatchDebounceMs = 250;
const handoffSelfHealReason = "handoff-sweep";

function handoffSweepIntervalMs(): number {
  const raw = Number.parseInt(process.env.AUTOFLOW_HANDOFF_SWEEP_INTERVAL_MS || "30000", 10);
  if (!Number.isFinite(raw)) return 30000;
  return raw <= 0 ? 0 : Math.max(5000, raw);
}

export function projectScopeKey(projectRoot: string, boardDirName: string): string {
  return `${projectRoot}\0${boardDirName}`;
}

export function ensureBoardWatcher(scope: Scope): void {
  if (!scope || typeof scope.projectRoot !== "string" || !scope.projectRoot) return;
  const boardDirName = scope.boardDirName || defaultBoardDirName();
  const key = projectScopeKey(scope.projectRoot, boardDirName);
  if (boardWatchersByScope.has(key)) return;
  const boardRoot = path.join(scope.projectRoot, boardDirName);
  if (!fsSync.existsSync(boardRoot)) return;

  const entry: BoardWatcherEntry = {
    subscription: null,
    snapshotRefreshTimer: null,
    handoffSweepTimer: null,
    debounceTimer: null,
    lastReason: "",
    pendingReasons: new Set()
  };
  boardWatchersByScope.set(key, entry);

  const scheduleBoardRunnerHandoffs = (reasons: string[]) => {
    scheduleAllHandoffTurnsForScope({ projectRoot: scope.projectRoot!, boardDirName, boardRoot, reasons });
  };

  const broadcast = () => {
    const reasons = entry.pendingReasons.size > 0
      ? Array.from(entry.pendingReasons)
      : [entry.lastReason || "board-change"];
    const reason = reasons[reasons.length - 1] || "board-change";
    entry.lastReason = "";
    entry.pendingReasons.clear();
    // Board broadcasts only invalidate UI caches; runner shutdown stays on explicit stop paths.
    deps?.clearReadBoardCachesForScope({ projectRoot: scope.projectRoot, boardDirName });
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send("autoflow:boardChange", {
            projectRoot: scope.projectRoot,
            boardDirName,
            reason
          });
        } catch {}
      }
    }
    try {
      void deps?.reconcileCliRunnerControlRequestsForScope(
        { projectRoot: scope.projectRoot, boardDirName },
        reasons
      ).catch(() => {});
      scheduleBoardRunnerHandoffs(reasons);
      const contextResetByRunner = new Map<string, unknown>();
      for (const candidateReason of reasons) {
        const contextResetRunnerId = runnerIdForContextResetQueueChange(candidateReason);
        if (contextResetRunnerId) {
          const events = readPendingRunnerContextResetEvents(boardRoot, contextResetRunnerId);
          for (const event of events) {
            contextResetByRunner.set(contextResetRunnerId, event);
          }
        }
      }
      if (contextResetByRunner.size > 0) {
        for (const [rid, event] of contextResetByRunner.entries()) {
          const runnerKey = ptyRunnerKey(scope.projectRoot!, boardDirName, rid);
          const meta = ptyRunnerMeta.get(runnerKey);
          if (!meta) {
            appendRunnerLog(boardRoot, rid, {
              event: "context_reset_event_skipped",
              runner_id: rid,
              reason: String((event as any)?.reason || "ticket_boundary"),
              cause: "runner_meta_missing"
            });
            continue;
          }
          if (meta.projectRoot !== scope.projectRoot || meta.boardDirName !== boardDirName) continue;
          if (!contextResetEventIsSchedulable(event as any)) {
            appendRunnerLog(boardRoot, rid, {
              event: "context_reset_event_skipped",
              runner_id: rid,
              reason: String((event as any)?.reason || "ticket_boundary"),
              cause: "not_final_ticket_boundary",
              tool: String((event as any)?.tool || ""),
              backend_status: String((event as any)?.backend_status || "")
            });
            continue;
          }
          scheduleContextReset(runnerKey, meta, {
            mode: (event as any)?.mode,
            trigger: String((event as any)?.reason || "ticket_boundary"),
            reason: String((event as any)?.tool || (event as any)?.reason || "ticket_boundary"),
          });
        }
      }
    } catch {}
  };

  const enqueue = (reason: string) => {
    const normalizedReason = reason || "board-change";
    entry.lastReason = normalizedReason || entry.lastReason || "board-change";
    entry.pendingReasons.add(normalizedReason);
    if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      broadcast();
    }, boardWatchDebounceMs);
  };

  const watchedRelPrefixes = ["tickets/", "runners/", "wiki/"];
  const toBoardRel = (absolutePath: string): string => {
    const rel = path.relative(boardRoot, String(absolutePath || "")).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) return "";
    if (rel === "tickets" || rel === "runners" || rel === "wiki") return rel;
    if (!watchedRelPrefixes.some((prefix) => rel.startsWith(prefix))) return "";
    if (rel === "runners/logs" || rel.startsWith("runners/logs/") || rel === "logs" || rel.startsWith("logs/")) return "";
    const base = path.basename(rel);
    if (base.endsWith(".tmp") || base.endsWith(".swp") || base.endsWith("~") || base.startsWith(".#") || base.startsWith(".!")) return "";
    return rel;
  };

  const parcelIgnore = [
    "**/.git/**",
    "**/node_modules/**",
    "**/runners/logs/**",
    "**/logs/**",
    "**/*.tmp",
    "**/*.swp",
    "**/.#*",
    "**/*~"
  ];

  const snapshotPath = path.join(boardRoot, "runners", "state", "parcel-watcher.snapshot");
  const refreshSnapshot = async () => {
    try {
      fsSync.mkdirSync(path.dirname(snapshotPath), { recursive: true });
      await parcelWatcher.writeSnapshot(boardRoot, snapshotPath, { ignore: parcelIgnore });
    } catch {}
  };

  const catchUpFromSnapshot = async () => {
    if (!fsSync.existsSync(snapshotPath)) return;
    try {
      const events = await parcelWatcher.getEventsSince(boardRoot, snapshotPath, { ignore: parcelIgnore });
      for (const event of events || []) {
        const rel = toBoardRel(event.path);
        if (rel) enqueue(rel || "boot-catchup");
      }
      if (events && events.length > 0) enqueue("boot-catchup");
    } catch {
      try { fsSync.rmSync(snapshotPath, { force: true }); } catch {}
    }
  };

  (async () => {
    await catchUpFromSnapshot();
    try {
      entry.subscription = await parcelWatcher.subscribe(
        boardRoot,
        (err: unknown, events: { path: string }[]) => {
          if (err) return;
          for (const event of events || []) {
            const rel = toBoardRel(event.path);
            if (rel) enqueue(rel);
          }
        },
        { ignore: parcelIgnore }
      );
    } catch {}
    await refreshSnapshot();
    try { scheduleBoardRunnerHandoffs(["boot-catchup"]); } catch {}
    entry.snapshotRefreshTimer = setInterval(() => { void refreshSnapshot(); }, 10 * 60 * 1000);
    const sweepIntervalMs = handoffSweepIntervalMs();
    if (sweepIntervalMs > 0) {
      entry.handoffSweepTimer = setInterval(() => {
        try {
          scheduleBoardRunnerHandoffs([handoffSelfHealReason]);
        } catch {}
      }, sweepIntervalMs);
      if (typeof entry.handoffSweepTimer.unref === "function") entry.handoffSweepTimer.unref();
    }
  })();
}

export function disposeBoardWatcherForScope(scope: Scope): void {
  if (!scope) return;
  const boardDirName = scope.boardDirName || defaultBoardDirName();
  const key = projectScopeKey(scope.projectRoot || "", boardDirName);
  const entry = boardWatchersByScope.get(key);
  if (!entry) return;
  if (entry.debounceTimer) { clearTimeout(entry.debounceTimer); entry.debounceTimer = null; }
  if (entry.snapshotRefreshTimer) { clearInterval(entry.snapshotRefreshTimer); entry.snapshotRefreshTimer = null; }
  if (entry.handoffSweepTimer) { clearInterval(entry.handoffSweepTimer); entry.handoffSweepTimer = null; }
  if (entry.subscription) {
    void entry.subscription.unsubscribe().catch(() => {});
    entry.subscription = null;
  }
  boardWatchersByScope.delete(key);
}

function drainBoardWatcherEntries(): Promise<void>[] {
  const unsubscribes: Promise<void>[] = [];
  for (const key of [...boardWatchersByScope.keys()]) {
    const entry = boardWatchersByScope.get(key);
    if (!entry) continue;
    if (entry.debounceTimer) { clearTimeout(entry.debounceTimer); entry.debounceTimer = null; }
    if (entry.snapshotRefreshTimer) { clearInterval(entry.snapshotRefreshTimer); entry.snapshotRefreshTimer = null; }
    if (entry.handoffSweepTimer) { clearInterval(entry.handoffSweepTimer); entry.handoffSweepTimer = null; }
    if (entry.subscription) {
      unsubscribes.push(entry.subscription.unsubscribe().catch(() => {}));
      entry.subscription = null;
    }
    boardWatchersByScope.delete(key);
  }
  return unsubscribes;
}

export function disposeAllBoardWatchers(): void {
  void Promise.all(drainBoardWatcherEntries());
}

export async function disposeAllBoardWatchersAsync(): Promise<void> {
  await Promise.all(drainBoardWatcherEntries());
}
