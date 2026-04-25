# Scripts

이 폴더는 두 종류의 스크립트를 담는다.

- `cli/`: 패키지 CLI 측 스크립트. `bin/autoflow` 가 직접 호출한다. 생성 보드에는 복사되지 않는다.
- `runtime/`: 생성 보드의 `autoflow/scripts/` 로 복사되는 runtime 훅. 보드 쪽 경로는 계속 flat 하다 (`autoflow/scripts/start-*.sh`).

## cli/

- `cli-common.sh`
- `cli-common.ps1`
- `invoke-cli-sh.ps1`
- `package-board-common.sh`
- `package-board-common.ps1`
- `scaffold-project.sh`
- `scaffold-project.ps1`
- `render-heartbeats.sh`
- `render-heartbeats.ps1`
- `run-role.sh`
- `run-role.ps1`
- `runners-project.sh`
- `runners-project.ps1`
- `spec-project.sh`
- `spec-project.ps1`
- `wiki-project.sh`
- `wiki-project.ps1`
- `metrics-project.sh`
- `metrics-project.ps1`
- `status-project.sh`
- `status-project.ps1`
- `doctor-project.sh`
- `doctor-project.ps1`
- `upgrade-project.sh`
- `upgrade-project.ps1`
- `stop-hook-project.sh`
- `stop-hook-project.ps1`
- `watch-project.sh`
- `watch-project.ps1`

## runtime/

- `common.sh`
- `runner-common.sh`
- `codex-stop-hook.ps1`
- `check-stop.sh`
- `file-watch-common.sh`
- `install-stop-hook.sh`
- `run-hook.sh`
- `set-thread-context.sh`
- `clear-thread-context.sh`
- `start-ticket-owner.sh`
- `verify-ticket-owner.sh`
- `finish-ticket-owner.sh`
- `start-plan.sh`
- `start-spec.sh`
- `start-todo.sh`
- `handoff-todo.sh`
- `start-verifier.sh`
- `integrate-worktree.sh`
- `write-verifier-log.sh`
- `invoke-runtime-sh.ps1`
- `runner-common.ps1`
- `check-stop.ps1`
- `install-stop-hook.ps1`
- `set-thread-context.ps1`
- `clear-thread-context.ps1`
- `start-ticket-owner.ps1`
- `verify-ticket-owner.ps1`
- `finish-ticket-owner.ps1`
- `start-spec.ps1`
- `start-plan.ps1`
- `start-todo.ps1`
- `handoff-todo.ps1`
- `start-verifier.ps1`
- `integrate-worktree.ps1`
- `write-verifier-log.ps1`
- `run-hook.ps1`
- `watch-board.ps1`
- `watch-board.sh`

## Root Resolution

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 `autoflow/` 폴더
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOFLOW_PROJECT_ROOT` 환경 변수
2. `autoflow/.project-root`
3. `BOARD_ROOT` 의 부모 폴더

권장 설치 위치는 항상 `PROJECT_ROOT/autoflow/` 이다.

## Hook Scripts

Windows 에서는 `.ps1` 래퍼를 우선 실행한다. `.ps1` 래퍼는 경로와 `AUTOFLOW_*` 환경 변수를 안전하게 변환한 뒤 같은 이름의 `.sh` 런타임을 호출한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

- `start-plan.sh`
  - populated spec 를 참조하는 `tickets/plan/plan_{번호}.md` 를 읽고 `tickets/todo/` 티켓 초안을 만든다.
  - 생성되는 plan / ticket 에 `## Obsidian Links` 섹션을 채워 `project / plan / ticket` note 가 이어지게 한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 ready plan 이 없을 때 `status=idle` 로 끝난다.

- `check-stop.sh`
  - stop hook 으로 연결할 수 있는 runtime guard 다.
  - 현재 thread context 를 읽어 ticket-owner / plan / todo / verifier 역할에 남은 work 가 있으면 stop 을 block 하는 JSON 을 출력한다.

- `install-stop-hook.sh`
  - Codex `~/.codex/hooks.json` 에 현재 보드의 `check-stop.*` 를 Stop hook 으로 설치 / 제거 / 상태 확인한다.
  - `install`, `remove`, `status` 액션을 지원한다.
  - 기존 Stop hook 들은 유지하고, 현재 보드 command 만 idempotent 하게 추가 / 제거한다.
  - `AUTOFLOW_CODEX_HOOKS_PATH` 를 주면 테스트용 다른 manifest 경로에도 쓸 수 있다.

- `file-watch-common.sh`
  - `run-hook.sh`, `watch-board.sh` 가 같이 쓰는 file-watch 설정 파서와 debounce / stat helper 를 담는다.

