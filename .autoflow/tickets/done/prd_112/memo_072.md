---
id: memo_072
title: 티켓 작업공간 탭의 카운트 배지 제거
status: inbox
created: 2026-05-01
---

## Request

탭에 숫자 표기는 삭제

(첨부 스크린샷: 티켓 작업공간 상단 탭 바. 현재 `PRD 105 / Order 70 / 발급 티켓 204` 형태로 라벨 옆에 카운트 배지가 같이 노출됨. 사용자는 카운트 숫자(배지) 만 떼고 라벨 텍스트만 남기길 원함.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:5104-5122` 의 티켓 작업공간 toolbar 안 탭 트리거 렌더 영역.
  ```tsx
  <Button ... className="ticket-workspace-tab-trigger" ...>
    <span>{tab.label}</span>
    <Badge variant="secondary">
      {tab.key === "prd" ? prdFiles.length : tab.key === "inbox" ? inboxFiles.length : issuedFiles.length}
    </Badge>
  </Button>
  ```
- 의도된 변경: 탭 트리거 안의 `<Badge>` 노드를 제거하고 라벨 `<span>{tab.label}</span>` 만 남긴다. 활성 탭 표시는 기존 `data-state` / `aria-selected` 로 충분.
- 부수 점검:
  - `apps/desktop/src/renderer/styles.css` 의 `.ticket-workspace-tab-trigger` / 그 안 `.af-badge` 결합 셀렉터가 있다면 같이 정리해도 됨 (남아 있어도 무해).
  - 카운트 자체는 칸반 컬럼 헤더 (`apps/desktop/src/renderer/main.tsx:4392 부근` 의 `<Badge variant="secondary">{columnItems.length}</Badge>`) 에서 여전히 노출되므로 정보 손실은 없음.
- 이번 변경은 사람이 보는 표기만 정리하는 작업이며, 탭 식별자(`prd`, `inbox`, `issued`), `activeWorkspaceTab` 상태, 카운트 계산 로직은 그대로 둔다.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (티켓 작업공간 탭 트리거)
  - `apps/desktop/src/renderer/styles.css` (필요 시 탭 내부 갭/패딩 보정)

## Verification hint

- 데스크톱 앱 티켓 작업공간 상단 탭 바에서 `PRD / Order / 발급 티켓` 텍스트만 보이고 그 옆의 숫자 배지가 더 이상 노출되지 않는지 확인.
- 활성/비활성 탭 시각 표시(밑줄·강조 등) 와 클릭 동작이 그대로 작동하는지 확인.
- 키보드 포커스/접근성(aria-selected, role="tab") 이 그대로 유지되는지 확인.
- 칸반 컬럼 헤더의 카운트는 그대로 노출되는지 확인 (탭 카운트 제거가 다른 카운트까지 지우지는 않도록).

## Planner Notes

- 2026-05-02: 기존 `memo_056`이 `tickets/done/prd_089/`에 이미 보관되어 있어 새 inbox 요청을 `memo_072`로 재번호화했다.
