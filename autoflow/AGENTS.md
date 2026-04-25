# AGENTS.md

이 보드의 목적은 `문서 기반 AI 작업 하네스 보드`를 운영하는 것이다.

기본 실행 모델은 `Ticket Owner` 다. 한 runner 가 한 티켓의 local plan, implementation, verification, evidence 기록, done/reject 이동까지 끝까지 책임진다.

아래의 planner / todo / verifier role-pipeline 문서는 호환용 레거시 경로다. 새 구현과 기본 runner 는 역할을 분리하지 말고 `ticket-owner` 흐름을 우선한다.

## Canonical Flow

기본 흐름:

`tickets/backlog -> tickets/inprogress/tickets_NNN.md -> rules/verifier -> tickets/inprogress/verify_NNN.md -> logs -> tickets/done/<project-key>/verify_NNN.md`

레거시 role-pipeline 호환 흐름:

`tickets/backlog -> tickets/plan -> tickets/inprogress/plan_NNN.md -> tickets/todo -> tickets/inprogress/tickets_NNN.md -> tickets/verifier -> tickets/done/<project-key>/verify_NNN.md`

의미:

- `tickets/backlog/`: 아직 plan 전인 spec 입력 큐
- `tickets/plan/`: legacy role-pipeline 에서 어떤 일을 어떤 순서로 티켓화할지 정리
- `automations/`: 훅과 폴더별 자동화 역할
- `agents/`: 각 훅이 실행할 역할 정의
- `tickets/`: 작업 단위와 상태 보드
- `tickets/backlog/`: 아직 plan 전인 spec 입력 큐
- `tickets/plan/`: legacy role-pipeline 의 plan 대기열
- `tickets/inprogress/`: Ticket Owner 가 점유한 `tickets_*.md` 와 진행 중 검증 기록을 두는 구역. legacy role-pipeline 에서는 `plan_*.md` / todo worker 티켓도 이곳을 쓴다.
- `tickets/done/<project-key>/`: 완료 티켓, 처리된 spec, legacy ticket 생성 완료 plan 을 프로젝트 단위로 보관
- `reference/`: 상태 폴더 밖에서 README 와 템플릿 보관
- `rules/verifier/`: 검증 기준과 체크리스트
- `tickets/inprogress/verify_NNN.md`: Ticket Owner 또는 verifier 가 작업 중일 때 쓰는 임시 검증 기록
- `logs/`: owner / verifier 완료 이력 로그

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `README.md`
2. `rules/README.md`
3. `reference/backlog.md`
4. `reference/plan.md`
5. `automations/README.md`
6. `reference/tickets-board.md`
7. `rules/verifier/README.md`
8. 관련 문서:
   - 새 의도 받아서 spec 초안이면 `agents/spec-author-agent.md`
   - 기본 ticket owner 실행이면 `agents/ticket-owner-agent.md`
   - plan 도출 / reject 재계획이면 `agents/plan-to-ticket-agent.md`
   - claim + 구현이면 `agents/todo-queue-agent.md`
   - 검증 / pass 커밋 / fail reject 면 `agents/verifier-agent.md`, `rules/verifier/checklist-template.md`, `rules/verifier/verification-template.md`, `reference/tickets-board.md`

## Runtime Command Convention

- Windows 에서는 `scripts/*.ps1` 래퍼를 우선 실행한다. 예: `powershell -ExecutionPolicy Bypass -File autoflow/scripts/start-ticket-owner.ps1`
- Bash 전용 환경에서는 같은 이름의 `scripts/*.sh` 를 실행한다.
- 문서에서 `start-ticket-owner 런타임`, `verify-ticket-owner 런타임`, `finish-ticket-owner 런타임`, `start-plan 런타임`, `start-todo 런타임`, `handoff-todo 런타임`, `start-verifier 런타임`, `write-verifier-log 런타임` 이라고 하면 위 규칙에 따라 `.ps1` 또는 `.sh` 중 환경에 맞는 진입점을 고른다.

