---
name: "wiki-meaningful-commit-gate"
description: "Use when wiki meaningful commit gate"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: skill_nudge
applies_to:
  module: "packages/cli/run-role.sh"
  keywords:
    - "wiki"
    - "meaningful"
    - "commit"
    - "gate"
    - "packages"
    - "cli"
    - "run"
    - "role"
    - "runtime"
    - "board"
    - "scripts"
    - "project"
pinned: false
created_from:
  prd: "prd_183"
  ticket: "tickets_182"
created_at: "2026-05-05T23:22:11Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# wiki meaningful commit gate

## Trigger

- Reuse when: wiki meaningful commit gate
- Source ticket: `tickets/inprogress/tickets_182.md`

## Recommended Procedure

- Temp repo smoke test에서 `wiki/index.md`, `wiki/log.md`, `*.manifest`, `*.history`, `*.fingerprint` 만 변경된 wiki scope diff 는 `autocommit_status=skipped_wiki_commit_gate` 또는 동등한 key=value evidence 를 남기고 local commit 을 만들지 않는다.
- Temp repo smoke test에서 whitespace-only/cosmetic-only wiki diff 는 `git diff -w` 기준 content delta 가 없음을 evidence 로 남기고 local commit 을 만들지 않는다.
- Temp repo smoke test에서 `wiki/sources/one.md` 단일 기존 파일 수정은 weight 1, line delta 30 미만으로 계산되어 commit 을 만들지 않는다.
- Temp repo smoke test에서 `wiki/answers/new-answer.md` 신규 파일 추가는 weight 5 이상으로 계산되어 local commit 을 만들고, commit subject 가 `[wiki] update:` 로 시작하며 `answers`, `total`, `+`, `-` 정보를 포함한다.
- Temp repo smoke test에서 wiki 파일 삭제는 line 임계와 무관하게 local commit 을 만들고, commit subject 가 삭제 category 와 total file count 를 포함한다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ```bash -lc 'bash -n packages/cli/run-role.sh runtime/board-scripts/run-role.sh packages/cli/wiki-project.sh .autoflow/scripts/update-wiki.sh && bash tests/smoke/wiki-meaningful-commit-gate-smoke.sh && bash tests/smoke/wiki-ai-owned-update-smoke.sh && bash tests/smoke/planner-wiki-scoped-autocommit-smoke.sh'```

## Source Evidence

- Ticket: `tickets/inprogress/tickets_182.md`
- PRD: `tickets/done/prd_183/prd_183.md`
- Verification: `tickets/inprogress/verify_182.md`
