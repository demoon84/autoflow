# CLI Package

`packages/cli/` 는 Autoflow CLI 구현을 담는다. `bin/autoflow` 가 얇은
엔트리포인트이고, 실제 명령 구현은 이 폴더의 스크립트가 맡는다.

관련 소스 위치:

- `runtime/board-scripts/`: 생성 대상 보드의 `scripts/` 로 복사되는 runtime 훅. 보드 쪽 경로는 계속 flat 하다.
- `integrations/claude/skills/`, `integrations/codex/skills/`: `init` / `upgrade` 시 대상 프로젝트의 `.claude/skills/` 와 `.codex/skills/` 로 설치되는 PRD handoff skill 원본 (`autoflow` / `af`) 과 quick-order handoff skill (`order`).
- `tests/smoke/`: 패키지 개발용 smoke test. 생성 보드에는 복사되지 않는다.

## CLI Files

- `cli-common.sh`
- `package-board-common.sh`
- `scaffold-project.sh`
- `render-heartbeats.sh`
- `run-role.sh`
- `runners-project.sh`
- `spec-project.sh`
- `order-project.sh`
- `wiki-project.sh`
- `metrics-project.sh`
- `status-project.sh`
- `coordinator-project.sh`
- `doctor-project.sh`
- `upgrade-project.sh`
- `stop-hook-project.sh`
- `watch-project.sh`

## Runtime Source Copied Into Boards

아래 파일들은 `runtime/board-scripts/` 아래에 있으며, 설치 시 대상 보드의 `scripts/` 로 복사된다.

- `common.sh`
- `runner-common.sh`
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
- `watch-board.sh`

## ../tests/smoke/

- `ticket-owner-smoke.sh`
  - temp git 프로젝트에 보드를 설치하고 raw spec → `start-ticket-owner` → `verify-ticket-owner` → `finish-ticket-owner pass` → status 확인까지 실행한다.
  - 루트에서 `npm run smoke:ticket-owner` 로 실행한다.

## Root Resolution

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 설치된 Autoflow 보드 폴더. 기본값은 `scaffold/manifest.toml` 의 `.autoflow/` 이지만 CLI 인자로 바꿀 수 있다.
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOFLOW_PROJECT_ROOT` 환경 변수
2. `BOARD_ROOT/.project-root`
3. `BOARD_ROOT` 의 부모 폴더

권장 기본 설치 위치는 `PROJECT_ROOT/.autoflow/` 이지만, 이 이름은 소스 폴더명이 아니라 설치 설정값이다.

## Hook Scripts

- `start-plan.sh`
  - populated spec 를 참조하는 `tickets/plan/plan_{번호}.md` 를 읽고 `tickets/todo/` 티켓 초안을 만든다.
  - 생성되는 plan / ticket 에 `## Obsidian Links` 섹션을 채워 `project / plan / ticket` note 가 이어지게 한다.
  - `AUTOFLOW_BACKGROUND=1` 이면 ready plan 이 없을 때 `status=idle` 로 끝난다.

- `check-stop.sh`
  - stop hook 으로 연결할 수 있는 runtime guard 다.
  - 현재 thread context 를 읽어 ticket-owner / plan / todo / verifier 역할에 남은 work 가 있으면 stop 을 block 하는 JSON 을 출력한다.

- `install-stop-hook.sh`
  - Codex `~/.codex/hooks.json` 에 현재 보드의 `check-stop.sh` 를 Stop hook 으로 설치 / 제거 / 상태 확인한다.
  - `install`, `remove`, `status` 액션을 지원한다.
  - 기존 Stop hook 들은 유지하고, 현재 보드 command 만 idempotent 하게 추가 / 제거한다.
  - `AUTOFLOW_CODEX_HOOKS_PATH` 를 주면 테스트용 다른 manifest 경로에도 쓸 수 있다.

- `file-watch-common.sh`
  - `run-hook.sh`, `watch-board.sh` 가 같이 쓰는 file-watch 설정 파서와 debounce / stat helper 를 담는다.

- `set-thread-context.sh`
  - 현재 thread 의 역할과 worker id 를 `automations/state/threads/` 아래에 기록한다.
  - 선택적으로 `active_ticket_id`, `active_stage`, `active_ticket_path` 도 같이 기록한다.
