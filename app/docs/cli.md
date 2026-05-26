# CLI (데스크톱 앱 내부)

`app/cli/` 는 Autoflow CLI의 TypeScript 구현을 담는다. 이 CLI는 데스크톱
애플리케이션 안에 흡수되어 단일 source of truth로 동작한다.
`app/bin/autoflow` 는 resolved Autoflow core의 `tsx` runtime을 통해
`app/cli/autoflow.ts`를 실행하는 얇은 Node 진입점이다. `AUTOFLOW_CORE_ROOT`
또는 `~/.autoflow/core-registry.json`의 active core가 있으면 그 core로 먼저
위임한다.

## CLI 파일

- `autoflow.ts`: 최상위 CLI entrypoint와 command dispatcher.
- `runners/`: `planner/`, `worker/`, `wiki` 기준으로 묶인 runner-facing command 코드. (`verifier/` 는 legacy 호환 경로.)
- `system/`: install, status, runner config, tool dispatch, telemetry, cleanup 같은 board/runtime 관리 command.
- `shared/`: 재사용 가능한 CLI helper.

Repo-owned shell CLI entrypoint는 두지 않는다. 새 package command는 대응되는
물리 폴더에 구현하고 `autoflow.ts`에서 직접 route한다. Runner가 소유한 surface는
`runners/<role>/`을 쓰고, board/runtime 관리는 `system/`을 쓴다. 재사용 helper는
`shared/*` 아래에 둔다.

## Runner Runtime (앱 레벨, 설치 대상 아님)

Runner runtime 코드는 resolved Autoflow core의 `app/runtime/`에 있다. 이 코드는
보드로 복사되지 않는다. CLI/app은 대상 보드를 가리키는 `AUTOFLOW_BOARD_ROOT`와
`AUTOFLOW_PROJECT_ROOT`, 그리고 core/share 위치를 나타내는 `AUTOFLOW_CORE_ROOT`와
`AUTOFLOW_SHARE_ROOT` env var를 넘겨 물리 runtime 경로를 직접 호출한다. Runtime도
CLI와 같은 최상위 ownership 형태를 쓴다.

- `runners/planner/`: planner assignment startup, PRD-to-work-item 분해, planner tools.
- `runners/worker/`: worker assignment startup, worktree tools, evidence checks, sanity gate + merge target verification rerun 을 거친 worker finalize-approved 의 PRD worktree commit/merge.
- `runners/verifier/`: legacy 호환 경로. 새 사용자 흐름에는 활성 역할로 노출되지 않는다.
- `runners/wiki/`: wiki runner tools와 wiki scripts.
- `system/`: board guard, stop hook, stage/token, runtime maintenance helper.
- `shared/`: markdown, git, board, runner-tool 공통 helper.

Node runtime 실행을 위한 `.js` companion은 남을 수 있지만, shell companion은
설치하지 않는다.

## 검증

소스 저장소 smoke test는 설치된 보드를 직접 검증하는 방식으로 대체되었다.
대상 프로젝트에 `app/bin/autoflow upgrade <project-root>`를 실행한 뒤 그 보드에서
runner를 직접 돌려 확인한다.

## Command 메모

- `autoflow init`과 `autoflow upgrade`는 프로젝트별 scaffold를 보정하고 `.autoflow/manifest.toml`에 board schema와 core/share 참조를 기록한다. Runtime은 복사하지 않으며, 오래된 install에서 남은 `<board>/scripts/`는 제거한다.
- `autoflow dev-link`는 현재 개발 core를 `~/.autoflow/core-registry.json`의 active core로 등록하고, `--share-root`가 없으면 `<core-root>/install/share`를 기본 share로 연결한다.
- `autoflow prd create` / `autoflow spec create`는 `autoflow` skill 대화가 발행할 PRD markdown을 `tickets/prd/`에 쓴다.
- `autoflow run <role>`은 board/project env var와 함께 대응되는 focused assignment surface를 호출한다. 각 role은 assignment로 지정된 item만 처리한다.
- `autoflow run wiki`는 wiki role assignment surface다.
- `autoflow runners start|stop|restart <runner>`는 runner 제어 요청을 보드 state에 기록한다. 데스크톱 앱이 열려 있으면 해당 요청을 감지해 PTY runner를 spawn/stop하며, `stop`은 state의 PID가 살아 있으면 CLI에서도 종료 신호를 보낸다.
- `autoflow tool runner-tool <role> ...`은 assignment state, worktree setup, verification evidence, worker finalize-approved 의 단일 마무리, wiki source snapshot 같은 좁은 runner action의 권장 surface다.
- `autoflow wiki query`는 TypeScript CLI에서 qmd optional search를 먼저 시도하고, 실패하면 local markdown retrieval로 fallback한다. 기본 qmd 명령은 모델 다운로드가 필요 없는 `qmd search`이며, hybrid 검색은 `AUTOFLOW_QMD_MODE=query`로 명시한다. Wiki runner script는 `app/runtime/runners/wiki/scripts/` 아래에 있다.
