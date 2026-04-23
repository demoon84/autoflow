# Public Distribution Spec

## Purpose

- `Autoflow` 를 공개 배포 가능한 저장소 템플릿과 설치용 CLI 로 제공하는 방식을 정의한다.

## Primary Distribution Model

- public git repository
- local installer CLI
- project-local generated board

## Why This Is Primary

1. 공개 배포 경로가 단순하다.
2. 특정 워크스페이스 앱 권한에 의존하지 않는다.
3. 사용자가 저장소를 clone 하거나 template 으로 복제해서 바로 쓸 수 있다.
4. 프로젝트 상태를 Git 으로 추적하기 쉽다.

## Core Package Shape

```text
autoflow/
  bin/
    autoflow
  templates/
    board/
    host/
  scripts/
  rules/
  tickets/
```

## Generated Project Shape

```text
PROJECT_ROOT/
  AGENTS.md
  autoflow/
    .autoflow-version
    rules/
    tickets/
```

## Responsibilities

### Public package owns

- installer CLI
- host/root template assets
- generated board templates
- migration logic
- documentation

### Generated project owns

- project-specific spec
- project-specific plans
- live tickets
- verifier records
- run logs

## CLI Contract

### Implemented now

- `autoflow init [project-root] [board-dir-name]`
- `autoflow render-heartbeats [project-root] [board-dir-name]`
- `autoflow status [project-root] [board-dir-name]`
- `autoflow doctor [project-root] [board-dir-name]`
- `autoflow upgrade [project-root] [board-dir-name]`

### Expected later

- package manager install path

## Install Contract

### `autoflow init`

- reads:
  - source repo templates
  - `templates/board/`
- writes:
  - `PROJECT_ROOT/autoflow/`
  - `PROJECT_ROOT/AGENTS.md`
- must be:
  - idempotent
  - safe to rerun
  - non-destructive to existing board state

### `autoflow render-heartbeats`

- reads:
  - `BOARD_ROOT/automations/heartbeat-set.toml`
  - `BOARD_ROOT/automations/templates/*.template.toml`
- writes:
  - `BOARD_ROOT/automations/rendered/<set-name>/`
- must:
  - fail clearly if `target_thread_id` is still a placeholder
  - preserve project-owned set input
  - emit machine-readable `key=value` output

### `autoflow upgrade`

- reads:
  - current board files
  - package-managed templates and runtime files
- writes:
  - package-managed board assets
  - `PROJECT_ROOT/AGENTS.md`
  - `BOARD_ROOT/.autoflow-version`
- must:
  - preserve live ticket and run state
  - preserve project-specific starter state files
  - back up changed managed files before overwriting

## Branding Rule

- public package name:
  - `Autoflow`
- local board path:
  - `autoflow/`

## Deferred Alternatives

- Codex plugin packaging is deferred.
- Team-internal plugin distribution can remain a future option.
- Public distribution should not depend on plugin publication.
