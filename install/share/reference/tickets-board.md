# 티켓 보드

이 디렉터리는 `BOARD_ROOT` 안의 상태 보드다.

- `prd/`: 아직 ticket work가 되지 않은 approved PRD(`/aprd`에서 생성).
- `todo/`: worker-ready ticket. PRD에서 플래너 러너가 발행하거나 `/atodo`가 직접 작성한다. 검증 러너의 replan도 `Replan Count` / `Replan Decision` metadata를 붙여 ticket을 여기로 되돌린다.
- `inprogress/`: claim 된 `Todo-*.md` 파일. Verification evidence는 각 ticket의 `## Verification` 섹션에 둔다. Legacy planner `plan_*.md` 파일도 ticket 생성 중 이 상태를 사용할 수 있다.
- `verifier/`: 검증 러너를 위한 active semantic-review lane. Legacy verifier-compatible ticket도 여기에 나타날 수 있다.
- `done/`: 성공한 ticket, archived PRD, legacy history를 project key별(`done/<project-key>/`)로 묶는다.
- `ready-to-merge/`와 `merge-blocked/`: 오래된 Worker finalization flow를 위한 legacy compatibility state.
- `check/`: 오래된 planner intervention용 retired human-review ledger. 기본 4-runner flow의 일부가 아니다.
- `plan/`: legacy role-pipeline plan document.

모든 active `Todo-*.md` 파일은 다음 claim field를 가져야 한다.

- `AI`
- `Claimed By`
- `Execution AI`
- `Verifier Runner`

Legacy ticket에는 여전히 `Verifier AI`가 있을 수 있다. 이를 `Verifier Runner`의 read-only alias로 취급한다.

Ticket filename은 `Todo-NNN.md` 형식을 사용한다. 예: `TODO-001.md`, `TODO-014.md`, `TODO-120.md`.

## 러너 용어

기본 행위자는 네 가지 **runner**다: `planner`, `worker`, `verifier`, `wiki`. 러너는 LLM 기반 decision-maker다. **runner tool**은 러너가 보드를 안전하게 변경하거나 검사하기 위해 호출하는 작고 결정론적인 명령이다. 기준 경계는 `reference/runner-tool-contract.md`다.

Planner work에서는 `queue-snapshot`, `reserve-id`, `write-prd`, `write-ticket`, `item-archive`, `guard`처럼 작은 additive action에 `autoflow tool runner-tool planner ...`를 우선한다. 이 도구들은 러너 대신 scope를 선택하거나 plan을 쓰지 않는다. 선택된 board operation을 안전하고 감사 가능하게 만들 뿐이다.

## 생명주기

기본 4-runner flow(PRD path):

```text
tickets/prd/PRD-001.md
  -> tickets/todo/TODO-001.md
  -> tickets/inprogress/TODO-001.md
  -> tickets/verifier/TODO-001.md
  -> tickets/done/PRD-001/TODO-001.md
```

Direct todo path(single-file mechanical work):

```text
tickets/todo/TODO-001.md   (/atodo 또는 autoflow todo create가 직접 작성)
  -> tickets/inprogress/TODO-001.md
  -> tickets/verifier/TODO-001.md
  -> tickets/done/<project-key>/TODO-001.md
```

Verifier replan path(같은 ticket, 새 worker attempt):

```text
tickets/inprogress/TODO-001.md
  -> tickets/verifier/TODO-001.md
  -> (verifier decision: replan)
  -> tickets/inprogress/TODO-001.md  (replan_requested)
  -> tickets/todo/TODO-001.md  (Replan Count 증가, worktree 정리)
  -> tickets/inprogress/TODO-001.md  (new worktree)
```

Legacy role-pipeline flow:

```text
tickets/prd/PRD-001.md
  -> tickets/plan/plan_001.md
  -> tickets/inprogress/plan_001.md
  -> tickets/todo/TODO-001.md
  -> tickets/inprogress/TODO-001.md
  -> tickets/verifier/TODO-001.md
  -> tickets/done/PRD-001/TODO-001.md
```

이 예시는 `001`을 사용하지만, 각 보드는 자체 번호를 할당한다.

