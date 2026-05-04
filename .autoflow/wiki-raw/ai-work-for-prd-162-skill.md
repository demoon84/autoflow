---
kind: raw_source
slug: ai-work-for-prd-162-skill
original_path: ".autoflow/wiki/skills-local/ticket-completion/ai-work-for-prd-162/SKILL.md"
ingested_at: 2026-05-04T00:50:45Z
updated_at: 2026-05-04T00:50:45Z
sha256: a57db28e2c7e2e78686d3ca016cfa96b3f05b414d203ddba66f5a3813d2ebec0
---

---
name: "ai-work-for-prd-162"
description: "AI work for prd_162"
pattern_type: ticket_completion
applies_to:
  module: "packages/cli/skill-project.sh"
  keywords:
    - "work"
    - "for"
    - "prd"
    - "162"
    - "packages"
    - "cli"
    - "skill"
    - "project"
    - "package"
    - "board"
    - "common"
    - "bin"
pinned: false
created_from:
  prd: "prd_162"
  ticket: "tickets_161"
created_at: "2026-05-03T14:15:28Z"
---

# AI work for prd_162

## Trigger

- Reuse when: AI work for prd_162
- Source ticket: `tickets/done/prd_162/tickets_161.md`

## Recommended Procedure

- `bash bin/autoflow skill create "$PWD" .autoflow --from-ticket tickets_NNN` 호출 시 `.autoflow/wiki/skills-local/<category>/<name>/SKILL.md` 생성, frontmatter / 본문 형식 정상.
- `bash bin/autoflow skill list "$PWD" .autoflow` 결과에 in-repo / agent-created skill 모두 표시 + 통계 포함.
- frontmatter validator 가 name >64 chars, description >1024 chars, content >100KB 를 거부.
- `.usage.json` sidecar 가 atomic write 로 정상 갱신, 깨졌어도 CLI 동작.
- `.archive/` 이동 후 view / list 가 정상 (archived 항목 별도 표시).

## Pitfalls

- Phase 2 curator (자동 transition / RAG 주입) 가 들어오면 sidecar 통계 임계값과 pinned bypass 정책을 다시 점검해야 한다. 본 PRD 범위 밖.

## Verification Pattern

- Command: ``bash tests/smoke/skill-phase1-smoke.sh && bash tests/smoke/ticket-owner-smoke.sh && npm run desktop:check``

## Source Evidence

- Ticket: `tickets/done/prd_162/tickets_161.md`
- PRD: `tickets/done/prd_162/prd_162.md`
- Verification: `tickets/done/prd_162/verify_161.md`
- Result summary: Hermes Phase 1 skill 인프라: dual storage / folder unit / validator+cap / .usage.json sidecar / CLI list·view·validate·archive / pinned bypass
