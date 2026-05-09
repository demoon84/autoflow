# Autoflow Order

## Order

- Title: worker '완료' 스텝이 idle 사이 tick 에 오래 머무는 UX 버그 수정
- Priority: normal
- Status: ready
- Change Type: code

## Request

worker가 정상종료(adapter_exit_0) 후 다음 tick까지 오래 '완료' 스텝이 유지돼 오류처럼 보임. 실제 작업이 끝났고 idle 대기 중일 때는 '대기'로 표시돼야 함

## Context

`apps/desktop/src/renderer/main.tsx` 의 `runnerStageKey()` ticket-owner 분기에서
다음 패턴이 stateText 에 보이면 "완료" 로 매핑된다 (PRD 25 원형):

```
/\bcommitted_via_inline_merge\b|event=adapter_finish.*status=ok/
```

문제: `event=adapter_finish status=ok` 는 **모든 successful adapter tick** 에 남는
범용 신호다. 즉:

1. 워커가 실제 ticket 을 끝낸 tick → `committed_via_inline_merge` 도 함께 남음. "완료" OK.
2. 워커가 idle prompt 만 받고 0 으로 빠진 tick → `event=adapter_finish status=ok` 만 남음. **"완료" 로 잘못 매핑.**

realtime 모드에서 `interval_seconds` 가 1800s (30 min safety heartbeat) 일 때
2번 케이스의 `lastLogLine` 이 30 분간 그대로 남아 화면이 30 분간 "완료" 로
정지된 것처럼 보임 → 사용자는 오류로 착각.

기대 동작:

- `committed_via_inline_merge` 가 있을 때만 "완료"
- `event=adapter_finish status=ok` 는 단독으로 "완료" 신호로 안 씀 (idle 와 구분 안 됨)
- 마지막 tick 이 idle (`!hasActiveTicket` && no merge signal) 이면 "대기"

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `event=adapter_finish.*status=ok` 단독 매칭으로 "완료"가 반환되지 않는다 (`committed_via_inline_merge` 가 함께 있어야만 done)
- [ ] worker 가 idle tick (last_result=adapter_exit_0, no active ticket, no inline merge) 일 때 슬라이더가 "대기" 스텝으로 표시된다
- [ ] 워커가 실제 ticket 을 끝낸 직후 (commit 직후) 에는 여전히 "완료" 로 표시된다 (`committed_via_inline_merge` 신호 보존)
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx` `runnerStageKey()` ticket-owner 분기
  (현재 line ~6978).
- 가장 좁은 변경: regex 에서 `|event=adapter_finish.*status=ok` 를 제거.
  `committed_via_inline_merge` 만 done 신호로 둠. 다른 곳에서 같은 정규식을
  쓰는지 grep 해서 영향 범위 확인.
- 비슷한 과거 작업: prd_025 (worker 4-stage 단순화), prd_014 (planner 분기
  안정화). 본 PRD 는 prd_025 의 done 검사 휴리스틱을 좀 더 엄격하게 좁히는
  follow-up.
- 회귀 가드:
  - merge 직후 `committed_via_inline_merge` 케이스는 그대로 "완료"
  - `ticket_inputs_unchanged` / `no_todo_available` 는 `hasWorkerIdleSignal`
    가드로 이미 "대기" 처리됨 (영향 없음)
  - `isFailLike` (adapter_exit_[1-9]) 는 그대로 "반려"
