# Autoflow Order

## Order

- ID: order_233
- Title: PTY 안정화 잔여 — Phase 2/3 + 검증 + 후속 정리
- Status: inbox
- Priority: high
- Created At: 2026-05-10T14:06:48Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: PTY 모드 안정화 잔여 작업 — Phase 2/3 마이그레이션 + 검증 + 후속 정리
- Priority: high
- Status: ready
- Change Type: code


PTY 모드 전환 + 능동 보고 도구 (runner-stage / runner-wake / runner-tokens) + Phase 1 .ts 마이그레이션 + planner janitor + stable runner-id env injection 까지 적용된 상태에서 남은 작업을 한 번에 정리. 각 항목은 독립 PRD 로 split 권장.

## 잔여 작업 인벤토리

### Phase 2 — Ticket lifecycle 본 마이그레이션 (큰 작업, 분할 PRD)

기존 `Todo-259 / order_259_retry_1` 와 합치는 본격 작업. 회귀 위험 크므로 각 스크립트가 단일 PRD.

- **PRD-A**: `start-ticket-owner.sh` (738줄) → `start-ticket-owner.ts` + `runner-common` 의존 부분 `board-utils.ts` 로 추출. claim 동시성 + lint dispatch + recovery state 분기 + worktree 생성 로직 정합성 검증.
- **PRD-B**: `finish-ticket-owner.sh` (973줄) → `finish-ticket-owner.ts`. **shell sanity gate (zero-diff + Done When 전체 [x] + worktree clean) 동작 정확성이 가장 중요**. 거짓 pass 차단 로직.
- **PRD-C**: `merge-ready-ticket.sh` (855줄) → `merge-ready-ticket.ts`. finish 의 inline finalizer. needs_ai_merge 분기 보존.
- **PRD-D**: `handoff-todo.sh` (130줄) — legacy role-pipeline 호환. 우선순위 낮음, skip 가능.

### Phase 3 — Planner state machine

- **PRD-E**: `start-plan.sh` 본문 (현재 `.legacy.sh` 에 있음, 1050줄) → `start-plan.ts` 로 옮기고 wrapper 제거. inbox order / backlog PRD claim, todo 생성, planner state machine (idle / planning / done / blocked), reject 자동 재계획.

### Ownership lock 완성

- **PRD-F**: Todo-265 의 미진행분 — `start-ticket-owner.sh` 의 `ticket_owned_by_worker` / `ticket_claimed_by_other_worker` 함수에 liveness check 추가. 기존 PTY env injection (stable runner-id) + 추가로 다른 runner-id 의 PID 가 죽었으면 stale 처리해 takeover 허용.

### Active ticket 마무리

- **PRD-G**: Todo-264 의 worker 가 멈춘 상태 (worktree 에 ~103줄 미커밋). slider 라벨 정비 작업. 다음 worker 가 resume → verify → merge → done 까지 자연 완료.

### 새 환경 검증 (mechanical, 짧음)

- **PRD-H**: 다음 항목 동작 검증 후 evidence 파일 추가 — agent.md 의 close-out + active reporting 지시대로 LLM 이 실제로 호출하는지, fs.watch wake 가 runner-wake 큐로 흐르는지, runner-tokens 보고가 cumulative 누적되는지, planner-janitor 가 매 tick 동작하는지.

### 후속 정리 (낮은 우선순위)

- **PRD-I**: `runner-stage.js` → `runner-stage.ts` (worker 가 만든 .js 본문을 .ts 로 일관화).
- **PRD-J**: `start-plan.js` 의 wrapper 부분 (PRD-E 가 끝나면 자연 정리).
- **PRD-K**: `board-utils.ts` 의 추가 helper (Phase 2 변환 시 필요한 30+ 함수 — `recovery_state_*`, `retry_fingerprint_*`, `sanity_gate_*`, `extract_section_block` 등).
- **PRD-L**: order_222 잔여 — session log token watcher fallback (claude/codex/gemini 세션 jsonl 파싱). `runner-tokens.ts` push 가 primary 라 LLM 이 보고 안 한 경우 보강.

## Allowed Paths

- .autoflow/scripts/
- runtime/board-scripts/
- .autoflow/agents/
- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] PRD A/B/C 모두 worker 처리 후 .ts 진본 + tsx wrapper 동작
- [ ] sanity gate 보존 검증: zero-diff / Done When [ ] 잔존 ticket 으로 finish-ticket-owner.ts pass 호출 시 차단
- [ ] PRD-D (handoff-todo) 는 우선순위 낮음으로 skip 가능 — 별도 PRD 분리 후 closed-without-action OK
- [ ] PRD-E start-plan.ts 변환 완료, .legacy.sh 제거
- [ ] PRD-F ownership liveness check 추가, 다른 runner-id 의 dead PID 잡고 takeover 가능
- [ ] PRD-G Todo-264 정상 완료 (master 머지 + done 이동)
- [ ] PRD-H 검증 evidence 파일이 `.autoflow/wiki/operations/pty-mode-verification.md` 같은 위치에 추가
- [ ] PRD-I runner-stage.ts 변환
- [ ] PRD-K board-utils.ts 확장 (Phase 2 진행 시 자연 처리)
- [ ] (선택) PRD-L session log fallback 구현

## Verification

- Command: rg -n "\.ts$|\.js$" .autoflow/scripts/ | sort | head -20

## Notes

- 각 PRD 는 독립 worker cycle 로 처리되어야 안전. 단일 worker 가 여러 lifecycle 스크립트를 동시에 옮기면 conflict + 회귀 위험 큼.
- 직전까지 완료된 항목 (참고): runner-stage.js 통합, runner-wake.ts, runner-tokens.ts, planner-janitor.ts, board-utils.ts, lint-ticket.ts, state-db.ts, integrate-worktree.ts, board-guard.ts, path-conflict-check.ts, stable runner-id PTY env injection, atomic-rule prompt 강화, agent.md close-out / active reporting 지시 추가.
- legacy 호환성: `runtime/board-scripts/` 미러도 같이 갱신 (autoflow upgrade 가 새 .ts 파일을 외부 프로젝트로 복사). tsx 의존성도 `autoflow init` 단계에서 설치 안내.
- 우선순위: PRD-G (Todo-264 finish) → PRD-H (검증) → PRD-A/B/C (Phase 2) → PRD-E (Phase 3) → PRD-F (ownership) → PRD-I/K/L (cleanup).

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
