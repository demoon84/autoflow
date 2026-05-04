---
kind: source_summary
slug: prd-038-spec-handoff
created: 2026-05-03T23:48:39Z
updated: 2026-05-03T23:48:39Z
raw_source: "wiki-raw/prd-038-spec-handoff.md"
entities:
  - "project_038"
  - "tickets/backlog/prd_038.md"
  - "Codex"
  - "Gemini"
  - "wiki-1"
  - "wiki-maintainer"
  - ".autoflow/runners/config.toml"
  - "scaffold/board/runners/config.toml"
  - "apps/desktop/src/renderer/main.tsx"
  - "packages/cli/runners-project.sh"
  - "packages/cli/run-role.sh"
  - "runtime/board-scripts/run-role.sh"
  - "packages/cli/README.md"
  - "scaffold/board/runners/README.md"
  - "tests/smoke"
  - "Desktop AI 관리"
concepts:
  - "PRD Handoff"
  - "Wiki Bot"
  - "AI Adapter"
  - "Runner Configuration"
  - "CLI Dry-run"
  - "Desktop AI Management UI"
  - "Acceptance Criteria"
  - "Verification"
---

# PRD Handoff

## One-liner

위키 봇에 코덱스 AI 어댑터를 지원하기 위한 PRD 인계 문서입니다.

## Summary

이 문서는 프로젝트_038의 PRD 인계 내용을 설명하며, 위키 봇(wiki-1)에 코덱스 AI 어댑터를 통합하는 것을 목표로 합니다. 주요 목표는 기존 Gemini 지원을 유지하면서 러너 구성, CLI 및 데스크톱 AI 관리 UI를 통해 위키 봇이 코덱스를 사용할 수 있도록 하는 것입니다. 이 범위에는 구성 업데이트, UI 동작, CLI 명령 및 문서화가 포함되며, 3-러너 토폴로지 변경이나 위키 합성 의미론 변경은 제외됩니다.

## Entities

- Codex (AI 모델)
- Desktop AI 관리 (UI 요소)
- Gemini (AI 모델)
- apps/desktop/src/renderer/main.tsx (파일): 데스크톱 AI 관리 UI
- packages/cli/README.md (파일): CLI 문서
- packages/cli/runners-project.sh (파일): 러너 어댑터 CLI / 유효성 검사
- packages/cli/run-role.sh (파일): 실행 역할 위키 어댑터 경로
- project_038 (프로젝트)
- runtime/board-scripts/run-role.sh (파일): 런타임 미러
- scaffold/board/runners/README.md (파일): 스캐폴드 러너 문서
- scaffold/board/runners/config.toml (파일): 스캐폴드 러너 기본 설정
- tests/smoke (디렉토리): 스모크 테스트
- tickets/backlog/prd_038.md (문서): 명세서 파일
- wiki-1 (봇): 위키 봇 ID
- wiki-maintainer (역할): 위키 봇 역할
- .autoflow/runners/config.toml (파일): 라이브 보드 러너 설정

## Concepts

- AI Adapter: AI 어댑터
- Acceptance Criteria: 승인 기준
- CLI Dry-run: CLI 드라이런
- Desktop AI Management UI: 데스크톱 AI 관리 UI
- PRD Handoff: 제품 요구사항 문서 인계
- Runner Configuration: 러너 구성
- Verification: 검증
- Wiki Bot: 위키 봇

## Source

- `wiki-raw/prd-038-spec-handoff.md`
