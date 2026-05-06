---
name: "runner-config-apply-feedback-5"
description: "runner config apply feedback"
pattern_type: orchestration_cleanup
applies_to:
  module: "apps/desktop/src/renderer/main.tsx"
  keywords:
    - "runner"
    - "config"
    - "apply"
    - "feedback"
    - "apps"
    - "desktop"
    - "src"
    - "renderer"
    - "main"
    - "tsx"
    - "styles"
    - "css"
pinned: false
created_from:
  prd: "prd_174"
  ticket: "tickets_173"
created_at: "2026-05-05T13:14:00Z"
---

# runner config apply feedback

## Trigger

- Reuse when: runner config apply feedback
- Source ticket: `tickets/inprogress/tickets_173.md`

## Recommended Procedure

- `packages/cli/run-role.sh` 또는 동등한 runner tick 진입부가 현재 runner config fingerprint 와 적용값을 `.autoflow/runners/state/<runner>.state` 에 기록하고, fingerprint 변화가 감지된 tick 에 `config_applied_at=<ISO>` 또는 동등 필드를 갱신한다.
- `apps/desktop/src/main.js` 의 `autoflow:configureRunner` / `autoflow:readBoard` 경로가 저장된 config fingerprint 또는 updated timestamp 와 runner state 의 applied fingerprint / `config_applied_at` 을 renderer 가 비교할 수 있는 형태로 전달한다.
- `apps/desktop/src/renderer/main.tsx` 에서 설정 저장 클릭 후 action key 가 `config_applying` 계열로 유지되고, 새 설정 적용 증거가 board polling 또는 state refresh 로 확인되기 전까지 저장 버튼과 같은 runner 의 config/run/dry-run/start/stop/restart 액션이 중복 실행되지 않는다.
- 적용 대기 중 저장 버튼은 spinner 와 `저장 중...` 또는 `적용 대기...` 라벨을 표시하고, runner 카드에는 적용 대기 badge 가 표시된다.
- 적용 확인 시 action key 가 해제되고 완료 토스트가 표시되며, timeout(`interval_seconds + 30s` 또는 최소 90초) 시 action key 가 해제되고 경고 토스트가 표시된다.

## Pitfalls

- Allowed Paths 밖으로 확장하지 말고, 추출 실패가 finalization을 막지 않게 유지한다.

## Verification Pattern

- Command: ``bash -lc 'npm run desktop:check && bash -n packages/cli/runners-project.sh packages/cli/run-role.sh'``

## Source Evidence

- Ticket: `tickets/inprogress/tickets_173.md`
- PRD: `tickets/done/prd_174/prd_174.md`
- Verification: `tickets/inprogress/verify_173.md`
