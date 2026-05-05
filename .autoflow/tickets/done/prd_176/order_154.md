# Autoflow Order

## Order

- ID: order_154
- Title: 🗺️ Autoflow 1원칙 자율회복 + commit 폭증 + 호스트 안정성 종합 fix 로드맵 (10시간 모니터링 결과)
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T04:56:03Z
- Source: autoflow order create

## Request


10시간+ 모니터링(6h+4h)으로 파악한 **Autoflow 1원칙 자율 회복 + commit 폭증 + 호스트 안정성** 종합 fix 로드맵. 이미 발행된 individual order(order_148~152, order_144 등)를 우선순위로 묶고, 추가 보강 항목과 함께 변경해야 할 내용을 한 곳에 정리.

## 발견 카테고리 종합

### A. 1원칙 자율 회복 깨짐 (가장 시급)
| 우선 | 항목 | 증상 | 관련 order |
|---|---|---|---|
| **A1** | **worker self-refresh dirty deadlock** | ticket Allowed Paths 가 자기 자신 ticket md 포함 → worker tick 마다 Stage 갱신 → modified → wait 무한 | order_151 |
| **A2** | needs_user / repairing 인 ticket 이 inprogress 무한 잔류 | tickets_157(ANTHROPIC_API_KEY), 162(cleanup loop) 가 9시간+ 잔류 | order_150 |
| **A3** | check ledger 자기참조 live-lock | cleanup commit 마다 새 check_NNN 생성 → 다음 tick dirty → 또 cleanup. 80초당 1건 누적 | order_149 |
| **A4** | worker.state.last_result 자가 reset 부재 | stage_blocked set 후 영원히 stuck | order_148 |
| **A5** | withScopeMemory IPC wrapper 가 selfHeal 자동 발동 | 15개 IPC 모두 selfHeal trigger → cache 우회 spawn 누적 | order_144 |

### B. commit 폭증 / token 낭비
| 우선 | 항목 | 증상 | 관련 order |
|---|---|---|---|
| **B1** | commit granularity 너무 미세 | 1줄 telemetry append 마다 1 commit (분당 0.75건) | order_152 |
| **B2** | Wiki debounce 무력화 | runner-timing/health 매 tick 갱신 → changes>=3 항상 만족 | order_152 |
| **B3** | adapter SIGTERM + output_truncated 패턴 | 매 tick `Terminated: 15` + `output_truncated=true` → token 손실 | order_152 |

### C. 호스트 안정성 (이미 머지된 fixes)
- ✅ PRD_140 IPC readBoard fallback (order_132)
- ✅ PRD_141 doctor/metrics NOWAIT (order_133)
- ✅ PRD_142 process leak guard (order_134)
- ✅ PRD_144 listRunners inflight (order_136)
- ✅ PRD_151 selfHeal cooldown (order_143)

### D. 보드 정합성 (이미 머지)
- ✅ PRD_127~135: duration_ms / role guard / state stale / topology / retention / metrics / self-resurrect
- ✅ PRD_161 quote shadow (order_145)

## Suggested 처리 순서

### Phase 1 (즉시) — 자율 회복 unstuck
1. **order_151** (A1) — worker self-refresh deadlock fix. 가장 큰 영향. ticket meta 갱신 (Stage/Last Updated) 을 dirty check 에서 제외
2. **order_148** (A4) — worker.state.last_result 자가 reset (planner cleanup 후 또는 dirty=clean 시)
3. **order_150** (A2) — needs_user / repairing inprogress 분리 (별도 폴더 또는 reject 이동)

### Phase 2 (다음) — 부수 amplifier 차단
4. **order_149** (A3) — check ledger 를 cleanup commit 외부로 분리 (별도 jsonl 또는 비-tracked path)
5. **order_152** (B1+B2+B3) — commit batch + wiki debounce 강화 + adapter watchdog 검수
6. **order_144** (A5) — withScopeMemory selfHeal trigger 제거 또는 cooldown

## 추가 보강 (이번 정리에서 발견)

### E. process leak 잔재
- **PID 65987 zombie** 같은 worktree-bound runner 가 worktree 정리 후에도 살아남는 패턴
- worktree cleanup 시 그 worktree 안의 runner process kill 보강 (order_151 의 sub-fix)

### F. monitor noise 보강
- `STATE_VIOLATION` 알림이 같은 last_result 인데 다른 sub-field 변경에 매 tick emit
- monitor 자체에 dedup (같은 problem 5분 내 1회) 적용 권장

## Verification (전체 phase 완료 후)

```bash
# 1. 자율 회복
ls .autoflow/tickets/inprogress/ | grep -v gitkeep | wc -l   # < 2
grep '^last_result=' .autoflow/runners/state/worker.state    # ticket_stage_blocked 30분+ 지속 안 함

# 2. commit volume
git log --since="1 hour ago" --oneline | wc -l              # < 15
git log --since="1 hour ago" --oneline | grep -c '\[wiki\]' # < 3

# 3. 호스트 안정성
ps -ef | grep -E 'bash|awk' | grep -v grep | wc -l          # < 100

# 4. ticket 진보
done count 가 30분당 +1 이상 증가
```

## Notes

- 이미 ✅ 머지된 13건의 order 와 함께 본 종합 specification 은 Autoflow 1원칙 ("멈추지 않음") 의 진짜 구현체.
- "멈추지 않음" 은 "바쁘게 멈춰있음(live-lock)" 도 아니어야 한다. 본 fix 는 자율 진보 보장에 초점.
- token 비용 측면: 분당 0.75 commit × planner/wiki/verifier adapter 호출 = 시간당 ~30 호출. Phase 2 가 먼저 해소되면 비용 50%+ 감소 기대.
- 6시간+4시간 monitor 의 가장 종합적 정리. individual order 가 분산 처리되더라도 본 master 가 progress 추적에 사용 가능.

## Allowed Paths

- packages/cli/run-role.sh
- packages/cli/start-plan.sh
- packages/cli/wiki-project.sh
- packages/cli/runners-project.sh
- apps/desktop/src/main.js
- 또는 .autoflow/scripts/common.sh

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/start-plan.sh`
- `packages/cli/wiki-project.sh`
- `packages/cli/runners-project.sh`
- `apps/desktop/src/main.js`

### Verification

- Command: ls .autoflow/tickets/inprogress/ | grep -v gitkeep | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
