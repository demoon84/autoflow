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

### 1. root 문서의 example path 문맥 명확히 하기 (done 2026-04-23)

완료 내용:

- `README.md` 의 `Upgrade Contract` 보존 목록과 `Path Rules` 예시 앞에 “경로는 모두 generated board 기준이며 루트 패키지 소스에는 해당 파일이 없다” 문구 추가.
- `AGENTS.md` 의 `Ticket Lifecycle` 예시에 “generated board example — 루트 패키지 소스에는 이 티켓 파일이 없다” 문구 추가.
- `tickets/README.md` 는 생성 보드에도 복사되므로 “예시 번호 `001` 을 쓴 파일 이동 패턴” 식으로 중립적인 phrase 로 조정.

### 2. root package 문서와 generated board 문서 경계 정리 (partial done 2026-04-23)

완료 내용:

- `templates/board/scripts/README.md` 는 scaffold 가 복사하지 않는 dead content 라 제거. 생성 보드는 계속 `scripts/` 아래에 README 를 두지 않는다.
- root `scripts/README.md` 는 유지. package CLI 보조 스크립트 (cli-common, package-board-common 등) 를 설명하는 유일한 문서라 제거하지 않음.

남은 고려사항:

- `README.md` vs `templates/board/README.md` 문장 단위 중복 축소 — 아직 미실행. 두 README 가 대상 audience 가 다르니 “완전 병합” 은 위험하고, 원한다면 “중복 문장 몇 줄 정리” 만 한다.
- `AGENTS.md` vs `templates/board/AGENTS.md` 중복 - 이건 의도적 중복. 루트 저장소도 보드로 운영하기 때문.

### 3. roadmap 성격 정리 (done 2026-04-23)

완료 내용:

- 루트 `rules/plan/roadmap.md` 상단에 “이 로드맵은 **Autoflow 패키지 소스 자체**의 방향을 다룬다” 문구 추가. 생성 보드 starter roadmap 위치도 같이 언급.
- `templates/board/rules/plan/roadmap.md` 상단에도 “이 로드맵은 generated board 의 starter 템플릿이다. 프로젝트 상황에 맞게 직접 채워야 한다” 문구 추가.

### 4. 실제 Tetris 시연 (bootstrap done 2026-04-23)

완료 내용:

- `D:/lab/tetris/` 생성 후 `autoflow init /d/lab/tetris` 로 보드 초기화 완료.
- `autopilot/rules/spec/project_001.md` 를 Tetris 실제 스펙으로 교체 (vanilla JS, 10x20, 7종 블록, 키보드 입력, 점수/레벨/게임오버/일시정지).
- `autopilot/rules/plan/plan_001.md` 를 Tetris 실제 plan 으로 교체하고 `Status: ready` 로 전환. `Execution Candidates` 11개 선언.
- `AUTOFLOW_ROLE=plan autopilot/scripts/start-plan.sh` 실행해서 `tickets/todo/tickets_001.md` ~ `tickets_011.md` 11개 생성 완료. plan 상태는 `ticketed` 로 전환됨.
- `autoflow doctor /d/lab/tetris` 는 `status=ok`, `error_count=0`, `warning_count=0`.

남은 일:

- `start todo` 로 todo 티켓 하나를 claim 해서 inprogress 로 이동시키는 것부터가 다음 세션의 첫 단계.
- 11개 티켓을 execution/verifier 흐름으로 하나씩 처리해서 `public/index.html` 이 실제로 브라우저에서 돌아가는 상태까지 끌고 가는 것이 남은 end-to-end 목표.
- 병렬로 돌릴 경우 `AUTOFLOW_EXECUTION_POOL`, `AUTOFLOW_VERIFIER_POOL`, `AUTOFLOW_BACKGROUND=1` 조합을 쓴다.

### 5. common.sh 에서 발견한 실제 버그 (fixed 2026-04-23)

완료 내용:

- `scripts/common.sh` 의 `next_ticket_id()` 가 `find ... -name 'tickets_*.md'` 로 `tickets/` 전체를 훑을 때 `tickets/tickets_template.md` 까지 포함했다.
- 이 경우 `extract_numeric_id` 가 빈 문자열을 리턴하고, 이어지는 `”$((10#$id))”` 가 `10#: invalid integer constant` 로 죽었다.
- `id=”$(extract_numeric_id “$path” 2>/dev/null || true)”` 로 감싸고 `[ -n “$id” ] || continue` 가드를 추가해 해결.
- 이 수정은 `autoflow upgrade /d/lab/tetris` 로 tetris 보드에도 이미 반영됨 (`managed_files_updated=1`).

## Suggested Next Task Order

1. `start todo` 로 tetris `tickets_001.md` 를 claim → inprogress 로 이동.
2. `start` 로 실제 구현 진행 (execution worker).
3. `start verifier` 로 검증.
4. 11개 티켓을 순서대로 (또는 병렬로) 처리해서 playable tetris 완성.
5. 완성 후 `rules/plan/plan_002.md` 등으로 다음 iteration (사운드, 고득점, 모바일 등) 계획.

## Notes For Next Worker

- 루트에서 `project_001.md`, `plan_001.md`, `tickets_001.md` 를 다시 만들 필요는 없다.
- starter 상태는 항상 `templates/board/` 를 source of truth 로 본다.
- 구조 정리 후에는 매번 `bash -n`, fresh `autoflow init`, fresh `autoflow doctor` 를 같이 돌리는 편이 안전하다.
- 생성 보드에 더 이상 `docs/`, 상태별 README, `runs/README`, `scripts/README` 를 기대하면 안 된다.
- 위에서 발견된 `next_ticket_id()` 버그처럼 runtime 실행 경로를 실제로 돌려 봐야만 드러나는 버그가 남아 있을 수 있다. E2E 시연이 최고의 regression test 다.
- Tetris 보드 시연이 본격적으로 이어지는 위치: `D:/lab/tetris/autopilot/`. 루트 autoflow 저장소는 `tetris` 와 별개로 유지된다.
