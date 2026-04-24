# Scripts

이 폴더는 두 종류의 스크립트를 담는다.

- `cli/`: 패키지 CLI 측 스크립트. `bin/autoflow` 가 직접 호출한다. 생성 보드에는 복사되지 않는다.
- `runtime/`: 생성 보드의 `autoflow/scripts/` 로 복사되는 runtime 훅. 보드 쪽 경로는 계속 flat 하다 (`autoflow/scripts/start-*.sh`).

## cli/

- `cli-common.sh`
- `package-board-common.sh`
- `invoke-cli-sh.ps1`
- `scaffold-project.sh`
- `scaffold-project.ps1`
- `render-heartbeats.sh`
- `render-heartbeats.ps1`
- `status-project.sh`
- `status-project.ps1`
- `doctor-project.sh`
- `doctor-project.ps1`
- `upgrade-project.sh`
- `upgrade-project.ps1`
- `watch-project.ps1`

## runtime/

- `common.sh`
- `check-stop.sh`
- `set-thread-context.sh`
- `clear-thread-context.sh`
- `start-plan.sh`
- `start-spec.sh`
- `start-todo.sh`
- `handoff-todo.sh`
- `start-verifier.sh`
- `integrate-worktree.sh`
- `write-verifier-log.sh`
- `invoke-runtime-sh.ps1`
- `check-stop.ps1`
- `codex-stop-hook.ps1`
- `set-thread-context.ps1`
- `clear-thread-context.ps1`
- `start-spec.ps1`
- `start-plan.ps1`
- `start-todo.ps1`
- `handoff-todo.ps1`
- `start-verifier.ps1`
- `integrate-worktree.ps1`
- `write-verifier-log.ps1`
- `run-hook.ps1`
- `watch-board.ps1`

