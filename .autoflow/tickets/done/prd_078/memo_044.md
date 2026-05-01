---
id: memo_044
title: 입력/버튼 기본 크기를 xs로 축소
status: inbox
created: 2026-05-01
---

## Request

인풋요소와 버튼요소의 크기  xs 사이즈로

(맥락: 데스크톱 앱 전반에서 input / button 의 시각적 크기를 한 단계 더 작게(xs) 줄이고 싶다는 요청. 현재는 대부분 `size="default"` 또는 `size="sm"` 로 그려지고, `xs` 와 `icon-xs` 토큰은 이미 `Button` 컴포넌트와 CSS 에 정의되어 있음.)

## Notes

- 기존 토큰:
  - `apps/desktop/src/components/ui/button.tsx` 의 `ButtonSize` = `"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"`. 기본값은 `"default"`.
  - 대응 CSS: `apps/desktop/src/renderer/styles.css:259` `.af-button-xs`, `:295` `.af-button-icon-xs`. `xs` 정의는 이미 존재 → 토큰 재사용 가능.
  - `apps/desktop/src/components/ui/input.tsx` 는 size 변형이 없고 `.af-input` 단일 클래스. 작게 만들려면 `size`/`variant` 를 새로 추가하거나 `.af-input` 자체를 한 단계 줄여야 함.
- 가능한 방향 (Plan AI 가 결정):
  1. `Button` 의 default `size` 를 그대로 두고, 사용처(`apps/desktop/src/renderer/main.tsx` 등) 에서 `size="xs"` 로 일괄 교체. 가장 안전하지만 변경 라인이 많음.
  2. `.af-button-default` / `.af-input` 의 padding · font-size 를 한 단계 줄여 전역 축소. 영향 범위가 크고 회귀 위험 ↑.
  3. `Input` 에도 `size` prop(`"default" | "sm" | "xs"`) 를 추가해 디자인 토큰을 통일하고, 자주 같이 쓰이는 폼/툴바 영역 위주로 `xs` 적용.
- 폼 영역 외에 toolbar / 다이얼로그 footer / 사이드바 등 위치별 실제 사용처를 확인해 일괄 축소 시 깨지는 곳(아이콘 정렬, 라인 높이) 이 없는지 검토 필요.
- 접근성 최소 클릭 영역(보통 32px) 보다 작아지지 않는지 확인.

## Scope hint

- 후보 파일:
  - `apps/desktop/src/components/ui/button.tsx`
  - `apps/desktop/src/components/ui/input.tsx`
  - `apps/desktop/src/renderer/styles.css` (`.af-button-*`, `.af-input`)
  - `apps/desktop/src/renderer/main.tsx` (전역 사용처 일괄 교체 시)

## Verification hint

- 데스크톱 앱의 주요 화면(진행, 칸반, 로그, 지식, 스냅샷, 사이드바, 다이얼로그)에서 버튼/인풋이 한 단계 작아진 것이 시각적으로 확인되는지.
- 아이콘 only 버튼(stop/play/refresh 등) 이 깨지지 않는지.
- 키보드 포커스 링과 호버 상태가 그대로 보이는지.
- 폼 입력 필드(프로젝트 폴더 선택, 검색, 드로워 폼) 의 텍스트가 잘리지 않는지.
- 모바일/좁은 폭 회귀 없는지 가벼운 확인.
