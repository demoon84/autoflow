# Autoflow

`Autoflow` 는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트를 위한 로컬 작업 하네스다.

현재 패키지는 공개 배포 가능한 `repo template + installer CLI` 방식으로, 프로젝트 안에 파일 기반 AI 작업 보드를 설치한다. Autoflow 가 직접 코딩 모델이 되는 것이 아니라, 여러 local agent runner 가 안전하게 같은 보드 큐를 소비할 수 있는 운영 레이어를 제공한다.

핵심 목표는 이것이다.

- 실제 프로젝트 안에 `.autoflow/` 보드를 생성한다.
- 보드 상태는 프로젝트 로컬 파일로 남긴다.
- 설치는 공개 저장소의 CLI/스크립트로 수행한다.
- spec 부터 verifier 까지 `tickets/` 보드가 실행 원장이 된다.
- 완료된 작업과 의사결정은 향후 `wiki/` layer 에 사람이 읽기 좋은 지도로 축적한다.

예를 들어 `tetris` 프로젝트에 적용하면 목표 구조는 아래와 같다.

```text
tetris/
  AGENTS.md
  .autoflow/
    AGENTS.md
    README.md
    agents/
    automations/
    reference/
    rules/
    scripts/
    tickets/
      plan/
      inprogress/
      done/
      reject/
  src/
  public/
  package.json
```

여기서 `.autoflow/docs/` 는 필요하면 나중에 직접 추가하는 선택 폴더다.
프로젝트별 온보딩 메모나 테스트 명령 모음은 둘 수 있지만, 상태 폴더에는 실제 작업 문서만 둔다. 설명서와 템플릿은 `reference/` 에 모으고, 검증 기준 문서는 `rules/verifier/` 아래에 둔다. planner 가 실제 todo ticket 을 만들면 대응 spec 과 plan 은 `tickets/done/<project-key>/` 로 이동한다. plan / ticket / verification / log 문서는 `[[project_NNN]]`, `[[plan_NNN]]`, `[[tickets_NNN]]`, `[[verify_NNN]]` 형태의 옵시디언 링크도 함께 남겨 서로 연결한다.

중요한 구분:

- `tickets/` 는 실행 원장이다. 실제 상태, 책임자, 검증 결과, reject reason 은 여기서 판단한다.
- `wiki/` 는 이해의 지도다. 완료된 작업, 결정, 실패 패턴을 재사용 가능한 지식으로 정리하지만 완료 판정의 source of truth 는 아니다.
- `runners/` 는 process state 다. Codex/Claude/OpenCode/Gemini CLI 같은 실행기가 어떤 역할로 움직이는지 기록하지만 ticket stage 를 대체하지 않는다.

## Spec Handoff Direction

Codex/Claude 대화창에서 `#autoflow` 라고 말하는 흐름은 **spec handoff 전용 진입점**으로 둔다.

- 대화창에서는 사용자 요구를 정리해 spec 만 작성한다.
- 저장 대상은 `.autoflow/tickets/backlog/project_NNN.md` 하나다.
- plan / todo / verifier 는 Autoflow 보드와 runner 가 이어받는다.
- 긴 대화가 작업 상태를 대신하지 않는다. 대화는 spec 과 compact summary 로만 보드에 연결된다.

현재 구현된 수동 트리거는 `#spec`, `#plan`, `#todo`, `#veri` 이다. `#autoflow` alias, local runner 실행, desktop terminal controls 는 이후 runner harness 단계에서 추가한다.

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
- `BOARD_ROOT`: `PROJECT_ROOT/.autoflow`

이 스캐폴드에서는 아래 원칙을 쓴다.

