# Autoflow Board

이 디렉터리는 host project 안에 설치되는 로컬 AI work harness다.
Codex, Claude Code, local runner가 하나의 file-based source of truth를 공유하게 한다.

채팅 창에서 작업을 시작할 수 있지만, 작업 상태의 소유자는 보드다.

## 기본 흐름

기본적으로 Worker Mode를 사용한다.

1. 사용자가 intake path를 고른다.
   - **`/autoflow`**(Claude `/autoflow`, Codex `$autoflow`, `#autoflow`) — goal 기능을 켜고 PRD cycle을 한 번에 하나씩 진행해 목표 완료까지 반복한다.
   - **`/aprd`**(Claude `/aprd`, Codex `$aprd`, `#aprd`) — 논의나 multi-slice planning이 필요한 scope를 위한 full PRD handoff.
   - **`/atodo`**(Claude `/atodo`, Codex `$atodo`, `#atodo`, 또는 `autoflow todo create`) — single-file mechanical work를 위해 complete worker-claimable todo를 `tickets/todo/`에 바로 쓴다.
2. `/autoflow`에서는 agent가 host goal 기능을 실제로 확인하고, 현재 목표를 세운 뒤 active PRD cycle이 끝날 때까지 다음 `/aprd`를 만들지 않는다. PRD cycle은 PRD 1개 발행 → todo 1개 이상 생성 → 모든 todo done → 워커 러너의 PRD squash merge까지가 한 단위다. `/autoflow` agent는 흐름 관리자이며 제품 코드를 직접 수정하거나 워커 러너 action을 실행하지 않는다.
3. `/aprd`에서는 agent가 짧은 질문과 decision recap 중심의 가벼운 chat으로 requirement를 모은다. 하나의 안전한 handoff에 비해 scope가 크면 draft 전에 짧은 PRD split map을 제안한다. 사용자가 explicit draft trigger(`초안`, `draft` 등)를 보낸 뒤 save trigger(`save`, `저장` 등)를 보내야 PRD가 `tickets/prd/PRD-NNN.md`에 기록된다.
4. `/atodo`에서는 agent가 `Title`, `Goal`, 구체적인 `Allowed Paths`, 관찰 가능한 `Done When`, verification command를 가진 complete `tickets/todo/Todo-NNN.md` 하나를 쓴다. 사용자의 원 요청은 `## Notes` 아래에 원문 그대로 보존한다.
5. 플래너 러너는 채워진 각 PRD를 하나 이상의 `tickets/todo/Todo-NNN.md` 파일로 promote 하고, worker work가 멈추거나 깨졌을 때 ticket markdown에 다음 행동과 근거를 정리한다. `/atodo`-direct ticket은 건드리지 않는다.
6. 워커 러너는 `tickets/inprogress/`에서 ticket 하나를 만들거나 claim 한다.
7. 같은 워커가 mini-plan을 쓰고, 구현하고, local verification을 실행하고 판단한 뒤, 어떤 `PROJECT_ROOT` merge보다 먼저 `autoflow tool runner-tool worker submit-to-verifier`를 호출해 verifier로 handoff 한다.
8. 검증 러너는 semantic alignment를 확인하고 pass, revise, replan 중 하나를 선택한다.
9. pass 시 verifier는 marker를 기록하고 merge/finalization을 위해 worker를 깨운다. PRD track에서는 워커가 PRD worktree에 done 상태를 누적하고, 마지막 TODO에서 PRD branch를 main/master에 squash merge한 뒤 `autoflow tool runner-tool worker finalize-approved`를 완료한다. atodo track에서는 워커가 direct TODO worktree를 main/master에 squash merge한다.
10. revise 시 verifier는 worker를 깨워 같은 worktree를 유지하고 issue를 수정한 뒤 verifier에 다시 제출하게 한다.
11. replan 시 verifier는 worker를 깨워 `autoflow tool runner-tool worker request-replan`을 실행하게 한다. 이 작업은 worktree를 정리하고 같은 `tickets/todo/Todo-NNN.md` 파일을 todo queue로 되돌리며, `Goal Runtime.Replan Count` / `Replan Decision` / `Replan Fingerprint`를 증가시키고 `## Replan Reason` block을 추가한다. 워커는 이후 tick에서 다시 claim 한다.
12. finalization runtime은 verifier marker와 merged result를 mechanical sanity gate로 검증하고, ticket 안에 최종 verification evidence를 남긴 뒤 local commit과 함께 `tickets/done/<project-key>/`로 이동한다.
13. 위키 러너는 source change weight가 debounce threshold를 넘으면 나중에 derived knowledge를 refresh 한다.
14. 같은 `Replan Fingerprint`가 `Replan Max`에 도달한 replan은 `Replan Decision=needs_user`로 바뀌며, 사용자가 redirect 할 때까지 ticket을 `tickets/todo/`에 park 한다. `done/<key>/`에는 성공한 ticket만 들어간다.

