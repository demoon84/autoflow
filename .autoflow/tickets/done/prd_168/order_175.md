---
title: blocked-dirty orchestration 무한 루프 — 항상 변하는 파일 (telemetry/wiki/check) 가 dirty_root 자동 회복 종료를 막음
priority: low
created_at: 2026-05-05T01:01Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #26
related: [Todo-166, prd_167, order_149, prd_168, Todo-167]
status_update_2026-05-05T01:27Z: |
  Tick #38 검증 결과, 본 issue 의 fix 가 이미 in-progress:
  - **prd_168 "planner check ledger live-lock fix"** (priority high) 가 backlog 에 있음
  - **Todo-167** 이 worker 에 의해 방금 claim 됨 (Stage: executing, 01:27:09Z)
  - prd_168 의 fix 가 본 order 의 Phase D (retry cap) + Phase A (whitelist 부분) 와 정합:
    - "no-op cleanup detection" — check_NNN.md 단독 dirty 면 새 cleanup 안 함
    - "fixpoint guard" — 누적 cleanup 임계 (예: 5건) 초과 시 needs_user 자동 escalate
    - "source separation" — `source=blocked-cleanup-no-op` emit
  - **Todo-166 도 자동으로 Recovery State: needs_user 로 전환됨** (fixpoint guard 또는 유사 로직 동작 증거)
  - **원본 detect: order_149** (이미 in inbox/done) — 본 order 는 사실상 그 issue 의 재발견
  → priority high → low 강등. 별도 조치 불필요. Todo-167 완료 후 본 order 자동 close 가능.
---

## Request

`tickets/inprogress/Todo-166.md` (Stage: blocked, Failure Class: dirty_root) 가 1시간 넘게 inprogress 에 머물면서 14건의 orchestration cleanup commit 을 만들었지만 여전히 blocked 상태. 원인은 자동 회복 cycle 이 dirty_root 를 정리할 때마다 같은 tick 또는 다음 tick 에서 **항상 background 로 변하는 파일들** (`.autoflow/telemetry/runs.jsonl`, `.autoflow/tickets/check/check_*.md`, ticket 자기 자신, wiki 파일들) 이 다시 dirty 로 잡혀서 회복을 끝내지 못함. 자동 정리 자체는 정상이나 종료 조건이 안 맞아 무한 루프.

## 검출 evidence

### Tick #26 측정 (01:01:13Z)
- worker active_ticket_id=Todo-166, active_stage=blocked, recovery_status=repairing
- 1시간 round 동안 worker.started_at=2026-05-05T00:25:19Z 부터 계속 같은 ticket
- inprogress 에 Todo-166.md + verify_166.md (placeholder) 만 남음

### Recovery State 본문 발췌
```
- Status: repairing
- Detected By: runtime
- Failure Class: dirty_root
- Evidence: `start-plan.sh` emitted `source=blocked-dirty-orchestration` again for
  `tickets/inprogress/Todo-166.md` with dirty paths
  `.autoflow/telemetry/runs.jsonl`,
  `.autoflow/tickets/inprogress/Todo-166.md`,
  and `.autoflow/tickets/check/check_195.md`;
  `git status --short` also showed concurrent board/wiki/runtime artifacts already dirty
  in PROJECT_ROOT. Planner integrated them in cleanup commits
  `d9715f6`, `834261a`, and `dca5c27`.
```

### Orchestration commit 빈도 (1시간 round)
```
14건 — [Todo-166] / [PRD_167][Todo-166] orchestration cleanup: ...
```

### dirty 패턴
| Tick | dirty 수 | cleanup commit 발생 |
|---|---|---|
| #22 (00:48) | 55 | (직전 4건) |
| #23 (00:51) | 4 | +4건 (wiki sync) |
| #24 (00:54) | 3 | +3건 |
| #25 (00:58) | 2 | +1건 |
| #26 (01:01) | 2 | +2건 (telemetry/recovery guard) |

→ dirty 가 떨어졌다가 다시 새 파일이 dirty 로 들어옴. 끝나지 않음.

## 원인 분석

**dirty_root 검사 대상에 background 자동 변경 파일이 포함됨:**
1. `.autoflow/telemetry/runs.jsonl` — adapter 호출 시마다 append. 60s 마다 worker/wiki/verifier/planner 가 row 추가.
2. `.autoflow/tickets/check/check_*.md` — auto-recovery 가 자체 check 파일 생성.
3. `.autoflow/tickets/inprogress/Todo-166.md` 자기 자신 — Recovery State 가 갱신될 때마다 dirty.
4. `.autoflow/wiki/...` — wiki tick 이 적극적으로 갱신 (wiki commits 가 별도로 발생하나 동시에 dirty 로 잡힘).

→ 이 파일들은 "Todo-166 의 작업으로 인한 dirty" 가 아니라 **시스템 background 활동의 자연스러운 dirty**. blocked-dirty 회복이 정리해야 할 대상이 아님.

## 영향

1. **worker stuck 효과** — 같은 ticket 1시간+ 못 빠져나옴. todo backlog (15건) 처리 지연.
2. **commit 폭증** — 1시간에 14건 의 의미 적은 cleanup commit. 정상 시 1~2건.
3. **자율 흐름 정체** — 1원칙 (멈추지 않음) 은 살아있지만 한 ticket 의 무한 cycle 로 throughput 저하.
4. **로그/git 노이즈** — `[PRD_167][Todo-166] orchestration cleanup: ...` repetitive commit.

