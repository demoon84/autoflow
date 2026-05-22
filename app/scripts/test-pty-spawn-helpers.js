// Smoke test for the helper functions that build the CLI command + initial
// prompt. These are exposed indirectly via the IPC spawn handler in main.ts;
// we re-implement minimal copies here that the runtime helpers should match.
//
// Usage: node scripts/test-pty-spawn-helpers.js

const path = require("node:path");

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function stripTerminalControlSequences(text) {
  return String(text || "")
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[>=][0-9;?]*/g, "");
}

// Mirror main.ts hasActiveCodexHookTrustPrompt() — keep in sync.
function hasActiveCodexHookTrustPrompt(text) {
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

// Mirror main.ts verifierPromptLooksReady() — keep in sync.
function verifierPromptLooksReady(snapshot, agent) {
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const lines = clean
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tailLines = lines.slice(-16);
  const tail = tailLines.join("\n");
  const compactTail = tail.replace(/\s+/g, " ").trim();
  if (/\b(Working|Running command|Thinking|Compacting|Booting MCP server)\b/i.test(compactTail)) return false;
  if (/Hooks need review/i.test(tail)) return false;
  if (/(Trust\s*all\s*and\s*continue|Continue\s*without\s*trusting|hooks\s*won'?t\s*run)/i.test(compactTail)) {
    return false;
  }
  if (runnerPromptNeedsContinue(snapshot, agent)) return false;
  const promptPattern = /^[›>]\s*(?:$|gpt-|claude|sonnet|opus|haiku|.*[~/][^ ]*)/i;
  const promptLine = tailLines.slice(-8).find((line) => promptPattern.test(line));
  if (promptLine) return true;
  if (/(?:^|\s)[›>]\s*(?:gpt-|claude|sonnet|opus|haiku|[~/])/i.test(compactTail)) return true;
  if (String(agent || "").toLowerCase() !== "codex") {
    if (/bypass\s+permissions\s+on/i.test(compactTail)) return true;
    return tailLines.slice(-3).some((line) => /^[›>]\s*$/.test(line));
  }
  return /(?:^|\s)›\s*$/.test(compactTail);
}

function runnerPromptNeedsContinue(snapshot, agent) {
  if (String(agent || "").toLowerCase() !== "codex") return false;
  const clean = stripTerminalControlSequences(snapshot)
    .replace(/\r/g, "\n")
    .replace(/\u001b/g, "");
  const compactTail = clean
    .split(/\n/)
    .slice(-20)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  return /press\s+enter\s+to\s+continue|esc\s+to\s+go\s+back/i.test(compactTail);
}

// Mirror main.ts buildAgentCliCommand() — keep in sync.
function buildAgentCliCommand(agent, model, reasoning, options = {}) {
  const parts = [];
  const rawSuffix = [];
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
      parts.push("codex", "--dangerously-bypass-approvals-and-sandbox", "--dangerously-bypass-hook-trust");
      if (model) parts.push("-m", model);
      if (reasoning) parts.push("-c", `model_reasoning_effort="${reasoning}"`);
      if (options.initialPromptFile) rawSuffix.push(`"$(cat ${shellQuote(options.initialPromptFile)})"`);
      break;
    }
    default:
      return "";
  }
  return [
    ...parts.map((p) => (/^[A-Za-z0-9_./:@%+=,-]+$/.test(p) ? p : shellQuote(p))),
    ...rawSuffix
  ]
    .join(" ");
}

const cases = [
  { agent: "claude", model: "opus", reasoning: "medium",
    expect: "claude --dangerously-skip-permissions --permission-mode bypassPermissions --plugin-dir .claude/autoflow-plugin --model opus --effort medium" },
  { agent: "claude", model: "opus[1m]", reasoning: "xhigh",
    expect: "claude --dangerously-skip-permissions --permission-mode bypassPermissions --plugin-dir .claude/autoflow-plugin --model 'opus[1m]' --effort xhigh" },
  { agent: "codex", model: "gpt-5.4", reasoning: "low",
    expect: `codex --dangerously-bypass-approvals-and-sandbox --dangerously-bypass-hook-trust -m gpt-5.4 -c 'model_reasoning_effort="low"'` },
  { agent: "codex", model: "gpt-5.5", reasoning: "medium", options: { initialPromptFile: "/tmp/autoflow-startup-prompt.md" },
    expect: `codex --dangerously-bypass-approvals-and-sandbox --dangerously-bypass-hook-trust -m gpt-5.5 -c 'model_reasoning_effort="medium"' "$(cat '/tmp/autoflow-startup-prompt.md')"` },
  { agent: "unknown", model: "", reasoning: "",
    expect: "" }
];

let pass = 0, fail = 0;
for (const c of cases) {
  const got = buildAgentCliCommand(c.agent, c.model, c.reasoning, c.options || {});
  if (got === c.expect) {
    pass++;
  } else {
    fail++;
  }
}

const hookPromptCases = [
  {
    input: "Hooks need review\n1. Trust all and continue\n2. Trust all and continue\nPress enter to confirm",
    expect: true
  },
  {
    input: "Hooks need review\n1. Trust all and continue\n2. Trust all and continue\nPress enter to continue or esc to go back",
    expect: true
  },
  {
    input: "Hooks need review1 hook is new or changed.› 1. Review hooks2.Trustallandcontinue3.Continuewithouttrusting(hookswon'trun)Press enter to confirm or esc to go back",
    expect: true
  },
  {
    input: "Working\nUse /skills to load more",
    expect: false
  }
];

for (const c of hookPromptCases) {
  const got = hasActiveCodexHookTrustPrompt(c.input);
  if (got === c.expect) {
    pass++;
  } else {
    fail++;
  }
}

const promptReadyCases = [
  {
    input: "\x1b[2K\r› gpt-5.5 low · ~/Documents/project/kit",
    agent: "codex",
    expect: true
  },
  {
    input: "final answer\n›",
    agent: "codex",
    expect: true
  },
  {
    input: "final answer\nPress enter to continue or esc to go back\n›",
    agent: "codex",
    expect: false
  },
  {
    input: "Working\nRunning command npm test\n›",
    agent: "codex",
    expect: false
  },
  {
    input: "Hooks need review\n2. Trust all and continue\nPress Enter to confirm",
    agent: "codex",
    expect: false
  },
  {
    input: "> claude opus · ~/Documents/project/kit",
    agent: "claude",
    expect: true
  },
  {
    input: "TODO-002 verifier pass. 큐 비어 idle.\nBypass permissions on",
    agent: "claude",
    expect: true
  }
];

for (const c of promptReadyCases) {
  const got = verifierPromptLooksReady(c.input, c.agent);
  if (got === c.expect) {
    pass++;
  } else {
    fail++;
  }
}

const continuePromptCases = [
  {
    input: "final answer\nPress enter to continue or esc to go back\n›",
    agent: "codex",
    expect: true
  },
  {
    input: "TODO-002 verifier pass. 큐 비어 idle.\nBypass permissions on",
    agent: "claude",
    expect: false
  }
];

for (const c of continuePromptCases) {
  const got = runnerPromptNeedsContinue(c.input, c.agent);
  if (got === c.expect) {
    pass++;
  } else {
    fail++;
  }
}

process.exit(fail === 0 ? 0 : 1);