Legacy role-pipeline mode(`#plan`, `#todo`)는 compatibility를 위해 남아 있지만 기본 흐름은 아니다.

## 주요 디렉터리(보드별)

- `tickets/prd/`: `/aprd`에서 승인되어 플래너 러너가 todo ticket을 발행하기를 기다리는 PRD.
- `tickets/todo/`: 플래너가 발행했거나, `/atodo`가 직접 작성했거나, verifier replan이 되돌린 ticket. 다음으로 worker가 claim 한다.
- `tickets/inprogress/`: active Worker ticket. ticket 하나당 live worktree는 하나만 둔다.
- `tickets/verifier/`: semantic review를 기다리는 verifier-lane ticket copy.
- `tickets/done/<project-key>/`: 성공한 ticket, archived PRD, legacy history. 성공한 work만 들어간다. replan은 work를 `tickets/todo/`로 되돌릴 뿐 `done/`에 쓰지 않는다.
- `tickets/archive/`: manual 또는 compatibility archive space이며 live queue가 아니다.
- `automations/`: stop-hook, startup scan, context contract.
- `runners/`: local runner configuration, state, log.
- `conversations/`: approved handoff summary.
- `metrics/`: progress snapshot.
- `wiki/`: derived project knowledge.

## 공유 정적 자원(user-scope)

Static template, agent prompt, contract, rule, sqlite ledger schema는 보드마다 복제하지 않는다. user-scope share root(default `~/.autoflow/share/`, `AUTOFLOW_SHARE_ROOT`로 override)에 한 벌만 두고 `autoflow init` / `autoflow upgrade`가 채우거나 refresh 한다.

- `~/.autoflow/share/agents/`: human 또는 local runner agent가 사용하는 role instruction.
- `~/.autoflow/share/protocols/`: AI-first orchestration, worker, blocked/replan 계약.
- `~/.autoflow/share/reference/`: template과 board reference material.
- `~/.autoflow/share/rules/`: verification과 wiki maintenance rule.
- `~/.autoflow/share/state-schema/v1.sql`: 각 board의 `state.db`에 적용되는 schema.

## 러너와 러너 도구

Autoflow는 네 기본 **runner**를 사용한다.

- `planner`: PRD queue item을 worker-ready todo ticket으로 바꾸고 stalled work의 다음 행동을 보드에 정리한다.
- `worker`: todo ticket 하나를 claim 하고, 구현하고, local verification을 수행하고, AI-led merge를 준비한다.
- `verifier`: finished diff를 ticket title, goal, Done When item과 비교한다.
- `wiki`: 완료된 work와 decision을 derived wiki knowledge로 바꾼다.

기준 responsibility boundary는 `~/.autoflow/share/reference/runner-tool-contract.md`다. 짧게 말하면 runner는 LLM-backed decision-maker이고, runner tool은 runner가 명시적 행동 하나를 위해 호출하는 작고 결정론적인 command다. Runner tool은 scope 선택, `Done When` 작성, pass/revise/replan 결정, merge strategy 결정, wiki meaning 결정, 전체 workflow 운전을 해서는 안 된다.

현재 split tool은 `autoflow tool runner-tool` 뒤에 있다. 설치된 tool catalog와 contract summary는 `autoflow tool list`로 확인한다. 큰 script-driven flow는 coarse runtime helper일 뿐이다. 특히 `autoflow run worker`와 compatibility alias `autoflow run ticket`은 startup context다. active/todo state는 보고할 수 있지만 ticket을 choose/claim 하거나, worktree를 만들거나, worker에게 implementation fallback으로 `PROJECT_ROOT`를 넘기면 안 된다.

