---
kind: source_summary
slug: prd-122-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-122-spec-handoff.md"
entities:
  - "project_122"
  - "prd_122"
  - "planner"
  - "wiki summarize-telemetry"
  - "packages/cli/wiki-project.sh"
  - ".autoflow/agents/wiki-maintainer-agent.md"
  - "operations/runner-health.md"
  - "operations/runner-timing.md"
  - "agents/prompt-evolution.md"
concepts:
  - "telemetry jsonl"
  - "Wiki AI"
  - "debounce"
  - "frontmatter"
  - "PRD-B"
  - "PRD-A"
  - "PRD-D"
---

# Wiki AI 합성 입력으로 telemetry jsonl 사용

## One-liner

Wiki AI가 텔레메트리 jsonl을 입력으로 받아 러너 상태, 타이밍, 프롬프트 진화 등 정량 정보를 담은 위키 페이지를 자동 갱신합니다.

## Summary

이 PRD는 Wiki AI가 PRD-B에 의해 생성된 `.autoflow/telemetry/runs.jsonl` 및 `failures.jsonl` 파일을 합성 입력으로 사용하도록 하는 것을 목표로 합니다. 새로운 `wiki summarize-telemetry` 서브커맨드가 이 jsonl 파일을 집계하여 표준 위키 페이지 3개(runner-health, runner-timing, prompt-evolution)를 자동 갱신합니다. Wiki AI의 프로시저에는 이 명령을 매 틱마다 호출하는 단계가 추가되어, Wiki AI가 원본 로그를 스캔할 필요 없이 정량적 데이터를 인용하는 합성을 생성할 수 있게 됩니다.

## Entities

- agents/prompt-evolution.md (위키 페이지 슬러그): 자동 생성될 프롬프트 진화 위키 페이지
- operations/runner-health.md (위키 페이지 슬러그): 자동 생성될 러너 상태 위키 페이지
- operations/runner-timing.md (위키 페이지 슬러그): 자동 생성될 러너 타이밍 위키 페이지
- packages/cli/wiki-project.sh (모듈 경로): 새로운 서브커맨드가 추가될 스크립트 경로
- planner (AI): 프로젝트에 할당된 AI 유형
- prd_122 (프로젝트 ID): 이 PRD 자체의 ID
- project_122 (프로젝트): PRD의 대상 프로젝트 ID
- wiki summarize-telemetry (CLI 서브커맨드): 텔레메트리 데이터를 요약하여 위키 페이지를 생성/갱신하는 새로운 CLI 명령
- .autoflow/agents/wiki-maintainer-agent.md (에이전트 설정): Wiki AI의 프로시저가 갱신될 파일 경로

## Concepts

- PRD-A: 리텐션을 다루는 관련 PRD
- PRD-B: 텔레메트리 데이터 생성을 담당하는 선행 PRD
- PRD-D: metrics-project 재작성을 다루는 관련 PRD
- Wiki AI: 텔레메트리 데이터를 기반으로 위키 페이지를 자동 갱신하는 AI 에이전트
- debounce: Wiki AI 호출을 제어하는 메커니즘으로, 텔레메트리 동기화 호출에도 적용됨
- frontmatter: 자동 생성된 위키 페이지의 첫 줄에 포함될 메타데이터
- telemetry jsonl: Wiki AI의 합성 입력으로 사용될 텔레메트리 데이터 형식 (runs.jsonl, failures.jsonl)

## Source

- `wiki-raw/prd-122-spec-handoff.md`
