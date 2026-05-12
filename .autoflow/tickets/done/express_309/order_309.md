# Autoflow Order

## Order

- Title: 데스크탑 runner 카드 헤더(아이콘 + 이름) 수직 정렬 보정
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 runner 카드 좌상단의 agent 아이콘(주황 별표 배경) 과 그 옆 텍스트
(`Worker`, `Planner`, `LLM Wiki`, `Verifier`) 가 시각적으로 수직 중앙 정렬이
어긋남. 아이콘 박스 중심선과 텍스트 baseline / center 가 일치하지 않아서
텍스트가 아이콘보다 살짝 위 또는 아래로 보임. 5개 카드 모두 동일 문제.

해야 할 것:
1. `.ai-progress-row-top` / `.ai-progress-agent` / `.ai-progress-agent-title` 의
   flex `align-items` 가 `center` 인지 확인, 어긋났으면 통일
2. `AgentAppIcon` 의 line-height / vertical-align 이 텍스트 baseline 과
   일치하도록 조정
3. 텍스트의 `line-height` 가 아이콘 높이와 호환되는지 확인 (현 line-height: 1
   이면 baseline 이 어긋날 수 있음)
4. 한글/영문 폰트의 metric 차이로 인한 오차도 보정 (Pretendard / D2Coding metric)

## Allowed Paths

- apps/desktop/src/renderer/styles.css
- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] 5개 runner 카드 모두에서 아이콘 중심선과 텍스트 visual center 가 ±1px 이내로 정렬
- [ ] 다크/라이트 테마 모두 동일
- [ ] 아이콘 / 텍스트 둘 다 카드 상단 padding 안에서 잘림 없음
- [ ] 라벨 길이 변화 (예: "LLM Wiki" → "Worker-2") 시에도 정렬 유지

## Verification

- Command: 데스크탑 dev 실행 후 5개 카드 헤더 스크린샷 비교 + DevTools 로 아이콘/텍스트 bounding box center y 좌표 비교

## Notes

- order_305 (폰트 2px 축소), order_308 (컨트롤 사이즈 축소) 와 같은 영역
  styles.css 손대므로 머지 순서 주의
- shadcn 스타일 유지 — 임의의 margin/padding 추가보다 flex align 정렬 우선
