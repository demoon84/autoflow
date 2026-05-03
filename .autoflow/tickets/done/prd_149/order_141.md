---
title: 티켓 ID "#NNN" 약식 표기 → 풀 prefix 표기로 통일 (Ticket-NNN)
priority: normal
created_at: 2026-05-03
source: claude-code /order
---

## Request

(첨부 스크린샷) "#141" 같이 티켓 번호만 약식으로 표기되는 자리들이 있어서 다른 표기 (`PRD-NNN`, `Order-NNN`, `Reject-NNN` 등) 와 일관성이 없음. 모두 풀 prefix 로 표기되게 통일해줘.

## 검토 결과 — 약식 표기 출처

`apps/desktop/src/renderer/main.tsx`:

- **line 5746-5748** `displayActiveTicketNumber`:
  ```ts
  function displayActiveTicketNumber(value: string) {
    const match = value.match(/^tickets_(\d+)$/i);
    return match ? match[1] : value.replace(/\.md$/i, "");
  }
  ```
- **line 5751-5753** `displayActiveTicketBadge`:
  ```ts
  function displayActiveTicketBadge(value: string) {
    return `#${displayActiveTicketNumber(value)}`;
  }
  ```
- **line 5755-5764** `activeTicketSummary` 가 `displayActiveTicketBadge` 를 사용해 AI 진행 현황 카드의 active ticket label 을 `#141 — title (PRD_NNN)` 형태로 만듦.

→ AI 진행 현황 카드의 active ticket 영역, runner 카드 footer 등에서 `#141` 약식 표기.

## 비교 (다른 표기는 풀 prefix)

같은 파일 line 4071-4089 `workflowFileDisplayName`:
```ts
prd_141 → PRD-141
order_141 → Order-141
reject_141 → Reject-141
tickets_141 → Ticket-141
```

→ ticket workspace 카드 / 핀 레이어 등 다른 자리는 모두 `Ticket-141` 풀 표기. **`#141` 만 일관성 깨짐**.

## Scope (hint)

### 1. `displayActiveTicketBadge` 결과를 풀 표기로
- `displayActiveTicketBadge` 가 `#${number}` 대신 `workflowFileDisplayName(\`${value}.md\`)` 결과 (`Ticket-141`) 를 반환하도록 변경.
- 또는 별도 helper `displayTicketIdAsBadge` 신설해서 통일된 prefix 매핑 사용.

### 2. 호출지 회귀 점검
- `activeTicketSummary` (line 5755) 가 사용하는 모든 자리 (AI 진행 현황 카드 footer, runner card 등) 에서 `Ticket-141` 형태로 표시되는지 확인.
- 폭 좁은 자리에서 라벨이 잘리지 않는지 (CSS truncate 회귀).
- 다른 표기 (`PRD-141 · Ticket-141 — title`) 와 자연 결합되는지.

### 3. 다른 약식 표기 자리도 함께 점검 (보조)
- grep `'#'` 으로 코드 내 `#${id}` 패턴 추가 검색. UI 라벨에 # prefix 약식이 더 있다면 같이 풀 표기로 정정.
- 단, hex color (`#1f2937`), HTML entity (`&#39;`), markdown anchor (`#section`) 등은 예외 (false-positive 분리).

### 4. 입력 필드 / 새 작성 폼에서의 표기 (스크린샷 상단)
- 스크린샷 위쪽의 "#141" 이 입력 필드 형태라면, 새 ticket 작성 / 편집 다이얼로그에서 사용자 노출 라벨도 같은 표기 통일 필요.
- 해당 폼 위치 확인 후 (현재 `#${...}` 패턴 grep 으로 추적) 같이 적용.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`
- (필요 시) `apps/desktop/src/renderer/styles.css` — 라벨 폭 변경에 따른 padding/truncate 조정

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기:
  - AI 진행 현황 카드의 active ticket 라벨이 `#141` → `Ticket-141` 로 표시되는지.
  - 같은 라벨이 들어가는 다른 자리 (runner card footer, 작성 폼 미리보기 등) 도 일관 표기인지.
  - 폭 좁은 카드 / 모바일 레이아웃에서 라벨 잘림 회귀 없는지.
- `grep -nE '\\$\\{[^}]*\\}|"#"' apps/desktop/src/renderer/main.tsx | grep -E '#\\\$\\{|"#" \\+'` 결과에 라벨용 `#NNN` 패턴 잔재 없는지.

## Notes

- **연관:**
  - order_137/138 (priority 메커니즘) — 입력 폼에 priority 필드 추가될 때 동시에 ID 표기 일관도 함께 정리하면 효율적. 같은 PRD 로 묶일 수 있음.
  - order_140 (order 본문 형식 통일) — 같은 표기 일관화 영역. 묶임 가능.
- **위험:**
  - `#NNN` 표기 폭이 짧아서 들어가던 좁은 자리에 `Ticket-NNN` 이 들어가면 layout 깨짐 가능 — CSS 폭 회귀 점검 필요.
  - parser 가 `#NNN` 을 명시적으로 인식하던 자리가 있다면 (현재 검색 결과 없음) 같이 갱신.
- **out of scope:**
  - 외부 노출 형식 (예: commit message `[ticket_NNN]`) 은 그대로 유지 (호환성).
- **1원칙 정합:**
  - 표기 변경은 자율 흐름에 영향 없음. UI 가독성/일관성 개선만.
