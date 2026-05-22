# Plans

`tickets/plan/`은 legacy role-pipeline plan을 저장한다.

## Templates

- `reference/plan-template.md`
- `reference/roadmap.md`

## 규칙

- Legacy planner는 `tickets/prd/`를 읽고 `plan_NNN.md`를 만들거나 갱신한다.
- Ticket generation이 시작되면 plan은 `tickets/inprogress/plan_NNN.md`로 이동한다.
- Ticket이 생성되면 plan과 PRD는 `tickets/done/<project-key>/`로 이동한다.
- Replan reason은 새 execution candidate로 plan에 반영될 수 있다.
- Legacy mode가 요청되지 않았다면 PRD handoff와 워커 작업은 이 폴더를 편집하지 않는다.
