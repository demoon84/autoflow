---
id: memo_041
title: 로그 섹션 헤더 한 줄 표시
status: inbox
created: 2026-05-01
---

## Request

한줄로 표시

(첨부 스크린샷: 데스크톱 앱 로그 페이지 좌측 패널 헤더. 현재 위에 "최근 0 / 전체 0건" 카운트가 있고 그 아래에 "로그" 제목이 두 줄로 나뉘어 표시됨. 사용자는 이 두 텍스트를 한 줄로 합쳐서 보여달라는 의도.)

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:1840-1846` 의 로그 페이지 좌측 list pane 헤더.
  ```tsx
  <div className="section-heading compact">
    <div>
      <div className="section-kicker">{showingAll ? `전체 ${totalLogs}건` : `최근 ${showingCount} / 전체 ${totalLogs}건`}</div>
      <h3>로그</h3>
    </div>
    <Terminal className="h-4 w-4 text-muted-foreground" />
  </div>
  ```
- 기대 표시 예시 (Plan AI 가 결정): `로그 · 최근 0 / 전체 0건` 처럼 제목 + 카운트를 같은 줄에 두는 형태. 또는 카운트를 `<h3>` 옆 inline 으로 옮기는 방식.
- 동일/유사 패턴이 다른 페이지(`section-kicker` + `<h3>`)에도 있는지 확인해 같이 정리할지 여부는 Plan AI 판단. 이번 order 의 1차 범위는 로그 헤더 한 군데.

## Scope hint

- 후보 파일: `apps/desktop/src/renderer/main.tsx`
- 보조 파일: `apps/desktop/src/renderer/styles.css` (필요 시 `.section-heading.compact` / `.section-kicker` 정렬 보정)

## Verification hint

- 데스크톱 앱 로그 페이지에서 좌측 패널 상단의 카운트와 "로그" 제목이 한 줄로 표시되는지 눈으로 확인.
- 카운트 텍스트가 길어졌을 때(예: `최근 200 / 전체 9999건`) 줄바꿈/잘림이 보기 흉하지 않은지 확인.
- 다른 페이지의 헤더 정렬이 회귀하지 않았는지 가볍게 회귀 확인.