## Root Resolution

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 `autoflow/` 폴더
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOFLOW_PROJECT_ROOT` 환경 변수
2. `autoflow/.project-root`
3. `BOARD_ROOT` 의 부모 폴더

권장 설치 위치는 항상 `PROJECT_ROOT/autoflow/` 이다.

## Windows CLI Entry Points

Windows 에서는 top-level CLI 도 `.ps1` 진입점을 쓴다.

- `bin/autoflow.ps1`
  - `init`, `status`, `doctor`, `upgrade`, `render-heartbeats` 를 각 `scripts/cli/*.ps1` wrapper 로 dispatch 한다.
  - `watch`, `watch-bg`, `watch-stop` 는 `watch-project.ps1` 를 직접 실행한다.
- `scripts/cli/*.ps1`
  - shell 구현을 그대로 재사용하는 Windows wrapper 다.
  - 내부적으로 같은 이름의 `.sh` 를 호출하므로 Git Bash 또는 WSL 의 `bash` 는 여전히 필요하다.

## Hook Scripts

Windows 에서는 `.ps1` 래퍼를 우선 실행한다. `.ps1` 래퍼는 경로와 `AUTOFLOW_*` 환경 변수를 안전하게 변환한 뒤 같은 이름의 `.sh` 런타임을 호출한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

- `start-plan.sh`
  - populated spec 를 참조하는 `tickets/plan/plan_{번호}.md` 를 읽고 `tickets/todo/` 티켓 초안을 만든다.
  - 생성되는 plan / ticket 에 `## Obsidian Links` 섹션을 채워 `project / plan / ticket` note 가 이어지게 한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 ready plan 이 없을 때 `status=idle` 로 끝난다.

- `check-stop.sh`
  - stop hook 으로 연결할 수 있는 runtime guard 다.
  - 현재 thread context 를 읽어 plan / todo / verifier 역할에 남은 work 가 있으면 stop 을 block 하는 JSON 을 출력한다.
  - todo / verifier 역할에서는 block 여부를 계산한 뒤 active ticket context 를 비워 다음 tick 이 보드 파일에서 다시 읽게 한다.
  - hook 내부 오류는 fail-open 으로 처리해 Codex UI 에 `Stop hook failed` 를 띄우지 않는다.

- `codex-stop-hook.ps1`
  - Codex 전역 Stop hook 에 연결하는 Autoflow dispatcher 다.
  - `CODEX_PROJECT_DIR` 또는 현재 작업 폴더에서 `autoflow/scripts/check-stop.ps1` 를 찾아 실행한다.
  - 보드가 없거나 훅 실행 중 예외가 나면 진단 로그만 남기고 조용히 통과한다.

- `set-thread-context.sh`
  - 현재 thread 의 역할과 worker id 를 `automations/state/threads/` 아래에 기록한다.
  - 선택적으로 `active_ticket_id`, `active_stage`, `active_ticket_path` 도 같이 기록한다.
  - runtime `start-plan.sh`, `start-todo.sh`, `start-verifier.sh` 가 현재 role 문맥을 자동으로 갱신할 때도 사용한다.

- `clear-thread-context.sh`
  - 기본값은 현재 thread 의 stop-hook context 전체를 지운다.
  - `--active-only` 를 주면 역할 문맥은 유지하고 현재 티켓 문맥만 비운다.
  - todo 가 verifier 로 handoff 될 때는 `handoff-todo.*` 가 이 active-only 모드를 대신 호출하고, 사용자가 `멈춰` 라고 했을 때만 전체 clear 를 쓴다.

- `start-spec.sh`
  - 다음 spec 번호와 저장 대상 경로를 정한다.
  - 사용자 확정 전에는 state 폴더에 placeholder 파일을 만들지 않는다.
  - 실제 내용 저장은 spec author 대화가 사용자 명시 허락을 받은 뒤에만 한다.

- `start-todo.sh`
  - `tickets/todo/` 에서 티켓 하나를 점유해서 `tickets/inprogress/` 로 옮긴다.
  - `Claimed By`, `Execution Owner`, `Verifier Owner` 를 기록한다.
  - git 저장소에서는 티켓별 worktree / branch 를 만들고 `implementation_root` 를 출력한다.
  - 현재 worker 의 thread context 에 role=todo 와 active ticket 정보도 기록한다.
  - 같은 worker 가 구현을 이어서 진행할 수 있도록 재개 컨텍스트를 남긴다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 파일이 `tickets/todo/` 또는 `tickets/inprogress/` 에 있으면 todo worker 가 구현을 진행한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 todo 가 없거나 execution pool 이 꽉 찼을 때 `status=idle` 로 끝난다.

- `handoff-todo.sh`
  - todo 구현이 끝난 `tickets/inprogress/tickets_NNN.md` 를 `tickets/verifier/` 로 넘긴다.
  - `Verification: pending`, `Resume Context`, `Next Action`, `Last Updated` 를 갱신한다.
  - 이동 뒤 active runtime context 를 비우고 todo role context 는 유지한다.

- `start-verifier.sh`
- `tickets/verifier/` 티켓의 검증 대상을 고르고 `tickets/inprogress/verify_NNN.md` 검증 파일을 준비한다. 검증 완료 후 이 기록은 final ticket 옆으로 이동한다.
  - 검증 실행 루트인 `working_root` 와 pass 시 실행할 `integration_command` 를 출력한다.
  - pass 경로는 `tickets/done/<project-key>/tickets_NNN.md` 형태로 계산한다.
  - 현재 worker 의 thread context 에 role=verifier 와 active ticket 정보도 기록한다.
  - `AUTOFLOW_ROLE=verifier` 이면 자기 verifier 티켓을 우선 선택한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 자기 검증 티켓이 없을 때 `status=idle` 로 끝난다.

- `integrate-worktree.sh`
  - verifier pass 경로에서만 실행한다.
  - ticket worktree 의 `Allowed Paths` 변경을 스냅샷 커밋한 뒤 중앙 `PROJECT_ROOT` 에 `--no-commit` cherry-pick 으로 통합한다.
  - 중앙 프로젝트 루트에 board 밖 dirty file 이 있으면 통합을 막아 다른 티켓 변경이 한 커밋에 섞이지 않게 한다.

- `write-verifier-log.sh`
  - verifier 완료 후 `logs/verifier_*.md` completion log 를 남긴다.
  - log 에도 `project / plan / ticket / verify` note 연결을 남긴다.
  - pass / fail log 작성 뒤 active runtime context 를 비워 다음 tick 이 보드 파일과 Obsidian links 로 재개하게 한다.

- `invoke-runtime-sh.ps1`
  - Windows PowerShell 공통 래퍼다.
  - `start-*.ps1`, `integrate-worktree.ps1`, `write-verifier-log.ps1` 가 이 파일을 통해 기존 `.sh` 런타임을 호출한다.

- `start-spec.ps1`, `start-plan.ps1`, `start-todo.ps1`, `handoff-todo.ps1`, `start-verifier.ps1`
  - Windows 에서 직접 실행하는 role별 진입점이다.
  - 예: `powershell -ExecutionPolicy Bypass -File .\scripts\start-todo.ps1 001`

- `integrate-worktree.ps1`, `write-verifier-log.ps1`
  - verifier pass/fail 후속 작업을 Windows 에서 직접 실행하는 래퍼다.

- `run-hook.ps1`
  - file-watch watcher 가 route별 hook 을 dispatch 할 때 쓰는 단발 실행기다.
  - 현재 기본값은 세 route 모두 `codex exec` dispatch 다.

- `watch-board.ps1`
  - `tickets/backlog/`, `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더, `tickets/todo/`, `tickets/verifier/` 를 감시한다.
  - 파일 이벤트가 오면 debounce 후 route별 hook 을 한 번 dispatch 한다.
  - 설정은 `automations/file-watch.psd1`, 로그는 `logs/hooks/` 를 쓴다.

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

- `watch-board.ps1` (generated board runtime)
  - heartbeat 대신 file event 기반 hook 처리 루프를 돌릴 때 쓴다.

- `doctor-project.sh`
  - 대상 프로젝트의 보드 구조를 검사하고 실패 시 non-zero 로 종료한다.

- `upgrade-project.sh`
  - 공용 runtime/template 자산을 최신 패키지 기준으로 갱신한다.
  - 변경되는 관리 파일은 덮어쓰기 전에 백업한다.

- `watch-project.ps1`
  - 대상 프로젝트의 생성된 보드 `scripts/watch-board.ps1` 를 실행한다.
  - Windows 에서 `./bin/autoflow.ps1 watch <project-root>` helper 로 foreground 실행할 수 있다.
  - 창 없는 운영은 `./bin/autoflow.ps1 watch-bg <project-root>` 로 시작하고 `./bin/autoflow.ps1 watch-stop <project-root>` 으로 멈춘다.

## Notes

- 이 스크립트들은 결정적인 보드 상태 전환을 맡는다.
- 실제 구현 내용 자체는 여전히 에이전트가 수행한다.
- 여러 대화창에서 동시에 실행될 수 있으므로 `start-todo.sh` 는 `mv` 기반 점유를 사용한다.
- 역할 분리형 운영에서는 `AUTOFLOW_ROLE`, `AUTOFLOW_WORKER_ID`, `AUTOFLOW_EXECUTION_POOL`, `AUTOFLOW_VERIFIER_POOL` 을 같이 쓰는 편이 좋다.
- 24시간 자동화에서는 `AUTOFLOW_BACKGROUND=1` 과 `AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=1` 조합이 기본값으로 적합하다.
- pool 값은 worker 수에 맞춰 자유롭게 늘리거나 줄일 수 있다. 예를 들어 todo worker 가 10개면 `AUTOFLOW_EXECUTION_POOL` 에 10개 id 를 넣으면 된다.
- 실제 Codex heartbeat payload template 은 `automations/templates/` 에 있고, 생성된 보드에도 같이 복사된다.
- stop hook 을 쓰려면 현재 thread role 을 먼저 `set-thread-context.*` 로 등록하고, Codex 전역 hook 은 `codex-stop-hook.ps1` 를 연결한다. 보드 내부 판정은 `check-stop.sh` / `check-stop.ps1` 가 담당한다.
- todo / verifier tick 이 끝날 때마다 active ticket context 만 비워 토큰 사용을 줄인다. role / worker context 는 유지하므로 Stop hook 과 heartbeat 연속성은 유지된다.
