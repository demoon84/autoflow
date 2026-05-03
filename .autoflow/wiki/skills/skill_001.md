---
title: "desktop selfHeal runner-list cache guard"
pattern_type: ticket_owner_pattern
applies_to:
  - "apps/desktop/src/main.js"
keywords:
  - "desktop"
  - "self"
  - "heal"
  - "runner"
  - "list"
  - "cache"
  - "guard"
  - "apps"
  - "src"
  - "main"
success_count: 1
failure_count: 0
last_used_at: "2026-05-03T13:13:17Z"
created_from: "tickets/done/prd_151/tickets_150.md"
created_at: "2026-05-03T13:13:07Z"
enabled: true
---

# desktop selfHeal runner-list cache guard

## Trigger

- Reuse when: desktop selfHeal runner-list cache guard
- Source ticket: `tickets/done/prd_151/tickets_150.md`

## Recommended Procedure

- `apps/desktop/src/main.js`의 `selfHealStoppedRunnersForScope` body에는 `await listRunners(scope)` direct call이 남아 있지 않다.
- `selfHealStoppedRunnersForScope`는 `listRunnersCachedOrRefresh(scope)` 또는 동등한 shared runner-list cache/inflight helper를 통해 runner 상태를 읽는다.
- `rememberProjectScope`는 동일 `projectRoot`/`boardDirName` scope의 반복 IPC 호출마다 즉시 `selfHealStoppedRunnersForScope(scope)`를 호출하지 않고, 첫 등록 또는 명시적 cooldown map/timestamp 조건을 만족할 때만 self-heal을 예약한다.
- self-heal guard는 `runnerShutdownInProgress`일 때 기존처럼 self-heal을 시작하지 않는다.
- `autoflow:readBoard` 같은 scope-memory 경로가 10회 반복 호출돼도 코드상 self-heal runner-list spawn이 호출 횟수와 1:1로 증가하지 않는 구조임을 static check와 smoke 절차로 설명할 수 있다.

## Pitfalls

- Manual UI smoke was represented by static code-path review and the required build/static assertion in this non-interactive owner tick; no browser tab was opened.

## Verification Pattern

- Command: ```bash -lc 'npm run desktop:check && node -e '\''const fs=require("fs"); const src=fs.readFileSync("apps/desktop/src/main.js","utf8"); const match=src.match(/async function selfHealStoppedRunnersForScope\\(scope\\) \\{[\\s\\S]*?\\n\\}/); if(!match) process.exit(1); const body=match[0]; if(body.includes("await listRunners(scope)")) process.exit(1); if(!body.includes("listRunnersCachedOrRefresh(scope")) process.exit(1); if(!/(lastSelfHeal|selfHeal.*Cooldown|knownProjectScopes\\.has)/.test(src)) process.exit(1);'\'''```

## Source Evidence

- Ticket: `tickets/done/prd_151/tickets_150.md`
- PRD: `tickets/done/prd_151/prd_151.md`
- Verification: `tickets/done/prd_151/verify_150.md`
- Result summary: self-heal runner list uses cache cooldown guard
