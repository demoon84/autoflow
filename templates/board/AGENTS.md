# AGENTS.md

이 보드의 목적은 `문서 기반 AI 작업 하네스 보드`를 운영하는 것이다.

에이전트는 이 보드에서 임의로 바로 구현부터 시작하지 말고, 아래의 보드 흐름을 따라야 한다.

## Canonical Flow

`rules/spec -> rules/plan -> automations -> tickets/todo -> tickets/inprogress -> rules/verifier -> tickets/runs -> tickets/done`

의미:

- `rules/spec/`: 무엇이 맞는지 정의하는 기준
- `rules/plan/`: 어떤 일을 어떤 순서로 티켓화할지 정리
- `automations/`: 훅과 폴더별 자동화 역할
- `agents/`: 각 훅이 실행할 역할 정의
- `tickets/`: 작업 단위와 상태 보드
- `rules/verifier/`: 검증 기준과 체크리스트
- `tickets/runs/`: 실행과 검증 기록

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `README.md`
2. `rules/README.md`
3. `rules/spec/README.md`
4. `rules/plan/README.md`
5. `automations/README.md`
6. `tickets/README.md`
7. `rules/verifier/README.md`
8. 관련 문서:
   - 새 의도 받아서 spec 초안이면 `agents/spec-author-agent.md`
   - plan 도출 / reject 재계획이면 `agents/plan-to-ticket-agent.md`
   - claim + 구현이면 `agents/todo-queue-agent.md`
   - 검증 / pass 커밋 / fail reject 면 `agents/verifier-agent.md`, `rules/verifier/checklist-template.md`, `rules/verifier/verification-template.md`, `tickets/README.md`

## Core Rules

1. 스펙이 없으면 플랜도 티켓도 만들지 않는다.
2. 플랜은 `start plan` heartbeat 가 spec 에서 도출해 만든다. 사람이 손으로 만들 수도 있다.
3. 새 티켓은 `start-plan.sh` 가 plan 의 Execution Candidates 를 소비해 `tickets/todo/` 에만 생성한다.
4. `start todo` 는 티켓을 `todo → inprogress` 로 점유 이동한 뒤 **같은 worker 가 그대로 구현**한다. execution 별도 역할 없음. 구현이 끝나면 티켓을 `tickets/inprogress/ → tickets/verifier/` 로 옮긴다.
5. `start verifier` 는 `tickets/verifier/` 의 티켓을 검사해 pass → `tickets/done/` + git commit (local), fail → `tickets/reject/` + `## Reject Reason` 기록. **`git push` 절대 금지.**
6. planner heartbeat 는 `tickets/reject/` 를 감시해 실패 원인을 반영한 새 Execution Candidate 를 해당 plan 에 추가하고 Status 를 ready 로 되돌려 재시도 루프를 돈다. reject 티켓 자체는 기록으로 남긴다.
7. 같은 번호의 티켓 파일이 여러 상태 폴더에 동시에 존재하지 않는다. (`todo/` ↔ `inprogress/` ↔ `verifier/` ↔ `done/` 또는 `reject/` 중 한 곳)
8. `inprogress` 티켓에는 `Owner`, `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Last Updated`, `Next Action`, `Resume Context` 가 있어야 한다.
9. 대화창이 중단/재시작되어도 재개는 항상 `tickets/inprogress/` 의 `Resume Context` 를 기준으로 한다.
10. 여러 todo worker 가 동시 실행 가능. mv 기반 claim 이 경합을 막는다.
11. `done` 으로 옮길 때는 `Verification`, `Result` 항목을 갱신하고 `tickets/runs/verify_NNN.md` 와 연결한다.
12. 티켓 파일명은 항상 `tickets_001.md` 형식. 새 번호는 현재 존재하는 최대 번호 + 1.
13. heartbeat worker 는 할 일 없어도 스스로 멈추지 않는다. `status=idle` 로 턴만 마치고 다음 wake-up 을 기다린다. "멈춰" 명령은 사용자만 내린다.

## Agent Modes

이 보드에서 에이전트는 보통 아래 넷 중 하나로 동작한다. `Spec Authoring Mode` 는 heartbeat 없이 사용자가 수동으로 트리거한다. 나머지 셋 (plan / todo / verifier) 은 1분 heartbeat 로 연결된다. 구현은 todo mode 안에 통합됐고 별도 execution mode 는 없다.

### 1. Spec Authoring Mode

목적:

- Codex/Claude 대화창에서 사용자가 `start spec` 이라고 말했을 때, 이어지는 대화로 프로젝트/기능 의도를 모아 `rules/spec/project_{번호}.md` 와 `rules/plan/plan_{번호}.md` 초안을 작성한다.

반드시 읽을 파일:

