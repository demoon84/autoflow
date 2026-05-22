// Smoke test: spawn a PTY runner via PtyRunnerManager, type a command, and
// verify bytes flow + status events. Runs under electron's bundled node so
// the rebuilt node-pty native module loads cleanly.
//
// Usage:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron scripts/test-pty-manager.js

const path = require("node:path");
require("tsx/cjs");
const { PtyRunnerManager, PTY_RUNNER_STATUS } = require(path.resolve(__dirname, "../src/main/runner-pty-manager.ts"));

const mgr = new PtyRunnerManager();
if (!mgr.isAvailable()) {
  process.exit(1);
}

const RUNNER_ID = "smoke";
let bytesReceived = 0;
let statusEvents = [];

mgr.on("bytes", ({ runnerId, data }) => {
  bytesReceived += Buffer.byteLength(data, "utf8");
  // print first chunk for visual confirmation
  if (bytesReceived < 2048) {
    process.stdout.write(`\x1b[36m[bytes:${runnerId}]\x1b[0m ${JSON.stringify(data.slice(0, 120))}\n`);
  }
});
mgr.on("status", (payload) => {
  statusEvents.push(payload);
});
mgr.on("error", (payload) => {
});

(async () => {
  mgr.start(RUNNER_ID, {
    command: 'echo "hello from pty manager" && date && exit 0',
    cwd: process.env.HOME || "/tmp",
    cols: 100,
    rows: 24
  });

  // Wait up to 6 seconds for the shell to emit and exit
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const r = mgr.get(RUNNER_ID);
    if (r && r.status === PTY_RUNNER_STATUS.STOPPED) break;
    await new Promise((res) => setTimeout(res, 100));
  }


  const EXEC_RUNNER_ID = "exec-smoke";
  mgr.start(EXEC_RUNNER_ID, {
    command: "sh -c 'printf exec-safe && exit 42'",
    execCommand: true,
    cwd: process.env.HOME || "/tmp",
    cols: 100,
    rows: 24
  });

  const execDeadline = Date.now() + 6000;
  while (Date.now() < execDeadline) {
    const r = mgr.get(EXEC_RUNNER_ID);
    if (r && r.status === PTY_RUNNER_STATUS.STOPPED) break;
    await new Promise((res) => setTimeout(res, 100));
  }

  const execRunner = mgr.get(EXEC_RUNNER_ID);
  const execStopped = execRunner?.status === PTY_RUNNER_STATUS.STOPPED;
  const execExitCode = execRunner?.exitCode;
  const execPromptAccepted = mgr.writePrompt(EXEC_RUNNER_ID, "this must not reach a shell");

  const ok =
    bytesReceived > 0 &&
    statusEvents.some((e) => e.status === "stopped" && e.runnerId === RUNNER_ID) &&
    execStopped &&
    execExitCode === 42 &&
    execPromptAccepted === false;
  if (ok) {
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
