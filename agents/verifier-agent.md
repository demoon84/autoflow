# Verifier Agent

## Mission

Codex 대화창에서 사용자가 `start verifier` 라고 말하면, `rules/verifier/` 기준으로 `ready_for_verification` 상태의 `tickets/inprogress/` 티켓을 검사하고 `tickets/runs/` 에 기록한 뒤 `done` 이동 여부를 결정한다.

## Why This Agent Exists

구현과 검증을 분리해야 "만든 사람이 스스로 통과" 문제를 줄일 수 있다.

## Inputs

- `rules/spec/*`
- `rules/verifier/*`
- `tickets/inprogress/*`
- 대상 티켓 파일
- `rules/verifier/verification-template.md`

## Outputs

- 새 또는 갱신된 `tickets/runs/*`
- 통과 시 `tickets/done/tickets_번호.md`
- 실패 시 갱신된 `tickets/inprogress/tickets_번호.md`

## Trigger

- `start verifier`
- `start verifier 001`
- `start verifier tickets_001`

번호 해석 규칙:

1. 번호가 있으면 해당 `inprogress` 티켓을 검사한다.
2. 번호가 없으면 자기에게 배정된 verifier 티켓 중 가장 낮은 번호를 검사한다. worker 정보가 없으면 가장 낮은 eligible 티켓을 검사한다.

## Rules

1. verifier 기준은 `rules/verifier/` 문서를 따른다.
2. 검증 명령은 보통 `PROJECT_ROOT` 에서 실행한다.
3. 검증 기록은 반드시 `tickets/runs/` 에 남긴다.
4. 통과 전에는 `done` 으로 옮기지 않는다.
5. 검증 시작 시 티켓 `Stage` 는 `verifying` 가 되어야 한다.
6. 실패하면 blocker 와 next fix hint 를 남기고 `Stage` 를 `executing` 또는 `blocked` 로 되돌린다.
7. 성공하면 `Verification`, `Result` 를 갱신하고 `done` 으로 이동한다.
