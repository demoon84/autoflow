---
id: memo_071
title: 진행 카드 토큰 사용량 전체 노출 + 아이콘 세로 가운데 정렬
status: inbox
created: 2026-05-01
---

## Request

토큰 사용량 말줄없이 모두 나와야 함

(추가 사용자 메시지) 해당줄 왼쪽 아이콘 과 미들 정렬 필요

(첨부 스크린샷: 진행 카드 헤더. 카드별로:
- `오케스트레이터  791,389 토큰 ...` (말줄임됨)
- `Worker  742,760 토큰 사용` (정상)
- `위키봇  418,813 ...` (심하게 잘림)

토큰 사용량 텍스트가 카드 폭에 따라 말줄임표(`…`) 로 잘리고 있음. 사용자는 토큰 사용량을 잘림 없이 전부 보이길 원함. 추가로, 같은 줄의 왼쪽 에이전트 아이콘이 텍스트와 세로 가운데(middle) 로 정렬되길 원함.)

## Notes

- 토큰 잘림 원인: `apps/desktop/src/renderer/styles.css:3560-3575`
  ```css
  .ai-progress-agent span.ai-progress-token-usage {
    display: inline-block;
    flex: 1 2 auto;
    min-width: 0;
    max-width: min(180px, 44%);   /* ← 폭을 강제로 제한 */
    overflow: hidden;
    text-overflow: ellipsis;       /* ← 잘림 */
    white-space: nowrap;
    word-break: keep-all;
  }
  .ai-progress-row-worker .ai-progress-agent span.ai-progress-token-usage {
    flex: 1 1 auto;
    max-width: min(220px, 52%);    /* ← 워커 카드도 잘림 가능 */
  }
  ```
  → `max-width` 와 `text-overflow: ellipsis` 가 합쳐져 좁은 카드에서 텍스트를 잘라 냄.
- 추가로 `apps/desktop/src/renderer/styles.css:3527-3534` 의 광역 셀렉터:
  ```css
  .ai-progress-agent strong,
  .ai-progress-agent p,
  .ai-progress-agent span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  ```
  → `span` 에 일괄 적용된 ellipsis 도 잘림에 기여. `.ai-progress-token-usage` 에서 override 하더라도 광역 셀렉터의 `overflow: hidden` 이 살아 있음.
- 의도된 동작:
  - 토큰 사용량 텍스트가 자연 폭으로 전부 표시 (예: `742,760 토큰 사용`).
  - 카드 폭이 부족해 정말 못 들어가면 줄바꿈 또는 카드 폭 자체가 늘어나는 쪽이 자연스러움. 사용자는 "전부 보여 달라" 가 명시이므로 ellipsis 는 제거하고 nowrap 도 풀어 줄바꿈을 허용하거나, 카드 폭 minimum 을 늘리는 방향. Plan AI 가 결정.
  - 좁은 폭 회귀 방지를 위해 직전 오더 `memo_054` 의 윈도우 minWidth 1200 보장이 함께 전제됨.
- 아이콘 정렬:
  - JSX: `apps/desktop/src/renderer/main.tsx:5436-5444` 의 `.ai-progress-agent-title` 안에 `<AgentAppIcon /> + <strong>{agentTitle}</strong> + <span class="ai-progress-token-usage">...`.
  - CSS: `apps/desktop/src/renderer/styles.css:3464-3470` 의 `.ai-progress-agent-title { display: flex; align-items: center; ... }` → 이미 center 인데도 시각적으로 어긋나 보일 수 있음. 원인 후보:
    1. `<strong>` 의 `line-height: 1.1` 와 토큰 `<span>` 의 line-height 차이로 baseline 어긋남.
    2. 아이콘 박스(24×24) 와 텍스트 라인 박스의 inline-grid `place-items: center` 가 작동해도 외곽 flex 의 align-items 보다 우선 적용되지 않을 수 있음.
    3. 토큰 사용량이 줄바꿈 허용으로 두 줄이 되면 아이콘이 첫 줄 baseline 에 맞춰져 시각적으로 위로 떠 보일 수 있음 → 그 경우 `align-items: center` 그대로 두고 토큰 텍스트의 line-height 와 vertical-align 정리.
  - 의도된 결과: 같은 줄에 있는 [아이콘 / 이름 / 토큰 사용량] 셋이 세로 가운데 기준으로 정렬되어 보이는 것.
- 부수: 직전 오더 `memo_053` (헤더 한 줄 재배치) 와 같은 영역을 다루므로 같은 PRD 로 묶어 처리하는 편이 회귀 위험을 줄임. Plan AI 가 묶음 여부 판단.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/styles.css` (`.ai-progress-token-usage`, `.ai-progress-agent strong/p/span` 광역 셀렉터, `.ai-progress-agent-title`)
  - `apps/desktop/src/renderer/main.tsx` (필요 시 `AiProgressRow` JSX 미세 조정 — 토큰 사용량을 별도 인라인 노드로 묶거나 line-height 통일)

## Verification hint

- 데스크톱 앱 진행 메뉴에서 모든 러너 카드의 토큰 사용량 라벨이 말줄임표 없이 끝까지 표시되는지 확인.
- 카드 폭이 좁아도(직전 오더의 minWidth=1200 기준) 잘리지 않는지, 줄바꿈으로 떨어진다면 그 결과가 보기 흉하지 않은지 확인.
- 같은 줄의 에이전트 아이콘이 이름/토큰 텍스트 라인과 세로 가운데(middle) 로 정렬되는지 확인. 아이콘이 위/아래로 어긋나 보이지 않는지.
- `hideProgressTrack` 분기, 워커 카드(`ai-progress-row-worker`) / 비워커 카드 모두에서 같은 정렬 결과가 보이는지 확인.
- ORDER, PRD, TODO 핀 카드 / 칸반 / 위키 / 로그 등 다른 영역의 회귀가 없는지 확인.

## Planner Notes

- 2026-05-02: 기존 `memo_055`가 `tickets/done/prd_088/`에 이미 보관되어 있어 새 inbox 요청을 `memo_071`로 재번호화했다.
