# Local Board

이 폴더는 호스트 프로젝트 안에서 운영되는 로컬 AI 작업 보드다.

Autoflow 보드는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트가 같은 작업 원장을 보고 움직이게 하는 local harness layer 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 기준은 이 보드 파일이다.

핵심 원칙은 단순하다.

- 기준 큐는 `tickets/backlog/`
- 순서는 `tickets/plan/`
- 실행 단위는 `tickets/`
- 검증 기준과 템플릿은 `rules/verifier/`
- 검증 증거는 `tickets/runs/`
- verifier 완료 이력은 `logs/`

운영 구분:

- `tickets/` 는 실행 원장이다.
- `wiki/` 는 완료된 작업과 결정을 정리하는 이해의 지도다.
- `runners/` 는 local process state 이며 ticket stage 를 대체하지 않는다.

## First Use

1. `#spec` 으로 사용자와 대화해 내용을 정리하고, 저장이 확정되면 `tickets/backlog/project_{NNN}.md` 에 남긴다. 향후 `#autoflow` 는 Codex/Claude 대화창에서 spec 만 넘기는 handoff alias 로 추가한다.
2. 원하면 `scripts/install-stop-hook.sh install` 또는 Windows 에서 `scripts/install-stop-hook.ps1 install` 을 한 번 실행한다. 그러면 현재 보드 `check-stop.*` 가 Codex Stop hook 에 연결되어, `#plan`, `#todo`, `#veri` 가 턴을 마칠 때도 남은 role work 가 있으면 autopilot 스킬처럼 너무 이른 종료를 막는다. 이 훅은 heartbeat / watcher 를 대체하지 않고 보완한다.
3. `#plan` 으로 planner heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 populated spec 을 읽어 plan 을 도출한다. `start-plan.sh` 는 plan 을 `tickets/inprogress/plan_NNN.md` 로 점유한 뒤 각 Execution Candidate 에 대해 `pending_ticket` 블록을 출력하고, planner agent 가 그 블록마다 `tickets/todo/tickets_NNN.md` 본문을 `reference/ticket-template.md` 기반으로 직접 작성한다 (`Plan Candidate` 는 candidate 글자 그대로; Title/Goal/Done When/Verification 은 spec 맥락 반영). 모든 Candidate 가 ticket 화되면 대응 spec/plan 은 `tickets/done/<project-key>/` 로 이동한다.
4. `#todo` 로 todo heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `todo/` 를 `inprogress/` 로 옮기고 티켓별 git worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
5. `#veri` 로 verifier heartbeat 를 1분 주기로 생성 또는 재개한다. 이 heartbeat 는 `verifier/` 를 검사해 티켓 `working_root` 에서 검증한다. pass 면 `integrate-worktree` 런타임으로 코드 변경을 중앙 프로젝트 루트에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 `reject/reject_NNN.md` 로 이동하고, 완료 로그를 `logs/` 에 남긴다.
   이 역할은 호스트 프로젝트, 보드, ticket worktree 범위 안의 검증 명령, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 을 추가 허락 없이 바로 수행한다.
6. 위 heartbeat 는 사용자가 명시적으로 "멈춰"라고 하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기다.
7. heartbeat 대신 파일 변화에 더 빨리 반응시키고 싶다면 watcher 를 같이 둔다. Bash/macOS/Linux 에서는 `scripts/watch-board.sh`, Windows 에서는 `scripts/watch-board.ps1` 를 실행한다. 이 watcher 는 `tickets/backlog/`, `tickets/reject/`, `tickets/done/` 하위 프로젝트 폴더, `tickets/todo/`, `tickets/verifier/` 를 감시하고 `logs/hooks/` 에 hook 실행 기록을 남긴다. heartbeat 와 같이 두면 상태 전환 직후 보통 1~2초 안에 다음 route 가 깨어나서 59초 대기를 크게 줄인다.

직접 heartbeat 세트를 관리하고 싶다면 생성된 `automations/heartbeat-set.toml` 을 수정한 뒤 `autoflow render-heartbeats` 를 실행하면 된다. 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