Desktop PTY session은 여러 project가 동시에 `worker` runner를 열어둘 수 있도록 project root와 board directory를 기준으로 내부 scope를 둘 수 있다. 그 내부 key는 board state가 아니다. runner state file, runner output, user-facing output은 public runner id를 계속 사용해야 한다.

## Trigger 요약

- Claude `/aprd` / Codex `$aprd` / `#aprd`: PRD handoff 전용. 명시적 save approval 이후 `tickets/prd/PRD-NNN.md`를 쓴다.
- Claude `/atodo` / Codex `$atodo` / `#atodo` / `autoflow todo create`: direct todo intake 전용. worker-required field를 가진 complete `tickets/todo/Todo-NNN.md`를 쓴다.
- Claude `/autoflow` / Codex `$autoflow` / `#autoflow`: goal 기반 orchestration 전용. PRD cycle은 PRD 1개 발행 → todo 전체 처리 → 워커 러너의 PRD branch squash merge까지 끝난 뒤 다음 부족분을 분석한다. 완료 전에는 다음 PRD를 만들지 않는다. 현재 대화 에이전트가 제품 구현, worker claim/action, verifier decision을 직접 수행하지 않는다.
- `autoflow runners start planner`: planner runner state를 기록/준비한다. 장기 실행 PTY session 시작은 데스크톱 앱에서 수행한다.
- `autoflow run worker` / alias `autoflow run ticket` / `autoflow runners start worker`: worker startup/state surface. Worker implementation은 여전히 worker runner와 runner tool로 진행된다: todo claim → mini-plan → implementation → local verification → verifier pass/revise/replan handling → runner-led merge → done.
- `autoflow runners start wiki`: wiki runner state를 기록/준비한다. 일반 wiki runner turn은 `autoflow tool runner-tool wiki tick`으로 시작한다. `autoflow run wiki`는 deterministic baseline update이며 full tick loop가 아니다.
- `autoflow wake [planner|worker|verifier|wiki|auto]`: Desktop이 열려 있고 대상 러너가 실행 중일 때 현재 보드 queue를 다시 읽게 하는 수동 wake 요청을 남긴다. 제품 구현이나 검증 판단을 대신 수행하지 않는다.
- `autoflow guard`: AI-authored markdown edit 이후 board invariant와 leftover ticket worktree를 검사하는 safety-kernel validation.
- Desktop worker runner: UI에서 시작하는 기본 worker execution.
- `#plan`: legacy planner compatibility trigger. 플래너 러너가 대체한다.
- `#todo`: legacy todo compatibility trigger. 워커 러너가 todo를 직접 claim 한다.

## Spec Handoff 규칙(`/aprd`)

Spec handoff는 구현을 시작하지 않는다.

Agent는 다음을 지켜야 한다.

1. `~/.autoflow/share/agents/spec-author-agent.md`를 읽는다.
2. 가능하면 `autoflow spec create`로 spec slot을 reserve 또는 resume 한다.
3. 짧은 질문과 decision recap으로 누락된 goal, scope, allowed paths, acceptance criteria, verification detail을 모은다.
4. scope가 크면 boundary, dependency order, verification focus를 담은 가벼운 PRD split map을 제안한다.
5. 사용자가 explicit draft trigger(`초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft` 또는 같은 뜻)를 주기 전까지 complete PRD draft를 보여주지 않는다.
6. draft trigger 이후 complete spec을 chat에 보여주고 모르는 값은 `TBD` / `undecided`로 표시한다. split work는 각 PRD draft를 분리해 보여준다.
7. 별도 explicit user approval 이후에만 저장한다. draft trigger는 save approval이 아니다.
8. `tickets/prd/`와 선택적 `conversations/` archive에만 저장한다. Split PRD는 별도 PRD file이어야 하며 `Conversation Handoff` 또는 `Notes`에 sibling reference를 둔다.

## Direct Todo 규칙(`/atodo`)

Direct todo intake는 구현을 시작하지 않지만, worker-claimable contract를 만든다.

Agent는 다음을 지켜야 한다.

