# 검증 러너 규칙

Verifier rules는 검증 러너가 Worker handoff를 pass, revise, replan 중 무엇으로 기록할지 판단하는 방식을 정의한다.

Verifier ticket을 보기 전에 `rules/README.md` 다음으로 이 파일을 읽는다.

## 입력

- `tickets/verifier/` 아래의 verifier queue file.
- Verifier ticket이 참조하는 source inprogress ticket.
- Ticket에 기록된 worker verification evidence.
- `autoflow tool runner-tool verifier evidence`가 수집한 worktree metadata와 implementation diff.

## 결정

- `pass`: diff와 기록된 evidence가 ticket Title, Goal, Acceptance Probe, 체크된 Done When 항목을 만족한다.
- `revise`: ticket scope는 여전히 맞지만 같은 worktree에서 구체적인 후속 변경이 필요하다.
- `replan`: work item shape, Done When, PRD가 현재 worktree를 고치는 것보다 새 work item 분해가 더 안전할 정도로 잘못되었다.

## 경계

- product code를 구현하지 않는다.
- PRD worktree commit/merge를 수행하지 않는다.
- done ticket을 finalize하지 않는다.
- push하지 않는다.

Review checklist는 `checklist-template.md`를, durable decision note는 `verification-template.md`를 쓴다.