## Core Rules

1. 스펙이 없으면 Ticket Owner 는 backlog 기반 새 티켓을 만들지 않는다. legacy role-pipeline 에서는 스펙이 없으면 플랜도 티켓도 만들지 않는다.
2. 기본 실행은 `scripts/start-ticket-owner.*` 로 한 owner 가 티켓을 만들거나 점유한 뒤, 같은 owner 가 local plan / 구현 / 검증 / evidence / done-reject 이동까지 처리한다.
3. 레거시 role-pipeline 에서 플랜은 `#plan` heartbeat 가 spec 에서 도출해 만든다. 사람이 손으로 만들 수도 있다.
4. 레거시 role-pipeline 에서 새 티켓은 planner agent 가 plan 의 Execution Candidates 를 보고 `tickets/todo/` 에 직접 작성한다. `start-plan.sh` 는 각 Candidate 에 대해 ID/경로/lock/중복체크를 해주고 `pending_ticket_begin ... pending_ticket_end` 블록을 출력하며, agent 가 해당 블록마다 `tickets_{id}.md` 본문을 `reference/ticket-template.md` 기반으로 작성한다. `Plan Candidate` 필드는 script 의 `candidate` 값을 글자 그대로 복사해야 dedup 이 동작한다.
5. legacy planner 가 실제 todo ticket 을 만들면 대응 spec 과 plan 은 `tickets/done/<project-key>/` 로 옮겨 backlog / plan 루트에서 빠져야 한다. 기본 Ticket Owner 는 처리한 spec 을 바로 done 프로젝트 폴더로 보관한다.
6. legacy `#todo` 는 티켓을 `todo → inprogress` 로 점유 이동한 뒤 티켓별 git worktree 를 만들고 **같은 worker 가 그 worktree 에서 구현**한다. execution 별도 역할 없음. 구현이 끝나면 `handoff-todo` 런타임으로 중앙 보드 티켓을 `tickets/inprogress/ → tickets/verifier/` 로 옮기고 active ticket context 를 비운다.
7. 티켓 제목, Goal, Done When 문구가 검증·리뷰처럼 보여도 파일이 `tickets/todo/` 또는 `tickets/inprogress/` 에 있으면 현재 stage 의 owner 가 구현 또는 확인을 계속 진행한다. 기본 흐름에서는 Ticket Owner 가 pass / fail 을 판정하고, legacy role-pipeline 에서는 verifier 만 판정한다.
8. legacy `#veri` 는 `tickets/verifier/` 의 티켓을 검사해 pass → `tickets/done/<project-key>/` + git commit (local), fail → `tickets/reject/reject_NNN.md` + `## Reject Reason` 기록. 기본 Ticket Owner 는 `verify-ticket-owner` 와 `finish-ticket-owner` 로 같은 evidence / done / reject 계약을 수행한다. **`git push` 절대 금지.**
9. Ticket Owner / verifier 의 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. Ticket Owner / verifier 가 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. Ticket Owner / verifier 는 `BOARD_ROOT` / ticket worktree / `PROJECT_ROOT` 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. legacy planner heartbeat 와 plan hook 은 `tickets/reject/reject_NNN.md` 뿐 아니라 `tickets/done/<project-key>/` 완료 뒤에도 backlog 를 다시 확인해, 다음 populated spec 이 남아 있으면 다음 plan 으로 이어가야 한다. reject 원인을 반영한 재시도 todo 가 생성되면 해당 reject 파일은 `tickets/done/<project-key>/reject_NNN.md` 로 보관한다.
13. 같은 번호의 티켓 파일이 여러 상태 폴더에 동시에 존재하지 않는다. (`todo/` ↔ `inprogress/` ↔ `verifier/` ↔ `done/` 또는 `reject/` 중 한 곳)
14. `inprogress` 티켓에는 `Owner`, `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Last Updated`, `Next Action`, `Resume Context` 가 있어야 한다.
15. 대화창이 중단/재시작되어도 재개는 항상 `tickets/inprogress/` 의 `Resume Context` 를 기준으로 한다.
16. `automations/state/*.context` 는 stop hook 과 worker 역할 문맥을 위한 런타임 상태다. Ticket Owner / legacy `#todo` / legacy `#veri` 는 tick 중에 active ticket context 를 잡아도 완료 시 active ticket 문맥을 비우고 role / worker 문맥만 남긴다. 상관관계는 Obsidian Links, `References`, `Resume Context`, run/log 파일을 기준으로 재구성한다.
17. 여러 owner worker 가 동시 실행 가능. mv 기반 claim 이 경합을 막는다.
18. Ticket Owner / verifier 는 작업을 시작할 때 `tickets/inprogress/verify_NNN.md` 를 만들고, 완료 시 이 기록을 최종 티켓 옆으로 함께 이동한다. pass 는 `tickets/done/<project-key>/verify_NNN.md`, fail 은 `tickets/reject/verify_NNN.md` 를 남기고 `logs/verifier_NNN_*.md` completion log 도 별도로 남긴다.
19. `done` 으로 옮길 때는 `Verification`, `Result` 항목을 갱신하고 `tickets/done/<project-key>/verify_NNN.md` 및 생성된 completion log 와 연결한다.
20. 티켓 파일명은 항상 `tickets_001.md` 형식. 새 번호는 현재 존재하는 최대 번호 + 1.
21. git 저장소에서는 Ticket Owner / legacy todo 가 티켓별 worktree / branch 를 사용한다. 제품 코드 변경은 worktree 에 남기고, pass 시 중앙 `PROJECT_ROOT` 에 무커밋 통합한 뒤 board 변경과 함께 한 커밋으로 묶는다.
22. 중앙 `PROJECT_ROOT` 에 board 밖 dirty file 이 있으면 Ticket Owner / verifier 는 worktree 통합을 막고, 다른 티켓 변경을 섞어 커밋하지 않는다.
23. heartbeat worker 는 할 일 없어도 스스로 멈추지 않는다. `status=idle` 로 턴만 마치고 다음 wake-up 을 기다린다. "멈춰" 명령은 사용자만 내린다.
24. 기본 heartbeat 는 Ticket Owner 용이다. 사용자가 legacy `#plan`, `#todo`, `#veri` 라고 하면 해당 역할의 **1분 heartbeat 자동화**를 생성 또는 재개하고, 같은 턴에서 첫 tick 도 바로 수행한다. 자동화는 사용자가 멈추라고 하기 전까지 절대 스스로 꺼지지 않는다.