- runtime `start-ticket-owner.sh`, `verify-ticket-owner.sh`, `finish-ticket-owner.sh`, `start-plan.sh`, `start-todo.sh`, `start-verifier.sh` 가 현재 role 문맥을 자동으로 갱신할 때도 사용한다.

- `clear-thread-context.sh`
  - 기본값은 현재 thread 의 stop-hook context 전체를 지운다.
  - `--active-only` 를 주면 역할 문맥은 유지하고 현재 티켓 문맥만 비운다.
- Ticket Owner pass/fail 마무리는 `finish-ticket-owner.sh` 가 이 active-only 모드를 대신 호출한다. legacy todo 가 verifier 로 handoff 될 때는 `handoff-todo.sh` 가 호출하고, 사용자가 `멈춰` 라고 했을 때만 전체 clear 를 쓴다.

- `start-spec.sh`
  - 다음 spec 번호와 저장 대상 경로를 정한다.
  - 사용자 확정 전에는 state 폴더에 placeholder 파일을 만들지 않는다.
  - 실제 내용 저장은 spec author 대화가 사용자 명시 허락을 받은 뒤에만 한다.

- `start-ticket-owner.sh`
  - 기본 Ticket Owner Mode 런타임이다.
  - owner 가 이미 가진 `tickets/inprogress/tickets_NNN.md` 를 우선 재개한다.
  - 없으면 `tickets/todo/` 티켓을 `inprogress/` 로 점유하고, 레거시 `tickets/verifier/` 티켓도 owner 가 이어받을 수 있게 `inprogress/` 로 가져온다.
  - todo 티켓도 없으면 populated backlog spec 을 `tickets/done/<project-key>/` 로 보관하고, 그 spec 에서 바로 `tickets/inprogress/tickets_NNN.md` 를 만든다.
  - 같은 owner AI 가 mini-plan, 구현, 검증 판단, AI-led merge, evidence 기록, done/reject 이동까지 이어서 책임진다. planner / todo / verifier 역할 분리를 요구하지 않는다.
  - git 저장소에서는 티켓별 worktree / branch 를 만들고 `implementation_root`, `run`, `done_target`, `reject_target` 를 출력한다.

- `verify-ticket-owner.sh`
  - Ticket Owner Mode 의 선택적 검증 evidence 기록 도구다. AI 대신 검증 판단을 내리는 주체가 아니다.
  - 티켓 또는 참조된 project spec 의 `## Verification` / `Command` 를 읽어 ticket working root 에서 실행한다.
  - `tickets/inprogress/verify_NNN.md` 에 command, stdout/stderr, exit code, evidence 를 기록하고 pass/fail 상태를 출력한다. AI owner 는 출력과 acceptance criteria 를 직접 해석해야 한다.
  - 예: `./scripts/verify-ticket-owner.sh 001`

- `finish-ticket-owner.sh`
  - Ticket Owner Mode 의 pass/fail 마무리 런타임이다.
  - pass 는 AI 가 이미 검증하고 `PROJECT_ROOT` 에 병합한 결과만 finalization 한다. 즉 worktree snapshot 준비, AI-merged result 검증, done 이동, verifier log 작성, active context clear, local git commit 을 처리한다.
  - rebase, cherry-pick, conflict resolution, product-code merge 는 하지 않는다. 그 판단과 처리는 AI owner 의 작업이다.
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
  - legacy verifier pass 경로에서만 실행한다.
  - ticket worktree 의 `Allowed Paths` 변경을 스냅샷 커밋한 뒤 `needs_ai_merge` 를 반환한다. AI 가 직접 중앙 `PROJECT_ROOT` 병합과 충돌 해결을 해야 한다.
  - rebase, cherry-pick, conflict resolution, product-code merge 는 수행하지 않는다.
  - Ticket Owner Mode 에서는 AI-led merge 원칙을 우선하며, 이 스크립트를 product-code merge 주체로 쓰지 않는다.

- `write-verifier-log.sh`
  - verifier 완료 후 `logs/verifier_*.md` completion log 를 남긴다.
  - log 에도 `project / plan / ticket / verify` note 연결을 남긴다.
  - pass / fail log 작성 뒤 active runtime context 를 비워 다음 tick 이 보드 파일과 Obsidian links 로 재개하게 한다.