- `agents/spec-author-agent.md`
- 호스트 루트 `AGENTS.md` (있으면)
- 기존 `rules/spec/*.md`, `rules/plan/*.md`, `rules/plan/roadmap.md`
- `rules/spec/project-spec-template.md`, `rules/plan/plan_template.md`

해야 하는 일:

- `scripts/start-spec.sh` 실행해서 대상 번호 슬롯 확인
- 사용자와 대화하면서 Goal, Scope, Stack, Allowed Paths, Acceptance Criteria 수집
- `project_{번호}.md` 와 `plan_{번호}.md` 에 초안 내용 작성
- plan `Status` 는 `draft` 로 남겨둔다

하면 안 되는 일:

- 사용자 확인 없이 plan `Status` 를 `ready` 로 바꾸는 것
- 티켓 생성
- 구현 / 검증

### 2. Plan Automation Mode

목적:

- `start plan` heartbeat 로 동작. spec 이 있고 대응하는 plan 이 없거나 draft 면 plan 을 도출해 쓰고, `tickets/reject/` 를 감시해 실패 원인을 새 Execution Candidate 로 재반영한다. `start-plan.sh` 가 ready plan 의 Candidates 를 티켓으로 생성.

반드시 읽을 파일:

- `agents/plan-to-ticket-agent.md`
- 대상 `rules/spec/project_{번호}.md`, `rules/plan/plan_{번호}.md`
- `rules/plan/roadmap.md`
- `tickets/reject/tickets_*.md` (있다면)
- `tickets/tickets_template.md`

해야 하는 일:

- spec 이 채워져 있는데 plan 이 없으면 plan 초안 생성 (Candidates 까지 채움, Status 는 draft 유지)
- 다음 tick 에서 `start-plan.sh` 가 draft → ready 자동 flip + 티켓 생성
- reject 티켓의 `## Reject Reason` 을 읽고 새 Candidate 추가 + plan Status 를 ready 로 되돌림

하면 안 되는 일:

- 티켓을 `inprogress` 로 이동
- 구현 시작
- 검증 실행
- `done` 판정
- `git push`

### 3. Todo Queue Mode (claim + 구현)

목적:

- `start todo` heartbeat 로 동작. `tickets/todo/` 에서 한 티켓을 점유해 `tickets/inprogress/` 로 옮기고 **같은 worker 가 구현까지 진행**. 완료 시 `tickets/verifier/` 로 이동시켜 검증 대기 상태로 넘긴다.

반드시 읽을 파일:

- `agents/todo-queue-agent.md`
- 대상 티켓 파일 또는 `tickets/todo/*`
- 참조된 `rules/spec/*`, `rules/plan/*`

해야 하는 일:

- 먼저 자기 owner 로 배정된 `tickets/inprogress/` 가 있으면 그것부터 재개
- 없으면 `start-todo.sh` 로 새 claim
- `Allowed Paths` 범위 안에서 Goal 구현. 여러 heartbeat tick 에 걸쳐 Resume Context 로 이어가도 됨
- 완료 시 `Notes`, `Result.Summary`, `Verification: pending` 갱신 후 파일을 `tickets/verifier/` 로 mv

하면 안 되는 일:

- 허용 경로 밖 수정
- 검증 / 커밋 / push
- reject 처리 (planner 영역)
- 다른 티켓 생성

### 4. Verification Mode

목적:

- `start verifier` heartbeat 로 동작. `tickets/verifier/` 에 올라온 티켓을 검증해 pass → `tickets/done/` + git commit (local), fail → `tickets/reject/` + `## Reject Reason` 기록.

반드시 읽을 파일:

- `agents/verifier-agent.md`
- 대상 티켓 파일 (`tickets/verifier/tickets_NNN.md`)
- 관련 `rules/spec/*`
- `rules/verifier/checklist-template.md`
- `rules/verifier/verification-template.md`

해야 하는 일:

- 호스트 `PROJECT_ROOT` 에서 spec 의 `Verification.Command` 실행 + Acceptance Criteria 관찰
- `tickets/runs/verify_NNN.md` 에 pass/fail 결과 기록
- **Pass**: 티켓을 `tickets/done/` 로 mv + `git add . && git commit -m "[tickets_NNN] <title>"` (local commit)
- **Fail**: 티켓 하단에 `## Reject Reason` 추가 후 `tickets/reject/` 로 mv. commit 하지 않음

하면 안 되는 일:

- 기준 없이 임의 pass
- 검증 기록 없이 티켓 종료
- 코드 수정 (fix 는 todo worker 영역)
- **`git push` 절대 금지**

## Ticket Lifecycle

표준 흐름 (아래 경로는 예시 번호 `001` 을 쓴 형식이며 각 보드가 번호를 직접 발급한다):

