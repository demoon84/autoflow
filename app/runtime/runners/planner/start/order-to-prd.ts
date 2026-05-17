import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "./context";
import {archiveFile, collectFiles} from "./files";
import {boardRelativePath, extractNumericId} from "./ids";
import {SplitMapEntry, extractBulletSection, extractChecklist, extractSectionText, extractSplitMap} from "./sections";
import {normalizeChangeType, normalizePriority} from "./priority";

type GeneratedPrdDraft = {
  title: string;
  goal: string;
  inScope: string;
  allowedPaths: string[];
  verificationCommand: string;
  doneWhen: string[];
  notes: string[];
  splitIndex: number;
  splitCount: number;
};

function nextPrdId(): string {
  let max = 0;
  for (const file of collectFiles(path.join(BOARD_ROOT, "tickets"), /^(prd|project)_\d+\.md$/)) {
    const id = Number.parseInt(extractNumericId(file) || "0", 10);
    if (id > max) max = id;
  }
  return String(max + 1).padStart(3, "0");
}

function firstHeading(file: string): string {
  const text = utils.readFileSafe(file);
  return (text.match(/^#\s+(.+)$/m)?.[1] || "").trim();
}

function oneLine(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}...` : compact;
}

function bulletValues(file: string, heading: string): string[] {
  return extractBulletSection(file, heading)
    .map((item) => item.replace(/^Command:\s*/i, "").trim())
    .filter((item) => item && item !== "TBD" && !/^TODO\b/i.test(item));
}

function firstNonEmptyBullets(file: string, headings: string[]): string[] {
  for (const heading of headings) {
    const values = bulletValues(file, heading);
    if (values.length > 0) return values;
  }
  return [];
}

function orderTitle(orderFile: string): string {
  const explicit = utils.extractScalarFieldInSection(orderFile, "Order", "Title");
  if (explicit) return explicit;
  const heading = firstHeading(orderFile);
  const m = heading.match(/^Order\s+\d+:\s*(.+)$/i);
  return (m?.[1] || heading || `Order ${extractNumericId(orderFile)}`).trim();
}

function orderRequest(orderFile: string): string {
  return extractSectionText(orderFile, "Request").trim() || firstHeading(orderFile) || path.basename(orderFile);
}

function orderVerificationCommand(orderFile: string): string {
  const scalar = utils.extractScalarFieldInSection(orderFile, "Verification", "Command");
  if (scalar && scalar !== "TBD") return scalar;
  const hintScalar = utils.extractScalarFieldInSection(orderFile, "Verification Hints", "Command");
  if (hintScalar && hintScalar !== "TBD") return hintScalar;
  const first = firstNonEmptyBullets(orderFile, ["Verification", "Verification Hints"])[0] || "";
  return first && first !== "TBD" ? first : "none-shell";
}

function orderDoneWhen(orderFile: string, request: string, allowedPaths: string[], verificationCommand: string): string[] {
  const explicit = extractChecklist(orderFile, "Done When").map((item) => item.trim());
  const fallbackPath = allowedPaths[0] || boardRelativePath(orderFile);
  const generated = [
    `- [ ] \`${fallbackPath}\` 범위에서 order 요청의 핵심 동작이 반영된다.`,
    `- [ ] 검증 명령 \`${verificationCommand}\` 이 exit 0 으로 끝나거나, \`none-shell\` 인 경우 파일 검토 근거가 남는다.`,
    `- [ ] 최종 diff가 \`Allowed Paths\` 밖의 파일을 포함하지 않는다.`,
  ];
  const combined = [...explicit, ...generated];
  const seen = new Set<string>();
  return combined.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, Math.max(3, Math.min(combined.length, 5)));
}

function orderAllowedPaths(orderFile: string): string[] {
  const paths = firstNonEmptyBullets(orderFile, ["Allowed Paths", "Allowed Paths Hints"]);
  return paths.length > 0 ? paths : ["TBD"];
}

function orderScopeHints(orderFile: string): string[] {
  return firstNonEmptyBullets(orderFile, ["Scope Hints", "Scope"]);
}

function orderPlannerHints(orderFile: string): string[] {
  return firstNonEmptyBullets(orderFile, ["Planner Hints", "Notes"]);
}

