# Autoflow

`Autoflow` 는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트를 위한 로컬 작업 하네스다.

현재 패키지는 공개 배포 가능한 `repo template + installer CLI` 방식으로, 프로젝트 안에 파일 기반 AI 작업 보드를 설치한다. Autoflow 가 직접 코딩 모델이 되는 것이 아니라, 여러 local agent runner 가 안전하게 같은 보드 큐를 소비할 수 있는 운영 레이어를 제공한다.

핵심 목표는 이것이다.

- 실제 프로젝트 안에 `.autoflow/` 보드를 생성한다.
- 보드 상태는 프로젝트 로컬 파일로 남긴다.
- 설치는 공개 저장소의 CLI/스크립트로 수행한다.
- fresh init 은 runner, wiki, metrics, conversation, adapter scaffold 를 함께 만든다.
- PRD 부터 ticket owner verification 까지 `tickets/` 보드가 실행 원장이 된다.
- 완료된 작업과 의사결정은 향후 `wiki/` layer 에 사람이 읽기 좋은 지도로 축적한다.

예를 들어 `tetris` 프로젝트에 적용하면 목표 구조는 아래와 같다.

```text
tetris/
  AGENTS.md                         (optional host guidance)
  CLAUDE.md                         (Claude imports AGENTS.md)
  .claude/skills/
    af/
    autoflow/
  .codex/skills/
    af/
    autoflow/
  .autoflow/
    AGENTS.md
    README.md
    agents/
      adapters/
    automations/
    conversations/
    metrics/
    reference/
    runners/
    rules/
      wiki/
    scripts/
    wiki/
    tickets/
      plan/
        inprogress/
      runs/
  src/
  public/
  package.json
```

여기서 `.autoflow/docs/` 는 필요하면 나중에 직접 추가하는 선택 폴더다.
프로젝트별 온보딩 메모나 테스트 명령 모음은 둘 수 있지만, 상태 폴더에는 실제 작업 문서만 둔다. 설명서와 템플릿은 `reference/` 에 모으고, 검증 기준 문서는 `rules/verifier/` 아래에 둔다. 기본 Ticket Owner 흐름에서는 backlog PRD 에서 바로 `tickets/inprogress/tickets_NNN.md` 를 만들고, 처리한 PRD 와 완료 티켓은 `tickets/done/<project-key>/` 로 이동한다. project / ticket / verification / log 문서는 `[[prd_NNN]]`, `[[tickets_NNN]]`, `[[verify_NNN]]` 형태의 옵시디언 링크도 함께 남겨 서로 연결한다.

중요한 구분:

- `tickets/` 는 실행 원장이다. 실제 상태, 책임자, 검증 결과, reject reason 은 여기서 판단한다.
- `wiki/` 는 이해의 지도다. 완료된 작업, 결정, 실패 패턴을 재사용 가능한 지식으로 정리하지만 완료 판정의 source of truth 는 아니다.
- `runners/` 는 process state 다. Codex/Claude/OpenCode/Gemini CLI 같은 실행기가 어떤 역할로 움직이는지 기록하지만 ticket stage 를 대체하지 않는다.

## PRD Handoff Direction

Codex/Claude 대화창에서는 설치된 Autoflow skill 을 **PRD handoff 전용 진입점**으로 둔다. Claude 는 `/af` / `/autoflow`, Codex 는 `$af` / `$autoflow` 를 1급 경로로 쓰고, `#af` / `#autoflow` 는 AGENTS/CLAUDE 호환 alias 로 남긴다.

- 대화창에서는 사용자 요구를 정리해 PRD 만 작성한다.
- 실행 기준 저장 대상은 `.autoflow/tickets/backlog/prd_NNN.md` PRD 이다.
- 작은 수정 요청은 Claude `/memo`, Codex `$memo`, `#memo`, 또는 `autoflow memo create` 로 `.autoflow/tickets/inbox/memo_NNN.md` 에 가볍게 저장할 수 있다. Plan AI 가 안전한 범위로 해석되면 generated PRD 와 todo ticket 으로 승격한다.
- Autoflow install 은 프로젝트 로컬 `.claude/skills/{autoflow,af,memo}` 와 `.codex/skills/{autoflow,af,memo}` 를 함께 만든다.
- Claude Code 는 `AGENTS.md` 를 직접 읽지 않으므로 Autoflow install 은 프로젝트 루트 `CLAUDE.md` 도 함께 만들고, 이 파일이 `AGENTS.md` 를 import 해 skill/alias handoff 원칙을 보강하게 한다.
- skill 원본은 `integrations/claude/skills/` 와 `integrations/codex/skills/` 아래에 둔다.
- CLI handoff 저장을 켜면 같은 승인 내용을 `.autoflow/conversations/prd_NNN/spec-handoff.md` 에도 보관한다.
- ticket owner runner 가 Autoflow 보드에서 plan / implement / verify 를 한 번에 이어받는다.
- 긴 대화가 작업 상태를 대신하지 않는다. 대화는 PRD 와 compact summary 로만 보드에 연결된다.

