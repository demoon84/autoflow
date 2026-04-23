# Tickets Board

이 폴더는 `BOARD_ROOT` 안의 상태별 보드다.

- `todo/`: 아직 시작하지 않은 티켓 (planner 가 Candidate 당 1개 생성)
- `inprogress/`: planner 가 점유한 `plan_*.md` 와 todo worker 가 점유해 구현 중인 `tickets_*.md`
- `verifier/`: 구현 완료, 검증 대기 티켓
- `done/`: 검증 pass + local commit 완료된 티켓 (`done/<project-key>/tickets_NNN.md`)
- `reject/`: 검증 fail, `## Reject Reason` 기록된 `reject_NNN.md` 티켓 (planner 가 재계획 대상으로 감시)
- `runs/`: pass/fail 기록 파일 (`verify_NNN.md`) — 상태 폴더와 별개
- `backlog/`: 아직 plan 전인 spec 입력 큐
- `plan/`: 아직 ticket 생성 전이거나 대기 중인 실제 plan 문서
- `inprogress/plan_*.md`: planner 가 ticket 생성 중인 plan 문서
- `../logs/`: verifier 완료 로그 (`verifier_<ticket-id>_<timestamp>_<outcome>.md`)

`inprogress` 안의 `tickets_*.md` 티켓은 아래 owner 필드를 함께 가진다.

- `Claimed By`
- `Execution Owner`
- `Verifier Owner`

티켓 파일은 `tickets_번호.md` 형식을 쓴다. 예: `tickets_001.md`, `tickets_014.md`, `tickets_120.md`.

## Lifecycle

```text
tickets/backlog/project_001.md              (사용자가 #spec 으로 채움)
  → tickets/plan/plan_001.md             (planner heartbeat 가 도출 후 Candidates 채움)
  → tickets/inprogress/plan_001.md  (planner 가 ticket 생성 작업을 점유)
  → tickets/todo/tickets_001.md        (start-plan.sh 가 Candidate 당 티켓 생성)
  → tickets/inprogress/tickets_001.md   (todo worker 가 claim + 구현)
  → tickets/verifier/tickets_001.md  (구현 완료 후 verifier 로 mv)
  → tickets/done/project_001/tickets_001.md  (pass: git commit + mv)
  ↘ tickets/done/project_001/project_001.md  (ticket 생성 뒤 spec 보관)
  ↘ tickets/done/project_001/plan_001.md     (ticket 생성 뒤 plan 보관)
   ↘ tickets/reject/reject_001.md   (fail: Reject Reason 기록, planner 가 재계획)
     → tickets/done/project_001/reject_001.md (재계획 todo 생성 뒤 보관)
```

위 경로는 예시 번호 `001` 을 쓴 형식이다. 실제 번호는 각 보드가 직접 발급한다.

`tickets/runs/` 는 위 상태 폴더와 별개로 검증 기록 (`verify_NNN.md`) 을 남기는 결과 폴더다. 실패 기록도 지우지 않는다. verifier 가 처리를 마치면 별도로 `BOARD_ROOT/logs/` 에 completion log 도 남긴다.

## State Rules

- `todo/`
  - 아직 시작하지 않은 작업
  - Goal, References, Allowed Paths, Done When 이 채워져 있어야 함
  - 제목 / Goal / Done When 문구가 검증처럼 보여도 파일이 `todo/` 에 있으면 todo worker 가 구현 대상으로 처리
  - `start-todo.sh` 가 여기서 한 개를 `inprogress/` 로 점유 이동
- `inprogress/`
  - `plan_*.md` 는 planner 가 ticket 생성 작업을 점유한 상태다.
  - `tickets_*.md` 는 todo worker 가 claim 해 현재 구현 중인 상태다.
  - `tickets_*.md` 에는 `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner`, `Worktree`, `Last Updated`, `Next Action`, `Resume Context` 필수
  - git 저장소에서는 `start-todo.sh` 가 티켓별 worktree 를 만들고 todo worker 는 그 worktree 에서 구현한다.
  - worker runtime context 는 역할 문맥과 현재 ticket 문맥을 따로 가진다. 기능 단위 작업 완료 시 전체 context 삭제 대신 active ticket 문맥만 비우고, 다음 tick 은 Obsidian links / References / Resume Context 를 다시 읽는다.
  - blocker 가 있으면 여기에 남김 (todo 로 되돌리지 않음)
  - 구현 완료 시 todo worker 가 `Notes`, `Result.Summary` 를 갱신한 뒤 `scripts/handoff-todo.*` 로 파일을 `verifier/` 로 넘긴다. 이 런타임이 `Verification: pending` 과 active ticket context 초기화를 함께 처리한다.