Verification evidence는 ticket markdown(`## Verification`, `## Result`, 관련 note)에 둔다. Worker Mode에서 워커 러너는 local verification을 실행하고 판단한 뒤, 어떤 merge보다 먼저 검증 러너에게 handoff 하고, 이후 검증 결정을 처리한다. PRD track에서는 TODO가 별도 TODO worktree를 만들지 않고 해당 PRD branch(`autoflow/prd-NNN`) worktree 안에서 처리된다. pass 시 워커는 성공한 ticket을 `tickets/done/<project-key>/` 아래 archive 하고 PRD branch에 누적한다. 같은 PRD의 모든 TODO가 `done/PRD-NNN/`에 도달하면 마지막 TODO를 완료한 워커 러너가 PRD branch를 `main`으로 단일 PRD commit으로 squash-merge 하고 PRD 파일도 `done/PRD-NNN/`에 archive 한다. PRD가 없는 atodo ticket은 direct TODO worktree를 사용하고 해당 워커 러너가 직접 `main`으로 squash-merge 한다. revise 시 워커는 같은 worktree를 유지하고 다시 제출한다. replan 시 워커는 `request-replan`을 실행해 worktree를 정리하고, 같은 ticket을 replan metadata(`Replan Count`, `Replan Decision`, `Replan Fingerprint`)와 함께 `tickets/todo/`로 되돌려 새 attempt를 준비한다. 자세한 내용은 [prd-branch-policy.md](prd-branch-policy.md)를 본다.

## 상태 규칙

- `prd/`
  - ticket execution이 시작되기 전 `/aprd`로 handoff 된 project spec을 담는다.
  - 작업이 시작되면 소비된 PRD를 `done/<project-key>/`로 옮긴다.
- `todo/`
  - 아직 시작하지 않은 ready work를 담는다.
  - 명확한 `Goal`, `References`, `Allowed Paths`, `Done When`이 필요하다.
  - 새 Todo ticket에는 `reference/todo-template.md`를 사용한다. `reference/ticket-template.md`는 오래된 board를 위한 compatibility template으로 남긴다.
  - 파일이 `todo/`에 있으면 title 또는 acceptance criteria가 review나 verification을 언급하더라도 implementation work로 취급한다.
  - 워커 러너는 파일 하나를 `inprogress/`로 이동해 claim 한다.
  - Verifier replan은 기존 ticket을 `Replan Count`가 증가된 채 여기로 되돌린다. 같은 `Todo-NNN.md` filename을 유지하고, worktree는 정리되어 새 worker claim을 기다린다.
- `inprogress/`
  - `Todo-*.md` 파일은 워커 러너가 claim 한 파일이다.
  - Legacy `plan_*.md` 파일은 플래너가 plan에서 ticket을 생성 중임을 뜻한다.
  - 하나의 agent conversation은 한 번에 하나의 `Todo-*.md` 파일만 active 처리해야 한다.
  - 같은 워커가 이미 `inprogress` ticket을 가지고 있으면 새 ticket을 claim 하지 말고 해당 ticket을 재개한다.
  - 필수 field에는 `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier Runner`, `PRD Key`, `Worktree`, `Last Updated`, `Next Action`, `Resume Context`가 포함된다.
  - git repository에서는 ticket worktree가 있으면 워커가 그곳에서 작업한다.
  - blocker는 이 상태에 남긴다. blocked work를 `todo/`로 되돌리지 않는다.
  - Worker Mode는 하나의 ticket 안에서 implementation, local verification, verifier handoff, verifier-approved merge를 이어간다. `autoflow tool finish-ticket`은 verifier pass 이후, 그리고 `PROJECT_ROOT`가 이미 worker-merged result를 포함한 뒤에만 finalize 한다.
