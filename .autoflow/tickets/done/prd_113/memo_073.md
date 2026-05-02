---
id: memo_073
title: 로그 페이지 리스트 머리글 영역 제거
status: inbox
created: 2026-05-01
---

## Request

로그 페이지 해당 리스트 머리글 영역 삭제 목록만 나오게 해줘

(첨부 스크린샷: 로그 페이지 좌측 패널 상단의 머리글. 현재 `로그` 제목 + `최근 28 / 전체 28건` 카운트 + 우측의 터미널 아이콘이 한 줄 헤더로 그려져 있음. 이전 오더 `memo_041` 에서 두 줄을 한 줄로 합치는 작업을 적용했고, 이번에는 그 머리글 자체를 통째로 떼서 좌측 패널이 곧장 로그 목록으로 시작하길 원함.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:2044-2053` 의 로그 페이지 좌측 list pane 헤더.
  ```tsx
  <div className="tool-panel knowledge-list-pane">
    <div className="section-heading compact log-list-heading">
      <div className="log-heading-copy">
        <h3>로그</h3>
        <div className="section-kicker log-count-text">
          {showingAll ? `전체 ${totalLogs}건` : `최근 ${showingCount} / 전체 ${totalLogs}건`}
        </div>
      </div>
      <Terminal className="h-4 w-4 text-muted-foreground" />
    </div>
    <LogList .../>
    ...
  </div>
  ```
- 의도된 변경: `<div className="section-heading compact log-list-heading">...</div>` 노드를 통째로 제거하고 곧바로 `<LogList />` 가 보이게 한다. 이름/카운트 표시가 필요할 경우의 위치는 사용자 의도상 "목록만" 이므로 추가 노출 없이 제거.
- 부수:
  - `apps/desktop/src/renderer/styles.css` 의 `.log-list-heading`, `.log-heading-copy`, `.log-count-text` 셀렉터가 더 이상 쓰이지 않게 되면 함께 정리해도 무방. 다른 곳 재사용 여부는 grep 으로 확인.
  - 카운트 정보 자체는 좌측 하단 `log-list-footer` 의 "전체 N건 모두 보기" 버튼이나 LogList 내부 표시로 여전히 확인 가능하므로 정보 손실은 크지 않음.
- 이번 변경은 표시만 제거하는 것이며, 로그 데이터 로딩, `selectedLogPath`, 미리보기 패널 동작은 그대로 둔다.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (로그 페이지 좌측 패널 헤더 제거)
  - `apps/desktop/src/renderer/styles.css` (필요 시 `.log-list-heading` / `.log-heading-copy` / `.log-count-text` / `.section-heading.compact` 잔여 스타일 정리)

## Verification hint

- 데스크톱 앱 사이드바에서 "로그" 메뉴 진입 시 좌측 패널 상단의 머리글 영역(`로그` 텍스트 + 카운트 + 터미널 아이콘) 이 더 이상 보이지 않고, 패널이 곧장 로그 목록으로 시작하는지 확인.
- 로그 항목 선택 → 우측 미리보기 표시 → 항목 전환 같은 기존 동작이 그대로 작동하는지 확인.
- 좁은 폭 / 다크-라이트 테마 전환 / 빈 상태(`로그가 없습니다`) 분기에서도 레이아웃이 깨지지 않는지 확인.
- 다른 페이지(위키, 지식 등) 의 동일 패턴 헤더에 영향이 없는지 회귀 확인.

## Planner Notes

- 2026-05-02: 기존 `memo_057`이 `tickets/done/prd_090/`에 이미 보관되어 있어 새 inbox 요청을 `memo_073`으로 재번호화했다.
