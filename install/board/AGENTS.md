# AGENTS.md

이 보드는 host project 안에 설치된 Autoflow sidecar harness다.
기본 실행 모델은 **4-runner mode**다. 플래너 러너가 PRD를 todo ticket으로 promote 하고, 워커 러너가 구현을 소유하며, 검증 러너가 semantic fit을 확인하고, 위키 러너가 derived knowledge를 유지한다. 검증 러너 replan은 같은 ticket을 replan metadata와 함께 `tickets/todo/`로 되돌리고, revise는 같은 worktree를 유지한다.

## 기준 흐름

기본 4-runner flow:

```text
PROJECT_ROOT
  -> .autoflow/tickets/prd/PRD-NNN.md                 (user /aprd)
  -> .autoflow/tickets/todo/Todo-NNN.md               (planner-issued 또는 /atodo-direct)
  -> .autoflow/tickets/inprogress/Todo-NNN.md         (active worker, worktree 하나)
  -> .autoflow/tickets/verifier/Todo-NNN.md           (검증 러너 semantic review)
  -> .autoflow/tickets/done/<project-key>/Todo-NNN.md (성공한 work만)
```

검증 러너가 replan을 요청하면 워커는 `request-replan`을 실행한다. Worktree가 정리되고 ticket file은 같은 위치의 `tickets/todo/Todo-NNN.md`로 되돌아간다. 이때 `Goal Runtime.Replan Count`가 증가하고 `## Replan Reason` block이 추가된다. 워커는 다음 tick에서 다시 claim 할 수 있다. 검증 러너 revise는 같은 worktree를 유지한다. 별도 reject queue는 없다.

디렉터리 의미:

- `PROJECT_ROOT`: 실제 product repository root.
- `tickets/prd/`: `/aprd`(`$aprd`, `#aprd`)로 handoff 된 PRD queue.
- `tickets/todo/`: planner-issued ticket, `/atodo`-direct ticket, verifier-replan requeue. 모두 worker claim 대기 상태다.
- `tickets/inprogress/`: active Worker ticket. live worktree는 하나만 둔다.
- `tickets/done/<project-key>/`: passed ticket, archived PRD, verification evidence. 성공한 work만 들어간다.
- `automations/`: stop-hook, runner startup, runtime context contract.
- `wiki/`: 완료된 work에서 파생된 generated 및 human-maintained project knowledge.

Static template, agent prompt, contract, rule, sqlite schema는 **user-scope share root**(default `~/.autoflow/share/`, `AUTOFLOW_SHARE_ROOT`로 override)에 한 벌만 둔다.

- `~/.autoflow/share/agents/`: human 또는 local runner agent가 사용하는 role prompt.
- `~/.autoflow/share/protocols/`: AI-first orchestration, worker, blocked/replan 계약.
- `~/.autoflow/share/reference/`: template과 board reference material.
- `~/.autoflow/share/rules/`: operating rule과 wiki linting.
- `~/.autoflow/share/state-schema/v1.sql`: 각 board의 `state.db`에 적용되는 sqlite ledger schema.

작은 mechanical intake는 `/atodo`를 통해 곧장 `tickets/todo/`로 간다. 모호하거나 multi-slice scope는 `/aprd` → PRD → planner → todo 흐름을 거친다. 검증 러너 replan은 같은 ticket을 replan metadata와 함께 `tickets/todo/`로 in-place 되돌린다. retry order queue는 없다.

## 읽는 순서

작업 시작 시 아래 순서로 읽는다. `~/.autoflow/share/`로 시작하는 경로는 user-scope share root(default `~/.autoflow/share/`, `AUTOFLOW_SHARE_ROOT`로 override)에 있다.

1. `README.md`
2. `~/.autoflow/share/rules/README.md`
3. `~/.autoflow/share/reference/prd.md`
4. `~/.autoflow/share/reference/plan.md`
5. `automations/README.md`
6. `~/.autoflow/share/reference/tickets-board.md`
7. `~/.autoflow/share/reference/runner-tool-contract.md`
8. `~/.autoflow/share/reference/runner-startup-common.md`
9. `~/.autoflow/share/reference/runner-startup-rules/` 아래 역할별 startup rule
10. Role-specific file:
   - PRD handoff: `~/.autoflow/share/agents/spec-author-agent.md`
   - default execution(워커 러너): `~/.autoflow/share/agents/worker-agent.md`
   - orchestration(플래너 러너): `~/.autoflow/share/agents/plan-to-ticket-agent.md`
   - verifier review(검증 러너): `~/.autoflow/share/agents/verifier-agent.md`
   - wiki maintenance(위키 러너): `~/.autoflow/share/agents/wiki-maintainer-agent.md`

## 브랜치 / 워크트리 정책