- 보드 문서와 실행 기록은 `BOARD_ROOT` 아래에 둔다.
- 실제 제품 코드는 `PROJECT_ROOT` 에 둔다. git 저장소에서는 todo 가 티켓별 worktree 를 만들어 그 복제 루트에서 제품 코드를 수정한다.
- 티켓의 `Allowed Paths` 는 repo-relative 경로로 적고, 실제 구현 시에는 티켓 `Worktree.Path` 기준으로 해석한다. worktree 를 쓸 수 없는 환경에서만 `PROJECT_ROOT` 기준으로 fallback 한다.
- `rules/`, `tickets/` 참조는 `BOARD_ROOT` 기준으로 적는다.
- 검증 규칙과 템플릿은 `rules/verifier/` 아래에 둔다.
- `tickets/backlog/` 는 아직 plan 전인 spec 입력 큐다.
- `tickets/plan/` 은 ticket 생성 전 plan 대기열이다.
- `tickets/inprogress/` 는 planner 가 ticket 생성 중인 `plan_*.md` 와 todo worker 가 구현 중인 `tickets_*.md` 를 함께 두는 점유 구역이다.
- `tickets/done/<project-key>/` 는 완료 티켓, 처리된 spec, ticket 생성이 끝난 plan 을 프로젝트 단위로 모은다.
- `reference/` 는 state 폴더 밖에서 README 와 템플릿을 관리하는 곳이다.

## Canonical Flow

```text
PROJECT_ROOT
  -> .autoflow/tickets/backlog
  -> .autoflow/tickets/plan
  -> .autoflow/tickets/inprogress
  -> .autoflow/automations
  -> .autoflow/tickets/todo
  -> .autoflow/tickets/inprogress
  -> .autoflow/rules/verifier
  -> .autoflow/tickets/inprogress/verify_NNN.md
  -> .autoflow/logs
  -> .autoflow/tickets/done/<project-key>/verify_NNN.md
```

## When This Fits

아래 같은 상황이면 이 구조가 잘 맞는다.

- `tetris` 같은 실제 프로젝트 안에 AI 운영 보드를 같이 두고 싶을 때
- 여러 Codex 대화창이나 heartbeat worker 가 병렬로 작업을 나눠 처리할 때. 단, Codex 대화 하나는 한 번에 `#spec` / `#plan` / `#todo` / `#veri` 각각 active 항목 하나만 처리한다.
- Codex, Claude Code, OpenCode, Gemini CLI 를 작업별 runner 로 바꿔가며 쓰고 싶을 때
- 대화창이 늘어나도 프로젝트의 spec / ticket / verifier / done 숫자를 보드에서 세고 싶을 때
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

기본 보드 폴더 이름은 `.autoflow` 이다.

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

Windows 에서 file-watch hook 루프를 직접 돌릴 때는 아래 PowerShell helper 를 쓴다.

```powershell
./bin/autoflow.ps1 watch D:\project\astra
```

창을 띄우지 않고 백그라운드 프로세스로 운영하려면 아래를 쓴다. PID 와 stdout/stderr 는 `.autoflow/logs/hooks/` 에 남는다.

```powershell
./bin/autoflow.ps1 watch-bg D:\project\astra
./bin/autoflow.ps1 watch-stop D:\project\astra
```

현재 보드가 제공하는 로컬 작업 흐름:

- `#spec`
- `#plan`
- `#todo`
- `#veri`

즉:

- `Autoflow` CLI 는 설치와 배포 진입점을 제공한다.
- `render-heartbeats`, `status`, `doctor`, `upgrade` 는 현재 보드 상태를 AI 친화적인 `key=value` 출력과 안전한 갱신 계약으로 다룬다.
- 생성된 로컬 보드는 작업 보드 흐름을 제공한다.
- runner execution, embedded desktop terminals, adapter-specific local CLI invocation 은 계획된 다음 단계다. 현재 문서는 그 방향을 고정하지만, 아직 기존 `#spec/#plan/#todo/#veri` 흐름을 대체하지 않는다.

권장 시작 순서는 아래와 같다.