- `set-thread-context.sh`
  - 현재 thread 의 역할과 worker id 를 `automations/state/threads/` 아래에 기록한다.
  - 선택적으로 `active_ticket_id`, `active_stage`, `active_ticket_path` 도 같이 기록한다.
  - runtime `start-ticket-owner.sh`, `start-plan.sh`, `start-todo.sh`, `start-verifier.sh` 가 현재 role 문맥을 자동으로 갱신할 때도 사용한다.

- `clear-thread-context.sh`
  - 기본값은 현재 thread 의 stop-hook context 전체를 지운다.
  - `--active-only` 를 주면 역할 문맥은 유지하고 현재 티켓 문맥만 비운다.
  - todo 가 verifier 로 handoff 될 때는 `handoff-todo.*` 가 이 active-only 모드를 대신 호출하고, 사용자가 `멈춰` 라고 했을 때만 전체 clear 를 쓴다.

- `start-spec.sh`
  - 다음 spec 번호와 저장 대상 경로를 정한다.
  - 사용자 확정 전에는 state 폴더에 placeholder 파일을 만들지 않는다.
  - 실제 내용 저장은 spec author 대화가 사용자 명시 허락을 받은 뒤에만 한다.

- `start-ticket-owner.sh`
  - 기본 Ticket Owner Mode 런타임이다.
  - owner 가 이미 가진 `tickets/inprogress/tickets_NNN.md` 를 우선 재개한다.
  - 없으면 `tickets/todo/` 티켓을 `inprogress/` 로 점유하고, 레거시 `tickets/verifier/` 티켓도 owner 가 이어받을 수 있게 `inprogress/` 로 가져온다.
  - todo 티켓도 없으면 populated backlog spec 을 `tickets/done/<project-key>/` 로 보관하고, 그 spec 에서 바로 `tickets/inprogress/tickets_NNN.md` 를 만든다.
  - 같은 owner 가 mini-plan, 구현, 검증, evidence 기록, done/reject 이동까지 이어서 책임진다. planner / todo / verifier 역할 분리를 요구하지 않는다.
  - git 저장소에서는 티켓별 worktree / branch 를 만들고 `implementation_root`, `run`, `done_target`, `reject_target` 를 출력한다.

- `verify-ticket-owner.sh`
  - Ticket Owner Mode 의 자동 검증 런타임이다.
  - 티켓 또는 참조된 project spec 의 `## Verification` / `Command` 를 읽어 ticket working root 에서 실행한다.
  - `tickets/inprogress/verify_NNN.md` 에 command, stdout/stderr, exit code, evidence 를 기록하고 pass/fail 상태를 출력한다.
  - 예: `./scripts/verify-ticket-owner.sh 001`

- `finish-ticket-owner.sh`
  - Ticket Owner Mode 의 pass/fail 마무리 런타임이다.
  - pass 는 worktree 통합, done 이동, verifier log 작성, active context clear, local git commit 까지 한 번에 처리한다.
  - fail 은 concrete reject reason 을 요구하고, reject 이동과 verifier log 작성만 수행한다. 실패 티켓은 commit 하지 않는다.
  - 예: `./scripts/finish-ticket-owner.sh 001 pass "owner flow completed"`

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
  - `tickets/verifier/` 티켓의 검증 대상을 고르고 `tickets/runs/` 검증 파일을 준비한다.
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

- `runner-common.sh`, `runner-common.ps1`
  - runner config, state, log 경로와 `runners/config.toml` 의 작은 `[[runners]]` subset parser 를 제공한다.
  - `autoflow runners list/add/remove/start/stop/restart/artifacts/set` 이 같은 state/log 계약을 쓰도록 하는 공통 helper 다.

- `start-spec.ps1`, `start-ticket-owner.ps1`, `verify-ticket-owner.ps1`, `finish-ticket-owner.ps1`, `start-plan.ps1`, `start-todo.ps1`, `handoff-todo.ps1`, `start-verifier.ps1`
  - Windows 에서 직접 실행하는 role별 진입점이다.
  - 예: `powershell -ExecutionPolicy Bypass -File .\scripts\start-todo.ps1 001`

- `integrate-worktree.ps1`, `write-verifier-log.ps1`
  - verifier pass/fail 후속 작업을 Windows 에서 직접 실행하는 래퍼다.

- `install-stop-hook.ps1`
  - Windows 에서 현재 보드 `check-stop.ps1` 를 Codex Stop hook 으로 설치 / 제거 / 상태 확인하는 native helper 다.
  - Codex hook manifest (`~/.codex/hooks.json`) 를 현재 보드 command 기준으로 idempotent 하게 갱신한다.

- `codex-stop-hook.ps1`
  - Windows Codex Stop hook dispatcher 다.
  - 현재 프로젝트 또는 상위 경로에서 보드 루트를 찾아 해당 보드의 `check-stop.ps1` 로 위임한다.

