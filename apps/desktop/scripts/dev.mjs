import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const electronBin = path.join(
  desktopRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electron.cmd" : "electron"
);

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
  electron = spawn(electronBin, [desktopRoot], {
    cwd: desktopRoot,
    env: {
      ...process.env,
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

  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (!electron || electron.killed) {
      startElectron();
      return;
    }

    restartingElectron = true;
    console.log(`[desktop dev] Reloading Electron main process: ${path.relative(desktopRoot, filePath)}`);
    electron.kill();
  }, 100);
}

const mainProcessFiles = new Set(["main.js", "preload.js"]);
const mainProcessWatchers = [
  watch(path.join(desktopRoot, "src"), { persistent: true }, (_eventType, filename) => {
    const changedFile = filename ? filename.toString() : "";
    if (!mainProcessFiles.has(changedFile)) {
      return;
    }

    scheduleElectronRestart(path.join(desktopRoot, "src", changedFile));
  })
];

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
