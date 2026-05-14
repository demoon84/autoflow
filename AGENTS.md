# AGENTS.md

이 프로젝트는 `.autoflow/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `.autoflow/` 안에 있다.

Autoflow 는 Codex, Claude Code, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `.autoflow/tickets/` 보드다.

## Read Order

작업을 시작할 때는 아래 순서로 읽는다.

1. `.autoflow/README.md`
2. `.autoflow/rules/README.md`
3. `.autoflow/reference/prd.md`
4. `.autoflow/reference/order.md`
5. `.autoflow/reference/plan.md`
6. `.autoflow/automations/README.md`
7. `.autoflow/reference/tickets-board.md`
8. `.autoflow/reference/runner-tool-contract.md`
9. `.autoflow/reference/runner-startup-common.md`
10. 역할별 시작 규칙: `.autoflow/reference/runner-startup-rules/`
11. 관련 문서:
   - PRD 정리면 `.autoflow/agents/spec-author-agent.md`
   - 기본 실행이면 `.autoflow/agents/worker-agent.md`
   - plan 도출 / replan 처리면 `.autoflow/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `.autoflow/agents/todo-queue-agent.md`
   - verifier 검사면 `.autoflow/agents/verifier-agent.md`
   - wiki 동기화면 `.autoflow/agents/wiki-maintainer-agent.md`

## Topology

The default topology in `.autoflow/runners/config.toml` consists of **four** enabled loop runners: Planner AI (`planner`), Impl AI (`worker`), Verifier AI (`verifier`), and Wiki AI (`wiki`). Roles use disjoint paths so they can tick concurrently without worktree/merge conflicts.

- `planner` (role=`planner`): Planner AI. Manages the workflow from input orders and PRDs to generating new PRDs and todo tickets. Watches `tickets/order/` and `tickets/prd/`. Does not write product code or directly create worktrees.
- `worker` (role=`worker`): Impl AI. Claims a ticket from `tickets/todo/`, creates a worktree, edits code, verifies locally, and calls `runner-tool.ts worker submit-to-verifier` to hand off to verifier before any PROJECT_ROOT merge. After verifier pass, the worker merges the approved worktree into PROJECT_ROOT, reruns verification, and calls `runner-tool.ts worker finalize-approved` for archival/commit. After verifier revise, the worker keeps the same worktree, fixes, verifies, and resubmits. After verifier replan, the worker calls `runner-tool.ts worker create-retry-order`, deletes the worktree through that tool, and waits for Planner AI's follow-up TODO. The finalizer's shell sanity gate (zero-diff + Done When checklist) blocks false pass mechanically. The worker's atomic cycle is `worktree create → todo work → local verification → verifier review → pass merge/finalize or revise/replan handling`.
- `verifier` (role=`verifier`): Verifier AI. Watches `tickets/verifier/` via realtime (interval 300 s). For each verify_pending ticket, reads the diff and checks semantic alignment with the ticket Title/Goal and Done When items. It records exactly one decision: pass, revise, or replan. On pass, it writes a verifier-ok marker, marks the original inprogress ticket `verified_pending_merge`, removes the verifier copy, and wakes the worker. On revise, it marks the original `revision_requested`, removes the verifier copy, and wakes worker to fix the same worktree. On replan, it marks the original `replan_requested`, removes the verifier copy, and wakes worker to create the retry order and delete the worktree. See `.autoflow/agents/verifier-agent.md`.
- `wiki` (role=`wiki-maintainer`): Wiki AI. Watches `tickets/done/` + `wiki/` for source change and refreshes `.autoflow/wiki/`. `.gitignore` now excludes `.autoflow/wiki/` (except curated `skills/`), so wiki never creates a master commit and never causes dirty PROJECT_ROOT.

Removed (2026-05-07, re-introduced 2026-05-12 PRD_287): the `monitor` runner was removed permanently; the `verifier` runner was re-introduced with a narrower semantic-check scope (diff vs Title/Goal alignment). The worker finalizer's shell sanity gate still handles mechanical checks; the verifier handles meaning-level checks. Runner liveness signals are delegated to the OS supervisor and planner's safety heartbeat.

## Root Rules

**1원칙:** 사용자가 명시적으로 정지하지 않는 한 목표를 달성 할때 까지 Autoflow 는 멈추지 않는다. 각 runner 는 idle, blocked, needs_user 상황에서도 증거와 다음 safe action 을 남기고 가능한 다른 흐름을 계속 전진시킨다.

