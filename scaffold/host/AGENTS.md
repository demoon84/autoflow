# AGENTS.md

이 프로젝트는 `{{BOARD_DIR}}/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `{{BOARD_DIR}}/` 안에 있다.

Autoflow 는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `{{BOARD_DIR}}/tickets/` 보드다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `{{BOARD_DIR}}/README.md`
2. `{{BOARD_DIR}}/rules/README.md`
3. `{{BOARD_DIR}}/reference/backlog.md`
4. `{{BOARD_DIR}}/reference/plan.md`
5. `{{BOARD_DIR}}/automations/README.md`
6. `{{BOARD_DIR}}/reference/tickets-board.md`
7. `{{BOARD_DIR}}/rules/verifier/README.md`
8. 관련 문서:
   - spec 정리면 `{{BOARD_DIR}}/agents/spec-author-agent.md`
   - 기본 실행이면 `{{BOARD_DIR}}/agents/ticket-owner-agent.md`
   - plan 도출 / reject 재계획이면 `{{BOARD_DIR}}/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `{{BOARD_DIR}}/agents/todo-queue-agent.md`
   - verifier 검사면 `{{BOARD_DIR}}/agents/verifier-agent.md`

## Root Rules

1. 보드 문서는 `{{BOARD_DIR}}/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. Ticket Owner 또는 legacy todo 는 git 저장소에서 티켓별 worktree 를 우선 사용하고, worktree 가 없을 때만 프로젝트 루트 기준으로 fallback 한다.
4. `{{BOARD_DIR}}/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있지만, 병렬 작업에서는 티켓별 worktree 안에서 수정한다.
5. 기본 토폴로지는 **Plan AI 1개 + Impl AI 1개 + Wiki AI 1개** 의 3-runner 모델이다. Plan AI(`planner-1`) 가 backlog/reject 를 todo 로 흘려보내면, Impl AI(`owner-1`) 가 todo claim 부터 mini-plan, 구현, 검증, AI-led merge, done/reject 이동을 한 번에 끝낸다. Wiki AI(`wiki-1`) 는 `tickets/done/` + `tickets/reject/` 변동을 감지해 `{{BOARD_DIR}}/wiki/` 의 AI synthesis 를 갱신한다. 세 runner 는 디스조인트한 경로만 만지므로 동시에 ticking 해도 충돌이 발생하지 않는다.
6. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 역할 분리보다 `autoflow run ticket` / owner runner 를 우선한다.
7. 위 heartbeat 자동화는 사용자가 명시적으로 "멈춰"라고 말하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기 상태다.
8. ticket owner 또는 verifier 는 local commit 을 할 수 있고, `git push` 는 어떤 자동화에서도 절대 금지다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. ticket owner 또는 verifier 는 `{{BOARD_DIR}}/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. local runner 와 adapter one-shot execution 은 지원한다. embedded terminal 은 별도 단계로 추가한다. 기본 자동화는 Claude `/af` / `/autoflow` 또는 Codex `$af` / `$autoflow` skill handoff 뒤 `autoflow run ticket` 또는 Owner runner 로 이어지고, `#af` / `#autoflow` 는 호환 alias 로 유지한다. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거로 유지한다.
14. heartbeat / runner tick 이 종료될 때는 현재 공정률을 표기한다. 가능하면 `autoflow metrics` 또는 보드의 spec/ticket 집계를 기준으로 한 percent 를 tick 의 마지막 대화/로그 요약에 남긴다.
15. 문서 언어 정책: AI / runner 가 주로 읽는 Markdown 문서 (`{{BOARD_DIR}}/agents/`, `rules/`, `reference/`, ticket, verification, log, runtime contract)는 영어 또는 AI 친화적인 구조로 작성한다. 사람이 읽어야 하는 문서 (제품 README, 데스크톱 UI 문구, 사용자 가이드, 사용자 대상 릴리스 노트)는 기본적으로 한국어로 작성한다. 두 독자가 함께 보는 문서는 AI용 계약은 영어로, 사람용 설명은 한국어로 분리한다.
15a. 터미널 / adapter / heartbeat 에서 사용자가 읽는 AI 대화, 진행 요약, 설명 문장은 기본적으로 한국어로 쓴다. 단, key=value 출력, 경로, 명령어, 코드, ticket 필드, parser 가 읽는 형식, AI용 보드 계약은 원래 포맷과 언어를 유지한다.

