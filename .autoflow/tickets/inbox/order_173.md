---
title: 1.5h monitoring 세션 발견을 wiki/learnings 에 영구 기록 (root cause 추적 패턴 보존)
priority: normal
created_at: 2026-05-04T23:34Z
source: claude-code /order
---

## Request

claude-code 의 1.5시간 실시간 monitoring 세션 (2026-05-04T22:03 ~ 23:34Z) 에서 발견한 결정적 root cause 추적 패턴 (특히 token_budget false positive → telemetry 86B 단위 버그 확정) 을 `.autoflow/wiki/learnings/` 에 영구 기록. 동일 패턴 재발 시 빠른 해결 + skill 후보 (order_146).

## Background

본 monitoring 세션에서:
- 9건 critical/high order 발행 (162-171)
- 5건 자율 흐름에서 처리 (PRD-177~181 commit)
- **결정적 발견**: 사용자 질문 "워커 토큰 사용이 실제로 저게 맞아?" → cross-verification → 86B 단위 버그 root cause 확정

이 추적 패턴 (단일 source 의심 → cross-verification → root cause) 은:
- 단순 stale detection 보다 훨씬 강력
- 같은 패턴 재발 시 (다른 metrics, 다른 단위 mismatch 등) 즉시 회피 가능
- 향후 self-monitoring agent (order_172) 의 핵심 알고리즘

## Scope (hint)

### 1. wiki/learnings 신규 파일 작성
- Path: `.autoflow/wiki/learnings/cross-verification-root-cause-tracking-20260504.md`
- 본문 구조:
  - 발견 배경 (worker stuck cycle 패턴)
  - 단일 source 의심 → cross-verification 단계
  - 구체 데이터 (token-cache 582K vs telemetry 86B = 86,000배 차이)
  - root cause 식별 (단위 mismatch — bytes 를 tokens 로 합산)
  - 회복 정책 (Hot fix budget.toml 비활성)
  - 일반화 가능한 패턴 (다른 metrics false positive 의심 시 적용)

### 2. 추가 learnings 후보 (선택)
- `monitoring-tool-baseline-comparison-pattern.md` — 60s tick polling 으로 신호 검출하는 일반 패턴
- `runner-cycle-detection-via-last-result-repetition.md` — 같은 last_result N회 반복으로 stuck 검출

### 3. Hermes skill 후보 표시 (order_146 정합)
- 본 learnings 가 미래 skill 추출 source 로 사용되도록 frontmatter 에 marker:
  ```yaml
  ---
  pattern_type: blocked_recovery
  applies_to: metrics / monitoring / false-positive
  skill_extract_candidate: true
  ---
  ```

## Allowed Paths (hint)

- `.autoflow/wiki/learnings/cross-verification-root-cause-tracking-20260504.md` (신설)
- (선택) `.autoflow/wiki/learnings/monitoring-tool-baseline-comparison-pattern.md`
- (선택) `.autoflow/wiki/learnings/runner-cycle-detection-via-last-result-repetition.md`

## Verification (hint)

- 새 learnings 파일이 wiki/learnings/ 에 존재
- 본문 형식이 기존 learnings (manual-merge-recovery-20260427.md, ticket-overlap-no-op.md 등) 와 일관
- order_146 (Hermes self-learning) 도입 시 본 learnings 가 skill 추출 source 로 활용 가능

## Notes

- **연관:**
  - **order_146** (Hermes self-learning) — 본 learnings 가 skill 추출 source.
  - **order_172** (self-monitoring agent) — 본 learnings 의 cross-verification 패턴이 monitoring agent 의 핵심 알고리즘.
  - **order_169** (telemetry 86B 단위 버그) — 본 learnings 의 root cause 사례.
- **1원칙 정합:** 자율 흐름 영향 없음. 미래 회복 속도 향상.
- **wiki commit policy (order_164):** 본 파일 생성은 wiki/learnings/ (고가중치 5점) → 즉시 commit trigger 정상.
