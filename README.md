# Autoflow

`Autoflow` 는 공개 배포 가능한 `repo template + installer CLI` 방식의 로컬 AI 작업 보드 스캐폴드다.

핵심 목표는 이것이다.

- 실제 프로젝트 안에 `autoflow/` 보드를 생성한다.
- 보드 상태는 프로젝트 로컬 파일로 남긴다.
- 설치는 공개 저장소의 CLI/스크립트로 수행한다.

예를 들어 `tetris` 프로젝트에 적용하면 목표 구조는 아래와 같다.

```text
tetris/
  AGENTS.md
  autoflow/
    AGENTS.md
    README.md
    agents/
    automations/
    rules/
    scripts/
    tickets/
      runs/
  src/
  public/
  package.json
```

여기서 `autoflow/docs/` 는 필요하면 나중에 직접 추가하는 선택 폴더다.
프로젝트별 온보딩 메모나 테스트 명령 모음은 둘 수 있지만, canonical 규칙은 계속 `rules/` 아래에 둔다.

## Distribution Model

현재 기준의 1순위 배포 방식은 플러그인이 아니라 아래 조합이다.

- 공개 Git 저장소
- 설치용 CLI 엔트리포인트
- 로컬 프로젝트에 생성되는 `autoflow/` 보드

이 방식의 장점:

- 공개 배포가 쉽다.
- 프로젝트 상태가 Git 에 남는다.
- 특정 Codex 워크스페이스 기능에 묶이지 않는다.
- 팀/개인 모두 동일한 설치 흐름을 쓸 수 있다.

## 핵심 개념

- `PROJECT_ROOT`: 실제 제품 코드를 두는 호스트 프로젝트 루트
- `BOARD_ROOT`: `PROJECT_ROOT/autoflow`

이 스캐폴드에서는 아래 원칙을 쓴다.

- 보드 문서와 실행 기록은 `BOARD_ROOT` 아래에 둔다.
- 실제 제품 코드는 `PROJECT_ROOT` 에 둔다.
- 티켓의 `Allowed Paths` 는 항상 `PROJECT_ROOT` 기준으로 적는다.
- `rules/`, `tickets/` 참조는 `BOARD_ROOT` 기준으로 적는다.
- 검증 규칙과 템플릿은 `rules/verifier/` 아래에 둔다.

## Canonical Flow

```text
PROJECT_ROOT
  -> autoflow/rules/spec
  -> autoflow/rules/plan
  -> autoflow/automations
  -> autoflow/tickets/todo
  -> autoflow/tickets/inprogress
  -> autoflow/rules/verifier
  -> autoflow/tickets/runs
  -> autoflow/tickets/done
```

## When This Fits

아래 같은 상황이면 이 구조가 잘 맞는다.

- `tetris` 같은 실제 프로젝트 안에 AI 운영 보드를 같이 두고 싶을 때
- 여러 Codex 스레드나 heartbeat worker 가 병렬로 티켓을 나눠 처리할 때
- 보드 상태와 제품 코드를 물리적으로 분리하고 싶을 때
- 사람이 `autoflow/` 폴더만 열어도 현재 흐름을 빠르게 이해해야 할 때

## Install

현재 공개 설치용 엔트리포인트는 아래다.

```bash
./bin/autoflow init /path/to/project
```

현재 디렉터리 프로젝트에 바로 설치하려면:

```bash
./bin/autoflow init .
```

기본 보드 폴더 이름은 `autoflow` 이다.

다른 이름을 시험하고 싶으면:

```bash
./bin/autoflow init /path/to/project my-board
```

이미 보드가 있는 프로젝트에서 다시 실행하면 기존 보드 상태는 덮어쓰지 않는다.

## CLI

현재 구현된 공개 CLI 명령:

- `autoflow init [project-root] [board-dir-name]`
- `autoflow render-heartbeats [project-root] [board-dir-name]`
- `autoflow status [project-root] [board-dir-name]`
- `autoflow doctor [project-root] [board-dir-name]`
- `autoflow upgrade [project-root] [board-dir-name]`

현재 보드가 제공하는 로컬 작업 흐름:

- `start plan`
- `start todo`
- `start`
- `start verifier`

즉:

- `Autoflow` CLI 는 설치와 배포 진입점을 제공한다.
- `render-heartbeats`, `status`, `doctor`, `upgrade` 는 현재 보드 상태를 AI 친화적인 `key=value` 출력과 안전한 갱신 계약으로 다룬다.
- 생성된 로컬 보드는 작업 보드 흐름을 제공한다.

