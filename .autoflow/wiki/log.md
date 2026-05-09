# Wiki Log

Chronological notes derived from completed tickets, reject learnings, and operational logs.

## Managed Log

Generated entries may be inserted here.
This curated milestone list summarizes representative milestones from the early board foundation through the recent wiki/runtime refinements. For current counts and broader work context, use [[index]] and [[project-overview]].
Recent synthesis answers for newer completed work are intentionally filed back through [[index]]; for example, May 1 additions covering `prd_088`, `prd_089`, and `prd_090` are linked under `Recent Synthesis` there rather than repeated verbatim in this historical timeline.
The managed `Derived Timeline` below is a deterministic baseline sample, not a full recency-sorted changelog. Treat [[index]] `Recent Synthesis` as the entrypoint for newer focused work.

Each entry should cite its source ticket or log.

- **[[sources/prd_222]]** (데스크톱 ticket dialog deprecated reject/ + legacy naming 보 정)
- **[[sources/prd_221]]** (AiConversationPanel 라이브 어댑터 스트림 타이핑 애니 메이션)
- **[[sources/prd_219]]** (AI 스킬 탭 로딩/조회수 분리 재시도 — 참고: prd_212에 서 SKILL 시스템이 제거됨에 따라 이 최적화는 안전한 종료/잔재 정리 목적으로 수행 됨)
- **[[answers/skill-system-removal]]** (SKILL 시스템 전면 제거 요약)
- **[[sources/prd_218]]** (통계 탭 처리 시간 카드 추가)
- **[[answers/recent-refinements-20260509-v3]]** (최근 핵심 및 UI 개선 요약 v3. prd_208 스킬 최적화는 SKILL 시스템 제거로 인해 더 이상 유효하지 않음)
- [[sources/prd_213]] (SKILL 제거 Phase 2 — CLI 및 RAG 카운터 제거)
- [[sources/prd_212]] (SKILL 시스템 전면 제거 - Option B)
- [[sources/prd_211]] (Planner Backlog PRD 우선 처리 정책)
- [[sources/prd_210]] (Worker / LLM Wiki 라벨 영어화)
- [[sources/prd_209]] (러너 카드 내부 설정 행 1줄 고정)
- [[sources/prd_208]] (AI 스킬 탭 로딩 지연 최적화 — 참고: prd_212에서 SKILL 시스템이 제거됨에 따라 현재는 유효하지 않은 기록임)
- [[sources/prd_207]] (터미널 뷰 러너 시작/정지 binary 상태 표시 (prd_207))
- [[sources/prd_206]] (AI Autoflow 그리드 1줄 3칸 고정)

