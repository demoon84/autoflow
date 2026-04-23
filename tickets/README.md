# Tickets Board

이 폴더는 `BOARD_ROOT` 안의 상태별 보드다.

- `todo/`: 아직 시작하지 않은 티켓
- `inprogress/`: 현재 작업 중인 티켓
- `done/`: 검증 후 종료된 티켓

`inprogress` 티켓은 보통 아래 owner 필드를 함께 가진다.

- `Claimed By`
- `Execution Owner`
- `Verifier Owner`

티켓 파일은 `tickets_번호.md` 형식을 쓴다.

예:

- `tickets_001.md`
- `tickets_014.md`
- `tickets_120.md`

운영 방식은 단순하다.

1. `plan-to-ticket agent` 가 새 티켓을 `todo/` 에 만든다.
2. 시작할 때 `inprogress/` 로 옮긴다.
3. 완료와 검증 후 `done/` 으로 옮긴다.

## Lifecycle

표준 이동 순서는 아래와 같다 (아래 경로는 예시 번호 `001` 을 쓴 파일 이동 패턴이다. 실제 번호는 각 보드가 직접 발급한다).

```text
rules/plan/plan_001.md
  -> tickets/todo/tickets_001.md
  -> tickets/inprogress/tickets_001.md
  -> tickets/done/tickets_001.md
```

`tickets/runs/` 는 위 상태 폴더와 별개로, 검증 기록과 실행 증거를 남기는 결과 폴더다.

예:

- `run_001.md`
- `verify_001.md`

## State Rules

- `todo/`
  - 아직 시작하지 않은 작업
  - Goal, References, Allowed Paths, Done When 이 채워져 있어야 함
  - `start todo` 는 여기서 ticket claim, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Next Action`, `Resume Context` 까지만 정리함
  - 구현은 아직 시작하지 않음
- `inprogress/`
  - 현재 작업 중이거나 다시 이어야 하는 작업
  - `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Last Updated`, `Next Action`, `Resume Context` 가 있어야 함
  - `Owner` 가 채워져 있어야 함
  - blocker 가 있으면 여기에 남김
  - 새 작업 시작은 `start todo`, 재개는 `start`, 검증은 `start verifier` 를 씀
- `done/`
  - 작업과 검증이 끝난 티켓
  - `Result` 와 검증 기록 경로가 연결되어 있어야 함
  - 남은 리스크와 검증 루트가 확인 가능해야 함
- `runs/`
  - 실행 기록과 검증 기록을 남기는 결과 폴더
  - 실패 기록도 지우지 않음
  - starter template 을 두지 않음
  - 실제 검증 명령은 보통 `PROJECT_ROOT` 에서 실행하고, 결과 문서만 `BOARD_ROOT/tickets/runs/` 에 남김

권장 stage 흐름:

- `todo`
- `claimed`
- `executing`
- `ready_for_verification`
- `verifying`
- `blocked`
- `done`

## Required Ticket Fields

모든 티켓은 아래 항목을 유지하는 편이 좋다.

- `ID`
- `Title`
- `Goal`
- `References`
- `Allowed Paths`
- `Done When`
- `Owner`
- `Stage`
- `Claimed By`
- `Execution Owner`
- `Verifier Owner`
- `Last Updated`
- `Next Action`
- `Resume Context`
- `Verification`
- `Result`

중요:

- `References` 는 `BOARD_ROOT` 상대 경로를 쓴다.
- `Allowed Paths` 는 `PROJECT_ROOT` 상대 경로를 쓴다.
- 같은 번호 티켓은 여러 상태 폴더에 동시에 두지 않는다.
- blocker 가 생겨도 보통 `todo/` 로 되돌리지 않고 `inprogress/` 에 남긴다.
- `todo/`, `inprogress/`, `done/` 디렉터리는 상태 보드 자체이며, 하위 README 없이 빈 폴더로 유지돼도 된다.
- `done/` 티켓은 보통 `tickets/runs/` 아래 검증 기록과 연결돼 있어야 한다.
