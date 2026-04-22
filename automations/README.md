# Automations

이 폴더는 `PROJECT_ROOT/autopilot/` 안에서 쓰는 자동화 훅 규칙을 정의한다.

## Reference Model

`/Users/demoon/Documents/project/mySkills/skills/autopilot/SKILL.md` 의 자동화 흐름을 참고한다.

핵심 해석:

- 주기 실행 자체가 목적이 아니다.
- 목표는 에이전트가 `Done When` 과 남은 작업이 있는데도 너무 일찍 멈추지 않게 하는 것이다.
- 자동화는 시간 스케줄보다 `현재 보드 상태` 를 더 우선해야 한다.
- 사용자가 읽거나 승인해야 하는 블록을 막 보여준 턴에는 자동으로 더 진행하지 않는다.

즉 `Autoflow` 에서는 heartbeat 가 있더라도, 그 heartbeat 는 `계속 일할 필요가 있는지 확인하는 wake-up 계층` 으로만 본다.

## Heartbeat Policy

Codex 자동화를 쓴다면 기본 모델은 아래다.

- 자동화 종류:
  - thread heartbeat
- 권장 주기:
  - 1분
- source of truth:
  - `autopilot/` 보드 파일

주의:

- heartbeat 는 작업 큐를 다시 확인하는 용도다.
- heartbeat 자체가 rules/ticket 상태를 대신 저장하지 않는다.
- 보드에 할 일이 없으면 바로 종료하는 것이 맞다.
- 서로 다른 자동화는 각자 자기 역할만 수행해야 한다.

## Hook Map

- `start plan`
  - 대상: `BOARD_ROOT/rules/plan/`
  - 역할: `rules/plan/plan_{번호}.md` 를 읽고 `tickets/todo/` 티켓 생성
  - 스크립트: `scripts/start-plan.sh`

- `start todo`
  - 대상: `BOARD_ROOT/tickets/todo/`
  - 역할: 다음 todo 티켓을 선택해 `tickets/inprogress/` 로 이동하고 execution / verifier 책임자를 기록
  - 스크립트: `scripts/start-todo.sh`

- `start`
  - 대상: `BOARD_ROOT/tickets/inprogress/`
  - 역할: 자기에게 배정된 execution 티켓의 중단된 작업을 재개
  - 스크립트: `scripts/start.sh`

- `start verifier`
  - 대상: `BOARD_ROOT/rules/verifier/` + `BOARD_ROOT/tickets/inprogress/`
  - 역할: `ready_for_verification` 티켓을 verifier 기준으로 검사하고 `BOARD_ROOT/tickets/runs/` 기록 후 `done` 여부 결정
  - 스크립트: `scripts/start-verifier.sh`

## Operating Principle

자동화는 폴더별 책임을 섞지 않는다.

- `start plan` 은 티켓 생성만 한다.
- `start todo` 는 `점유 + 이동 + owner 배정` 만 한다.
- `start` 는 `assigned execution` 작업 재개를 한다.
- `start verifier` 는 검증과 종료 판정만 한다.

스크립트 역할:

- 스크립트는 결정적인 파일 시스템 작업을 먼저 처리한다.
- 실제 구현과 검증은 에이전트가 맡는다.
- `Allowed Paths` 로 표시된 실제 제품 파일은 `PROJECT_ROOT` 기준으로 해석한다.

## Role-Bound Heartbeats

heartbeat 를 붙이더라도 자동화는 역할별로 분리한다.

예:

- todo worker heartbeat
  - 할 일:
    - `tickets/todo/` 만 보고 `start todo` 만 수행
  - 하면 안 되는 일:
    - `start`
    - `start verifier`

- execution worker heartbeat
  - 할 일:
    - `tickets/inprogress/` 만 보고 `start` 만 수행
  - 하면 안 되는 일:
    - 새 todo claim
    - verifier 실행