1. `autoflow init` 으로 보드를 만든다.
2. `autoflow status` 와 `autoflow doctor` 로 초기 상태를 확인한다.
3. `#spec` 으로 사용자와 대화해 정리된 spec 을 `tickets/backlog/` 에 남긴다. 같은 대화창에 active spec 이 있으면 새 번호를 만들지 않고 그 spec 만 이어 쓴다.
4. `#plan` 으로 planner heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 populated spec 을 읽어 plan 을 만들고, ticket 생성 시 plan 을 `tickets/inprogress/plan_NNN.md` 로 점유한 뒤 `tickets/todo/` 를 생성한다. 같은 대화창에 active plan 이 있으면 새 plan 을 잡지 않고 그 plan 만 이어 처리한다. 실제 ticket 생성이 끝나면 대응 spec 과 plan 은 `tickets/done/<project-key>/` 로 이동해 backlog / plan 루트에서는 빠진다.
5. `#todo` 로 todo heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `todo/` 를 `inprogress/` 로 옮기고 티켓별 git worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다. 같은 Codex 대화/worker 에 기존 `inprogress` 티켓이 있으면 새 claim 대신 그 티켓을 재개한다.
   이때 stop-hook runtime context 는 역할 문맥과 현재 ticket 문맥을 나눠 갖고, 각 todo tick 이 끝나면 전체 clear 대신 현재 ticket 문맥만 비운다. 상관관계는 Obsidian links, `References`, `Resume Context`, run/log 파일로 재구성한다.
6. `#veri` 로 verifier heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `verifier/` 를 검사해 티켓 `working_root` 에서 검증한다. 같은 대화창에 active verifier 티켓이 있으면 새 티켓을 잡지 않고 그 티켓만 이어 검증한다. pass 면 `integrate-worktree` 런타임으로 코드 변경을 중앙 `PROJECT_ROOT` 에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 `reject/reject_NNN.md` 로 이동하고, 완료 로그를 `logs/` 에 남긴다.
   브라우저 확인이 필요해도 기본값은 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 이며 Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 쓰고, 현재 턴에서 연 브라우저/탭은 같은 턴에서 닫고 끝내야 한다.
   이 역할은 `PROJECT_ROOT` / `BOARD_ROOT` / ticket worktree 범위 안의 검증 명령, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 을 추가 허락 없이 바로 수행한다.
7. heartbeat 세트를 파일로 관리하고 싶다면 `automations/heartbeat-set.toml` 을 채우고 `autoflow render-heartbeats` 로 role별 heartbeat TOML 묶음을 만든다.
8. 파일 업로드나 폴더 변경에 바로 반응시키고 싶다면 `./bin/autoflow.ps1 watch-bg <project-root>` 로 file-watch hook 루프를 백그라운드에서 실행한다. 디버깅할 때만 `watch` foreground 모드를 쓰고, 멈출 때는 `watch-stop` 을 실행한다. 이 watcher 는 `tickets/backlog/`, `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더, `tickets/todo/`, `tickets/verifier/` 를 감시하고 `logs/hooks/` 에 기록을 남긴다.

## Branding

현재 브랜드 전략은 아래와 같다.

- 제품/배포 이름: `Autoflow`
- 로컬 보드 폴더: `.autoflow/`
- 현재 보드 명령 예시: `init .autoflow`, `#plan` 등 기존 흐름 유지

즉 브랜드는 `Autoflow` 로 가져가되, 실제 프로젝트 경로는 당분간 `.autoflow/` 으로 유지한다.

## Public Package Layout

```text
autoflow/
  bin/
    autoflow
  templates/
    board/
    host/
  reference/
  rules/
  scripts/
  tickets/
```

`bin/autoflow` 는 설치 엔트리포인트이고, 실제로 프로젝트 안에 생성되는 상태 파일은 `.autoflow/` 아래에 남는다.

생성 대상은 현재 저장소 전체가 아니라 `templates/board/`, `templates/host-AGENTS.md`, 그리고 선택된 runtime 문서/스크립트다.
즉 새 프로젝트에는 이 저장소의 내부 plan, 샘플 ticket, 플러그인 실험 파일이 들어가지 않는다.