## Suggested Fix

### Phase A — dirty_root 검사 whitelist (가장 효과적)
- `start-plan.sh` 의 dirty_paths 검사 시 다음 경로는 제외:
  ```bash
  # 항상 변하는 background 파일들
  EXCLUDE_PATTERNS=(
    ".autoflow/telemetry/runs.jsonl"
    ".autoflow/telemetry/runs.jsonl.before-reset.*"
    ".autoflow/tickets/check/check_*.md"
    ".autoflow/runners/state/*"
    ".autoflow/runners/logs/*"
    ".autoflow/metrics/daily.jsonl"
    ".autoflow/wiki/index.md"
    ".autoflow/wiki/log.md"
  )
  # 자기 자신 (해당 ticket 파일) 도 제외
  EXCLUDE_PATTERNS+=(".autoflow/tickets/inprogress/${ticket_id}.md")
  ```
- 이 paths 는 dirty 로 잡히지 않으므로 회복 cycle 이 정상 종료.

### Phase B — dirty 가 ticket 의 Allowed Paths 범위 안인지 검사
- ticket 의 `Allowed Paths` 에 명시된 경로의 dirty 만 회복 대상으로.
- background 파일은 별도 wiki/telemetry 정리 흐름에서 처리 (이미 wiki commit 으로 처리됨).

### Phase C — Recovery State 갱신을 commit 안 함
- ticket 자기 자신의 modify 는 stage 만 하고 commit 안 함.
- 다음 cleanup cycle 에서 종합 commit 으로 처리.

### Phase D — 회복 시도 횟수 cap
- N (예: 5) 회 이상 repairing cycle 후에도 dirty 안 떨어지면 `Recovery State: needs_user` 로 전환.
- 무한 루프 방지의 마지막 안전망.

### Phase E — backoff 적용
- 같은 ticket 의 blocked-dirty 회복 시도가 N분 안에 M회 반복되면 cooldown.
- worker 가 다른 todo 로 임시 이동해 backlog 처리.

## Allowed Paths

- `packages/cli/start-plan.sh` (dirty_paths 검사 + whitelist)
- `packages/cli/run-role.sh` (cleanup commit 결정 시 ticket 자기 자신 제외)
- `packages/cli/runners-project.sh` (recovery cycle 카운터 + needs_user 전환)
- `.autoflow/policies/budget.toml` 또는 별도 policy 파일 (whitelist 정책)

## Verification

- Phase A 적용 후: 같은 dirty_root 케이스에서 cleanup commit 빈도 ≤ 2건/시간 (vs 현재 14건).
- Phase B 적용 후: ticket의 Allowed Paths 밖 dirty 무시.
- Phase D 적용 후: 회복 5회 후 needs_user 전환 + 사용자 알림.
- 회귀: 진짜 dirty (사용자 작업으로 인한 코드 변경) 는 정상 회복.
- 단위 테스트: 가짜 telemetry append + check file 생성으로 background dirty 시뮬레이션.

## Notes

- **연관:**
  - **prd_167** — Todo-166 의 source PRD. 본 order 가 그 ticket 회복 무한 루프 원인 분석.
  - **CLAUDE.md / AGENTS.md 5a** — blocked-dirty orchestration 정책 정의. 본 order 가 그 정책의 retry 종료 조건 부재 지적.
  - **prd_181 / Todo-180** (방금 완료된 telemetry sanity correction) — telemetry 가 정상 동작하면서도 background row 가 dirty 로 잡히는 케이스 확인.
- **위험:**
  - whitelist 너무 넓으면 진짜 dirty 가 무시될 수 있음. telemetry/check/state 만 좁게 적용.
  - retry cap 너무 낮으면 정상 다단계 회복도 못 끝낼 수 있음. cap=5 or 환경변수.
- **1원칙 정합:**
  - 본 fix 가 자율 흐름을 더 빠르게 함 (한 ticket 의 무한 루프 → 다음 todo 로 진행).
  - cap 도달 시 needs_user 도 1원칙 위반 아님 (다른 runner 는 계속 동작).
- **추가 검토:**
  - check/check_NNN.md 생성 자체를 best-effort 로 줄이거나 별도 디렉토리 (`.autoflow/.runtime/`) 로 이동해 git 추적 제외 가능.
  - Todo-166 같은 케이스를 manual unblock 하는 방법: 워크트리 정리 + ticket 을 done 또는 reject 로 강제 이동.

## Planner Resolution

- Resolved At: 2026-05-05T12:45:36Z
- Decision: duplicate_resolved_by_existing_work
- Evidence: `start-plan.sh` selected this order as `source=order-inbox`, but direct board evidence shows `tickets/done/prd_168/Todo-167.md` completed the planner check ledger live-lock fix and `tickets/done/prd_168/verify_167.md` passed the declared smoke verification plus `npm run desktop:check`. Required wiki RAG queries for `blocked-dirty orchestration telemetry check dirty_root Todo-166` and `planner check ledger live-lock no-op cleanup fixpoint guard prd_168` returned `result_count=0`; direct ticket/wiki grep found `prd_168` and `Todo-167` as the completed matching fix.
- Planner Decision: do not create a duplicate generated PRD or todo ticket. Archive this order under `tickets/done/prd_168/` as follow-up evidence for the already completed fix.
- Next Action: no new work for this order; worker may continue with the next eligible todo.
