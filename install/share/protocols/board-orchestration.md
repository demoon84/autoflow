# 보드 오케스트레이션 프로토콜

## 목적

플래너 러너는 보드 orchestrator다. 플래너 러너는 단순한 PRD-to-ticket 변환만이 아니라 보드 상태의 의미를 소유한다.

Shell runtime은 safety kernel이다. 파일 claim, worktree 생성, 상태 검증, 결정론적 위키 페이지 refresh, pass 이후 로컬 commit 생성을 할 수 있다. 하지만 워크플로의 두뇌가 되어서는 안 된다.

planner/worker/verifier/wiki entrypoint와 helper contract의 안정적인 목록이 필요하면 `autoflow tool list`를 기준 catalog로 사용한다. 이 catalog는 설명용이며, workflow decision은 여전히 AI가 소유한다.

## Orchestrator 책임

플래너 러너는 전체 planning lane과 워커 러너가 티켓에 남긴 health signal을 본다.

- `tickets/prd/`
- `tickets/todo/` (`Goal Runtime.Replan Count`가 포함된 verifier replan requeue도 받는다)
- `tickets/inprogress/`
- `tickets/done/`
- stalled 또는 blocked diagnosis가 필요할 때 runner state와 log

변경이 보드 상태 안에 머물고 다음 worker turn을 개선한다면, 플래너 러너는 ticket markdown을 rewrite, split, requeue, annotate 할 수 있다.

## 결정 순서

각 planner tick에서:

1. planner queue snapshot 또는 focused planner startup surface를 통해 actionable PRD work를 검사한다.
2. runner stall, stale worktree metadata, repeated replan, blocked worker state 증거가 있으면 더 많은 일을 만들기 전에 active/todo ticket의 health를 검사한다.
3. 반복 실패, 관련 done ticket, architecture constraint가 있으면 wiki query를 사용한다.
4. 해당 tick에서 정확히 하나의 안전한 board action을 선택한다.

## 보드 행동

플래너 러너는 markdown에서 다음 행동을 직접 수행할 수 있다.

- plan 또는 PRD에서 하나 이상의 todo ticket 생성. **모든 PRD는 archive 전에 ≥1 Todo를 만들어야 한다**. `## Todo Split Map`이 없어도 runtime slicer는 Goal+Allowed Paths에서 base slice를 만든다.
- replan evidence를 갱신된 ticket attempt에 반영. 티켓은 이미 `Goal Runtime.Replan Count`가 증가된 채 `tickets/todo/`로 돌아와 있으며, 같은 fingerprint가 반복되면 플래너가 `Next Action`/`Notes`를 명확히 한다.
- 워커에게 더 명확한 다음 행동이 필요할 때 `Next Action`, `Resume Context`, `Notes`, `Allowed Paths`, `Done When`, `Verification`을 rewrite.
- 너무 넓거나 반복 실패하는 티켓을 더 좁은 todo ticket으로 split.
- 이전 상태가 archive 되었거나 `Notes`에 명시적으로 설명된 경우에만 ticket requeue.

플래너 러너는 다음을 해서는 안 된다.

- 새 product code 작성
- git worktree 직접 생성 또는 삭제
- runner 또는 OS process 직접 관리(`kill`, `pkill`, runner start/stop/restart, background cleanup)
- product file의 merge conflict 해결. 실제 conflict resolution은 워커 러너의 책임이다.
- 워커 러너를 위한 최종 pass/replan bookkeeping 실행
- push(`git push`는 모든 mode에서 금지), `git reset --hard`, `git clean -fd`, non-orchestration commit amend, `git rm`

Dirty root conflict는 blocked evidence이지 planner cleanup work가 아니다. planner turn에서 `PROJECT_ROOT`를 stage, stash, commit, clean 하지 말고 보드 markdown에 증거를 기록한 뒤 다음 행동을 워커 러너 또는 사용자 경계로 route 한다.

기본 행동은 멈춤이 아니라 통합이다. Autoflow 제1원칙(`멈추지 않는다`)은 완벽한 분류보다 우선한다.

## 상태 출처

source of truth는 ticket markdown과 board folder다. 채팅 출력은 tick summary일 뿐이다.

플래너가 orchestration 때문에 ticket을 변경하면 다음에 지속 증거를 남겨야 한다.

- `Next Action`
- `Resume Context`
- `Notes`