1. 보드 문서는 `.autoflow/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. Impl AI (`worker`) 는 git 저장소에서 티켓별 worktree 를 사용한다. worktree 생성/확인이 실패하면 구현을 시작하지 않고 ticket 을 blocked 상태로 남긴다.
4. `.autoflow/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있다. 동시에 도는 Impl AI 가 1개뿐이므로 worktree 가 겹칠 일은 없지만, 향후 여러 개로 늘릴 가능성을 위해 worktree 안에서 수정하는 패턴은 유지한다.
5. 기본 실행 모델은 **Planner AI + Impl AI + Verifier AI + Wiki AI (4-runner)** 다. Planner AI(`planner`) 가 `tickets/order/` 와 `tickets/prd/` 를 PRD/todo 로 흘려보내고, Impl AI(`worker`) 가 todo claim, worktree 생성, 구현, 로컬 검증, verifier handoff 를 담당한다. Verifier AI(`verifier`) 는 의미 검증만 완료해 PROJECT_ROOT merge 를 허가하고, 그 뒤 Impl AI(`worker`) 가 merge와 최종 검증을 수행한다. Wiki AI(`wiki`) 가 master commit 변화를 보고 wiki 만 갱신한다. 동시에 살아 있는 worktree 는 항상 0 또는 1개다.
5a. **Verifier replan 처리는 order 재발행 단일 흐름이다.** 별도 reject 폴더는 제거됐고 `done/<key>/` 는 성공만 모인다. Verifier 가 replan 판정을 내리면 먼저 worker 를 깨우고, worker 가 `create-retry-order` 로 ticket 본문 전체를 `tickets/order/order_<id>_retry_<N>_<ts>.md` 의 `## Original Ticket` 섹션에 embed 한 뒤 worktree 와 inprogress markdown 을 정리한다. Verifier revise 는 order 재발행이 아니라 같은 worktree 보정이다. order 파일은 `source: retry`, `retry_count`, `retry_max` (env: `AUTOFLOW_ORDER_RETRY_MAX_FINGERPRINT`, legacy alias `AUTOFLOW_INBOX_RETRY_MAX_FINGERPRINT`, 기본 3), `retry_decision` (`retry` 또는 `needs_user`), `retry_fingerprint`, `failure_class`, `origin_ticket`, `origin_prd`, replan reason, planner hint 를 포함한다. 같은 fingerprint 가 retry_max 회 누적되면 `retry_decision=needs_user` 로 표시돼 planner 가 새 PRD/todo 를 만들지 않고 order 큐에 그대로 남겨 사용자 결정을 기다린다. fingerprint 가 다르면 평소대로 retry. Planner 는 order 의 retry order 를 일반 order 처럼 처리한다. worker 가 sanity gate fail 같은 일시적 막힘에 부딪히면 ticket 을 `Stage: blocked` 로 두고 다음 tick worker 가 같은 ticket 을 다시 시도한다. mechanically 불가능한 git 문제만 `needs_user` 로 park 한다.
6. `#plan`, `#todo` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 `autoflow run planner` (= Planner AI), `autoflow run ticket` (= Impl AI), `autoflow run wiki` (= Wiki AI) 세 명령으로 충분하다.
7. 위 heartbeat 자동화는 사용자가 명시적으로 "멈춰"라고 말하기 전까지 pause / delete / self-stop 하지 않는다. idle 은 종료가 아니라 다음 wake-up 대기 상태다.
8. worker 와 blocked-dirty orchestration tick 의 Planner AI 는 local commit 을 할 수 있고, `git push` 는 어떤 자동화에서도 절대 금지다. **단, `AUTOFLOW_AUTO_PUSH_AFTER_VERIFY=branch_only` opt-in 을 설정하면 worker pass finalizer 가 sanity gate 통과 직후 `git push origin <feature-branch>` + `gh pr create --draft` 를 자동 실행한다.** master/main 브랜치 push 는 이 opt-in 이 켜져 있어도 항상 차단된다. gh CLI 미설치/미인증 시 PR 생성은 silent skip 되고 흐름은 계속 진행된다. 기본값은 off (push 없음).
8a. Autoflow pass/completion commit message 는 `[PRD_NNN][ticket_NNN] 작업내용 요약본` 형식을 사용한다. `PRD_` bracket 값은 티켓의 `PRD Key` / project key 를 uppercase 로 쓰고, `ticket_` bracket 값은 티켓 `ID` / 파일명에서 lower-case 로 쓴다. PRD key 가 없는 legacy 티켓만 `[ticket_NNN]` 으로 fallback 한다. 티켓 `Title` 을 bracket 값으로 쓰지 않는다.
8b. **Worker pass 보장 — shell sanity gate 가 거짓 pass 를 잡는다.** Impl AI 가 `runner-tool.ts worker submit-to-verifier` 또는 `runner-tool.ts worker finalize-approved` 를 호출하면 backend finalizer 는 AI 가 적은 evidence 와 무관하게 다음 mechanical 검사를 다시 실행한다. 하나라도 실패하면 ticket 을 `Stage: blocked` 로 두고 pass 를 거부한다.
   - `git diff <Worktree.Base Commit>..HEAD` 변경 line 합 ≥ 1 (worktree 안에서). 변경이 0 이면 `shell_sanity_gate_zero_diff` 로 차단.
   - ticket `## Done When` 섹션이 비어 있지 않고 모든 `- [ ]` 항목이 `- [x]` 로 체크돼 있어야 한다. 비어 있으면 `shell_sanity_gate_done_when_empty`, 미체크 항목이 남아 있으면 `shell_sanity_gate_done_when_unchecked` 로 차단.
   AI 는 코드를 실제로 고쳐 모든 Done When 조건을 충족시킨 뒤 각 항목을 `[x]` 로 체크하고 pass 를 호출한다. 사후에 ticket 본문만 수정해 [x] 박는 우회는 의미가 있지만 zero-diff 로 자동 차단된다 (실제 코드 변경이 없으므로). shell sanity gate 가 막은 ticket 은 다음 tick 의 worker 가 다시 작업해 통과시킬 수 있다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. worker 는 `.autoflow/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, 검증 관련 파일 이동, worktree 통합, local `git add` / `git commit` 에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. local runner 와 adapter one-shot execution 은 지원한다. embedded terminal 은 별도 단계로 추가한다. 기본 자동화는 Claude `/autoflow` 또는 Codex `$autoflow` skill 로 PRD 를 `tickets/prd/` 에 전달하거나, Claude `/order` / Codex `$order` / `#order` 로 짧은 요청을 `tickets/order/` 에 떨어뜨린 뒤, `autoflow run planner` (Plan AI) 가 generated PRD / todo 티켓을 만들고 `autoflow run ticket` (Impl AI) 가 그 티켓을 끝까지 가져가는 흐름이다. `#autoflow` 는 호환 alias 로 유지한다. `#plan`, `#todo` 는 레거시 role-pipeline 호환 트리거로 남겨 두지만 새 작업에서 권장하지 않는다.
