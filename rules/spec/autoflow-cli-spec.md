# Autoflow CLI Spec

## Purpose

- 공개 배포용 `Autoflow` CLI 의 현재 명령과 향후 확장 범위를 정의한다.

## Command Namespace

- executable name:
  - `autoflow`

## Implemented Commands

### `autoflow init [project-root] [board-dir-name]`

- 목적:
  - 지정한 프로젝트에 `autopilot/` 보드를 생성한다.
- 기본값:
  - `project-root`: 현재 디렉터리
  - `board-dir-name`: `autopilot`
- 구현:
  - `scripts/cli/scaffold-project.sh` 를 래핑한다.

### `autoflow status [project-root] [board-dir-name]`

- 목적:
  - 지정한 프로젝트의 보드 상태를 요약한다.
- 기본값:
  - `project-root`: 현재 디렉터리
  - `board-dir-name`: `autopilot`
- 구현:
  - `scripts/cli/status-project.sh` 를 래핑한다.
- 출력:
  - `status=...`
  - `ticket_todo_count=...`
  - `ticket_inprogress_count=...`
  - `ticket_done_count=...`
  - `ticket_claimed_count=...`
  - `ticket_executing_count=...`
  - `ticket_ready_for_verification_count=...`
  - `ticket_verifying_count=...`
  - `ticket_blocked_count=...`

### `autoflow render-heartbeats [project-root] [board-dir-name]`

- 목적:
  - 생성된 보드의 `automations/heartbeat-set.toml` 을 읽어 role별 heartbeat TOML 파일 묶음을 만든다.
- 기본값:
  - `project-root`: 현재 디렉터리
  - `board-dir-name`: `autopilot`
- 구현:
  - `scripts/cli/render-heartbeats.sh` 를 래핑한다.
- 출력:
  - `status=rendered`
  - `project_root=...`
  - `board_root=...`
  - `set_file=...`
  - `output_root=...`
  - `rendered_count=...`
  - `manifest=...`

### `autoflow doctor [project-root] [board-dir-name]`

- 목적:
  - 생성된 보드 구조의 무결성을 검사한다.
- 기본값:
  - `project-root`: 현재 디렉터리
  - `board-dir-name`: `autopilot`
- 구현:
  - `scripts/cli/doctor-project.sh` 를 래핑한다.
- 출력:
  - `status=ok|fail`
  - `error_count=...`
  - `warning_count=...`
  - `check.*=...`
  - 역할 분리형 티켓 필드 누락은 warning 또는 error 로 보고한다.

### `autoflow upgrade [project-root] [board-dir-name]`

- 목적:
  - 생성된 보드의 공용 자산을 최신 패키지 기준으로 갱신한다.
- 기본값:
  - `project-root`: 현재 디렉터리
  - `board-dir-name`: `autopilot`
- 구현:
  - `scripts/cli/upgrade-project.sh` 를 래핑한다.
- 출력:
  - `status=upgraded|already_current`
  - `previous_board_version=...`
  - `current_board_version=...`
  - `managed_files_updated=...`
  - `backups_created=...`

## Planned Commands

- 아직 없음

## Output Rules

- 성공 시 `project_root=` 와 `board_root=` 를 출력하는 것이 좋다.
- 상태 조회 명령은 되도록 `key=value` 형태를 유지한다.
- 업그레이드 명령은 백업 위치도 `key=value` 로 출력하는 것이 좋다.
- 실패 시 짧고 직접적인 stderr 메시지를 쓴다.

## Typical Usage Sequence

1. `autoflow init` 으로 프로젝트에 보드를 설치한다.
2. `autoflow status` 와 `autoflow doctor` 로 초기 구조와 버전 상태를 확인한다.
3. heartbeat 운영이 필요하면 `automations/heartbeat-set.toml` 을 현재 thread 와 worker pool 기준으로 수정한다.
4. `autoflow render-heartbeats` 로 role별 TOML 묶음을 만든다.
5. 렌더된 결과는 별도 등록 단계에서 Codex heartbeat 자동화로 연결한다.

## Non-Goals

- 현재 CLI 가 티켓 라이프사이클 전체를 직접 수행하지는 않는다.
- 현재 CLI 가 Codex automation 을 직접 등록하지는 않는다.
- 생성 후 작업 흐름은 로컬 보드 명령과 문서를 따른다.