## Agent Modes

이 보드에서 기본 실행은 `Ticket Owner Mode` 다. `Spec Authoring Mode` 는 heartbeat 없이 사용자가 수동으로 트리거한다. legacy role-pipeline 이 필요할 때만 plan / todo / verifier heartbeat 를 분리해 쓴다.

### 1. Spec Authoring Mode

목적:

- Codex/Claude 대화창에서 사용자가 `#spec` 이라고 말했을 때, 이어지는 대화로 프로젝트/기능 의도를 모아 **`tickets/backlog/project_{번호}.md` 초안을 대화창에서 먼저 정리하고**, 사용자가 명시적으로 저장을 허락하면 spec 파일에만 남긴다.

반드시 읽을 파일:

- `agents/spec-author-agent.md`
- 호스트 루트 `AGENTS.md` (있으면)
- 기존 `tickets/backlog/*.md`, `tickets/plan/*.md`, `tickets/inprogress/plan_*.md`, `tickets/done/*/project_*.md`, `tickets/done/*/plan_*.md`
- `reference/project-spec-template.md`

해야 하는 일:

- `scripts/start-spec.sh` 실행해서 대상 번호 슬롯 확인
- 사용자와 대화하면서 Goal, Scope, Stack, Allowed Paths, Acceptance Criteria 수집
- 저장 전에는 대화창 안에서 spec 전문 초안을 보여주고 수정 요청을 반영
- 사용자가 명시적으로 저장을 허락하면 `project_{번호}.md` 에만 저장