## Trigger Interpretation

- `#af`
  - Claude `/af`, Codex `$af` 와 같은 PRD handoff alias 다.
  - 사용자와 대화해 내용을 정리하고, 사용자가 명시적으로 저장을 허락하면 `{{BOARD_DIR}}/tickets/backlog/prd_{NNN}.md` 에 PRD 만 남긴다.
  - `{{BOARD_DIR}}/tickets/plan/` 은 건드리지 않는다.

- `#autoflow`
  - Claude `/autoflow`, Codex `$autoflow` 와 같은 PRD handoff alias 다.
  - Codex/Claude 대화창에서 요구사항을 정리해 `{{BOARD_DIR}}/tickets/backlog/prd_{NNN}.md` PRD 만 넘긴다.
  - 이후 ticket owner runner 가 Autoflow 보드에서 mini-plan / 구현 / 검증 / evidence 를 한 번에 이어받는다.
  - 현재 프로젝트에 이 alias 구현이 없다면 `#af` 와 같은 원칙으로 처리하되, plan / ticket / 구현은 시작하지 않는다.

- `#plan`
  - legacy role-pipeline 호환 트리거다. 기본 실행은 `ticket-owner` 다.
  - 현재 스레드의 planner heartbeat 를 1분 주기로 생성 또는 재개한다.
  - populated spec 이 있으면 계속 처리해 plan 을 작성하고, start-plan 런타임으로 `{{BOARD_DIR}}/tickets/todo/` 티켓을 만든다.
  - 실제 ticket 생성이 끝난 spec 과 plan 은 `{{BOARD_DIR}}/tickets/done/<project-key>/` 로 이동한다.
  - `{{BOARD_DIR}}/tickets/reject/reject_NNN.md` 도 계속 감시해 reject reason 을 plan 에 반영하고 새 todo 로 다시 보낸 뒤, 해당 reject 기록은 `{{BOARD_DIR}}/tickets/done/<project-key>/reject_NNN.md` 로 보관한다.
  - 현재 plan 이 ticketed 가 됐거나 verifier 가 `{{BOARD_DIR}}/tickets/done/<project-key>/` 으로 넘긴 뒤에도 backlog 에 다음 populated spec 이 남아 있으면 계속 다음 plan 으로 이어간다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#todo`
  - legacy role-pipeline 호환 트리거다. 기본 실행은 `ticket-owner` 다.
  - 현재 스레드의 todo heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `{{BOARD_DIR}}/tickets/todo/` 가 있으면 `inprogress/` 로 옮기고 티켓별 worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `{{BOARD_DIR}}/tickets/todo/` 또는 `{{BOARD_DIR}}/tickets/inprogress/` 이면 legacy todo worker 가 구현을 계속 진행한다.
  - 작업이 끝나면 `{{BOARD_DIR}}/tickets/verifier/` 로 이동한다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#veri`
  - legacy role-pipeline 호환 트리거다. 기본 실행은 `ticket-owner` 다.
  - 현재 스레드의 verifier heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `{{BOARD_DIR}}/tickets/verifier/` 가 있으면 `working_root` 에서 검증하고, pass 면 worktree 변경을 중앙 프로젝트 루트에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 이유를 적어 `reject/` 로 이동한다.
  - 브라우저 확인이 필요해도 먼저 비브라우저 확인을 우선하고, Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 쓰며 열린 탭은 같은 턴에서 닫는다.
  - `git push` 는 절대 금지다.
  - pass 로 끝났다고 전체 흐름이 끝난 것은 아니다. backlog 잔량이 있으면 planner 가 다음 plan 을 이어간다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.