macOS/Linux 에서는 보드 루트에서 아래처럼 watcher 를 직접 띄울 수 있다. 이 방식은 디버깅용 foreground 실행이다.

```bash
./scripts/watch-board.sh
```

Windows 에서는 보드 루트에서 아래처럼 watcher 를 직접 띄울 수 있다. 이 방식은 디버깅용 foreground 실행이다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\watch-board.ps1
```

창 없는 운영은 설치 CLI 쪽에서 아래처럼 실행한다.

```bash
./bin/autoflow watch-bg /path/to/project
./bin/autoflow watch-stop /path/to/project
```

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
  - `adapters/`: Codex, Claude, OpenCode, Gemini CLI, shell adapter contracts
- `automations/`: 1분 heartbeat 자동화 계약, file-watch 설정, 템플릿
- `conversations/`: 승인된 대화 요약과 spec handoff 기록
- `reference/`: state 폴더 밖에서 관리하는 README 와 템플릿
- `rules/`: verifier 기준과 wiki 유지보수 기준 문서
- `rules/wiki/`: wiki page / lint 기준
- `runners/`: local runner 설정, 상태, 프로세스 로그
- `metrics/`: board transition 에서 파생되는 수치 파일
- `wiki/`: 완료된 작업과 의사결정을 정리하는 LLM-maintained project map
- `tickets/`: todo / inprogress / verifier / done / reject 상태 보드
- `tickets/backlog/`: 아직 plan 전인 spec 입력 큐
- `tickets/plan/`: 아직 ticket 생성 전인 plan 대기열
- `tickets/inprogress/`: planner 가 ticket 생성 중인 `plan_*.md` 와 todo worker 가 구현 중인 `tickets_*.md` 를 함께 두는 점유 구역
- `tickets/runs/`: 검증 기록
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
- `run-hook.sh`
- `watch-board.sh`
- `install-stop-hook.sh`
- `start-spec.ps1`
- `start-plan.ps1`
- `start-todo.ps1`
- `handoff-todo.ps1`
- `start-verifier.ps1`
- `install-stop-hook.ps1`
- `run-hook.ps1`
- `watch-board.ps1`

Windows 에서는 `.ps1` 진입점을 우선 실행한다. stop-hook / watcher 경로는 PowerShell 네이티브로 동작하고, 일부 role runtime 은 현재도 shared `.sh` 런타임을 함께 사용한다. Bash 환경에서는 `.sh` 를 직접 실행해도 된다.

`install-stop-hook.*` 는 현재 보드 `check-stop.*` 를 Codex Stop hook manifest (`~/.codex/hooks.json`) 에 설치 / 제거 / 상태 확인하는 helper 다. 이미 있던 다른 Stop hook 은 유지하고, 현재 보드 command 만 idempotent 하게 추가 / 제거한다.
`run-hook.*` / `watch-board.*` 는 file-watch 쪽 one-shot dispatcher 와 watcher 다.

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

- `watch-board.sh`, `watch-board.ps1`
  - 장기 실행 watcher 다.
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
- `tickets/` 는 실행 원장이고, `wiki/` 는 완료된 작업과 의사결정을 읽기 좋게 정리한 지도다.
- `runners/` 는 로컬 프로세스 상태만 담으며 ticket stage 를 대체하지 않는다.
- 완료 판정은 `tickets/` 와 verifier 기록으로 한다. `wiki/` 는 이해를 돕는 파생 문서다.
- local runner / embedded terminal / adapter execution 은 계획된 다음 단계이며, 현재 board lifecycle 은 기존 `#spec`, `#plan`, `#todo`, `#veri` 흐름을 유지한다.
- 검증 명령은 `start-verifier.sh` 가 출력한 `working_root` 에서 실행한다. 티켓 worktree 가 있으면 worktree 가 우선이고, 없으면 호스트 프로젝트 루트다.
- 자동화는 사용자가 멈추라고 하기 전까지 계속 살아 있어야 한다.
- board stage 가 authoritative 다. pass / fail 판정은 verifier 만 한다.