하면 안 되는 일:

- 사용자 확인 없이 spec 파일을 쓰는 것
- `tickets/plan/` 아래 파일을 만들거나 수정하는 것
- 티켓 생성
- 구현 / 검증

### 2. Ticket Owner Mode (default)

목적:

- `ticket-owner` heartbeat 또는 `autoflow run ticket` 으로 동작. 한 owner 가 자기 `tickets/inprogress/` 티켓을 이어가거나, 없으면 `tickets/todo/`, `tickets/verifier/`, populated backlog spec 순서로 한 항목을 점유해 local plan, 구현, 검증, evidence, done/reject 이동까지 끝까지 처리한다.

반드시 읽을 파일:

- `agents/ticket-owner-agent.md`
- 대상 `tickets/inprogress/tickets_NNN.md`, `tickets/todo/tickets_NNN.md`, `tickets/verifier/tickets_NNN.md`, 또는 `tickets/backlog/project_NNN.md`
- 참조된 `tickets/done/*/project_*.md`
- `rules/verifier/README.md`, `rules/verifier/checklist-template.md`, `rules/verifier/verification-template.md`

해야 하는 일:

- `scripts/start-ticket-owner.*` 실행 후 출력된 `ticket`, `implementation_root`, `run`, `done_target`, `reject_target` 를 기준으로 작업한다.
- 티켓의 `Allowed Paths` 안에서만 구현하고, 진행 상황은 `Notes`, `Next Action`, `Resume Context`, `Result` 에 남긴다.
- 검증 준비가 되면 `scripts/verify-ticket-owner.* <ticket-id>` 로 `tickets/inprogress/verify_NNN.md` evidence 를 만든다.
- pass 면 `scripts/finish-ticket-owner.* <ticket-id> pass "<summary>"` 로 worktree 통합, done 이동, completion log, local commit 을 처리한다.
- fail 이고 owner 가 같은 scope 안에서 고칠 수 없으면 `scripts/finish-ticket-owner.* <ticket-id> fail "<concrete reason>"` 으로 reject 와 completion log 를 남긴다.

하면 안 되는 일:

- 허용 경로 밖 수정
- 검증 기록 없이 done/reject 처리
- 같은 owner 가 동시에 여러 active ticket 처리
- `git push`

### 3. Plan Automation Mode (legacy role-pipeline)

목적:

- `#plan` heartbeat 로 동작. spec 이 있고 대응하는 plan 이 없거나 draft 면 plan 을 도출해 쓰고, `tickets/reject/reject_NNN.md` 를 감시해 실패 원인을 새 Execution Candidate 로 재반영한다. `start-plan.sh` 가 ready plan 을 `tickets/inprogress/plan_NNN.md` 로 점유한 뒤 각 Candidate 에 대해 `pending_ticket` 블록을 출력하고, agent 가 그 블록마다 `tickets/todo/tickets_NNN.md` 본문을 직접 작성한다. 모든 Candidate 에 대응 ticket 이 존재하면 script 가 spec 과 plan 을 `tickets/done/<project-key>/` 로 보관한다. 재시도 todo 생성 뒤에는 소비된 reject 도 같은 프로젝트 done 폴더로 보관한다.

반드시 읽을 파일:

- `agents/plan-to-ticket-agent.md`
- 대상 `tickets/backlog/project_{번호}.md`, `tickets/plan/plan_{번호}.md`, `tickets/inprogress/plan_{번호}.md`
- `reference/roadmap.md`
- `tickets/reject/reject_*.md` (있다면)
- `reference/ticket-template.md`

해야 하는 일:

- spec 이 채워져 있는데 plan 이 없으면 plan 초안 생성 (Candidates 까지 채움, Status 는 draft 유지)
- 다음 tick 에서 `start-plan.sh` 가 draft → ready 자동 flip + `tickets/inprogress/plan_NNN.md` 점유 + pending_ticket 블록 출력 → agent 가 같은 tick 에서 `tickets/todo/tickets_NNN.md` 본문 작성. 모든 Candidate 가 ticket 화되면 다음 tick 에서 script 가 spec/plan 을 done 으로 보관.
- reject 티켓의 `## Reject Reason` 을 읽고 새 Candidate 추가 + plan Status 를 ready 로 되돌림. 재시도 todo 가 생성되면 해당 `reject_NNN.md` 는 `tickets/done/<project-key>/` 로 이동

하면 안 되는 일:

- 티켓을 `inprogress` 로 이동
- 구현 시작
- 검증 실행
- `done` 판정
- `git push`

### 4. Todo Queue Mode (legacy role-pipeline claim + 구현)

목적:

- `#todo` heartbeat 로 동작. `tickets/todo/` 에서 한 티켓을 점유해 `tickets/inprogress/` 로 옮기고 **같은 worker 가 구현까지 진행**. 완료 시 `tickets/verifier/` 로 이동시켜 검증 대기 상태로 넘긴다.

반드시 읽을 파일:

- `agents/todo-queue-agent.md`
- 대상 티켓 파일 또는 `tickets/todo/*`
- 참조된 `tickets/backlog/*`, `tickets/plan/*`, `tickets/done/*/project_*.md`, `tickets/done/*/plan_*.md`

해야 하는 일:

- 먼저 자기 owner 로 배정된 `tickets/inprogress/` 가 있으면 그것부터 재개
- 없으면 `start-todo.sh` 로 새 claim
- 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태 폴더가 `todo` 또는 `inprogress` 이면 그대로 구현 단계로 처리
- 티켓의 `Worktree.Path` 또는 `implementation_root` 에서 `Allowed Paths` 범위 안으로 Goal 구현. 여러 heartbeat tick 에 걸쳐 Resume Context 로 이어가도 됨
- 기존 `inprogress` 재개 시에는 `scripts/set-thread-context.sh todo <worker-id> <ticket-id> executing <ticket-path>` 로 active ticket 문맥도 맞춘다
- 완료 시 `Notes`, `Result.Summary`, `Verification: pending` 갱신 후 `scripts/handoff-todo.*` 런타임으로 중앙 보드 파일을 `tickets/verifier/` 로 넘기고 현재 ticket 문맥만 비운다

하면 안 되는 일:

- 허용 경로 밖 수정
- 검증 / 커밋 / push
- reject 처리 (planner 영역)
- 다른 티켓 생성

### 5. Verification Mode (legacy role-pipeline)

목적:

- `#veri` heartbeat 로 동작. `tickets/verifier/` 에 올라온 티켓을 검증해 pass → `tickets/done/<project-key>/` + git commit (local), fail → `tickets/reject/reject_NNN.md` + `## Reject Reason` 기록. 완료 시 `logs/` 아래 completion log 도 남긴다.

반드시 읽을 파일:

- `agents/verifier-agent.md`
- 대상 티켓 파일 (`tickets/verifier/tickets_NNN.md`)
- 관련 `tickets/backlog/*`
- `rules/verifier/checklist-template.md`
- `rules/verifier/verification-template.md`

해야 하는 일:

- `start-verifier.sh` 가 출력한 `working_root` 에서 spec 의 `Verification.Command` 실행 + Acceptance Criteria 관찰
- 검증 시작 시 `tickets/inprogress/verify_NNN.md` 에 pass/fail 결과 기록
- `logs/verifier_NNN_*.md` completion log 생성
- **Pass**: worktree 가 있으면 `scripts/integrate-worktree.sh` 로 코드 변경을 중앙 `PROJECT_ROOT` 에 무커밋 통합 → 티켓을 `tickets/done/<project-key>/` 로 mv → `git add . && git commit -m "[티켓명] 간략 수정내용"` (local commit)
- **Fail**: 티켓 하단에 `## Reject Reason` 추가 후 `tickets/reject/reject_NNN.md` 로 mv. commit 하지 않음