14. heartbeat / runner tick 이 종료될 때는 현재 공정률을 표기한다. 가능하면 `autoflow metrics` 또는 보드의 PRD/ticket 집계를 기준으로 한 percent 를 tick 의 마지막 대화/로그 요약에 남긴다.
15. 문서 언어 정책: 새로 생성되는 Autoflow PRD(`prd_NNN.md`), plan, ticket, 사용자 친화 order 본문과 사용자 대상 설명은 기본적으로 한국어로 작성한다. 단, parser 가 읽는 섹션명, 필드명, key=value 출력, 경로, 명령어, 코드, ticket id, project key, runtime contract 는 기존 포맷과 언어를 유지한다. AI / runner 전용 계약 문서(`.autoflow/agents/`, `rules/`, `reference/` 등)는 parser 호환 구조를 유지하되, 사람이 읽는 placeholder / 설명 문장은 한국어 작성 기준을 반영할 수 있다.
15a. 터미널 / adapter / heartbeat 에서 사용자가 읽는 AI 대화, 진행 요약, 설명 문장은 기본적으로 한국어로 쓴다. 단, key=value 출력, 경로, 명령어, 코드, ticket 필드, parser 가 읽는 형식, AI용 보드 계약은 원래 포맷과 언어를 유지한다.
16. 사용자 노출 worker 표기(`ticket`, `verification`, `log`, desktop markdown preview`)는 storage 식별자 `worker-N` / legacy `ai-N` 를 preferred display wording 으로 정규화한다. 해당 역할의 enabled runner 가 1개뿐이면 `worker`처럼 숫자 접미사를 숨기고, 2개 이상이면 `worker-N` 형태를 유지한다. runner state 파일 이름, runtime role 키, config 상의 실제 worker id 는 바꾸지 않는다.
17. Autoflow 개발에서 데스크톱 UI 컴포넌트(`apps/desktop/src/components/ui/` + 그 위 화면)는 **shadcn/ui 방식의 로컬 React 컴포넌트와 lucide-react 아이콘을 우선** 사용한다. UI 기능을 추가하거나 수정할 때는 shadcn CLI(`shadcn init`, `shadcn add`)의 구조처럼 컴포넌트를 앱 안에 소유하고, 아이콘은 lucide-react에서 가져온다. MUI Material / Emotion theme wrapper / MUI 전용 class(`Mui*`)는 새로 추가하지 않고, 기존 MUI 의존 코드가 같은 패턴을 다루고 있으면 shadcn/lucide 기반 로컬 컴포넌트로 점진 제거한다. modal/dialog/sheet/popover/tooltip/dropdown/command/toast 같은 인터랙션 패턴은 shadcn 스타일의 접근성 있는 컴포넌트로 구현하며, 키보드 Escape, focus management, ARIA 요건을 충족한다.
18. wiki 자동화 규칙: wiki 는 Wiki AI(`wiki`) 가 소유한다. Impl AI 의 `finish-ticket.ts` / `merge-ready-ticket.ts` finalizer 는 `update-wiki.ts` 를 자동 호출하거나 `.autoflow/wiki/` 를 completion commit 에 stage 하지 않는다. `wiki` 이 source 변화와 기존 managed baseline 을 먼저 보고 실제 수정이 필요할 때만 `autoflow wiki update` 를 도구로 호출한다. 내용 변화가 없고 확인 시간만 있는 경우에는 `.autoflow/runners/state/wiki-baseline.history` 만 갱신하며 wiki commit 을 만들지 않는다. AI synthesis 는 debounce 를 적용해 의미 있는 wiki file-weight 가 `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES` 이상이거나 `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS` 경과 시 `autoflow wiki query --synth` / `autoflow wiki lint --semantic` 으로 묶어서 수행한다. Wiki scoped autocommit 은 adapter 실행 후 content gate 를 적용한다. `wiki/index.md`, `wiki/log.md`, `*.manifest`, `*.history`, `*.fingerprint` 만 바뀐 경우와 `git diff -w` 기준 cosmetic-only diff 는 commit 하지 않는다. 기본 commit gate 는 `AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD=5`, `AUTOFLOW_WIKI_COMMIT_MIN_LINES=30` 이며, 신규 파일은 weight 임계를 충족하면 line 임계를 우회하고 삭제 파일은 line 임계와 무관하게 의미 있는 변화로 처리한다. 의미 있는 wiki commit subject 는 `[wiki] update: <primary category> / <total> total, +<add>/-<del>` 형식을 사용한다. **RAG 검색 (PRD 223, 2026-05-09):** `autoflow wiki query --rag` 의 phase 1 백엔드는 sqlite FTS5 virtual table + bm25() ranking 이다. 인덱스 파일은 `.autoflow/runners/state/wiki-search.db` 에 보관되며 gitignored 다. 인덱서 `.autoflow/scripts/wiki-search-index.ts` 는 `AUTOFLOW_WIKI_FTS_INDEX=on` 일 때만 동작하는 opt-in 이고, 같은 path+content_sha 면 재실행에서 skip 된다. chunk 단위는 1024 char (overlap 128 char) 이며 결과는 BM25 score desc 로 정렬된다. 인덱스 파일이 없거나 sqlite3 / FTS5 / python3 가 빠졌으면 query 측은 자동으로 기존 chunk grep fallback 으로 떨어지고 stderr 에 한 줄 경고만 남긴다 (1원칙: 검색이 절대 막히지 않는다).
**RAG 검색 (PRD 229, 2026-05-09):** phase 2로 `AUTOFLOW_WIKI_VECTOR_INDEX=on` + `AUTOFLOW_WIKI_EMBEDDING_PROVIDER` 준비 시 `wiki query --rag` 가 BM25 후보를 vector 유사도와 hybrid scoring 해서 `rag_backend=hybrid` 를 사용할 수 있다. 벡터 provider 미구성/임베딩 미생성/실패 시에는 동일 호출이 `rag_backend=fts5_bm25` 또는 chunk_grep fallback 으로 자동 복귀하고 exit 0 을 유지한다. vector 캐시는 `.autoflow/runners/state/wiki-search.db` 내부 `wiki_vectors` 에 저장되며 gitignored 상태로 유지해 결과 산출물/캐시가 버전 추적되지 않는다.
19. adapter timeout watchdog: 모든 agent 호출(`codex` / `claude` / `opencode` / `gemini` / custom command)은 `run_with_timeout` 으로 감싼다. 기본 timeout 은 `AUTOFLOW_AGENT_TIMEOUT_SECONDS` (기본 1200초). timeout 발생 시 SIGTERM 후 `AUTOFLOW_AGENT_KILL_AFTER_SECONDS` (기본 30초) 안에 안 죽으면 SIGKILL. timeout 으로 끝난 tick 은 exit 124 → state 에 `last_result=adapter_timeout`, runner_status 는 `idle` 로 두어 다음 tick 이 재시도한다. 누적 timeout 은 `consecutive_timeout_count` 필드로 추적하며, `AUTOFLOW_AGENT_TIMEOUT_FALLBACK_THRESHOLD` (기본 3) 도달 시 `adapter_timeout_fallback` 이벤트를 emit 하고 state 의 `last_result` 가 `adapter_timeout_fallback` 이 된다. 정상(exit 0) tick 이 한 번이라도 발생하면 카운터는 0 으로 reset 된다. wiki agent 가 timeout 으로 끝난 직후 `.autoflow/wiki/` 의 partial 변경을 자동 폐기하려면 `AUTOFLOW_WIKI_TIMEOUT_DISCARD_PARTIAL=1` 로 opt-in. 기본은 폐기하지 않고 다음 tick 의 manifest hash 가 자연 회복하도록 둔다. timeout 은 `git push` 와 무관하며 push 는 어떤 상황에서도 금지다.
19a. planner / worker adapter prompt 는 role별 input byte cap 을 기본 적용한다: `AUTOFLOW_PLANNER_PROMPT_BYTES=65536`, `AUTOFLOW_WORKER_PROMPT_BYTES=98304` (unset 시 이 기본값 사용). cap 초과 prompt 는 head 60% + tail 40% 를 남기고 중간에 `[... N bytes elided to save tokens ...]` marker 를 삽입한 뒤 adapter 호출을 계속 진행한다. cap 발동 흔적은 `.autoflow/runners/logs/*.log` 의 `prompt_bytes_capped=NNN` 라인으로 남긴다.
19a1. **claude adapter stream-json 기본 (PRD 228, 2026-05-09):** 설치된 `claude` CLI 의 `--help` 가 `stream-json` 토큰을 노출하면 Autoflow 는 기본적으로 `claude -p ... --output-format stream-json --include-partial-messages --verbose` 로 호출해 partial message / tool_use / message_delta 를 JSONL 한 줄씩 즉시 stdout 으로 흘린다. 결과 사이드카(`*_last_message.txt`) 에는 마지막 `{"type":"result","subtype":"success",...}` 의 `result` 필드가 들어가고, 추출 실패 시 assistant text concat / raw stdout fallback 이 적용된다. `AUTOFLOW_CLAUDE_STREAM=0` 또는 CLI 가 stream-json 미지원이면 자동으로 legacy `--output-format text` 로 rollback (1원칙: legacy fallback 항상 살아 있음).

19b. adapter output 도 role별 기본 cap 을 적용한다: `AUTOFLOW_PLANNER_MAX_OUTPUT_TOKENS=8000`, `AUTOFLOW_WORKER_MAX_OUTPUT_TOKENS=16000`, `AUTOFLOW_WIKI_MAX_OUTPUT_TOKENS=2000` (unset 시 이 기본값 사용). 현재 설치된 adapter CLI 가 native max-output flag 를 제공하지 않아도 후처리 fallback 으로 최종 응답 끝에 `output_truncated=true` marker 를 붙이고, `.autoflow/runners/logs/*.log` 에 `event=output_cap_applied ... output_truncated=true` 와 `adapter_finish ... output_truncated=true|false` 를 남긴다. 최근 24h `adapter_finish` 중 `output_truncated=true` 비율이 5%를 넘으면 해당 role cap 상향을 권장한다.
19c. **Realtime (event-driven) wakeup 은 4 runner 모두 일관 적용된다 (opt-in).**
- 우산 env: `AUTOFLOW_RUNNER_REALTIME_ENABLED=1` 이면 planner / worker / verifier / wiki 4개 모두 event-driven 모드.
- 개별 env: `AUTOFLOW_PLANNER_REALTIME_ENABLED=1`, `AUTOFLOW_TICKET_REALTIME_ENABLED=1` (worker), `AUTOFLOW_WIKI_REALTIME_ENABLED=1` 으로 role 별 활성도 가능.
- Runner 별 watch 폴더:
  - planner: `tickets/order/order_*.md`, `tickets/order/order_*_retry_*.md`, `tickets/prd/prd_*.md`
  - worker (ticket): `tickets/todo/Todo-*.md`
  - verifier: `tickets/verifier/Todo-*.md`
  - wiki: `tickets/done/*.md`, `tickets/order/order_*_retry_*.md`, `wiki/*.md` (기존 wiki debounce 정책 유지)
- 동작: loop sleep 도중 watch 폴더 변경을 감지하면 기존 `interval_seconds` 만료 전에 다음 tick 으로 깨어남. 변경은 `.autoflow/runners/state/<runner>.<public_role>-realtime-wakeup.pending` marker 1개로 병합되며 loop 는 단일 child 실행 경로를 유지한다.
- 직전 전체 input fingerprint 와 같으면 기존 idle skip (`planner_inputs_unchanged`, `ticket_inputs_unchanged`) 이 adapter LLM 호출을 생략한다.
- **권장 운영**: realtime 모드에서는 `interval_seconds` 를 safety heartbeat 로 재정의 (기본 1800s = 30분 권장). adapter timeout 회복은 heartbeat 로 보장된다.
- env 가 unset 또는 `0` 이면 기존 interval/backoff polling 동작만 사용 (역호환).
19d. **PTY wake safety poll env knobs (PRD_274, 2026-05-11):** desktop `apps/desktop/src/main.js` 의 PTY wake safety poller 가 사용하는 env 변수 3개. `AUTOFLOW_WAKE_POLL_INTERVAL_SEC` (기본 60) — safety poll tick 주기(초); `AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC` (기본 30) — 이 초 동안 wake 신호가 없으면 runner 를 idle 로 판단; `AUTOFLOW_WAKE_STALL_THRESHOLD_SEC` (기본 1800) — 이 초 이상 wake 가 없으면 fingerprint 변경 여부와 무관하게 wake 강제 발사. 발사 기록은 `.autoflow/runners/logs/wake-poll.log` JSONL 에 남는다.
19e. **티켓 사이 컨텍스트 리셋 (PRD_278, 2026-05-11):** worker 가 티켓 pass 직후 desktop의 board watcher 가 `tickets/done/*/Todo-*.md` 파일 출현을 감지하면 worker PTY 에 자동으로 context-reset 슬래시 명령을 주입한다. `AUTOFLOW_CONTEXT_RESET_BETWEEN_TICKETS=1` (기본 on) — 주입 활성화; `AUTOFLOW_CONTEXT_RESET_TOKEN_THRESHOLD=100000` (기본 100k) — 누적 토큰이 임계 이하면 `/compact` (claude), `/compact` (codex), `/compress` (gemini), 초과하면 `/clear` / `/new` / `/chat new` 로 escalate; `AUTOFLOW_CONTEXT_RESET_RESPAWN_FALLBACK=1` (기본 on) — 주입 후 30초 내 PTY 출력 없으면 runner 재스폰. 주입 직후 `[wake] fresh-start` 도 함께 전송해 다음 턴이 fresh context 에서 시작되도록 한다. 로그: `<runner>.log` 에 `event=context_reset mode=compact|clear trigger=ticket_pass cumulative_before=N` key-value 행 기록. **Sticky prelude 보존 (PRD_281, 2026-05-12):** worker 가 `tickets/inprogress/Todo-*.md` 를 claim 할 때 board watcher 가 `.autoflow/runners/state/<runner-id>-sticky-context.md` 를 자동 생성한다 — ticket 의 Allowed Paths · Done When · Acceptance Probe 섹션을 추출해 기록. context reset(`/compact` 또는 `/clear`) 주입 후 `[wake] fresh-start` 에 이어 `[sticky-context]` prompt 를 PTY 에 재주입해 핵심 제약이 압축/초기화 후에도 다음 턴 컨텍스트에 유지되도록 한다. `AUTOFLOW_CONTEXT_RESET_STICKY=1` (기본 on) 으로 제어; `0` 으로 비활성화하면 기존 reset 동작만 수행. 재주입 실패는 best-effort — reset 자체는 항상 진행된다 (1원칙). 로그: `event=context_reset_sticky_inject` 행으로 기록.
20. Queue priority policy: order, PRD queue item, todo ticket queues sort by priority before numeric FIFO. Supported values are `critical`, `high`, `normal`, and `low`; missing or unknown priority is `normal`. Use `critical` only for host resource exhaustion, board integrity loss, security exposure, or Autoflow self-recovery threats. Use `high` for urgent user-visible breakage or blocked active work, `normal` for ordinary planned work, and `low` for cleanup or non-urgent improvements. **Cross-category (PRD 211, 2026-05-09):** planner tick 이 동시에 order 와 PRD queue item을 볼 때, priority 가 같으면 PRD queue item → todo 변환을 order → 새 PRD 작성보다 먼저 한다. priority 가 다르면 priority enum 이 카테고리(prd vs order)보다 우선이다. retry order(`order_*_retry_*.md`) 와 express order(rule 21) 는 이 정책 적용 대상이 아니며 자체 분기에서 우선 처리된다. 같은 PRD queue item 이 `AUTOFLOW_PRD_FIRST_STUCK_LIMIT` (legacy alias `AUTOFLOW_PRD_FIRST_STUCK_LIMIT`, 기본 3) tick 연속 promote 못 하면 그 tick 한정으로 order fallback (starvation guard, `.autoflow/runners/state/prd-first-stuck.json`).
21. **Express path (PRD 1, 2026-05-09):** order skill 이 `## Order > - Express: true` 와 함께 concrete `## Allowed Paths` + `## Done When` 을 박은 order 는 planner 가 PRD 작성을 건너뛰고 곧장 `tickets/todo/Todo-NNN.md` 를 만든다. project key 는 `express_<order_id>` 이며 commit message 는 자동으로 `[EXPRESS_NNN][ticket_NNN] ...` 형식이 된다. Allowed Paths 또는 Done When 이 비어 있으면 planner 가 일반 PRD 흐름으로 fallback 한다 (fail-safe). Express ticket 도 동일 sanity gate (zero-diff + Done When 체크) 를 통과해야 pass 가 된다. CLI 에서는 `autoflow order create ... --express` 또는 fallback 으로 `## Order` 섹션에 `Express: true` 라인을 직접 넣는다.
22. **Change Type matrix (PRD 2, 2026-05-09):** ticket 의 `## Ticket > - Change Type:` 값에 따라 finalizer sanity gate 가 분기된다.
    - `code` (default): `git diff <Worktree.Base Commit>..HEAD` 변경 line 합 ≥ 1 + Done When 전체 [x] 필요. 기존 동작과 동일.
    - `docs`, `cleanup`: zero-diff 가 허용된다 (예: 파일 이동 / 삭제만으로 완료되는 ticket). Done When 체크는 그대로 강제된다.
    - `infra`: `AUTOFLOW_INFRA_MIN_DIFF_LINES` (기본 10) line 이상 변경이 있어야 pass. 미달 시 `shell_sanity_gate_zero_diff_infra` 로 차단.
    Change Type 이 ticket 에 없으면 `code` 로 간주한다. 분류 우회로 sanity gate 를 회피하지 않게, planner 와 worker 모두 변경 의도가 docs/cleanup/infra 인 경우만 명시적으로 박는다.
23. **Model tier guidance (PRD 3, 2026-05-09):** runner config 의 `model` 은 다음 권장값을 기본으로 한다 — `planner` sonnet-class, `worker` opus-class, `wiki` haiku/flash-class. 사용자가 `model` 을 명시한 경우 명시값이 우선한다. realtime 모드 활성 시 `interval_seconds` 는 safety heartbeat 로 1800s (30분) 이상을 권장한다. prompt cache 는 5분 TTL 안에 들어와야 효과가 있으므로, idle-skip (`maybe_skip_unchanged_idle_preflight`, `maybe_skip_unchanged_wiki_turn`) 가 input fingerprint 일치 시 LLM 호출을 생략하는 것이 cache 무효화를 막는 1차 방어선이다. fingerprint 가 자주 깨지면 prompt 의 동적 영역이 너무 자주 변하는지 점검한다.
24. **Path conflict guard (PRD 5, 2026-05-09 / PRD_279 2026-05-12):** `runner-tool.ts worker claim` 의 todo dispatcher 는 `dispatch.lock/` mkdir mutex 로 동시 claim race window 를 차단한다 — 두 워커가 동시에 진입하면 한 쪽만 lock 을 획득하고 나머지는 즉시 return 1. lock 파일에는 소유 프로세스 PID 가 기록되며, holder 가 죽고 30초 경과 시 stale lock 을 자동 회수한다. Path conflict guard 는 **default on**; 명시적으로 `AUTOFLOW_PATH_CONFLICT_CHECK=off` (또는 `0`/`false`/`no`) 로만 끌 수 있다. guard 가 켜진 상태에서 dispatcher 는 다른 worker 의 inprogress ticket 과 Allowed Paths 가 겹치는 후보를 건너뛴다. 충돌 검사는 `scripts/path-conflict-check.ts <ticket-a> <ticket-b>` 로 사람이 직접 호출할 수도 있다 (exit 0=disjoint, 1=overlap, 2=error).
25. **PR draft autogen (PRD 6, 2026-05-09):** worker 가 ticket pass 로 inline merge 까지 끝낸 직후 finalizer 가 `.autoflow/runners/state/pr-drafts/<ticket-id>.md` 에 PR 본문 초안을 만든다. 본문은 ticket Title, PRD/ticket 헤더, Done When 체크 결과, `git diff --stat <base>..HEAD`, verification command 를 모은다. 이 파일은 **gitignored** 라 commit 되지 않는다. `git push` 는 어떤 경로에서도 자동 실행되지 않으며 (1원칙), 사용자가 직접 push 한 뒤 `gh pr create --body-file .autoflow/runners/state/pr-drafts/<ticket-id>.md` 로 한 번에 PR 을 올릴 수 있다.
26. **State ledger scaffold (PRD 7, 2026-05-09):** `.autoflow/state-schema/v1.sql` 가 sqlite schema, `.autoflow/scripts/state-db.ts` 가 entrypoint, `.autoflow/state.db` 가 snapshot DB (gitignored). Phase 1 은 markdown/state 파일을 주기적 sync 하는 스냅샷 모드: `state-db.ts sync` 로 갱신, `drift-summary` 로 markdown vs sqlite 일치 여부 확인. `autoflow doctor` 가 state.db 가 있으면 자동으로 drift 결과를 emit. write-time dual-write 와 read-side 전환은 phase 2 에서 진행한다. 현재 단계에서는 state.db 가 없어도 모든 runner 가 정상 동작한다.
27. **Portable sidecar layer (PRD 8, 2026-05-09):** `.autoflow/project/` 는 사용자 소유 디렉토리이며 `autoflow upgrade` 가 절대 덮어쓰지 않는다. `.autoflow/project/hooks/verify-pre.sh` 와 `verify-post.sh` 가 존재하고 실행 권한이 있으면 worker 가 verify 직전/sanity gate 직후에 best-effort 호출한다. 실패는 stderr 로 경고만 출력하고 ticket 흐름을 차단하지 않는다 (1원칙 보존). hook 에 전달되는 환경변수는 `AUTOFLOW_HOOK_TICKET_FILE`, `AUTOFLOW_HOOK_TICKET_ID`, `AUTOFLOW_HOOK_PRD_KEY`, `AUTOFLOW_HOOK_CHANGE_TYPE`, `AUTOFLOW_BOARD_ROOT`, `AUTOFLOW_PROJECT_ROOT` 다. agent prompt / rules / templates 의 core 디렉토리 분리 (`autoflow upgrade` in-place override) 는 phase 2 에서 진행한다.

## Trigger Interpretation

- `#autoflow`
  - Claude `/autoflow`, Codex `$autoflow` 와 같은 PRD handoff alias 다.
  - 자유 대화로 요구사항을 모으고, 범위가 크면 PRD split map(후보 PRD, 경계, 의존 순서, 검증 초점)을 먼저 제안한다.
  - draft 트리거가 있을 때만 전체 PRD 초안을 출력한다. split 이 적합하면 여러 PRD 초안을 각각 분리해 보여줄 수 있다.
  - 별도의 명시적 저장 트리거가 있을 때만 `.autoflow/tickets/prd/prd_{NNN}.md` 에 PRD 를 저장한다. 여러 PRD 는 각 PRD별 승인 또는 명확한 `전부 저장` / `save all` 승인 뒤 별도 PRD 파일로 순차 저장한다.
  - 이후 Plan AI 가 PRD queue item을 todo 로 변환하고, worker runner 가 Autoflow 보드에서 mini-plan / 구현 / 검증 / evidence 를 한 번에 이어받는다.
  - plan / ticket / 구현은 시작하지 않는다.

- `#order`
  - Claude `/order`, Codex `$order` 와 같은 quick intake alias 다.
  - 단순 수정 요청을 PRD 없이 `.autoflow/tickets/order/order_NNN.md` 에 저장한다 (파일 이름 prefix `order` 와 CLI `autoflow order create` 는 호환을 위해 그대로 둠).
  - 원 요청은 `## Request` 에 보존하고, 확실한 경우에만 scope / Allowed Paths / Verification hint 를 적는다.
  - plan / ticket / 구현은 시작하지 않는다. 이후 Plan AI 가 order 의 노트를 구현 지시로 해석해 안전한 가장 좁은 범위의 generated PRD 와 todo ticket 으로 승격한다. order 는 반복 질문 루프를 만들지 않는다.

- `#plan`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 plan 작업은 항상-on Plan AI(`planner`) loop runner 가 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 planner heartbeat 를 1분 주기로 생성 또는 재개한다.
  - actionable order 또는 populated PRD 가 있으면 계속 처리해 generated PRD / plan 을 작성하고, start-plan 런타임으로 `.autoflow/tickets/todo/` 티켓을 만든다.
  - 실제 ticket 생성이 끝난 PRD 와 plan 은 `.autoflow/tickets/done/<project-key>/` 로 이동한다.
  - verifier replan 뒤 worker 가 생성한 `.autoflow/tickets/order/order_*_retry_*.md` 도 일반 order 처럼 처리한다. `retry_decision=needs_user` 인 파일은 order 에 그대로 두고 사용자 결정을 기다린다.
  - 현재 plan 이 ticketed 가 됐거나 worker 가 `.autoflow/tickets/done/<project-key>/` 으로 넘긴 뒤에도 PRD 큐에 다음 populated PRD 가 남아 있으면 계속 다음 plan 으로 이어간다.
  - 특정 티켓이 `needs_user` 여도 planner 는 증거를 남기고 다른 actionable PRD/todo 흐름을 계속 살린다.
  - 사용자가 멈추라고 하기 전까지 자동화는 계속 살아 있어야 한다.

- `#todo`
  - legacy role-pipeline 호환 트리거다. 기본 토폴로지에서 todo claim + 구현 + 검증 + 머지는 Impl AI(`worker`) 가 atomic 하게 처리하므로 새 작업에서는 사용 권장하지 않는다.
  - 현재 스레드에서 명시적으로 호출하면 todo heartbeat 를 1분 주기로 생성 또는 재개한다.
  - 처리할 `.autoflow/tickets/todo/` 가 있으면 `inprogress/` 로 옮기고 티켓별 worktree 를 만든 뒤 같은 worker 가 그 worktree 에서 구현 / 검증 / 머지까지 진행한다.
  - 작업이 끝나면 verifier 로 제출한다. verifier pass 뒤 worker 가 merge/finalize 하면 `done/<project-key>/` 로 이동하고 local commit 한다. verifier revise 는 같은 worktree 에서 보정하고, verifier replan 은 worker 가 order retry order 를 만든 뒤 worktree 를 삭제한다.
  - 막힌 사유가 생겨도 worker 는 ticket 에 증거와 다음 safe action 을 남기고, 런너 자체는 사용자가 멈추기 전까지 계속 살아 있어야 한다.
