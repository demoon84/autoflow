---
id: memo_063
title: 진행 카드 활성 티켓 버튼에 티켓 전체 제목 노출
status: inbox
created: 2026-05-02
---

## Request

티켓명 전부가 나와야 함

(첨부 스크린샷: 진행 카드 우측 하단의 활성 티켓 표시 버튼. 현재는 `#104` 같은 번호 배지 + 옆에 끊긴 빨간 배지(응답 지연) 만 보이고 티켓 제목이 어디에도 노출되지 않음. 사용자는 활성 티켓의 전체 제목이 같은 자리에 보이길 원함.)

## Notes

- 위치 (JSX): `apps/desktop/src/renderer/main.tsx:5874-5886`
  ```tsx
  {runner.activeTicketId ? (
    <Button
      variant="ghost"
      type="button"
      className="ai-progress-active-ticket-button"
      onClick={openTicketDialog}
      title={`${displayActiveTicketBadge(runner.activeTicketId)} 티켓 보기`}
    >
      <Badge variant="outline" className="ai-progress-active-ticket">
        {displayActiveTicketBadge(runner.activeTicketId)}   {/* "#104" 만 */}
      </Badge>
    </Button>
  ) : null}
  ```
- 데이터는 이미 있음: `runner.activeTicketTitle` 가 보드 상태에 들어 있고 `activeTicketSummary` 같은 함수가 이미 사용 중. 단지 우측 하단 버튼 라벨에는 안 박혀 있음.
- 의도된 표시 (Plan AI 가 정확한 형식 결정):
  - 후보 1: `#104 · 활성 티켓 제목` 처럼 번호 + 가운뎃점 + 제목.
  - 후보 2: 번호 배지 옆에 별도 `<span>{runner.activeTicketTitle}</span>` 노드.
- 좁은 폭/긴 제목 처리: 카드 폭 압박 시 제목은 ellipsis (`text-overflow: ellipsis; white-space: nowrap; min-width: 0`) 로 잘리되, 마우스 hover 시 `title` 속성으로 전체 제목 툴팁 노출.
- 기존 `title={...}` 속성도 번호 + 제목으로 같이 갱신:
  ```tsx
  title={`${displayActiveTicketBadge(runner.activeTicketId)}${runner.activeTicketTitle ? ` · ${runner.activeTicketTitle}` : ""} 티켓 보기`}
  ```
- 부수 영향: 같은 카드의 옆 줄 `runnerProgressDetail` (`apps/desktop/src/renderer/main.tsx:5505-5506`) 도 이미 `activeTicketTitle` 을 보여 주므로 중복 표시 여부는 Plan AI 가 판단. 사용자는 "티켓명 전부" 를 명시적으로 우측 하단 버튼에서 보길 원하는 것으로 해석.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (활성 티켓 버튼 영역 + `displayActiveTicketBadge` 또는 새 헬퍼)
  - `apps/desktop/src/renderer/styles.css` (`.ai-progress-active-ticket-button` / `.ai-progress-active-ticket` 의 폭/ellipsis 보정)

## Verification hint

- 데스크톱 앱 진행 메뉴에서 활성 티켓이 있는 카드의 우측 하단 버튼에 `#NNN · 티켓 제목` 형식으로 전체 제목이 노출되는지 확인.
- 매우 긴 티켓 제목에서 ellipsis 가 적용되고 hover 툴팁으로 전체 제목 보이는지 확인.
- 활성 티켓이 없을 때 버튼이 그대로 사라지는지(현재 분기 유지) 확인.
- 응답 지연 배지와의 가로 정렬이 깨지지 않는지 확인.
- 카드 폭이 좁은 환경(데스크톱 minWidth) 에서 다른 요소(시작/정지 버튼, 토큰 사용량) 와 겹치지 않는지 확인.
