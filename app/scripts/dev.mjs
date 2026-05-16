import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { buildMainProcess } from "./build-main.mjs";

const require = createRequire(import.meta.url);
require("tsx/cjs");
const nodePtyPermissions = require("../src/main/node-pty-permissions.ts");

function ignoreBrokenPipe(stream) {
  if (!stream || typeof stream.on !== "function") return;
  stream.on("error", (error) => {
    if (error && error.code === "EPIPE") return;
    throw error;
  });
}

ignoreBrokenPipe(process.stdout);
ignoreBrokenPipe(process.stderr);

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopRoot, "..");
const electronBin = path.join(repoRoot, "node_modules", ".bin", "electron");
const { fixNodePtySpawnHelperPermissions } = nodePtyPermissions;

fixNodePtySpawnHelperPermissions({
  log: (message) => console.log(`[desktop dev] ${message}`)
});
await buildMainProcess();

const server = await createServer({
  configFile: path.join(desktopRoot, "vite.config.ts"),
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  clearScreen: false
});

await server.listen();
server.printUrls();

const rendererUrl =
  server.resolvedUrls?.local?.find((url) => url.startsWith("http://127.0.0.1:")) ||
  server.resolvedUrls?.local?.[0] ||
  "http://127.0.0.1:5173/";

let shuttingDown = false;
let restartingElectron = false;
let electron = null;
let restartTimer = null;

function startElectron() {
  electron = spawn(electronBin, [repoRoot], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTOFLOW_REPO_ROOT: repoRoot,
      ELECTRON_RENDERER_URL: rendererUrl
    },
    stdio: "inherit"
  });

  electron.on("exit", (code) => {
    if (shuttingDown) {
      return;
    }

    if (restartingElectron) {
      restartingElectron = false;
      startElectron();
      return;
    }

    void shutdown(code ?? 0);
  });
}

function scheduleElectronRestart(filePath) {
  if (shuttingDown) {
    return;
  }

  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(async () => {
    restartTimer = null;
    try {
      await buildMainProcess();
    } catch (error) {
      console.error("[desktop dev] Failed to rebuild Electron main process", error);
      return;
    }

    if (!electron || electron.killed) {
      startElectron();
      return;
    }

    restartingElectron = true;
    console.log(`[desktop dev] Reloading Electron main process: ${path.relative(desktopRoot, filePath)}`);
    electron.kill();
  }, 100);
}

const mainProcessRootFiles = new Set(["main.ts", "preload.ts"]);
const mainProcessHelperExtensions = new Set([".ts", ".js"]);
// Auto-restart on main.ts / preload.ts / main-process helper changes is
// convenient for renderer hot-reload, but extremely disruptive when PTY
// runners are running — the worker AI sometimes edits PROJECT_ROOT/main.ts
// (instead of its worktree) during ticket work, which triggers electron.kill()
// and ends up killing the very worker that made the edit. Set
// AUTOFLOW_DESKTOP_AUTO_RESTART=0 to disable auto-restart and require an
// explicit Cmd+R / restart.
const AUTO_RESTART_ENABLED = process.env.AUTOFLOW_DESKTOP_AUTO_RESTART !== "0";
const mainProcessWatchers = AUTO_RESTART_ENABLED
  ? [
      watch(path.join(desktopRoot, "src"), { persistent: true }, (_eventType, filename) => {
        const changedFile = filename ? filename.toString() : "";
        if (!mainProcessRootFiles.has(changedFile)) {
          return;
        }

        scheduleElectronRestart(path.join(desktopRoot, "src", changedFile));
      }),
      watch(path.join(desktopRoot, "src", "main"), { persistent: true }, (_eventType, filename) => {
        const changedFile = filename ? filename.toString() : "";
        if (!mainProcessHelperExtensions.has(path.extname(changedFile))) {
          return;
        }

        scheduleElectronRestart(path.join(desktopRoot, "src", "main", changedFile));
      })
    ]
  : [];
if (!AUTO_RESTART_ENABLED) {
  console.log("[desktop dev] AUTOFLOW_DESKTOP_AUTO_RESTART=0 — main.ts/preload.ts auto-restart disabled. Use Cmd+R or kill the dev process to restart.");
}

startElectron();

async function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  for (const watcher of mainProcessWatchers) {
    watcher.close();
  }

  if (electron && !electron.killed) {
    electron.kill();
  }

  await server.close();
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(0);
  });
}