- `verifier/`
  - active verifier runner의 semantic review를 기다리는 ticket을 담는다. 이 상태에서는 같은 ticket number가 `inprogress/`에 남아 있지 않다.
  - 검증 러너는 finished diff를 ticket Title, Goal, Done When item과 비교한다.
  - pass 시 검증 러너는 pass marker를 기록하고, verifier ticket을 `tickets/inprogress/`로 되돌린 뒤 worker merge-pending state로 바꾼다. 워커 러너는 다음 명시적 실행에서 merge/finalization을 재개한다.
  - revise 시 검증 러너는 verifier ticket을 `tickets/inprogress/`로 되돌린 뒤 `revision_requested`로 바꾼다. 워커 러너는 다음 명시적 실행에서 같은 worktree를 보정한다.
  - replan 시 검증 러너는 verifier ticket을 `tickets/inprogress/`로 되돌린 뒤 `replan_requested`로 바꾼다. 워커 러너는 다음 명시적 실행에서 `request-replan`을 수행해 worktree cleanup과 `tickets/todo/` requeue를 처리한다.
- `done/`
  - verification을 통과하고 PRD branch(또는 atodo ticket의 경우 `main`)에 merge 된 work를 담는다.
  - ticket은 project key별로 묶는다. 예: `done/PRD-001/`. 워커 러너의 PRD 최종 squash 이후 archived PRD file은 `done/PRD-001/PRD-001.md`에 위치한다.
  - `Result`, ticket `## Verification`, checked `## Done When`을 연결한다.
- `plan/`
  - ticket 생성 전 legacy plan을 담는다.
  - Legacy planner는 spec에서 `plan_*.md`를 쓰거나 갱신한다.
- `inprogress/plan_*.md`
  - 현재 ticket으로 변환 중인 legacy plan을 담는다.
  - ticket 생성 뒤 plan을 `done/<project-key>/plan_NNN.md`로 옮긴다.
권장 `Stage` sequence:

- `todo` -> `claimed` -> `executing` -> `verifying` -> `verify_pending` -> `verified_pending_merge` / `revision_requested` / `replan_requested` -> `done` / `blocked`

`replan_requested` 이후 워커의 `request-replan` action은 fresh claim을 위해 ticket을 `Stage: todo`로 되돌린다.

## 필수 Ticket Field

모든 ticket은 다음 section 또는 field를 유지해야 한다.

- `ID`, `Title`, `Stage`, `AI`, `Claimed By`, `Execution AI`, `Verifier Runner`
- `PRD Key` (may be empty for `/atodo`-direct tickets)
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Goal Runtime`
- `Reference Notes`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`
- verifier replan 이후: `Goal Runtime.Replan Count` / `Replan Max` / `Replan Decision` / `Replan Fingerprint`와 `## Replan Reason` block.

중요:

- `References` path는 `BOARD_ROOT` 기준 상대 경로다.
- `Allowed Paths`는 repository-relative다. 구현 중에는 ticket worktree root가 있으면 그 기준으로 해석하고, 없으면 `PROJECT_ROOT` 기준으로 해석한다.
- `Goal Runtime`은 runner-owned durability metadata다. active/blocked/complete status, tick count, elapsed time, no-progress suppression, replan metadata, adapter가 사용한 마지막 ticket fingerprint를 추적한다. 사람과 agent는 읽을 수 있지만, 명시적 board repair가 아닌 한 손으로 편집하지 않는 것이 좋다.
- ticket number는 한 번에 하나의 state folder에만 있어야 한다. Worker handoff는 `tickets/inprogress/` 파일을 `tickets/verifier/`로 이동하고, 검증 결정은 같은 파일을 다시 `tickets/inprogress/`로 이동한다. Replan은 같은 ticket number를 유지하며, 파일만 `tickets/todo/`로 되돌린다.
- `prd/`, `todo/`, `inprogress/`, `verifier/`, `done/`은 기본 state board다. nested README file 없이 비어 있어도 된다.
- `done/<project-key>/` ticket은 최종 `## Verification` evidence를 가져야 한다.
- 관련 spec, ticket, verification note는 `## Reference Notes`로 연결한다.
- 러너는 스스로 멈추지 않는다. `status=idle`은 유효한 대기 상태다.
- Board location이 권위적이다. 4-runner topology(planner + worker + verifier + wiki)에서 플래너는 board orchestration, 워커는 implementation과 merge preparation, 검증 러너는 semantic diff review, 위키 러너는 derived knowledge를 소유한다.
