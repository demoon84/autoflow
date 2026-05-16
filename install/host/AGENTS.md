# AGENTS.md

이 프로젝트는 `{{BOARD_DIR}}/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `{{BOARD_DIR}}/` 안에 있다.

Autoflow 는 Codex, Claude Code, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `{{BOARD_DIR}}/tickets/` 보드다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `{{BOARD_DIR}}/README.md`
2. `{{BOARD_DIR}}/rules/README.md`
3. `{{BOARD_DIR}}/reference/prd.md`
4. `{{BOARD_DIR}}/reference/order.md`
5. `{{BOARD_DIR}}/reference/plan.md`
6. `{{BOARD_DIR}}/automations/README.md`
7. `{{BOARD_DIR}}/reference/tickets-board.md`
8. `{{BOARD_DIR}}/rules/verifier/README.md`
9. `{{BOARD_DIR}}/reference/runner-startup-common.md`
10. 역할별 시작 규칙: `{{BOARD_DIR}}/reference/runner-startup-rules/`
11. 관련 문서:
   - PRD 정리면 `{{BOARD_DIR}}/agents/spec-author-agent.md`
   - 기본 실행이면 `{{BOARD_DIR}}/agents/worker-agent.md`
   - plan 도출 / replan 처리면 `{{BOARD_DIR}}/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `{{BOARD_DIR}}/agents/worker-agent.md`
   - verifier 검사면 `{{BOARD_DIR}}/agents/verifier-agent.md`

## Root Rules

