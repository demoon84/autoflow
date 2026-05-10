# Autoflow Order

## Order

- ID: order_230
- Title: Ticket ownership lock: stable runner-id + liveness hybrid
- Status: inbox
- Priority: high
- Created At: 2026-05-10T12:14:09Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: Ticket ownership lock 을 stable runner-id + liveness 기반 hybrid 로 전환
- Priority: high
- Status: ready
- Change Type: code


현재 `start-ticket-owner.sh` 가 ticket 의 `Result: pending ticket-owner by <UUID>` 라인에 PTY 세션마다 새로 생성된 thread UUID 를 써넣고, 다음 PTY 세션이 그 ticket 을 보면 "다른 owner 가 claim 중" 으로 거부함. PTY 가 재시작될 때마다 UUID 가 바뀌므로 **재시작 직후 모든 inprogress / 부분 claim ticket 이 영원히 stuck** 됨. 실제로 Todo-259 / Todo-263 / Todo-264 가 stale UUID 때문에 막혔던 사고 발생.

해결: ownership lock 을 **stable runner-id (worker / planner / wiki / worker-N) + liveness check** 의 hybrid 로 전환.

## 동작 명세

ownership 라인 포맷:
```
- Result: pending ticket-owner by <runner-id>:<runner-pid>:<spawned-at-iso>
```

claim 검사 흐름 (`start-ticket-owner.sh` / Phase 2 마이그레이션 후 `start-ticket-owner.js`):
1. ticket 의 ownership 라인 파싱
2. **case A — 비어있음**: 즉시 claim 가능
3. **case B — runner-id 가 본인과 동일**:
    - 같은 runner-id 가 다시 claim → takeover 허용 (PTY 재시작 정상 케이스)
    - log: `event=ticket_claim_takeover_same_runner`
4. **case C — runner-id 가 다른 runner**:
    - 4-1. 그 runner 의 state 파일 (`runners/state/<runner>.state`) 의 `pid` 가 살아있는지 `kill -0 <pid>` 로 확인
    - 4-2. 살아있으면: 진짜 다른 runner 가 작업 중 → claim 거부 (status=ticket_claimed_by_another_owner)
    - 4-3. 죽었으면: stale lock → 경고 로그 후 takeover 허용 (`event=ticket_claim_takeover_dead_owner`)
5. **case D — 같은 runner-id 인데 PID 불일치 (PTY 재시작)**:
    - 이전 PID 죽었는지 확인 → 죽었으면 takeover (정상 PTY 재시작 패턴)
    - 살아있으면 (=동시 두 인스턴스 = 사고) claim 거부

## Allowed Paths

- .autoflow/scripts/start-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/scripts/runner-common.sh
- runtime/board-scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh
- runtime/board-scripts/runner-common.sh
- (Phase 2 이후) .autoflow/scripts/start-ticket-owner.js / runner-claim.js

## Done When

- [ ] ticket ownership 라인 포맷이 `<runner-id>:<runner-pid>:<spawned-at-iso>` 형태로 변경됨 (legacy UUID 라인은 1회 호환 파싱 후 takeover)
- [ ] `start-ticket-owner.sh` 의 claim 단계가 위 case A-D 흐름 구현
- [ ] `kill -0 <pid>` liveness check 가 0 exit / 1 exit 으로 alive/dead 판정
- [ ] 같은 runner-id 가 PID 다른 채로 다시 claim 시 takeover 동작 (PTY 재시작 시나리오)
- [ ] 다른 runner-id 가 alive PID 를 가지고 있을 때만 claim 거부
- [ ] `finish-ticket-owner.sh pass` / `fail` 시 ownership 라인 정리 (다음 worker 가 claim 가능 상태로)
- [ ] 자동화된 takeover 가 발생하면 ticket `Notes` 에 1줄 audit 추가 (`stale lock takeover by <new-runner>:<new-pid> at <iso>`)
- [ ] 기존 stale UUID 가 박힌 ticket 들이 다음 tick 에서 자연 takeover 되어 stuck 해소
- [ ] runtime/board-scripts/ 미러도 같은 변경 적용 (autoflow upgrade 호환)

## Verification

- Command: rg -n "ticket-owner by|runner-id.*pid.*spawned|kill -0|takeover" .autoflow/scripts/start-ticket-owner.sh

## Notes

- single-worker 환경 (현재 default) 에선 stable runner-id 만으로도 충분하지만, multi-worker 또는 같은 runner-id 의 다른 인스턴스 동시 실행 사고를 방지하려면 liveness check 가 필요. 두 가지 합친 hybrid 가 가장 견고.
- 마이그레이션 시 기존 ticket 들의 legacy UUID 라인은 한 번만 호환 파싱 후 takeover (UUID 가 자체 PID 와 매핑 안 되므로 무조건 stale 로 처리).
- order_228 (runner-stage.js 실구현) 의 `inprogress` 단계 보고와 호환 — runner-stage.js 가 active_ticket_id / pid 를 state 에 박으면 이 ownership lock 도 같은 신호 사용.
- Phase 2 .js 마이그레이션 (`start-ticket-owner.js`) 작업과 자연스럽게 함께 진행 가능.

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
