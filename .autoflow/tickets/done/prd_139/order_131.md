---
title: "AI 진행 현황" 헤더의 "미표기" placeholder 글자 제거
created_at: 2026-05-03
source: claude-code /order
---

## Request

(첨부 스크린샷) "AI 진행 현황" 헤더 우측에 보이는 "미표기" 글자를 삭제해줘. `lastUpdated` 값이 없을 때 노출되는 placeholder 문구가 사용자에게 의미 없이 보여서 제거 필요.

## Scope (hint)

- `apps/desktop/src/renderer/main.tsx` 두 위치의 fallback 표현 정리:
  - **line 1939**: `{lastUpdated ? \`마지막 업데이트 ${formatDate(lastUpdated)}\` : "미표기"}` — settings-content 헤더(AI 진행 현황 등 주요 화면).
  - **line 2498**: 같은 패턴 — essential 화면(프로젝트 미선택 화면 또는 동등 위치).
- 처리 방식 후보:
  - (a) 텍스트만 "미표기" → 빈 문자열 또는 `null` 로 변경.
  - (b) `lastUpdated` 가 없으면 `<span>` 자체를 렌더링 안 함 (조건부 render 로 변경).
  - (c) 의미 있는 fallback 으로 교체 (예: "업데이트 대기" 등) — 단 사용자 의도는 "삭제" 이므로 (a) 또는 (b) 권장.
- 권장: **(b)** — 조건부 렌더 (`lastUpdated ? <span>...</span> : null`). 빈 span 으로 인한 layout 자투리 방지.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx`
- (필요 시) `apps/desktop/src/renderer/styles.css` — `.content-updated-at`, `.settings-title-status` 의 빈 상태 정렬 정리.

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기:
  - "AI 진행 현황" 화면 헤더 우측에 "미표기" 글자가 더 이상 보이지 않는지 확인.
  - `lastUpdated` 값이 채워진 정상 상태에서는 기존 "마지막 업데이트 YYYY-MM-DD ..." 문구가 그대로 표시되는지 회귀 확인.
  - essential 화면(프로젝트 미선택 등) 의 같은 위치에서도 "미표기" 미노출 확인.
  - 헤더 영역 layout(타이틀 좌우 정렬) 이 fallback 텍스트 제거 후에도 깨지지 않는지 확인.
- `grep -n "미표기" apps/desktop/src/renderer/main.tsx` 결과가 0건인지 확인.
