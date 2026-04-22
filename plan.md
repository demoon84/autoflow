# Autoflow Handoff Plan

이 파일은 다른 대화나 다른 작업자가 이어서 작업할 수 있게 남기는 handoff 메모다.
`rules/`, `automations/`, `tickets/`, `agents/` 아래 문서를 대신하는 canonical runtime source of truth 는 아니다.

## Current Goal

- `Autoflow` 를 `repo template + installer CLI` 방식의 공개 배포 가능한 하네스로 유지한다.
- 실제 프로젝트에는 `autopilot/` sidecar 보드를 생성하고, worker 기반으로 `start plan -> start todo -> start -> start verifier` 흐름을 운영할 수 있어야 한다.

## Current State

- 루트 패키지 소스는 이제 `README.md`, `AGENTS.md`, `VERSION`, `agents/`, `automations/`, `rules/`, `scripts/`, `templates/`, `tickets/` 중심으로 정리돼 있다.
- sidecar 생성은 `bin/autoflow` 와 `scripts/scaffold-project.sh` 가 담당하고, 공용 자산 동기화는 `scripts/package-board-common.sh` 가 맡는다.
- generated board starter 상태는 루트 live 파일이 아니라 `templates/board/` 아래에서만 관리한다.
- root package 기준 스펙은 `rules/spec/autoflow-package-spec.md` 다.
- 생성된 보드는 기본적으로 아래 구조를 가진다.

```text
PROJECT_ROOT/
  AGENTS.md
  autopilot/
    AGENTS.md
    README.md
    agents/
    automations/
      heartbeat-set.toml
      templates/
    rules/
      spec/
      plan/
      verifier/
    scripts/
    tickets/
      todo/
      inprogress/
      done/
      runs/
```

## What Was Cleaned Up

### 1. plugin / docs / bootstrap 실험 흔적 정리

- plugin-first 흔적은 이미 제거했다.
- 루트 `docs/` 폴더는 삭제했고, 내용은 `README.md`, `tickets/README.md`, `automations/README.md`, `rules/spec/*.md` 로 흡수했다.
- `bootstrap/` 폴더는 삭제했고, 호스트 루트 `AGENTS.md` 템플릿은 `templates/host/AGENTS.md` 로 옮겼다.

### 2. verifier / runs / tickets 구조 재정리

- verifier 규칙과 템플릿은 `rules/verifier/` 아래로 정리했다.
- 검증 결과는 `tickets/runs/` 아래에 두는 구조로 맞췄다.
- `tickets/todo`, `tickets/inprogress`, `tickets/done` 하위 README 는 삭제했고, 상태 규칙은 `tickets/README.md` 로 흡수했다.
- `tickets/runs/README.md` 도 삭제했고, 관련 설명은 `tickets/README.md` 로 흡수했다.

### 3. 생성 보드 파일 수 줄임

- 생성 보드에 더 이상 아래 파일을 넣지 않는다.
  - `docs/README.md`
  - `scripts/README.md`
  - `tickets/todo/README.md`
  - `tickets/inprogress/README.md`
  - `tickets/done/README.md`
  - `tickets/runs/README.md`
  - `agents/README.md`
  - `automations/templates/README.md`
- 대신 필요한 설명은 `templates/board/README.md`, `tickets/README.md`, `automations/README.md` 에 흡수했다.
- 빈 상태 디렉터리 보장은 `scripts/package-board-common.sh` 의 `ensure_board_directories()` 로 처리한다.

### 4. root package 와 generated board sample state 분리

- 루트에 있던 sample/live 상태 파일은 삭제했다.
  - `rules/spec/project_001.md`
  - `rules/plan/plan_001.md`
  - `tickets/todo/tickets_001.md`
- generated board starter 파일은 계속 `templates/board/rules/spec/project_001.md`, `templates/board/rules/plan/plan_001.md`, `templates/board/rules/plan/roadmap.md` 에서 관리한다.
- 루트 패키지 소스 기준 스펙으로 `rules/spec/autoflow-package-spec.md` 를 추가했다.
- `rules/plan/plan_004.md` 는 이제 package spec 를 참조한다.

### 5. 로컬 잡파일 정리

- `.obsidian/`
- `.DS_Store`

위 흔적은 모두 제거했다.

## Important Files

### Entry points

- `bin/autoflow`
- `scripts/scaffold-project.sh`
- `scripts/status-project.sh`
- `scripts/doctor-project.sh`
- `scripts/upgrade-project.sh`
- `scripts/render-heartbeats.sh`

### Generated board sources

- `templates/host/AGENTS.md`
- `templates/board/AGENTS.md`
- `templates/board/README.md`
- `templates/board/automations/heartbeat-set.toml`
- `templates/board/rules/spec/project_001.md`
- `templates/board/rules/plan/plan_001.md`
- `templates/board/rules/plan/roadmap.md`

