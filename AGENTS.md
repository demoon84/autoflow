# AGENTS.md

이 저장소의 목적은 `문서 기반 AI 작업 하네스 보드`를 `PROJECT_ROOT/autopilot/` 형태로 삽입하기 위한 sidecar scaffold source 를 운영하는 것이다.

에이전트는 이 저장소에서 임의로 바로 구현부터 시작하지 말고, 아래의 보드 흐름을 따라야 한다.

## Canonical Flow

`PROJECT_ROOT -> autopilot/rules/spec -> autopilot/rules/plan -> autopilot/automations -> autopilot/tickets/todo -> autopilot/tickets/inprogress -> autopilot/rules/verifier -> autopilot/tickets/runs -> autopilot/tickets/done`

의미:

- `PROJECT_ROOT`: 실제 제품 코드 루트
- `autopilot/rules/spec/`: 무엇이 맞는지 정의하는 기준
- `autopilot/rules/plan/`: 어떤 일을 어떤 순서로 티켓화할지 정리
- `autopilot/automations/`: 훅과 폴더별 자동화 역할
- `autopilot/agents/`: 각 훅이 실행할 역할 정의
- `autopilot/tickets/`: 작업 단위와 상태 보드
- `autopilot/rules/verifier/`: 검증 기준과 체크리스트
- `autopilot/tickets/runs/`: 실행과 검증 기록

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
   - 티켓 생성이면 `agents/plan-to-ticket-agent.md`
   - todo 이동이면 `agents/todo-queue-agent.md`
   - 구현이면 `agents/execution-agent.md`
   - 검증이면 `agents/verifier-agent.md`, `rules/verifier/checklist-template.md`, `rules/verifier/verification-template.md`, `tickets/README.md`

## Core Rules

1. 스펙이 없으면 티켓을 만들지 않는다.
2. 계획이 없으면 티켓을 만들지 않는다.
3. 새 티켓은 원칙적으로 `start plan` 훅과 `plan-to-ticket agent` 규칙에 따라 `tickets/todo/` 에서만 생성한다.
4. `start todo` 는 티켓을 `todo` 에서 `inprogress` 로 점유 이동하고 `Claimed By`, `Execution Owner`, `Verifier Owner` 를 기록한다.
5. `start` 는 자기에게 배정된 `inprogress` execution 티켓을 재개한다.
6. `start verifier` 는 검증과 종료 판정만 한다.
7. 같은 번호의 티켓 파일을 여러 상태 폴더에 동시에 두지 않는다.
8. 티켓 작업을 시작할 때는 먼저 파일을 `tickets/inprogress/` 로 이동한다.
9. `inprogress` 티켓에는 `Owner` 가 채워져 있어야 하며, 가능하면 자동화 인스턴스 기준으로 식별할 수 있어야 한다.
10. `inprogress` 티켓에는 `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner` 가 있어야 한다.
11. `inprogress` 티켓에는 `Last Updated`, `Next Action`, `Resume Context` 가 있어야 한다.
12. 여러 대화창이 동시에 `start todo` 를 실행할 수 있으므로, 각 에이전트는 서로 다른 todo 티켓을 점유해야 한다.
13. 대화창이 중단되거나 다시 시작되어도 재개는 항상 `tickets/inprogress/` 를 기준으로 한다.
14. `rules/verifier/` 기준 없이 티켓을 `tickets/done/` 으로 이동하지 않는다.
15. 검증 기록 없이 티켓을 `tickets/done/` 으로 이동하지 않는다.
16. `done` 으로 옮길 때는 `Verification` 과 `Result` 항목을 갱신한다.
17. 티켓은 항상 `tickets_001.md` 형식을 유지한다.
18. 새로운 번호는 현재 존재하는 최대 번호 + 1 을 사용한다.

## Agent Modes

이 저장소에서 에이전트는 보통 아래 넷 중 하나로 동작한다.

### 1. Plan Automation Mode

목적:

- Codex 대화창에서 사용자가 `start plan` 이라고 말했을 때, `rules/plan/plan_{번호}.md` 를 읽고 실행 가능한 세부 티켓을 `tickets/todo/` 로 생성한다.

반드시 읽을 파일:

- `agents/plan-to-ticket-agent.md`
- 대상 `rules/plan/plan_{번호}.md`
- `rules/plan/roadmap.md`
- `tickets/tickets_template.md`

해야 하는 일:

- plan 문서를 실행 가능한 Goal 로 분해
- 기존 티켓과 중복 확인
- 다음 번호 발급
- `tickets/todo/tickets_번호.md` 생성
- 생성한 티켓 번호를 원본 plan 문서에 기록
- 필요하면 plan 문서의 상태를 `ticketed` 또는 동등한 값으로 갱신

하면 안 되는 일:

- 티켓을 `inprogress` 로 이동
- 구현 시작
- 검증 실행
- `done` 판정

### 2. Todo Queue Mode

목적:

- Codex 대화창에서 사용자가 `start todo` 라고 말했을 때, `tickets/todo/` 의 티켓 하나를 점유해서 `tickets/inprogress/` 로 이동하고 execution / verifier 책임자를 기록한다.

반드시 읽을 파일:

- `agents/todo-queue-agent.md`
- 대상 티켓 파일 또는 `tickets/todo/*`

해야 하는 일:

- 번호가 없으면 `tickets/todo/` 의 가장 낮은 번호 티켓부터 처리
- 번호가 있으면 해당 티켓만 처리
- 티켓을 `tickets/inprogress/` 로 이동
- `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner` 작성
- 시작 메모 갱신
- `Last Updated`, `Next Action`, `Resume Context` 작성

