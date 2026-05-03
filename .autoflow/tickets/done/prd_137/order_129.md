---
title: 통계 페이지 가독성/이해도 개선 (정보 위계, 용어, 단위, 차트 의미 정비)
created_at: 2026-05-03
source: claude-code /order
---

## Request

데스크톱 앱 "통계" 페이지 (사이드바 → 통계, `visibleSettingsSection === "snapshot"`) 가 가독성도 떨어지고 무슨 내용인지 이해하기 어려움. 검토 결과 정보 위계 / 용어 / 단위 / 차트 의미 정비가 필요. 사용자가 한눈에 "지금 보드가 잘 돌아가고 있는지 / 무엇이 막혔는지" 파악할 수 있는 형태로 재설계해줘.

## 검토 결과 (요약)

**현재 구성** (`apps/desktop/src/renderer/main.tsx:3569-3759` `ReportingDashboard`):

상단 metric grid 7개 카드:
1. 완료 티켓 (count + 완료율 %)
2. 검증 실행 (verifier total + 통과/실패)
3. 완료 커밋 (commit count + 변경 파일 수)
4. 인수인계 (handoff count + PRD 수)
5. AI 산출물 (artifact total + 정상/주의)
6. 변경 코드량 (volume줄 + +/- 파일 수)
7. 토큰 사용량 (token count + 실행 로그 수)

하단 chart grid 6개:
1. 티켓 처리량 — bar (대기/실행/검증/완료/반려)
2. 검증 결과 — donut (통과/실패)
3. 완료 추세 — line
4. 코드 영향 — bar (변경 파일/추가 라인/삭제 라인)
5. AI 사용량 — bar (사용 토큰/AI 산출물)
6. AI 가동 — bar (실행 중/대기/중지/막힘)

**가독성/이해도 문제:**

1. **위젯이 13개로 과다** — 한 화면에 too much. 핵심 KPI 가 부가 지표에 묻힘.
2. **용어 모호:**
   - "인수인계" (handoff) — 개발자 내부 용어. 사람이 즉시 이해 어려움.
   - "AI 산출물" (artifact) — "정상/주의" 가 어떤 기준인지 불명.
   - "완료 커밋" — 모든 git commit 인지 Autoflow 가 만든 commit 인지 불명확.
   - "검증 실행" vs "검증 결과" — 카드와 차트가 같은 영역을 중복 표현.
3. **단위/포맷 비일관:**
   - 카드마다 단위 표기 다름 (`개`, `줄`, `개 파일`, `개 실행 로그 기준`, 단위 없음 등).
   - 큰 숫자는 어디는 `formatCount` 어디는 `formatCompactCount` (1.5K vs 1,535 등).
4. **차트 의미가 깨진 곳:**
   - **"AI 사용량"** 차트가 `[사용 토큰, AI 산출물]` 두 개 — **단위가 다른 값** (token 수 vs 결과물 개수) 을 같은 bar 로 비교 → 의미 부재.
   - **"코드 영향"** 차트도 `[변경 파일, 추가 라인, 삭제 라인]` — 파일 수와 라인 수가 다른 단위인데 같은 bar 길이로 표현됨 → 시각적 오해 유발.
5. **시각적 위계 없음** — 7개 카드 톤 비슷, 핵심 KPI(완료/통과율/막힘) 가 한눈에 안 들어옴.
6. **시간 컨텍스트 부재** — 모든 숫자가 "현재 스냅샷"인지 "전체 누적"인지 라벨 없음. trend 표시 거의 없음 (완료 추세만).
7. **데이터 source 정합성 부족 (관련 PRD-129):**
   - 토큰 사용량 카드/차트는 path B(`telemetry-runs.jsonl`) source 가 거의 비어 있어 항상 낮은 값 → 카드/차트가 사용자에게 0 또는 비현실적인 값 노출. PRD-129 후행 의존.
8. **빈 상태 안내 부족** — 데이터가 없을 때 "어떤 액션이 이 지표를 채우는지" 도움말이 거의 없음.

## Scope (hint) — 개선안 후보

방향성 후보. Plan AI 가 사용자 의도와 합쳐 디자인 결정.

### A. 정보 위계 재설계 (필수)
- **상단 핵심 KPI 4개 큰 카드** 로 압축:
  - 완료 티켓 (+ 완료율, mini sparkline trend)
  - 검증 통과율 (% + 통과/실패 mini chart)
  - 막힌 항목 합계 (반려 + blocked runner + needs_user) — 즉각 주의 필요 신호
  - 누적 토큰 사용량 (compact format + mini trend) ← PRD-129 정합 후 의미 있음
- 나머지는 하위 작은 카드 그룹 / accordion / "더 보기" 패널로 분리.