현재 방향의 기본 실행 단위는 `ticket-owner` 다. PRD handoff 는 Claude/Codex skill 로 시작하고, 작은 요청은 memo skill 로 시작할 수 있다. 실행은 `autoflow prd create`, `autoflow memo create`, `autoflow run planner`, `autoflow run ticket`, Desktop Flow Viewer 의 runner controls, Codex/Claude/OpenCode/Gemini local CLI adapter 호출이 이어받는다. 앱은 PRD 입력 공간이 아니라 보드 상태와 runner 제어면이다. 기존 `todo/verifier` runner 는 role-pipeline 호환 경로로 남아 있지만 기본 운영 모델은 아니다.

## Distribution Model

현재 기준의 1순위 배포 방식은 플러그인이 아니라 아래 조합이다.

- 공개 Git 저장소
- 설치용 CLI 엔트리포인트
- 로컬 프로젝트에 생성되는 `.autoflow/` 보드

이 방식의 장점:

- 공개 배포가 쉽다.
- 프로젝트 상태가 Git 에 남는다.
- 특정 Codex 워크스페이스 기능에 묶이지 않는다.
- 팀/개인 모두 동일한 설치 흐름을 쓸 수 있다.

## 핵심 개념

- `PROJECT_ROOT`: 실제 제품 코드를 두는 호스트 프로젝트 루트
- `BOARD_ROOT`: 호스트 프로젝트에 설치된 Autoflow 보드 루트. 기본값은 `PROJECT_ROOT/.autoflow` 이며 CLI 인자로 바꿀 수 있다.

이 스캐폴드에서는 아래 원칙을 쓴다.

- 보드 문서와 실행 기록은 `BOARD_ROOT` 아래에 둔다.
- 실제 제품 코드는 `PROJECT_ROOT` 에 둔다. git 저장소에서는 Ticket Owner 가 티켓별 worktree 를 만들어 그 복제 루트에서 제품 코드를 수정한다.
- 티켓의 `Allowed Paths` 는 repo-relative 경로로 적고, 실제 구현 시에는 티켓 `Worktree.Path` 기준으로 해석한다. worktree 를 쓸 수 없는 환경에서만 `PROJECT_ROOT` 기준으로 fallback 한다.
- `rules/`, `tickets/` 참조는 `BOARD_ROOT` 기준으로 적는다.
- 검증 규칙과 템플릿은 `rules/verifier/` 아래에 둔다.
- `tickets/backlog/` 는 아직 plan 전인 PRD 입력 큐다.
- `tickets/plan/` 은 legacy role-pipeline 의 plan 대기열이다.
- `tickets/inprogress/` 는 Ticket Owner 가 점유한 `tickets_*.md` 와 진행 중 검증 기록을 두는 구역이다. legacy role-pipeline 에서는 `plan_*.md` / todo worker 티켓도 이곳을 쓴다.
- `tickets/done/<project-key>/` 는 완료 티켓, 처리된 PRD, legacy ticket 생성 완료 plan 을 프로젝트 단위로 모은다.
- `reference/` 는 state 폴더 밖에서 README 와 템플릿을 관리하는 곳이다.

## Canonical Flow

```text
PROJECT_ROOT
  -> .autoflow/tickets/backlog
  -> .autoflow/tickets/inprogress/tickets_NNN.md
  -> .autoflow/rules/verifier
  -> .autoflow/tickets/inprogress/verify_NNN.md
  -> .autoflow/logs
  -> .autoflow/tickets/done/<project-key>
```

`tickets/todo/`, `tickets/verifier/`, `tickets/plan/` 은 기존 role-pipeline 과 외부 큐 입력을 위한 호환 상태로 남아 있고, 기본 `ticket-owner` runner 는 이 큐도 필요할 때 이어받을 수 있다.

## When This Fits

아래 같은 상황이면 이 구조가 잘 맞는다.

- `tetris` 같은 실제 프로젝트 안에 AI 운영 보드를 같이 두고 싶을 때
- 여러 Codex 스레드나 heartbeat owner 가 병렬로 티켓을 나눠 처리할 때. 단, 한 owner 는 한 번에 active ticket 하나만 처리한다.
- Codex, Claude Code, OpenCode, Gemini CLI 를 작업별 runner 로 바꿔가며 쓰고 싶을 때
- 대화창이 늘어나도 프로젝트의 PRD / ticket / verifier / done 숫자를 보드에서 세고 싶을 때
- 보드 상태와 제품 코드를 물리적으로 분리하고 싶을 때
- 사람이 `.autoflow/` 폴더만 열어도 현재 흐름을 빠르게 이해해야 할 때

## Install

