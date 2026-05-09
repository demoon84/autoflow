---
name: "desktop-response-delay-severity-labels"
description: "Use when desktop response delay severity labels"
version: "1.0"
author: "autoflow-agent"
license: "CC-BY-4.0"
pattern_type: ticket_completion
applies_to:
  module: "apps/desktop/src/renderer/main.tsx"
  keywords:
    - "desktop"
    - "response"
    - "delay"
    - "severity"
    - "labels"
    - "apps"
    - "src"
    - "renderer"
    - "main"
    - "tsx"
    - "styles"
    - "css"
pinned: false
created_from:
  prd: "prd_188"
  ticket: "tickets_187"
created_at: "2026-05-06T01:09:47Z"
metadata:
  hermes:
    tags: []
    related_skills: []
---

# desktop response delay severity labels

## Trigger

- Reuse when: desktop response delay severity labels
- Source ticket: `tickets/done/prd_188/tickets_187.md`

## Recommended Procedure

- `runnerHeartbeatStale` 또는 후속 helper 는 `lastEventAt` 과 `lastAdapterChunkAt` 중 최신 시각을 기준으로 단계 정보를 계산하고, `activeStage="adapter_running"` 인 runner 가 최근 heartbeat/chunk 를 내는 동안 destructive `응답 지연` 라벨을 표시하지 않는다.
- 기본 설정에서 runner 의 최신 freshness 가 600초 미만이면 destructive `응답 지연` 라벨이 표시되지 않는다.
- `AUTOFLOW_HEARTBEAT_STALE_THRESHOLD_SECONDS=300` 또는 renderer 가 받는 동등 설정을 적용하면 `응답 지연 의심` 단계가 약 300초 기준으로 시작되는 것을 코드 레벨에서 확인할 수 있다.
- 단계 라벨은 최소 세 가지 의미를 구분한다: `LLM 응답 대기 중`, `응답 지연 의심`, `멈춤 가능`.
- `LLM 응답 대기 중` 은 정보성/중립 톤, `응답 지연 의심` 은 warning 톤, `멈춤 가능` 은 destructive 톤으로 표시되고 CSS class 가 서로 분리되어 있다.

## Pitfalls

- 브라우저/데스크톱 수동 시각 확인은 별도로 수행하지 않았고, 이번 판정은 코드 검토와 `npm run desktop:check` 통과를 근거로 한다.

## Verification Pattern

- Command: ````npm run desktop:check````

## Source Evidence

- Ticket: `tickets/done/prd_188/tickets_187.md`
- PRD: `tickets/done/prd_188/prd_188.md`
- Verification: `tickets/done/prd_188/verify_187.md`
- Result summary: 데스크톱 응답 지연 라벨을 heartbeat/chunk freshness 기반 단계형 severity로 분리
