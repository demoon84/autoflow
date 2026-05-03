# Autoflow Order

## Order

- ID: order_144
- Title: withScopeMemory IPC wrapper 가 selfHeal 자동 발동 — leak design root cause
- Status: archived-duplicate
- Priority: normal
- Created At: 2026-05-03T12:09:09Z
- Source: autoflow order create
- Archived At: 2026-05-03T12:15:21Z
- Duplicate Of: tickets/done/prd_151/tickets_150.md
- Related PRD: tickets/done/prd_151/prd_151.md

## Planner Note

- Planner runtime: `.autoflow/scripts/start-plan.sh` returned `status=ok`, `source=order-inbox`, `order_id=144`.
- Wiki context pass: `bin/autoflow wiki query --term "withScopeMemory selfHeal listRunners IPC" --rag`, `bin/autoflow wiki query --term "PRD_144 listRunners fork-bomb guard selfHeal cache" --rag`, and `bin/autoflow wiki query --term "runner health self-resurrect runners-project.sh list leak" --rag` all returned `result_count=0`; no direct wiki constraint was found.
- Relevant prior ticket: `tickets/done/prd_144/tickets_143.md` completed standalone `autoflow:listRunners` IPC inflight/TTL guard and child cleanup, but left the internal self-heal callsite as follow-up scope.
- Ticket finding: `tickets_150` (`prd_151`) already owns `apps/desktop/src/main.js` for the same design-level root cause: `rememberProjectScope`/`withScopeMemory` 반복 IPC가 self-heal을 호출하고 `selfHealStoppedRunnersForScope`가 runner list spawn 경로를 탈 수 있는 문제를 cache/inflight + cooldown으로 막는다. During this planner tick the worker finalized it to `tickets/done/prd_151/tickets_150.md`.
- Code evidence at archive time: `apps/desktop/src/main.js` already has `selfHealStoppedRunnersCooldownMs`, `lastSelfHealByScope`, `selfHealInFlightScopes`, `rememberProjectScope` first-registration/cooldown gating, and `selfHealStoppedRunnersForScope(scope)` calling `listRunnersCachedOrRefresh(scope)` instead of direct `listRunners(scope)`.
- Planner decision: this order is archived beside `prd_151` as duplicate/supplemental root-cause evidence. No new PRD or todo ticket is created because doing so would duplicate the active same-path work. If `tickets_150` later rejects on the same leak vector, reopen this archived note as reject context rather than creating a parallel `apps/desktop/src/main.js` ticket.
- Guard after archive: `bin/autoflow guard . .autoflow` returned `status=warning`, `error_count=0`, with cleanup candidate `autoflow/tickets_119 has a ticket worktree but no board ticket: /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_119`; planner did not delete or reset the worktree.

## Request


PRD_144 (listRunners IPC fork-bomb guard) 머지 후에도 leak 재발 (bash+awk 19 → 2418, 18분 만에). 더 정밀 검수로 정확한 root cause 확정 — order_143 보다 narrower fix 가능.

## Root Cause (apps/desktop/src/main.js)

### Layer 1 — withScopeMemory 가 모든 IPC 에 selfHeal 자동 발동
```js
// line 3030
function withScopeMemory(handler) {
  return (_event, options) => {
    rememberProjectScope(options);   // ← 매 IPC 마다 호출
    return handler(options || {});
  };
}

// line 379 / 390
function rememberProjectScope(options) {
  ...
  if (!runnerShutdownInProgress) {
    void selfHealStoppedRunnersForScope(scope);  // ← 매번 trigger
  }
}

// line 3234 / 3235
async function selfHealStoppedRunnersForScope(scope) {
  const result = await listRunners(scope);   // ← cache 우회 spawn
  ...
}
```

### Layer 2 — 적용된 IPC 15개 모두 selfHeal 발동
```
line 3392-3408
- autoflow:readBoard          (withTimeout + withScopeMemory)
- autoflow:installBoard
- autoflow:listRunners        (withTimeout + withScopeMemory)
- autoflow:controlRunner
- autoflow:runRole
- autoflow:configureRunner
- autoflow:createRunner
- autoflow:controlWiki
- autoflow:writeMetricsSnapshot
- autoflow:controlStopHook
- autoflow:controlWatcher
- autoflow:readBoardFile
- autoflow:deleteInboxOrderFile
- 등 15개
```

### Layer 3 — listRunners IPC 자체도 wrap → 1호출 = 2 spawn
`listRunnersStandalone` (line 3394) IPC 호출:
1. handler 실행: cached 가 있으면 cache hit (PRD_144 fix), 없으면 1 spawn
2. **그 전에** withScopeMemory → selfHeal → `listRunners()` 1 spawn (cache 우회)

= 1 IPC 호출이 최소 1, 최악 2 spawn 발생. UI 가 매 1초 readBoard polling 시 selfHeal 별도 spawn 누적.

### 정량
- selfHeal listRunners() 호출은 **1초당 1 spawn**, **18분 ≈ 1080 spawn** (이론). 실측 leak 1700+ 와 매칭.
- ulimit 4000 대비 위험.

## Suggested Fix

A) **withScopeMemory 에서 selfHeal 분리** — primary fix:
```js
function withScopeMemory(handler) {
  return (_event, options) => {
    rememberProjectScopeIdempotent(options);  // memo 등록만
    return handler(options || {});
  };
}

function rememberProjectScopeIdempotent(options) {
  // 첫 등록 1회만 self-heal trigger
  // 이후 IPC 는 자체 spawn 없음
}
```

B) **selfHeal 빈도 가드** — secondary:
```js
const lastSelfHealAt = new Map();
async function selfHealStoppedRunnersForScope(scope) {
  const key = scopeKey(scope);
  const now = Date.now();
  if ((now - (lastSelfHealAt.get(key) || 0)) < 30000) return;  // 30s cooldown
  lastSelfHealAt.set(key, now);
  const result = await listRunnersCachedOrRefresh(scope);  // cache 사용
  ...
}
```

C) **selfHeal 을 별도 timer 로 이동**:
- IPC 진입 시 trigger 가 아닌, `setInterval(selfHealAllScopes, 60_000)` 단일 timer 로 변경
- 60초마다 1번만 발동

권장: A + C. self-heal 의도(stopped runner 자동 재기동) 보존, IPC 와 분리.

## Allowed Paths

- apps/desktop/src/main.js (`withScopeMemory`, `rememberProjectScope`, `selfHealStoppedRunnersForScope`, IPC handler 등록부)

## Verification

```bash
# 1. UI polling 시뮬레이션
ps -ef | grep -c "runners-project.sh list" | tee before.txt
# 보드 화면 30초 사용
sleep 30
ps -ef | grep -c "runners-project.sh list" | tee after.txt
# diff < 5 이어야 함 (현재 PRD_144 후에도 30+ 가능)
```

## Notes

- order_143 (selfHeal cache 우회) 의 정확한 design-level root cause specification.
- PRD_135 (self-resurrect) 의 1원칙 의도는 보존하면서 호출 빈도/방식만 수정.
- 1원칙 = 자율 흐름. 자율 흐름이 호스트를 못 망가뜨림은 1원칙의 전제.
- `lastSelfHealAt` cooldown + cache 사용 두 방어선이 필요. order_143 은 cache 만 다뤘음.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `apps/desktop/src/main.js`

### Verification

- Command: ps -ef | grep -c 'runners-project.sh list'

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
