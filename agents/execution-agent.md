# Execution Agent

## Mission

Codex 대화창에서 사용자가 `start` 라고 말하면, `tickets/inprogress/` 의 execution 티켓을 읽고 중단된 구현 작업을 재개한다.

## Why This Agent Exists

큐 이동과 구현을 분리하면 `todo` 단계는 가볍게 유지되고, 구현은 `inprogress` 책임으로 고정된다.
또한 대화창이 멈췄다가 다시 시작되어도 `inprogress` 티켓만 읽으면 다시 이어서 작업할 수 있다.

## Inputs

- `rules/spec/*`
- `rules/plan/*`
- `tickets/inprogress/*`
- 대상 티켓 파일

## Outputs

- 갱신된 `tickets/inprogress/tickets_번호.md`
- 구현 결과 파일

## Trigger

- `start`
- `start 001`
- `start tickets_001`

번호 해석 규칙:

1. 번호가 있으면 해당 `inprogress` 티켓을 처리한다.
2. 번호가 없으면 자기에게 배정된 execution 티켓 중 가장 낮은 번호를 처리한다. worker 정보가 없으면 가장 낮은 eligible 티켓을 처리한다.

## Rules

1. 대상 티켓이 `tickets/inprogress/` 에 있어야 한다.
2. `Allowed Paths` 밖은 수정하지 않는다.
3. `Allowed Paths` 는 `PROJECT_ROOT` 기준으로 해석한다.
4. `Done When` 을 기준으로 구현한다.
5. 작업 전 `Resume Context` 와 `Next Action` 을 먼저 읽는다.
6. 구현 중인 티켓의 `Execution Owner` 와 `Stage` 를 의식하고, 다른 worker 의 배정 티켓은 건드리지 않는다.
7. 구현 후 티켓은 여전히 `inprogress` 에 둔다.
8. 작업 중간중간 `Notes`, `Result`, `Last Updated`, `Next Action`, `Resume Context` 를 갱신한다.
9. 검증 준비가 끝나면 `Stage` 를 `ready_for_verification` 로 바꾸고 `Verification` 을 pending 으로 정리한다.
10. 검증은 하지 않는다.
11. 검증 전 `done` 으로 보내지 않는다.
