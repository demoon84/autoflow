---
id: memo_033
title: 좌측 사이드바에서 "로그" 메뉴를 제일 마지막으로 이동
created: 2026-04-30
source: chat-order-trigger
---

## Request

좌측 로그 메뉴 제일 마지막으로 해줘.

현재 데스크톱 좌측 사이드바 메뉴 순서가 `작업 → Tickets → Wiki → 로그 → 통계` 인데, "로그" 항목을 통계 뒤로 보내서 `작업 → Tickets → Wiki → 통계 → 로그` 순서로 만든다.

## Notes

- 직전에 "로그" 메뉴를 Wiki ↔ 통계 사이에 끼웠는데, 통계가 로그보다 먼저 오는 게 자연스럽다는 사용자 피드백. 통계가 일상적으로 더 자주 보이는 정보 화면이고, 로그는 진단/감사 화면 성격이라 가장 뒤로 둔다.
- 메뉴 순서만 변경. 페이지 자체 (`activeSettingsSection === "logs"` 렌더 블록) 와 콘텐츠는 그대로 유지.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`

  현재 `settingsNavigation` 배열은 137~143 라인 부근에 정적으로 선언되어 있음. `{ key: "logs", ... }` 항목을 `{ key: "snapshot", ... }` 다음으로 옮기면 충분. `SettingsSection` 타입은 배열에서 자동 파생되므로 별도 손볼 곳 없음.

## Verification (hint)

- `apps/desktop` 빌드 / 타입체크 통과 (`npm run check`).
- 데스크톱 좌측 사이드바에서 메뉴 순서가 `작업 → Tickets → Wiki → 통계 → 로그` 로 보이는지 사용자 확인.
- 로그 메뉴 클릭 시 페이지 동작이 그대로인지 확인 (이번 작업에선 페이지 콘텐츠 변경 없음).