- verifier worker heartbeat
  - 할 일:
    - `ready_for_verification` 상태의 자기 배정 티켓만 보고 `start verifier` 만 수행
  - 하면 안 되는 일:
    - todo claim
    - 구현 재개

즉 heartbeat 는 "무슨 역할을 할지 고르는 라우터"가 아니라, 이미 정해진 역할을 주기적으로 다시 깨우는 장치다.

## Worker Identity Contract

역할 분리형 운영에서는 아래 환경 변수를 권장한다.

- `AUTOFLOW_ROLE`
  - `plan`
  - `todo`
  - `execution`
  - `verifier`
- `AUTOFLOW_WORKER_ID`
  - 예: `todo-1`, `exec-2`, `verify-1`
- `AUTOFLOW_EXECUTION_POOL`
  - 예: `exec-1,exec-2,exec-3`
- `AUTOFLOW_VERIFIER_POOL`
  - 예: `verify-1,verify-2`
- `AUTOFLOW_BACKGROUND`
  - 예: `1`
- `AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER`
  - 기본값: `1`

권장 방식:

- todo worker 는 `AUTOFLOW_EXECUTION_POOL` 과 `AUTOFLOW_VERIFIER_POOL` 을 보고 새 claim 티켓의 owner 를 배정한다.
- todo worker 는 execution pool 이 꽉 차면 `status=idle` 로 끝내고 새 claim 을 하지 않는다.
- execution worker 는 자기 `AUTOFLOW_WORKER_ID` 와 일치하는 `Execution Owner` 티켓만 잡는다.
- verifier worker 는 자기 `AUTOFLOW_WORKER_ID` 와 일치하는 `Verifier Owner` 티켓만 잡는다.
- 24시간 heartbeat worker 는 `AUTOFLOW_BACKGROUND=1` 로 실행해 "할 일 없음" 을 정상 idle 로 처리한다.

## Recommended Topology

순수 역할 분리 모델에서는 worker 수를 고정하지 않는다.
기본 형태는 아래처럼 읽는다.

- planner P
- todo worker K
- execution worker N
- verifier worker M

즉 `todo` 와 `verifier` 를 분리하면 실제 구현을 맡는 `execution` worker 가 반드시 따로 있어야 한다.
여기서 중요한 것은 숫자 자체가 아니라 역할 분리와 owner affinity 다.

운영 규칙:

- 각 worker 는 고유한 `AUTOFLOW_WORKER_ID` 를 가져야 한다.
- `AUTOFLOW_EXECUTION_POOL` 은 현재 살아 있는 execution worker 전부를 담아야 한다.
- `AUTOFLOW_VERIFIER_POOL` 은 현재 살아 있는 verifier worker 전부를 담아야 한다.
- worker 수가 3개든 4개든 10개든 코드는 pool 에 적힌 id 개수대로 동작한다.

예:

- execution 2개:
  - `AUTOFLOW_EXECUTION_POOL=exec-1,exec-2`
- execution 5개:
  - `AUTOFLOW_EXECUTION_POOL=exec-1,exec-2,exec-3,exec-4,exec-5`
