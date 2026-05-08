---
kind: learning
slug: cross-verification-root-cause-tracking-20260504
title: "Cross-verification Root Cause Tracking for Token Budget False Positives"
created: 2026-05-08T04:09:00Z
updated: 2026-05-08T04:09:00Z
pattern_type: blocked_recovery
applies_to: metrics / monitoring / false-positive
skill_extract_candidate: true
tags:
  - learning
  - blocked-recovery
  - metrics
  - monitoring
  - false-positive
---

# Cross-verification Root Cause Tracking for Token Budget False Positives

## 발견 배경

2026-05-04 monitoring 세션에서 worker runner 의 `last_result`가 반복적으로 `token_budget_exceeded`로 기록되었다. 단일 state 값만 보면 token quota 초과처럼 보였지만, 같은 기간 `token-cache` 갱신 중단과 telemetry 집계 이상이 함께 관찰되어 단일 source 신호를 그대로 믿기 어려웠다.

이 이슈는 `order_169`에서 데이터로 확정되었고, 이후 `prd_181` / `tickets_180`에서 telemetry token usage sanity correction 으로 구현 복구되었다. `order_146`의 Hermes self-learning 방향과 `order_172` / `prd_185`의 self-monitoring 설계는 이런 추적 패턴을 재사용 가능한 학습 자료로 남겨야 한다는 배경을 제공한다.

## Cross-verification 단계

1. 먼저 runner state 의 `token_budget_exceeded`를 증상으로만 취급하고, root cause 로 확정하지 않는다.
2. budget 정책의 기준값을 확인한다. 당시 daily quota 는 100,000,000 tokens 였다.
3. `telemetry-project.sh token-usage`로 같은 runner 와 시간 window 의 token usage 를 확인한다.
4. 독립 source 인 `.autoflow/metrics/token-cache.tsv`를 집계해 telemetry 결과와 단위를 비교한다.
5. 두 source 의 차이가 정상 변동 범위를 넘으면 source freshness, 단위 mismatch, 단일 corrupt row, window filter 누락을 분리해 의심한다.
6. false positive 로 확정되면 runner 를 멈추는 대신 budget preflight 가 hard block 하지 않도록 회복 티켓을 발행한다.

## 구체 데이터

`order_169`의 cross-verification 에서 telemetry 는 worker 24h 사용량을 `86,004,270,902`로 보고했다. 이는 86B tokens 수준이며 daily quota 100M 의 약 860배다.

같은 기간 `token-cache` 집계는 `582K` 수준이었다. 두 source 는 약 `86,000`배 차이가 났고, worker 호출당 정상 범위를 고려하면 telemetry 값은 물리적으로 불가능한 단위 mismatch 또는 corrupt row 로 판단됐다.

핵심 비교:

| Source | 관찰값 | 판단 |
| --- | --- | --- |
| runner state | `token_budget_exceeded` | 증상. 단독으로 root cause 확정 금지 |
| telemetry | `86,004,270,902` / 86B | 비현실적 초과값 |
| token-cache | `582K` | stale 가능성은 있지만 정상 단위 |
| source ratio | `86,000`x | false positive 의심을 확정할 만큼 큰 차이 |

## Root Cause

root cause 는 실제 worker 사용량 폭증이 아니라 telemetry token usage source 안의 비현실적인 token row 와 단위 처리 문제였다. `prd_181`은 `telemetry-project.sh token-usage`가 불가능한 단일 row 를 그대로 합산하지 않도록 하고, `run-role.sh` 계열 token extraction 이 board/wiki snippet, fingerprint, stdout byte length 를 token count 로 오인하지 않도록 보강했다.

따라서 이 사건의 핵심은 "budget 정책이 틀렸다"가 아니라 "budget 정책이 신뢰 불가능한 telemetry 집계를 hard block source 로 소비했다"는 점이다.

## 회복 정책

- `token_budget_exceeded` 같은 resource guard 결과는 최신성과 단위가 검증된 source 에서만 hard block 으로 사용한다.
- telemetry total 이 quota 대비 물리적으로 불가능한 수준이면 budget 초과가 아니라 telemetry sanity warning 또는 skip evidence 로 남긴다.
- 운영 `.autoflow/telemetry/runs.jsonl`, `.autoflow/metrics/token-cache.tsv`, budget policy 파일을 직접 rewrite 하지 않는다. 복구는 parser, sanity check, smoke fixture 에서 처리한다.
- false positive 로 worker 가 stuck 되면 `blocked_recovery` 패턴으로 분류하고, 사용자에게 restart 나 수동 삭제를 요구하기 전에 source A/B cross-verification 을 수행한다.
- 완료 티켓 `tickets_180`처럼 worktree 와 PROJECT_ROOT 검증 모두에서 sanitized token usage 가 100M 미만임을 확인한 뒤 pass 로 처리한다.

## 일반화 패턴

단일 monitoring source 가 critical 신호를 낼 때는 즉시 action 을 확정하지 말고, 다음 절차를 반복 가능한 기본값으로 둔다.

1. state label 은 symptom 으로 기록한다.
2. 같은 현상을 다른 저장소 계층에서 확인한다: runner state, telemetry, metrics cache, raw log, policy file.
3. source 간 ratio 를 계산한다. 10x 이상이면 stale/window 문제를 의심하고, 100x 이상이면 단위 mismatch 또는 corrupt row 를 우선 의심한다.
4. root cause 가 source mismatch 로 좁혀지면 product data 삭제보다 parser/sanity guard 와 fixture test 를 우선한다.
5. 회복 후에는 `order_169`, `prd_181`, `order_172`, `prd_185`처럼 관련 order/PRD chain 을 남겨 이후 monitor/self-learning agent 가 같은 pattern 을 검색할 수 있게 한다.

## Source Evidence

- `order_146`: Hermes self-learning loop 와 learnings/skill source 보존 필요성.
- `order_169`: `token_budget_exceeded` false positive 를 telemetry 86B vs `token-cache` 582K 비교로 확정한 원본 evidence.
- `order_172`: 1.5시간 monitoring 세션의 cross-verification 절차를 self-monitoring agent 요구사항으로 일반화.
- `prd_181`: impossible telemetry token usage correction 의 구현 범위.
- `prd_185`: monitor runner 가 단일 source false positive 를 피하고 source A/B 값과 비율을 order evidence 로 기록해야 한다는 설계 맥락.