1. work가 clear `Allowed Paths`를 가진 single-file mechanical work인지 확인한다. 정말 불명확하면 사용자를 `/aprd`로 redirect 한다.
2. required field(`Title`, `Goal`, `Allowed Paths`, `Done When`, `Verification.Command`)가 있는 complete `tickets/todo/Todo-NNN.md`를 쓴다.
3. 사용자의 원 요청을 `## Notes` 아래 `User request: ...`로 원문 보존한다.
4. chat에서 full PRD를 작성하지 않는다.
5. code, verification record, commit, push를 건드리지 않는다.

## Worker 규칙

Worker work는 좁고 durable 해야 한다.

- 한 worker는 한 번에 한 ticket만 처리한다.
- 가능한 경우 ticket worktree 안에서 작업한다.
- `Allowed Paths`만 편집한다.
- `Notes`, `Resume Context`, `Verification`, `Result`를 durable state로 갱신한다.
- planner-authored `Next Action`/`Notes` instruction이 있으면 따른다. blocked 또는 recovered 상태가 되면 갱신한다.
- claim, worktree setup, status snapshot, evidence recording, mechanical check에는 `autoflow tool runner-tool worker ...`를 우선한다. 작은 tool이 macro를 아직 대체하지 못한 곳에서만 legacy runtime script를 사용한다.
- worktree pass 시 AI worker는 먼저 verifier에 handoff 한다. verifier가 revise라고 하면 같은 worktree를 유지하고 다시 제출한다. verifier가 replan이라고 하면 `worker request-replan`을 실행해 worktree를 정리하고 ticket을 `tickets/todo/`로 되돌린다. verifier pass 이후에만 worker가 approved change를 `PROJECT_ROOT`로 merge 하고, conflict를 해결하고, 필요한 verification을 다시 실행한 뒤 finish/finalization script를 bookkeeping tool로 사용한다.
- push 하지 않는다.

## Verification 규칙

Verification은 evidence-based여야 한다.

- ticket working root에서 지정 command를 실행한다.
- command exit code만이 아니라 acceptance criteria를 확인한다.
- 유용할 때 stdout/stderr summary를 기록한다.
- rendered behavior를 관찰해야 할 때만 browser tool을 사용한다.
- pass, revise, replan 결정에는 모두 ticket에 남는 durable verification evidence가 필요하다.

## Wiki 규칙

Wiki는 derived knowledge map이다. stage, claim, verifier decision, commit state의 source of truth가 아니다.

Wiki에는 다음을 요약한다.

- 완료된 work
- decision
- 알려진 pattern
- 반복 실패
- architecture note

## Legacy Coordinator Evidence

Coordinator는 4-runner topology의 runner가 아니다. 예전 책임은 worker(`worker`)가 implementation과 local verification evidence를, verifier(`verifier`)가 semantic diff review를, wiki(`wiki`)가 material wiki baseline refresh와 AI synthesis를 맡는 구조로 나뉘었다. 새 board는 coordinator runner를 추가하거나 시작하면 안 된다.

Legacy coordinator state를 검사한다면 compatibility evidence로만 취급한다. Board health(shared Allowed Path blocker, active-ticket worktree health, dirty `PROJECT_ROOT` overlap, shared non-base HEAD group, runner readiness, board scaffold issue)를 설명할 수는 있지만, 다음 action은 planner, worker, verifier, wiki 중 하나로 route 해야 한다. product code를 구현, 검증, rebase, cherry-pick, conflict resolve, merge 하면 안 된다. product-code repair와 merge는 worker runner의 책임이다. Finalization helper는 worker가 이미 result를 merge 하고 검증한 뒤에만 local completion commit을 만들 수 있다. 완료된 ticket worktree와 그 `autoflow/tickets_*` branch는 completion commit 전에 finalization runtime이 삭제해 board가 merged worktree를 누적하지 않게 한다. Repair, requeue, reset, non-completed worktree 삭제, push는 별도 human-directed action이다.

## 작성 기준

설치 보드의 모든 Markdown 본문은 간결하고 AI가 읽기 쉬운 한국어로 작성한다. 명령어, 경로, 코드, runner id, ticket field, parser-sensitive heading, key=value 출력, runtime format처럼 기계가 읽는 부분은 필요한 원래 표기를 유지한다.

좋은 보드 문서는 다음 조건을 만족한다.

- 경로가 명확하다.
- claim 주체가 명확하다.
- 다음 action이 명확하다.
- 검증에서 관찰 가능하다.
- chat compaction 이후에도 보드 파일만으로 안전하게 resume할 수 있다.
