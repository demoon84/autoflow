// Smoke test for the helper functions that build the CLI command + initial
// prompt. These are exposed indirectly via the IPC spawn handler in main.ts;
// we re-implement minimal copies here that the runtime helpers should match.
//
// Usage: node scripts/test-pty-spawn-helpers.js

const path = require("node:path");

// Mirror main.ts buildAgentCliCommand() — keep in sync.
function buildAgentCliCommand(agent, model, reasoning) {
  const parts = [];
  switch (String(agent || "").toLowerCase()) {
    case "claude": {
      parts.push("claude", "--dangerously-skip-permissions",
        "--permission-mode", "bypassPermissions",
        "--plugin-dir", ".claude/autoflow-plugin");
      if (model) parts.push("--model", model);
      if (reasoning) parts.push("--effort", reasoning);
      break;
    }
    case "codex": {
      parts.push("codex", "--dangerously-bypass-approvals-and-sandbox");
      if (model) parts.push("-m", model);
      if (reasoning) parts.push("-c", `model_reasoning_effort="${reasoning}"`);
      break;
    }
    case "gemini": {
      parts.push("gemini", "--skip-trust", "--approval-mode", "yolo");
      if (model) parts.push("--model", model);
      break;
    }
    default:
      return "";
  }
  return parts
    .map((p) => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(p) ? p : `'${p.replace(/'/g, "'\\''")}'`))
    .join(" ");
}

const cases = [
  { agent: "claude", model: "opus", reasoning: "medium",
    expect: "claude --dangerously-skip-permissions --permission-mode bypassPermissions --plugin-dir .claude/autoflow-plugin --model opus --effort medium" },
  { agent: "claude", model: "opus[1m]", reasoning: "xhigh",
    expect: "claude --dangerously-skip-permissions --permission-mode bypassPermissions --plugin-dir .claude/autoflow-plugin --model 'opus[1m]' --effort xhigh" },
  { agent: "codex", model: "gpt-5.4", reasoning: "low",
    expect: `codex --dangerously-bypass-approvals-and-sandbox -m gpt-5.4 -c 'model_reasoning_effort="low"'` },
  { agent: "gemini", model: "gemini-2.5-flash-lite", reasoning: "",
    expect: "gemini --skip-trust --approval-mode yolo --model gemini-2.5-flash-lite" },
  { agent: "unknown", model: "", reasoning: "",
    expect: "" }
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = buildAgentCliCommand(c.agent, c.model, c.reasoning);
  if (got === c.expect) {
    console.log(`\x1b[32mPASS\x1b[0m ${c.agent}`);
    pass++;
  } else {
    console.log(`\x1b[31mFAIL\x1b[0m ${c.agent}`);
    console.log(`  expect: ${c.expect}`);
    console.log(`  got:    ${got}`);
    fail++;
  }
}

console.log("");
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