- `runner-common.sh`
  - runner config, state, log 경로와 `runners/config.toml` / ignored `runners/config.local.toml` 의 작은 `[[runners]]` subset parser 를 제공한다.
  - `config.toml` 은 tracked 기본 topology, `config.local.toml` 은 `autoflow runners set/add/remove` 가 쓰는 머신별 override 다. 읽기는 local 파일을 우선한다.
  - `autoflow runners list/add/remove/start/stop/restart/artifacts/set` 이 같은 state/log 계약을 쓰도록 하는 공통 helper 다.

- `run-hook.sh` (DEPRECATED — legacy script-driven trigger path)
  - Bash/macOS/Linux 쪽 file-watch watcher 가 route별 one-shot hook 을 dispatch 할 때 쓰는 단발 실행기다.
  - 현재 기본값은 `ticket` route 가 `codex exec` 로 Ticket Owner prompt 를 실행하고, legacy `plan` / `todo` / `verifier` route 는 설정을 켰을 때만 동작한다.
  - 3-runner topology (planner + worker + wiki) 가 정식 경로이고, run-hook 은 `watch-bg` 사용자를 위한 backwards compatibility 만 유지한다.

- `watch-board.sh` (DEPRECATED — legacy script-driven loop)
  - Bash/macOS/Linux 에서 쓰는 polling watcher 다.
  - 기본값으로 `tickets/backlog/`, `tickets/todo/`, `tickets/verifier/` 를 `ticket` route 로 감시한다. legacy route 를 켜면 `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더도 plan route 로 감시한다.
  - 같은 감시 경로를 0.25초 간격으로 스캔해 변화를 감지하고 debounce 후 `run-hook.sh` 를 실행한다.
  - 로그는 `logs/hooks/` 를 쓰며, minute heartbeat 가 외부 사유로 끊기는 환경의 보조 수단으로만 둔다. 정식 경로는 3-runner heartbeat AI runner 다.

## Bootstrap Script

- `scaffold-project.sh`
  - `scaffold/board/` 와 선택된 runtime 파일만 대상 프로젝트에 생성한다.
  - 대상 프로젝트 루트의 `AGENTS.md`, `CLAUDE.md`, project-local Claude/Codex Autoflow skills 도 함께 만든다.
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
- `order-project.sh`
  - `autoflow order create` 구현체다.
  - 짧은 수정 요청을 `tickets/inbox/order_*.md` 로 저장해 Plan AI 가 PRD / todo ticket 으로 승격할 수 있게 한다.
  - stdin 또는 `--from-file` 내용을 `Conversation Handoff` 로 보존해 `tickets/backlog/prd_NNN.md` 를 만든다.
  - `--save-handoff` 를 쓰면 같은 내용을 `conversations/prd_NNN/spec-handoff.md` 에도 보관한다.
  - `--raw` 는 이미 작성된 markdown spec 을 그대로 저장하고, plan / todo / verifier 상태는 건드리지 않는다.

- `run-role.sh`
  - `autoflow run ticket/planner/todo/verifier/wiki/coordinator` 구현체다.
  - 기본 `ticket` 실행은 Ticket Owner prompt 를 생성하고, runner 가 `start-ticket-owner` 런타임을 써서 한 티켓을 끝까지 소유하게 한다.
  - `shell` / `manual` runner 로 기존 board runtime (`start-plan`, `start-todo`, `start-verifier`) 또는 `wiki-project.sh update` 를 one-shot 으로 호출하고 runner state/log 를 남긴다.
  - `codex`, `claude`, `opencode`, `gemini` runner 는 role prompt 를 생성해 local CLI adapter 를 호출한다. `--dry-run` 은 prompt 와 command 만 출력한다.
  - planner/worker/verifier adapter prompt 는 role별 byte cap 을 먼저 적용한다: `AUTOFLOW_PLANNER_PROMPT_BYTES` 기본 `65536`, `AUTOFLOW_WORKER_PROMPT_BYTES` 기본 `98304`, `AUTOFLOW_VERIFIER_PROMPT_BYTES` 기본 `32768`. cap 초과 시 prompt head 60% + tail 40% 를 남기고 `[... N bytes elided to save tokens ...]` marker 를 삽입한 뒤 호출을 계속 진행한다.
  - cap 이 실제로 발동하면 `.autoflow/runners/logs/*.log` 에 `event=prompt_cap_applied ... prompt_bytes_capped=NNN` 한 줄이 남는다. 기존 telemetry/token 기록 경로는 그대로 유지한다.
  - adapter final message/stdout 에는 role별 output cap 도 적용된다: `AUTOFLOW_PLANNER_MAX_OUTPUT_TOKENS` 기본 `8000`, `AUTOFLOW_WORKER_MAX_OUTPUT_TOKENS` 기본 `16000`, `AUTOFLOW_VERIFIER_MAX_OUTPUT_TOKENS` 기본 `4000`, `AUTOFLOW_WIKI_MAX_OUTPUT_TOKENS` 기본 `2000`.
  - 현재 로컬 CLI 가 provider-native max output flag 를 노출하지 않는 경우에도 후처리 fallback 으로 응답 끝에 `output_truncated=true` marker 를 추가하고, `.autoflow/runners/logs/*.log` 에 `event=output_cap_applied ... output_truncated=true` 및 `adapter_finish ... output_truncated=true|false` 를 남긴다.
  - 운영 중 최근 24h `adapter_finish` 대비 `output_truncated=true` 비율이 5%를 넘으면 해당 role 의 `AUTOFLOW_*_MAX_OUTPUT_TOKENS` 상향을 권장한다.
  - 예외: `autoflow run coordinator` 는 runner 의 adapter 설정이 Codex/Claude 여도 `coordinator-project.sh` 를 직접 실행한다. 같은 coordinator runner 를 `autoflow run wiki` 나 `wiki query --synth` 로 재사용할 때만 adapter 를 쓴다.
  - adapter prompt, stdout, stderr 와 shell runtime output 은 `runners/logs/` 에 파일로 보관하고 출력에 `*_log_path` 를 남긴다. `shell` / `manual` dry-run 도 preview log 를 남긴다.

- `wiki-project.sh`
  - `autoflow wiki update`, `autoflow wiki query`, `autoflow wiki lint` 구현체다.
  - `update` 는 done tickets, reject records, verifier logs 에서 `wiki/index.md`, `wiki/log.md`, `wiki/project-overview.md` 의 managed section 을 갱신한다.
  - `query` 는 기본적으로 파일 단위 retrieval 을 유지하고, `--rag` 를 주면 line chunk 단위 retrieval 로 전환해 `chunk_start_line` / `chunk_end_line` 메타데이터와 chunk 스니펫을 출력한다.
  - `query --synth` 와 `lint --semantic` 은 enabled `wiki-maintainer` runner (3-runner topology 의 `wiki`) 를 wiki adapter 로 우선 사용한다. wiki-maintainer 가 없고 enabled coordinator/coord/doctor/diagnose runner 가 있으면 그 runner 를 fallback adapter 로 재사용한다(`find_wiki_runner` in wiki-project.sh). 적합한 runner 가 전혀 없으면 graceful skip 한다. round 1 (commit db8cc57) 에서 제거된 것은 `auto_run_wiki_maintainer` (Impl AI inline pass 안에서 coordinator 를 자동 호출하던 분기) 이며, `wiki query --synth` / `lint --semantic` 의 explicit adapter resolution 은 여전히 coordinator fallback 을 지원한다.
  - `lint` 는 wiki orphan page 와 completed-work citation gap 을 key=value 로 보고한다.

- `metrics-project.sh`
  - `autoflow metrics` 구현체다.
  - board state, verifier logs, completion commits, runner adapter logs 에서 spec/ticket/reject/pass-rate/completion-rate/code-volume/token-usage 지표를 key=value 로 출력한다.
  - `--write` 는 같은 snapshot 을 `metrics/daily.jsonl` 에 append 한다.

- `render-heartbeats.sh`
  - `automations/heartbeat-set.toml` 을 읽어 role별 heartbeat TOML 파일 묶음을 렌더한다.
  - 출력 위치는 `BOARD_ROOT/automations/rendered/<set-name>/` 이다.

- `doctor-project.sh`
  - 대상 프로젝트의 보드 구조를 검사하고 실패 시 non-zero 로 종료한다.
  - enabled runner 의 adapter 설정을 읽어 Codex / Claude / OpenCode / Gemini CLI 가 PATH 에 없으면 warning 으로 알려준다.
  - `tickets_NNN.md` 가 `todo`, `inprogress`, `verifier`, recursive `done` 중 여러 곳에 동시에 있으면 error 로 보고한다.
  - active ticket 의 shared Allowed Path blocker chain, Worktree 상태, dirty `PROJECT_ROOT` overlap, shared non-base HEAD 위험을 warning 으로 보고한다.

- `coordinator-project.sh` (DEPRECATED — not in default 3-runner topology)
  - cheap precheck 로 `ready-to-merge`, `merge-blocked`, `reject`, blocked in-progress tickets, failed/blocked runner state 를 먼저 본다.
  - 문제가 감지된 경우에만 `doctor-project.sh` 진단을 실행하고, 같은 문제 fingerprint 가 반복되면 full doctor 를 스킵한다.
  - 직접 구현하거나 검증 판정을 바꾸지 않고, rebase/cherry-pick/conflict resolution/product-code merge 도 수행하지 않는다.
  - finalizer/runtime 출력과 doctor 출력을 함께 key=value 로 남긴다.
  - 3-runner topology 에서는 wiki baseline 과 AI synthesis 를 모두 `wiki` 이 소유한다. Impl AI 의 `finish-ticket-owner pass` / `merge-ready-ticket` finalizer 는 `update-wiki.sh` 를 자동 호출하거나 `.autoflow/wiki/` 를 ticket completion commit 에 stage 하지 않는다. `wiki` 이 source 변화와 managed baseline 을 확인한 뒤 실제 drift 가 있을 때만 `autoflow wiki update` 를 도구로 호출한다. coordinator 의 wiki-bot adapter 재사용 분기는 round 1 (commit db8cc57) 에서 제거됐다.

- `upgrade-project.sh`
  - 공용 runtime/template 자산을 최신 패키지 기준으로 갱신한다.
  - project-local Claude/Codex Autoflow skills 를 최신 원본으로 동기화한다.
  - 변경되는 관리 파일은 덮어쓰기 전에 백업한다.

- `watch-project.sh`
  - 대상 프로젝트의 생성된 보드 `scripts/watch-board.sh` 를 실행한다.
  - Bash/macOS/Linux 에서 `./bin/autoflow watch <project-root>` 로 foreground 실행할 수 있다.
  - 백그라운드 운영은 `./bin/autoflow watch-bg <project-root>` 로 시작하고 `./bin/autoflow watch-status <project-root>` 로 확인하고 `./bin/autoflow watch-stop <project-root>` 으로 멈춘다.

## Notes

- 이 스크립트들은 결정적인 보드 상태 전환을 맡는다.
- 실제 구현 내용 자체는 여전히 에이전트가 수행한다.
- 여러 대화창에서 동시에 실행될 수 있으므로 `start-ticket-owner.sh` 와 legacy `start-todo.sh` 는 `mv` 기반 점유를 사용한다.
- 기본 Ticket Owner 운영에서는 `AUTOFLOW_ROLE=ticket-owner`, `AUTOFLOW_WORKER_ID=worker`, `AUTOFLOW_BACKGROUND=1` 을 같이 쓰는 편이 좋다.
- 24시간 자동화에서는 `AUTOFLOW_BACKGROUND=1` 이 기본값으로 적합하다. legacy role-pipeline 에서만 pool / load 제한 변수를 추가로 쓴다.
- owner worker 수는 heartbeat set 의 `owner_workers` 값으로 자유롭게 늘리거나 줄일 수 있다. 예를 들어 owner 3개면 `owner_workers = ["worker", "owner-2", "owner-3"]` 로 둔다.
- 실제 Codex heartbeat payload template 은 `automations/templates/` 에 있고, 생성된 보드에도 같이 복사된다.
- stop hook 을 쓰려면 현재 thread role 을 먼저 `set-thread-context.sh` 로 등록하고, hook 본체는 `check-stop.sh` 를 연결한다.
- 보드 stop hook wiring 을 자동으로 붙이고 싶으면 `scripts/install-stop-hook.sh install` 을 한 번 실행한다.
- Ticket Owner pass/fail 완료 뒤에도 다음 티켓으로 계속 이어갈 수 있게, finish 런타임은 전체 clear 대신 active ticket context 만 비운다. legacy todo → verifier handoff 도 같은 원칙으로 `clear-thread-context.sh --active-only` 를 우선한다.
