import {fs, path, spawnSync, PROJECT_ROOT, SCRIPT_DIR, utils} from "../context";
import {keyValue} from "../output";

export function runLintTicket(specFile: string): { blocked: boolean; status: string; score: string; terms: string } {
  if (["off", "false", "0", "no"].includes((process.env.AUTOFLOW_LINT_TICKET || "on").toLowerCase())) {
    return { blocked: false, status: "", score: "", terms: "" };
  }
  const lintScript = path.join(SCRIPT_DIR, "..", "lint-ticket.ts");
  if (!fs.existsSync(lintScript)) return { blocked: false, status: "", score: "", terms: "" };
  const result = spawnSync("npx", ["tsx", lintScript, specFile], { cwd: PROJECT_ROOT, encoding: "utf8" });
  const raw = `${result.stdout || ""}\n${result.stderr || ""}`;
  const status = keyValue(raw, "lint_status");
  const score = keyValue(raw, "vagueness_score");
  const terms = keyValue(raw, "vague_terms");
  return { blocked: (result.status || 0) !== 0 || status === "block", status, score, terms };
}

export function missingRequiredSecrets(specFile: string): string[] {
  const text = utils.readFileSafe(specFile);
  const required = new Set<string>();
  const requiresLine = text.match(/^- Requires Secrets:\s*\[(.*?)\]\s*$/m);
  if (requiresLine) {
    for (const part of requiresLine[1].split(",")) {
      const name = part.replace(/[`"']/g, "").trim();
      if (/^[A-Z_][A-Z0-9_]*$/.test(name)) required.add(name);
    }
  }
  const command = utils.extractScalarFieldInSection(specFile, "Verification", "Command");
  for (const match of command.matchAll(/\$[{]?([A-Z_][A-Z0-9_]*)[}]?/g)) required.add(match[1]);
  return [...required].filter((name) => !process.env[name]);
}