하면 안 되는 일:

- 기준 없이 임의 pass
- 검증 기록 없이 티켓 종료
- 코드 수정 (fix 는 todo worker 영역)
- **`git push` 절대 금지**

## Ticket Lifecycle

기본 Ticket Owner 흐름 (아래 경로는 예시 번호 `001` 을 쓴 형식이며 각 보드가 번호를 직접 발급한다):

```text
tickets/backlog/project_001.md            (사용자가 #spec 으로 채움)
  → tickets/inprogress/tickets_001.md   (Ticket Owner 가 spec 에서 직접 생성하거나 기존 티켓 점유)
  → tickets/inprogress/verify_001.md    (Ticket Owner 가 verify-ticket-owner 로 evidence 기록)
  → tickets/done/project_001/tickets_001.md  (pass: finish-ticket-owner 로 local commit + mv)
  ↘ tickets/done/project_001/project_001.md  (처리된 spec 보관)
   ↘ tickets/reject/reject_001.md   (fail: concrete Reject Reason 기록)
```

legacy role-pipeline 흐름:

```text
tickets/backlog/project_001.md            (사용자가 #spec 으로 채움)
  → tickets/plan/plan_001.md           (planner heartbeat 가 도출 후 Candidates 채움)
  → tickets/inprogress/plan_001.md (planner 가 ticket 생성 작업 점유)
  → tickets/todo/tickets_001.md      (start-plan.sh 가 pending_ticket 블록 출력 → planner agent 가 본문 작성)
  → tickets/inprogress/tickets_001.md   (todo worker 가 claim + 구현)
  → tickets/verifier/tickets_001.md  (구현 완료 후 verifier 로 mv)
  → tickets/done/project_001/tickets_001.md  (pass: git commit + mv)
  ↘ tickets/done/project_001/project_001.md  (ticket 생성 뒤 spec 보관)
  ↘ tickets/done/project_001/plan_001.md     (ticket 생성 뒤 plan 보관)
   ↘ tickets/reject/reject_001.md   (fail: Reject Reason 기록, planner 가 재계획)
     → tickets/done/project_001/reject_001.md (재계획 todo 생성 뒤 보관)
```

규칙:

- `todo`: 아직 시작 전
- `inprogress`: Ticket Owner 또는 legacy todo worker 가 점유해 구현 / 검증 중
- `verifier`: legacy 구현 완료, 검증 대기. 기본 Ticket Owner 도 기존 verifier 티켓을 이어받을 수 있다.
- `done`: 검증 pass + local commit 완료 티켓, 처리된 spec, legacy ticket 생성 완료 plan 을 프로젝트 단위로 보관
- `reject`: 검증 fail + Reject Reason 기록. 파일명은 `reject_NNN.md` 이며 legacy planner 가 재계획 이후 새 ticket 으로 다시 돌리면 프로젝트별 `done` 폴더로 보관할 수 있다.
- `verify_NNN.md`: Ticket Owner 또는 verifier 가 시작 시 `inprogress/` 아래에 만들고, 완료 시 final ticket 위치로 같이 이동하는 검증 기록 파일

## Required Ticket Fields

모든 티켓은 아래 항목을 유지해야 한다.

- `ID`
- `Project Key`
- `Title`
- `Stage`
- `Owner`
- `Claimed By`
- `Execution Owner`
- `Verifier Owner`
- `Goal`
- `References`
- `Obsidian Links`
- `Allowed Paths`
- `Worktree`
- `Done When`
- `Last Updated`
- `Next Action`
- `Resume Context`
- `Verification`
- `Result`

## Duplicate Prevention

새 티켓을 만들기 전 반드시 아래를 확인한다.