1. 보드 문서는 `{{BOARD_DIR}}/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. 워커 러너(`worker`) 는 git 저장소에서 티켓별 worktree 를 사용한다. worktree 생성/확인이 실패하면 구현을 시작하지 않고 ticket 을 blocked 상태로 남긴다.
4. `{{BOARD_DIR}}/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있지만, 병렬 작업에서는 티켓별 worktree 안에서 수정한다.
5. 기본 토폴로지는 **플래너 러너 + 워커 러너 + 검증 러너 + 위키 러너 (4-runner)** 모델이다. 플래너 러너(`planner`) 가 order/prd/retry 를 generated PRD/todo 로 흘려보내면, 워커 러너(`worker`) 가 todo claim, worktree 생성, 구현, 로컬 검증, verifier 제출, verifier 판정 후 처리, PROJECT_ROOT 머지를 담당한다. 검증 러너(`verifier`) 는 의미 검증만 수행하고 pass/revise/replan 중 하나로 worker 를 깨운다. 위키 러너(`wiki`) 는 `tickets/done/` 변동을 감지해 `{{BOARD_DIR}}/wiki/` 의 AI synthesis 를 갱신한다.
6. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 역할 분리보다 플래너/워커/검증/위키 러너와 realtime wake 흐름을 우선한다.
7. 러너 idle 은 종료가 아니라 다음 wake 또는 tick 대기 상태다. 러너 중지는 사용자의 명시적 지시로만 처리한다.
8. worker 또는 verifier 는 local commit 을 할 수 있고, `git push` 는 어떤 러너/자동 실행에서도 절대 금지다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. worker 또는 verifier 는 `{{BOARD_DIR}}/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. local runner 와 adapter one-shot execution 은 지원한다. embedded terminal 은 별도 단계로 추가한다. 기본 실행 흐름은 Claude `/autoflow`, Codex `$autoflow`, Gemini `autoflow` skill handoff 뒤, 또는 Claude `/order` / Codex `$order` / Gemini `order` / `#order` quick order handoff 뒤 `autoflow run planner` 와 `autoflow run ticket` 또는 Worker runner 로 이어진다. `#autoflow` 는 호환 alias 로 유지한다. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거로 유지한다.
13a. `{{BOARD_DIR}}/wiki/skills/` learned-skill registry 는 managed wiki baseline과 별도다. 워커 러너의 `autoflow tool runner-tool worker finalize-approved` 경로는 `autoflow skill create ... --from-ticket <ticket>`을 best-effort로 호출할 수 있지만, `AUTOFLOW_SKILL_AUTO_EXTRACT=off` 이거나 skill 추출 실패가 발생해도 ticket pass/finalization을 실패로 바꾸면 안 된다.
13b. Skill registry 는 dual-storage 구조다 (Hermes Phase 1, `prd_162`). 사람이 작성·검토한 배포 skill 은 `{{BOARD_DIR}}/wiki/skills/<category>/<name>/SKILL.md` 에, agent 가 ticket 완료에서 자동 추출한 skill 은 `{{BOARD_DIR}}/wiki/skills-local/<category>/<name>/SKILL.md` 에 둔다. 자동 archive 는 `{{BOARD_DIR}}/wiki/skills-local/.archive/...` 로 옮기며 절대 삭제하지 않는다. frontmatter 표준은 `name(≤64)`, `description(≤1024)`, `pattern_type`, `applies_to.{module,keywords}`, `pinned`, `created_from.{prd,ticket}`, `created_at` 이며 본문 ≤100KB / 단일 파일 ≤1MiB cap 을 따른다. `pinned: true` 인 skill 은 어떤 자동 lifecycle transition 에서도 우회된다. 통계 sidecar `{{BOARD_DIR}}/wiki/skills-local/.usage.json` 은 atomic write 로 갱신되고, 깨진 sidecar 도 best-effort 회복으로 CLI 흐름을 막지 않는다. 레거시 flat `skill_NNN.md` 는 `category=legacy` 로 표시한다.
13c. Skill Curator / auto-extraction 은 위키 러너 소유 background lifecycle 이다. `autoflow skill curator-run <project-root> <board-dir-name> --once|--idle` 는 `AUTOFLOW_CURATOR_ENABLED=0` 일 때 skip 하고, 기본 7일 주기(`AUTOFLOW_CURATOR_INTERVAL_HOURS=168`)로 `skills-local/` 만 점검한다. 30일 unused 는 `state: stale`, 90일 unused 는 `.archive/` 이동, `pinned: true` 는 모든 transition 우회다. Trigger wrapper `autoflow skill auto-extract --from-ticket ... --pattern-type ...` 는 `ticket_completion`, `reject_turnaround`, `blocked_recovery`, `orchestration_cleanup`, `skill_nudge` 를 보존하며 실패해도 planner/worker 흐름을 막지 않는다. Curator/auto-extraction 은 auxiliary client bookkeeping 으로만 실행하고 main session prompt cache 를 만지지 않는다.
14. runner tick 이 종료될 때는 현재 공정률을 표기한다. 가능하면 `autoflow metrics` 또는 보드의 spec/ticket 집계를 기준으로 한 percent 를 tick 의 마지막 대화/로그 요약에 남긴다.
15. 문서 언어 정책: AI / runner 가 주로 읽는 Markdown 문서 (`{{BOARD_DIR}}/agents/`, `rules/`, `reference/`, ticket, verification, log, runtime contract)는 영어 또는 AI 친화적인 구조로 작성한다. 사람이 읽어야 하는 문서 (제품 README, 데스크톱 UI 문구, 사용자 가이드, 사용자 대상 릴리스 노트)는 기본적으로 한국어로 작성한다. 두 독자가 함께 보는 문서는 AI용 계약은 영어로, 사람용 설명은 한국어로 분리한다.
15a. 터미널 / adapter / runner tick 에서 사용자가 읽는 AI 대화, 진행 요약, 설명 문장은 기본적으로 한국어로 쓴다. 단, key=value 출력, 경로, 명령어, 코드, ticket 필드, parser 가 읽는 형식, AI용 보드 계약은 원래 포맷과 언어를 유지한다.

## Trigger Interpretation

- `#autoflow`
  - Claude `/autoflow`, Codex `$autoflow` 와 같은 PRD handoff alias 다.
  - 자유 대화로 요구사항을 모으고, 범위가 크면 PRD split map(후보 PRD, 경계, 의존 순서, 검증 초점)을 먼저 제안한다.
  - draft 트리거가 있을 때만 전체 PRD 초안을 출력한다. split 이 적합하면 여러 PRD 초안을 각각 분리해 보여줄 수 있다.
  - 별도의 명시적 저장 트리거가 있을 때만 `{{BOARD_DIR}}/tickets/prd/prd_{NNN}.md` 에 PRD 를 저장한다. 여러 PRD 는 각 PRD별 승인 또는 명확한 `전부 저장` / `save all` 승인 뒤 별도 PRD 파일로 순차 저장한다.
  - 이후 worker runner 가 Autoflow 보드에서 mini-plan / 구현 / 검증 / evidence 를 한 번에 이어받는다.
  - plan / ticket / 구현은 시작하지 않는다.

