# AGENTS.md

이 프로젝트는 `.autoflow/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `.autoflow/` 안에 있다.

Autoflow 는 Codex, Claude Code, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `.autoflow/tickets/` 보드다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `.autoflow/README.md`
2. `.autoflow/rules/README.md`
3. `.autoflow/reference/backlog.md`
4. `.autoflow/reference/order.md`
5. `.autoflow/reference/plan.md`
6. `.autoflow/automations/README.md`
7. `.autoflow/reference/tickets-board.md`
8. `.autoflow/rules/verifier/README.md`
9. 관련 문서:
   - PRD 정리면 `.autoflow/agents/spec-author-agent.md`
   - 기본 실행이면 `.autoflow/agents/ticket-owner-agent.md`
   - plan 도출 / reject 재계획이면 `.autoflow/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `.autoflow/agents/todo-queue-agent.md`
   - verifier 검사면 `.autoflow/agents/verifier-agent.md`

## Topology

The default topology in `.autoflow/runners/config.toml` consists of three enabled loop runners: Orchestrator AI (`planner`), Impl AI (`worker`), and Wiki AI (`wiki`). Roles use disjoint paths so they can tick concurrently without worktree/merge conflicts. `monitor` and `verifier` are kept in `config.toml` with `enabled=false` for backwards-compat but are no longer part of the default flow.

- `planner` (role=`planner`): Orchestrator AI. Manages the workflow from input orders and PRDs to generating new PRDs and todo tickets. Watches `tickets/inbox/` and `tickets/backlog/`. Does not write product code or directly create worktrees.
- `worker` (role=`ticket-owner`): Impl AI. Claims a ticket from `tickets/todo/`, creates a worktree, edits code, runs the verify command, and calls `finish-ticket-owner.sh pass`. The finalizer's shell sanity gate (zero-diff + verify-command re-run) blocks false pass mechanically without a separate verifier. The worker's atomic cycle is `worktree create → todo work → master merge → worktree delete`, so at most one worktree is alive.
- `wiki` (role=`wiki-maintainer`): Wiki AI. Watches `tickets/done/` + `wiki/` for source change and refreshes `.autoflow/wiki/`. `.gitignore` now excludes `.autoflow/wiki/` (except curated `skills/`), so wiki never creates a master commit and never causes dirty PROJECT_ROOT.

Removed defaults (kept disabled in config for re-enable):
- `monitor`: was firing every 60s. After Phase 1 .gitignore separation, dirty-root signals from autoflow's own background writes are gone, so monitor's ~1440 LLM calls/day no longer carry signal proportional to cost. Runner liveness is delegated to the OS supervisor or planner's safety heartbeat self-check.
- `verifier`: redundant once the worker finalizer enforces the shell sanity gate. Was averaging ~28K output tokens per idle tick (output cap was not engaging) for ~180 calls in 25h.


## Root Rules

**1원칙:** 사용자가 명시적으로 정지하지 않는 한 목표를 달성 할때 까지 Autoflow 는 멈추지 않는다. 각 runner 는 idle, blocked, needs_user 상황에서도 증거와 다음 safe action 을 남기고 가능한 다른 흐름을 계속 전진시킨다.