하면 안 되는 일:

- 구현 시작
- 검증
- `done` 처리

### 3. Execution Mode

목적:

- Codex 대화창에서 사용자가 `start` 라고 말했을 때, `tickets/inprogress/` 의 execution 티켓을 재개한다.

반드시 읽을 파일:

- `agents/execution-agent.md`
- 대상 티켓 파일
- 참조된 `rules/spec/*`
- 필요하면 `rules/plan/*`

해야 하는 일:

- `Execution Owner` 기준으로 자기 배정 티켓을 우선 선택
- `Allowed Paths` 범위 안에서만 작업
- `Notes`, `Result`, `Last Updated` 갱신
- `Next Action`, `Resume Context` 갱신
- `Verification` 에 pending 상태 표시

하면 안 되는 일:

- 관련 없는 다른 티켓 생성
- 허용 경로 밖 수정
- 검증 없이 `done` 처리
- 검증 실행

### 4. Verification Mode

목적:

- Codex 대화창에서 사용자가 `start verifier` 라고 말했을 때, `ready_for_verification` 상태의 티켓을 점검하고 `tickets/runs/` 에 기록을 남긴다.

반드시 읽을 파일:

- `agents/verifier-agent.md`
- 대상 티켓 파일
- 관련 `rules/spec/*`
- `rules/verifier/checklist-template.md`
- `rules/verifier/verification-template.md`

해야 하는 일:

- 검증 기록 파일 작성 또는 갱신
- blocker / warning 기록
- next fix hint 작성
- 통과 시 티켓을 `done` 으로 이동할 근거 남김

하면 안 되는 일:

- 기준 없이 임의 통과 판정
- 검증 기록 없이 티켓 종료

## Ticket Lifecycle

표준 이동 순서는 아래와 같다.

```text
rules/plan/plan_001.md
  -> tickets/todo/tickets_001.md
  -> tickets/inprogress/tickets_001.md
  -> tickets/done/tickets_001.md
```

규칙:

- `todo`: 아직 시작 전
- `inprogress`: 누군가 맡아서 진행 중이거나, 중단 후 다시 이어야 하는 상태
- `done`: 검증 후 종료

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
- `tickets/done/`

이미 같은 Goal 또는 같은 plan source 를 가진 티켓이 있으면 새로 만들지 않는다.

## Chat Trigger

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Plan Automation Mode` 로 해석한다.

- `start plan`
- `start plan 001`
- `start plan plan_001`

동작 규칙:

1. 번호가 주어지면 해당 `rules/plan/plan_{번호}.md` 를 읽는다.
2. 번호가 없으면 `rules/plan/` 안의 가장 낮은 번호의 `plan_{번호}.md` 중 아직 티켓화되지 않은 plan 을 찾는다.
3. 실행 가능한 세부 항목을 뽑아 `tickets/todo/` 에 새 티켓을 만든다.
4. 생성한 티켓 번호를 원본 plan 파일에 기록한다.
5. 티켓 생성만 하고 구현은 시작하지 않는다.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Todo Queue Mode` 로 해석한다.

- `start todo`
- `start todo 001`
- `start todo tickets_001`

동작 규칙:

1. 번호가 주어지면 해당 `tickets/todo/tickets_번호.md` 를 처리한다.
2. 번호가 없으면 `tickets/todo/` 의 가장 낮은 번호부터 순서대로 처리한다.
3. 티켓을 `tickets/inprogress/` 로 이동한다.
4. `Stage`, `Claimed By`, `Execution Owner`, `Verifier Owner`, `Owner`, `Last Updated`, `Next Action`, `Resume Context` 를 남긴다.
5. 구현은 시작하지 않고 execution owner 에게 인계한다.
6. 여러 대화창이 동시에 실행되면 각자 서로 다른 todo 티켓을 점유한다.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Execution Mode` 로 해석한다.

- `start`
- `start 001`
- `start tickets_001`

동작 규칙:

1. 번호가 주어지면 해당 `tickets/inprogress/tickets_번호.md` 를 처리한다.
2. 번호가 없으면 현재 worker 에 배정된 execution 티켓 중 가장 낮은 번호부터 처리한다. worker 정보가 없으면 가장 낮은 eligible 티켓을 처리한다.
3. 티켓의 `Resume Context` 와 `Next Action` 을 먼저 읽고 재개한다.
4. 티켓은 계속 `inprogress` 에 둔다.
5. 검증은 시작하지 않는다.

Codex 대화창에서 사용자가 아래 문구를 보내면 에이전트는 `Verification Mode` 로 해석한다.

- `start verifier`
- `start verifier 001`
- `start verifier tickets_001`

동작 규칙:

1. 번호가 주어지면 해당 `tickets/inprogress/tickets_번호.md` 를 검사한다.
2. 번호가 없으면 현재 worker 에 배정된 `ready_for_verification` 티켓 중 가장 낮은 번호부터 검사한다. worker 정보가 없으면 가장 낮은 eligible 티켓을 검사한다.
3. `rules/verifier/` 기준으로 검증한다.
4. 검증 기록을 `tickets/runs/` 에 남긴다.
5. 통과 시 `tickets/done/` 으로 이동한다.
6. 실패 시 `tickets/inprogress/` 에 유지하고 blocker 를 기록한다.

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

충돌이 있으면 이 순서로 따른다.
