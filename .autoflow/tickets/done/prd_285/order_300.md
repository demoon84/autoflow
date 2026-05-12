# Autoflow Order

## Order

- Title: 도착지 시각화 — 데스크탑 UI 에 "도착까지 남은 거리" 게이지
- Priority: normal
- Status: ready
- Change Type: code

## Request

현재 desktop UI 는 PRD 단위 progress 만 표시. 자율주행 관점에선 "목표가 도착
가능한가" 를 솔직히 보여주는 게 더 중요.

해야 할 것:
1. apps/desktop/src/renderer/ 에 "ArrivalGauge" 컴포넌트 신규 — shadcn/lucide 스타일
2. 표시 지표:
   - 동일 retry_fingerprint 누적 횟수 (3회 임계 색상 변경)
   - 최근 24h adapter timeout 비율
   - 평균 ticket pass 시간 추세
   - "예상 도착까지 N 시도" — 위 지표로 추정 (수식은 단순 가중합으로 시작)
3. 좌상단 또는 board summary 영역에 게이지 배치
4. 게이지 hover 시 상세 지표 popover (shadcn)

## Allowed Paths

- apps/desktop/src/renderer/components/ArrivalGauge.tsx
- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/main.js

## Done When

- [ ] ArrivalGauge 컴포넌트가 board view 에 표시
- [ ] retry_fingerprint 누적 3회 fixture 에서 색상 변경 (warning)
- [ ] hover 시 상세 지표 popover 표시
- [ ] 데이터 소스: telemetry + state.db (실시간 5초 갱신)

## Verification

- Command: 데스크탑 앱 실행 후 fixture telemetry 주입, 게이지 렌더링 확인 (스크린샷)

## Notes

- 자율주행 UX 의 솔직함 — "갈 수 있는지" 사용자에게 노출
- order_299(meta-runner) 의 진단 결과를 시각화하면 시너지
- 수식 정밀화는 후속 ticket
