# AGENTS.md

이 프로젝트는 `autoflow/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `autoflow/` 안에 있다.

Autoflow 는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `autoflow/tickets/` 보드다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `autoflow/README.md`
2. `autoflow/rules/README.md`
3. `autoflow/reference/backlog.md`
4. `autoflow/reference/plan.md`
5. `autoflow/automations/README.md`
6. `autoflow/reference/tickets-board.md`
7. `autoflow/rules/verifier/README.md`
8. 관련 문서:
   - spec 정리면 `autoflow/agents/spec-author-agent.md`
   - 기본 실행이면 `autoflow/agents/ticket-owner-agent.md`
   - plan 도출 / reject 재계획이면 `autoflow/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `autoflow/agents/todo-queue-agent.md`
   - verifier 검사면 `autoflow/agents/verifier-agent.md`

## Root Rules

1. 보드 문서는 `autoflow/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. todo 는 git 저장소에서 티켓별 worktree 를 우선 사용하고, worktree 가 없을 때만 프로젝트 루트 기준으로 fallback 한다.
4. `autoflow/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있지만, 병렬 작업에서는 티켓별 worktree 안에서 수정한다.
5. 기본 실행 모델은 `ticket-owner` 다. 한 runner 가 ticket mini-plan, 구현, 검증, evidence, done/reject 이동을 끝까지 책임진다.
6. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 역할 분리보다 `autoflow run ticket` / owner runner 를 우선한다.
7. 위 heartbeat 자동화는 사용자가 명시적으로 "멈춰"라고 말하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기 상태다.
8. ticket owner 또는 verifier 는 local commit 을 할 수 있고, `git push` 는 어떤 자동화에서도 절대 금지다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. ticket owner 또는 verifier 는 `autoflow/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. local runner 와 adapter one-shot execution 은 지원한다. embedded terminal 은 별도 단계로 추가한다. 기본 자동화는 `#spec` / `#autoflow` handoff 뒤 `autoflow run ticket` 또는 Owner runner 로 이어지고, `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거로 유지한다.

## Trigger Interpretation

- `#spec`
  - 사용자와 대화해 내용을 정리하고, 사용자가 명시적으로 저장을 허락하면 `autoflow/tickets/backlog/project_{NNN}.md` 에 spec 만 남긴다.
  - `autoflow/tickets/plan/` 은 건드리지 않는다.

- `#autoflow`
  - spec handoff alias 다.
  - Codex/Claude 대화창에서 요구사항을 정리해 `autoflow/tickets/backlog/project_{NNN}.md` spec 만 넘긴다.
  - 이후 ticket owner runner 가 Autoflow 보드에서 mini-plan / 구현 / 검증 / evidence 를 한 번에 이어받는다.
  - 현재 프로젝트에 이 alias 구현이 없다면 `#spec` 과 같은 원칙으로 처리하되, plan / ticket / 구현은 시작하지 않는다.

- `#plan`
  - 현재 스레드의 planner heartbeat 를 1분 주기로 생성 또는 재개한다.
  - populated spec 이 있으면 계속 처리해 plan 을 작성하고, start-plan 런타임으로 `autoflow/tickets/todo/` 티켓을 만든다.
  - 실제 ticket 생성이 끝난 spec 과 plan 은 `autoflow/tickets/done/<project-key>/` 로 이동한다.
  - `autoflow/tickets/reject/reject_NNN.md` 도 계속 감시해 reject reason 을 plan 에 반영하고 새 todo 로 다시 보낸 뒤, 해당 reject 기록은 `autoflow/tickets/done/<project-key>/reject_NNN.md` 로 보관한다.
  - 현재 plan 이 ticketed 가 됐거나 verifier 가 `autoflow/tickets/done/<project-key>/` 으로 넘긴 뒤에도 backlog 에 다음 populated spec 이 남아 있으면 계속 다음 plan 으로 이어간다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#todo`
  - 현재 스레드의 todo heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `autoflow/tickets/todo/` 가 있으면 `inprogress/` 로 옮기고 티켓별 worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `autoflow/tickets/todo/` 또는 `autoflow/tickets/inprogress/` 이면 todo worker 가 구현을 계속 진행한다.
  - 작업이 끝나면 `autoflow/tickets/verifier/` 로 이동한다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#veri`
  - 현재 스레드의 verifier heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `autoflow/tickets/verifier/` 가 있으면 `working_root` 에서 검증하고, pass 면 worktree 변경을 중앙 프로젝트 루트에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 이유를 적어 `reject/` 로 이동한다.
  - 브라우저 확인이 필요해도 먼저 비브라우저 확인을 우선하고, Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 쓰며 열린 탭은 같은 턴에서 닫는다.
  - `git push` 는 절대 금지다.
  - pass 로 끝났다고 전체 흐름이 끝난 것은 아니다. backlog 잔량이 있으면 planner 가 다음 plan 을 이어간다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.
