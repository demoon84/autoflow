# Autoflow Order

## Order

- Title: 셀렉트 박스 화살표(chevron) 클릭 시 드롭다운 안 펼쳐짐 수정
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

셀렉트 박스 화살표(chevron) 누를 때 셀렉트 박스가 안 펼쳐짐

## Context

`apps/desktop/src/components/ui/select.tsx:127` 의 `<ChevronDown class="af-select-chevron">`
가 native `<select>` 위에 absolute 로 겹쳐 있고 CSS 에 `pointer-events: none` 이
설정돼 있다 (`styles.css:499`).

`pointer-events: none` 자체는 클릭이 chevron 을 통과해 select 로 가게 만드는
의도지만, chevron 위치(`right: 10px`)가 select 의 expand-affordance 영역과
시각적으로 겹쳐 있어 사용자는 화살표를 눌렀다고 생각하지만 실제로는 select
가 같은 영역을 차지해야 한다.

검증 필요 — chevron 의 `pointer-events: none` 이 정말 적용되고 있는지,
혹은 부모 `af-select-trigger` 에서 Pointer event 를 가로채는 다른 요소가
있는지 (예: 스크린샷에서 제일 우측 ChevronDown SVG 위 영역만 click event
가 dead 일 가능성).

## Allowed Paths

- apps/desktop/src/components/ui/select.tsx
- apps/desktop/src/renderer/styles.css

## Done When

- [ ] `<ChevronDown>` 위치를 클릭해도 native `<select>` 가 펼쳐진다 (또는 chevron 클릭 시 select.click() 을 강제로 위임)
- [ ] 기존 select 컨트롤(라벨/값 영역 클릭) 동작은 보존
- [ ] 키보드 접근 (Tab + Space/Arrow) 도 보존
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 빠른 수정안: chevron 의 `pointer-events: none` 이 정상 동작하는데도 안 열리면
  native `<select>` 가 chevron 영역을 차지하지 못하는 layout 문제 →
  `<select>` 에 `padding-right` 충분히 주거나 chevron 을 select 의 자식으로 둘
  수 없으니 wrapper 가 click 을 select 로 forward (`onClick` → `selectRef.current?.showPicker?.()`).
- Express rationale: 단일 컴포넌트 + 한 CSS 블록 변경.
