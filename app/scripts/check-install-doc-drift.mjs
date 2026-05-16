import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const roots = process.argv.slice(2).map((item) => path.resolve(item));
const scanRoots = roots.length > 0 ? roots : [path.join(repoRoot, "install")];

const textExtensions = new Set([
  ".md",
  ".toml",
  ".json",
  ".jsonl",
  ".txt",
  ".state",
  ".context",
  ".env",
  ".yml",
  ".yaml",
]);

const exactTextFileNames = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "SKILL.md",
]);

const checks = [
  {
    id: "legacy-script-entrypoint",
    pattern: /\b(?:scripts\/)?(?:runner-tool|start-ticket|verify-ticket|finish-ticket|merge-ready-ticket|update-wiki)\.ts\b/g,
  },
  {
    id: "legacy-runner-label",
    pattern: /\b(?:Plan AI|Planner AI|Impl AI|Wiki AI)\b/g,
  },
  {
    id: "verifier-ai-label",
    pattern: /\bVerifier AI\b/g,
    allow: (relativePath, line) => {
      const normalized = relativePath.split(path.sep).join("/");
      return (
        normalized.endsWith("reference/ticket-template.md") ||
        (normalized.endsWith("reference/tickets-board.md") &&
          (line.includes("Required fields include") ||
            line.includes("`Verifier AI`") ||
            line.trim() === "- `Verifier AI`" ||
            line.includes("`ID`, `Title`, `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier AI`")))
      );
    },
  },
  {
    id: "coordinator-active-contract",
    pattern: /\b(?:autoflow runners start coordinator-1|coordinator runner remains reachable|new installs can opt in|looped coordinator)\b/gi,
  },
];

function shouldSkip(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized.includes("/tickets/done/") ||
    normalized.includes("/tickets/archive/") ||
    normalized.includes("/runners/logs/") ||
    normalized.includes("/runners/state/") ||
    normalized.includes("/runners/state/wiki-embed-models/")
  );
}

function isTextFile(file) {
  const name = path.basename(file);
  if (exactTextFileNames.has(name)) return true;
  if (name.endsWith(".lock") || name.endsWith(".db") || name.endsWith(".sqlite") || name.endsWith(".sqlite3")) {
    return false;
  }
  return textExtensions.has(path.extname(name).toLowerCase()) || name.startsWith(".");
}

function walk(root, files = []) {
  if (!fs.existsSync(root)) return files;
  const stat = fs.statSync(root);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(root)) {
      if (name === ".git" || name === "node_modules") continue;
      walk(path.join(root, name), files);
    }
  } else if (stat.isFile() && isTextFile(root)) {
    files.push(root);
  }
  return files;
}

const findings = [];
for (const root of scanRoots) {
  for (const file of walk(root)) {
    const relativePath = path.relative(repoRoot, file) || file;
    if (shouldSkip(relativePath)) continue;
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, lineIndex) => {
      for (const check of checks) {
        check.pattern.lastIndex = 0;
        let match;
        while ((match = check.pattern.exec(line)) !== null) {
          if (check.allow?.(relativePath, line)) continue;
          findings.push({
            check: check.id,
            file: relativePath,
            line: lineIndex + 1,
            match: match[0],
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error(`install_doc_drift_status=fail`);
  console.error(`install_doc_drift_count=${findings.length}`);
  findings.slice(0, 50).forEach((finding, index) => {
    console.error(
      `install_doc_drift.${index + 1}=${finding.check}:${finding.file}:${finding.line}:${finding.match}`
    );
  });
  if (findings.length > 50) {
    console.error(`install_doc_drift.truncated=${findings.length - 50}`);
  }
  process.exit(1);
}

console.log("install_doc_drift_status=ok");