```text
rules/spec/project_001.md            (사용자가 start spec 으로 채움)
  → rules/plan/plan_001.md           (planner heartbeat 가 도출 후 Candidates 채움)
  → tickets/todo/tickets_001.md      (start-plan.sh 가 Candidate 당 티켓 생성)
  → tickets/inprogress/tickets_001.md   (todo worker 가 claim + 구현)
  → tickets/verifier/tickets_001.md  (구현 완료 후 verifier 로 mv)
  → tickets/done/tickets_001.md      (pass: git commit + mv)
   ↘ tickets/reject/tickets_001.md   (fail: Reject Reason 기록, planner 가 재계획)
```

규칙:

- `todo`: 아직 시작 전
- `inprogress`: todo worker 가 점유해 구현 중 (claim + 구현 같은 worker)
- `verifier`: 구현 완료, 검증 대기
- `done`: 검증 pass + local commit 완료
- `reject`: 검증 fail + Reject Reason 기록. planner 가 재계획 이후 새 ticket 으로 다시 돌림
- `runs`: pass/fail 기록 파일 (`verify_NNN.md`) — 상태 폴더와 별개

## Required Ticket Fields

모든 티켓은 아래 항목을 유지해야 한다.

- `ID`
- `Title`
- `Stage`
- `Owner`
- `Claimed By`
- `Execution Owner`
- `Verifier Owner`
- `Goal`
- `References`
- `Allowed Paths`
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

- `start spec`
- `start spec 003`
- `start spec project_003`

동작 규칙:

1. `scripts/start-spec.sh` 실행.
2. 번호가 없고 `project_001.md` 가 starter placeholder 면 001 재사용. 아니면 다음 번호.
3. 사용자와 대화해서 Goal / Scope / 관련 파일·모듈 / Acceptance Criteria 를 모은다.
4. `project_{번호}.md` 에만 내용을 쓴다. `rules/plan/` 은 건드리지 않는다.
5. plan 도출은 planner heartbeat 의 다음 tick.
6. 티켓은 만들지 않는다.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Plan Automation Mode` 로 해석한다 (heartbeat 대상).

- `start plan`

동작 규칙 (매 tick):

1. `scripts/start-plan.sh` 실행. 출력 읽기.
2. `reject_count > 0` 이면 각 reject 티켓의 `## Reject Reason` 을 해당 plan 의 새 Candidate 로 추가 + Status = ready 되돌림.
3. `status=idle` / `reason=no_actionable_plan` + populated spec 에 대응 plan 이 없으면 plan 초안 생성 (Candidates 까지 채움, Status=draft). 다음 tick 에서 auto-flip + 티켓 생성.
4. `status=ok` / `generated_count>0` 이면 이미 티켓 생성됨. idle 로 종료.
5. 구현 / 이동 / 검증 / commit / push 금지.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Todo Queue Mode` 로 해석한다 (heartbeat 대상).

- `start todo`

동작 규칙 (매 tick):

1. 먼저 자기 owner 로 배정된 `tickets/inprogress/` 티켓이 있으면 그것부터 이어서 **구현**.
2. 없으면 `scripts/start-todo.sh` 로 새 claim.
3. `Allowed Paths` 범위 안에서 Goal 구현 (한 tick 에 끝내지 못하면 Resume Context 남기고 다음 tick 에 이어감).
4. `Done When` 충족되면 `Notes`, `Result.Summary`, `Verification: pending` 갱신 후 티켓을 `tickets/verifier/` 로 mv.
5. 다른 티켓 생성 / 검증 / commit / push 금지.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Verification Mode` 로 해석한다 (heartbeat 대상).

- `start verifier`

동작 규칙 (매 tick):

1. `scripts/start-verifier.sh` 실행. `status=idle` 이면 종료.
2. `status=ok` 이면 `verify` / `run` 경로 읽고 host `PROJECT_ROOT` 에서 spec 의 `Verification.Command` + Acceptance Criteria 검사.
3. **Pass**: run 파일에 pass 기록 → 티켓 `Stage=done`, `Result.Summary` 갱신 → 티켓을 `tickets/done/` 로 mv → `git add . && git commit -m "[tickets_NNN] <title>"` (local). **`git push` 절대 금지.**
4. **Fail**: run 파일에 fail 기록 → 티켓 하단에 `## Reject Reason` 섹션 추가 → 티켓을 `tickets/reject/` 로 mv. commit 하지 않음. working tree 변경은 그대로 두고 planner 가 다음 tick 에서 재계획.

## Completion Standard

아래를 만족해야만 `done` 으로 옮길 수 있다.

1. 티켓의 `Done When` 항목이 충족되었다.
2. `rules/verifier/` 기준으로 검증했다.
3. 검증 기록이 `tickets/runs/` 에 있다.
4. 티켓의 `Verification` 항목에 그 기록이 연결되어 있다.
5. 티켓의 `Result` 가 채워져 있다.

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
