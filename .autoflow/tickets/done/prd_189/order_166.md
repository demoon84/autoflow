---
title: codex stdout WARN 노이즈 폭증 — plugin / skills loader 가드 메시지 수천 줄
priority: normal
created_at: 2026-05-04T22:21Z
source: claude-code-monitoring
detected_during: realtime monitoring tick #5
---

## Request

worker (codex) 의 호출당 stdout 이 비정상적으로 비대 (1.5MB / 66K lines). 본문 분석 결과 대부분이 codex CLI 의 plugin/skills loader 의 WARN 메시지 반복. monitoring 도구 / 디스크 / token-cache 파싱 부담. 노이즈 필터링.

## 검출 증거

```
$ wc -l .autoflow/runners/logs/worker_2026-05-04T22-07-05Z_live_stdout.log
66320

$ tail -30 worker_*_live_stdout.log
2026-05-04T22:21:36.664018Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: prompt must be at most 128 characters path=/Users/demoon2016/.codex/.tmp/plugins/plugins/build-ios-apps/.codex-plugin/plugin.json
2026-05-04T22:21:36.666547Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: maximum of 3 prompts is supported path=/Users/demoon2016/.codex/.tmp/plugins/plugins/plugin-eval/.codex-plugin/plugin.json
2026-05-04T22:21:36.739742Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path must not contain '..'
2026-05-04T22:21:36.739756Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path must not contain '..'
... (수십~수백 회 반복)
```

→ codex CLI 가 호출당 plugin / skill 가드 WARN 을 매번 stdout 으로 출력. 정상 가드지만 매 호출마다 반복.

## 영향

1. **stdout 사이즈 비대** — 호출당 1~2MB. 24시간 운영 시 GB 단위 가능.
2. **token-cache 파싱 부담** — `apps/desktop/src/main.js:1422` `parseTokenUsageChunk` 가 큰 stdout 매번 파싱 → CPU 부담.
3. **monitoring 노이즈** — 진짜 의미 있는 codex 출력 (diff, plan, tool call) 이 WARN 사이에 묻힘.
4. **디스크 누적** — order_163 (live stdout leak) 와 합쳐 더 큰 부담.

## Suggested Fix

### Phase A — codex stderr 로 redirect (가장 간단)
- `packages/cli/run-role.sh:2350` 부근 codex 호출 시:
  ```bash
  # 현재
  > "$adapter_stdout" 2> "$adapter_stderr"
  
  # 변경: WARN 만 stderr 로 분리
  | grep -vE "^[0-9-]+T[0-9:.]+Z  WARN codex_core_(plugins|skills)" > "$adapter_stdout"
  ```
- 단, codex 가 직접 분리 출력 옵션 제공하면 그것 사용 (`--quiet-warnings` 또는 동등)

### Phase B — codex 환경 정리 (근본)
- `~/.codex/.tmp/plugins/` 의 비호환 plugin 제거 또는 비활성
- WARN 발생 자체를 줄임

### Phase C — Filter 정책 (운영 측)
- `packages/cli/run-role.sh` 의 stdout 처리 직전 정규식 필터:
  ```bash
  filter_codex_stdout() {
    grep -vE "^[0-9-]+T[0-9:.]+Z\s+WARN\s+codex_core_(plugins|skills)::" "$1"
  }
  ```
- token-cache 파싱 / monitoring 시 filtered 결과만 사용
- 원본은 별도 archive (선택)

## Allowed Paths

- `packages/cli/run-role.sh` (codex 호출 + filter)
- `apps/desktop/src/main.js` (token parsing 시 filter 적용)

## Verification

- Phase A 후: 호출당 stdout 사이즈 baseline 대비 50%+ 감소 확인.
- Phase B 후: WARN 발생 횟수 감소 확인.
- 회귀: 의미 있는 codex 출력 (diff, error) 정상 보존.

## Notes

- **연관:**
  - order_163 (live stdout leak) — stdout 사이즈 부담 합산.
  - order_162 (token-cache stale) — parsing 부담 영향.
  - PRD-126 (gemini token marker) — 다른 어댑터의 stdout 형식 변경과 일관성 검토.
- **위험:**
  - 너무 aggressive 한 filter 가 의미 있는 출력 누락. WARN 패턴만 정확히 매칭.
- **1원칙 정합:** 자율 흐름 영향 없음. 노이즈 필터링만.
