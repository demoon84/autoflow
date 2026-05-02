---
id: memo_074
title: 작업 흐름 핀 레이어 목록 정렬 깨짐 수정
status: inbox
created: 2026-05-02
---

## Request

목록 ui깨짐

(첨부 스크린샷: ORDER 핀 레이어를 펼친 목록. 행마다 레이아웃이 어긋나 있음.
- 일부 행에는 `대기` 회색 배지가 보이고, 일부 행에는 배지가 없음.
- 그 결과 우측의 날짜/시간 컬럼이 행마다 다른 가로 위치에 정렬되어 들쭉날쭉.
- 추가로, 같은 번호(`Order-057`, `Order-056`, `Order-055`, `Order-054`) 가 두 줄씩 중복 노출되는 케이스도 발견 — 한 줄은 `대기` (오늘 inbox 새로 들어온 것), 다른 한 줄은 같은 번호의 done 기록. 같은 ID 가 다른 제목으로 두 번 보여 시각적으로 더 깨져 보임.)

## Notes

- 핵심 원인 (정렬 깨짐): `apps/desktop/src/renderer/styles.css:4211-4225` 의 `.workflow-pin-item` 그리드는 4열 고정.
  ```css
  .workflow-pin-item {
    display: grid;
    grid-template-columns: minmax(56px, auto) minmax(0, 1fr) auto auto;
    ...
  }
  ```
  대응 JSX (`apps/desktop/src/renderer/main.tsx:4972-4995`):
  ```tsx
  <Button className="workflow-pin-item" ...>
    <strong className="workflow-pin-item-id">{...}</strong>
    {file.title ? <span className="workflow-pin-item-title">{...}</span> : null}
    {file.stateLabel ? <Badge>...{file.stateLabel}</Badge> : null}
    <time>{formatDate(file.modifiedAt)}</time>
  </Button>
  ```
  → `stateLabel` 또는 `title` 이 없는 행은 children 수가 줄어 `<time>` 이 col3 으로 당겨지고, 다른 행과 가로 위치가 달라진다. 이게 스크린샷의 "대기" 유무에 따라 날짜가 들쭉날쭉한 직접 원인.
- 의도된 정렬:
  - 컬럼 슬롯을 항상 동일하게 두고 (`ID | 제목 | 배지 | 날짜`), 빈 슬롯에는 placeholder 셀(또는 빈 `<span aria-hidden="true" />`) 을 넣어 그리드 위치를 보존.
  - 또는 `<time>` 셀을 항상 마지막 컬럼에 고정 (`grid-column: -2 / -1` 같은 식) 해서 children 수와 무관하게 우측 끝에 붙도록.
  - 또는 그리드를 `auto auto auto` 가 아니라 `auto minmax(0, 1fr) min-content min-content` + JSX 에서 항상 4슬롯 렌더로 고정.
- 추가 원인 (번호 중복): inbox 에 새로 들어온 `memo_057.md` 와 done 폴더에 이미 있는 `memo_057.md` (이전 다른 작업) 가 같은 핀 레이어에 같이 모이면서 같은 ID 가 두 번 노출됨. 이건 두 가지 후속 작업이 필요함:
  1. `apps/desktop/src/renderer/main.tsx:5210-5217` 의 `memoFiles = [...inboxMemos, ...doneMemos]` 가 같은 번호를 그대로 합치지 않고, 같은 `memo_NNN.md` 가 양쪽에 있을 때는 **현재 상태(inbox 우선)** 만 표시하도록 dedupe.
  2. 더 근본적으로, `autoflow memo create` (CLI) 의 다음 번호 계산이 `tickets/inbox/` 만 보는 게 아니라 `tickets/inbox/` + `tickets/done/**` 의 가장 큰 `memo_NNN` 을 기준으로 +1 하도록 보정 (별도 PRD 로 분리 가능).
- 이번 오더의 1차 범위는 "**시각 정렬 깨짐**" 이고, 번호 중복은 부가 문제로 같이 적어 둠. Plan AI 가 PRD 분리 여부 결정.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/styles.css` (`.workflow-pin-item` 그리드 정의)
  - `apps/desktop/src/renderer/main.tsx` (`WorkflowPinLayer` 의 `<li>` 렌더 4슬롯 보존, `memoFiles` dedupe)
  - (별도 PRD 후보) `packages/cli/...` 또는 `autoflow memo create` 의 next-number 계산 영역 — 사용자 요청 범위 밖이면 추가 오더로 분리.

## Verification hint

- ORDER / PRD / TODO / 반려 핀 레이어를 각각 펼쳐서 `대기` 또는 `반려` 같은 상태 배지가 있는 행과 없는 행이 섞여 있어도 우측 날짜/시간이 동일한 가로 위치에 정렬되는지 확인.
- 같은 `memo_NNN` 이 inbox 와 done 양쪽에 있을 때 핀 레이어 목록이 한 번만 노출되는지(또는 의도된 fallback) 확인.
- 빈 목록, 1개 항목, 매우 긴 제목, 매우 짧은 제목 케이스에서도 그리드가 깨지지 않는지 확인.
- 좁은 폭(데스크톱 minWidth 부근) 에서도 컬럼이 겹치거나 잘리지 않는지 확인.

## Planner Notes

- 2026-05-02: 기존 `memo_058`이 `tickets/done/prd_091/`에 이미 보관되어 있어 새 inbox 요청을 `memo_074`로 재번호화했다.