function splitListValues(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(/[;,]/))
    .map((value) => value.replace(/`/g, "").trim())
    .filter((value) => value && value !== "TBD" && value !== "...");
}

function splitChecklistValues(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value && value !== "TBD" && value !== "...")
    .map((value) => (/^\s*-\s*\[[ xX]\]/.test(value) ? value : `- [ ] ${value}`));
}

function firstSplitValue(entry: SplitMapEntry, key: string): string {
  return (entry.fields[key] || []).find((value) => value.trim()) || "";
}

function splitDraftsFromOrder(orderFile: string): GeneratedPrdDraft[] {
  const title = orderTitle(orderFile);
  const request = orderRequest(orderFile);
  const defaultAllowedPaths = orderAllowedPaths(orderFile);
  const defaultVerificationCommand = orderVerificationCommand(orderFile);
  const defaultScopeHints = orderScopeHints(orderFile);
  const defaultPlannerHints = orderPlannerHints(orderFile);
  const entries = extractSplitMap(orderFile, ["PRD Split Map", "Split PRDs", "PRD Splits", "Split Map"]);

  if (entries.length === 0) {
    return [{
      title,
      goal: oneLine(request),
      inScope: defaultScopeHints.length > 0 ? oneLine(defaultScopeHints.join(" ")) : oneLine(request),
      allowedPaths: defaultAllowedPaths,
      verificationCommand: defaultVerificationCommand,
      doneWhen: orderDoneWhen(orderFile, request, defaultAllowedPaths, defaultVerificationCommand),
      notes: defaultPlannerHints,
      splitIndex: 1,
      splitCount: 1,
    }];
  }

  return entries.map((entry, index) => {
    const entryTitle = firstSplitValue(entry, "title") || entry.title || `Split ${index + 1}`;
    const allowedPaths = splitListValues(entry.fields.allowed_paths || []);
    const verificationCommand = firstSplitValue(entry, "verification").replace(/^Command:\s*/i, "") || defaultVerificationCommand;
    const scope = firstSplitValue(entry, "scope") || firstSplitValue(entry, "goal") || entryTitle;
    const goal = firstSplitValue(entry, "goal") || scope;
    const doneWhen = splitChecklistValues(entry.fields.done_when || []);
    return {
      title: `${title} - ${entryTitle}`,
      goal: oneLine(goal || request),
      inScope: oneLine(scope || request),
      allowedPaths: allowedPaths.length > 0 ? allowedPaths : defaultAllowedPaths,
      verificationCommand,
      doneWhen: doneWhen.length > 0 ? doneWhen : orderDoneWhen(orderFile, `${request} ${entryTitle}`, allowedPaths.length > 0 ? allowedPaths : defaultAllowedPaths, verificationCommand),
      notes: [...defaultPlannerHints, ...(entry.fields.notes || []), ...(entry.fields.depends_on || []).map((item) => `Depends on: ${item}`)],
      splitIndex: index + 1,
      splitCount: entries.length,
    };
  });
}

function orderArchiveTarget(orderFile: string, firstProjectKey: string, splitCount: number): string {
  const doneKey = splitCount > 1 ? path.basename(orderFile, ".md") : firstProjectKey;
  return path.join(BOARD_ROOT, "tickets", "done", doneKey, path.basename(orderFile));
}

function writeGeneratedPrdFromDraft(orderFile: string, draft: GeneratedPrdDraft, archivedOrder: string): string {
  const orderRef = boardRelativePath(orderFile);
  const id = nextPrdId();
  const projectKey = `prd_${id}`;
  const specFile = path.join(BOARD_ROOT, "tickets", "prd", `${projectKey}.md`);
  const request = orderRequest(orderFile);
  const priority = normalizePriority(utils.extractScalarFieldInSection(orderFile, "Order", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(orderFile, "Order", "Change Type"));
  const timestamp = utils.nowIso();

  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    `# PRD ${projectKey}: ${draft.title}

## Project

- ID: ${projectKey}
- Name: ${draft.title}
- Title: ${draft.title}
- Goal: ${draft.goal}
- Priority: ${priority}
- Change Type: ${changeType}
- AI: ${displayId}
- Status: generated
- Requires Secrets: []

## Core Scope

- Goal: order 요청을 가장 좁고 안전한 구현 범위로 해석해 실행 가능한 티켓으로 넘긴다.
- In Scope: ${draft.inScope}
- Out of Scope: order에 명시되지 않은 독립 기능, 대규모 리팩터링, 외부 배포 작업.

## Main Screens / Modules

${draft.allowedPaths.map((p) => `- Module: \`${p}\`\n- Path: \`${p}\``).join("\n")}

## Allowed Paths

${draft.allowedPaths.map((p) => `- ${p}`).join("\n")}

## Global Acceptance Criteria

${draft.doneWhen.join("\n")}

## Verification

- Command: ${draft.verificationCommand}
- Notes: order에서 제공된 검증 힌트를 우선 사용한다. \`none-shell\` 이면 변경 파일 검토와 Done When 충족 여부를 티켓에 기록한다.

## Conversation Handoff

- Source: \`${orderRef}\`
- Summary: ${oneLine(request)}

## Notes

- Generated from quick order by ${displayId} at ${timestamp}.
- Order split: ${draft.splitIndex}/${draft.splitCount}.
- Consumed order archive target: \`${boardRelativePath(archivedOrder)}\`.
- Project root: \`${PROJECT_ROOT}\`.
${draft.notes.length > 0 ? draft.notes.map((item) => `- Order planner hint: ${item}`).join("\n") + "\n" : ""}`,
    "utf8"
  );
  return specFile;
}

export function createGeneratedPrdsFromOrder(orderFile: string): { specFiles: string[]; archivedOrder: string } {
  const drafts = splitDraftsFromOrder(orderFile);
  const firstProjectKey = `prd_${nextPrdId()}`;
  const archivedOrder = orderArchiveTarget(orderFile, firstProjectKey, drafts.length);
  const specFiles = drafts.map((draft) => writeGeneratedPrdFromDraft(orderFile, draft, archivedOrder));

  if (fs.existsSync(orderFile)) {
    archiveFile(orderFile, archivedOrder);
  }

  return { specFiles, archivedOrder };
}

export function createGeneratedPrdFromOrder(orderFile: string): { specFile: string; archivedOrder: string } {
  const generated = createGeneratedPrdsFromOrder(orderFile);
  return { specFile: generated.specFiles[0] || "", archivedOrder: generated.archivedOrder };
}
