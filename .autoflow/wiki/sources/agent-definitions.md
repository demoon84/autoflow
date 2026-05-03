---
kind: source_summary
slug: agent-definitions
created: 2026-05-03T10:54:59Z
updated: 2026-05-03T11:25:44Z
raw_source: "wiki-raw/agent-definitions.md"
entities:
  - "Orchestrator AI"
  - "Impl AI"
  - "Verifier AI"
  - "Wiki AI"
  - "Orchestrator AI"
  - "Impl AI"
  - "Verifier AI"
  - "Wiki AI"
concepts:
  - ".autoflow/ sidecar 보드"
  - "1원칙"
  - "#autoflow 트리거"
  - "#order 트리거"
  - "#plan 트리거"
  - ".autoflow/ sidecar 보드"
  - "1원칙"
  - "#autoflow 트리거"
  - "#order 트리거"
  - "#plan 트리거"
---

# Autoflow 에이전트 정의 및 작동 방식

## One-liner

Autoflow의 에이전트, 작업 흐름 및 운영 규칙을 설명하는 문서입니다.

## Summary

이 문서는 Autoflow 프로젝트의 에이전트 정의와 운영 방식을 상세히 설명합니다. `.autoflow/` sidecar 보드를 사용하여 제품 코드와 분리된 작업 환경을 제공하며, Codex, Claude Code, Gemini CLI와 같은 코딩 에이전트를 위한 로컬 작업 하네스로 기능합니다. 문서에는 작업을 시작할 때 읽어야 할 순서, Orchestrator AI, Impl AI, Verifier AI, Wiki AI로 구성된 에이전트 토폴로지, 그리고 "사용자가 명시적으로 정지하지 않는 한 목표를 달성할 때까지 Autoflow는 멈추지 않는다"는 1원칙을 포함한 핵심 규칙들이 명시되어 있습니다. 또한, `#autoflow`, `#order`, `#plan`과 같은 트리거의 해석과 각각의 역할에 대해서도 설명합니다. 전반적으로 Autoflow 시스템의 구조, 에이전트 간의 상호 작용, 작업 관리 및 자동화 원칙을 이해하는 데 필요한 정보를 제공합니다.

## Entities

- Impl AI (에이전트): 티켓을 처리하고, 작업 트리를 생성하며, 구현, 검증 및 병합을 수행합니다.
- Orchestrator AI (에이전트): 워크플로우를 관리하고, PRD/Todo 티켓을 생성하며, 복구 지시를 처리합니다.
- Verifier AI (에이전트): 호환성 검증을 담당하고, 작업자 검증 증거를 감사합니다.
- Wiki AI (에이전트): wiki 내용을 업데이트하고 관리합니다.

## Concepts

- 1원칙: 사용자가 명시적으로 정지하지 않는 한 Autoflow는 목표 달성까지 멈추지 않습니다.
- #autoflow 트리거: PRD(제품 요구사항 문서) 핸드오프를 위한 별칭으로, 요구사항을 모으고 PRD 초안을 생성합니다.
- #order 트리거: 간단한 수정 요청을 `.autoflow/tickets/inbox/`에 저장하는 빠른 입력 별칭입니다.
- #plan 트리거: 레거시 역할 파이프라인 호환 트리거로, Planner AI가 처리하는 계획 작업을 시작하거나 재개합니다.
- .autoflow/ sidecar 보드: 실제 제품 코드와 분리된 에이전트 작업 환경 및 관리 보드입니다.

## Source

- `wiki-raw/agent-definitions.md`