- `tickets/todo/`
- `tickets/inprogress/`
- `tickets/verifier/`
- `tickets/done/`
- `tickets/reject/`

이미 같은 Goal 또는 같은 plan source 를 가진 티켓이 있으면 새로 만들지 않는다. 단, reject 의 재시도는 새 Candidate → 새 티켓 번호로 발급하는 것이 원칙 (reject 원본은 기록으로 남김).

## Chat Trigger

Codex/Claude 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Spec Authoring Mode` 로 해석한다 (manual 전용).

- `#spec`
- `#spec 003`
- `#spec project_003`
- `#autoflow`

동작 규칙:

1. `scripts/start-spec.sh` 실행.
2. 번호가 없으면 현재 보드에 존재하는 최대 project 번호 다음 번호를 쓴다.
3. 사용자와 대화해서 Goal / Scope / 관련 파일·모듈 / Acceptance Criteria 를 모은다.
4. 실행 기준은 `tickets/backlog/project_{번호}.md` spec 이다. Desktop/CLI handoff 저장 또는 사용자 명시 요청이 있을 때만 같은 번호의 `conversations/project_{번호}/spec-handoff.md` 를 추가로 남긴다.
5. 저장은 사용자가 명시적으로 허락한 뒤에만 한다.
6. 다음 단계는 기본적으로 Ticket Owner runner 가 이어받는다. legacy role-pipeline 이 필요할 때만 사용자가 `#plan` 으로 planner heartbeat 를 시작한다.
7. 티켓은 만들지 않는다.
8. `tickets/plan/` 은 건드리지 않는다.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Plan Automation Mode` 로 해석한다 (heartbeat 대상).

- `#plan`

동작 규칙 (매 tick):

1. 먼저 현재 스레드에 `plan` 역할용 1분 heartbeat 자동화를 생성 또는 재개한다. 이 자동화는 사용자가 "멈춰"라고 할 때까지 유지한다.
2. `scripts/start-plan.sh` 실행. 출력 읽기.
3. `reject_count > 0` 이면 각 `reject_NNN.md` 의 `## Reject Reason` 을 해당 plan 의 새 Candidate 로 추가 + Status = ready 되돌림.
4. `status=idle` / `reason=no_actionable_plan` + populated spec 에 대응 plan 이 없으면 `reference/plan-template.md` 를 참고해 plan 초안 생성 (Candidates 까지 채움, Status=draft). 다음 tick 에서 auto-flip + inprogress 점유 + pending_ticket 출력.
5. `status=ok` / `pending_ticket_count>0` 이면 각 `pending_ticket_begin ... pending_ticket_end` 블록의 `file` 경로에 `reference/ticket-template.md` 기반 ticket 본문을 작성한다. `Plan Candidate` 는 블록의 `candidate` 를 글자 그대로, `Title`/`Goal`/`Done When`/`Verification` 은 spec 과 plan 의 Allowed Paths 를 참고해 구체적으로 채운다. 그 뒤 backlog 를 다시 확인해 다음 populated spec 의 plan drafting 으로 이어간다.
5a. `status=ok` / `pending_ticket_count=0` + `archived_plan=...` 이 있으면 해당 plan 은 script 가 done 으로 보관한 것. 추가 작업 없음.
6. 구현 / 이동 / 검증 / commit / push 금지.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Todo Queue Mode` 로 해석한다 (heartbeat 대상).

- `#todo`

동작 규칙 (매 tick):