- `prd_001` - Restructure Wiki & Handoff panel — handoff as wiki source, not a peer. Source: `tickets/done/prd_001/prd_001.md`.
- `prd_004` - Add in-app Help section explaining sidebar and core terms. Source: `tickets/done/prd_004/prd_004.md`.
- `prd_005` - Rename "spec" terminology to "PRD" (UI + docs + CLI alias). Source: `tickets/done/prd_005/prd_005.md`.
- `prd_012` - Historical runner-id rename proposal. The ticket was closed as superseded and the proposed changes were not applied, preserving the existing runner ID topology. Source: `tickets/done/prd_012/tickets_012.md`.
- `prd_016` - Pin AI progress board to a 2-left / 1-right tall layout when three runners are present (Superseded by [[sources/prd_206]]). Source: `tickets/done/prd_016/tickets_016.md`.
- `prd_021` - Workflow page UI overhaul — collapse sidebar label, wrap progress bar, simplify card titles, hoist AI controls into the cards. Source: `tickets/done/prd_021/tickets_021.md`.
- `prd_023` - Remove left-border color accents from AI progress cards and all workflow pin bars. Source: `tickets/done/prd_023/tickets_023.md`.
- `learning` - Recorded how to resolve `dirty_scope_conflict` when the ticket patch is already present in `PROJECT_ROOT` but unrelated dirty edits remain in the same file. See [[answers/merge-blocked-already-applied-patch-summary]].
- `prd_024` - Convert ticket workspace right preview into a click-to-open layer like the workflow PRD pin. Source: `tickets/done/prd_024/tickets_024.md`.
- `learning` - Manual Recovery and Worktree Consolidation (2026-04-27). See [[learnings/manual-merge-recovery-20260427]] for the consolidation path that resolved dirty-scope conflicts around tickets 012, 016, 021, and 025.
- `prd_025` - Audit AI progress stages and fix dot alignment so the bar matches runtime-observable signals. Source: `tickets/done/prd_025/prd_025.md`.
- `prd_026` - Fix Gemini app icon in Desktop AI runner UI. Source: `tickets/done/prd_026/prd_026.md`.
- `prd_027` - Historical design-kit migration attempt from shadcn/Radix/Tailwind to MUI. Refer to [[decisions/design-kit-mui-migration]] for the current rule that new Desktop UI work prefers local shadcn-style components. Source: `tickets/done/prd_027/prd_027.md`.
- `prd_028` - Simplify desktop runner control buttons. Source: `tickets/done/prd_028/prd_028.md`.
- `prd_030` - Add Inbox tab to Ticket Workspace. Source: `tickets/done/prd_030/prd_030.md`.
- `prd_035` - Apply MUI dashboard design to the Statistics page. Source: `tickets/done/prd_035/prd_035.md`.
- `prd_037` - Fix Statistics page scrolling. Source: `tickets/done/prd_037/prd_037.md`.
- `prd_038` - Enable Wiki Bot (`wiki-1`) to use the Codex adapter while preserving Gemini support. Source: `tickets/done/prd_038/tickets_038.md`.
- `prd_039` - Replace user-visible `AI-N` worker attribution with `worker-N` (later normalized to `Worker AI` in the UI) while keeping legacy ownership matching compatible. Source: `tickets/done/prd_039/tickets_039.md`.
- `prd_040` - Removed unsupported Gemini 3.1 preview model ids from Desktop runner options. Source: `tickets/done/prd_040/tickets_040.md`.
- `prd_042` - Kept the Ticket Workspace on the PRD / Inbox / Issued 3-tab layout while left-aligning list rows and preserving the detail layer. Source: `tickets/done/prd_042/tickets_042.md`.
- `prd_045` - Shortened planner `next_action` output while preserving machine-readable runtime keys. Source: `tickets/done/prd_045/tickets_045.md`.
- `prd_047` - Compressed successful `verify-ticket-owner` output into short pass excerpts while keeping larger failure tails. Source: `tickets/done/prd_047/tickets_047.md`.
- `prd_048` - Compressed successful `finish-ticket-owner` inline merge output into a one-line summary while keeping diagnostic paths verbose. Source: `tickets/done/prd_048/tickets_048.md`.
- [[sources/prd_195]] (telemetry 5.2T 재시도 및 dirty-root 정리)

- [[sources/prd_196]] (데스크톱 위키 Runner 설정 폭 정렬)

- [[sources/prd_205]] (데스크톱 retry order 파일 노출 보정 및 dirty-root 재시도)
- [[sources/prd_204]] (워크플로 핀 레이어 안내 문구 제거 및 dirty-root 재시도)
- [[sources/prd_203]] (러너 설정 화면 '저장하고 재시작' 버튼 제거 및 dirty-root 재시도)

- [[sources/prd_202]] (데스크톱 메뉴명 'AI AutoFlow'로 변경)
- [[sources/prd_201]] (Todo-NNN 티켓 파일명 규칙 전환 (Todo-NNN.md))
- [[sources/prd_200]] (post-merge cleanup 실패 시 무한 재시도 방지 로직 보정)

- [[sources/prd_197]] (telemetry post-merge cleanup 실패 재발 방지)

- [[sources/prd_194]] (데스크톱 오른쪽 러너/AI 카드 모델 변경 설정 항상 표시)
- [[sources/prd_193]] (러너 설정 화면의 저장하고 재시작 버튼 제거)
- [[sources/prd_192]] (데스크톱 runner start/stop transition 중 중복 클릭 방지)
- [[sources/prd_191]] (worker 5.2T token telemetry raw row 출처 추적과 재발 방지 보강)
- [[sources/prd_190]] (monitoring cross-verification root-cause 패턴을 wiki learnings 로 기록)
- `prd_050` - Added semantic wiki lint fingerprint gating and prompt-budget smoke coverage. Source: `tickets/done/prd_050/tickets_050.md`.


<!-- AUTOFLOW:BEGIN derived-timeline -->
## Derived Timeline

- Last rebuilt: 2026-05-09T07:17:03Z

### Completed Tickets