- verifier 3개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1,verify-2,verify-3`

즉 scaling 은 "코드 수정" 이 아니라 "worker 추가 + pool 갱신" 으로 한다.

배치 팁:

- planner 와 todo 는 보통 가볍다.
- 병렬 처리량은 대개 execution 수에서 먼저 결정된다.
- verifier 병목이 보일 때만 verifier 수를 늘리면 된다.

## Thread Coordination Rules

여러 Codex 스레드나 heartbeat worker 가 동시에 돌아도 아래 원칙은 유지한다.

- execution worker 하나는 보통 자기 `inprogress` 티켓 하나에 집중한다.
- 새 티켓을 만들기 전 관련 항목이 `rules/plan/` 에 있는지 먼저 확인한다.
- `start todo` 는 `Claimed By`, `Execution Owner`, `Verifier Owner` 를 남기고 구현은 시작하지 않는다.
- `start` 는 자기 `Execution Owner` 와 일치하는 티켓만 재개한다.
- `start verifier` 는 자기 `Verifier Owner` 와 일치하는 `ready_for_verification` 티켓만 검사한다.
- blocker 가 생겨도 티켓을 다시 `todo/` 로 되돌리기보다 `inprogress/` 에 남기고 메모를 갱신한다.
- 서로 다른 worker 가 같은 파일을 건드려야 하면 티켓을 더 잘게 나누는 편이 낫다.
- verifier 기준 문서와 번호 발급 규칙은 한 곳에서만 관리하는 편이 안전하다.

## Guard Rules

`mySkills` 의 autopilot skill 과 마찬가지로 아래 상황에서는 자동화가 더 진행하지 않는 것이 맞다.

- 사용자가 읽거나 승인해야 할 내용을 막 보여준 턴
- 역할 범위 밖의 작업만 남아 있는 경우
- 보드 상태상 현재 역할이 할 일이 없는 경우

## Non-Goals

현재 이 폴더에는 machine-readable heartbeat template 파일과 project-owned starter set 파일이 들어 있다.
다만 render 결과에서 실제 Codex automation 을 자동 등록하는 로직은 아직 없다.

즉 지금 있는 것은:

- 있음:
  - 트리거와 정책 문서
  - 생성된 보드의 `automations/heartbeat-set.toml`
  - `automations/templates/` 아래 role별 heartbeat TOML template
  - `automations/templates/heartbeat-set.template.toml` 같은 set manifest template
  - `autoflow render-heartbeats` 로 만든 `automations/rendered/<set-name>/` 출력물
- 아직 없음:
  - 실제 Codex automation 등록 스크립트
  - stop hook 스크립트 등록 로직

## Template Files

실제 Codex heartbeat 세트를 만들 때는 아래 순서로 진행한다.

1. 생성된 보드의 `automations/heartbeat-set.toml` 을 현재 thread id 와 worker topology 에 맞게 수정한다.
2. `autoflow render-heartbeats` 를 실행한다.
3. `automations/rendered/<set-name>/` 아래 결과 TOML 을 Codex heartbeat 로 등록한다.

렌더 과정에서 참조하는 파일은 아래와 같다.

- `automations/heartbeat-set.toml`
  - project-owned set manifest
- `automations/templates/heartbeat-set.template.toml`
  - 배포 패키지 쪽 원본 set template
- `automations/templates/plan-heartbeat.template.toml`
  - planner worker heartbeat
- `automations/templates/todo-heartbeat.template.toml`
  - todo claimer heartbeat
- `automations/templates/execution-heartbeat.template.toml`
  - execution worker heartbeat
- `automations/templates/verifier-heartbeat.template.toml`
  - verifier worker heartbeat

이 구조의 의미:

- project-owned set file 은 현재 프로젝트 topology 를 표현한다.
- set template 는 배포 패키지 기준 원본 형태를 표현한다.
- role template 는 실제 automation payload 형식을 표현한다.
- worker 수가 바뀌면 set file 의 배열과 pool 만 바꾸면 된다.

자주 바꾸는 placeholder:

- `{{THREAD_ID}}`
- `{{SET_NAME}}`
- `{{AUTOMATION_ID}}`
- `{{AUTOMATION_NAME}}`
- `{{WORKER_ID}}`
- `{{EXECUTION_POOL}}`
- `{{VERIFIER_POOL}}`
- `{{MAX_EXECUTION_LOAD}}`

주의:

- 이 파일들은 template 이지 자동 등록 스크립트는 아니다.
- 실제 Codex automation id 와 thread id 는 환경마다 다르므로 placeholder 를 채워야 한다.
- prompt 안의 `autopilot/` 경로는 보드 폴더 이름에 맞춰 조정될 수 있다.
