# Autoflow Order

## Order

- Title: 변경코드량 / 토큰 사용량 집계 검증 및 보정
- Priority: normal
- Status: ready
- Change Type: code

## Request

변경코드량, 토큰 사용량 집계 점검

## Context

대시보드의 두 핵심 지표가 신뢰할 수 없는 값을 보임:

1. **토큰 사용량**:
   - 최근 telemetry: 워커 한 tick 에 `token_input=2,508,627` (stdout 100KB) → 비현실적
   - codex `--json` 의 `turn.completed.usage` 만 신뢰해야 하는데, awk 가 임베드된
     JSON (item.completed aggregated_output 안의 자식 JSON) 까지 합산할 가능성
   - claude stream-json intermediate skip 가드는 추가됐지만, 과거 누적 telemetry rows 가
     남아 있어 누적값(약 4천만)이 baseline 으로 굳어 있음

2. **변경코드량 (codeVolumeCount, codeInsertionsCount, codeDeletionsCount)**:
   - `metrics-project.sh` 의 git diff 전수 스캔 / 증분 캐시 흐름 (PRD 123 참조)
   - 통계 카드의 "변경 파일 / 추가-삭제 라인" 수치가 실제 작업량과 일치하는지 확인 필요
   - dirty state 변경분 / 비-merge commit / autoflow 외부 commit 까지 섞여 들어가는지 검증

## Allowed Paths

- packages/cli/run-role.sh
- runtime/board-scripts/run-role.sh
- packages/cli/metrics-project.sh
- packages/cli/telemetry-project.sh
- apps/desktop/src/main.js
- apps/desktop/src/renderer/main.tsx
- .autoflow/metrics/

## Done When

- [ ] 토큰 집계 파이프라인 (`telemetry_extract_token_components_from_logs` → `metrics-project.sh count_autoflow_token_metrics` → `readRunnerTokenUsage` → `tokenUsageCount`) 의 단계별 입력/출력을 한 tick 으로 추적해 어디서 부풀려지는지 (또는 부풀려지지 않는지) 증거 정리
- [ ] codex `--json` item.completed 안의 임베디드 JSON / claude stream-json intermediate 가 awk 단계에서 확실히 skip 되는지 fixture 로 회귀 테스트 추가 또는 수동 검증 결과 기록
- [ ] 누적 토큰 baseline 이 과거 부풀려진 row 로 인한 distortion 을 어떻게 처리할지 (telemetry/runs.jsonl 절단 / cleanup CLI / read-side window) 결정해 1개 안 적용
- [ ] 변경코드량 (`codeVolumeCount`, `codeInsertionsCount`, `codeDeletionsCount`, `codeFilesChangedCount`) 가 commit 과 1:1 매칭되는지 git log + metrics 비교 1회 수행 + 차이 원인 정리
- [ ] dirty state 변경분이 실수로 metrics 에 반영되지 않는지, 또는 반영돼야 하는데 누락되지 않는지 정책 명시
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 비슷한 과거 작업:
  - prd_123 — metrics 일일 스냅샷 키 + 산출 소스 transition (raw scan → telemetry + 증분 git)
  - prd_129 — 토큰 사용량 두 표시 경로 (per-runner / 총량) 일치성 검증
- 이번 PRD 는 위 두 PRD 의 follow-up 으로, 실제 데이터에 부풀려진 값이 들어왔던
  사례를 가지고 awk/parser 가드 + read-side window 정책을 다시 한번 검증한다.
- 회귀 가드:
  - codex turn.completed 만 신뢰 (이미 적용)
  - claude result event 만 신뢰 (이미 적용)
  - gemini usage marker (PRD 126) 보존
- 후속 후보 (별도 PRD):
  - telemetry/runs.jsonl 의 부풀려진 과거 row 를 read-side window (`AUTOFLOW_TOKEN_BUDGET_MAX_DATA_AGE_SECONDS`) 로 잘라낼지, 영구 cleanup CLI 를 만들지 결정
  - 변경코드량 ↔ commit count 검증 자동화 (`autoflow doctor` 확장)
