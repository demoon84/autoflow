---
kind: source_summary
slug: prd-123-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-123-spec-handoff.md"
entities:
  - "metrics-project.sh"
  - "_stdout.log"
  - "telemetry"
  - "run-role.sh"
concepts:
  - "토큰 집계 경로 최적화"
  - "리텐션 체인 완성"
  - "성능 목표"
  - "daily.jsonl 호환성 유지"
---

# metrics-project.sh 및 _stdout.log 처리 개선

## One-liner

오래된 `metrics-project.sh`의 성능을 개선하고 `run-role.sh`의 `_stdout.log` 영구 저장을 제거하여 시스템 효율성을 높인다.

## Summary

본 문서는 `prd_123` 프로젝트의 사양 핸드오프 문서로, `metrics-project.sh` 스크립트가 4분 36초 소요되던 문제를 해결하기 위해 `_stdout.log` 및 `git log` 기반의 토큰 집계 방식을 `.autoflow/telemetry/runs.jsonl`을 활용하는 방식으로 재작성하는 내용을 담고 있다. 또한 `run-role.sh`에서 `_stdout.log`의 영구 저장을 제거하여 리텐션 체인을 완성한다. 목표는 `bin/autoflow metrics` 실행 시간을 5초 미만으로 단축하고, `daily.jsonl` 스키마 호환성을 유지하며 `token-cache.tsv` 관련 로직을 제거하는 것이다. 이는 `PRD-A`, `PRD-B`, `PRD-C`의 후속 작업이다.

## Entities

- metrics-project.sh (script): 오래된 성능 문제 해결 및 텔레메트리 기반 재작성 대상
- run-role.sh (script): _stdout.log 영구 저장 제거 및 live log 정리 로직 개선
- telemetry (system): runs.jsonl을 통해 토큰 사용량 집계의 새로운 소스
- _stdout.log (file): run-role.sh에서 영구 저장이 제거될 로그 파일

## Concepts

- daily.jsonl 호환성 유지: metrics 결과 파일의 스키마 변경 없이 기존 형식 유지
- 리텐션 체인 완성: _stdout.log 영구 저장을 제거하여 로그 파일 관리 정책을 완성함
- 성능 목표: bin/autoflow metrics 실행 시간을 5초 미만으로 단축
- 토큰 집계 경로 최적화: awk 파싱 대신 telemetry 데이터 (runs.jsonl)를 jq로 합산하는 방식으로 변경

## Source

- `wiki-raw/prd-123-spec-handoff.md`
