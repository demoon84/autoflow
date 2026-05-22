import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import parcelWatcher from "@parcel/watcher";
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
  log: () => {}
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
      return;
    }

    if (!electron || electron.killed) {
      startElectron();
      return;
    }

    restartingElectron = true;
    electron.kill();
  }, 100);
}

const mainProcessRootFiles = new Set(["main.ts", "preload.ts"]);
const mainProcessHelperExtensions = new Set([".ts", ".js"]);
// Auto-restart on main.ts / preload.ts / main-process helper changes is
// convenient for renderer-only work, but disruptive when PTY runners or native
// board watchers are active: killing Electron mid-turn can orphan runners and
// can trip @parcel/watcher native cleanup during process teardown. Keep it
// opt-in and require an explicit dev restart by default.
const AUTO_RESTART_ENABLED = process.env.AUTOFLOW_DESKTOP_AUTO_RESTART === "1";
const mainProcessWatchers = [];
if (AUTO_RESTART_ENABLED) {
  const srcRoot = path.join(desktopRoot, "src");
  mainProcessWatchers.push(await parcelWatcher.subscribe(srcRoot, (err, events) => {
    if (err) {
      return;
    }

    for (const event of events || []) {
      const changedFile = path.relative(srcRoot, event.path).split(path.sep).join("/");
      if (!changedFile || changedFile.startsWith("..")) {
        continue;
      }
      if (mainProcessRootFiles.has(changedFile)) {
        scheduleElectronRestart(path.join(srcRoot, changedFile));
        continue;
      }
      if (
        changedFile.startsWith("main/") &&
        mainProcessHelperExtensions.has(path.extname(changedFile))
      ) {
        scheduleElectronRestart(path.join(srcRoot, changedFile));
      }
    }
  }));
}
if (!AUTO_RESTART_ENABLED) {
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

  await Promise.all(mainProcessWatchers.map((watcher) => watcher.unsubscribe().catch(() => {})));

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