권장 시작 순서는 아래와 같다.

1. `autoflow init` 으로 보드를 만든다.
2. `autoflow status` 와 `autoflow doctor` 로 초기 상태를 확인한다.
3. 생성된 `automations/heartbeat-set.toml` 에 thread id 와 worker topology 를 맞춘다.
4. `autoflow render-heartbeats` 로 role별 heartbeat TOML 묶음을 만든다.
5. 렌더된 결과를 Codex heartbeat 자동화로 등록하고, 보드 안에서는 `start plan`, `start todo`, `start`, `start verifier` 흐름을 쓴다.

## Branding

현재 브랜드 전략은 아래와 같다.

- 제품/배포 이름: `Autoflow`
- 로컬 보드 폴더: `autoflow/`
- 현재 보드 명령 예시: `init autoflow`, `start plan` 등 기존 흐름 유지

즉 브랜드는 `Autoflow` 로 가져가되, 실제 프로젝트 경로는 당분간 `autoflow/` 으로 유지한다.

## Public Package Layout

```text
autoflow/
  bin/
    autoflow
  templates/
    board/
    host/
  rules/
  scripts/
  tickets/
```

`bin/autoflow` 는 설치 엔트리포인트이고, 실제로 프로젝트 안에 생성되는 상태 파일은 `autoflow/` 아래에 남는다.

생성 대상은 현재 저장소 전체가 아니라 `templates/board/`, `templates/host-AGENTS.md`, 그리고 선택된 runtime 문서/스크립트다.
즉 새 프로젝트에는 이 저장소의 내부 plan, 샘플 ticket, 플러그인 실험 파일이 들어가지 않는다.

생성된 보드에는 `.autoflow-version` 이 기록되고, `status` 와 `doctor` 는 이 값을 패키지 버전과 비교한다.

## Script Hooks

생성된 `autoflow/scripts/` 의 훅은 보드 상태 전환을 맡는다.

- `start-plan.sh`
- `start-todo.sh`
- `start.sh`
- `start-verifier.sh`

이 스크립트들은 결정적인 파일 이동과 상태 갱신을 맡고, 실제 구현 판단은 에이전트가 이어받는다.

자동화 철학은 `/Users/demoon/Documents/project/mySkills/skills/autopilot/SKILL.md` 처럼 "남은 일이 있는데 너무 일찍 멈추지 않게 하기"에 가깝다.
다만 현재 `Autoflow` 는 단일 작업 계획 파일 대신 보드 파일을 source of truth 로 쓰고, Codex 자동화는 필요할 때 1분 heartbeat 형태의 wake-up 계층으로 붙이되 각 heartbeat 는 `todo`, `execution`, `verifier` 중 자기 역할만 수행하는 쪽을 기준으로 한다.

역할 분리형 운영에서는 아래 환경 변수를 쓰는 편이 좋다.

