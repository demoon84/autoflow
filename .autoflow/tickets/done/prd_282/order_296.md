# Autoflow Order

## Order

- Title: 외부 알림 채널 — needs_user 진입 시 push (webhook/Slack/시스템)
- Priority: high
- Status: ready
- Change Type: code

## Request

자율주행 1원칙은 "멈추지 말 것"이지만 needs_user 진입 시 사용자가 데스크탑을
보고 있어야만 인지 가능. 외부 채널로 push 해야 진짜 자율 운영 가능.

해야 할 것:
1. .autoflow/scripts/notify-user.ts 신규 — needs_user / blocked-too-long
   이벤트 발생 시 호출
2. 채널 어댑터: webhook(URL POST), macOS notification(osascript), Slack(webhook URL)
3. config.toml 에 [[notifications]] 블록 — 채널별 활성화/URL/Token
4. trigger: planner/worker 가 needs_user 마킹 시 즉시 호출,
   blocked > AUTOFLOW_NOTIFY_BLOCKED_THRESHOLD_SEC (기본 1800) 시 호출
5. cooldown: 같은 ticket 에 대해 한 시간 내 중복 발사 차단

## Allowed Paths

- .autoflow/scripts/notify-user.ts
- .autoflow/runners/config.toml
- .autoflow/scripts/finish-ticket-owner.ts
- .autoflow/scripts/start-ticket-owner.legacy.sh

## Done When

- [ ] needs_user 진입 시 설정된 채널 모두에 알림 발사 (로그 검증)
- [ ] blocked > threshold 시 알림 발사
- [ ] 같은 ticket 재발사 cooldown 동작
- [ ] config 없으면 silent skip (1원칙: 알림 실패는 흐름 차단 금지)
- [ ] macOS notification / webhook 최소 1개 작동 데모

## Verification

- Command: fixture ticket 을 needs_user 로 마킹 후 notify-user.ts 호출 → 채널 수신 확인

## Notes

- 데스크탑 닫혀 있어도 휴대폰까지 도달 = 진짜 자율 운영
- Slack webhook URL 같은 secret 은 .autoflow/.local/secrets.json 에 분리 (gitignored)