### Canonical package docs

- `README.md`
- `AGENTS.md`
- `rules/spec/autoflow-package-spec.md`
- `rules/spec/public-distribution-spec.md`
- `rules/spec/autoflow-cli-spec.md`
- `automations/README.md`
- `tickets/README.md`

## What Was Verified

반복적으로 아래 검증을 돌려서 정리 작업이 깨지지 않는 걸 확인했다.

```bash
bash -n bin/autoflow scripts/*.sh
./bin/autoflow init /tmp/<temp-project>
./bin/autoflow doctor /tmp/<temp-project>
```

최근 상태 기준 검증 결과:

- fresh `autoflow init` 성공
- fresh `autoflow doctor` 결과 `status=ok`
- `error_count=0`
- `warning_count=0`

즉 현재 패키지로 새 `tetris` 같은 host project 에 `autopilot/` 보드를 생성하는 흐름은 살아 있다.

## Remaining Work

### 1. root 문서의 example path 문맥 더 명확히 하기

아직 루트 문서에는 아래처럼 `rules/spec/project_001.md`, `rules/plan/plan_001.md`, `tickets_001.md` 같은 예시가 남아 있다.
이건 대부분 generated board 기준 example 이라 기능상 문제는 없지만, 루트 package source 에 그 파일이 이제 없어서 처음 보는 사람은 헷갈릴 수 있다.

후보 파일:

- `README.md`
- `AGENTS.md`
- `tickets/README.md`

권장 조치:

- example 앞에 `generated board example:` 같은 문구 추가
- 필요하면 `templates/board/...` 기준과 runtime example 을 더 명확히 분리

### 2. root package 문서와 generated board 문서 경계 더 줄일지 검토

현재는 의도적으로 아래 둘을 분리해 두고 있다.

- root package 문서
- generated board 문서

이 분리는 맞는 방향이지만, 앞으로 더 줄일 수 있는 후보는 있다.

후보:

- `scripts/README.md`
- `README.md` 와 `templates/board/README.md` 사이 중복
- `AGENTS.md` 와 `templates/board/AGENTS.md` 사이 중복

주의:

- 이건 단순 삭제보다 경로 문맥 차이 때문에 조심해야 한다.
- root `AGENTS.md` 는 package source 를 설명하고, `templates/board/AGENTS.md` 는 generated board runtime 규칙을 설명한다.
- `README.md` 도 package readme 이고 `templates/board/README.md` 는 generated board onboarding 이다.

즉 완전 병합보다는 “중복 문장 축소” 정도로 가는 것이 더 안전하다.

### 3. roadmap 성격 정리

현재 루트 `rules/plan/roadmap.md` 는 package source 의 실제 roadmap 성격이다.
반면 generated board 의 starter roadmap 은 `templates/board/rules/plan/roadmap.md` 다.

기능상 문제는 없지만, 이름이 같아서 역할이 헷갈릴 수 있다.

선택지:

- 그대로 유지
- root 쪽 roadmap 에 package scope 설명을 더 추가
- root 쪽을 package 전용 문맥으로 더 명시

### 4. 실제 Tetris 시연 단계로 넘어가기

하네스 정리 이후 실질적인 다음 목표는 이 저장소가 아니라 fresh host project 에서 아래를 시연하는 것이다.

1. 빈 `tetris/` 생성
2. `autoflow init tetris`
3. `rules/spec/project_001.md` 작성
4. `rules/plan/plan_001.md` 를 `ready` 로 전환
5. `start plan`
6. worker 기반 `start todo`, `start`, `start verifier` 흐름으로 실제 게임 구현

즉 다음 큰 milestone 은 “Autoflow 하네스로 테트리스를 실제로 만들어내는 end-to-end 시연”이다.

## Suggested Next Task Order

1. `README.md`, `AGENTS.md`, `tickets/README.md` 의 generated board example 표기를 더 명확히 한다.
2. root `scripts/README.md` 가 여전히 필요한지 재검토한다.
3. fresh `tetris/` 프로젝트를 만들고 `autoflow init` 부터 실제 E2E 시연을 시작한다.

## Notes For Next Worker

- 루트에서 `project_001.md`, `plan_001.md`, `tickets_001.md` 를 다시 만들 필요는 없다.
- starter 상태는 항상 `templates/board/` 를 source of truth 로 본다.
- 구조 정리 후에는 매번 `bash -n`, fresh `autoflow init`, fresh `autoflow doctor` 를 같이 돌리는 편이 안전하다.
- 생성 보드에 더 이상 `docs/`, 상태별 README, `runs/README`, `scripts/README` 를 기대하면 안 된다.
- 현재 기준에서 가장 가치가 큰 다음 작업은 “문서 경계 마지막 다듬기” 또는 “실제 tetris 프로젝트 시연” 둘 중 하나다.
