// Token-free smoke test: spawn `claude --version` via PTY manager (no LLM
// call). Confirms the PTY can launch a real CLI binary, capture its TUI-ish
// output, and emit a stopped status when it exits.
//
// Usage: ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron scripts/test-pty-claude-version.js

const path = require("node:path");
require("tsx/cjs");
const { PtyRunnerManager, PTY_RUNNER_STATUS } = require(path.resolve(__dirname, "../src/main/runner-pty-manager.ts"));

const mgr = new PtyRunnerManager();
if (!mgr.isAvailable()) {
  console.error("FAIL: node-pty unavailable");
  process.exit(1);
}

const RUNNER_ID = "version-probe";
let bufferedOutput = "";
let statusEvents = [];

mgr.on("bytes", ({ data }) => { bufferedOutput += data; });
mgr.on("status", (payload) => statusEvents.push(payload));
mgr.on("error", (payload) => console.error("[error]", payload));

(async () => {
  console.log("--- spawn shell + 'claude --version && exit 0' ---");
  mgr.start(RUNNER_ID, {
    command: "claude --version && exit 0",
    cwd: process.env.HOME || "/tmp",
    cols: 100,
    rows: 24
  });

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const r = mgr.get(RUNNER_ID);
    if (r && r.status === PTY_RUNNER_STATUS.STOPPED) break;
    await new Promise((res) => setTimeout(res, 100));
  }

  console.log("");
  console.log("--- captured output (last 400 chars) ---");
  console.log(bufferedOutput.slice(-400));
  console.log("");
  console.log("--- status events ---");
  for (const e of statusEvents) console.log(" ", e);
  console.log("");

  // We expect a version string somewhere in the output and a stopped event.
  const hasVersion = /\d+\.\d+\.\d+/.test(bufferedOutput);
  const stopped = statusEvents.some((e) => e.status === "stopped");
  if (hasVersion && stopped) {
    console.log("\x1b[32mPASS\x1b[0m — claude --version round-tripped through PTY manager");
    process.exit(0);
  }
  console.log("\x1b[31mFAIL\x1b[0m — version string missing or no stop event");
  process.exit(1);
})();
