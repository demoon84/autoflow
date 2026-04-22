# Local Board

이 폴더는 호스트 프로젝트 안에서 운영되는 로컬 AI 작업 보드다.

핵심 원칙은 단순하다.

- 기준은 `rules/spec/`
- 순서는 `rules/plan/`
- 실행 단위는 `tickets/`
- 검증 기준과 템플릿은 `rules/verifier/`
- 검증 증거는 `tickets/runs/`

## First Use

1. `rules/spec/project_001.md` 를 현재 프로젝트 기준으로 채운다.
2. 필요한 추가 기준이 있으면 `rules/spec/feature_*.md` 를 만든다.
3. `rules/plan/plan_001.md` 를 현재 프로젝트 계획으로 바꾸고 `Status` 를 `ready` 로 바꾼다.
4. `start plan` 으로 todo 티켓을 만든다.
5. `start todo` 로 claim 과 owner 배정을 한다.
6. `start` 로 execution worker 가 구현을 진행한다.
7. `start verifier` 로 verifier worker 가 검증한다.

24시간 자동화로 붙일 때는 각 worker 에 `AUTOFLOW_BACKGROUND=1` 을 주는 편이 좋다. 이 모드에서는 할 일이 없는 wake-up 이 실패가 아니라 idle 로 처리된다.

worker 수는 고정이 아니다. 프로젝트 상황에 따라 `execution` 과 `verifier` 수를 늘리거나 줄이고, 대응하는 pool 환경 변수만 같이 갱신하면 된다.

실제 Codex heartbeat 세트를 만들 때는 생성된 `automations/heartbeat-set.toml` 을 수정한 뒤 `autoflow render-heartbeats` 를 실행하면 된다. 결과는 `automations/rendered/<set-name>/` 아래에 생긴다.

프로젝트별 온보딩 메모, 배포 절차, 테스트 명령 모음 같은 보조 문서가 더 필요하면 `docs/` 폴더를 프로젝트 안에서 직접 추가해도 된다. 다만 canonical 규칙은 계속 `rules/` 아래에 둔다.

## Folder Map

- `agents/`: 역할 정의
  - `plan-to-ticket-agent.md`
  - `todo-queue-agent.md`
  - `execution-agent.md`
  - `verifier-agent.md`
- `automations/`: 훅 역할 설명
- `rules/`: 기준 문서 묶음
- `tickets/`: todo / inprogress / done 상태 보드
- `tickets/runs/`: 검증과 실행 기록
- `scripts/`: 보드 훅 스크립트

## Runtime Hooks

생성된 보드에는 아래 runtime 훅이 들어 있다.

- `start-plan.sh`
- `start-todo.sh`
- `start.sh`
- `start-verifier.sh`

스크립트는 두 루트를 구분한다.

- `BOARD_ROOT`: 현재 보드 폴더
- `PROJECT_ROOT`: 실제 제품 코드 루트

해석 순서:

1. `AUTOPILOT_PROJECT_ROOT`
2. `.project-root`
3. `BOARD_ROOT` 의 부모 폴더

역할 분리형 운영에서는 보통 아래 환경 변수를 같이 쓴다.

- `AUTOFLOW_ROLE`
- `AUTOFLOW_WORKER_ID`
- `AUTOFLOW_EXECUTION_POOL`
- `AUTOFLOW_VERIFIER_POOL`
- `AUTOFLOW_BACKGROUND`

## Path Rules

- `References` 는 이 보드 루트 기준 상대 경로로 적는다.
- `Allowed Paths` 는 호스트 프로젝트 루트 기준 상대 경로로 적는다.

예:

- `References`: `rules/spec/project_001.md`
- `Allowed Paths`: `src/`, `public/`, `package.json`

## Notes

- 실제 제품 코드는 이 보드 밖의 호스트 프로젝트 루트에 있다.
- 보드 상태 파일은 이 폴더 안에서 추적한다.
- 검증 명령은 보통 호스트 프로젝트 루트에서 실행한다.
