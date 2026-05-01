---
id: memo_040
title: 미설치 상태에서 사이드바 메뉴 disabled 처리
status: inbox
created: 2026-05-01
---

## Request

설치가 안되었을때는 사이드바 메뉴를 사용못하게 disabled 처리해야함

(첨부 스크린샷: "Autoflow 러너 설정이 비어 있습니다." empty-state. 보드는 있지만 러너가 비어 있어 `setupRequired` 가 true 인 상태. 이 상태에서도 사이드바 메뉴가 클릭 가능하면 다른 화면으로 들어가도 빈 페이지가 보일 수 있다는 맥락.)

## Notes

- 위치 후보: `apps/desktop/src/renderer/main.tsx:1623-1641` 의 `settings-page` / `settings-nav` 섹션. `settingsNavigation.map` 으로 그려지는 `Button` 들이 사이드바 메뉴 항목.
- 현재 동작:
  - `boardMissing === true` 면 사이드바 자체가 렌더되지 않음 (`{!boardMissing ? <aside.settings-nav ...> : null}`).
  - `runnersUnconfigured === true` 만 true 인 경우(스크린샷 케이스) 에는 사이드바가 보이고, 메뉴를 누르면 활성 섹션이 바뀌긴 하지만 진행 화면 외에는 의미 있는 콘텐츠가 없을 수 있음.
- 의도된 동작:
  - `setupRequired === true` (`boardMissing || runnersUnconfigured`) 동안에는 사이드바 메뉴 항목들을 disabled 로 만들어 클릭/포커스 진입을 막는다.
  - 현재 화면(설치 안내 / 진행 빈 상태) 만 노출되도록 한다. 테마 토글, 프로젝트 선택, 설치 버튼 등 설치 흐름에 필요한 컨트롤은 활성 유지.
- 접근성: 단순 시각적 비활성이 아니라 `disabled` 또는 `aria-disabled="true"` + `tabindex` 처리를 같이 해서 키보드/스크린리더에서도 진입할 수 없게 한다.
- 범위 좁힘은 Plan AI 가 정함. 진행(progress) 메뉴만 활성으로 둘지, 모든 메뉴를 disabled 로 둘지 등.

## Scope hint

- 후보 파일: `apps/desktop/src/renderer/main.tsx` (사이드바 영역), `apps/desktop/src/renderer/styles.css` (`.settings-nav-item` disabled 스타일)

## Verification hint

- 데스크톱 앱에서 `tickets/` 만 존재하고 러너가 비어 있는 상태(혹은 보드가 없는 상태) 로 진입했을 때 사이드바의 진행/칸반/지식/로그/스냅샷 메뉴들이 클릭되지 않는지 확인.
- 키보드 Tab 으로도 disabled 메뉴에는 포커스가 들어가지 않는지 확인.
- 설치 흐름 완료 후에는 다시 정상적으로 메뉴들을 누를 수 있는지 회귀 확인.
