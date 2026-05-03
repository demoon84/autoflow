# Autoflow Order

## Order

- ID: order_143
- Title: selfHeal listRunners cache 우회 — PRD_144 잔여 leak vector
- Status: inbox
- Created At: 2026-05-03T11:39:40Z
- Source: autoflow order create

## Request

## Request

PRD_144 가 listRunners IPC handler (`listRunnersStandalone`) 의 fork-bomb 을 막았지만, **internal callsite** `selfHealStoppedRunnersForScope` 가 cache 우회로 `listRunners()` 를 직접 호출해 leak 재발 경로가 남아있다.

## 근거 (코드 검수)

`apps/desktop/src/main.js`:

```
line 390: rememberProjectScope() →
  void selfHealStoppedRunnersForScope(scope)
line 3235: selfHealStoppedRunnersForScope():
  const result = await listRunners(scope)   ← cache 우회 직접 호출
line 2440: listRunners():
  await runAutoflowArgs(["runners", "list", ...])  ← bash spawn
```

`rememberProjectScope` 는 거의 모든 IPC handler 가 호출 (readBoard, listRunners 등). UI 가 보드 화면에서 빈번히 IPC 를 fire 하면:

```
readBoard tick 1 → rememberProjectScope → selfHeal → listRunners spawn 1
readBoard tick 2 → rememberProjectScope → selfHeal → listRunners spawn 2
...
```

각 spawn 은 평균 1~2초 걸리는데 30s timeout 안에 누적 가능. PRD_144 의 inflight guard (`listRunnersStandalone`) 는 이 internal path 를 보지 못함.

증상 패턴: bash+awk 가 정상 → 갑자기 폭증 (사용자가 desktop UI 활동) → 다시 정상 (UI idle).

## Suggested Fix

A) **selfHeal 도 cache 사용**:
```js
// line 3235
const result = await listRunnersCachedOrRefresh(scope);
// 또는
const result = await listRunnersStandalone(scope);
```
이미 PRD_144 가 만든 캐시 layer 를 그대로 사용. self-heal 은 stopped 여부만 보면 되니 stale cache 로 충분.

B) **selfHeal 자체에 cooldown**:
- `lastSelfHealAt` Map 으로 (projectRoot+boardDirName) 별 최근 실행 시각 추적
- 30초 이내 재호출은 skip

C) **rememberProjectScope 에서 self-heal 빈도 제한**:
- 첫 등록 (`!knownProjectScopes.has(key)`) 일 때만 self-heal 트리거
- 이후 IPC 호출에서는 별도 timer (예: 60초) 로만 self-heal

권장: A + C. self-heal 의도(stopped runner 자동 재기동) 보존하면서 spawn 빈도 차단.

## Allowed Paths

- apps/desktop/src/main.js (`selfHealStoppedRunnersForScope`, `rememberProjectScope`)

## Verification

```bash
# 1. desktop 켠 상태에서 보드 화면 30초 활성 사용
# 2. bash+awk 누적 측정
ps -ef | grep -c "runners-project.sh list"
# < 5 이어야 함 (현재 PRD_144 후에도 UI 활동 시 누적 가능)

# 3. 실제 leak loop 재현
for i in {1..10}; do
  curl -X POST <electron IPC> -d '{"method":"autoflow:readBoard"}'
done
# spawn 수가 10이 되지 않고 < 3 이어야 함 (cache hit)
```

## Notes

- PRD_144 이후의 follow-up. fork-bomb root cause 의 두 번째 잠재 경로.
- 사용자가 leak 재발 의심한 직접 사례 (대화 내 보고). 검수로 확인된 잔여 vector.
- 1원칙(자율 흐름) 보존 위해 self-heal 자체는 유지, 다만 호출 빈도/방식 가드.

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