1. 보드 문서는 `.autoflow/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. Impl AI (`ticket-owner`) 는 git 저장소에서 티켓별 worktree 를 우선 사용하고, worktree 가 없을 때만 프로젝트 루트 기준으로 fallback 한다.
4. `.autoflow/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있다. 동시에 도는 Impl AI 가 1개뿐이므로 worktree 가 겹칠 일은 없지만, 향후 여러 개로 늘릴 가능성을 위해 worktree 안에서 수정하는 패턴은 유지한다.
5. 기본 실행 모델은 **Orchestrator AI + Impl AI + Wiki AI (3-runner)** 다. Orchestrator AI(`planner`) 가 order/backlog 를 PRD/todo 로 흘려보내고, Impl AI(`worker`) 가 todo claim 부터 master merge 까지 atomic 한 한 cycle 로 끝내며, Wiki AI(`wiki`) 가 master commit 변화를 보고 wiki 만 갱신한다. 동시에 살아 있는 worktree 는 항상 0 또는 1개다.
5a. **Fail 처리는 reject 폴더 + inbox dual-write 다 (Phase 4, 2026-05-06).** `finish-ticket-owner.sh fail` 은 ticket 을 기존 `tickets/reject/` 로 이동하면서 동시에 `tickets/inbox/order_<id>_retry_<N>_<ts>.md` 를 새로 emit 한다. inbox 파일은 `source: retry`, `retry_count`, `retry_max` (env: `AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT`, 기본 3), `retry_decision` (`retry` 또는 `needs_user`), `retry_fingerprint` (PRD key + title + failure class + reject reason 의 12자리 SHA256), `failure_class`, `origin_ticket`, `origin_prd`, 원 reject reason verbatim, planner hint 를 포함한다. 같은 fingerprint 가 retry_max 회를 누적하면 `retry_decision=needs_user` 로 표시되어 planner 가 새 PRD/todo 를 만들지 않고 사용자 결정을 기다린다. fingerprint 가 다르면 (실패 양상 변화) 평소대로 retry. 기존 `tickets/reject/` 에 대한 auto-replan / auto-close 흐름은 호환을 위해 유지하되 (`AUTOFLOW_REJECT_AUTO_REPLAN=off` 로 끌 수 있음, retry 한도는 `AUTOFLOW_REJECT_MAX_RETRIES`, auto-close 명령 timeout 은 `AUTOFLOW_REJECT_AUTO_CLOSE_TIMEOUT_SECONDS` 기본 300s), 새 작업은 inbox retry order 경로를 우선한다. `AUTOFLOW_BLOCKED_AUTO_RECOVER=off` 가 아니면 `tickets/inprogress/` 의 `Stage: blocked` ticket 중 `Failure Class` 가 `dirty_root` / `dirty_project_root_conflict` 인 것을 점검해 dirty paths 가 회복돼 있으면 ticket 을 `tickets/todo/` 로 되돌린다. dirty paths 가 남아 있으면 `source=blocked-dirty-orchestration` 시그널을 emit 한다 — Phase 1 .gitignore 분리 이후 background write 경로는 dirty 로 잡히지 않으므로 이 cleanup loop 자체가 거의 발생하지 않는다. 1원칙(멈추지 않는다)이 분류 완벽주의보다 우선이며, ownership 이 모호하면 `[ticket_NNN] orchestration cleanup: misc housekeeping` bundle 로 묶는다. `needs_user` 는 git 자체가 동작 불가한 mechanical 한 경우와 inbox retry fingerprint 한도 도달 시점만 남긴다. 한 tick 에 최대 1건씩 처리한다. Impl AI 의 `start-ticket-owner.sh` 는 reject 를 직접 재계획하지 않는다.
6. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 `autoflow run planner` (= Orchestrator AI) 와 `autoflow run ticket` (= Impl AI) 두 명령으로 충분하다.
7. 위 heartbeat 자동화는 사용자가 명시적으로 "멈춰"라고 말하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기 상태다.
8. ticket owner 또는 verifier, 그리고 blocked-dirty orchestration tick 의 Orchestrator AI 는 local commit 을 할 수 있고, `git push` 는 어떤 자동화에서도 절대 금지다.
8a. Autoflow pass/completion commit message 는 `[PRD_NNN][ticket_NNN] 작업내용 요약본` 형식을 사용한다. `PRD_` bracket 값은 티켓의 `PRD Key` / project key 를 uppercase 로 쓰고, `ticket_` bracket 값은 티켓 `ID` / 파일명에서 lower-case 로 쓴다. PRD key 가 없는 legacy 티켓만 `[ticket_NNN]` 으로 fallback 한다. 티켓 `Title` 을 bracket 값으로 쓰지 않는다.
8b. **Worker pass 보장 — shell sanity gate 가 거짓 pass 를 잡는다.** Impl AI 가 `finish-ticket-owner.sh pass` 를 호출하면 finalizer 는 AI 가 적은 evidence 와 무관하게 다음 mechanical 검사를 다시 실행한다. 하나라도 실패하면 ticket 을 `Stage: blocked` 로 두고 pass 를 거부한다.
   - `git diff <Worktree.Base Commit>..HEAD` 변경 line 합 ≥ 1 (worktree 안에서). 변경이 0 이면 `shell_sanity_gate_zero_diff` 로 차단.
   - ticket `## Verification` 의 `- Command:` 가 있으면 worktree 에서 재실행해 exit 0 이어야 한다. exit 0 이 아니면 `shell_sanity_gate_verify_command_failed` 로 차단.
   따라서 `## Verification` 의 `Result: passed`, `## Done When` 의 `[x]`, `verify_NNN.md` 의 `exit_code=0` 같은 텍스트만 적어 두는 것은 의미가 없다. AI 는 evidence 를 사후 수정해 우회하려 하지 말고, 정확히 명령이 exit 0 으로 끝나도록 코드를 고친 뒤 pass 를 호출한다. shell sanity gate 가 막은 ticket 은 다음 tick 의 worker 가 다시 작업해 통과시킬 수 있다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. ticket owner 또는 verifier 는 `.autoflow/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. local runner 와 adapter one-shot execution 은 지원한다. embedded terminal 은 별도 단계로 추가한다. 기본 자동화는 Claude `/autoflow` 또는 Codex `$autoflow` skill 로 PRD 를 backlog 에 전달하거나, Claude `/order` / Codex `$order` / `#order` (이전 이름 `order` 에서 변경. inbox 파일 이름 `orderNNN.md` 와 CLI `autoflow order create` 는 그대로 유지) 로 짧은 요청을 `tickets/inbox/` 에 떨어뜨린 뒤, `autoflow run planner` (Plan AI) 가 generated PRD / todo 티켓을 만들고 `autoflow run ticket` (Impl AI) 가 그 티켓을 끝까지 가져가는 흐름이다. `#autoflow` 는 호환 alias 로 유지한다. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거로 남겨 두지만 새 작업에서 권장하지 않는다.
