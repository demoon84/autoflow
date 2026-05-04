---
kind: source_summary
slug: prd-121-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-121-spec-handoff.md"
entities:
  - "project_121"
  - "metrics-project.sh"
  - "Wiki AI"
  - "planner"
  - "project_121"
  - "metrics-project.sh"
  - "Wiki AI"
  - "planner"
concepts:
  - "텔레메트리 레이어"
  - "구조화 이벤트 jsonl"
  - ".autoflow/telemetry/runs.jsonl"
  - ".autoflow/telemetry/failures.jsonl"
  - "flock"
  - "record"
  - "query"
  - "compact"
  - "self-test"
  - "텔레메트리 레이어"
  - "구조화 이벤트 jsonl"
  - ".autoflow/telemetry/runs.jsonl"
  - ".autoflow/telemetry/failures.jsonl"
  - "flock"
  - "record"
  - "query"
  - "compact"
  - "self-test"
---

# 텔레메트리 레이어 도입 - 틱별 구조화 이벤트 jsonl 추출

## One-liner

러너 틱마다 raw 로그를 한 줄짜리 구조화 이벤트로 추출하여 `.autoflow/telemetry/runs.jsonl`에 추가하고, 실패 이벤트는 `failures.jsonl`에도 동시 기록합니다.

## Summary

644MB 누적 로그 분석 결과 raw `_stdout.log`, `_stderr.log`를 매번 스캔하는 metrics-project.sh가 4분 36초까지 늘어났고, Wiki AI도 raw 로그를 구조화 신호로 쓸 수 없었습니다. 본 PRD-B는 틱별 1줄 jsonl 이벤트로 추출하여 raw 로그 스캔 없이 동일 신호(토큰 사용량, 실패 패턴, 틱 시간)를 빠르게 얻게 합니다. PRD-A는 보존/정리, PRD-C는 Wiki AI 입력 확장, PRD-D는 metrics-project.sh를 텔레메트리 기반으로 재작성합니다. PRD-B는 데이터 생산자입니다.

## Entities

- Wiki AI (AI): 텔레메트리 데이터를 활용할 AI (PRD-C)
- metrics-project.sh (스크립트): raw 로그를 스캔하는 레거시 스크립트, PRD-D에서 재작성될 예정
- planner (AI): prd_121의 AI 역할
- project_121 (프로젝트): 이 PRD와 관련된 프로젝트 ID

## Concepts

- compact: telemetry-project.sh의 서브커맨드: 오래된 이벤트 압축 및 보관
- flock: jsonl 파일에 원자적으로 추가하기 위한 메커니즘
- query: telemetry-project.sh의 서브커맨드: 이벤트 조회
- record: telemetry-project.sh의 서브커맨드: 이벤트 기록
- self-test: telemetry-project.sh의 서브커맨드: 기능 자체 테스트
- .autoflow/telemetry/failures.jsonl: 실패한 구조화 이벤트가 저장되는 파일
- .autoflow/telemetry/runs.jsonl: 모든 구조화 이벤트가 저장되는 파일
- 구조화 이벤트 jsonl: 새로운 이벤트 데이터 형식
- 텔레메트리 레이어: 이 PRD에서 도입하는 핵심 개념

## Source

- `wiki-raw/prd-121-spec-handoff.md`
