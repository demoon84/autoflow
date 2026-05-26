# AGENTS.md

이 저장소는 Autoflow 제품/런타임 소스 저장소다. 두 영역으로 구분된다: 앱 레벨(`app/`)과 설치 레벨(`install/`). 새 보드 템플릿과 설치 산출물의 source of truth 는 `install/` 아래에 둔다.

루트의 `.autoflow/` 는 dev test 용 보드 인스턴스로 둘 수 있다. 동작 코드는 보드에 복사되지 않고 `app/runtime/` 에서 직접 실행되며, `.gitignore` 가 `.autoflow/` 와 그 안의 derived 데이터를 보호한다. `.autoflow/` 안의 변경은 인스턴스 데이터일 뿐이며, 보드 템플릿을 바꾸려면 항상 `install/board/` 의 source 를 수정해야 한다. 외부 대상 프로젝트에서의 upgrade 검증도 계속 유효하다.

## 작업 기준

1. 루트 `.autoflow/` 는 dev test 인스턴스로 둘 수 있지만 source of truth 가 아니다. 보드 템플릿 변경은 항상 `install/board/` 의 source 를 수정한다.
2. 설치 보드에 들어갈 데이터(문서/규칙/템플릿/skill)는 `install/board/`(per-project), `install/share/`(user-scope `~/.autoflow/share/`), `install/host/`, `install/integrations/`, `app/cli/shared/install.ts` 를 기준으로 수정한다. runner 실행 코드는 `app/runtime/` 에 있고 보드에는 복사되지 않는다.
3. 설치 검증은 `./app/bin/autoflow upgrade <project-root> .autoflow` 로 source repo 루트 또는 별도 대상 프로젝트에 upgrade 한 뒤 보드에서 직접 실행해 확인한다.
4. 사용자와 대화할 때 runner 이름은 `플래너 러너`, `워커 러너`, `위키 러너` 로 부른다. 코드 식별자나 파일명 설명이 필요할 때만 `planner`, `worker`, `wiki` 를 함께 적는다. `verifier`는 legacy 비활성 역할이며 새 사용자-facing 문서에 활성 역할로 등장시키지 않는다.
5. worktree, merge, 워커 단일 마무리 흐름(sanity gate + merge target verification rerun)은 설치 계약 문서(`install/share/reference/`, `install/host/AGENTS.md`)와 런타임 코드가 기준이다.
6. `tickets/prd/`, `tickets/todo/`, `tickets/inprogress/`, `tickets/done/` 은 설치 보드 안의 실행 원장이다. source of truth 는 `install/board/` 이고, source repo 루트의 `.autoflow/` 가 있다면 dev 인스턴스의 ledger 일 뿐이다. 기존 보드의 `tickets/verifier/` 잔재는 upgrade 가 자동으로 `tickets/inprogress/` 로 옮긴다.
7. 새 기능이나 리팩터링 뒤에는 가능한 한 `npm run typecheck`, 관련 smoke 테스트, 그리고 별도 대상 프로젝트 upgrade 검증까지 이어서 한다.
8. README, QUICKSTART, 설치 문서, 사용자-facing CLI/앱 문구에는 개인 로컬 검증 프로젝트명을 쓰지 않는다. 예시는 `<project-root>` 또는 `target-project` 처럼 중립 표현을 쓴다.
9. Autoflow의 모든 문서 본문은 한국어로 작성한다. 루트 README/QUICKSTART, 앱 문서, 설치 보드 문서, `install/share/` reference/rules/agents/protocols, host 템플릿, integration skill 문서, 사용자-facing CLI/앱 문구가 모두 대상이다. 단, 명령어, 경로, 코드, API 이름, runner id, ticket field, parser-sensitive heading, key=value 출력, TOML/JSON/YAML key, 외부 도구 고유 명칭은 필요한 원래 표기를 유지한다.

## 주요 경로

- `app/`: 앱 레벨. Autoflow 데스크톱 앱(Electron), CLI 코드(`app/cli/`), runner 실행 코드(`app/runtime/`), 진입점(`app/bin/autoflow`) 을 한 단일 앱으로 묶은 영역.
- `app/cli/`: `autoflow` CLI 구현. 외부 진입점은 `app/bin/autoflow` 가 이 디렉터리의 `autoflow.ts` 를 호출한다.
- `app/runtime/`: runner 실행 코드 원본. 보드에 복사되지 않고 앱/CLI 가 `BOARD_ROOT`/`PROJECT_ROOT` env 만 넘겨 직접 실행한다.
- `app/runtime/runners/`: 플래너 러너, 워커 러너, 위키 러너 기준 기능 폴더. `verifier/` 는 legacy 호환 경로로만 유지된다.
- `app/runtime/shared/`: runner 공통 도구와 board utility.
- `app/runtime/system/`: 보드 guard, stop hook, stage/token 같은 시스템성 기능.
- `install/`: 설치 레벨. 대상 보드/share/host 로 복사되는 데이터 source (`board/`, `share/`, `host/`, `integrations/`, `manifest.toml`). runtime 은 여기 없음.
- `install/board/`: 새 `.autoflow` 보드(프로젝트별)에 설치되는 데이터. tickets/wiki/automations/runners 등 프로젝트별로 채워지는 디렉터리만 둔다.
- `install/share/`: 사용자 단위 share 루트(`~/.autoflow/share/`, `AUTOFLOW_SHARE_ROOT` 로 override)에 설치되는 정적 자원. `agents/`, `protocols/`, `reference/`, `rules/`, `state-schema/` 가 여기에 있다. 모든 프로젝트가 같은 한 벌을 공유한다.
- `install/host/`: 설치 대상 프로젝트 루트에 놓이는 host `AGENTS.md` 템플릿.