14. heartbeat / runner tick 이 종료될 때는 현재 공정률을 표기한다. 가능하면 `autoflow metrics` 또는 보드의 PRD/ticket 집계를 기준으로 한 percent 를 tick 의 마지막 대화/로그 요약에 남긴다.
15. 문서 언어 정책: 새로 생성되는 Autoflow PRD(`prd_NNN.md`), plan, ticket, 사용자 친화 order 본문과 사용자 대상 설명은 기본적으로 한국어로 작성한다. 단, parser 가 읽는 섹션명, 필드명, key=value 출력, 경로, 명령어, 코드, ticket id, project key, runtime contract 는 기존 포맷과 언어를 유지한다. AI / runner 전용 계약 문서(`.autoflow/agents/`, `rules/`, `reference/` 등)는 parser 호환 구조를 유지하되, 사람이 읽는 placeholder / 설명 문장은 한국어 작성 기준을 반영할 수 있다.
15a. 터미널 / adapter / heartbeat 에서 사용자가 읽는 AI 대화, 진행 요약, 설명 문장은 기본적으로 한국어로 쓴다. 단, key=value 출력, 경로, 명령어, 코드, ticket 필드, parser 가 읽는 형식, AI용 보드 계약은 원래 포맷과 언어를 유지한다.
16. 사용자 노출 worker 표기(`ticket`, `verification`, `log`, desktop markdown preview`)는 storage 식별자 `owner-N` / legacy `ai-N` 를 preferred display wording 으로 정규화한다. 해당 역할의 enabled runner 가 1개뿐이면 `worker`처럼 숫자 접미사를 숨기고, 2개 이상이면 `worker-N` 형태를 유지한다. runner state 파일 이름, runtime role 키, config 상의 실제 worker id 는 바꾸지 않는다.
17. Autoflow 개발에서 데스크톱 UI 컴포넌트(`apps/desktop/src/components/ui/` + 그 위 화면)는 **shadcn/ui 방식의 로컬 React 컴포넌트와 lucide-react 아이콘을 우선** 사용한다. UI 기능을 추가하거나 수정할 때는 shadcn CLI(`shadcn init`, `shadcn add`)의 구조처럼 컴포넌트를 앱 안에 소유하고, 아이콘은 lucide-react에서 가져온다. MUI Material / Emotion theme wrapper / MUI 전용 class(`Mui*`)는 새로 추가하지 않고, 기존 MUI 의존 코드가 같은 패턴을 다루고 있으면 shadcn/lucide 기반 로컬 컴포넌트로 점진 제거한다. modal/dialog/sheet/popover/tooltip/dropdown/command/toast 같은 인터랙션 패턴은 shadcn 스타일의 접근성 있는 컴포넌트로 구현하며, 키보드 Escape, focus management, ARIA 요건을 충족한다.
18. wiki 자동화 규칙: wiki 는 Wiki AI(`wiki`) 가 소유한다. Impl AI 의 `finish-ticket-owner.sh` / `merge-ready-ticket.sh` finalizer 는 `update-wiki.sh` 를 자동 호출하거나 `.autoflow/wiki/` 를 completion commit 에 stage 하지 않는다. `wiki` 이 source 변화와 기존 managed baseline 을 먼저 보고 실제 수정이 필요할 때만 `autoflow wiki update` 를 도구로 호출한다. 내용 변화가 없고 확인 시간만 있는 경우에는 `.autoflow/runners/state/wiki-baseline.history` 만 갱신하며 wiki commit 을 만들지 않는다. AI synthesis 는 debounce 를 적용해 의미 있는 wiki file-weight 가 `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` 이상이거나 `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS` 경과 시 `autoflow wiki query --synth` / `autoflow wiki lint --semantic` 으로 묶어서 수행한다. Wiki scoped autocommit 은 adapter 실행 후 content gate 를 적용한다. `wiki/index.md`, `wiki/log.md`, `*.manifest`, `*.history`, `*.fingerprint` 만 바뀐 경우와 `git diff -w` 기준 cosmetic-only diff 는 commit 하지 않는다. 기본 commit gate 는 `AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD=5`, `AUTOFLOW_WIKI_COMMIT_MIN_LINES=30` 이며, 신규 파일은 weight 임계를 충족하면 line 임계를 우회하고 삭제 파일은 line 임계와 무관하게 의미 있는 변화로 처리한다. 의미 있는 wiki commit subject 는 `[wiki] update: <primary category> / <total> total, +<add>/-<del>` 형식을 사용한다.
18a. `.autoflow/wiki/skills/` learned-skill registry 는 managed wiki baseline과 별도다. `finish-ticket-owner.sh` 의 pass 경로는 `autoflow skill create ... --from-ticket <ticket>`을 best-effort로 호출할 수 있지만, `AUTOFLOW_SKILL_AUTO_EXTRACT=off` 이거나 skill 추출이 실패해도 ticket pass/finalization 결과를 fail로 바꾸지 않고 warning evidence만 남긴다.
18b. Skill registry 는 dual-storage 구조다 (Hermes Phase 1, `prd_162`). 사람이 작성·검토한 배포 skill 은 `.autoflow/wiki/skills/<category>/<name>/SKILL.md` 에, agent 가 ticket 완료에서 자동 추출한 skill 은 `.autoflow/wiki/skills-local/<category>/<name>/SKILL.md` 에 둔다. 자동 archive 대상은 `.autoflow/wiki/skills-local/.archive/...` 로 옮기며 절대 삭제하지 않는다. frontmatter 표준은 `name(≤64)`, `description(≤1024)`, `pattern_type`, `applies_to.{module,keywords}`, `pinned`, `created_from.{prd,ticket}`, `created_at` 이며 본문 ≤100KB / 단일 파일 ≤1MiB cap 을 따른다. `pinned: true` 인 skill 은 어떤 자동 lifecycle transition 에서도 우회된다. 통계 sidecar `.autoflow/wiki/skills-local/.usage.json` 은 atomic write 로 갱신되고, 깨진 sidecar 도 best-effort 회복으로 CLI 흐름을 막지 않는다. 레거시 flat `skill_NNN.md` 는 in-repo 에 그대로 두고 `category=legacy` 로 표시한다.
18c. Skill Curator / auto-extraction 은 Wiki AI 소유 background lifecycle 이다. `autoflow skill curator-run <project-root> <board-dir-name> --once|--idle` 는 `AUTOFLOW_CURATOR_ENABLED=0` 일 때 skip 하고, 기본 7일 주기(`AUTOFLOW_CURATOR_INTERVAL_HOURS=168`)로 `skills-local/` 만 점검한다. 30일 unused 는 `state: stale`, 90일 unused 는 `.archive/` 이동, `pinned: true` 는 모든 transition 우회다. Trigger wrapper `autoflow skill auto-extract --from-ticket ... --pattern-type ...` 는 `ticket_completion`, `reject_turnaround`, `blocked_recovery`, `orchestration_cleanup`, `skill_nudge` 를 보존하며 실패해도 planner/worker 흐름을 막지 않는다. Curator/auto-extraction 은 auxiliary client bookkeeping 으로만 실행하고 main session prompt cache 를 만지지 않는다.
19. adapter timeout watchdog: 모든 agent 호출(`codex` / `claude` / `opencode` / `gemini` / custom command)은 `run_with_timeout` 으로 감싼다. 기본 timeout 은 `AUTOFLOW_AGENT_TIMEOUT_SECONDS` (기본 1200초). timeout 발생 시 SIGTERM 후 `AUTOFLOW_AGENT_KILL_AFTER_SECONDS` (기본 30초) 안에 안 죽으면 SIGKILL. timeout 으로 끝난 tick 은 exit 124 → state 에 `last_result=adapter_timeout`, runner_status 는 `idle` 로 두어 다음 tick 이 재시도한다. 누적 timeout 은 `consecutive_timeout_count` 필드로 추적하며, `AUTOFLOW_AGENT_TIMEOUT_FALLBACK_THRESHOLD` (기본 3) 도달 시 `adapter_timeout_fallback` 이벤트를 emit 하고 state 의 `last_result` 가 `adapter_timeout_fallback` 이 된다. 정상(exit 0) tick 이 한 번이라도 발생하면 카운터는 0 으로 reset 된다. wiki agent 가 timeout 으로 끝난 직후 `.autoflow/wiki/` 의 partial 변경을 자동 폐기하려면 `AUTOFLOW_WIKI_TIMEOUT_DISCARD_PARTIAL=1` 로 opt-in. 기본은 폐기하지 않고 다음 tick 의 manifest hash 가 자연 회복하도록 둔다. timeout 은 `git push` 와 무관하며 push 는 어떤 상황에서도 금지다.
19a. planner / worker / verifier adapter prompt 는 role별 input byte cap 을 기본 적용한다: `AUTOFLOW_PLANNER_PROMPT_BYTES=65536`, `AUTOFLOW_WORKER_PROMPT_BYTES=98304`, `AUTOFLOW_VERIFIER_PROMPT_BYTES=32768` (unset 시 이 기본값 사용). cap 초과 prompt 는 head 60% + tail 40% 를 남기고 중간에 `[... N bytes elided to save tokens ...]` marker 를 삽입한 뒤 adapter 호출을 계속 진행한다. cap 발동 흔적은 `.autoflow/runners/logs/*.log` 의 `prompt_bytes_capped=NNN` 라인으로 남긴다.
19b. adapter output 도 role별 기본 cap 을 적용한다: `AUTOFLOW_PLANNER_MAX_OUTPUT_TOKENS=8000`, `AUTOFLOW_WORKER_MAX_OUTPUT_TOKENS=16000`, `AUTOFLOW_VERIFIER_MAX_OUTPUT_TOKENS=4000`, `AUTOFLOW_WIKI_MAX_OUTPUT_TOKENS=2000` (unset 시 이 기본값 사용). 현재 설치된 adapter CLI 가 native max-output flag 를 제공하지 않아도 후처리 fallback 으로 최종 응답 끝에 `output_truncated=true` marker 를 붙이고, `.autoflow/runners/logs/*.log` 에 `event=output_cap_applied ... output_truncated=true` 와 `adapter_finish ... output_truncated=true|false` 를 남긴다. 최근 24h `adapter_finish` 중 `output_truncated=true` 비율이 5%를 넘으면 해당 role cap 상향을 권장한다.
19c. **Realtime (event-driven) wakeup 은 4 runner 모두 일관 적용된다 (opt-in).**
- 우산 env: `AUTOFLOW_RUNNER_REALTIME_ENABLED=1` 이면 planner / worker / verifier / wiki 4개 모두 event-driven 모드.
- 개별 env: `AUTOFLOW_PLANNER_REALTIME_ENABLED=1`, `AUTOFLOW_TICKET_REALTIME_ENABLED=1` (worker), `AUTOFLOW_VERIFIER_REALTIME_ENABLED=1`, `AUTOFLOW_WIKI_REALTIME_ENABLED=1` 으로 role 별 활성도 가능.
- Runner 별 watch 폴더:
  - planner: `tickets/inbox/order_*.md`, `tickets/backlog/prd_*.md`, `tickets/reject/reject_*.md`
  - worker (ticket): `tickets/todo/tickets_*.md`
  - verifier: `tickets/verifier/*.md`
  - wiki: `tickets/done/*.md`, `wiki/*.md` (기존 wiki debounce 정책 유지)
- 동작: loop sleep 도중 watch 폴더 변경을 감지하면 기존 `interval_seconds` 만료 전에 다음 tick 으로 깨어남. 변경은 `.autoflow/runners/state/<runner>.<public_role>-realtime-wakeup.pending` marker 1개로 병합되며 loop 는 단일 child 실행 경로를 유지한다.
- 직전 전체 input fingerprint 와 같으면 기존 idle skip (`planner_inputs_unchanged`, `ticket_inputs_unchanged`, `verifier_inputs_unchanged`) 이 adapter LLM 호출을 생략한다.
- **권장 운영**: realtime 모드에서는 `interval_seconds` 를 safety heartbeat 로 재정의 (기본 1800s = 30분 권장). reject auto-replan / blocked-dirty orchestration / adapter timeout 은 heartbeat 로 보장된다.
- env 가 unset 또는 `0` 이면 기존 interval/backoff polling 동작만 사용 (역호환).
20. Queue priority policy: inbox order, backlog PRD, todo ticket, and legacy verifier queues sort by priority before numeric FIFO. Supported values are `critical`, `high`, `normal`, and `low`; missing or unknown priority is `normal`. Use `critical` only for host resource exhaustion, board integrity loss, security exposure, or Autoflow self-recovery threats. Use `high` for urgent user-visible breakage or blocked active work, `normal` for ordinary planned work, and `low` for cleanup or non-urgent improvements.
21. Monitor runner policy: `monitor` 는 runner state, board queue, telemetry/metrics, dirty root, exact `Recovery State` `needs_user` 신호를 관찰하고 `source: autoflow-monitor-agent` order/check evidence 를 발행하는 역할이다. Monitor 는 `kill` / `pkill` / runner start-stop-restart / git cleanup / merge / `git push` 를 하지 않는다. 같은 fingerprint 는 cooldown 안에서 duplicate suppression evidence 만 남긴다.

## Trigger Interpretation

- `#autoflow`
  - Claude `/autoflow`, Codex `$autoflow` 와 같은 PRD handoff alias 다.
  - 자유 대화로 요구사항을 모으고, 범위가 크면 PRD split map(후보 PRD, 경계, 의존 순서, 검증 초점)을 먼저 제안한다.
  - draft 트리거가 있을 때만 전체 PRD 초안을 출력한다. split 이 적합하면 여러 PRD 초안을 각각 분리해 보여줄 수 있다.
  - 별도의 명시적 저장 트리거가 있을 때만 `.autoflow/tickets/backlog/prd_{NNN}.md` 에 PRD 를 저장한다. 여러 PRD 는 각 PRD별 승인 또는 명확한 `전부 저장` / `save all` 승인 뒤 별도 backlog 파일로 순차 저장한다.
  - 이후 Plan AI 가 backlog PRD 를 todo 로 변환하고, ticket owner runner 가 Autoflow 보드에서 mini-plan / 구현 / 검증 / evidence 를 한 번에 이어받는다.
  - plan / ticket / 구현은 시작하지 않는다.

- `#order` (이전 이름 `#order` 에서 변경됨)
  - Claude `/order`, Codex `$order` 와 같은 quick intake alias 다.
  - 단순 수정 요청을 PRD 없이 `.autoflow/tickets/inbox/order_NNN.md` 에 저장한다 (파일 이름 prefix `order` 와 CLI `autoflow order create` 는 호환을 위해 그대로 둠).
  - 원 요청은 `## Request` 에 보존하고, 확실한 경우에만 scope / Allowed Paths / Verification hint 를 적는다.
  - plan / ticket / 구현은 시작하지 않는다. 이후 Plan AI 가 inbox 의 노트를 구현 지시로 해석해 안전한 가장 좁은 범위의 generated PRD 와 todo ticket 으로 승격한다. order 는 반복 질문 루프를 만들지 않는다.

- `#plan`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 plan 작업은 항상-on Plan AI(`planner`) loop runner 가 1분 tick 마다 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 planner heartbeat 를 1분 주기로 생성 또는 재개한다.
  - actionable order 또는 populated PRD 가 있으면 계속 처리해 generated PRD / plan 을 작성하고, start-plan 런타임으로 `.autoflow/tickets/todo/` 티켓을 만든다.
  - 실제 ticket 생성이 끝난 PRD 와 plan 은 `.autoflow/tickets/done/<project-key>/` 로 이동한다.
  - `.autoflow/tickets/reject/reject_NNN.md` 도 계속 감시해 reject reason 을 plan 에 반영하고 새 todo 로 다시 보낸 뒤, 해당 reject 기록은 `.autoflow/tickets/done/<project-key>/reject_NNN.md` 로 보관한다.
  - 현재 plan 이 ticketed 가 됐거나 verifier 가 `.autoflow/tickets/done/<project-key>/` 으로 넘긴 뒤에도 backlog 에 다음 populated PRD 가 남아 있으면 계속 다음 plan 으로 이어간다.
  - 특정 티켓이 `needs_user` 여도 planner 는 증거를 남기고 다른 actionable backlog/todo 흐름을 계속 살린다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#todo`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 todo claim + 구현은 Impl AI(`worker`) 가 `start-ticket-owner.sh` 로 직접 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 todo heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `.autoflow/tickets/todo/` 가 있으면 `inprogress/` 로 옮기고 티켓별 worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현까지 진행한다.
  - 티켓 제목 / Goal / Done When 이 검증처럼 보여도 상태가 `.autoflow/tickets/todo/` 또는 `.autoflow/tickets/inprogress/` 이면 legacy todo worker 가 구현을 계속 진행한다.
  - 작업이 끝나면 `.autoflow/tickets/verifier/` 로 이동한다.
  - 막힌 사유가 생겨도 owner 는 ticket 에 증거와 다음 safe action 을 남기고, 런너 자체는 사용자가 멈추기 전까지 계속 살아 있어야 한다.

- `#veri`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 검증은 Impl AI(`worker`) 가 `verify-ticket-owner.sh` + `finish-ticket-owner.sh` 로 inline AI-led verification 을 수행하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 verifier heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `.autoflow/tickets/verifier/` 가 있으면 `working_root` 에서 검증하고, pass 면 worktree 변경을 중앙 프로젝트 루트에 무커밋 통합한 뒤 `done/<project-key>/` + local commit, fail 면 이유를 적어 `reject/` 로 이동한다.
  - 브라우저 확인이 필요해도 먼저 비브라우저 확인을 우선하고, Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 쓰며 열린 탭은 같은 턴에서 닫는다.
  - `git push` 는 절대 금지다.
  - pass 로 끝났다고 전체 흐름이 끝난 것은 아니다. backlog 잔량이 있으면 planner 가 다음 plan 을 이어간다.
  - fail / needs_user 증거를 남겨도 verifier heartbeat 자체는 종료하지 않고 다음 wake-up 을 기다린다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.
