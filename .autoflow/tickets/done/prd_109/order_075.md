---
id: memo_075
title: 데스크톱 윈도우 가로 최소 폭 1200px 보장
status: archived-duplicate
created: 2026-05-01
archived: 2026-05-02
duplicate_of: tickets/done/prd_109/memo_070.md
related_prd: tickets/done/prd_109/prd_109.md
---

## Planner Note

- 이 메모는 `memo_070` → `prd_109` → `Todo-107` 로 이미 완료된 작업의 중복본이다. 결과: `apps/desktop/src/main.js:275` 에 `minWidth: 1200` 적용 완료. 별도 PRD 생성 없이 done 으로 아카이브한다.

## Request

윈도우의 가로 최소 사이즈 값을 1200px 보장

(맥락: 데스크톱 앱 메인 윈도우의 `minWidth` 가 현재 1040px 라 좁은 폭에서 핀 카드 / 칸반 / 진행 카드 레이아웃이 의도와 다르게 깨지는 케이스가 발생함. 직전 오더들의 한-줄 레이아웃 / 좌우 컬럼 항상 노출 같은 디자인 전제는 1200 이상에서 안정. 사용자는 이를 위해 가로 최소 폭을 1200px 로 끌어올려 그 아래로는 더 줄어들지 않도록 보장하길 원함.)

## Notes

- 현재 값: `apps/desktop/src/main.js:270-275` 의 `new BrowserWindow({ ..., minWidth: 1040, minHeight: 720 })`.
- 의도된 변경:
  - `minWidth: 1200` 로 상향. 사용자가 윈도우를 1200 미만으로 끌고 가도 OS 가 그 아래로 줄여 주지 않게 보장.
  - `minHeight` 는 명시적으로 변경 요청 없음 → 현행 720 유지(또는 디자인 안정 폭 기준으로 가볍게 검토).
  - 처음 시작 폭 (`width` 디폴트) 은 `1320` 으로 새 minWidth 보다 크므로 그대로 둘 수 있음. 다만 작은 디스플레이에서 저장된 레이아웃이 1040 등으로 복원되는 경우가 없는지 확인.
- 같은 minWidth 가 다른 BrowserWindow 호출(있다면) 에도 적용되어야 함. `apps/desktop/src/main.js` 안에 `new BrowserWindow` 가 다른 곳에 더 있는지 grep 으로 확인.
- 1200 으로 올리면 직전 오더들의 디자인 전제(예: ORDER/PRD/TODO 핀 카드 항상 한 줄, 칸반 컬럼 항상 노출, 진행 카드 헤더 한 줄 정렬) 가 자연스럽게 만족된다. 단, `apps/desktop/src/renderer/styles.css` 의 `@media (max-width: 1120px)` / `@media (max-width: 820px)` 같은 분기는 minWidth 보다 작은 폭을 가정한 잔존 분기인지 점검 필요. (잔존이면 정리, 다른 임베드 케이스가 있다면 보존.)

## Scope hint

- 후보 파일:
  - `apps/desktop/src/main.js` (`BrowserWindow` 생성 옵션)
  - `apps/desktop/src/renderer/styles.css` (1200 미만 가정의 잔존 미디어 쿼리 점검; 직전 오더 처리 결과와 충돌하지 않게)

## Verification hint

- 데스크톱 앱을 실행하고 윈도우 가장자리를 좌/우로 끌어 봐서 가로 폭이 1200px 미만으로 줄어들지 않는지 확인.
- 처음 실행 시점의 디폴트 폭(1320) 은 그대로 적용되는지 확인.
- 작은 디스플레이(예: 1280×800) 에서도 최소 폭 1200 을 유지한 채 윈도우가 화면을 벗어나거나 잘리지 않는지 확인.
- 1200 폭에서 핀 카드 / 칸반 / 진행 카드 레이아웃이 한 줄/한 행으로 정상 표시되는지 회귀 확인.
- 윈도우 상태 저장/복원 로직이 별도로 있다면(localStorage 등) 1040 같은 이전 값이 복원돼 minWidth 를 우회하지 않는지 확인.
