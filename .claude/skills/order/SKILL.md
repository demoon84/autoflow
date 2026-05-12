---
name: order
description: Use when the user says "#order", invokes "/order", or asks to drop a small Autoflow order/quick change into the board without drafting a full PRD.
---

# Autoflow Quick Order

Act as the lightweight Autoflow intake hook for small, clear changes.

## Lookup Before Saving

Before writing the inbox order, surface relevant prior work so the user can build on past decisions instead of re-doing them.

1. Identify 1–3 distinctive keywords from the user's request: feature noun, file path basename, error string, UI element name, etc.
2. Run, best-effort (any error → treat as "no hits", continue):
   - `autoflow origin search "<keyword>"` — past PRDs/orders matching prompt, prd_path, ticket title, or commit subject.
3. If non-trivial hits return, briefly summarize them in Korean to the user:
   "비슷한 과거 작업: prd_142 (...), order_88 (...). 그대로 발행할까요?"
4. Proceed to save the order regardless of lookup outcome — the user's intent is the source of truth, lookup only highlights duplicates or relevant context.

Skip lookup for very short requests (≤ 8 chars) where keywords are unreliable. Express orders MAY skip lookup since they are time-critical.

## Rules

1. Treat `#order`, `/order`, and "quick Autoflow order" as order triggers.
2. Save a concise note to `.autoflow/tickets/inbox/order_*.md`; do not draft a full PRD in chat.
3. Do not require full PRD approval for explicit order triggers. The user already asked for an order intake.
4. Preserve the user's original request under `## Request`.
5. Add `--allowed-path`, `--scope`, and `--verification` hints only when they are obvious from the repo or conversation. Leave inference to Plan AI when unsure.
6. Prefer `autoflow order create <project-root> <board-dir-name> --from-file <draft-file> --title <short title>`.
7. Add `--priority critical` only for host resource exhaustion, board integrity loss, security exposure, data loss, Autoflow self-recovery threats, or explicit critical language such as "critical", "urgent", "fork-bomb", "leak", or "blocker".
8. Add `--priority high` for urgent user-visible breakage, blocked active work, or explicit high-priority language such as "high priority", "important", or "blocking".
9. Omit `--priority` for normal planned work so the CLI records `Priority: normal`; use `--priority low` only for cleanup or non-urgent improvements.
10. If the user explicitly states a priority, that explicit value wins over automatic keyword inference.
11. Fallback: write the same order-format note directly under `.autoflow/tickets/inbox/`; the first non-empty line must be `# Autoflow Order`, include `## Order` and one `## Request` section, and must not use yaml frontmatter (`---`).
12. Do not create PRDs, todo tickets, code changes, verification records, commits, or pushes.
13. After saving, tell the user the inbox path and that `planner` or `autoflow run planner` will promote it into a generated PRD and todo ticket when safe.
14. **Status 값은 `ready` 한 가지만 허용**. Express order 만 `Express: true` 를 추가로 둔다. `needs-user-decision`, `blocked-on-*`, `draft` 같은 비표준 값은 절대 박지 말 것. Planner 가 이 값들을 모르므로 inbox dead-letter 가 되어 영원히 promote 되지 않는다.
15. **사용자 추가 결정이 필요한 발행은 금지**. 사용자가 결정(provider 선택, 정책 가부 등)을 내려야만 의미가 확정되는 항목은 order 로 저장하지 말고 채팅에서 결정이 끝날 때까지 대기한다. 결정이 끝난 뒤 `Status: ready` 인 완전한 order 한 장으로 저장한다.
16. **의존 표기는 본문 Notes 에만**. 다른 order/PRD/ticket 에 의존하면 Notes 섹션에 "선행 order_NNN 머지 후 promote" 같은 자연어 노트를 둔다. `Status` 또는 `Priority` 같은 parser 필드에 의존을 인코딩하지 않는다 (planner 가 이해 못 함). Planner 가 알아서 우선순위를 조정한다.

## Express Mode

For trivially small, fully-specified orders the planner can skip PRD authoring and create a todo ticket directly. This drastically lowers latency for one-line fixes, doc tweaks, and renames.

An order is **express-eligible** only when ALL of the following are true:

- The user explicitly says one of: `express`, `익스프레스`, `즉시`, `1줄 수정`, `trivial`, `간단`, `quick fix` AND the change is clearly tiny.
- You can name **concrete repo-relative `Allowed Paths`** without guessing (≤3 paths).
- You can write at least one **observable `Done When`** checkbox without inventing acceptance criteria.
- You can name a **`Verification Command`** that exists in this repo (or "none-shell" if no shell verify is meaningful — sanity gate still validates Done When).

Save express orders with the **inbox layout below** (do not yaml frontmatter). The planner reads `- Express: true` under `## Order` and bypasses PRD creation.

```
# Autoflow Order

## Order

- Title: <짧은 한국어 제목>
- Express: true
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

- Express rationale: <왜 PRD 없이 바로 todo 가능한지 한 줄>
```

When unsure, OMIT `Express: true` and let the standard PRD pipeline handle it. The planner refuses express promotion if Allowed Paths or Done When are missing; it falls back to the normal flow gracefully.

`Change Type` defaults to `code` if omitted; the worker finalizer's sanity gate uses this to choose its diff/checklist matrix.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
