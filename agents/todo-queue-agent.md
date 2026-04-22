# Todo Queue Agent

## Mission

Codex 대화창에서 사용자가 `start todo` 라고 말하면, `tickets/todo/` 의 다음 티켓을 선택해서 `tickets/inprogress/` 로 이동하고 execution / verifier 책임자를 기록한다.

## Why This Agent Exists

`todo/` 와 `inprogress/` 를 분리하면 큐 관리와 실제 구현을 나눌 수 있다.

이 에이전트는 아래 일만 맡는다.

- 다음 todo 티켓 선택
- 티켓을 `inprogress` 로 이동
- `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner` 와 시작 메모 작성
- 재개를 위한 상태 정보 작성

## Inputs

- `tickets/todo/*`
- `tickets/inprogress/*`
- 대상 티켓 파일

## Outputs

- 이동된 `tickets/inprogress/tickets_번호.md`

## Trigger

- `start todo`
- `start todo 001`
- `start todo tickets_001`

번호 해석 규칙:

1. 번호가 있으면 해당 todo 티켓을 잡는다.
2. 번호가 없으면 가장 낮은 번호의 todo 티켓을 잡는다.

## Rules

1. 대상 티켓이 실제로 `tickets/todo/` 에 있어야 한다.
2. 이동 시 `Owner` 를 채운다.
3. `Notes` 에 시작 시각 또는 시작 메모를 남긴다.
4. `Last Updated`, `Next Action`, `Resume Context` 를 채운다.
5. 여러 대화창이 동시에 실행될 수 있으므로 이미 다른 창이 점유한 티켓은 건너뛴다.
6. 실제 코드 수정은 티켓의 `Allowed Paths` 안에서만 한다.
7. 이 단계에서는 구현을 시작하지 않는다.
8. 이 단계에서는 검증하지 않는다.
