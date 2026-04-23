# Scripts

이 폴더는 두 종류의 스크립트를 담는다.

- `cli/`: 패키지 CLI 측 스크립트. `bin/autoflow` 가 직접 호출한다. 생성 보드에는 복사되지 않는다.
- `runtime/`: 생성 보드의 `autopilot/scripts/` 로 복사되는 runtime 훅. 보드 쪽 경로는 계속 flat 하다 (`autopilot/scripts/start-*.sh`).

## cli/

- `cli-common.sh`
- `package-board-common.sh`
- `scaffold-project.sh`
- `render-heartbeats.sh`
- `status-project.sh`
- `doctor-project.sh`
- `upgrade-project.sh`

## runtime/

- `common.sh`
- `start-plan.sh`
- `start-todo.sh`
- `start.sh`
- `start-verifier.sh`

## Root Resolution

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 `autopilot/` 폴더
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOPILOT_PROJECT_ROOT` 환경 변수
2. `autopilot/.project-root`
3. `BOARD_ROOT` 의 부모 폴더

권장 설치 위치는 항상 `PROJECT_ROOT/autopilot/` 이다.

## Hook Scripts

- `start-plan.sh`
  - `rules/plan/plan_{번호}.md` 를 읽고 `tickets/todo/` 티켓 초안을 만든다.
  - `AUTOFLOW_BACKGROUND=1` 이면 ready plan 이 없을 때 `status=idle` 로 끝난다.

- `start-todo.sh`
  - `tickets/todo/` 에서 티켓 하나를 점유해서 `tickets/inprogress/` 로 옮긴다.
  - `Claimed By`, `Execution Owner`, `Verifier Owner` 를 기록한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 todo 가 없거나 execution pool 이 꽉 찼을 때 `status=idle` 로 끝난다.

- `start.sh`
  - `tickets/inprogress/` 티켓을 재개할 대상을 선택하고 재개 컨텍스트를 출력한다.
  - `AUTOFLOW_ROLE=execution` 이면 자기 배정 티켓만 선택한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 자기 티켓이 없을 때 `status=idle` 로 끝난다.

- `start-verifier.sh`
  - `tickets/inprogress/` 티켓의 검증 대상을 고르고 `tickets/runs/` 검증 파일을 준비한다.
  - `AUTOFLOW_ROLE=verifier` 이면 자기 배정 `ready_for_verification` 티켓만 선택한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 자기 검증 티켓이 없을 때 `status=idle` 로 끝난다.

## Bootstrap Script

- `scaffold-project.sh`
  - `templates/board/` 와 선택된 runtime 파일만 대상 프로젝트에 생성한다.
  - 대상 프로젝트 루트의 `AGENTS.md` 부트스트랩도 함께 만든다.
  - 이미 보드가 있는 프로젝트에서는 상태 파일을 덮어쓰지 않는다.

- `status-project.sh`
  - 대상 프로젝트의 보드 상태를 `key=value` 형식으로 요약한다.

- `render-heartbeats.sh`
  - `automations/heartbeat-set.toml` 을 읽어 role별 heartbeat TOML 파일 묶음을 렌더한다.
  - 출력 위치는 `BOARD_ROOT/automations/rendered/<set-name>/` 이다.

- `doctor-project.sh`
  - 대상 프로젝트의 보드 구조를 검사하고 실패 시 non-zero 로 종료한다.

- `upgrade-project.sh`
  - 공용 runtime/template 자산을 최신 패키지 기준으로 갱신한다.
  - 변경되는 관리 파일은 덮어쓰기 전에 백업한다.

## Notes

- 이 스크립트들은 결정적인 보드 상태 전환을 맡는다.
- 실제 구현 내용 자체는 여전히 에이전트가 수행한다.
- 여러 대화창에서 동시에 실행될 수 있으므로 `start-todo.sh` 는 `mv` 기반 점유를 사용한다.
- 역할 분리형 운영에서는 `AUTOFLOW_ROLE`, `AUTOFLOW_WORKER_ID`, `AUTOFLOW_EXECUTION_POOL`, `AUTOFLOW_VERIFIER_POOL` 을 같이 쓰는 편이 좋다.
- 24시간 자동화에서는 `AUTOFLOW_BACKGROUND=1` 과 `AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=1` 조합이 기본값으로 적합하다.
- pool 값은 worker 수에 맞춰 자유롭게 늘리거나 줄일 수 있다. 예를 들어 execution worker 가 10개면 `AUTOFLOW_EXECUTION_POOL` 에 10개 id 를 넣으면 된다.
- 실제 Codex heartbeat payload template 은 `automations/templates/` 에 있고, 생성된 보드에도 같이 복사된다.
