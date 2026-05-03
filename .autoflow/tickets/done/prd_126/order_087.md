---
title: Wiki(gemini) 어댑터 토큰 사용량이 token-cache.tsv 에 0 으로 기록되는 계측 누락 수정
created_at: 2026-05-03
source: claude-code /order
---

## Request

`.autoflow/metrics/token-cache.tsv` 에서 Wiki AI runner 의 토큰 사용량이 항상 0 으로 기록되어 실제 호출이 발생해도 추적이 안 됨. 데스크톱 앱의 토큰 사용량 표시 / 누계 통계가 wiki 항목에서 부정확함. wiki 어댑터(gemini) 의 stdout 에 token usage 가 노출되도록 하거나, parser 가 gemini 형식을 인지하도록 수정해서 정확히 계측해줘.

## Context (관찰됨)

- `.autoflow/runners/state/wiki.state` 의 `agent=gemini`, `model=gemini-2.5-flash-lite`.
- 최근 28회 wiki tick 모두 `token-cache.tsv` 의 token 컬럼 = 0.
- 그러나 wiki stdout 일부에는 명백히 LLM 응답이 들어 있음 (예: `.autoflow/runners/logs/wiki_2026-05-03T07-53-15Z_stdout.log` 1153 byte 의 자연어 응답 — gemini-flash-lite 의 wiki lint 분석 결과).
- 즉 LLM 호출은 실제 발생하나 token 만 안 잡힘 → **계측 누락**.

## Root Cause (분석)

1. **gemini 호출에 token 출력 옵션 없음** — `packages/cli/run-role.sh:2138` 의 gemini 어댑터 명령:
   ```
   gemini --skip-trust --approval-mode yolo --prompt "$prompt_text" [--model ...]
   ```
   `--show-tokens` / `--verbose` / 동등한 token usage 출력 플래그가 없어서 stdout 에 응답 텍스트만 나옴.
2. **데스크톱 token parser 는 stdout marker 매칭 방식** — `apps/desktop/src/main.js:1402-1481` 의 `parseTokenUsageChunk` / `tokenUsageFromLine` 가 다음 marker 를 찾음:
   - `total_tokens`, `prompt_tokens`, `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `cached_input_tokens`, `reasoning_tokens`, `completion_tokens`, `tokens used`
   - 모두 Anthropic / OpenAI(claude / codex) 어댑터의 stdout 형식 기준. gemini 형식(`usageMetadata.promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`) 미포함이며, 그마저도 gemini CLI 가 stdout 에 출력하지 않음.
3. 결과적으로 desktop main.js 가 wiki stdout 에서 marker 를 찾지 못하고 `tokenCount = 0` 으로 token-cache.tsv 에 기록.

## Scope (hint)

해결 후보 (Plan AI 결정):

- **(a) gemini 어댑터 호출에 token usage 출력 옵션 추가**
  - `packages/cli/run-role.sh:2138` 의 gemini 명령에 `--show-tokens` (또는 gemini CLI 가 지원하는 동등 플래그) 추가.
  - 사전 확인 필요: `gemini --help` 출력에서 token usage 출력 옵션이 있는지. 있으면 (a) 가 가장 깔끔.
- **(b) gemini 호출 wrapper 로 token 계산을 외부 추가**
  - input prompt 와 output 응답의 byte 사이즈로 휴리스틱 추정 (gemini 토크나이저 비율 기준 약 4 byte/token), stdout 마지막에 표준 marker 형태로 append (`total_tokens=N`).
  - 정확도 떨어지지만 fallback 으로 가능.
- **(c) gemini API 직접 호출 모드 추가**
  - gemini CLI 대신 google-genai SDK 등으로 호출하면 응답에 `usageMetadata` 가 포함됨. 이를 stdout 표준 marker 형식으로 출력.
  - 변경 범위 큼.
- **데스크톱 parser 보강 (보조)**
  - `apps/desktop/src/main.js` 의 `tokenComponentMarkers` / `tokenTotalMarkers` 에 `prompt_token_count`, `candidates_token_count`, `total_token_count`, `usagemetadata` 등 gemini 형식 추가. (a)/(b)/(c) 어떤 경로든 gemini 측이 표준 marker 로 출력하면 굳이 보강 안 해도 되지만, 양쪽 다 인식할 수 있게 하면 안전.

권장: (a) → 안 되면 (b). (c) 는 큰 수정이라 우선순위 낮음.

## Allowed Paths (hint)

- `packages/cli/run-role.sh` (gemini 어댑터 호출 부 + 필요 시 다른 어댑터에도 일관되게 적용)
- (선택) `apps/desktop/src/main.js` (parser marker 보강)
- (선택) `packages/cli/cli-common.sh` (token 변환 유틸 위치)

## Verification (hint)

- `gemini --help` 로 token usage 출력 옵션 존재 여부 확인 후 (a) 채택 시:
  - `npm run desktop:check` 통과.
  - wiki runner 1~3 tick 발생시킨 후 `.autoflow/runners/logs/wiki_*_stdout.log` 에 `total_tokens` 등 marker 라인이 추가되는지 확인.
  - `.autoflow/metrics/token-cache.tsv` 의 새 wiki 행에서 token 컬럼이 0 이 아닌 값으로 기록되는지 확인.
  - 데스크톱 앱 AI 진행 현황 화면의 wiki 카드 토큰 사용량 숫자가 0 이 아닌 값으로 표시되는지 확인.
- (b) wrapper 채택 시:
  - 휴리스틱 추정값과 실제 gemini API usageMetadata (수동 호출로 비교) 의 오차가 ±20% 이내인지 sanity check.
- 회귀: claude / codex / opencode 어댑터의 기존 token 계측에 영향 없는지 확인.
- 추가 검증: planner / verifier / worker 같은 다른 runner 가 동일 모델로 변경되어도 같은 패턴이 적용되는지 (현재 wiki 만 gemini 사용).

## Notes

- **다른 runner 는 정상 계측 중**이라 wiki 만의 영향. 단, 향후 다른 runner 도 gemini 로 전환할 가능성 고려.
- 실제 wiki 호출당 token 양은 다음 추정 (cap 기반):
  - input ≤ 4K (ingest, 16KB cap) ~ 8K tokens (lint, 32KB cap)
  - output ≤ ~300 tokens (stdout 사이즈 기반)
- gemini-flash-lite 가격이 매우 낮아 절대값은 작지만, 측정 자체가 안 되면 운영 가시성이 떨어짐.
- `packages/cli/telemetry-project.sh` 의 `--token-input` / `--token-output` 옵션은 별도 telemetry-runs.jsonl 에 기록하는 경로이며 token-cache.tsv 와는 별개. 본 order 는 token-cache.tsv (desktop main.js parser) 경로 수정에 집중.
