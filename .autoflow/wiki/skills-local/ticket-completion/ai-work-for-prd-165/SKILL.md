---
name: "ai-work-for-prd-165"
description: "AI work for prd_165"
pattern_type: ticket_completion
applies_to:
  module: "bin/autoflow"
  keywords:
    - "work"
    - "for"
    - "prd"
    - "165"
    - "bin"
    - "autoflow"
    - "packages"
    - "cli"
    - "skill"
    - "project"
pinned: false
created_from:
  prd: "prd_165"
  ticket: "tickets_165"
created_at: "2026-05-04T22:05:36Z"
---

# AI work for prd_165

## Trigger

- Reuse when: AI work for prd_165
- Source ticket: `tickets/done/prd_165/tickets_165.md`

## Recommended Procedure

- Security scan 이 악성 패턴 / secret leak 감지 → skill 생성 거부 + check 큐 적재.
- `autoflow skill import <url>` / `skill export <name>` 가 agentskills.io 형식과 정합 (Plan AI 호환 채택 결정 시).
- Cluster 감지가 비슷한 skill 묶음 후보 list 정상 생성.
- Meta-skill 추출이 cluster 의 공통 pattern 을 새 skill 로 생성 (사람 검토 후 채택).
- Deterministic mode 가 임계값 충족 skill 에서 LLM 호출 없이 직접 실행.

## Pitfalls

- agentskills.io parsing is intentionally dependency-free and supports common Markdown/frontmatter shape; future marketplace-specific schema changes may need a stricter parser.

## Verification Pattern

- Command: ``bash -n packages/cli/skill-project.sh && bash -n bin/autoflow``

## Source Evidence

- Ticket: `tickets/done/prd_165/tickets_165.md`
- PRD: `tickets/done/prd_165/prd_165.md`
- Verification: `tickets/done/prd_165/verify_165.md`
- Result summary: PRD 165 skill hardening and advanced CLI flows