ticket 발행 시점에 자동으로 brand + worktree 가 만들어진다. 사람이 직접 git 명령으로 만들지 않는다.

- `/aprd` → `autoflow spec create` → `autoflow/prd-NNN` 브랜치 + worktree 생성, PRD markdown 을 그 worktree 안에 commit.
- planner 가 PRD → todo 분할 (`write-ticket` 또는 `createTodoTicketsFromSpec`) → TODO markdown 을 해당 `autoflow/prd-NNN` worktree 안에 commit. PRD 파생 TODO는 `autoflow/TODO-NNN` 브랜치 + worktree를 만들지 않는다.
- `/atodo` → `autoflow todo create` → `autoflow/TODO-NNN` 브랜치 + worktree 생성 (base = main HEAD), todo markdown 그 worktree 안에 commit.
- 워커는 ticket claim 시 이미 만들어진 worktree 를 재사용한다. 같은 default cache path 라 자동으로 잡힘.
- PRD todo 완료 시 worker 가 done ticket을 PRD worktree/branch에 누적한다.
- PRD 의 모든 todo done 시 마지막 TODO를 완료한 worker 가 PRD 브랜치를 main 으로 단일 PRD commit squash.
- atodo 완료 시 worker 가 `autoflow/TODO-NNN` 브랜치를 main 으로 `git merge --squash`.

결과: main 의 commit log = PRD 별/atodo 별 단일 squash commit. ticket markdown + 코드 변경이 한 commit 에 묶임.

## Runtime Command 규칙

- 모든 runtime command는 `autoflow` CLI를 통해 호출한다. 보드는 데이터만 갖고, runtime code는 Autoflow source repo에 있다. CLI는 env var(`AUTOFLOW_BOARD_ROOT`, `AUTOFLOW_PROJECT_ROOT`)로 runtime에 dispatch 한다.
- Focused runner/startup surface: `autoflow run planner` / `run worker` / `run verifier` / `run wiki`. Compatibility alias `run ticket`과 `run todo`는 old board/prompt용으로 남아 있다.
- Mechanical helper와 runner-tool dispatch: `autoflow tool <name> [args...]`(예: `autoflow tool runner-tool worker claim --ticket Todo-NNN`, `autoflow tool verify-ticket`, `autoflow tool finish-ticket`, `autoflow tool handoff-todo`).
- Board guard: `autoflow guard`. Wiki 작성/갱신: `autoflow wiki write-page` (DB upsert, 디스크 markdown 안 만듦). Ticket lint check: `autoflow tool lint-ticket`.
- Direct todo creation: `autoflow todo create <project-root> <board-dir-name> --title "<title>" --allowed-path <path>... --done "<criterion>"... --verification "<cmd>"`.
- `planner`, `worker`, `verifier`, `wiki`는 runner다. 기준 runner/tool boundary는 `~/.autoflow/share/reference/runner-tool-contract.md`다. runner는 결정하고, runner tool은 하나의 명시적이고 결정론적인 행동을 실행해 검사 가능한 결과를 반환한다.
- Desktop은 live PTY session을 project root와 board directory로 내부 scope 할 수 있다. 그 내부 key를 board markdown에 저장하거나 언급하지 않는다. state file, log, runner output에는 public runner id(`planner`, `worker`, `verifier`, `wiki`)를 사용한다.
- Wiki 는 AI-only. `runners/state/wiki-search.db` (sqlite hybrid index) 안에만 산다. 디스크 markdown 파일은 만들지 않는다. `autoflow wiki write-page --path wiki/<slug>.md --content-file <file>` 로 chunk 분할 + BGE-M3 embedding(1024차원 Float32 BLOB) + DB upsert. `autoflow wiki query --rag` 로 검색하면 chunk text 가 DB 에서 직접 반환된다.

## 핵심 규칙