1. 먼저 현재 스레드에 `todo` 역할용 1분 heartbeat 자동화를 생성 또는 재개한다. 이 자동화는 사용자가 "멈춰"라고 할 때까지 유지한다.
2. 자기 owner 로 배정된 `tickets/inprogress/` 티켓이 있으면 그것부터 이어서 **구현**.
3. 없으면 `scripts/start-todo.sh` 로 새 claim.
4. 티켓 제목 / Goal / Done When 이 검증처럼 보여도 stage 가 `todo` 또는 `executing` 인 한 todo worker 가 구현을 계속 진행한다. legacy role-pipeline 에서는 verifier 만 pass / fail 을 판정한다.
5. 티켓 `Worktree.Path` 또는 `implementation_root` 에서 `Allowed Paths` 범위 안으로 Goal 구현 (한 tick 에 끝내지 못하면 Resume Context 남기고 다음 tick 에 이어감).
6. 기존 `inprogress` 재개 시에는 `scripts/set-thread-context.sh todo <worker-id> <ticket-id> executing <ticket-path>` 로 active ticket 문맥을 현재 ticket 에 맞춘다.
7. `Done When` 충족되면 `Notes`, `Result.Summary`, `Verification: pending` 갱신 후 `scripts/handoff-todo.*` 런타임으로 티켓을 `tickets/verifier/` 로 넘긴다. 이 런타임이 이동과 `clear-thread-context --active-only` 를 함께 수행해 현재 ticket 문맥만 비운다.
8. 다른 티켓 생성 / 검증 / commit / push 금지.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Verification Mode` 로 해석한다 (heartbeat 대상).

- `#veri`

동작 규칙 (매 tick):

1. 먼저 현재 스레드에 `verifier` 역할용 1분 heartbeat 자동화를 생성 또는 재개한다. 이 자동화는 사용자가 "멈춰"라고 할 때까지 유지한다.
2. `scripts/start-verifier.sh` 실행. `status=idle` 이면 현재 wake-up 만 마치고 다음 tick 을 기다린다.
3. `status=ok` 이면 `verify` / `run` / `working_root` / `integration_command` 경로를 읽고 `working_root` 에서 spec 의 `Verification.Command` + Acceptance Criteria 검사.
4. **Pass**: run 파일에 pass 기록 → worktree 가 있으면 `integration_command` 로 코드 변경을 중앙 `PROJECT_ROOT` 에 무커밋 통합 → 티켓 `Stage=done`, `Result.Summary` 갱신 → 티켓을 `tickets/done/<project-key>/` 로 mv → `scripts/write-verifier-log.sh` 로 `logs/` completion log 생성 → git 시스템이 있으면 `git add . && git commit -m "[티켓명] 간략 수정내용"` (local). `티켓명` 은 티켓 `Title`, 수정내용은 `Result.Summary` 또는 검증된 변경의 짧은 한 줄 요약을 쓴다. **`git push` 절대 금지.**
5. **Fail**: run 파일에 fail 기록 → 티켓 하단에 `## Reject Reason` 섹션 추가 → 티켓을 `tickets/reject/reject_NNN.md` 로 mv → `scripts/write-verifier-log.sh` 로 `logs/` completion log 생성. commit 하지 않음. working tree 변경은 그대로 두고 legacy planner 가 다음 tick 에서 재계획할 수 있다.

## Completion Standard

아래를 만족해야만 `done` 으로 옮길 수 있다.

1. 티켓의 `Done When` 항목이 충족되었다.
2. `rules/verifier/` 기준으로 검증했다.
3. 검증 기록이 최종 티켓과 같은 위치에 있다. pass 는 `tickets/done/<project-key>/verify_NNN.md`, fail 은 `tickets/reject/verify_NNN.md`.
4. completion log 가 `logs/` 에 있다.
5. 티켓의 `Verification` 항목에 그 기록과 로그가 연결되어 있다.
6. 티켓의 `Result` 가 채워져 있다.

## Communication Style Inside Files

- 짧고 명확하게 쓴다.
- 추상적인 표현보다 관찰 가능한 문장을 쓴다.
- "좋아 보임" 대신 "390px 폭에서 버튼이 겹치지 않음"처럼 쓴다.
- 체크리스트는 실제로 판단 가능한 문장으로 유지한다.

## Priority When Instructions Conflict

우선순위는 아래와 같다.

1. 직접 받은 사용자 요청
2. 이 `AGENTS.md`
3. 각 폴더의 README 와 템플릿
