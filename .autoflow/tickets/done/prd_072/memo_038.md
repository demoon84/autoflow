---
id: memo_038
title: 데스크톱 UI 툴팁 메시지 제거
status: inbox
created: 2026-05-01
---

## Request

툴팁 메세지 제거

(첨부 스크린샷: 러너 카드의 ▷(시작) 버튼 위에 "시작" 툴팁이 떠 있는 모습. 데스크톱 앱 버튼들에 붙어 있는 hover 툴팁(예: 시작/중지/새로고침/저장 등)이 거슬려서 떼고 싶다는 맥락.)

## Notes

- 스크린샷 기준으로 가장 눈에 띄는 위치는 러너 카드의 시작/중지 버튼 툴팁이다.
- 코드상으로는 `apps/desktop/src/renderer/main.tsx` 안에 다수의 `title=` 와 `data-tooltip=` 속성이 같은 문자열로 짝지어 붙어 있다 (예: `시작`, `중지`, `새로고침`, `설치`, `지표 스냅샷 저장`, 프로젝트 경로 표시 등). 시각적 툴팁은 주로 `data-tooltip` CSS 훅에 의해 그려진다.
- 어디까지 제거할지(전부 제거 / 버튼 hover 툴팁만 제거 / 아이콘 전용 버튼만 제거 등)는 Plan AI 가 판단해서 가장 좁은 안전 범위로 좁혀 주길 바람. 접근성을 위해 aria-label 같은 대체 라벨이 필요한지 여부도 함께 검토.

## Scope hint

- 후보 파일: `apps/desktop/src/renderer/main.tsx`
- CSS 쪽 `[data-tooltip]` 스타일이 같이 정리되어야 한다면 `apps/desktop/src/renderer/styles.css` 도 후보.

## Verification hint

- 데스크톱 앱을 띄워 러너 카드 / 사이드바 / 툴바의 아이콘 버튼들에 hover 했을 때 텍스트 말풍선이 더 이상 뜨지 않는지 눈으로 확인.
- 키보드/스크린리더 접근성을 깨지 않았는지 확인 (aria-label 유지 여부 포함).
