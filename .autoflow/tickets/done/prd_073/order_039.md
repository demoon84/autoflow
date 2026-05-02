---
id: memo_039
title: 진행 빈 상태 화면 상단 아이콘 제거
status: inbox
created: 2026-05-01
---

## Request

맨위에 아이콘 제거

(첨부 스크린샷: "Autoflow 러너 설정이 비어 있습니다." empty-state 화면. 제목 위에 폴더+ 아이콘이 떠 있고, 아래쪽 "설치" 버튼 안에도 같은 폴더+ 아이콘이 들어 있는 상태. 사용자가 가리키는 "맨위에 아이콘"은 제목 바로 위에 떠 있는 큰 아이콘.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:1747` 의 `setup-required-panel` 섹션 안 `<FolderPlus className="h-6 w-6" aria-hidden="true" />`. `<h2>` 위에 단독으로 떠 있는 아이콘이 그것이다.
- 같은 패널의 "설치" 버튼 내부에도 `FolderPlus` / `Loader2` 가 들어 있지만, 사용자는 "맨위에" 라고 명시했으므로 그것은 유지 후보. Plan AI 가 최종 범위를 좁혀 주길 바람.
- 동일/유사 empty state 가 다른 곳에도 있는지 (`setup-required-panel` 클래스 검색) 함께 확인해 일관되게 처리하면 좋다.

## Scope hint

- 후보 파일: `apps/desktop/src/renderer/main.tsx`
- 관련 CSS 가 함께 있다면: `apps/desktop/src/renderer/styles.css` (`.setup-required-panel` 셀렉터)

## Verification hint

- 데스크톱 앱에서 보드가 비어 있는 상태(`setupRequired` true) 로 진입했을 때 제목 위 큰 폴더+ 아이콘이 더 이상 보이지 않는지 눈으로 확인.
- 레이아웃이 무너지지 않고 제목/설명/버튼이 그대로 중앙 정렬되는지 확인.
