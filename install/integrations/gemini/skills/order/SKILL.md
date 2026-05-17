---
name: order
description: Use when the user invokes $order, says #order, invokes /order, or asks to drop a small Autoflow order/quick change into the board without drafting a full PRD.
---

# Autoflow Quick Order

Act as the lightweight Autoflow intake hook for small, clear changes.

## Lookup Before Saving

Before writing the order, surface relevant prior work so the user can build on past decisions instead of re-doing them.

1. Identify 1–3 distinctive keywords from the user's request: feature noun, file path basename, error string, UI element name, etc.
2. Run, best-effort (any error → treat as "no hits", continue):
   - `autoflow origin search "<keyword>"` — past PRDs/orders matching prompt, prd_path, ticket title, or commit subject.
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — 위키의 prior decisions, learnings, failed/retried approaches, and related done-ticket context. Use multiple `--term` flags when you have multiple strong keywords.
3. If non-trivial hits return, briefly summarize origin and wiki findings in Korean to the user:
   "비슷한 과거 작업: prd_142 (...), order_88 (...). 그대로 발행할까요?"
4. Use relevant wiki findings to tighten obvious `--allowed-path`, `--scope`, `--verification`, or `## Notes` hints, but do not decide whether PRD authoring can be skipped; that decision belongs to the planner runner.
5. Proceed to save the order regardless of lookup outcome — the user's intent is the source of truth, lookup only highlights duplicates or relevant context.

Skip lookup for very short requests (≤ 8 chars) where keywords are unreliable.

## Rules

1. Treat `$order`, `#order`, `/order`, and "quick Autoflow order" as order triggers.
2. Save a concise note to `{{BOARD_DIR}}/tickets/order/order_*.md`; do not draft a full PRD in chat.
3. Do not require full PRD approval for explicit order triggers. The user already asked for quick intake.
4. Preserve the user's original request under `## Request`.
5. Add `--allowed-path`, `--scope`, and `--verification` hints only when they are obvious from the repo or conversation. Leave inference to the planner runner when unsure.
6. If the order clearly spans multiple independent outcomes, modules, releases, or verification paths, include `## PRD Split Map` hints so the planner runner can generate multiple PRDs.
7. Prefer `autoflow order create <project-root> <board-dir-name> --from-file <draft-file> --title <short title>` when the CLI is available and no split map is needed. If a split map is needed, write the order template directly.
8. Add `--priority critical` only for host resource exhaustion, board integrity loss, security exposure, data loss, Autoflow self-recovery threats, or explicit critical language such as "critical", "urgent", "fork-bomb", "leak", or "blocker".
9. Add `--priority high` for urgent user-visible breakage, blocked active work, or explicit high-priority language such as "high priority", "important", or "blocking".
10. Omit `--priority` for normal planned work so the CLI records `Priority: normal`; use `--priority low` only for cleanup or non-urgent improvements.
11. If the user explicitly states a priority, that explicit value wins over automatic keyword inference.
12. Fallback: write the order template below directly under `{{BOARD_DIR}}/tickets/order/`; include `## Order` and one `## Request` section, and must not use yaml frontmatter (`---`).
13. Do not create PRDs, todo tickets, code changes, verification records, commits, or pushes.
14. After saving, tell the user the order path and that the planner runner (`autoflow run planner`) will write one or more generated PRDs first; direct TODO is only a narrow exception for explicitly requested, single-file mechanical changes.

## Order Template

Use this exact shape when writing an order directly. Keep it lightweight: orders are intake notes, not acceptance contracts.

Do **not** include `## Done When`, `## Acceptance Criteria`, or final completion checklists in an ordinary order. Put tentative implementation clues under `## Planner Hints`; the generated PRD and Todo own the authoritative acceptance criteria.

If `autoflow order create` is used and writes legacy `## Scope`, `## Allowed Paths`, or `## Verification` sections, treat those sections as hints equivalent to the template sections below.

```
# Order NNN: <짧은 한국어 제목>

## Order

- Priority: normal
- Express: false
- Planner Direct-TODO Hint: false
- Change Type: code | docs | cleanup | infra

## Request

<사용자의 원 요청 본문 그대로>

## Scope Hints

- <확실할 때만 좁은 해석을 적는다>
- <사용자가 명확히 제외한 범위가 있으면 적는다>

## Allowed Paths Hints

- path/to/file-or-folder

## Verification Hints

- npm run test
- none-shell
- manual: <planner가 검증 계획을 세울 때 참고할 수동 확인>

## PRD Split Map

- Title: <필요할 때만 PRD 단위 제목>
  - Goal: <독립 outcome>
  - Scope: <좁은 모듈/릴리즈/검증 경계>
  - Allowed Paths: path/to/file-or-folder
  - Verification: npm run test

## Planner Hints

- <관련 wiki/ticket/order, 위험, 가정, 미정 사항, direct TODO 가능성/불가 사유>
```

`Change Type` defaults to `code` if omitted; the worker finalizer's sanity gate uses this to choose its diff/checklist matrix.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
