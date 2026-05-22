# CLI (데스크톱 앱 내부)

`app/cli/` 는 Autoflow CLI의 TypeScript 구현을 담는다. 이 CLI는 데스크톱
애플리케이션 안에 흡수되어 단일 source of truth로 동작한다.
`app/bin/autoflow` 는 repo-local `tsx` runtime을 통해 `app/cli/autoflow.ts`를
실행하는 얇은 Node 진입점이다.

## CLI 파일

- `autoflow.ts`: 최상위 CLI entrypoint와 command dispatcher.
- `runners/`: `planner/`, `worker/`, `verifier`, `wiki` 기준으로 묶인 runner-facing command 코드.
- `system/`: install, status, runner config, tool dispatch, telemetry, cleanup 같은 board/runtime 관리 command.
- `shared/`: 재사용 가능한 CLI helper.

Repo-owned shell CLI entrypoint는 두지 않는다. 새 package command는 대응되는
물리 폴더에 구현하고 `autoflow.ts`에서 직접 route한다. Runner가 소유한 surface는
`runners/<role>/`을 쓰고, board/runtime 관리는 `system/`을 쓴다. 재사용 helper는
`shared/*` 아래에 둔다.

## Runner Runtime (앱 레벨, 설치 대상 아님)

Runner runtime 코드는 `app/` 아래에서 `cli/`와 나란한 `../runtime/`에 있다.
이 코드는 보드로 복사되지 않는다. CLI/app은 대상 보드를 가리키는
`AUTOFLOW_BOARD_ROOT`와 `AUTOFLOW_PROJECT_ROOT` env var를 넘겨 물리 runtime
경로를 직접 호출한다. Runtime도 CLI와 같은 최상위 ownership 형태를 쓴다.

- `runners/planner/`: planner startup, PRD-to-todo promotion, planner tools.
- `runners/worker/`: worker startup, worktree tools, evidence checks, finalization.
- `runners/verifier/`: verifier queue/evidence/decision tools와 legacy verify macro.
- `runners/wiki/`: wiki runner tools와 wiki scripts.
- `system/`: board guard, stop hook, stage/token, runtime maintenance helper.
- `shared/`: markdown, git, board, runner-tool 공통 helper.

Node runtime 호환을 위한 legacy `.js` companion은 남을 수 있지만, shell companion은
설치하지 않는다.

## 검증

소스 저장소 smoke test는 설치된 보드를 직접 검증하는 방식으로 대체되었다.
대상 프로젝트에 `app/bin/autoflow upgrade <project-root>`를 실행한 뒤 그 보드에서
runner를 직접 돌려 확인한다.

## Command 메모

- `autoflow init`과 `autoflow upgrade`는 install-source 문서(board/host/integrations)를 대상 보드에 복사한다. Runtime은 복사하지 않으며, 오래된 install에서 남은 `<board>/scripts/`는 제거한다.
- `autoflow todo create`는 단일 파일 기계적 작업을 위해 완전한 `Todo-NNN.md`를 `tickets/todo/`에 직접 쓴다. 이는 `/atodo` skill의 CLI 형태다.
- `autoflow prd create` / `autoflow spec create`는 PRD markdown을 `tickets/prd/`에 쓴다.
- `autoflow run <role>`은 board/project env var와 함께 대응되는 focused runtime surface를 호출한다. `planner`는 PRD-to-todo 작업을 승격한다. `worker`(alias `ticket`)는 runner가 명시적 worker tool을 쓰기 전에 소유 중인 active work 또는 다음 todo candidate를 startup context로 보고한다.
- `autoflow run wiki`는 deterministic wiki baseline update surface다. 일반 wiki runner turn은 `autoflow tool runner-tool wiki tick`을 쓴다.
- `autoflow runners start <runner>`는 CLI에서 runner state/config를 기록하거나 준비한다. 장기 실행 process spawn은 데스크톱 앱의 PTY runner 경로가 소유한다.
- `autoflow tool runner-tool <role> ...`은 claim, worktree setup, verification evidence, verifier decision routing, wiki source snapshot 같은 좁은 runner action의 권장 surface다.
- `autoflow wiki query`는 TypeScript CLI에서 local markdown retrieval을 직접 수행한다. Wiki runner script는 `app/runtime/runners/wiki/scripts/` 아래에 있다.
