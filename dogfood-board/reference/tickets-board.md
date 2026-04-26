# Tickets Board

이 폴더는 `BOARD_ROOT` 안의 상태별 보드다.

- `todo/`: 외부 큐 또는 legacy planner 가 만든 아직 시작하지 않은 티켓
- `inprogress/`: Ticket Owner 가 점유한 `tickets_*.md` 와 진행 중 검증 기록. legacy role-pipeline 에서는 `plan_*.md` 와 todo worker 티켓도 이곳을 쓴다.
- `verifier/`: legacy 구현 완료, 검증 대기 티켓. Ticket Owner 도 기존 verifier 티켓을 이어받을 수 있다.
- `done/`: 검증 pass + local commit 완료된 티켓 (`done/<project-key>/tickets_NNN.md`)
- `reject/`: 검증 fail, `## Reject Reason` 기록된 `reject_NNN.md` 티켓
- `verify_NNN.md`: Ticket Owner 또는 verifier 가 시작 시 `inprogress/` 에 만들고, 완료 시 final ticket 옆으로 같이 이동하는 검증 기록 파일
- `backlog/`: 아직 plan 전인 spec 입력 큐
- `plan/`: legacy role-pipeline 의 plan 문서
- `inprogress/plan_*.md`: legacy planner 가 ticket 생성 중인 plan 문서
- `../logs/`: owner / verifier 완료 로그 (`verifier_<ticket-id>_<timestamp>_<outcome>.md`)

`inprogress` 안의 `tickets_*.md` 티켓은 아래 owner 필드를 함께 가진다.

- `Claimed By`
- `Execution Owner`
- `Verifier Owner`

티켓 파일은 `tickets_번호.md` 형식을 쓴다. 예: `tickets_001.md`, `tickets_014.md`, `tickets_120.md`.

## Lifecycle

기본 Ticket Owner 흐름:

```text
tickets/backlog/project_001.md              (사용자가 #af 로 채움)
  → tickets/inprogress/tickets_001.md   (Ticket Owner 가 spec 에서 직접 생성하거나 기존 티켓 점유)
  → tickets/inprogress/verify_001.md    (Ticket Owner 가 verify-ticket-owner 로 evidence 기록)
  → tickets/done/project_001/tickets_001.md  (pass: finish-ticket-owner 로 local commit + mv)
  ↘ tickets/done/project_001/project_001.md  (처리된 spec 보관)
   ↘ tickets/reject/reject_001.md   (fail: concrete Reject Reason 기록)
```

legacy role-pipeline 흐름:

```text
tickets/backlog/project_001.md              (사용자가 #af 로 채움)
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

검증 기록 (`verify_NNN.md`) 은 Ticket Owner 또는 verifier 시작 시 `tickets/inprogress/` 아래에 생긴다. pass 하면 `tickets/done/<project-key>/verify_NNN.md`, fail 하면 `tickets/reject/verify_NNN.md` 로 같이 이동한다. 처리를 마치면 별도로 `BOARD_ROOT/logs/` 에 completion log 도 남긴다.

## State Rules

- `todo/`
  - 아직 시작하지 않은 작업
  - Goal, References, Allowed Paths, Done When 이 채워져 있어야 함
  - 제목 / Goal / Done When 문구가 검증처럼 보여도 파일이 `todo/` 에 있으면 현재 owner 가 구현 대상으로 처리
  - 기본 Ticket Owner 또는 legacy `start-todo.sh` 가 여기서 한 개를 `inprogress/` 로 점유 이동
- `inprogress/`
  - `tickets_*.md` 는 Ticket Owner 또는 legacy todo worker 가 claim 해 현재 구현 / 검증 중인 상태다.
  - legacy `plan_*.md` 는 planner 가 ticket 생성 작업을 점유한 상태다.
  - Codex 대화 하나는 한 번에 `tickets_*.md` 하나만 활성 처리한다. 같은 owner 가 이미 가진 `inprogress` 티켓이 있으면 새 claim 대신 그 티켓을 재개한다.
  - legacy planner 대화 하나는 한 번에 `plan_*.md` 하나만 활성 처리한다. 같은 대화가 이미 가진 active plan 이 있으면 새 plan 대신 그 plan 을 재개한다.
  - `tickets_*.md` 에는 `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner`, `Worktree`, `Last Updated`, `Next Action`, `Resume Context` 필수
  - git 저장소에서는 Ticket Owner 또는 legacy `start-todo.sh` 가 티켓별 worktree 를 만들고 owner 는 그 worktree 에서 구현한다.
  - worker runtime context 는 역할 문맥과 현재 ticket 문맥을 따로 가진다. 기능 단위 작업 완료 시 전체 context 삭제 대신 active ticket 문맥만 비우고, 다음 tick 은 Obsidian links / References / Resume Context 를 다시 읽는다.
  - blocker 가 있으면 여기에 남김 (todo 로 되돌리지 않음)
  - 기본 Ticket Owner 는 구현과 검증을 같은 티켓에서 이어가고, legacy todo 는 구현 완료 시 `Notes`, `Result.Summary` 를 갱신한 뒤 `scripts/handoff-todo.*` 로 파일을 `verifier/` 로 넘긴다.
- `verifier/`
  - legacy 구현 완료, 검증 대기. 기본 Ticket Owner 도 여기 있는 기존 티켓을 이어받을 수 있다.
  - legacy verifier heartbeat 는 여기서 한 개씩 집어 `start-verifier.sh` 가 출력한 `working_root` 에서 검증 명령 실행
  - Codex 대화 하나는 한 번에 verifier 티켓 하나만 활성 처리한다. 같은 worker 가 이미 맡은 verifier 티켓이 있으면 새 티켓 대신 그 티켓을 재개한다.
  - pass 시 owner / verifier runtime 이 ticket worktree 코드 변경을 중앙 `PROJECT_ROOT` 로 무커밋 통합한 뒤 board 변경과 함께 local commit
- `done/`
  - 검증 pass + local git commit 완료
  - 티켓은 `project_###` 같은 프로젝트 키별 하위 폴더로 모은다
  - `Result`, 검증 기록 경로 (`tickets/done/<project-key>/verify_NNN.md`), completion log (`logs/verifier_*.md`) 연결
