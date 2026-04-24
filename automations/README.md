# Automations

이 폴더는 `PROJECT_ROOT/.autoflow/` 안에서 쓰는 자동화 훅 규칙을 정의한다.

## Reference Model

`Autoflow` 의 heartbeat 는 "매 분 깨어나 현재 보드 상태를 다시 확인하는 자동화"다.

핵심 해석:

- 자동화 자체가 상태를 저장하지 않는다.
- source of truth 는 항상 `.autoflow/` 보드 파일이다.
- 할 일이 없으면 해당 wake-up 턴만 `status=idle` 로 끝난다.
- `status=idle` 은 자동화 종료가 아니라 다음 1분 wake-up 대기다.
- 사용자가 명시적으로 "멈춰"라고 하기 전까지 자동화는 pause / delete / self-stop 하지 않는다.

별도로, `Autoflow` 는 OS 파일 이벤트를 받는 file-watch hook 모드도 지원한다. 이 모드는 `scripts/watch-board.ps1` 가 폴더 변경을 감지해 route 별 one-shot 훅을 실행하는 구조이며, watcher 프로세스 자체는 사용자가 멈출 때까지 계속 살아 있다.

## Trigger Contract

대화창에서 아래 문구를 받으면 이렇게 해석한다.

- `#spec`
  - heartbeat 없이 수동 모드다.
  - 사용자와 대화해 정리된 spec 을 `tickets/backlog/project_{NNN}.md` 에 저장한다.
  - `tickets/plan/` 은 건드리지 않는다.

- `#plan`
  - 현재 스레드에 1분 planner heartbeat 를 생성 또는 재개한다.
  - 같은 턴에서 첫 planner tick 도 바로 수행한다.
  - populated spec 이 있으면 plan 을 도출하고 `tickets/todo/` 로 분해한다.
  - `tickets/reject/reject_NNN.md` 를 계속 감시해 reject reason 을 plan 에 반영하고, 재시도 todo 생성 뒤에는 프로젝트별 done 폴더로 보관한다.

- `#todo`
  - 현재 스레드에 1분 todo heartbeat 를 생성 또는 재개한다.
  - 같은 턴에서 첫 todo tick 도 바로 수행한다.
  - `tickets/todo/` 를 `inprogress/` 로 옮기고 같은 worker 가 구현한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `todo` / `inprogress` 이면 todo worker 가 구현을 계속 진행한다.
  - 완료되면 `tickets/verifier/` 로 넘긴다.

- `#veri`
  - 현재 스레드에 1분 verifier heartbeat 를 생성 또는 재개한다.
  - 같은 턴에서 첫 verifier tick 도 바로 수행한다.
  - `tickets/verifier/` 를 검사해 pass 면 `done/` + local commit, fail 면 `tickets/reject/reject_NNN.md` 로 이동한다.
  - verifier 완료 시마다 `logs/` 아래 completion log 를 남긴다.
  - verifier 는 프로젝트/보드 범위 안의 검증 명령, 브라우저 확인, verifier 관련 파일 이동, local `git add` / `git commit` 을 추가 허락 없이 바로 수행한다.
  - `git push` 는 절대 금지다.

## Heartbeat Policy

Codex 자동화를 쓴다면 기본 모델은 아래다.

- 자동화 종류:
  - thread heartbeat
- 권장 주기:
  - 1분
- source of truth:
  - `.autoflow/` 보드 파일

주의:

- heartbeat 는 작업 큐를 다시 확인하는 용도다.
- heartbeat 자체가 rules/ticket 상태를 대신 저장하지 않는다.
- 보드에 할 일이 없으면 현재 wake-up 만 종료하는 것이 맞다.
- 서로 다른 자동화는 각자 자기 역할만 수행해야 한다.

## Stop Hook Guard

Codex Stop hook 은 Autoflow 자체 dispatcher 인 `scripts/codex-stop-hook.ps1` 를 전역 hook 으로 연결한다.

- dispatcher 는 `CODEX_PROJECT_DIR`, `AUTOFLOW_BOARD_ROOT`, 현재 작업 폴더를 기준으로 활성 보드의 `scripts/check-stop.ps1` 를 찾는다.
- 보드 내부 판정은 `check-stop.ps1` / `check-stop.sh` 가 맡고, 현재 thread context 의 role 에 따라 plan / todo / verifier 잔여 작업만 block 한다.
- 보드가 없거나 hook 내부 오류가 나면 `%USERPROFILE%\.codex\log\autoflow-stop-hook.log` 에 진단만 남기고 통과한다.
- 따라서 hook 실패 때문에 Codex UI 에 `Stop hook failed` 가 떠서는 안 된다.

## File Watch Mode

heartbeat 가 외부 사유로 자주 끊기거나, 폴더에 파일이 올라오자마자 바로 반응해야 하면 file-watch hook 모드를 같이 둔다.

- watcher:
  - `scripts/watch-board.ps1`
- 설정:
  - `automations/file-watch.psd1`
- 로그:
  - `logs/hooks/`
- 감시 경로:
  - `tickets/backlog/`
  - `tickets/reject/`
  - `tickets/done/` 하위 프로젝트 폴더
  - `tickets/todo/`
  - `tickets/verifier/`

동작 원칙:

- `tickets/backlog/`, `tickets/reject/reject_NNN.md` 변경 → `plan` route 실행
- `tickets/done/<project-key>/` 변경 → `plan` route 실행
- `tickets/todo/` 변경 → `todo` route 실행
- `tickets/verifier/` 변경 → `verifier` route 실행
- 각 hook run 은 한 번의 현재 턴만 처리하고 종료하지만, watcher 프로세스는 계속 살아 있다.
- watcher 는 스스로 종료하지 않는다. 사용자가 프로세스를 멈출 때까지 폴더 이벤트를 계속 기다린다.

Windows 에서는 보드 루트에서 아래처럼 직접 실행할 수 있다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\watch-board.ps1
```

일상 운영에서는 패키지 CLI 의 백그라운드 모드를 권장한다. 이 모드는 새 터미널 창을 띄우지 않고 PID 파일과 로그만 남긴다.

```powershell
.\bin\autoflow.ps1 watch-bg D:\project\astra
.\bin\autoflow.ps1 watch-stop D:\project\astra
```

## Hook Map

- `#spec` (manual trigger only — no heartbeat)
  - 대상: `BOARD_ROOT/tickets/backlog/`
  - 역할: 사용자와 대화해 정리된 spec 을 `tickets/backlog/project_{번호}.md` 에만 저장
  - Windows 진입점: `scripts/start-spec.ps1`
  - Bash 진입점: `scripts/start-spec.sh`
  - 참고: `agents/spec-author-agent.md`

- `#plan` (heartbeat)
  - 대상: `BOARD_ROOT/tickets/backlog/`, `BOARD_ROOT/tickets/plan/`, `BOARD_ROOT/tickets/reject/`, `BOARD_ROOT/tickets/done/`
  - 역할:
    1. populated spec 이 있고 대응 plan 이 없으면 실제 plan 도출
    2. draft plan + populated spec + candidates 준비됨 → script 가 ready 로 auto-flip
    3. ready plan → candidates 당 `tickets/todo/` 티켓 생성
    4. `tickets/reject/reject_NNN.md` 감시해 실패 티켓의 `## Reject Reason` 을 새 candidate 로 재반영하고, 재시도 todo 생성 뒤 `tickets/done/<project-key>/reject_NNN.md` 로 보관
    5. `tickets/done/<project-key>/` 변경이나 기존 backlog 잔량을 신호로 삼아, 다음 populated spec 이 남아 있으면 이어서 다음 plan 을 도출
  - Windows 진입점: `scripts/start-plan.ps1`
  - Bash 진입점: `scripts/start-plan.sh`
  - 참고: `agents/plan-to-ticket-agent.md`

- `#todo` (heartbeat)
  - 대상: `BOARD_ROOT/tickets/todo/`, `BOARD_ROOT/tickets/inprogress/`
  - 역할: todo 에서 한 티켓을 점유해 `inprogress/` 로 옮기고 **같은 worker 가 구현까지 진행**. 완료 시 `handoff-todo` 런타임으로 `tickets/verifier/` 로 넘기고 active ticket context 를 비움.
  - Windows 진입점: `scripts/start-todo.ps1`
  - Bash 진입점: `scripts/start-todo.sh`
  - 완료 handoff: Windows `scripts/handoff-todo.ps1`, Bash `scripts/handoff-todo.sh`
  - 참고: `agents/todo-queue-agent.md`

- `#veri` (heartbeat)
- 대상: `BOARD_ROOT/rules/verifier/`, `BOARD_ROOT/tickets/verifier/`, `BOARD_ROOT/tickets/inprogress/verify_*.md`, `BOARD_ROOT/logs/`, `BOARD_ROOT/tickets/done/`, `BOARD_ROOT/tickets/reject/`
  완료된 검증 기록은 `tickets/done/<project-key>/verify_*.md` 또는 `tickets/reject/verify_*.md` 로 정리된다.
  - 역할: `tickets/verifier/` 의 티켓을 검증해 **pass → `tickets/done/<project-key>/` + local commit**, **fail → `tickets/reject/reject_NNN.md` + `## Reject Reason`**, 그리고 완료 로그를 `logs/` 에 남김
  - Windows 진입점: `scripts/start-verifier.ps1`
  - Bash 진입점: `scripts/start-verifier.sh`
  - 참고: `agents/verifier-agent.md`

## Operating Principle

자동화는 폴더별 책임을 섞지 않는다.

- `#spec` 은 수동 훅이다. plan 파일을 건드리지 않는다.
- `#plan` 은 spec 에서 plan 을 도출하고 reject 를 재계획한다.
- 현재 plan 을 ticketed 로 만들었거나 verifier 가 `done/` 으로 넘겼더라도 backlog 에 다음 populated spec 이 남아 있으면 planner 는 계속 다음 plan 으로 이어간다.
- `#todo` 는 claim + 구현 + verifier handoff 를 같은 worker 안에서 끝낸다.
- board stage 가 authoritative 다. 티켓이 `todo/` 또는 `inprogress/` 에 있으면 todo worker 가 구현을 진행하고, pass / fail 판정은 verifier 만 한다.
- `#veri` 는 검증 + pass 시 local commit + fail 시 reject 이동만 맡는다.
- 모든 heartbeat 는 사용자가 멈추라고 하기 전까지 계속 살아 있고, 빈 턴에서는 `status=idle` 로 조용히 다음 wake-up 을 기다린다.

## Context Lifecycle

런타임 context 는 heartbeat stop hook 과 active ticket 재개용 상태다. 모델 대화 히스토리를 직접 지우는 기능이 아니라, 다음 tick 이 어떤 역할과 티켓을 이어받을지 알려 주는 작은 state 파일이다.

- `#spec`: heartbeat 를 만들지 않고 active ticket context 도 만들지 않는다.
- `#plan`: `start-plan.*` 가 role=`plan` 을 남기되 active ticket 은 비워 둔다. planner 는 다음 tick 에 backlog / reject / plan 파일을 다시 읽는다.
- `#todo`: tick 중에는 claim / resume 대상 티켓을 active ticket 으로 잡을 수 있다. tick 이 끝나면 Stop hook 이 active ticket context 를 비우고, 다음 tick 은 `tickets/inprogress/`, `Resume Context`, `Next Action`, `Notes` 를 다시 읽는다.
- `#veri`: tick 중에는 검증 대상 티켓을 active ticket 으로 잡을 수 있다. tick 이 끝나면 Stop hook 이 active ticket context 를 비우고, 다음 tick 은 `tickets/verifier/`, `tickets/inprogress/verify_NNN.md`, `logs/` 를 다시 읽는다.
- 전체 context 삭제는 사용자가 `멈춰` 라고 해서 heartbeat / stop hook 연속성을 끝낼 때만 쓴다. 평소에는 role / worker context 를 유지하고 active ticket 만 비운다.

## Worker Identity Contract

운영에서는 아래 환경 변수를 권장한다.

- `AUTOFLOW_ROLE`
  - `plan`
  - `todo`
  - `verifier`
- `AUTOFLOW_WORKER_ID`
  - 예: `plan-1`, `todo-2`, `verify-1`
- `AUTOFLOW_EXECUTION_POOL`
  - 구현을 진행할 수 있는 todo worker id 목록
  - 예: `todo-1,todo-2,todo-3`
- `AUTOFLOW_VERIFIER_POOL`
  - 예: `verify-1,verify-2`
- `AUTOFLOW_BACKGROUND`
  - 예: `1`
- `AUTOFLOW_MAX_EXECUTION_LOAD_PER_WORKER`
  - 기본값: `1`

권장 방식:

- planner heartbeat 는 plan / reject 큐만 본다.
- todo heartbeat 는 자기 `Execution Owner` 또는 `Owner` 와 맞는 `inprogress` 티켓을 우선 이어서 구현한다.
- todo heartbeat 는 기존 `inprogress` 재개 시 active ticket context 를 현재 ticket 에 맞추고, verifier handoff 시에는 `handoff-todo` 런타임으로 전체 context 삭제 대신 active ticket context 만 비운다.
- verifier heartbeat 는 pass / fail log 작성 뒤 active ticket context 를 비운다. 다음 tick 은 대화 히스토리보다 Obsidian links, ticket `References`, run/log 파일을 다시 읽어 재개한다.
- todo heartbeat 는 필요할 때만 새 `todo` 티켓을 claim 한다.
- verifier heartbeat 는 자기 `Verifier Owner` 와 맞는 `verifier` 티켓을 우선 잡는다.
- `AUTOFLOW_EXECUTION_POOL` 은 "별도 execution worker" 풀이 아니라, 구현을 수행할 todo worker id 목록이다.

## Recommended Topology

worker 수를 고정하지 않는다. 기본 형태는 아래처럼 읽는다.

- planner P
- todo worker K
- verifier worker M

예:

- todo 2개:
  - `AUTOFLOW_EXECUTION_POOL=todo-1,todo-2`
- todo 5개:
  - `AUTOFLOW_EXECUTION_POOL=todo-1,todo-2,todo-3,todo-4,todo-5`
- verifier 3개:
  - `AUTOFLOW_VERIFIER_POOL=verify-1,verify-2,verify-3`

즉 scaling 은 "worker 추가 + pool 갱신" 으로 한다.

## Thread Coordination Rules

여러 Codex 스레드나 heartbeat worker 가 동시에 돌아도 아래 원칙은 유지한다.

- `#plan` 은 spec / plan / reject 만 다룬다.
- `#todo` 는 `Claimed By`, `Execution Owner`, `Verifier Owner` 를 남기고 같은 worker 가 구현을 계속 이어간다.
- `#veri` 는 `tickets/verifier/` 만 검사하고, pass 면 local commit, fail 면 reject reason 을 남긴다.
- blocker 가 생겨도 티켓을 다시 `todo/` 로 되돌리기보다 `inprogress/` 에 남기고 메모를 갱신한다.
- reject 원본은 `reject_NNN.md` 로 남기고, planner 가 새 candidate → 새 ticket 번호로 재시도 todo 를 만든 뒤 프로젝트별 done 폴더로 보관한다.

## Non-Goals

현재 이 폴더에는 machine-readable heartbeat template 파일과 project-owned starter set 파일이 들어 있다.

즉 지금 있는 것은:

- 있음:
  - 트리거와 정책 문서
  - 생성된 보드의 `automations/heartbeat-set.toml`
  - `automations/templates/` 아래 role별 heartbeat TOML template
  - `autoflow render-heartbeats` 로 만든 `automations/rendered/<set-name>/` 출력물
- 아직 없음:
  - 실제 Codex automation 등록 스크립트
  - stop hook 자동 등록 CLI

## Template Files

직접 heartbeat 세트를 파일로 관리할 때는 아래 순서로 진행한다.

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
  - todo worker heartbeat
- `automations/templates/verifier-heartbeat.template.toml`
  - verifier worker heartbeat

주의:

- 실제 Codex automation id 와 thread id 는 환경마다 다르므로 placeholder 를 채워야 한다.
- 위 자동화도 사용자가 멈추라고 하기 전까지는 스스로 stop 하지 않는다.