현재 공개 설치용 엔트리포인트는 아래다.

```bash
./bin/autoflow init /path/to/project
```

현재 디렉터리 프로젝트에 바로 설치하려면:

```bash
./bin/autoflow init .
```

Windows PowerShell 에서는 아래 래퍼를 쓰면 `D:\project\astra` 같은 경로를 그대로 넘길 수 있다.

```powershell
./bin/autoflow.ps1 init D:\project\astra
```

공개 CLI 명령은 macOS/Linux Bash 엔트리포인트 `./bin/autoflow` 와 Windows PowerShell 엔트리포인트 `./bin/autoflow.ps1` 를 모두 제공한다. `init`, `install-stop-hook`, `remove-stop-hook`, `stop-hook-status`, `render-heartbeats`, `status`, `doctor`, `upgrade`, `prd create`, `memo create`, `spec create`(legacy alias), 3-runner default 인 `run planner/ticket/wiki`, `runners list/add/remove/start/stop/restart/artifacts/set`, `metrics` 를 두 환경에서 같은 의미로 쓸 수 있다. legacy 호환 명령으로 `run todo/verifier/coordinator`, `watch`, `watch-bg`, `watch-status`, `watch-stop` 도 제공한다.

기본 보드 폴더 이름은 `.autoflow` 이다.

다른 이름을 시험하고 싶으면:

```bash
./bin/autoflow init /path/to/project my-board
```

이미 보드가 있는 프로젝트에서 다시 실행하면 기존 보드 상태는 덮어쓰지 않는다.
`init` 은 대상 프로젝트에 project-local Claude/Codex skill 도 함께 설치한다. 새 파일은 만들지만, 같은 경로에 사용자가 수정한 skill 이 이미 있으면 덮어쓰지 않고 보존한다. 기존 프로젝트를 새 skill 템플릿으로 갱신하려면 `autoflow upgrade` 를 사용한다.

## CLI

현재 구현된 공개 CLI 명령:

