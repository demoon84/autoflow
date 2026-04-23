# Autoflow Package Spec

## Project

- Name: Autoflow package source
- Goal: 공개 배포 가능한 `repo template + installer CLI` 형태로 `.autoflow/` 작업 보드를 생성하고 갱신할 수 있게 한다.
- Owner: package maintainers

## Core Scope

- In Scope:
  - 설치 CLI 와 보드 스캐폴드 유지
  - generated board template 유지
  - 보드 runtime 훅과 검증 흐름 유지
  - 문서와 스펙을 현재 구조에 맞게 유지
- Out of Scope:
  - 특정 host project 제품 기능 구현
  - package manager 배포 채널 운영
  - Codex automation 직접 등록 로직

## Package Modules

- `bin/`
- `scripts/`
- `templates/`
- `rules/`
- `tickets/`

## Global Rules

- generated board starter 상태는 `templates/board/` 아래에 둔다.
- 패키지 소스 루트에는 generated board 예시 티켓을 live 상태로 유지하지 않는다.
- 실제 starter board 자산은 `autoflow init` 으로 host project 안에 생성된다.
- generated board 의 canonical 규칙은 `rules/`, `automations/`, `tickets/`, `agents/` 문서로 설명한다.

## Global Acceptance Criteria

- [ ] `autoflow init` 으로 host project 안에 `.autoflow/` 보드를 생성할 수 있다.
- [ ] `autoflow doctor` 가 fresh board 에서 통과한다.
- [ ] generated board starter 상태는 `templates/board/` 에서 관리된다.
- [ ] 패키지 소스와 generated board sample state 가 서로 섞이지 않는다.

## Verification

- Command: `bash -n bin/autoflow scripts/*.sh`
- Manual check: fresh project 에 `autoflow init` 후 `autoflow doctor` 가 `status=ok` 를 출력한다.