생성된 보드에는 `.autoflow-version` 이 기록되고, `status` 와 `doctor` 는 이 값을 패키지 버전과 비교한다.

## Script Hooks

생성된 `.autoflow/scripts/` 의 훅은 보드 상태 전환을 맡는다.

- `start-spec.sh`
- `start-plan.sh`
- `start-todo.sh`
- `handoff-todo.sh`
- `start-verifier.sh`
- `start-spec.ps1`
- `start-plan.ps1`
- `start-todo.ps1`
- `handoff-todo.ps1`
- `start-verifier.ps1`
- `check-stop.sh`
- `check-stop.ps1`
- `codex-stop-hook.ps1`
- `run-hook.ps1`
- `watch-board.ps1`

Windows 에서는 `.ps1` 래퍼를 우선 실행한다. `bin/autoflow.ps1` 는 top-level CLI 를 `scripts/cli/*.ps1` 로 dispatch 하고, 생성 보드의 runtime 도 `scripts/*.ps1` 래퍼를 우선 쓴다. 이 `.ps1` 래퍼들은 경로와 `AUTOFLOW_*` 환경 변수를 안전하게 변환해 기존 `.sh` 구현을 호출한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

이 스크립트들은 결정적인 파일 이동과 상태 갱신을 맡고, 실제 구현 판단은 에이전트가 이어받는다.

`watch-board.ps1` 는 OS 파일 이벤트를 받아 route 별 훅을 한 번씩 dispatch 하는 장기 실행 watcher 다. minute heartbeat 가 외부 사유로 끊기는 환경에서는 이 watcher 를 함께 두는 쪽이 더 안정적이다. 평소에는 `watch-bg` 로 숨김 프로세스 실행을 사용하고, watcher 자체는 사용자가 `watch-stop` 으로 멈출 때까지 계속 살아 있다. 상세 실행 기록은 `logs/hooks/` 에 남긴다.

`codex-stop-hook.ps1` 는 Codex 전역 Stop hook 에 연결하는 Autoflow 자체 dispatcher 다. `CODEX_PROJECT_DIR` 또는 현재 작업 폴더에서 `.autoflow/scripts/check-stop.ps1` 를 찾아 실행하고, 보드가 없거나 내부 오류가 나면 진단 로그만 남긴 뒤 조용히 통과한다.

자동화 철학은 "남은 일이 있는데 너무 일찍 멈추지 않게 하기"다. `Autoflow` 는 단일 작업 계획 파일 대신 보드 파일을 source of truth 로 쓰고, Codex 자동화는 필요할 때 1분 heartbeat 형태의 wake-up 계층으로 붙이되 각 heartbeat 는 `plan`, `todo`, `verifier` 중 자기 역할만 수행하는 쪽을 기준으로 한다.
`#todo` / `#veri` 는 tick 이 끝날 때 active ticket context 를 비워 토큰 사용을 줄이고, 다음 tick 에는 보드 파일과 Obsidian links 를 다시 읽어 재개한다. role / worker context 는 유지하므로 사용자가 "멈춰"라고 하기 전까지 heartbeat 연속성은 유지된다.

역할 분리형 운영에서는 아래 환경 변수를 쓰는 편이 좋다.

- `AUTOFLOW_ROLE`
- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_EXECUTION_POOL`
- `AUTOFLOW_VERIFIER_POOL`
- `AUTOFLOW_BACKGROUND`

예:

- spec author: manual only (`#spec`)
- planner worker: `AUTOFLOW_ROLE=plan`, `AUTOFLOW_WORKER_ID=plan-1`, `AUTOFLOW_BACKGROUND=1`
- todo worker: `AUTOFLOW_ROLE=todo`, `AUTOFLOW_WORKER_ID=todo-1`, `AUTOFLOW_BACKGROUND=1`
- verifier worker: `AUTOFLOW_ROLE=verifier`, `AUTOFLOW_WORKER_ID=verify-1`, `AUTOFLOW_BACKGROUND=1`