- `#order` (이전 이름 `#order` 에서 변경됨)
  - Claude `/order`, Codex `$order` 와 같은 quick order handoff alias 다.
  - 단순 수정 요청을 PRD 없이 `{{BOARD_DIR}}/tickets/order/order_*.md` 에 저장한다 (파일 이름 prefix `order` 와 CLI `autoflow order create` 는 호환을 위해 그대로 둠).
  - 원 요청은 `## Request` 에 보존하고, 확실한 경우에만 scope / Allowed Paths / Verification hint 를 적는다.
  - plan / ticket / 구현은 시작하지 않는다. 이후 플래너 러너가 order 의 노트를 구현 지시로 해석해 안전한 가장 좁은 범위의 generated PRD 와 todo ticket 으로 승격한다. order 는 반복 질문 루프를 만들지 않는다.

- `#plan`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 plan 작업은 활성 플래너 러너(`planner`) 가 runner tick/wake 마다 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 planner 호환 tick 을 실행하거나 활성 플래너 러너 wake 로 이어간다.
  - actionable order 또는 populated spec 이 있으면 계속 처리해 generated PRD / plan 을 작성하고, start-plan 런타임으로 `{{BOARD_DIR}}/tickets/todo/` 티켓을 만든다.
  - 실제 ticket 생성이 끝난 spec 과 plan 은 `{{BOARD_DIR}}/tickets/done/<project-key>/` 로 이동한다.
  - verifier replan 뒤 worker 가 생성한 `{{BOARD_DIR}}/tickets/order/order_*_retry_*.md` 도 일반 order 처럼 처리한다. `retry_decision=needs_user` 인 파일은 order 큐에 그대로 두고 사용자 결정을 기다린다.
  - 현재 plan 이 ticketed 가 됐거나 verifier 가 `{{BOARD_DIR}}/tickets/done/<project-key>/` 으로 넘긴 뒤에도 PRD 큐에 다음 populated spec 이 남아 있으면 계속 다음 plan 으로 이어간다.
  - 처리할 일이 없으면 idle 을 기록하고 다음 runner wake/tick 을 기다린다.

- `#todo`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 todo claim + 구현은 워커 러너(`worker`) 가 `autoflow tool runner-tool worker claim` / `autoflow tool runner-tool worker worktree-ensure` 를 명시적으로 호출해 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 todo 호환 tick 을 실행하거나 활성 워커 러너 wake 로 이어간다.
  - 처리할 `{{BOARD_DIR}}/tickets/todo/` 가 있으면 `inprogress/` 로 옮기고 티켓별 worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `{{BOARD_DIR}}/tickets/todo/` 또는 `{{BOARD_DIR}}/tickets/inprogress/` 이면 legacy todo worker 가 구현을 계속 진행한다.
  - 작업이 끝나면 `{{BOARD_DIR}}/tickets/verifier/` 로 이동한다.
  - 처리할 일이 없으면 idle 을 기록하고 다음 runner wake/tick 을 기다린다.

- `#veri`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 의미 검증은 검증 러너(`verifier`) 가 `autoflow tool runner-tool verifier ...` 로 수행하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 verifier 호환 tick 을 실행하거나 활성 검증 러너 wake 로 이어간다.
  - 처리할 `{{BOARD_DIR}}/tickets/verifier/` 가 있으면 diff/Goal/Done When 의미 검증만 수행한다. pass 면 worker 를 merge-pending 상태로 깨우고, revise 면 같은 worktree 보정을 위해 worker 를 깨우고, replan 면 retry order 생성과 worktree 삭제를 위해 worker 를 깨운다. Verifier 는 PROJECT_ROOT merge 를 하지 않는다.
  - 브라우저 확인이 필요해도 먼저 비브라우저 확인을 우선하고, Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 쓰며 열린 탭은 같은 턴에서 닫는다.
  - `git push` 는 절대 금지다.
  - pass 로 끝났다고 전체 흐름이 끝난 것은 아니다. PRD 큐 잔량이 있으면 planner 가 다음 plan 을 이어간다.
  - 처리할 일이 없으면 idle 을 기록하고 다음 runner wake/tick 을 기다린다.
