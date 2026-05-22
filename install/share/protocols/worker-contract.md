# 워커 계약 프로토콜

## 목적

워커 러너는 한 번에 하나의 티켓을 실행한다. 플래너 러너는 보드 상태와 blocked/replan 후속 조율을 맡고, 워커 러너는 구현, 검증, merge, 지속 가능한 진행 기록을 담당한다.

## 제1원칙

Autoflow는 AI 주도 시스템이다. Runtime shell script는 AI를 위한 결정론적 도구이지, 워커를 대체하거나 숨어서 결정을 내리는 행위자가 아니다.

AI는 계획, 범위 해석, blocked/replan 처리 결정, 검증 판단, pass/revise/replan 해석, merge 판단, 다음 안전한 행동을 소유한다. Shell helper는 좁고 검사 가능한 작업과 안정적인 `key=value` 출력을 제공해 그 행동을 편리하고 반복 가능하게 만들어야 한다.

Shell helper는 보드 상태 claim, worktree/branch 생성 또는 정리, 증거 기록, 파일 이동, guard 실행, 이미 승인된 결과의 stage/commit, blocker 보고를 할 수 있다. 하지만 티켓이 올바른지 결정하거나, 범위를 조용히 넓히거나, 의미적 conflict를 해결하거나, AI가 markdown에 결정을 기록하지 않은 상태에서 방향을 선택하는 행위자가 되어서는 안 된다.

## 로컬 변경 격리

`PROJECT_ROOT`의 dirty change는 AI가 증거와 함께 명시적으로 commit, stash, integrate 하기 전까지 사용자 또는 다른 러너의 작업으로 취급한다. 티켓 워커는 티켓의 구체적 `Allowed Paths`와 겹치고 티켓 worktree 결과와 다른 dirty file 위에서 새 구현을 시작하거나, pass를 끝내거나, merge를 finalize 해서는 안 된다.

Runtime helper는 이를 `dirty_project_root_conflict` / `blocked_dirty_project_root`로 보고해야 한다. 워커는 먼저 로컬 변경 경계를 해결한 뒤 티켓을 다시 실행해야 한다. 이 규칙은 사용자 편집을 보호하고, 이후 worktree merge가 더 오래된 파일 내용을 더 최신 로컬 작업 위에 되살리는 일을 막는다.

## 커밋 메시지 계약

모든 Autoflow pass/completion commit subject는 runtime finalizer가 결정한다. 워커 러너는 긴 LLM summary, terminal transcript, `... [truncated]` 문자열을 commit subject로 넘기거나 직접 subject에 넣지 않는다.

```text
PRD-NNN 완료
TODO-NNN 완료
```

PRD track의 최종 main/master squash commit은 `PRD-NNN 완료`, direct atodo squash commit은 `TODO-NNN 완료`를 기본 subject로 쓴다. PRD worktree 내부 ticket snapshot commit은 `TODO-NNN done` 또는 `TODO-NNN snapshot` 같은 짧은 기계적 subject만 쓴다. 커밋 메시지 20자 제한은 권고 사항이지만, runtime은 오염된 summary가 subject에 들어가지 않도록 고정된 짧은 subject를 사용한다.

## 워커 책임

워커 러너는 다음을 소유한다.

- claim 한 티켓, PRD, reference, wiki context 읽기
- 코드 변경 전에 mini-plan 작성
- `Allowed Paths`만 수정
- verification command 실행과 해석
- 검증된 변경을 `PROJECT_ROOT`에 수동 merge
- 티켓 범위 안의 product-file conflict 해결
- AI가 결과를 판단한 뒤에만 finish/finalizer helper 사용

## 지속 가능한 진행 기록

완료되지 않은 모든 worker tick은 적어도 하나의 지속 진행 필드를 갱신해야 한다.

- `Notes`
- `Resume Context`
- `Next Action`
- `Verification`
- `Result`

Adapter goal guardrail은 동일한 no-progress continuation을 억제할 수 있다. 채팅에만 남은 진행 상황에 의존하지 않는다.

## Blocked 동작

blocked 상태에서는 워커 러너가 플래너 orchestration을 위해 blocker를 분류해야 한다.

- `unclear_scope`
- `missing_dependency`
- `verification_failed`
- `merge_conflict`
- `dirty_root`
- `stale_worktree`
- `allowed_path_conflict`
- `adapter_no_progress`
- `tooling_failure`
- `needs_user_decision`

티켓에는 다음이 포함되어야 한다.

- 관찰된 증거
- 시도한 내용
- 워커가 안전하게 계속할 수 없는 이유
- 플래너 또는 워커가 취할 가장 작은 다음 행동

플래너 러너가 `Stage: blocked` 티켓에 `Goal Runtime: needs_user`를 기록해 ticket을 park 하면, worker runtime은 해당 ticket을 parked 상태로 취급한다. 증거는 `tickets/inprogress/`에 남지만, 워커는 사람의 결정 또는 명시적 integration-boundary 선택이 필요한 티켓을 영원히 반복하는 대신 다음 `tickets/todo/` 항목을 claim 할 수 있다. 해당 ticket id로 명시적으로 실행하면 blocker는 여전히 드러나야 한다.

## 워커 금지 사항

- active ticket이 하나 있는 동안 두 번째 ticket을 claim 하지 않는다.
- 플래너 검토용 이유를 남기지 않고 `Allowed Paths`를 넓히지 않는다.
- 증거 없이 pass로 표시하지 않는다.
- push 하지 않는다.
- 상태를 채팅에 숨기지 않는다.
- 더 최신 증거로 대체하지 않은 채 플래너 re-orchestration note를 덮어쓰지 않는다.
