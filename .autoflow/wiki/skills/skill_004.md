---
title: "autoflow learned skill registry phase 1"
pattern_type: ticket_owner_pattern
applies_to:
  - "packages/cli/skill-project.sh"
  - "bin/autoflow"
  - "packages/cli/README.md"
  - ".autoflow/wiki/skills/"
  - "scaffold/board/wiki/skills/"
  - ".autoflow/scripts/finish-ticket-owner.sh"
  - "runtime/board-scripts/finish-ticket-owner.sh"
  - ".autoflow/agents/ticket-owner-agent.md"
  - "scaffold/board/agents/ticket-owner-agent.md"
  - "AGENTS.md"
  - "scaffold/host/AGENTS.md"
keywords:
  - "autoflow"
  - "learned"
  - "skill"
  - "registry"
  - "phase"
  - "packages"
  - "cli"
  - "project"
  - "bin"
  - "readme"
  - "wiki"
  - "skills"
success_count: 0
failure_count: 0
last_used_at: ""
created_from: "tickets/done/prd_160/tickets_159.md"
created_at: "2026-05-03T13:15:52Z"
enabled: true
---

# autoflow learned skill registry phase 1

## Trigger

- Reuse when: autoflow learned skill registry phase 1
- Source ticket: `tickets/done/prd_160/tickets_159.md`

## Recommended Procedure

- `.autoflow/wiki/skills/README.md`, `.autoflow/wiki/skills/skill-template.md`, `.autoflow/wiki/skills/.gitkeep`가 생성되고, 같은 구조가 `scaffold/board/wiki/skills/`에도 반영된다.
- `bin/autoflow skill create "$PWD" .autoflow --from-ticket tickets/done/prd_151/tickets_150.md`가 exit 0으로 끝나고 `.autoflow/wiki/skills/skill_NNN.md` 형식의 파일을 생성한다.
- 생성된 `skill_NNN.md`에는 `title`, `pattern_type`, `applies_to`, `keywords`, `success_count`, `failure_count`, `last_used_at`, `created_from`, `created_at`, `enabled` frontmatter와 `## Trigger`, `## Recommended Procedure`, `## Pitfalls`, `## Verification Pattern`, `## Source Evidence` 섹션이 있다.
- `bin/autoflow skill match "$PWD" .autoflow --keywords "selfHeal runner cache"`가 exit 0으로 끝나고 match 점수, skill id, title을 key=value 또는 표 형태로 출력한다.
- `bin/autoflow skill update-stats "$PWD" .autoflow <skill_NNN> --result pass`가 exit 0으로 끝나고 해당 skill의 `success_count`와 `last_used_at`를 갱신한다.

## Pitfalls

- Phase 1은 deterministic keyword matching과 best-effort extraction까지만 포함하므로, skill dedupe/ranking 개선과 prompt/RAG injection은 후속 PRD에서 이어서 다뤄야 한다.

## Verification Pattern

- Command: ``bash -lc 'tmp_before=$(find .autoflow/wiki/skills -maxdepth 1 -name "skill_*.md" 2>/dev/null | wc -l | tr -d " "); ./bin/autoflow skill create "$PWD" .autoflow --from-ticket tickets/done/prd_151/tickets_150.md; tmp_after=$(find .autoflow/wiki/skills -maxdepth 1 -name "skill_*.md" | wc -l | tr -d " "); test "$tmp_after" -gt "$tmp_before"; ./bin/autoflow skill match "$PWD" .autoflow --keywords "selfHeal runner cache" --limit 3; latest=$(find .autoflow/wiki/skills -maxdepth 1 -name "skill_*.md" | sort | tail -1); test -n "$latest"; ./bin/autoflow skill update-stats "$PWD" .autoflow "$(basename "$latest")" --result pass; npm run desktop:check'``

## Source Evidence

- Ticket: `tickets/done/prd_160/tickets_159.md`
- PRD: `tickets/done/prd_160/prd_160.md`
- Verification: `tickets/done/prd_160/verify_159.md`
- Result summary: learned skill registry CLI and auto-extract guard
