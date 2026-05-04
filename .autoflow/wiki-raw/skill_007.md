---
kind: raw_source
slug: skill_007
original_path: ".autoflow/wiki/skills/skill_007.md"
ingested_at: 2026-05-04T00:50:27Z
updated_at: 2026-05-04T00:50:27Z
sha256: f45d95146287ac033e22840f72ffdf1af893a7c45100c89b8425736c172b39ec
---

---
title: "quote-prefix shadow directory cleanup guard"
pattern_type: ticket_owner_pattern
applies_to:
  - "packages/cli/scaffold-project.sh"
  - "packages/cli/upgrade-project.sh"
  - "packages/cli/package-board-common.sh"
  - "packages/cli/stop-hook-project.sh"
  - ".autoflow/scripts/install-stop-hook.sh"
  - "runtime/board-scripts/install-stop-hook.sh"
  - "tests/smoke/quote-prefix-shadow-dir-smoke.sh"
  - "\".claude/"
  - "\".codex/"
  - "\"apps/"
  - "\"bin/"
  - "\"integrations/"
  - "\"packages/"
  - "\"scaffold/"
keywords:
  - "quote"
  - "prefix"
  - "shadow"
  - "directory"
  - "cleanup"
  - "guard"
  - "packages"
  - "cli"
  - "scaffold"
  - "project"
  - "upgrade"
  - "package"
success_count: 0
failure_count: 0
last_used_at: ""
created_from: "tickets/done/prd_161/tickets_160.md"
created_at: "2026-05-03T13:59:29Z"
enabled: true
---

# quote-prefix shadow directory cleanup guard

## Trigger

- Reuse when: quote-prefix shadow directory cleanup guard
- Source ticket: `tickets/done/prd_161/tickets_160.md`

## Recommended Procedure

- After implementation, `find . -maxdepth 2 -name "\"*" | wc -l` returns `0` from `/Users/demoon2016/Documents/project/autoflow`.
- If any of `".claude/`, `".codex/`, `"apps/`, `"bin/`, `"integrations/`, `"packages/`, `"scaffold/` existed at ticket start, only those quote-prefix artifact paths are removed and the normal unquoted source directories remain present.
- `packages/cli/scaffold-project.sh`, `packages/cli/upgrade-project.sh`, `packages/cli/package-board-common.sh`, and `packages/cli/stop-hook-project.sh` do not pass literal shell-quoted path fragments such as `"apps` or `".codex` into `mkdir`, `cp`, `mv`, or generated target paths.
- `.autoflow/scripts/install-stop-hook.sh` and `runtime/board-scripts/install-stop-hook.sh` keep hook manifest path and command path handling safe when input paths contain spaces or are already quoted by a caller.
- `tests/smoke/quote-prefix-shadow-dir-smoke.sh` creates an isolated temp project, exercises the relevant install/scaffold/upgrade/stop-hook path flow, and fails if any root-level path matching `"` prefix appears.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 완료 후 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ```bash -lc 'bash -n packages/cli/scaffold-project.sh packages/cli/upgrade-project.sh packages/cli/package-board-common.sh packages/cli/stop-hook-project.sh .autoflow/scripts/install-stop-hook.sh runtime/board-scripts/install-stop-hook.sh && tests/smoke/quote-prefix-shadow-dir-smoke.sh && quoted_count=$(find . -maxdepth 2 -name "\"*" | wc -l | tr -d " "); test "$quoted_count" = "0"'```

## Source Evidence

- Ticket: `tickets/done/prd_161/tickets_160.md`
- PRD: `tickets/done/prd_161/prd_161.md`
- Verification: `tickets/done/prd_161/verify_160.md`
- Result summary: quote-prefix shadow directory cleanup guard 추가: install/scaffold/upgrade/stop-hook 경로에서 quote literal 방어 + smoke 가드