Orchestration evidence는 loop tick 사이에서 멱등적이어야 한다. 현재 `Next Action`, `Notes`, `Resume Context`가 이미 같은 blocker와 같은 planner direction을 설명한다면 또 다른 confirmation note를 붙이지 않는다. tick summary에는 unchanged blocker를 보고하고, 새 증거가 나타날 때까지 ticket markdown은 안정적으로 둔다.

## Safety Kernel 경계

Shell 또는 CLI helper는 atomicity가 중요한 작업에만 사용한다.

- ticket lock 또는 claim
- state folder 사이 파일 이동
- git worktree 생성, prune, 검사
- board invariant 검증
- markdown edit 이후 `autoflow guard` 실행
- pass/replan log finalize
- 결정론적 wiki baseline refresh
- 로컬 pass commit 생성

Helper output은 증거다. 결과가 무엇을 뜻하는지와 다음 board action은 여전히 플래너 러너가 결정한다.

## 실행 경계 매트릭스

| Helper 또는 command | Safety-kernel 책임 | AI 소유 결정 |
| --- | --- | --- |
| `autoflow run planner` | PRD input을 atomic 하게 todo file로 promote 하고 idle signal을 노출한다. | source request가 안전한지, split이 필요한지, replan-returned todo의 markdown에 어떤 blocked/replan instruction을 남길지 결정한다. |
| `autoflow run worker` / `autoflow run ticket` | 소유 중인 active ticket context 또는 다음 todo candidate를 보고한다. ticket claim, worktree 생성, 작업 선택, `PROJECT_ROOT` fallback을 해서는 안 된다. | ticket을 선택하고, `autoflow tool runner-tool worker claim` 또는 `autoflow tool runner-tool worker worktree-ensure`를 명시적으로 호출하고, mini-plan을 작성하고, blocked evidence가 worker repair, `Next Action`/`Notes`를 통한 planner re-orchestration, 사용자 입력 중 무엇을 요구하는지 결정한다. |
| `autoflow tool list` | 안정적인 CLI/script/helper entrypoint와 얇은 contract를 나열한다. | 어떤 helper를 어떤 순서로 호출할지, 현재 ticket 또는 planner turn에서 출력을 어떻게 해석할지 결정한다. |
| `autoflow tool runner-tool worker verification-record` / `autoflow tool verify-ticket` | 워커 러너가 이미 command를 실행하고 검사했을 때 verification evidence를 기록한다. | 검증이 ticket goal과 Done When을 만족함을 증명하는지 결정한다. |
| `autoflow tool runner-tool worker submit-to-verifier|request-replan|finalize-approved` | Backend finalizer wrapper다. 기계적 sanity gate를 실행하고, replan-returned ticket을 `tickets/todo/`로 requeue 하고, 워커 결정 뒤 merge 된 결과를 validate/archive/commit 한다. | pass/revise/replan을 결정하고, verifier-approved change를 `PROJECT_ROOT`에 통합하고, conflict를 해결하고, 최종 승인 finalization 전에 필요한 verification을 다시 실행한다. |
| `autoflow tool merge-ready-ticket` | worker-merged product state가 ticket/worktree expectation과 맞는지 검증하고 unsafe merge state를 거부한다. | rebase, cherry-pick, conflict resolution, product-file merge decision을 수행한다. |
| `autoflow wiki write-page` / `autoflow wiki upsert` | wiki 페이지를 wiki-search.db 에 chunk + embedding 으로 upsert 한다 (디스크 markdown 안 만듦). | 의미적 wiki knowledge 를 synthesize 한다. 이는 inline worker finalization 이 아니라 `wiki` 의 책임이다. |
| `autoflow guard` | AI가 작성한 markdown edit 이후 board invariant를 검증한다. | guard output을 해석하고 더 많은 work를 만들기 전에 ticket markdown을 repair 한다. |

Helper가 `blocked`, `needs_ai_merge`, `warning`, `error`를 보고하면 다른 shell step으로 우회하지 않는다. 증거를 board markdown에 보존하고 책임 러너가 다음 안전한 행동을 선택하게 한다.

Runner 또는 process health가 이상해 보이면 플래너의 안전한 행동은 ticket `Notes`, `Next Action`, `Resume Context`에 증거를 기록하는 것이다. Adapter turn 안에서 process를 kill 하거나, runner를 restart 하거나, 관련 없는 background command를 정리하면 안 된다.
