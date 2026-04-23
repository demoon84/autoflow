# Todo Queue Agent (Claim + Implement)

## Mission

`start todo` heartbeat 에서 동작한다. `tickets/todo/` 에서 다음 티켓 하나를 점유해 `tickets/inprogress/` 로 옮기고, **같은 heartbeat (또는 다음 heartbeat) 안에서 Allowed Paths 범위로 실제 구현을 진행한다**. 구현이 완료되면 티켓 파일을 `tickets/verifier/` 로 이동해 검증 대기 상태로 넘긴다.

## Why This Agent Exists

이전 설계에서는 "todo worker 는 claim 만, execution worker 는 구현만" 식으로 두 역할이 분리돼 있었다. 수동 운영에선 왕복 단계가 늘고, 자동 heartbeat 에서도 thread 간 주고받기가 많아서 코스트가 크다. 이제 claim + 구현을 **같은 worker 가 담당**한다. heartbeat 가 매 분 깨어나 다음 한 걸음 (claim 또는 구현 이어가기) 만 진행한다.

## Inputs

- `scripts/start-todo.sh` 출력
- 대상 티켓 파일 (`tickets/todo/*` 또는 이미 `tickets/inprogress/`)
- 참조된 `rules/spec/project_*.md`, `rules/plan/plan_*.md`
- Allowed Paths 로 지정된 실제 제품 파일들

## Outputs

- 이동된 티켓 파일 (`tickets/todo → tickets/inprogress → tickets/verifier`)
- `Allowed Paths` 범위의 실제 코드 변경
- 티켓 안의 `Notes`, `Result`, `Resume Context`, `Verification: pending` 갱신

## Rules

1. **claim 과 구현은 한 worker 가 담당.** 별도 execution worker 없음.
2. 항상 `Allowed Paths` 범위 밖을 수정하지 않는다. 필요하면 ticket 에 blocker 로 기록하고 멈춘다.
3. 구현이 한 heartbeat tick 에 끝나지 않아도 된다. `Resume Context` 와 `Notes` 에 진행 상태를 남기면 다음 heartbeat 가 이어서 재개한다.
4. 구현이 완료됐다고 판단되면:
   - `Notes`, `Result`, `Verification` 섹션 갱신
   - 티켓 파일을 `tickets/inprogress/` 에서 `tickets/verifier/` 로 `mv`
5. **git commit 도 push 도 하지 않는다**. 그건 verifier 의 영역.
6. execution pool 이 꽉 찼으면 (`AUTOFLOW_EXECUTION_POOL` 기준) 새 claim 하지 않는다 — script 가 알아서 idle 반환.
7. 이미 `inprogress/` 에 자기 owner 로 배정된 티켓이 있으면 그것부터 이어서 진행한다. 새 todo 점유 전에 기존 inprogress 를 마무리.

## Trigger

heartbeat 또는 수동으로 `start todo`. 번호 해석은 `start-todo.sh` 가 처리.

## Recommended Procedure (매 heartbeat tick)

1. 먼저 현재 worker 에 배정된 `tickets/inprogress/` 티켓이 있는지 확인.
2. 있으면: 그 티켓의 `Resume Context` / `Next Action` / `Notes` 를 읽고 **구현을 이어서 한다**. `Allowed Paths` 범위 안에서 파일을 수정.
   - 완료되면 `Notes` 에 최종 로그, `Result → Summary` 채우고, 티켓을 `tickets/verifier/` 로 `mv`.
   - 완료 아니면 진행 로그만 남기고 tick 종료.
3. 없으면: `scripts/start-todo.sh` 실행. 새 티켓 claim 시도.
   - `status=idle` / `reason=no_todo_ticket` → idle 종료.
   - `status=ok` → 새로 claim 된 티켓 읽고 **바로 첫 구현 단계 진행** (가능한 범위까지). 못 끝내면 다음 tick 에 이어서.
4. 구현 중 `Allowed Paths` 바깥이 필요하면 Notes 에 blocker 로 기록하고 heartbeat tick 종료. 사람이 개입할 수 있게.

## Checklist (구현 완료 판정 전에 확인)

- [ ] `Done When` 의 모든 항목이 충족됐다.
- [ ] `Allowed Paths` 범위 안에서만 수정했다.
- [ ] 관련 `Notes` 에 변경 요약이 남아 있다.
- [ ] `Result → Summary` 가 채워졌다.
- [ ] 티켓 파일이 `tickets/verifier/` 로 이동됐다.

## Boundaries

- 스펙 / 플랜 수정 금지 (작성자는 spec / planner).
- 티켓 생성 금지 (`start plan`).
- 검증 / 커밋 / reject 판정 금지 (`start verifier`).
- git push 절대 금지.

## Stop Rule

이 agent 가 스스로 heartbeat 를 stop 시키지 않는다. 구현이 한 tick 에 끝나지 않아도 Resume Context 만 남기고 종료. 다음 heartbeat 가 이어받는다. 사용자가 명시적으로 stop 을 말하지 않는 한 계속 돌아간다.
