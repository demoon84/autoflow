# Plan

`tickets/plan/` 은 `BOARD_ROOT` 안에서 실제 plan 문서를 두는 canonical source of truth 다.

## 참고 템플릿

- `reference/plan-template.md`: planner 가 새 plan 초안을 만들 때 쓰는 템플릿
- `reference/roadmap.md`: 여러 plan 의 큰 흐름과 우선순위를 묶어 보는 참고 문서
- `plan_*.md`: spec 별 실제 plan 문서

## 원칙

- planner 가 `tickets/backlog/` 를 읽고 이 폴더의 `plan_*.md` 를 작성하거나 갱신한다.
- plan ticket 생성 작업을 시작하면 plan 은 ticket 과 같은 `tickets/inprogress/plan_NNN.md` 로 점유 이동한다.
- plan 이 실제 todo ticket 을 만들면 대응 spec 과 plan 은 `tickets/done/<project-key>/` 로 이동하고, plan / ticket 의 참조도 그 경로로 갱신된다.
- plan 문서에는 `## Obsidian Links` 를 두고 `[[project_NNN]]`, `[[plan_NNN]]` note 를 연결한다.
- spec author 는 이 폴더를 직접 쓰지 않는다.
- todo / verifier worker 는 이 폴더를 읽을 수 있지만, plan 수정은 planner 영역이다.
- reject 티켓이 생기면 planner 가 `## Reject Reason` 을 반영해 이 폴더의 해당 plan 에 새 Execution Candidate 를 추가한다.

즉 흐름은 `tickets/backlog -> tickets/plan -> tickets/inprogress/plan_NNN.md -> tickets/todo -> tickets/inprogress/tickets_NNN.md -> tickets/verifier -> tickets/inprogress/verify_NNN.md -> logs -> tickets/done/<project-key>/verify_NNN.md` 이다.
