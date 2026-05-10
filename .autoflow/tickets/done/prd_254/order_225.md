# Autoflow Order

## Order

- ID: order_225
- Title: Bash 스크립트 → Node.js 점진 통일
- Status: inbox
- Priority: normal
- Created At: 2026-05-10T11:09:35Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Bash 스크립트 → Node.js 점진 통일
- Priority: normal
- Status: ready
- Change Type: code


Autoflow 가 이미 Node.js (Electron + autoflow CLI) 환경에서 돌고, 새로 만드는 자동화 (예: runner-stage.js) 도 .js 로 가기로 했다. 기존 .sh 자산도 가능한 범위에서 .js 로 점진 통일해 다음 이점을 얻는다.

- 데스크톱 main process 가 require 로 직접 호출 가능 (subprocess fork 회피)
- 공통 유틸 (state file parser, ticket markdown parser 등) 재사용
- Cross-platform (Windows 호환)
- TypeScript 타입 / 단위 테스트 적용 가능
- shell quoting / glob 함정 제거

## 자산 인벤토리 (조사 결과)

| 카테고리 | 파일 수 | 총 라인 | 마이그레이션 가치 |
|---------|---------|--------|------------------|
| `.autoflow/scripts/` (board orchestration) | 28 | 13K | **HIGH** — 주 active codepath |
| `runtime/board-scripts/` (위 스크립트의 source-of-truth, install 시 복사) | 25 | 22K | **HIGH** — `.autoflow/scripts/` 와 같이 마이그레이션 |
| `packages/cli/` (autoflow CLI subcommand 핸들러) | 20 | 23K | MEDIUM — 사용자 노출 CLI, 신중 |
| `tests/smoke/` | 68 | 12K | LOW — bash 가 이미 자연스러움, defer |

## 단계별 계획 (3-phase, 각 phase 가 독립 PRD)

**Phase 1 — 소형 무결성 스크립트** (총 ~1K 라인)
- `lint-ticket.js` (189 라인 → js)
- `board-guard.js` (474 라인)
- `integrate-worktree.js` (107 라인)
- `state-db.js` (219 라인)
- `path-conflict-check.js` (작은 가드)
- 의의: state-file integrity / ticket validation 관련 — 자주 호출되고 단순한 bash → 변환 즉시 효과

**Phase 2 — 티켓 lifecycle** (총 ~3K 라인)
- `start-ticket-owner.js` (738 라인)
- `finish-ticket-owner.js` (973 라인)
- `merge-ready-ticket.js` (855 라인)
- `handoff-todo.js` (130 라인)
- 의의: worker 의 atomic cycle 핵심. 정확한 동작이 가장 중요한 영역. 충분한 단위 테스트 함께.

**Phase 3 — planner 흐름** (~1K 라인)
- `start-plan.js` (1050 라인)
- 의의: 가장 복잡한 state machine. 안정화 후 마지막에.

**Defer / Skip**
- `tests/smoke/*.sh` 68개 — bash 가 자연스러운 영역 (외부 process spawn / git 명령 검증). 그대로 유지
- `packages/cli/runners-project.sh` 등 큰 runtime — PTY 모드 이후 호출 빈도 낮아 우선순위 낮음. 별도 검토 후 결정
- 사용자 customizable hooks (예: `.autoflow/project/hooks/*.sh`) — bash 그대로 유지 (사용자 친화)

## Allowed Paths

- .autoflow/scripts/
- runtime/board-scripts/
- apps/desktop/src/main.js (기존에 spawn 으로 호출하던 스크립트 → require 전환)
- packages/cli/ (선택적)
- 새로 추가될 공통 모듈 (예: `apps/desktop/src/main/board-state.js`)

## Done When

- [ ] Phase 1 분리 PRD 작성: 5개 무결성 스크립트가 .js 로 동작하고 기존 .sh 는 thin wrapper 또는 제거됨 (호환 유지)
- [ ] Phase 2 분리 PRD 작성: ticket lifecycle 4개 .js 화 + 단위 테스트 + smoke test 통과
- [ ] Phase 3 분리 PRD 작성: start-plan 마이그레이션 + 회귀 검증
- [ ] 마이그레이션된 스크립트는 desktop main process 에서 `require` 로 직접 호출 가능 (subprocess fork 옵션도 유지 — bash CLI 호환)
- [ ] runtime/board-scripts/ 와 .autoflow/scripts/ 의 동기화 mechanism 도 .js 기준으로 재정립 (autoflow upgrade 가 .js 파일 복사)
- [ ] 사용자 노출 CLI (`autoflow ...`) 인터페이스는 변경 없음 — 내부만 .js 로 교체

## Verification

- Command: ls .autoflow/scripts/*.js 2>/dev/null && find .autoflow/scripts -name "*.js" -exec node --check {} \;

## Notes

- 한 번에 다 안 옮긴다 — Phase 별로 PRD 분리해 안전하게 진행
- 기존 .sh 는 deprecation warning 추가 후 점진 제거 (외부 사용자가 직접 호출하던 경우 대비)
- 공통 유틸 라이브러리 우선 추출: `boardState.js` (state file read/write), `ticketMd.js` (ticket markdown parser), `runnerLog.js` (event log writer)
- 마이그레이션 시 정확성 검증: 같은 input 으로 .sh / .js 결과 비교 테스트

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