pool 예시는 숫자가 고정이 아니다.

- todo 2개:
  - `AUTOFLOW_EXECUTION_POOL=todo-1,todo-2`
- todo 4개:
  - `AUTOFLOW_EXECUTION_POOL=todo-1,todo-2,todo-3,todo-4`
- todo 10개:
  - `AUTOFLOW_EXECUTION_POOL=todo-1,todo-2,todo-3,todo-4,todo-5,todo-6,todo-7,todo-8,todo-9,todo-10`

- verifier 1개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1`
- verifier 3개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1,verify-2,verify-3`

`#plan`, `#todo`, `#veri` 는 모두 먼저 1분 heartbeat 자동화를 생성 또는 재개하고, 사용자가 "멈춰"라고 하기 전까지 자동화가 계속 살아 있어야 한다.
`#todo` 는 `점유 + 이동 + 구현 + verifier 이동` 을 같은 worker 안에서 계속 이어가는 훅이다.

24시간 heartbeat 운영에서는 `AUTOFLOW_BACKGROUND=1` 을 주는 편이 좋다. 이 모드에서는 "할 일 없음" 이 실패가 아니라 `status=idle` 로 출력되어 자동화가 조용히 다음 wake-up 을 기다린다.

또한 todo worker 는 execution pool 이 이미 꽉 찼거나 같은 worker 가 기존 `inprogress` 티켓을 갖고 있으면 새 티켓을 claim 하지 않는다. 여기서 execution pool 은 **구현을 진행할 수 있는 todo worker id 목록**을 뜻한다.

즉 이 구조는 6개 전용이 아니다.
`planner P / todo K / verifier M` 형태로 worker 수를 가변 운영하는 쪽이 기준이다.

실제 Codex heartbeat 세트를 만들 때는 생성된 보드의 `automations/heartbeat-set.toml` 을 먼저 채우고, 그다음 `autoflow render-heartbeats` 를 실행하면 된다. 렌더 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

## Upgrade Contract

`autoflow upgrade` 는 다음을 갱신한다.

- 공용 runtime 스크립트
- 공용 템플릿
- 보드 운영용 README/agent 문서
- 호스트 루트 `AGENTS.md`
- `.autoflow-version`

아래는 보존한다 (경로는 모두 생성된 `BOARD_ROOT/` 기준이며, 이 루트 패키지 소스에는 해당 파일들이 없다).

- `tickets/backlog/project_*.md`
- `tickets/plan/plan_*.md`
- `tickets/inprogress/plan_*.md`
- `tickets/*/tickets_*.md`
- `tickets/inprogress/verify_*.md` while verification is active
- `tickets/done/<project-key>/verify_*.md` or `tickets/reject/verify_*.md` after verification is settled
- `logs/verifier_*.md`

업그레이드 중 변경되는 공용 파일이 이미 수정되어 있으면, 이전 내용은 `BOARD_ROOT/.autoflow-upgrade-backups/<timestamp>/` 아래에 백업한다. 백업은 기본적으로 최신 5개만 보관하고 오래된 timestamp 백업은 업그레이드 끝에 자동 정리한다. 보관 개수는 `AUTOFLOW_UPGRADE_BACKUP_KEEP=10` 처럼 조절할 수 있다.

## Path Rules

예 (아래는 generated board 안에서 티켓이 쓰는 경로 형식이다. 이 루트 패키지 소스에는 이 파일들이 없다):

- 보드 문서 참조: `tickets/backlog/project_001.md` 또는 `tickets/done/project_001/project_001.md`
- plan 참조: `tickets/plan/plan_001.md`, `tickets/inprogress/plan_001.md`, 또는 `tickets/done/project_001/plan_001.md`
- done 티켓 경로: `tickets/done/project_001/tickets_001.md`
- 진행 중 검증 기록 참조: `tickets/inprogress/verify_001.md`
- 완료 후 검증 기록 참조: `tickets/done/project_001/verify_001.md`
- verifier completion log 참조: `logs/verifier_001_<timestamp>_<outcome>.md`
- 실제 작업 허용 경로: `src/`, `public/`, `package.json`

즉:

- `References` 는 `BOARD_ROOT` 상대 경로
- `Allowed Paths` 는 repo-relative 경로이며, 구현 중에는 티켓 worktree 루트 기준으로 해석한다
- `## Obsidian Links` 는 note 이름 기준 링크 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 를 남긴다

## 이 구조가 하려는 것

- 공개 저장소 형태로 쉽게 배포하기
- 실제 프로젝트 안에 삽입 가능한 하네스 sidecar 만들기
- 보드와 제품 코드를 물리적으로 분리하기
- 에이전트가 `.autoflow/` 보드만 읽어도 현재 흐름을 이해하게 하기
- 실제 코드 수정 범위는 티켓 worktree 안의 `Allowed Paths` 로 좁히기
- 여러 대화창이 동시에 `#spec` / `#plan` / `#todo` / `#veri` 를 실행해도 각 대화창은 자기 active 항목 하나만 처리하게 하기.
- 대화창이 멈췄다가 다시 시작되어도 `tickets/inprogress/` 기준으로 재개하게 하기
- 검증 기준과 검증 결과를 분리하기
- todo / verifier heartbeat 가 자기 owner 와 상태 큐를 계속 따라가게 하기

## 가장 중요한 규칙

- 티켓 파일 이름은 `tickets_001.md` 처럼 번호 기반으로 만든다.
- 한 티켓은 한 번에 한 상태 폴더에만 존재한다.
- `done/<project-key>/` 으로 옮기기 전에 verifier 가 `tickets/inprogress/verify_*.md` 를 준비해야 하고, 완료 후에는 그 기록도 `done/<project-key>/verify_*.md` 또는 `reject/verify_*.md` 로 정리돼야 한다. verifier completion log 는 `logs/` 에 남아 있어야 한다.
- 티켓을 만들기 전에 관련 계획 항목이 `tickets/plan/` 에 있어야 한다.
- 티켓 생성 전에는 실제 `tickets/backlog/*.md` 가 있어야 한다.
- 티켓 생성이 끝난 spec 과 plan 은 `tickets/done/<project-key>/` 로 이동해야 한다.
- `Allowed Paths` 는 repo-relative 경로로 적고, 구현은 티켓 worktree 기준으로 진행한다. worktree 가 없을 때만 `PROJECT_ROOT` 기준으로 fallback 한다.
- `#spec`, `#plan`, `#todo`, `#veri` 는 서로 다른 역할을 섞지 않는다.
- `#plan`, `#todo`, `#veri` 는 먼저 1분 heartbeat 자동화를 붙이고, 사용자가 멈추라고 하기 전까지 자동화가 계속 살아 있어야 한다.
- planner 는 현재 plan 을 ticketed 로 만든 뒤 active context 를 비운다. backlog 에 populated spec 이 남아 있으면 다음 tick 이 보드에서 다시 읽되, 같은 대화창에서 동시에 두 plan 을 active 처리하지 않는다.
- `#todo` 는 단순 이동 훅이 아니라 `점유 + 이동 + 구현 + verifier 이동` 훅이다.
- 티켓 제목, Goal, Done When 문구가 검증처럼 보여도 파일이 `tickets/todo/` 또는 `tickets/inprogress/` 에 있으면 todo worker 가 구현을 진행한다. pass / fail 판정은 verifier 만 한다.
- `inprogress/` 티켓에는 항상 재개 가능한 상태 요약이 남아 있어야 한다.
- 24시간 자동화에서는 "할 일 없음" 이 정상 상태일 수 있으므로 background worker 는 idle 종료를 사용한다.
