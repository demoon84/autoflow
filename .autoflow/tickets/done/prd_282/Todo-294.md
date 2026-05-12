# Ticket

## Ticket

- ID: Todo-294
- PRD Key: prd_282
- Plan Candidate: `notify-user.ts` 신규 (채널 어댑터 3개 + cooldown + 로그) + `config.toml` `[[notifications]]` 블록 + `finish-ticket-owner.ts` needs_user 경로에 notify 호출 + `start-ticket-owner.legacy.sh` blocked threshold 감지 후 notify 호출.
- Title: 외부 알림 채널 — needs_user 진입 시 push (webhook/Slack/시스템)
- Priority: high
- Change Type: code
- Stage: inprogress
- AI: claude
- Claimed By: worker
- Execution AI: claude
- Verifier AI:
- Last Updated: 2026-05-12

## Goal

- `.autoflow/scripts/notify-user.ts`를 신규 작성해 webhook URL POST·osascript·Slack webhook 3채널 어댑터를 구현한다.
- needs_user 마킹 시 즉시 알림 발사, blocked > `AUTOFLOW_NOTIFY_BLOCKED_THRESHOLD_SEC`(기본 1800) 시 알림.
- 동일 ticket 1시간 내 중복 발사 cooldown을 `.autoflow/runners/state/notify-cooldown.json`으로 관리.
- config 없으면 silent skip (1원칙: 알림 실패는 흐름 차단 금지).

## References

- PRD: tickets/done/prd_282/prd_282.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_282]] — secret은 `.autoflow/.local/secrets.json`에 분리 (gitignored).
- Plan Note:
- Ticket Note:

## Allowed Paths

- `.autoflow/scripts/notify-user.ts`
- `.autoflow/runners/config.toml`
- `.autoflow/scripts/finish-ticket-owner.ts`
- `.autoflow/scripts/start-ticket-owner.legacy.sh`

## Worktree

- Branch:
- Path:
- Base:
- Created At:

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] needs_user 진입 시 설정된 채널 모두에 알림 발사 (로그 검증)
- [x] blocked > threshold 시 알림 발사
- [x] 같은 ticket 재발사 cooldown 동작 (1시간 내 중복 차단)
- [x] config 없으면 silent skip (알림 실패가 흐름 차단 금지)
- [x] macOS notification / webhook 최소 1개 작동 데모

## Next Action

- `notify-user.ts` 파일 신규 생성, 채널 어댑터 인터페이스 설계.

## Resume Context

- Current state: todo — 작업 시작 전.
- Last completed action: Planner가 prd_282에서 티켓 생성.
- First thing to inspect on resume: `finish-ticket-owner.ts`의 needs_user 마킹 코드 위치 확인.

## Notes

- Mini-plan: (1) `notify-user.ts` 신규 (채널 어댑터 + cooldown + 로그) → (2) `config.toml` `[[notifications]]` 블록 → (3) `finish-ticket-owner.ts` 연동 → (4) `start-ticket-owner.legacy.sh` blocked threshold 감지 → (5) 데모 검증.
- Progress:
- secret 파일: `.autoflow/.local/secrets.json` (gitignored) — 구조 설계만, 실제 키 없이 테스트.

## Verification

- Command: fixture ticket을 needs_user로 마킹 후 `node .autoflow/scripts/notify-user.ts` 호출 → 채널 수신 확인
- Run file:
- Result:

## Result

- Summary: notify-user.ts 신규 작성(webhook/osascript/slack 3채널 + cooldown + no-config silent skip). config.toml [[notifications]] 템플릿 블록 추가. finish-ticket-owner.sh needs_user 분기에 notify 호출 추가. start-ticket-owner.legacy.sh blocked 진입 시 threshold 초과 여부 확인 후 notify 호출 추가.
- Commit:
