# Local Board

이 폴더는 호스트 프로젝트 안에서 운영되는 로컬 AI 작업 보드다.

핵심 원칙은 단순하다.

- 기준 큐는 `tickets/backlog/`
- 순서는 `tickets/plan/`
- 실행 단위는 `tickets/`
- 검증 기준과 템플릿은 `rules/verifier/`
- 검증 증거는 시작 시 `tickets/inprogress/verify_*.md`, 완료 후에는 final ticket 옆 `verify_*.md`
- verifier 완료 이력은 `logs/`

## First Use

1. `#spec` 으로 사용자와 대화해 내용을 정리하고, 저장이 확정되면 `tickets/backlog/project_{NNN}.md` 에 남긴다.
2. `#plan` 으로 planner heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 populated spec 을 읽어 plan 을 도출하고, ticket 생성 시 plan 을 `tickets/inprogress/plan_NNN.md` 로 점유한 뒤 `tickets/todo/` 를 만든다. 실제 ticket 생성이 끝난 spec 과 plan 은 `tickets/done/<project-key>/` 로 이동한다.
3. `#todo` 로 todo heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `todo/` 를 `inprogress/` 로 옮기고 티켓별 git worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
4. `#veri` 로 verifier heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `verifier/` 를 검사해 티켓 `working_root` 에서 검증한다. pass 면 `integrate-worktree` 런타임으로 코드 변경을 중앙 프로젝트 루트에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 `reject/reject_NNN.md` 로 이동하고, 완료 로그를 `logs/` 에 남긴다.
   이 역할은 호스트 프로젝트, 보드, ticket worktree 범위 안의 검증 명령, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 을 추가 허락 없이 바로 수행한다.
5. 위 heartbeat 는 사용자가 명시적으로 "멈춰"라고 하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기다.
6. heartbeat 대신 파일 이벤트 기반으로 계속 반응시키고 싶다면 `scripts/watch-board.ps1` 를 실행한다. 이 watcher 는 `tickets/backlog/`, `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더, `tickets/todo/`, `tickets/verifier/` 를 감시하고 `logs/hooks/` 에 hook 실행 기록을 남긴다.

직접 heartbeat 세트를 관리하고 싶다면 생성된 `automations/heartbeat-set.toml` 을 수정한 뒤 `autoflow render-heartbeats` 를 실행하면 된다. 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

Windows 에서는 보드 루트에서 아래처럼 watcher 를 직접 띄울 수 있다. 이 방식은 디버깅용 foreground 실행이다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\watch-board.ps1
```

창 없는 운영은 설치 CLI 쪽에서 아래처럼 실행한다.

```powershell
.\bin\autoflow.ps1 watch-bg D:\project\astra
.\bin\autoflow.ps1 watch-stop D:\project\astra
```

## Folder Map

- `agents/`: 역할 정의
  - `spec-author-agent.md`
  - `plan-to-ticket-agent.md`
  - `todo-queue-agent.md`
  - `verifier-agent.md`
- `automations/`: 1분 heartbeat 자동화 계약, file-watch 설정, 템플릿
- `reference/`: state 폴더 밖에서 관리하는 README 와 템플릿
- `rules/`: verifier 기준 문서
- `tickets/`: todo / inprogress / verifier / done / reject 상태 보드
- `tickets/backlog/`: 아직 plan 전인 spec 입력 큐
- `tickets/plan/`: 아직 ticket 생성 전인 plan 대기열
- `tickets/inprogress/`: planner 가 ticket 생성 중인 `plan_*.md` 와 todo worker 가 구현 중인 `tickets_*.md` 를 함께 두는 점유 구역
- `tickets/inprogress/verify_*.md`: 진행 중 검증 기록
- `tickets/done/<project-key>/verify_*.md`, `tickets/reject/verify_*.md`: 완료 후 정리된 검증 기록
- `logs/`: verifier 완료 로그
- `tickets/done/<project-key>/`: 프로젝트 단위로 모아 둔 완료 티켓, 처리된 spec, ticket 생성 완료 plan
- `scripts/`: 보드 runtime 훅

## Runtime Hooks

생성된 보드에는 아래 runtime 훅이 들어 있다.

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

Windows 에서는 `.ps1` 래퍼를 우선 실행한다. `.ps1` 래퍼는 경로와 `AUTOFLOW_*` 환경 변수를 안전하게 변환해 기존 `.sh` 런타임을 호출한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

`codex-stop-hook.ps1` 는 Codex 전역 Stop hook 에 연결하는 Autoflow 자체 dispatcher 다. 활성 보드의 `check-stop.ps1` 를 찾아 실행하고, 보드가 없거나 내부 오류가 나면 진단 로그만 남긴 뒤 조용히 통과한다.
`#todo` / `#veri` 는 tick 이 끝날 때 active ticket context 를 비워 토큰 사용을 줄이고, 다음 tick 에는 보드 파일과 Obsidian links 를 다시 읽어 재개한다. role / worker context 는 유지하므로 사용자가 "멈춰"라고 하기 전까지 heartbeat 연속성은 유지된다.

역할은 아래처럼 고정한다.

- `#spec`
  - 사용자와 대화해 정리된 spec 을 `tickets/backlog/` 에 남긴다.
  - heartbeat 는 붙이지 않는다.

- `#plan`
  - 1분 planner heartbeat 를 생성 또는 재개한다.
  - populated spec 이 있으면 plan 을 도출하고 `tickets/todo/` 를 만든다.
  - 현재 plan 이 ticketed 가 된 뒤에도 backlog 에 다음 populated spec 이 남아 있으면 계속 다음 plan 으로 이어간다.
  - `tickets/reject/reject_NNN.md` 를 계속 감시해 재계획하고, 재시도 todo 생성 뒤에는 `tickets/done/<project-key>/reject_NNN.md` 로 보관한다.

- `#todo`
  - 1분 todo heartbeat 를 생성 또는 재개한다.
  - `tickets/todo/` 를 `inprogress/` 로 옮기고 티켓별 git worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `todo` / `inprogress` 이면 todo worker 가 구현을 계속 진행한다.
  - 완료되면 `tickets/verifier/` 로 이동한다.

- `#veri`
  - 1분 verifier heartbeat 를 생성 또는 재개한다.
  - `tickets/verifier/` 를 검사해 `working_root` 에서 검증한다.
  - pass 면 worktree 변경을 중앙 프로젝트 루트에 통합한 뒤 `done/<project-key>/` + local commit, fail 면 `reject/reject_NNN.md` 로 이동한다.
  - 완료 시 `logs/` 아래 completion log 를 남긴다.
  - `git push` 는 절대 금지다.

- `watch-board.ps1`
  - 폴더 이벤트를 감시하는 장기 실행 watcher 다.
  - `automations/file-watch.psd1` 설정을 읽고 route 별 hook 을 dispatch 한다.
  - `done/<project-key>/` 완료 이벤트도 planner route 를 깨워 다음 backlog plan 이 있으면 이어서 진행한다.
  - watcher 자체는 사용자가 멈출 때까지 계속 살아 있고, 결과는 `logs/hooks/` 에 남긴다.

## Path Rules

- `References` 는 이 보드 루트 기준 상대 경로로 적는다.
- `Allowed Paths` 는 repo-relative 경로로 적고, 구현 중에는 티켓 `Worktree.Path` 기준으로 해석한다. worktree 를 쓸 수 없는 환경에서만 호스트 프로젝트 루트 기준으로 fallback 한다.
- `## Obsidian Links` 는 note 이름 기준 링크 (`[[project_001]]`, `[[plan_001]]`, `[[tickets_001]]`, `[[verify_001]]`) 로 적는다.

예:

- `References`: `tickets/backlog/project_001.md` 또는 `tickets/done/project_001/project_001.md`
- `Allowed Paths`: `src/`, `public/`, `package.json`

## Notes

- 실제 제품 코드는 이 보드 밖의 호스트 프로젝트 루트에 있다.
- 보드 상태 파일은 이 폴더 안에서 추적한다.
- 검증 명령은 `start-verifier.sh` 가 출력한 `working_root` 에서 실행한다. 티켓 worktree 가 있으면 worktree 가 우선이고, 없으면 호스트 프로젝트 루트다.
- 자동화는 사용자가 멈추라고 하기 전까지 계속 살아 있어야 한다.
- board stage 가 authoritative 다. pass / fail 판정은 verifier 만 한다.
