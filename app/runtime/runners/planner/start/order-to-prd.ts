import {fs, path, BOARD_ROOT, PROJECT_ROOT, displayId, utils} from "./context";
import {archiveFile, collectFiles} from "./files";
import {boardRelativePath, extractNumericId} from "./ids";
import {extractBulletSection, extractChecklist, extractSectionText} from "./sections";
import {normalizeChangeType, normalizePriority} from "./priority";

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
  const first = bulletValues(orderFile, "Verification")[0] || "";
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
  const paths = bulletValues(orderFile, "Allowed Paths");
  return paths.length > 0 ? paths : ["TBD"];
}

export function createGeneratedPrdFromOrder(orderFile: string): { specFile: string; archivedOrder: string } {
  const orderRef = boardRelativePath(orderFile);
  const id = nextPrdId();
  const projectKey = `prd_${id}`;
  const specFile = path.join(BOARD_ROOT, "tickets", "prd", `${projectKey}.md`);
  const archivedOrder = path.join(BOARD_ROOT, "tickets", "done", projectKey, path.basename(orderFile));
  const title = orderTitle(orderFile);
  const request = orderRequest(orderFile);
  const allowedPaths = orderAllowedPaths(orderFile);
  const verificationCommand = orderVerificationCommand(orderFile);
  const doneWhen = orderDoneWhen(orderFile, request, allowedPaths, verificationCommand);
  const priority = normalizePriority(utils.extractScalarFieldInSection(orderFile, "Order", "Priority"));
  const changeType = normalizeChangeType(utils.extractScalarFieldInSection(orderFile, "Order", "Change Type"));
  const timestamp = utils.nowIso();

  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    `# PRD ${projectKey}: ${title}

## Project

- ID: ${projectKey}
- Name: ${title}
- Title: ${title}
- Goal: ${oneLine(request)}
- Priority: ${priority}
- Change Type: ${changeType}
- AI: ${displayId}
- Status: generated
- Requires Secrets: []

## Core Scope

- Goal: order 요청을 가장 좁고 안전한 구현 범위로 해석해 실행 가능한 티켓으로 넘긴다.
- In Scope: ${oneLine(request)}
- Out of Scope: order에 명시되지 않은 독립 기능, 대규모 리팩터링, 외부 배포 작업.

## Main Screens / Modules

${allowedPaths.map((p) => `- Module: \`${p}\`\n- Path: \`${p}\``).join("\n")}

## Allowed Paths

${allowedPaths.map((p) => `- ${p}`).join("\n")}

## Global Acceptance Criteria

${doneWhen.join("\n")}

## Verification

- Command: ${verificationCommand}
- Notes: order에서 제공된 검증 힌트를 우선 사용한다. \`none-shell\` 이면 변경 파일 검토와 Done When 충족 여부를 티켓에 기록한다.

## Conversation Handoff

- Source: \`${orderRef}\`
- Summary: ${oneLine(request)}

## Notes

- Generated from quick order by ${displayId} at ${timestamp}.
- Consumed order archive target: \`${boardRelativePath(archivedOrder)}\`.
- Project root: \`${PROJECT_ROOT}\`.
`,
    "utf8"
  );

  if (fs.existsSync(orderFile)) {
    archiveFile(orderFile, archivedOrder);
  }

  return { specFile, archivedOrder };
}