- `autoflow init [project-root] [board-dir-name]`
- `autoflow install-stop-hook [project-root] [board-dir-name]`
- `autoflow remove-stop-hook [project-root] [board-dir-name]`
- `autoflow stop-hook-status [project-root] [board-dir-name]`
- `autoflow watch [project-root] [board-dir-name] [config-path]` — legacy file-watch loop (DEPRECATED; heartbeat AI runners replace this)
- `autoflow watch-bg [project-root] [board-dir-name] [config-path]` — legacy file-watch background loop (DEPRECATED)
- `autoflow watch-status [project-root] [board-dir-name]` — legacy
- `autoflow watch-stop [project-root] [board-dir-name]` — legacy
- `autoflow prd create [project-root] [board-dir-name] [--id NNN] [--title text] [--goal text] [--from-file path] [--raw] [--save-handoff] [--force]`
- `autoflow spec create [project-root] [board-dir-name] [--id NNN] [--title text] [--goal text] [--from-file path] [--raw] [--save-handoff] [--force]` (legacy alias)
- `autoflow memo create [project-root] [board-dir-name] [--id NNN] [--title text] [--request text] [--from-file path] [--scope text] [--allowed-path path]... [--verification command] [--force]`
- `autoflow run planner [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — Plan AI (3-runner default)
- `autoflow run ticket [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — Impl AI (3-runner default)
- `autoflow run wiki [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — Wiki AI (3-runner default)
- `autoflow run todo [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — legacy role-pipeline
- `autoflow run verifier [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — legacy role-pipeline
- `autoflow run coordinator [project-root] [board-dir-name] [--runner runner-id] [--dry-run]` — legacy
- `autoflow wiki update [project-root] [board-dir-name] [--dry-run]`
- `autoflow wiki lint [project-root] [board-dir-name] [--semantic]`
- `autoflow wiki query [project-root] [board-dir-name] --term TEXT [--term TEXT]... [--limit N] [--no-tickets] [--no-handoffs] [--no-snippets] [--synth]`
- `autoflow runners list [project-root] [board-dir-name]`
- `autoflow runners add <runner-id> <role> [project-root] [board-dir-name] key=value...`
- `autoflow runners remove <runner-id> [project-root] [board-dir-name]`
- `autoflow runners start <runner-id> [project-root] [board-dir-name]`
- `autoflow runners stop <runner-id> [project-root] [board-dir-name]`
- `autoflow runners restart <runner-id> [project-root] [board-dir-name]`
- `autoflow runners artifacts <runner-id> [project-root] [board-dir-name]`
- `autoflow runners set <runner-id> [project-root] [board-dir-name] key=value...`
- `autoflow metrics [project-root] [board-dir-name] [--write]`
- `autoflow render-heartbeats [project-root] [board-dir-name]`
- `autoflow status [project-root] [board-dir-name]`
- `autoflow doctor [project-root] [board-dir-name]`
- `autoflow upgrade [project-root] [board-dir-name]`

Runner commands manage local runner config/state/logs. `add` and `remove` grow
or shrink the configured runner pool, and `set` can update `agent`, `model`,
`reasoning`, `mode`, `interval_seconds`, `enabled`, and `command`. `mode=loop`
runners can be started with `autoflow runners start`, which launches a
background loop that calls `autoflow run` every configured interval until
`autoflow runners stop` is used.
`autoflow doctor` also inspects enabled runner adapter settings and reports
missing Codex, Claude, OpenCode, or Gemini CLI binaries as warnings.
It also checks runner, wiki, metrics, conversation, and adapter scaffold health so
generated boards stay compatible with the desktop dashboard.
`autoflow runners artifacts` prints per-runner runtime/prompt/stdout/stderr
artifact paths with `ok`, `absent`, `missing`, or `outside_board` status.

`autoflow prd create` is the low-friction handoff point for Codex/Claude/OpenCode
chat. It writes one `tickets/backlog/prd_NNN.md` file from stdin or
`--from-file`, preserving the conversation content under `Conversation Handoff`.
`--save-handoff` also writes the same approved handoff to
`conversations/prd_NNN/spec-handoff.md` so the conversation entry point can
be found later without digging through chat history. `--raw` can write an
already prepared markdown PRD unchanged. It never creates plans or tickets.

`autoflow memo create` is the low-friction path for small changes such as
"body font 2px bigger." It writes one `tickets/inbox/memo_NNN.md` file from
stdin, `--request`, or `--from-file`. It never creates PRDs or tickets itself;
Plan AI promotes clear memos into generated PRDs and todo tickets, or marks
ambiguous memos as `needs-info`.

Run commands default to `ticket`, where one owner prompt is responsible for local planning, implementation, verification, and evidence. The `planner` command feeds memo/backlog/reject items into todo tickets. Legacy role-pipeline commands can still call existing board runtime scripts for `todo`, `verifier`, and `wiki` in one-shot mode and record runner state/log entries.
When a runner uses `agent=codex|claude|opencode|gemini`, `autoflow run` builds
a role prompt and invokes the matching local CLI. `--dry-run` prints the adapter
command and prompt without calling the model. Prompt, stdout, stderr, and shell
runtime output are also copied to `runners/logs/` and exposed as `*_log_path`
fields for desktop log views. Shell/manual dry-runs also write a preview log so
the desktop app can open the planned runtime call without executing it.
Coordinator merge completion automatically rebuilds managed sections in
`wiki/index.md`, `wiki/log.md`, and `wiki/project-overview.md` from done
tickets, reject records, and logs while preserving user-authored text outside
those sections.
In the current 3-runner topology (planner-1 + owner-1 + wiki-1), AI synthesis
of the wiki is the exclusive responsibility of `wiki-1` (Wiki AI). Impl AI's
`finish-ticket-owner` pass already runs the deterministic `update-wiki.sh`
inline so the wiki baseline (`index.md`, `log.md`, `project-overview.md`) is
fresh the moment a ticket lands in `done/`; `wiki-1` ticks on its own 1-minute
heartbeat to layer AI synthesis (`autoflow wiki query --synth`,
`autoflow wiki lint --semantic`) on top of that baseline whenever
`tickets/done/` or `tickets/reject/` changes. The earlier inline
`auto_run_wiki_maintainer` trigger and `AUTOFLOW_WIKI_MAINTAINER_AUTO`
environment variable have been removed; `wiki-1` is the single source of AI
wiki synthesis.
`autoflow wiki update` remains available for manual rebuilds.
`autoflow wiki query --synth` adds a grounded LLM summary on top of grep
results, and `autoflow wiki lint --semantic` adds semantic findings on top of
the deterministic lint output. When no wiki-capable adapter is configured, both
commands keep the base output and report `*_status=skipped_no_adapter`.

`autoflow metrics` derives progress numbers from the board and verifier logs:
PRD total, archived handoff count, ticket total, active tickets, done tickets,
reject count, runner enabled/disabled/state counts, verification pass/fail
count, pass rate, and completion rate. With `--write`, it appends the same snapshot to
`metrics/daily.jsonl`.

`autoflow doctor` also checks that a `tickets_NNN.md` file exists in only one
state location across `todo`, `inprogress`, `verifier`, and recursive `done`.
Duplicate ticket IDs are reported as errors because they make runner ownership
ambiguous.

## Desktop Autoflow Dashboard

Electron 기반 Autoflow Dashboard 는 `apps/desktop/` 아래에 둔다. 이 앱은 보드에 정의된 runner 를 one-shot 으로 깨우며, ticket/log 파일을 같은 화면에서 읽는 로컬 대시보드다. MUI Material + Emotion theme 기반 React + Vite 렌더러를 쓰고, 프로젝트에 설치된 `.autoflow/` 보드 파일과 `bin/autoflow status` / `bin/autoflow doctor` / `bin/autoflow runners list` 결과를 읽어 흐름을 관찰한다.

현재 1차 화면에서 다루는 일:

- 프로젝트 루트 선택
- `.autoflow/` 가 없는 프로젝트에 기본 보드 설치
- 마지막 업데이트 표시와 자동 스냅샷 갱신
- runner 목록, 상태, add/remove, start/stop/restart, dry-run, one-shot role run
- runner agent / model / reasoning / mode / interval / enabled / command override 설정 편집
- runner command output 패널, 최근 실행 출력 이력, runtime / prompt / stdout / stderr artifact 개별 열람
- `doctor` health 와 runner adapter/mode 상태 확인
- 상태 카운트, 티켓 큐, 최근 로그, runner logs, wiki pages, 진행 스냅샷 저장과 metrics history 확인
- ticket/log/wiki/metrics 파일 검색과 클릭 미리보기

개발 실행:

```bash
npm install --prefix apps/desktop
npm run desktop:dev
```

문법 확인:

```bash
npm run desktop:check
```

MUI theme 은 `apps/desktop/src/renderer/theme.ts` 에 두고, 앱 전용 wrapper 컴포넌트는 `apps/desktop/src/components/ui/` 아래에 둔다.

Bash/macOS/Linux 에서 file-watch hook 루프를 직접 돌릴 때는 아래를 쓴다.

```bash
./bin/autoflow watch /path/to/project
```

백그라운드로 돌리려면:

```bash
./bin/autoflow watch-bg /path/to/project
./bin/autoflow watch-status /path/to/project
./bin/autoflow watch-stop /path/to/project
```

Windows 에서 file-watch hook 루프를 직접 돌릴 때는 아래 PowerShell helper 를 쓴다.

```powershell
./bin/autoflow.ps1 watch D:\project\astra
```

창을 띄우지 않고 백그라운드 프로세스로 운영하려면 아래를 쓴다. PID 와 stdout/stderr 는 `.autoflow/logs/hooks/` 에 남는다.

```powershell
./bin/autoflow.ps1 watch-bg D:\project\astra
./bin/autoflow.ps1 watch-status D:\project\astra
./bin/autoflow.ps1 watch-stop D:\project\astra
```

현재 보드가 제공하는 기본 로컬 작업 흐름:

- Claude: `/af` 또는 `/autoflow`
- Codex: `$af` 또는 `$autoflow`
- 호환 alias: `#af` 또는 `#autoflow`
- `autoflow run ticket <project-root>`
- 필요하면 Desktop Flow Viewer 의 runner controls 로 같은 ticket-owner 실행을 깨운다.
- `#plan`, `#todo`, `#veri` 는 role-pipeline 호환 경로로만 남긴다.

즉:

- `Autoflow` CLI 는 설치와 배포 진입점을 제공한다.
- `render-heartbeats`, `status`, `doctor`, `upgrade` 는 현재 보드 상태를 AI 친화적인 `key=value` 출력과 안전한 갱신 계약으로 다룬다.
- 생성된 로컬 보드는 작업 보드 흐름을 제공한다.
- 새 보드는 `runners/`, `wiki/`, `metrics/`, `conversations/`, `agents/adapters/`, `rules/wiki/` scaffold 를 포함한다. 이 단계의 scaffold 는 실행 원장이 아니라 local runner harness 와 coordinator 기반 wiki-bot 을 위한 계약면이다.
- `autoflow run` 과 Desktop Flow Viewer 의 runner controls 는 기본적으로 `ticket-owner` runner 를 실행해 한 LLM 이 local planning, 구현, 검증, evidence 기록까지 이어서 맡게 한다. `planner/todo/verifier` runtime 은 role-pipeline 호환 경로로 남아 있다.
- `ticket-owner` 시작 런타임은 `tickets/reject/` 도 함께 살펴보고, `AUTOFLOW_REJECT_AUTO_REPLAN=off` 가 아니면 반려 티켓을 최대 `AUTOFLOW_REJECT_MAX_RETRIES` 회까지 자동으로 `todo` 로 되돌린다.

권장 시작 순서는 아래와 같다.

1. `autoflow init` 으로 보드를 만든다.
2. 원하면 `autoflow install-stop-hook` 으로 현재 보드 `check-stop.*` 를 Codex Stop hook 에 연결한다. 그러면 Ticket Owner 또는 legacy role work 가 남아 있을 때 autopilot 스킬처럼 너무 이른 종료를 막는다. 이 Stop hook 은 heartbeat / watcher 를 대체하지 않고 보완한다.
3. `autoflow status` 와 `autoflow doctor` 로 초기 상태를 확인한다.
4. Claude 에서는 `/af` 또는 `/autoflow`, Codex 에서는 `$af` 또는 `$autoflow` 로 사용자와 대화해 정리된 PRD 를 `tickets/backlog/` 에 남긴다. `#af` / `#autoflow` 는 호환 alias 로만 쓴다.
5. `autoflow run ticket <project-root>` 또는 Desktop Flow Viewer 의 Owner 실행으로 같은 owner 가 backlog PRD 에서 `tickets/inprogress/tickets_NNN.md` 를 만들고 mini-plan, 구현, 검증, evidence 기록, done/reject 이동까지 이어서 처리한다.
6. 검증 command 는 티켓 또는 PRD 의 `## Verification` 아래 `- Command: ...` 로 둔다. owner 는 `start-ticket-owner`, `verify-ticket-owner`, `finish-ticket-owner` 런타임을 순서대로 써서 evidence 와 completion log 를 남긴다.
7. role-pipeline 방식이 필요하면 호환 경로로 `#plan`, `#todo`, `#veri` 또는 `autoflow run planner/todo/verifier` 를 사용할 수 있지만 기본 운영 모델은 아니다.
8. heartbeat 세트를 파일로 관리하고 싶다면 `automations/heartbeat-set.toml` 을 채우고 `autoflow render-heartbeats` 로 role별 heartbeat TOML 묶음을 만든다.
9. (legacy) 파일 업로드나 폴더 변경에 바로 반응시키고 싶다면 macOS/Linux 에서는 `./bin/autoflow watch-bg <project-root>`, Windows 에서는 `./bin/autoflow.ps1 watch-bg <project-root>` 로 file-watch hook 루프를 백그라운드에서 실행한다. 기본 watcher 는 `tickets/backlog/`, `tickets/todo/`, `tickets/verifier/` 변경을 `ticket` route 로 보내고 `logs/hooks/` 에 기록을 남긴다. 이 file-watch 경로는 script-driven 트리거이므로 새 보드는 3-runner heartbeat (planner-1 + owner-1 + wiki-1) 를 우선 사용하고, watcher 는 minute heartbeat 가 외부 사유로 끊기는 환경의 보조 수단으로만 둔다.

## Branding

현재 브랜드 전략은 아래와 같다.

- 제품/배포 이름: `Autoflow`
- 로컬 보드 폴더: `.autoflow/`
- 현재 보드 명령 예시: `autoflow init`, `$af` / `/af`, `autoflow run ticket`

즉 브랜드는 `Autoflow` 로 가져가되, 실제 프로젝트 경로는 `.autoflow/` 를 기본값으로 쓴다.

## Public Package Layout

```text
autoflow/
  bin/
    autoflow
  scaffold/
    manifest.toml
    board/
      agents/
      automations/
      reference/
      rules/
    host/
  runtime/
    board-scripts/
  packages/
    cli/
  tests/
    smoke/
  dogfood-board/
```

| Source Path | 역할 | 설치 대상 여부 |
| --- | --- | --- |
| `bin/` | 사용자가 실행하는 얇은 CLI entrypoint | 아니오 |
| `packages/cli/` | `init`, `status`, `doctor`, `run`, `upgrade` 등 CLI 구현 | 아니오 |
| `apps/desktop/` | 로컬 Desktop Flow Viewer 앱 | 아니오 |
| `scaffold/manifest.toml` | 기본 설치 보드명과 scaffold source mapping 설정 | 아니오 |
| `scaffold/board/` | 대상 프로젝트 보드로 렌더링될 문서 scaffold source | 예, `BOARD_ROOT/` 아래 |
| `scaffold/host/AGENTS.md` | 대상 프로젝트 루트에 놓을 host guidance template | 예, `PROJECT_ROOT/AGENTS.md` |
| `runtime/board-scripts/` | 대상 보드의 `scripts/` 로 복사될 runtime hook source | 예, `BOARD_ROOT/scripts/` |
| `tests/smoke/` | 패키지 개발 중 실행하는 smoke test | 아니오 |
| `dogfood-board/` | 이 저장소 자체를 개발할 때 쓰는 보드 상태와 로그 | 아니오 |

`bin/autoflow` 는 설치 엔트리포인트이고, 실제로 프로젝트 안에 생성되는 상태 파일은 `.autoflow/` 아래에 남는다.

이 저장소 자체의 개발 보드 상태는 `dogfood-board/` 에 둔다. 이것은 패키지 소스가 아니라 개발 이력과 검증 기록을 보관하는 목적 폴더다.

생성 대상은 현재 저장소 전체가 아니라 `scaffold/board/`, `scaffold/host/AGENTS.md`, 그리고 선택된 runtime 문서/스크립트다.
즉 새 프로젝트에는 이 저장소의 내부 plan, 샘플 ticket, 플러그인 실험 파일이 들어가지 않는다.

생성된 보드에는 `.autoflow-version` 이 기록되고, `status` 와 `doctor` 는 이 값을 패키지 버전과 비교한다.

## Script Hooks

생성된 `BOARD_ROOT/scripts/` 의 훅은 보드 상태 전환을 맡는다.

- `start-spec.sh`
- `start-ticket-owner.sh`
- `verify-ticket-owner.sh`
- `finish-ticket-owner.sh`
- `start-plan.sh`
- `start-todo.sh`
- `handoff-todo.sh`
- `start-verifier.sh`
- `run-hook.sh`
- `watch-board.sh`
- `install-stop-hook.sh`
- `start-spec.ps1`
- `start-ticket-owner.ps1`
- `verify-ticket-owner.ps1`
- `finish-ticket-owner.ps1`
- `start-plan.ps1`
- `start-todo.ps1`
- `handoff-todo.ps1`
- `start-verifier.ps1`
- `install-stop-hook.ps1`
- `run-hook.ps1`
- `watch-board.ps1`

`install-stop-hook.*` 는 현재 보드 `check-stop.*` 를 Codex Stop hook manifest (`~/.codex/hooks.json`) 에 설치 / 제거 / 상태 확인하는 helper 다. 이미 설치된 다른 Stop hook 은 유지하고, 현재 보드 command 만 idempotent 하게 추가 / 제거한다.

Windows 에서는 `.ps1` 래퍼를 우선 실행한다. `.ps1` 래퍼는 경로와 `AUTOFLOW_*` 환경 변수를 안전하게 변환해 기존 `.sh` 런타임을 호출한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

이 스크립트들은 결정적인 파일 이동과 상태 갱신을 맡고, 실제 구현 판단은 에이전트가 이어받는다.

`run-hook.sh` / `watch-board.sh` 는 Bash/macOS/Linux 쪽 one-shot hook dispatcher 와 watcher 다. `watch-board.ps1` 는 Windows 쪽 watcher 다. **이 file-watch 경로는 DEPRECATED 된 script-driven 트리거 패턴**으로, 새 토폴로지에서는 1분 heartbeat 가 AI runner 를 깨우면 AI 가 board state 를 직접 읽고 도구로 스크립트를 호출한다. minute heartbeat 가 외부 사유로 끊기는 환경에서는 이 watcher 를 보조 수단으로 함께 둘 수 있고, 상태 전환 직후 다음 route 를 바로 이어붙여 1분 heartbeat 지연을 줄일 수 있다. 평소에는 `watch-bg` 로 백그라운드 실행을 사용하고, watcher 자체는 사용자가 `watch-stop` 으로 멈출 때까지 계속 살아 있다. 상세 실행 기록은 `logs/hooks/` 에 남긴다.

자동화 철학은 `/Users/demoon/Documents/project/mySkills/skills/autopilot/SKILL.md` 처럼 "남은 일이 있는데 너무 일찍 멈추지 않게 하기"에 가깝다.
다만 현재 `Autoflow` 는 단일 작업 계획 파일 대신 보드 파일을 source of truth 로 쓰고, 기본 실행은 `ticket-owner` heartbeat 또는 `autoflow run ticket` 이 한 티켓을 끝까지 소유하는 쪽을 기준으로 한다.

Ticket Owner 운영에서는 아래 환경 변수를 쓰는 편이 좋다.

- `AUTOFLOW_ROLE`
- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_BACKGROUND`

예:

- PRD handoff: manual only (`/af` / `/autoflow`, `$af` / `$autoflow`, or `#af` / `#autoflow`)
- ticket owner: `AUTOFLOW_ROLE=ticket-owner`, `AUTOFLOW_WORKER_ID=owner-1`, `AUTOFLOW_BACKGROUND=1`

Owner worker 수는 고정이 아니다. 병렬 실행이 필요하면 owner id 를 늘리고, 각 owner 를 별도 Codex/Claude/OpenCode/Gemini 대화 또는 runner process 에 묶는다.

- owner 1개:
  - `owner_workers = ["owner-1"]`
- owner 3개:
  - `owner_workers = ["owner-1", "owner-2", "owner-3"]`

레거시 role-pipeline 운영이 필요하면 `planner P / todo K / verifier M` 형태로 `#plan`, `#todo`, `#veri` 를 켤 수 있다. 새 작업의 기본값은 아니다.

24시간 heartbeat 운영에서는 `AUTOFLOW_BACKGROUND=1` 을 주는 편이 좋다. 이 모드에서는 "할 일 없음" 이 실패가 아니라 `status=idle` 로 출력되어 자동화가 조용히 다음 wake-up 을 기다린다.

실제 Codex heartbeat 세트를 만들 때는 생성된 보드의 `automations/heartbeat-set.toml` 을 먼저 채우고, 그다음 `autoflow render-heartbeats` 를 실행하면 된다. 렌더 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

## Upgrade Contract

`autoflow upgrade` 는 다음을 갱신한다.

- 공용 runtime 스크립트
- 공용 템플릿
- 보드 운영용 README/agent 문서
- 호스트 루트 `AGENTS.md` 는 선택 파일이다. 이미 있거나 사용자가 원할 때만 둔다.
- `.autoflow-version`

아래는 보존한다 (경로는 모두 생성된 `BOARD_ROOT/` 기준이며, 이 루트 패키지 소스에는 해당 파일들이 없다).

- `tickets/backlog/prd_*.md`
- `tickets/plan/plan_*.md`
- `tickets/inprogress/plan_*.md`
- `tickets/*/tickets_*.md`
- `tickets/inprogress/verify_*.md` while verification is active
- `tickets/done/<project-key>/verify_*.md` or `tickets/reject/verify_*.md` after verification is settled
- `logs/verifier_*.md`

업그레이드 중 변경되는 공용 파일이 이미 수정되어 있으면, 이전 내용은 `BOARD_ROOT/.autoflow-upgrade-backups/<timestamp>/` 아래에 백업한다.

## Path Rules

예 (아래는 generated board 안에서 티켓이 쓰는 경로 형식이다. 이 루트 패키지 소스에는 이 파일들이 없다):

- 보드 문서 참조: `tickets/backlog/prd_001.md` 또는 `tickets/done/prd_001/prd_001.md`
- plan 참조: `tickets/plan/plan_001.md`, `tickets/inprogress/plan_001.md`, 또는 `tickets/done/prd_001/plan_001.md`
- done 티켓 경로: `tickets/done/prd_001/tickets_001.md`
- 진행 중 검증 기록 참조: `tickets/inprogress/verify_001.md`
- 완료 후 검증 기록 참조: `tickets/done/prd_001/verify_001.md`
- owner / verifier completion log 참조: `logs/verifier_001_<timestamp>_<outcome>.md`
- 실제 작업 허용 경로: `src/`, `public/`, `package.json`

즉:

- `References` 는 `BOARD_ROOT` 상대 경로
- `Allowed Paths` 는 repo-relative 경로이며, 구현 중에는 티켓 worktree 루트 기준으로 해석한다
- `## Obsidian Links` 는 note 이름 기준 링크 (`[[prd_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 를 남긴다

## 이 구조가 하려는 것

- 공개 저장소 형태로 쉽게 배포하기
- 실제 프로젝트 안에 삽입 가능한 하네스 sidecar 만들기
- 보드와 제품 코드를 물리적으로 분리하기
- 에이전트가 `.autoflow/` 보드만 읽어도 현재 흐름을 이해하게 하기
- 실제 코드 수정 범위는 티켓 worktree 안의 `Allowed Paths` 로 좁히기
- 여러 owner runner 가 동시에 실행돼도 서로 다른 티켓을 점유하게 하기
- 대화창이 멈췄다가 다시 시작되어도 `tickets/inprogress/` 기준으로 재개하게 하기
- 검증 기준과 검증 결과를 분리하기
- owner heartbeat 가 자기 티켓과 상태 큐를 계속 따라가게 하기

## 가장 중요한 규칙

- 티켓 파일 이름은 `tickets_001.md` 처럼 번호 기반으로 만든다.
- 한 티켓은 한 번에 한 상태 폴더에만 존재한다.
- `done/<project-key>/` 으로 옮기기 전에 owner 가 `tickets/inprogress/verify_*.md` 를 준비해야 하고, 완료 후에는 그 기록도 `done/<project-key>/verify_*.md` 또는 `reject/verify_*.md` 로 정리돼야 한다. completion log 는 `logs/` 에 남아 있어야 한다.
- 티켓 생성 전에는 실제 `tickets/backlog/*.md` 가 있어야 한다.
- Ticket Owner 가 backlog PRD 에서 직접 티켓을 만든 뒤 처리한 PRD 는 `tickets/done/<project-key>/` 로 이동해야 한다.
- `Allowed Paths` 는 repo-relative 경로로 적고, 구현은 티켓 worktree 기준으로 진행한다. worktree 가 없을 때만 `PROJECT_ROOT` 기준으로 fallback 한다.
- `$af` / `$autoflow`, `/af` / `/autoflow`, `#af` / `#autoflow` 는 PRD 저장까지만 맡고, 이후 기본 실행은 `ticket-owner` 가 이어받는다.
- Ticket Owner heartbeat 는 사용자가 멈추라고 하기 전까지 계속 살아 있어야 한다.
- Ticket Owner 는 단순 이동 훅이 아니라 `PRD/todo/verifier claim + mini-plan + 구현 + 검증 + evidence + done/reject 이동` 훅이다.
- `inprogress/` 티켓에는 항상 재개 가능한 상태 요약이 남아 있어야 한다.
- 24시간 자동화에서는 "할 일 없음" 이 정상 상태일 수 있으므로 background worker 는 idle 종료를 사용한다.
