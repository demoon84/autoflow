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
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — LLM Wiki prior decisions, learnings, failed/retried approaches, and related done-ticket context. Use multiple `--term` flags when you have multiple strong keywords.
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
6. Prefer `autoflow order create <project-root> <board-dir-name> --from-file <draft-file> --title <short title>` when the CLI is available.
7. Add `--priority critical` only for host resource exhaustion, board integrity loss, security exposure, data loss, Autoflow self-recovery threats, or explicit critical language such as "critical", "urgent", "fork-bomb", "leak", or "blocker".
8. Add `--priority high` for urgent user-visible breakage, blocked active work, or explicit high-priority language such as "high priority", "important", or "blocking".
9. Omit `--priority` for normal planned work so the CLI records `Priority: normal`; use `--priority low` only for cleanup or non-urgent improvements.
10. If the user explicitly states a priority, that explicit value wins over automatic keyword inference.
11. Fallback: write the same order format directly under `{{BOARD_DIR}}/tickets/order/`; the first non-empty line must be `# Autoflow Order`, include `## Order` and one `## Request` section, and must not use yaml frontmatter (`---`).
12. Do not create PRDs, todo tickets, code changes, verification records, commits, or pushes.
13. After saving, tell the user the order path and that the planner runner (`autoflow run planner`) will decide whether to write a generated PRD first or create a narrow direct TODO.

## Planner PRD Decision Hints

Order intake never decides whether PRD authoring is required. The planner runner reads the saved order, repository context, and prior wiki/origin findings, then decides whether to create a generated PRD first or write a narrow todo ticket directly.

For tiny, fully-specified requests, you may add non-authoritative hints only:

- Concrete repo-relative `Allowed Paths` when obvious (≤3 paths).
- Observable `Done When` checkboxes when they follow directly from the conversation.
- A `Verification Command` that exists in this repo, or `none-shell` when no shell verification is meaningful.
- A `## Notes` bullet such as `- Planner hint: likely direct TODO candidate because ...`.

Do not write `Express: true`, do not pass `--express`, and do not create PRDs or TODO tickets from this skill. The planner runner owns the PRD-vs-direct-TODO decision.

```
# Autoflow Order

## Order

- Title: <짧은 한국어 제목>
- Priority: normal
- Status: ready
- Change Type: code | docs | cleanup | infra

## Request

<사용자의 원 요청 본문 그대로>

## Allowed Paths

- src/foo.ts
- src/bar.ts

## Done When

- [ ] <관찰 가능한 완료 조건 1>
- [ ] <관찰 가능한 완료 조건 2>

## Verification

- Command: <repo-relative shell command>

## Notes

- Planner hint: <PRD가 필요할지/바로 TODO 가능할지 판단에 도움이 되는 근거, 확실할 때만>
```

`Change Type` defaults to `code` if omitted; the worker finalizer's sanity gate uses this to choose its diff/checklist matrix.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
