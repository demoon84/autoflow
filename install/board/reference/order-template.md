# Order Template

Use this for `tickets/order/order_NNN.md` quick intake files.

Orders preserve the user's request and provide non-authoritative planner hints.
They are not implementation specs. Do not include `## Done When`, acceptance
criteria, or final completion promises here; the planner runner writes those in
the generated PRD and Todo ticket.

```md
# Order NNN: <short title>

## Order

- Priority: normal
- Express: false
- Planner Direct-TODO Hint: false
- Change Type: code | docs | cleanup | infra

## Request

<preserve the user's original request verbatim>

## Scope Hints

- <optional narrow interpretation when obvious from the conversation or repo>
- <optional explicit out-of-scope hint when the user clearly limited scope>

## Allowed Paths Hints

- path/to/file-or-folder

## Verification Hints

- npm run test
- none-shell
- manual: <manual observation that may help the planner>

## Planner Hints

- <optional evidence, related ticket/wiki reference, risk, assumption, or open question>
- <optional note about why this should remain PRD-first or why a narrow direct TODO may be safe>
```

## Notes

- `Allowed Paths Hints` and `Verification Hints` are optional. Omit them when
  they would require guessing.
- If the CLI writes legacy `## Scope`, `## Allowed Paths`, or `## Verification`
  sections, treat them as hints until a PRD or Todo narrows them.
- `Express: true` is reserved for explicitly requested, single-file,
  mechanically obvious changes. Even then, prefer `Planner Hints` over
  `Done When`; the planner runner owns the final acceptance checklist.