- `reject/`
  - 검증 fail
  - `## Reject Reason` 섹션 (Verifier, 일시, 원인, 재계획 힌트) 필수
  - legacy planner heartbeat 가 감시해 원인을 새 Execution Candidate 로 반영 후 Status: ready 로 되돌릴 수 있음
  - 파일명은 `reject_NNN.md`
  - 재시도 todo 가 생성되면 `done/<project-key>/reject_NNN.md` 로 이동해 기록으로 남긴다
- `inprogress/verify_NNN.md`
  - Ticket Owner 또는 verifier 의 활성 실행 기록과 검증 기록 파일
  - 실제 검증 명령은 `working_root` 에서 실행, 결과 문서는 먼저 `BOARD_ROOT/tickets/inprogress/verify_NNN.md` 에 남김
  - 완료 후에는 티켓 최종 상태에 따라 `done/<project-key>/verify_NNN.md` 또는 `reject/verify_NNN.md` 로 이동
- `backlog/`
  - 아직 plan 전인 spec 입력 큐
  - `#af` 또는 `#autoflow` 가 이 폴더의 `project_*.md` 를 채운다
  - Codex 대화 하나는 한 번에 `project_*.md` 하나만 active authoring 한다. 같은 대화에 active spec 이 있으면 새 번호 대신 그 spec 을 재개한다.
  - 실제 todo ticket 이 만들어지면 대응 spec 은 `done/<project-key>/` 로 이동한다
- `plan/`
  - legacy role-pipeline 에서 아직 ticket 생성 전이거나 대기 중인 실제 plan 문서
  - legacy planner 가 spec / reject 를 읽고 이 폴더의 `plan_*.md` 를 작성하거나 갱신
- `inprogress/plan_*.md`
  - legacy planner 가 ticket 생성 중인 plan 문서
  - ticket 생성이 끝나면 `done/<project-key>/plan_NNN.md` 로 이동
- `../logs/`
  - owner / verifier 완료 이력 폴더
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
- `done/<project-key>/` 티켓은 같은 폴더의 `verify_NNN.md` 검증 기록과 연결돼 있어야 한다.
- owner / verifier 완료 후에는 `BOARD_ROOT/logs/` 아래 completion log 가 하나 이상 있어야 한다.
- plan / ticket / verification note 는 `## Obsidian Links` 로 서로 연결하는 편이 좋다.
- heartbeat worker 는 스스로 멈추지 않는다. `status=idle` 도 정상 상태.
- board stage 가 authoritative 다. 기본 흐름에서는 Ticket Owner 가 pass / fail 을 판정하고, legacy role-pipeline 에서는 verifier 만 판정한다.
