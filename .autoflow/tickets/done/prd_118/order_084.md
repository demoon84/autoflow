---
title: 사이드바 메뉴 항목 간 세로 간격 살짝 넓히기
created_at: 2026-05-03
source: claude-code /order
---

## Request

(첨부 스크린샷) 데스크톱 사이드바 메뉴(AI 진행 현황 / 티켓 / LLM 위키 / 통계 / 로그) 항목들 사이의 세로 간격을 조금 넓혀줘. 지금은 항목 사이가 다소 좁아 보임.

## Scope (hint)

- 데스크톱 앱 사이드바 nav (`.settings-nav-list` / `.settings-nav-item`) 의 메뉴 항목 간 세로 간격(예: gap 또는 항목 padding) 을 살짝 증가.
- 활성 항목(`.settings-nav-item-active`) 하이라이트 박스 비율과 어울리도록 자연스럽게.
- 푸터의 프로젝트 선택/테마 토글 영역 정렬은 영향 받지 않게.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/styles.css`

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기에서 사이드바 메뉴 5개 항목 사이 간격이 첨부 스크린샷보다 살짝 더 여유 있게 보이는지 확인.
- 활성 메뉴 하이라이트가 항목 영역에 그대로 맞춰지고 잘리지 않는지 확인.
- 좁은 너비의 사이드바에서도 라벨이 잘리지 않는지 회귀 확인.
