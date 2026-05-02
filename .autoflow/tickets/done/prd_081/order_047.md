---
id: memo_047
title: 위키 페이지 헤더 제거 + 상세 패널 항상 노출
status: inbox
created: 2026-05-01
---

## Request

위키 페이지 스샷에 보이는곳은 제거 오른쪽 상세 보기 화면 항상 노출
이전에 작업한 내역이 있는데 롤백되었음

(첨부 스크린샷: 위키 페이지 좌측 패널 상단의 `Wiki` 배지 + `목록` 라벨이 그려진 작은 헤더 영역. 사용자는 이 헤더 자체를 떼고, 우측 미리보기 패널이 토글이 아닌 항상 보이는 상태가 되길 원함. 사용자 말로는 같은 변경을 이전에 한 번 적용했다가 어떤 이유로 롤백돼 다시 돌아왔다고 함.)

## Notes

- 위치 (스크린샷의 헤더):
  - `apps/desktop/src/renderer/main.tsx:1822-1840` 의 `knowledge-page-toolbar`. 안에 `<div className="runner-page-summary"><Badge variant="outline">Wiki</Badge><span>목록</span></div>` 가 스크린샷의 그 영역. 그 옆엔 `미리보기 열기` 버튼이 같이 있음.
  - 이 toolbar 자체를 제거하면 `미리보기 열기` 버튼도 사라지므로 아래 "상세 항상 노출" 변경과 함께 처리해야 함.
- 우측 상세 패널 토글 상태:
  - state: `apps/desktop/src/renderer/main.tsx:963` `const [isWikiPreviewOpen, setIsWikiPreviewOpen] = React.useState(false);`
  - 닫힘 분기: `:1294` 와 `:1867` 의 `setIsWikiPreviewOpen(false)`
  - 열림 분기: `:1488` (위키 항목 선택 시) `setIsWikiPreviewOpen(true)`
  - 렌더 토글: `:1854` `className={`knowledge-preview-pane${isWikiPreviewOpen ? "" : " knowledge-preview-pane--hidden"}`}` 와 `aria-hidden={!isWikiPreviewOpen}`
- 의도된 동작:
  - 좌측 toolbar 의 `Wiki / 목록` 헤더를 제거.
  - 우측 `knowledge-preview-pane` 을 항상 보이게 만들고 (토글 상태/버튼/--hidden 클래스 제거 또는 비활성화).
  - 선택 항목이 없을 땐 기존 `LogPreview` 의 비어 있을 때 메시지("선택된 로그가 없습니다" 등) 가 그대로 노출되면 됨.
  - 부수: `미리보기 열기` 버튼, 우측 패널 안 닫기 버튼 (`setIsWikiPreviewOpen(false)` 호출처) 도 함께 정리.
- 이전 롤백 이력:
  - 사용자가 같은 변경을 한 번 적용했다고 함. `git log -G "isWikiPreviewOpen" -- apps/desktop/src/renderer/main.tsx` 로 단순 grep 했을 때는 변동 이력이 잡히지 않음 (현재 코드에만 존재) → 같은 의도가 다른 식별자로 들어갔다가 되돌려졌을 가능성. Plan AI 가 `Wiki`/`knowledge-page-toolbar`/`knowledge-preview-pane` 키워드로 git 이력을 다시 훑어 보면 좋다.
- CSS:
  - `apps/desktop/src/renderer/styles.css` 안의 `.knowledge-preview-pane`, `.knowledge-preview-pane--hidden`, `.knowledge-page-toolbar`, `.runner-page-summary` 정리도 같이 검토.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (위키 페이지 영역, `isWikiPreviewOpen` 관련 분기)
  - `apps/desktop/src/renderer/styles.css` (`.knowledge-page-toolbar`, `.knowledge-preview-pane*`, `.runner-page-summary` 등)

## Verification hint

- 데스크톱 앱 사이드바에서 `Wiki` 메뉴 진입 시 좌측 패널 상단의 `Wiki / 목록` 작은 헤더가 더 이상 보이지 않는지 확인.
- 첫 진입 시점부터 우측 상세 패널이 노출되어 있는지 (선택 항목 없을 때는 빈 상태 메시지) 확인.
- 위키 항목 선택 → 본문 표시 → 다른 항목으로 전환했을 때 패널이 닫히지 않고 그대로 유지되는지 확인.
- 좁은 폭에서 좌/우 분할이 깨지지 않는지 확인.
- 다른 페이지(로그 등) 의 동일 패턴이 회귀하지 않는지 확인.
