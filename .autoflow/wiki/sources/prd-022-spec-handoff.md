---
kind: source_summary
slug: prd-022-spec-handoff
created: 2026-05-03T23:48:04Z
updated: 2026-05-03T23:48:04Z
raw_source: "wiki-raw/prd-022-spec-handoff.md"
entities:
  - "project_022"
  - "tickets/backlog/prd_022.md"
  - "Self-improvement runtime and runner integration"
  - "packages/cli/"
  - "runtime/board-scripts/"
  - "scaffold/board/"
  - ".autoflow/runners/config.toml"
  - ".autoflow/automations/"
  - ".autoflow/logs/"
  - "tests/smoke/"
  - "bash tests/smoke/log-driven-self-improvement-smoke.sh"
  - "npm --prefix apps/desktop run check"
  - "project_022"
  - "tickets/backlog/prd_022.md"
  - "Self-improvement runtime and runner integration"
  - "packages/cli/"
  - "runtime/board-scripts/"
  - "scaffold/board/"
  - ".autoflow/runners/config.toml"
  - ".autoflow/automations/"
  - ".autoflow/logs/"
  - "tests/smoke/"
  - "bash tests/smoke/log-driven-self-improvement-smoke.sh"
  - "npm --prefix apps/desktop run check"
concepts:
  - "로그 기반 자체 개선"
  - "시험 러너"
  - "저위험 후보"
  - "고위험 후보"
  - "허용된 경로"
  - "안정적인 지문"
  - "로그 기반 자체 개선"
  - "시험 러너"
  - "저위험 후보"
  - "고위험 후보"
  - "허용된 경로"
  - "안정적인 지문"
---

# 로그 기반 자체 개선 시험 러너 PRD 핸드오프

## One-liner

로그 기반 자체 개선 시험 러너에 대한 제품 요구 사항 정의 문서입니다.

## Summary

이 문서는 Autoflow 로그 및 러너 상태를 분석하여 반복되는 운영 문제를 감지하고, 증거 기반의 저위험 발견 사항을 개선 경로(PRD/TODO/티켓 소유자)로 전환하는 로그 기반 자체 개선 시험 러너의 제품 요구 사항을 정의합니다. 시험은 3시간 또는 6틱으로 제한되며, 무한 루프, 무분별한 리팩토링, 자동 git push 등은 범위에서 제외됩니다.

## Entities

- Self-improvement runtime and runner integration (소프트웨어 모듈): 자체 개선 런타임 및 러너 통합 모듈
- bash tests/smoke/log-driven-self-improvement-smoke.sh (확인 명령): 로그 기반 자체 개선 연기 테스트 실행 명령
- npm --prefix apps/desktop run check (확인 명령): 데스크톱 애플리케이션 점검 명령
- packages/cli/ (파일/디렉토리 경로): 주요 모듈 및 코드 경로
- project_022 (프로젝트 ID): 로그 기반 자체 개선 시험 러너 프로젝트 ID
- runtime/board-scripts/ (파일/디렉토리 경로): 주요 모듈 및 코드 경로
- scaffold/board/ (파일/디렉토리 경로): 주요 모듈 및 코드 경로
- tests/smoke/ (파일/디렉토리 경로): 연기 테스트 관련 파일 경로
- tickets/backlog/prd_022.md (파일 경로): prd_022 사양 문서 경로
- .autoflow/automations/ (파일/디렉토리 경로): 자동화 관련 파일 경로
- .autoflow/logs/ (파일/디렉토리 경로): 로그 파일 저장 경로
- .autoflow/runners/config.toml (파일/디렉토리 경로): 러너 설정 파일 경로

## Concepts

- 고위험 후보: 자동으로 구현되지 않고 검토 및 승인이 필요한 개선 제안
- 로그 기반 자체 개선: 로그 분석을 통해 시스템 문제를 식별하고 해결하는 메커니즘
- 시험 러너: 제한된 시간과 범위 내에서 실행되는 실험적인 개선 시스템
- 안정적인 지문: 반복되는 문제를 고유하게 식별하여 중복 처리를 방지하는 방법
- 저위험 후보: 자동으로 처리될 수 있는 안전하고 영향이 적은 개선 제안
- 허용된 경로: 자체 개선 러너가 변경을 수행할 수 있는 사전 정의된 코드 영역

## Source

- `wiki-raw/prd-022-spec-handoff.md`
