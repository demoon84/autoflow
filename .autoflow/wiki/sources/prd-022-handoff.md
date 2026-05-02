---
kind: source_summary
slug: prd-022-handoff
created: 2026-05-02T00:56:48Z
updated: 2026-05-02T00:56:48Z
raw_source: "wiki-raw/prd-022-handoff.md"
entities:
  - "자기 개선 시험용 러너(Self-improvement trial runner)"
concepts:
  - "지문(Fingerprint)"
  - "추천 전용(Recommend-only)"
  - "실행 증거(Evidence-backed)"
---

# 로그 기반 자기 개선 시험용 러너

## One-liner

누적된 로그와 러너 상태를 분석하여 반복되는 운영 문제를 해결하기 위한 단기 시험용 자기 개선 러너 구축 계획.

## Summary

Autoflow의 로그와 러너 상태를 30분 간격으로 최대 3시간 동안 분석하여, 반복되는 오류나 차단 패턴을 감지하고 근거가 확실한 개선안을 생성하는 시험용 시스템입니다. 누적된 데이터를 통해 반복성이 입증된 저위험 개선 사항만 PRD/TODO 티켓 경로로 전달하며, 고위험 사항은 추천으로만 기록합니다. 무한 루프 방지 및 안전한 운영을 위해 최대 6회 실행으로 제한되며 자동 git push는 금지됩니다.

## Entities

- 자기 개선 시험용 러너(Self-improvement trial runner) (Runtime Module): 로그를 분석하여 운영상의 문제점을 발견하고 개선 후보를 생성하는 핵심 구성 요소.

## Concepts

- 실행 증거(Evidence-backed): 모든 개선 후보는 반드시 소스 로그 경로와 발생 횟수 등 구체적인 근거를 포함해야 한다는 원칙.
- 지문(Fingerprint): 반복되는 이슈를 안정적으로 그룹화하여 노이즈를 줄이고 중복 티켓 생성을 방지하기 위한 식별 패턴.
- 추천 전용(Recommend-only): 고위험군 개선안에 대해 자동 구현을 수행하지 않고 기록 및 권고 사항으로만 남기는 안전 정책.

## Source

- `wiki-raw/prd-022-handoff.md`
