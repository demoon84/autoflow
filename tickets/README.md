# Tickets Board

이 폴더는 `BOARD_ROOT` 안의 상태별 보드다.

- `todo/`: 아직 시작하지 않은 티켓 (planner 가 Candidate 당 1개 생성)
- `inprogress/`: todo worker 가 점유해 구현 중인 티켓
- `verifier/`: 구현 완료, 검증 대기 티켓
- `done/`: 검증 pass + local commit 완료된 티켓
- `reject/`: 검증 fail, `## Reject Reason` 기록된 티켓 (planner 가 재계획 대상으로 감시)
- `runs/`: pass/fail 기록 파일 (`verify_NNN.md`) — 상태 폴더와 별개

`inprogress` 티켓은 아래 owner 필드를 함께 가진다.

- `Claimed By`
- `Execution Owner`
- `Verifier Owner`

티켓 파일은 `tickets_번호.md` 형식을 쓴다. 예: `tickets_001.md`, `tickets_014.md`, `tickets_120.md`.

## Lifecycle

```text
rules/spec/project_001.md            (사용자가 start spec 으로 채움)
  → rules/plan/plan_001.md           (planner heartbeat 가 도출 후 Candidates 채움)
  → tickets/todo/tickets_001.md      (start-plan.sh 가 Candidate 당 티켓 생성)
  → tickets/inprogress/tickets_001.md   (todo worker 가 claim + 구현)
  → tickets/verifier/tickets_001.md  (구현 완료 후 verifier 로 mv)
  → tickets/done/tickets_001.md      (pass: git commit + mv)
   ↘ tickets/reject/tickets_001.md   (fail: Reject Reason 기록, planner 가 재계획)
```

위 경로는 예시 번호 `001` 을 쓴 형식이다. 실제 번호는 각 보드가 직접 발급한다.

`tickets/runs/` 는 위 상태 폴더와 별개로 검증 기록 (`verify_NNN.md`) 을 남기는 결과 폴더다. 실패 기록도 지우지 않는다.

## State Rules

- `todo/`
  - 아직 시작하지 않은 작업
  - Goal, References, Allowed Paths, Done When 이 채워져 있어야 함
  - `start-todo.sh` 가 여기서 한 개를 `inprogress/` 로 점유 이동
- `inprogress/`
  - todo worker 가 claim 해 현재 구현 중
  - `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner`, `Last Updated`, `Next Action`, `Resume Context` 필수
  - blocker 가 있으면 여기에 남김 (todo 로 되돌리지 않음)
  - 구현 완료 시 todo worker 가 `Notes`, `Result.Summary`, `Verification: pending` 갱신 후 파일을 `verifier/` 로 mv
- `verifier/`
  - 구현 완료, 검증 대기
  - verifier heartbeat 가 여기서 한 개씩 집어 `PROJECT_ROOT` 에서 검증 명령 실행
- `done/`
  - 검증 pass + local git commit 완료
  - `Result` 와 검증 기록 경로 (`tickets/runs/verify_NNN.md`) 연결
- `reject/`
  - 검증 fail
  - `## Reject Reason` 섹션 (Verifier, 일시, 원인, 재계획 힌트) 필수
  - planner heartbeat 가 감시해 원인을 새 Execution Candidate 로 반영 후 Status: ready 로 되돌림
  - reject 티켓 원본은 기록으로 남긴다 (삭제 금지)
- `runs/`
  - 실행 기록과 검증 기록을 남기는 결과 폴더
  - 실패 기록도 지우지 않음
  - starter template 은 두지 않음
  - 실제 검증 명령은 `PROJECT_ROOT` 에서 실행, 결과 문서만 `BOARD_ROOT/tickets/runs/` 에 남김

권장 stage 값 흐름:

- `todo` → `claimed` (claim 직후) → `executing` (구현 중) → `verifying` (검증 중) → `done` (pass) / `rejected` (fail) / `blocked` (사람 개입 필요)

## Required Ticket Fields

모든 티켓은 아래 항목을 유지한다.

- `ID`, `Title`, `Stage`, `Owner`, `Claimed By`, `Execution Owner`, `Verifier Owner`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Reject Reason` (reject 폴더로 갈 때만 추가)

중요:

- `References` 는 `BOARD_ROOT` 상대 경로.
- `Allowed Paths` 는 `PROJECT_ROOT` 상대 경로.
- 같은 번호 티켓은 여러 상태 폴더에 동시에 두지 않는다. reject 재시도는 **새** 번호로 발급한다.
- `todo/`, `inprogress/`, `verifier/`, `done/`, `reject/` 디렉터리는 상태 보드 자체이며 하위 README 없이 빈 폴더로 유지돼도 된다.
- `done/` 티켓은 `tickets/runs/` 아래 검증 기록과 연결돼 있어야 한다.
- heartbeat worker 는 스스로 멈추지 않는다. `status=idle` 도 정상 상태.
