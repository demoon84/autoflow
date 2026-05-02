---
kind: source_summary
slug: prd-038-handoff
created: 2026-05-02T00:57:01Z
updated: 2026-05-02T00:57:01Z
raw_source: "wiki-raw/prd-038-handoff.md"
entities:
  - "wiki-1"
  - "wiki-maintainer"
  - "Codex"
concepts:
  - "Runner Adapter Abstraction"
  - "Dry-run Verification"
---

# Wiki Bot Codex 지원

## One-liner

위키 유지보수 에이전트(wiki-1)가 Codex AI 어댑터를 사용할 수 있도록 시스템 전반을 확장함.

## Summary

위키봇(wiki-1)의 AI 어댑터로 Codex를 사용할 수 있도록 러너 설정, 데스크톱 UI, CLI 실행 경로를 개선하는 프로젝트입니다. 기존 Gemini 지원을 유지하면서 Codex 기반의 위키 합성과 드라이런이 가능하게 하며, 스캐폴드 설정을 통해 향후 생성되는 보드에서도 Codex를 선택할 수 있게 합니다. 에이전트 역할 정의(wiki-maintainer)는 유지하며 어댑터 추상화 계층을 활용해 구현합니다.

## Entities

- Codex (AI adapter): 위키봇의 새로운 실행 엔진으로 추가되는 AI 모델 제공자.
- wiki-1 (runner): 위키 유지보수를 담당하는 에이전트의 고유 러너 ID.
- wiki-maintainer (role): 위키봇의 페르소나와 지침을 정의하는 역할 명칭.

## Concepts

- Dry-run Verification: 실제 위키 데이터를 변경하지 않고 실행 환경과 명령문의 유효성을 CLI에서 먼저 확인하는 검증 절차.
- Runner Adapter Abstraction: 특정 AI 서비스에 종속되지 않고 다양한 모델을 일관된 방식으로 실행하기 위한 추상화 계층.

## Source

- `wiki-raw/prd-038-handoff.md`