### B. 용어 정비
- "인수인계" → "PRD 처리" 또는 "전달된 요청" 같은 직관 표현.
- "AI 산출물" → "러너 결과 상태" + 정상/주의 정의를 hover tooltip 으로 노출.
- "완료 커밋" → "Autoflow 커밋" (`[PRD_NNN][ticket_NNN]` 형식 commit 만 카운트한다는 정의 명시).
- "검증 실행" 카드 또는 "검증 결과" 차트 중 하나로 통합.

### C. 단위/포맷 일관화
- 1,000 이상 숫자는 모두 `formatCompactCount` (`1.5K`, `1.2M`) 로 통일. hover 시 정확값 tooltip.
- 단위 기호 명시: `개`, `줄`, `토큰`, `%`, `커밋`. 모든 카드 detail 라인에 단위 노출.

### D. 의미 없는 차트 정리
- **"AI 사용량"** bar (토큰 + 산출물) → 두 개를 분리:
  - 토큰 사용량은 별도 단독 mini line/sparkline 카드 (시간대별 누적).
  - AI 산출물은 별도 정상/주의 비율 표시 (donut 또는 mini bar).
- **"코드 영향"** bar (파일 + 라인) → 분리:
  - 변경 파일 수는 카드 metric (단일 숫자).
  - 추가/삭제 라인은 stacked bar 또는 가로 split bar (`+N -M` 시각).

### E. 시간 컨텍스트 강화
- 각 카드 우상단에 "이번 7일" / "전체" 등 기간 라벨 (메트릭 source 가 누적 기준이면 그대로 표시).
- 가능한 곳에 전 기간 대비 변화율 화살표 (↑12% / ↓3%) — `metricsFiles` 의 이력 활용.
- 카드 안 sparkline (작은 line chart 7~14 포인트) 으로 추세 직관 노출.

### F. 빈 상태 강화
- 데이터 0 일 때 "다음 액션이 이 지표를 채웁니다" 한 줄 가이드 (예: "검증 통과율은 verifier 가 완료 티켓을 처리한 뒤 채워집니다").

### G. 우선순위 시각 강화
- "막힘" 또는 "검증 실패" 같은 주의 지표는 톤(빨강 / 노랑) 강하게.
- 정상 지표(완료, 통과) 는 차분한 그린/블루.

### H. 부가 정리
- 차트 6개 → 3~4개로 압축 + 핵심 KPI 카드 4개 + 나머지는 보조 카드로 분리.
- aria-label / 키보드 navigation 회귀 확인.

## Allowed Paths (hint)

- `apps/desktop/src/renderer/main.tsx` (`ReportingDashboard`, `ReportMetricCard`, `ReportChartCard`, `ReportBarBreakdown`, `ReportDonutChart`, `CompletionTrend`, `formatCount`/`formatCompactCount`/`formatSignedCount` 사용부)
- `apps/desktop/src/renderer/styles.css` (`.report-dashboard`, `.report-metric-grid`, `.report-chart-grid`, `.report-metric-card-secondary` 등 통계 페이지 전용 클래스)

## Verification (hint)

- `npm run desktop:check` 통과.
- 데스크톱 미리보기 "통계" 페이지에서:
  - 핵심 KPI 4개 카드가 상단에 시각적으로 부각되는지 확인.
  - 단위 표기가 카드/차트 전체에서 일관되게 노출되는지 (개/줄/토큰/% 등).
  - 다른 단위를 같은 bar 로 묶는 차트(과거 "AI 사용량", "코드 영향") 가 분리/재구성되어 시각적 오해 없는지 확인.
  - 데이터 0 인 카드에 fallback 안내 문구가 노출되는지.
  - 마우스 hover 시 정확한 숫자 / 정의 tooltip 동작 확인.
  - 화면 너비를 좁혀도 카드/차트가 깨지지 않는지 (반응형 회귀).
- 회귀:
  - 통계 페이지 첫 진입 시 metrics fetch / 스냅샷 저장(`writeMetricsSnapshot`) 등 기존 동작에 영향 없는지.
  - 기존 metrics_snapshot 파일 형식과 호환 (필드 추가 없이 표시 로직만 변경 권장).
- 후행 정합:
  - PRD-129 (토큰 사용량 집계 정확성) 머지된 후 통계 페이지의 토큰 카드/차트가 의미 있는 값을 표시하는지 함께 확인.
- 사용자 검수:
  - 새 화면을 처음 보는 사람이 "막힘이 있나? 통과율이 낮은가?" 같은 질문에 1~2초 안에 답할 수 있는지 (휴리스틱).

## Notes

- **연관:** PRD-129 (토큰 사용량 집계). 토큰 데이터가 정상화되어야 통계 페이지의 토큰 카드/차트가 의미 있음.
- **순서:** 본 order 는 표현/구조 개선이 본질. PRD-129 와 병렬 진행 가능 (UI 수정이 데이터 수정과 독립).
- **주의:** metrics 필드 자체는 추가/제거 없이 표시 로직 위주로 정리하는 게 source-of-truth(`packages/cli/metrics-project.sh`) 와의 결합도를 낮춤. 새 필드 필요 시 별도 PRD 분리 권장.