- `verifier/`
  - 구현 완료, 검증 대기
  - verifier heartbeat 가 여기서 한 개씩 집어 `start-verifier.sh` 가 출력한 `working_root` 에서 검증 명령 실행
  - pass 시 `integrate-worktree.sh` 가 ticket worktree 코드 변경을 중앙 `PROJECT_ROOT` 로 무커밋 통합한 뒤 board 변경과 함께 local commit
- `done/`
  - 검증 pass + local git commit 완료
  - 티켓은 `project_###` 같은 프로젝트 키별 하위 폴더로 모은다
  - `Result`, 검증 기록 경로 (`tickets/runs/verify_NNN.md`), completion log (`logs/verifier_*.md`) 연결
- `reject/`
  - 검증 fail
  - `## Reject Reason` 섹션 (Verifier, 일시, 원인, 재계획 힌트) 필수
  - planner heartbeat 가 감시해 원인을 새 Execution Candidate 로 반영 후 Status: ready 로 되돌림
  - 파일명은 `reject_NNN.md`
  - 재시도 todo 가 생성되면 `done/<project-key>/reject_NNN.md` 로 이동해 기록으로 남긴다
- `runs/`
  - 실행 기록과 검증 기록을 남기는 결과 폴더
  - 실패 기록도 지우지 않음
  - starter template 은 두지 않음
  - 실제 검증 명령은 `working_root` 에서 실행, 결과 문서만 `BOARD_ROOT/tickets/runs/` 에 남김
- `backlog/`
  - 아직 plan 전인 spec 입력 큐
  - `#spec` 이 이 폴더의 `project_*.md` 를 채운다
  - 실제 todo ticket 이 만들어지면 대응 spec 은 `done/<project-key>/` 로 이동한다
- `plan/`
  - 아직 ticket 생성 전이거나 대기 중인 실제 plan 문서
  - planner 가 spec / reject 를 읽고 이 폴더의 `plan_*.md` 를 작성하거나 갱신
- `inprogress/plan_*.md`
  - planner 가 ticket 생성 중인 plan 문서
  - ticket 생성이 끝나면 `done/<project-key>/plan_NNN.md` 로 이동
- `../logs/`
  - verifier 완료 이력 폴더
  - pass / fail 모두 남김
  - 각 로그는 당시 티켓 스냅샷 + 검증 기록 스냅샷을 함께 보관

권장 stage 값 흐름:

- `todo` → `claimed` (claim 직후) → `executing` (구현 중) → `verifying` (검증 중) → `done` (pass) / `rejected` (fail) / `blocked` (사람 개입 필요)

## Required Ticket Fields

모든 티켓은 아래 항목을 유지한다.

- `ID`, `Title`, `Stage`, `Owner`, `Claimed By`, `Execution Owner`, `Verifier Owner`
- `Project Key`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Obsidian Links`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- `## Reject Reason` (reject 폴더로 갈 때만 추가)

중요:

- `References` 는 `BOARD_ROOT` 상대 경로.
- `Allowed Paths` 는 repo-relative 경로이며, 구현 중에는 티켓 worktree 루트 기준으로 해석한다. worktree 가 없으면 `PROJECT_ROOT` 기준으로 fallback 한다.
- 같은 번호 티켓은 여러 상태 폴더에 동시에 두지 않는다. reject 재시도는 **새** 번호로 발급한다.
- `todo/`, `inprogress/`, `verifier/`, `done/`, `reject/` 디렉터리는 상태 보드 자체이며 하위 README 없이 빈 폴더로 유지돼도 된다.
- `done/<project-key>/` 티켓은 `tickets/runs/` 아래 검증 기록과 연결돼 있어야 한다.
- verifier 완료 후에는 `BOARD_ROOT/logs/` 아래 completion log 가 하나 이상 있어야 한다.
- plan / ticket / verification note 는 `## Obsidian Links` 로 서로 연결하는 편이 좋다.
- heartbeat worker 는 스스로 멈추지 않는다. `status=idle` 도 정상 상태.
- board stage 가 authoritative 다. 티켓이 `todo/` 또는 `inprogress/` 에 있으면 todo worker 가 구현을 진행하고, pass / fail 판정은 verifier 만 한다.