- `prd_224` - AiConversationPanel 진행 중 활동 인디케이터 (elapsed + tokens). 사용자는 "일을 하고 있는것인지 모르겠는데 이런식으로 (※ 45s · ↓ 272 tokens) 하단에 여백을 주고 표시가 가능할까?"라고 요청했다. order_196 이 안 A (활동 인디케이터) 와 안 B (터미널 임베드) 두 옵션을 제시했고, 본 PRD 는 사용자가 권장한 안 A 만 다룬다. 안 B 는 별도 PRD 후보. Source: `tickets/done/prd_224/prd_224.md`.
- `prd_223` - wiki RAG 검색을 sqlite FTS5 + BM25 로 전환 (phase 1, vector 는 옵셔널 후속). Source: `tickets/done/prd_223/prd_223.md`.
- `order_195` - 위키 검색 sqlite FTS5+BM25 도입 (vector 는 옵셔널 phase). Source: `tickets/done/prd_223/order_195.md`.
- `prd_222` - 데스크톱 ticket dialog 의 deprecated reject/ + legacy naming 보정. Source: `tickets/done/prd_222/prd_222.md`.
- `order_194` - 데스크톱 ticket dialog 의 deprecated reject/ + legacy naming 보정. Source: `tickets/done/prd_222/order_194.md`.
- `Todo-221` - 데스크톱 ticket dialog deprecated reject/ + legacy naming 보정. openTicketDialog 후보 경로에서 deprecated reject/ 제거, Todo-NNN/tickets_NNN cross-product 추가, npm run check 통과 Source: `tickets/done/prd_222/Todo-221.md`.
- `prd_221` - AiConversationPanel 라이브 어댑터 스트림 타이핑 애니메이션. Source: `tickets/done/prd_221/prd_221.md`.
- `order_193` - 러너 live adapter 스트림에 타이핑 애니메이션 적용. Source: `tickets/done/prd_221/order_193.md`.
- `prd_220` - 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간). Source: `tickets/done/prd_220/prd_220.md`.
- `order_192` - 통계 처리 시간 카드 라벨 명확화 (처리 시간 → 평균 처리 시간). Source: `tickets/done/prd_220/order_192.md`.
- `prd_219` - AI 스킬 탭 로딩/조회수 분리 재시도 (prd_208 retry 1). Source: `tickets/done/prd_219/prd_219.md`.
- `Todo-210` - AI 스킬 탭 로딩 지연 + 클릭 시 조회수 누적 분리. Implemented AI skill list usage sidecar batch read, CLI `view --no-bump`, and desktop manual-view read-only usage behavior. Source: `tickets/done/prd_219/order_210_retry_1_20260509T061154Z.md`.
- `prd_218` - prd_218. Source: `tickets/done/prd_218/prd_218.md`.
- `order_191` - 통계 탭에 처리 시간 카드 추가 (metrics 집계 + strip 3칸). Source: `tickets/done/prd_218/order_191.md`.
- `Todo-209` - AI work for prd_218. 통계 탭 처리 시간 metrics emit 및 카드 추가 Source: `tickets/done/prd_218/Todo-209.md`.
- `prd_217` - prd_217. Source: `tickets/done/prd_217/prd_217.md`.
- `prd_216` - prd_216. Source: `tickets/done/prd_216/prd_216.md`.
- `Todo-216` - AI work for prd_216. `/skill-this` trigger SKILL 디렉토리 4개(`.claude/skills/skill-this`, `.codex/skills/skill-this`, `integrations/claude/skills/skill-this`, `integrations/codex/skills/skill-this`)를 삭제하고 main 으로 머지했다. scaffold 사본은 처음부터 없었다. Source: `tickets/done/prd_216/Todo-216.md`.
- `prd_215` - prd_215. Source: `tickets/done/prd_215/prd_215.md`.
- `prd_214` - prd_214. Source: `tickets/done/prd_214/prd_214.md`.

### Verifier Logs

- # Verifier Completion Log Source: `logs/verifier_205_20260509_050251Z_pass.md`.
- # Ticket 189 Verification Log Source: `logs/verifier_189_20260508_040644Z_pass.md`.

### Reject Records

- No reject records.

### Conversation Handoffs

- PRD Handoff. Source: `conversations/prd_123/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_122/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_121/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_120/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_093/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_091/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_038/spec-handoff.md`.
- PRD Handoff. Source: `conversations/prd_022/spec-handoff.md`.
<!-- AUTOFLOW:END derived-timeline -->
