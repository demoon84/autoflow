import {fs, path, BOARD_ROOT, requestedNormalized, utils} from "../context";
import {extractNumericId} from "../ids";
import {listMatchingFiles} from "../files";

export function isPlaceholderSpec(file: string): boolean {
  const text = utils.readFileSafe(file);
  return text.includes("<!-- AUTOFLOW_STARTER_SPEC_PLACEHOLDER -->") || text.includes("Replace with your project name");
}

export function isPlaceholderPlan(file: string): boolean {
  const text = utils.readFileSafe(file);
  return (
    text.includes("<!-- AUTOFLOW_STARTER_PLAN_PLACEHOLDER -->") ||
    text.includes("첫 구현 티켓 후보를 관찰 가능한 문장으로 적기") ||
    text.includes("- Title: Initial project bootstrap")
  );
}

export function selectPopulatedSpec(): string {
  if (requestedNormalized) {
    const file = path.join(BOARD_ROOT, "tickets", "prd", `PRD-${requestedNormalized}.md`);
    if (fs.existsSync(file) && !isPlaceholderSpec(file)) return file;
    return "";
  }
  for (const file of listMatchingFiles(path.join(BOARD_ROOT, "tickets", "prd"), [/^PRD-.*\.md$/])) {
    if (!isPlaceholderSpec(file) && extractNumericId(file)) return file;
  }
  return "";
}

export function selectLegacyPlan(): string {
  const roots = [path.join(BOARD_ROOT, "tickets", "plan"), path.join(BOARD_ROOT, "rules", "plan")];
  const root = roots.find((p) => fs.existsSync(p)) || roots[0];
  for (const file of listMatchingFiles(root, [/^plan_\d\d\d\.md$/])) {
    if (!isPlaceholderPlan(file)) return file;
  }
  return "";
}