- `AUTOFLOW_ROLE`
- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_EXECUTION_POOL`
- `AUTOFLOW_VERIFIER_POOL`
- `AUTOFLOW_BACKGROUND`

예:

- todo worker: `AUTOFLOW_ROLE=todo`, `AUTOFLOW_WORKER_ID=todo-1`, `AUTOFLOW_BACKGROUND=1`
- execution worker: `AUTOFLOW_ROLE=execution`, `AUTOFLOW_WORKER_ID=exec-1`, `AUTOFLOW_BACKGROUND=1`
- verifier worker: `AUTOFLOW_ROLE=verifier`, `AUTOFLOW_WORKER_ID=verify-1`, `AUTOFLOW_BACKGROUND=1`

pool 예시는 숫자가 고정이 아니다.

- execution 2개:
  - `AUTOFLOW_EXECUTION_POOL=exec-1,exec-2`
- execution 4개:
  - `AUTOFLOW_EXECUTION_POOL=exec-1,exec-2,exec-3,exec-4`
- execution 10개:
  - `AUTOFLOW_EXECUTION_POOL=exec-1,exec-2,exec-3,exec-4,exec-5,exec-6,exec-7,exec-8,exec-9,exec-10`

- verifier 1개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1`
- verifier 3개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1,verify-2,verify-3`

`start todo` 는 이제 `점유 + 이동 + owner 배정` 만 하고 구현은 시작하지 않는다. 실제 구현은 `start`, 검증은 `start verifier` 가 맡는다.

24시간 heartbeat 운영에서는 `AUTOFLOW_BACKGROUND=1` 을 주는 편이 좋다. 이 모드에서는 "할 일 없음" 이 실패가 아니라 `status=idle` 로 출력되어 자동화가 조용히 다음 wake-up 을 기다린다.

또한 todo worker 는 execution pool 이 이미 꽉 찼으면 새 티켓을 claim 하지 않는다. 즉 execution 슬롯이 비었을 때만 todo 가 `todo -> inprogress` 를 진행한다.

즉 이 구조는 6개 전용이 아니다.
`planner P / todo K / execution N / verifier M` 형태로 worker 수를 가변 운영하는 쪽이 기준이다.

실제 Codex heartbeat 세트를 만들 때는 생성된 보드의 `automations/heartbeat-set.toml` 을 먼저 채우고, 그다음 `autoflow render-heartbeats` 를 실행하면 된다. 렌더 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

## Upgrade Contract

`autoflow upgrade` 는 다음을 갱신한다.

- 공용 runtime 스크립트
- 공용 템플릿
- 보드 운영용 README/agent 문서
- 호스트 루트 `AGENTS.md`
- `.autoflow-version`

아래는 보존한다 (경로는 모두 생성된 `BOARD_ROOT/` 기준이며, 이 루트 패키지 소스에는 해당 파일들이 없다).

- `rules/spec/project_001.md`
- `rules/plan/plan_001.md`
- `rules/plan/roadmap.md`
- `tickets/*/tickets_*.md`
- `tickets/runs/verify_*.md`

업그레이드 중 변경되는 공용 파일이 이미 수정되어 있으면, 이전 내용은 `BOARD_ROOT/.autoflow-upgrade-backups/<timestamp>/` 아래에 백업한다.

## Path Rules

예 (아래는 generated board 안에서 티켓이 쓰는 경로 형식이다. 이 루트 패키지 소스에는 이 파일들이 없다):

- 보드 문서 참조: `rules/spec/project_001.md`
- plan 참조: `rules/plan/plan_001.md`
- 검증 기록 참조: `tickets/runs/verify_001.md`
- 실제 작업 허용 경로: `src/`, `public/`, `package.json`

즉:

- `References` 는 `BOARD_ROOT` 상대 경로
- `Allowed Paths` 는 `PROJECT_ROOT` 상대 경로

## 이 구조가 하려는 것

- 공개 저장소 형태로 쉽게 배포하기
- 실제 프로젝트 안에 삽입 가능한 하네스 sidecar 만들기
- 보드와 제품 코드를 물리적으로 분리하기
- 에이전트가 `autoflow/` 보드만 읽어도 현재 흐름을 이해하게 하기
- 실제 코드 수정 범위는 `Allowed Paths` 로 좁히기
- 여러 대화창이 동시에 `start todo` 를 실행해도 서로 다른 티켓을 점유하게 하기
- 대화창이 멈췄다가 다시 시작되어도 `tickets/inprogress/` 기준으로 재개하게 하기
- 검증 기준과 검증 결과를 분리하기
- execution / verifier worker 가 자기 배정 티켓만 고르게 하기

## 가장 중요한 규칙

- 티켓 파일 이름은 `tickets_001.md` 처럼 번호 기반으로 만든다.
- 한 티켓은 한 번에 한 상태 폴더에만 존재한다.
- `done/` 으로 옮기기 전에 검증 기록이 `tickets/runs/` 에 있어야 한다.
- 티켓을 만들기 전에 관련 계획 항목이 `rules/plan/` 에 있어야 한다.
- 티켓 생성 전에는 실제 `rules/spec/*.md` 가 있어야 한다.
- `Allowed Paths` 는 항상 `PROJECT_ROOT` 기준으로 적는다.
- `start plan`, `start todo`, `start`, `start verifier` 는 서로 다른 역할을 섞지 않는다.
- `start todo` 는 단순 이동 훅이 아니라 `점유 + 이동 + owner 배정` 훅이다.
- `start` 는 `inprogress/` 의 작업 재개 훅이다.
- `inprogress/` 티켓에는 항상 재개 가능한 상태 요약이 남아 있어야 한다.
- 24시간 자동화에서는 "할 일 없음" 이 정상 상태일 수 있으므로 background worker 는 idle 종료를 사용한다.