- `run-hook.ps1`
  - file-watch watcher 가 route별 hook 을 dispatch 할 때 쓰는 단발 실행기다.
  - 현재 기본값은 `ticket` route 가 `codex exec` 로 Ticket Owner prompt 를 실행하고, legacy `plan` / `todo` / `verifier` route 는 설정을 켰을 때만 동작한다.

- `run-hook.sh`
  - Bash/macOS/Linux 쪽 file-watch watcher 가 route별 one-shot hook 을 dispatch 할 때 쓰는 단발 실행기다.
  - `automations/file-watch.psd1` 를 읽어 `codex exec` 또는 shell runtime dispatch 를 수행한다.

- `watch-board.ps1`
  - 기본값으로 `tickets/backlog/`, `tickets/todo/`, `tickets/verifier/` 를 `ticket` route 로 감시한다. legacy route 를 켜면 `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더도 plan route 로 감시한다.
  - 파일 이벤트가 오면 debounce 후 route별 hook 을 한 번 dispatch 한다.
  - 설정은 `automations/file-watch.psd1`, 로그는 `logs/hooks/` 를 쓴다.

- `watch-board.sh`
  - Bash/macOS/Linux 에서 쓰는 polling watcher 다.
  - 같은 감시 경로를 0.25초 간격으로 스캔해 변화를 감지하고 debounce 후 `run-hook.sh` 를 실행한다.
  - minute heartbeat 와 같이 두면 heartbeat 가 끊겨도 버티고, 상태 전환 직후에는 보통 1~2초 안에 다음 route 를 깨워 59초 대기를 줄인다.

## Bootstrap Script

- `scaffold-project.sh`
  - `templates/board/` 와 선택된 runtime 파일만 대상 프로젝트에 생성한다.
  - 대상 프로젝트 루트의 `AGENTS.md` 부트스트랩도 함께 만든다.
  - 이미 보드가 있는 프로젝트에서는 상태 파일을 덮어쓰지 않는다.

- `status-project.sh`
  - 대상 프로젝트의 보드 상태를 `key=value` 형식으로 요약한다.

- `runners-project.sh`
  - `autoflow runners list/add/remove/start/stop/restart/artifacts/set` 구현체다.
  - runner 의 config, state, log lifecycle 을 다룬다.
  - `add` / `remove` 는 runner pool 을 늘리거나 줄이고, `set` 은 `agent`, `model`, `reasoning`, `mode`, `interval_seconds`, `enabled`, `command` 설정을 갱신한다.
  - `mode=loop` runner 에서 `start` 는 백그라운드 loop worker 를 띄워 `autoflow run` 을 `interval_seconds` 주기로 호출하고, `stop` 은 저장된 PID 를 종료한다.

- `spec-project.sh`
  - `autoflow spec create` 구현체다.
  - stdin 또는 `--from-file` 내용을 `Conversation Handoff` 로 보존해 `tickets/backlog/project_NNN.md` 를 만든다.
  - `--save-handoff` 를 쓰면 같은 내용을 `conversations/project_NNN/spec-handoff.md` 에도 보관한다.
  - `--raw` 는 이미 작성된 markdown spec 을 그대로 저장하고, plan / todo / verifier 상태는 건드리지 않는다.

- `run-role.sh`
  - `autoflow run ticket/planner/todo/verifier/wiki` 구현체다.
  - 기본 `ticket` 실행은 Ticket Owner prompt 를 생성하고, runner 가 `start-ticket-owner` 런타임을 써서 한 티켓을 끝까지 소유하게 한다.
  - `shell` / `manual` runner 로 기존 board runtime (`start-plan`, `start-todo`, `start-verifier`) 또는 `wiki-project.sh update` 를 one-shot 으로 호출하고 runner state/log 를 남긴다.
  - `codex`, `claude`, `opencode`, `gemini` runner 는 role prompt 를 생성해 local CLI adapter 를 호출한다. `--dry-run` 은 prompt 와 command 만 출력한다.
  - adapter prompt, stdout, stderr 와 shell runtime output 은 `runners/logs/` 에 파일로 보관하고 출력에 `*_log_path` 를 남긴다. `shell` / `manual` dry-run 도 preview log 를 남긴다.

- `wiki-project.sh`
  - `autoflow wiki update` 와 `autoflow wiki lint` 구현체다.
  - `update` 는 done tickets, reject records, verifier logs 에서 `wiki/index.md`, `wiki/log.md`, `wiki/project-overview.md` 의 managed section 을 갱신한다.
  - `lint` 는 wiki orphan page 와 completed-work citation gap 을 key=value 로 보고한다.

- `metrics-project.sh`
  - `autoflow metrics` 구현체다.
  - board state 와 verifier logs 에서 spec/ticket/reject/pass-rate/completion-rate 지표를 key=value 로 출력한다.
  - `--write` 는 같은 snapshot 을 `metrics/daily.jsonl` 에 append 한다.

- `render-heartbeats.sh`
  - `automations/heartbeat-set.toml` 을 읽어 role별 heartbeat TOML 파일 묶음을 렌더한다.
  - 출력 위치는 `BOARD_ROOT/automations/rendered/<set-name>/` 이다.

- `watch-board.ps1` (generated board runtime)
  - heartbeat 대신 file event 기반 hook 처리 루프를 돌릴 때 쓴다.

- `doctor-project.sh`
  - 대상 프로젝트의 보드 구조를 검사하고 실패 시 non-zero 로 종료한다.
  - enabled runner 의 adapter 설정을 읽어 Codex / Claude / OpenCode / Gemini CLI 가 PATH 에 없으면 warning 으로 알려준다.
  - `tickets_NNN.md` 가 `todo`, `inprogress`, `verifier`, recursive `done` 중 여러 곳에 동시에 있으면 error 로 보고한다.

- `upgrade-project.sh`
  - 공용 runtime/template 자산을 최신 패키지 기준으로 갱신한다.
  - 변경되는 관리 파일은 덮어쓰기 전에 백업한다.

- `watch-project.ps1`
  - 대상 프로젝트의 생성된 보드 `scripts/watch-board.ps1` 를 실행한다.
  - Windows 에서 `./bin/autoflow.ps1 watch <project-root>` helper 로 foreground 실행할 수 있다.
  - 창 없는 운영은 `./bin/autoflow.ps1 watch-bg <project-root>` 로 시작하고 `./bin/autoflow.ps1 watch-status <project-root>` 로 확인하고 `./bin/autoflow.ps1 watch-stop <project-root>` 으로 멈춘다.

- `watch-project.sh`
  - 대상 프로젝트의 생성된 보드 `scripts/watch-board.sh` 를 실행한다.
  - Bash/macOS/Linux 에서 `./bin/autoflow watch <project-root>` 로 foreground 실행할 수 있다.
  - 백그라운드 운영은 `./bin/autoflow watch-bg <project-root>` 로 시작하고 `./bin/autoflow watch-status <project-root>` 로 확인하고 `./bin/autoflow watch-stop <project-root>` 으로 멈춘다.

- `stop-hook-project.ps1`, `scaffold-project.ps1`, `status-project.ps1`, `doctor-project.ps1`, `render-heartbeats.ps1`, `upgrade-project.ps1`
  - 공개 CLI 의 Windows PowerShell 진입점이다.
  - 네이티브 PowerShell 구현체는 `bin/autoflow.ps1` 가 직접 호출하고, Bash 구현체를 재사용하는 래퍼는 `invoke-cli-sh.ps1` 를 통해 같은 계약으로 포워딩한다.

## Notes

- 이 스크립트들은 결정적인 보드 상태 전환을 맡는다.
- 실제 구현 내용 자체는 여전히 에이전트가 수행한다.
- 여러 대화창에서 동시에 실행될 수 있으므로 `start-todo.sh` 는 `mv` 기반 점유를 사용한다.
- 역할 분리형 운영에서는 `AUTOFLOW_ROLE`, `AUTOFLOW_WORKER_ID`, `AUTOFLOW_EXECUTION_POOL`, `AUTOFLOW_VERIFIER_POOL` 을 같이 쓰는 편이 좋다.
- 24시간 자동화에서는 `AUTOFLOW_BACKGROUND=1` 과 `AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER=1` 조합이 기본값으로 적합하다.
- pool 값은 worker 수에 맞춰 자유롭게 늘리거나 줄일 수 있다. 예를 들어 todo worker 가 10개면 `AUTOFLOW_EXECUTION_POOL` 에 10개 id 를 넣으면 된다.
- 실제 Codex heartbeat payload template 은 `automations/templates/` 에 있고, 생성된 보드에도 같이 복사된다.
- stop hook 을 쓰려면 현재 thread role 을 먼저 `set-thread-context.*` 로 등록하고, hook 본체는 `check-stop.sh` 또는 `check-stop.ps1` 를 연결한다.
- 보드 stop hook wiring 을 자동으로 붙이고 싶으면 `scripts/install-stop-hook.sh install` 또는 Windows 에서 `scripts/install-stop-hook.ps1 install` 을 한 번 실행한다.
- todo 완료 뒤에도 다음 티켓으로 계속 이어갈 수 있게, verifier handoff 시에는 전체 clear 대신 `clear-thread-context.* --active-only` 를 우선한다.
