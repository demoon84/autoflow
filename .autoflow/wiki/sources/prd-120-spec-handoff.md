---
kind: source_summary
slug: prd-120-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-120-spec-handoff.md"
entities:
  - "project_120"
  - "prd_120"
  - "packages/cli/run-role.sh"
  - "packages/cli/runners-project.sh"
  - "packages/cli/cleanup-runner-logs.sh"
  - "bin/autoflow"
  - "planner"
concepts:
  - "로그 retention 정책"
  - "로그 rotation"
  - "로그 정리 스크립트"
  - "runner 로그"
  - "IPC 타임아웃"
  - "644MB 잔재"
---

# PRD Handoff: runner 로그 retention 정책 및 정리

## One-liner

runner 로그 무한 누적 방지, readBoard/metrics-project 부하 감소, 누적된 644MB 잔재 정리 및 안정적인 로그 상태 유지를 위한 정책 정비

## Summary

.autoflow/runners/logs/ 디렉토리의 무한 로그 누적 문제를 해결하기 위한 PRD Handoff 문서입니다. readBoard 및 metrics-project의 부하를 줄이고자 소비자 없는 로그 영구 저장 경로를 닫고, 루프 테일 로테이션을 도입합니다. 또한, 누적된 644MB에 달하는 잔재 로그를 1회성으로 정리하여 향후 텔레메트리 레이어 도입 전에도 로그 크기가 약 30MB로 수렴하도록 합니다. 주요 변경 사항으로는 packages/cli/run-role.sh의 persist_run_artifact 호출 제거, stderr 파일 크기 0일 경우 skip, 1MB 로그 파일 로테이션, 오래된 live 로그 파일 삭제 스윕, 그리고 신규 1회성 정리 스크립트 cleanup-runner-logs.sh 추가 등이 있습니다.

## Entities

- bin/autoflow (파일): cleanup-runner-logs 서브커맨드 라우팅 추가
- packages/cli/cleanup-runner-logs.sh (파일): 신규 1회성 정리 스크립트
- packages/cli/runners-project.sh (파일): runner loop tail writer 모듈
- packages/cli/run-role.sh (파일): runner adapter persist policy 모듈
- planner (AI 역할): PRD 관련 AI 역할
- prd_120 (PRD): runner 로그 retention 정책 정비 및 정리 관련 PRD
- project_120 (프로젝트 ID): PRD 관련 프로젝트 ID

## Concepts

- 644MB 잔재: 누적된 644MB의 오래된 로그 파일 잔재
- IPC 타임아웃: readBoard IPC의 30초 타임아웃 문제
- runner 로그: autoflow runner가 생성하는 로그 파일들
- 로그 retention 정책: 로그 파일의 저장 및 관리 정책
- 로그 rotation: 로그 파일의 크기 제한 및 주기적인 백업/삭제 메커니즘
- 로그 정리 스크립트: 불필요한 로그 파일을 삭제하는 스크립트

## Source

- `wiki-raw/prd-120-spec-handoff.md`