1. 승인된 PRD(`/aprd` flow) 또는 `/atodo`-direct intake 없이 ticket을 만들지 않는다. chat만 보고 ticket을 invent 하지 않는다.
2. Claude `/aprd`, Codex `$aprd`, compatibility alias `#aprd`는 PRD handoff trigger일 뿐이다. todo ticket, implementation change, verification record, commit, push를 만들지 않는다.
3. Claude `/atodo`, Codex `$atodo`, compatibility alias `#atodo`는 complete worker-claimable `tickets/todo/Todo-NNN.md`를 직접 쓴다. 사용자의 원 요청을 `## Notes` 아래에 보존하고 code change, verification record, commit, push를 만들면 안 된다.
4. 기본 실행 경로는 네 runner를 사용한다. `planner`는 PRD queue item을 todo work로 promote 하고 stalled ticket의 `Next Action`/`Notes`를 rewrite 한다. `worker`는 resulting ticket을 구현한다. `verifier`는 semantic alignment를 확인한다. `wiki`는 derived knowledge를 유지한다. 새 PRD queue item에는 worker startup surface(`autoflow run worker`, alias `autoflow run ticket`)보다 `autoflow run planner`를 먼저 선호한다. legacy planner/todo/verifier split은 compatibility-only다.
5. 워커 러너는 `Todo-NNN.md` 하나를 claim 하고, ticket 안에 mini-plan을 쓰고, `Allowed Paths` 안에서 구현하고, verification을 실행하고, evidence를 기록하고, verifier handoff를 요청한다. ticket이 verifier lane에 들어가면 semantic review는 검증 러너가 소유하며 pass/revise/replan을 반환한다.
5a. **모든 PRD는 `tickets/done/<project-key>/`로 archive 되기 전에 최소 하나의 Todo를 만들어야 한다.** 플래너 러너는 PRD-to-todo conversion(`createTodoTicketsFromSpec`가 archival 전 Todo를 작성)과 `runner-tool planner item-archive` boundary에서 이를 강제한다. 의도적인 research/audit-only PRD에 대해 `--force-archive-orphan`이 명시적으로 전달되지 않는 한 orphan archive를 거부한다. Todo가 0개인 PRD는 정상 상태가 아니라 board integrity violation이다.
6. Legacy `#plan`, `#todo`, `#veri`는 compatibility trigger로만 남는다.
7. Board stage가 권위다. ticket이 `todo/` 또는 `inprogress/`에 있으면 title이 review나 verification처럼 보여도 implementation work로 취급한다.
8. `Allowed Paths`는 repo-relative다. Git repository에서는 ticket worktree를 우선한다. ticket worktree가 없으면 path는 `PROJECT_ROOT` 기준으로 fallback 한다.
9. 사용자가 명시적으로 scope를 확장하지 않는 한 `Allowed Paths` 밖을 편집하지 않는다.
10. automation 또는 agent work에서 `git push`를 실행하지 않는다. Remote publication은 항상 human decision이다.
11. 워커는 local verification command를 실행하고, 필요할 때 built-in browser tool을 사용하고, 다시 묻지 않고 board file을 이동할 수 있다. finalizer의 mechanical sanity gate(git diff >= 1 + 모든 Done When `[x]`)가 false pass를 기계적으로 막는다.
12. turn 중 browser tool을 열었다면 사용자가 열어두라고 하지 않는 한 turn이 끝나기 전에 닫는다.
13. non-browser check를 우선한다. rendered behavior가 중요할 때만 현재 agent의 built-in browser tool을 사용한다. Playwright를 사용하지 않는다.
14. 같은 `Todo-NNN.md`가 서로 다른 state folder에 두 개 있으면 안 된다. Worker handoff는 ticket을 `inprogress/`에서 `verifier/`로 이동하고, verifier decision은 같은 ticket을 다시 `inprogress/`로 이동한다.
15. `tickets/inprogress/Todo-NNN.md`는 `AI`, `Stage`, `Claimed By`, `Execution AI`, `Last Updated`, `Next Action`, `Resume Context`를 최신으로 유지해야 한다.
16. chat memory가 아니라 board file에서 resume 한다. `Resume Context`, `References`, `Reference Notes`, ticket verification evidence, runner state를 사용한다.
17. `automations/state/*.context`는 stop hook과 worker identity를 위한 runtime state다. tick end에는 active ticket context를 clear 하되, runner가 계속되어야 하면 role/worker context는 유지한다.
18. Verification evidence는 ticket markdown의 `## Verification` section(Result / Exit Code / Last Run)에 직접 둔다.
19. Done ticket은 `Verification`, `Result`, `## Done When`(모든 item `[x]`)을 최신으로 유지한다. 위키 러너가 derived knowledge를 wiki-search.db 에 별도 upsert 하며, finalize 때 인라인 위키 작성을 하지 않는다.
20. Ticket filename은 `TODO-001.md` 형식을 사용한다. 새 ID는 기존 최대 ID + 1이다.
21. Git repository에서는 가능한 경우 Worker work가 worktree에서 일어난다. PRD 파생 TODO는 별도 TODO worktree를 만들지 않고 PRD worktree를 재사용하며, atodo direct ticket만 TODO worktree를 만든다. `autoflow tool runner-tool worker submit-to-verifier`는 local worktree verification 뒤, 어떤 merge보다 먼저 실행되어 ticket을 `inprogress/`에서 `verifier/`로 이동한다. Verifier pass/revise/replan은 같은 ticket을 다시 `inprogress/`로 이동하고 다음 worker action을 기록한다. Verifier pass는 merge/finalization을 허용하고, revise는 같은 worktree 수정을 요구하며, replan은 `request-replan` 실행(worktree cleanup + `tickets/todo/`로 ticket requeue)을 요구한다. verifier pass 이후에만 worker가 `autoflow tool runner-tool worker finalize-approved`를 실행할 수 있다. **main/master 반영 merge는 항상 `git merge --squash`를 사용해야 한다**(`--no-ff`, plain `git merge`, ad-hoc fallback strategy 금지). PRD의 모든 ticket이 `tickets/done/PRD-NNN/`에 도달하면 마지막 TODO를 완료한 워커가 PRD branch를 `main`으로 단일 PRD commit으로 squash 한다. Finalizer script는 bookkeeping과 mechanical gate만 수행하며 semantic decision을 하지 않는다.
22. 중앙 `PROJECT_ROOT`에 board 밖 unrelated dirty file이 있으면 verification commit에 섞지 않는다.
23. Runner는 스스로 멈추지 않는다. Idle은 현재 turn에서 처리할 작업이 없어 다음 명시적 실행을 기다린다는 뜻이다.
24. 모든 runner tick 끝에는 현재 progress percentage를 보고한다. `autoflow metrics` 또는 board spec/ticket count를 우선 사용하고, tick의 final chat 또는 log summary에 percentage를 포함한다.
25. Canonical board document는 기본적으로 한국어다. 새로 생성하거나 수정하는 PRD, todo, verification, blocked/replan note, wiki, reference, rules, agent/protocol 문서의 본문은 사용자가 명시적으로 다른 canonical 언어를 요구하지 않는 한 간결한 한국어로 쓴다. key=value output, path, command, code, ticket field, parser-sensitive section name, id, project key, runtime format, AI-facing board contract는 필요한 원래 표기와 형식을 유지한다.

