---
name: "codex-stdout-warning-noise-filter"
description: "Use when codex stdout warning noise filter"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: orchestration_cleanup
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "codex"
    - "stdout"
    - "warning"
    - "noise"
    - "filter"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
pinned: false
created_from:
  prd: "prd_189"
  ticket: "tickets_188"
created_at: "2026-05-06T01:12:10Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# codex stdout warning noise filter

## Trigger

- Reuse when: codex stdout warning noise filter
- Source ticket: `tickets/inprogress/tickets_188.md`

## Recommended Procedure

- Codex stdout fixture 에 `2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest:` 와 `2026-05-04T22:21:36.739742Z  WARN codex_core_skills::loader:` 라인이 수백 개 포함되어도 filtered stdout 에 해당 라인이 0개로 남는다.
- 같은 fixture 의 의미 있는 Codex 출력, diff/error 텍스트, `total_tokens=`, `input_tokens=`, `output_tokens=` 계열 marker 는 filtered stdout 에 그대로 남는다.
- 필터 적용 후 adapter command exit code, timeout exit `124`, and non-zero failure exit code propagation 이 기존 계약대로 유지된다.
- `apps/desktop/src/main.js` 의 token usage parser 는 Codex guard WARN 라인을 token usage candidate 로 취급하지 않으며, 기존 Claude/Codex/Gemini token marker parsing 은 유지된다.
- smoke test 가 필터 전후 byte/line count 감소를 확인하고, WARN 만 제거됐음을 assertion 으로 검증한다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh && node --check apps/desktop/src/main.js && bash tests/smoke/codex-stdout-warning-filter-smoke.sh && npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_188.md`
- PRD: `tickets/done/prd_189/prd_189.md`
- Verification: `tickets/inprogress/verify_188.md`
