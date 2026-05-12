# Autoflow Order

## Order

- Title: 데스크탑 runner 카드 status 뱃지/드롭다운/저장 버튼 높이·간격 폰트에 맞춰 축소
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 runner 카드 상단 영역(`실행 중` / `대기` 같은 상태 뱃지, agent /
model / reasoning 드롭다운 3개 + `저장` 버튼)이 현재 폰트 크기 대비 컨트롤
높이와 좌우/상하 간격이 시각적으로 과하게 큼. order_305 에서 폰트는 2px
줄였지만 컨테이너 높이/패딩은 그대로라 비율이 안 맞음. 폰트에 맞춰 전체
컨트롤 사이즈/간격을 일관되게 축소.

해야 할 것:
1. 상태 뱃지(`ai-progress-status-badge`, `ai-progress-stage-badge`, `ai-progress-active-ticket` 등)의 height/padding/font-size 토큰을 ~1.5~2단계 축소
2. agent / model / reasoning Select 트리거(`runner-select`, `runner-agent-select`)의 height (현 ~32-36px) → ~26-28px, 좌우 padding 도 동일하게 축소
3. `저장` 버튼(`runner-save-button`)도 같은 높이로 맞춤
4. 컨트롤 사이 horizontal gap (현 ~10-12px) → ~6-8px
5. 카드 상단 영역의 상하 margin/gap 도 같이 컴팩트화
6. 다크/라이트 양 테마, 모든 5개 runner 카드 (planner / worker / worker-2 / wiki / verifier) 에서 일관 적용 확인

## Allowed Paths

- apps/desktop/src/renderer/styles.css
- apps/desktop/src/components/ui/

## Done When

- [ ] 상태 뱃지 height 가 본문 폰트(12px)의 약 1.8배 이내
- [ ] 드롭다운 트리거 height 가 28px 이하
- [ ] 저장 버튼 height 가 드롭다운과 동일 (정렬)
- [ ] 컨트롤 사이 horizontal gap 8px 이하
- [ ] 글자 잘림/번짐 없음, 클릭 영역 16px+ 유지(접근성)
- [ ] runner 카드 5개 모두에서 시각적 비율 일관

## Verification

- Command: 데스크탑 dev 실행 후 DevTools 로 컨트롤 높이 측정 + 5개 runner 카드 스크린샷 비교

## Notes

- order_305 (폰트 2px 축소) 와 후속 — 폰트만 줄어 컨테이너 비율 깨진 걸 보정
- shadcn/lucide 컴포넌트 토큰(`--font-size-control`, `--font-size-control-sm` 등) 활용해서 한 곳 조정으로 일관 반영
- 너무 좁히면 클릭 영역/접근성 깨짐 — 최소 26px 라인 유지