## Agent Mode

각 러너의 자세한 절차와 mode 별 do/don't 는 share root agent prompt 에 있다. 필요할 때만 참조한다:

- PRD handoff (`/aprd`): `~/.autoflow/share/agents/spec-author-agent.md`
- Direct todo (`/atodo`): host `CLAUDE.md` 의 `/atodo` 가이드
- Worker 구현 + handoff + merge + finalize: `~/.autoflow/share/agents/worker-agent.md`
- Plan-to-ticket / replan: `~/.autoflow/share/agents/plan-to-ticket-agent.md`
- Verifier semantic review: `~/.autoflow/share/agents/verifier-agent.md`
- Wiki 유지 (DB-only): `~/.autoflow/share/agents/wiki-maintainer-agent.md`

Legacy trigger `#plan`, `#todo`, `#veri` 는 compatibility 만 남는다. 새 작업에서는 사용하지 않는다.

## 필수 Ticket Field / 완료 기준 / 중복 방지

세부 리스트와 조건은 `~/.autoflow/share/reference/tickets-board.md` 의 "필수 Ticket Field", "완료 기준", "중복 방지" 섹션 참고. 핵심:

- 같은 ticket id 가 둘 이상의 stage folder 에 존재하면 안 된다.
- Verifier replan 은 기존 ticket 의 `Replan Count` 만 증가 (새 id X).
- Done 이동 조건: 모든 `## Done When` `[x]` + git diff ≥ 1 줄 + `## Verification` 결과 inline + `Result` 채움 (finalizer 가 기계적으로 강제).

## 파일 작성 스타일

언어 기준은 다음과 같다.

- 새로 생성하거나 수정하는 PRD, ticket, verification, blocked/replan note, log, wiki 본문은 기본적으로 한국어로 쓴다.
- 제품 README, 데스크톱 UI 문구, 사용자 가이드, 사용자 대상 release note도 사용자가 다른 언어를 요구하지 않는 한 한국어로 쓴다.
- runner의 user-visible terminal/chat 설명도 기본적으로 한국어로 쓰고, machine-readable format은 보존한다.
- AI-facing Markdown file(`~/.autoflow/share/agents/`, `~/.autoflow/share/rules/`, `~/.autoflow/share/reference/`, runtime contract, board operating doc)도 설명 본문은 한국어로 쓴다. Parser compatibility가 필요한 구조만 원래 표기를 유지한다.
- 혼합 audience 문서는 machine-readable contract를 보존하고 사람이 읽는 설명은 한국어로 쓴다.
- 모호한 품질 표현보다 관찰 가능한 문장을 선호한다.
- checklist는 각 항목을 판단할 수 있을 때만 쓴다.
- durable context는 chat이 아니라 board file에 둔다.
- parser-sensitive heading, field name, id, project key, path, command, code, key=value output, runtime format은 정확히 보존한다.

## 충돌 우선순위

1. 직접 사용자 요청.
2. 이 `AGENTS.md`.
3. Folder README file과 template.
