# Autoflow Order

## Order

- Title: 데스크탑 runner 카드 상단 폰트 2px 축소 (status 뱃지 + 드롭다운 행)
- Priority: normal
- Status: ready
- Change Type: code

## Request

데스크탑 dashboard 의 runner 카드 (Planner / Worker / Worker-2 / LLM Wiki / Verifier
placeholder) 상단에 표시되는 status 뱃지(`실행 중`, `대기`, `구현`, `Todo-301`,
`LLM 응답 대기`, `planner_no_actionable_input` 등) 와 그 아래 드롭다운 행
(`claude`, `Sonnet 4.6`, `보통`, `저장` 버튼) 의 폰트가 카드 폭 대비 커 보임.
일관되게 2px 줄여서 가독성과 비율 정돈.

해야 할 것:
1. status pill / progress badge 영역에 적용되는 폰트 토큰을 식별
   (`--font-size-meta` 10.5px 또는 `--font-size-control-sm` 11px 후보)
2. 해당 영역에만 적용되도록 새 토큰 `--font-size-runner-card-meta` 도입하거나,
   기존 토큰의 사용처를 좁혀 runner 카드 한정으로 2px 감소
3. 전역 영향이 없도록 다른 페이지(티켓, Wiki, 통계)의 동일 토큰 사용처는
   영향 받지 않게 분리
4. 다크/라이트 테마 모두에서 가독성 확인 (font-weight 보정 필요 시 함께)

## Allowed Paths

- apps/desktop/src/renderer/styles.css
- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] runner 카드의 status 뱃지 폰트가 기존 대비 정확히 2px 작음
- [ ] runner 카드의 드롭다운 (agent/model/reasoning select) + `저장` 버튼 폰트가 2px 작음
- [ ] 티켓 페이지, Wiki 페이지, 통계 페이지의 폰트는 영향 없음 (회귀)
- [ ] 다크/라이트 테마 모두에서 글자 잘림/번짐 없음 (스크린샷 검증)

## Verification

- Command: 데스크탑 dev 실행 후 runner 카드 상단 측정 (DevTools 또는 스크린샷)

## Notes

- 토큰 기반 시스템(`--font-size-*`)을 유지해서 한 곳에서 조정 가능하게
- 2px 가 너무 작으면 1px 부터 점진 적용 검토 (Done When 의 2px 는 보수적 상한)
