// Smoke test: spawn a PTY runner via PtyRunnerManager, type a command, and
// verify bytes flow + status events. Runs under electron's bundled node so
// the rebuilt node-pty native module loads cleanly.
//
// Usage:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron scripts/test-pty-manager.js

const path = require("node:path");
const { PtyRunnerManager, PTY_RUNNER_STATUS } = require(path.resolve(__dirname, "../src/main/runner-pty-manager"));

const mgr = new PtyRunnerManager();
if (!mgr.isAvailable()) {
  console.error("FAIL: node-pty unavailable");
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
  console.log(`\x1b[33m[status]\x1b[0m`, payload);
});
mgr.on("error", (payload) => {
  console.error(`\x1b[31m[error]\x1b[0m`, payload);
});

(async () => {
  console.log("--- spawn shell + 'echo hello world && exit 0' ---");
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

  console.log("");
  console.log("--- summary ---");
  console.log("bytes received:", bytesReceived);
  console.log("status events :", statusEvents.length);
  console.log("final status  :", mgr.get(RUNNER_ID)?.status);
  console.log("final exitCode:", mgr.get(RUNNER_ID)?.exitCode);

  const ok = bytesReceived > 0 && statusEvents.some((e) => e.status === "stopped");
  if (ok) {
    console.log("\x1b[32mPASS\x1b[0m — PTY manager round-trip works");
    process.exit(0);
  } else {
    console.log("\x1b[31mFAIL\x1b[0m — no bytes or no stopped event");
    process.exit(1);
  }
})();
