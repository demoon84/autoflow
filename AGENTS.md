# AGENTS.md

이 저장소는 Autoflow 제품/런타임 소스 저장소다. 루트에는 설치된 `.autoflow/` sidecar 보드를 두지 않는다.

설치 보드 동작 검증은 기본적으로 `/Users/demoon2016/Documents/project/tetris/.autoflow` 에 upgrade 한 뒤 확인한다. 이 저장소는 두 영역으로 구분된다: 앱 레벨(`app/`)과 설치 레벨(`install/`). 새 보드 템플릿과 설치 산출물의 source of truth 는 `install/` 아래에 둔다.

## 작업 기준

1. 루트 `.autoflow/` 는 만들거나 유지하지 않는다. 임시로 생겼다면 repo 밖 백업으로 옮기고 원인을 고친다.
2. 설치 보드에 들어갈 데이터(문서/규칙/템플릿/skill)는 `install/board/`, `install/host/`, `install/integrations/`, `app/cli/shared/install.ts` 를 기준으로 수정한다. runner 실행 코드는 `app/runtime/` 에 있고 보드에는 복사되지 않는다.
3. 설치 검증은 `./app/bin/autoflow upgrade /Users/demoon2016/Documents/project/tetris .autoflow` 후 `tetris/.autoflow` 에서 직접 실행해 확인한다.
4. 사용자와 대화할 때 runner 이름은 `플래너 러너`, `워커 러너`, `검증 러너`, `위키 러너` 로 부른다. 코드 식별자나 파일명 설명이 필요할 때만 `planner`, `worker`, `verifier`, `wiki` 를 함께 적는다.
5. worktree, merge, verifier pass/revise/replan 흐름은 설치 보드 계약 문서(`install/board/reference/`, `install/host/AGENTS.md`)와 런타임 코드가 기준이다.
6. `tickets/order/`, `tickets/prd/`, `tickets/todo/`, `tickets/inprogress/`, `tickets/verifier/`, `tickets/done/` 은 설치 보드 안의 실행 원장이다. 소스 저장소 루트에 같은 보드를 복제하지 않는다.
7. 새 기능이나 리팩터링 뒤에는 가능한 한 `npm run typecheck`, 관련 smoke 테스트, 그리고 `tetris` upgrade 검증까지 이어서 한다.

## 주요 경로

- `app/`: 앱 레벨. Autoflow 데스크톱 앱(Electron), CLI 코드(`app/cli/`), runner 실행 코드(`app/runtime/`), 진입점(`app/bin/autoflow`) 을 한 단일 앱으로 묶은 영역.
- `app/cli/`: `autoflow` CLI 구현. 외부 진입점은 `app/bin/autoflow` 가 이 디렉터리의 `autoflow.ts` 를 호출한다.
- `app/runtime/`: runner 실행 코드 원본. 보드에 복사되지 않고 앱/CLI 가 `BOARD_ROOT`/`PROJECT_ROOT` env 만 넘겨 직접 실행한다.
- `app/runtime/runners/`: 플래너 러너, 워커 러너, 검증 러너, 위키 러너 기준 기능 폴더.
- `app/runtime/shared/`: runner 공통 도구와 board utility.
- `app/runtime/system/`: 보드 guard, janitor 같은 시스템성 기능.
- `install/`: 설치 레벨. 대상 보드(예: `tetris/.autoflow`)로 복사되는 데이터 source (`board/`, `host/`, `integrations/`, `manifest.toml`). runtime 은 여기 없음.
- `install/board/`: 새 `.autoflow` 보드에 설치되는 문서, 규칙, 템플릿.
- `install/host/`: 설치 대상 프로젝트 루트에 놓이는 host `AGENTS.md` 템플릿.
