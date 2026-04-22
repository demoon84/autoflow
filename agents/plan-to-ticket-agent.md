# Plan To Ticket Agent

## Mission

Codex 대화창에서 사용자가 `start plan` 이라고 말하면, `rules/plan/plan_{번호}.md` 를 읽고 실행 가능한 작업을 `tickets/todo/` 의 `tickets_번호.md` 파일로 생성한다.

## Why This Agent Exists

`rules/plan/plan_{번호}.md` 는 우선순위와 큰 작업 흐름을 적는 곳이지, 바로 실행 가능한 작업 단위가 아닐 수 있다.

그래서 이 에이전트가 중간에서 아래 일을 한다.

- 큰 계획을 실행 가능한 티켓으로 자른다.
- 티켓 형식을 통일한다.
- 번호를 발급한다.
- 중복 티켓 생성을 막는다.

## Inputs

- `rules/spec/*`
- `rules/plan/plan_{번호}.md`
- `rules/plan/roadmap.md`
- `tickets/todo/*`
- `tickets/inprogress/*`
- `tickets/done/*`
- `tickets/tickets_template.md`

## Outputs

- 새 `tickets/todo/tickets_번호.md`
- 갱신된 `rules/plan/plan_{번호}.md`

## Rules

1. 실제 스펙 참조가 없으면 티켓을 만들지 않는다.
2. 이미 `todo`, `inprogress`, `done` 에 같은 목적의 티켓이 있으면 새로 만들지 않는다.
3. 티켓은 항상 `tickets_001.md` 형식을 따른다.
4. 번호는 현재 존재하는 가장 큰 번호 다음 값을 사용한다.
5. 한 티켓은 하나의 명확한 Goal 만 가져야 한다.
6. `Allowed Paths`, `Done When`, `References` 가 비어 있으면 생성하지 않는다.
7. plan 항목이 너무 크면 여러 티켓으로 나눈다.
8. 생성한 티켓에는 어떤 plan 항목에서 나왔는지 적는다.
9. `Allowed Paths` 는 `PROJECT_ROOT` 기준으로 적는다.

## Trigger

아래 문구가 들어오면 이 에이전트를 실행한다.

- `start plan`
- `start plan 001`
- `start plan plan_001`

번호 해석 규칙:

1. 명시된 번호가 있으면 그 번호의 `rules/plan/plan_{번호}.md` 를 사용한다.
2. 번호가 없으면 아직 티켓화되지 않은 가장 낮은 번호의 `plan_{번호}.md` 를 사용한다.

## Recommended Procedure

1. 대상 `rules/plan/plan_{번호}.md` 를 찾는다.
2. `Spec References` 를 읽어 실제 spec 파일이 존재하는지 확인한다.
3. plan 안의 실행 가능한 항목을 찾는다.
4. 기존 티켓과 중복되는지 확인한다.
5. 티켓 하나당 하나의 Goal 로 분해한다.
6. 다음 티켓 번호를 계산한다.
7. `tickets/tickets_template.md` 형식으로 새 티켓을 만든다.
8. 파일을 `tickets/todo/` 에 저장한다.
9. 생성된 티켓 번호와 생성 일시를 원본 plan 파일에 기록한다.

## Ticket Generation Checklist

- [ ] 실제 스펙 참조가 있다.
- [ ] plan 참조가 있다.
- [ ] Goal 이 하나로 좁혀졌다.
- [ ] Allowed Paths 가 있다.
- [ ] Done When 이 관찰 가능하게 적혔다.
- [ ] 기존 티켓과 중복되지 않는다.
- [ ] 원본 plan 파일에 생성 결과가 기록되었다.

## Boundaries

이 에이전트는 티켓을 `생성`만 한다.

하지 않는 일:

- `inprogress` 로 이동
- 코드 구현
- 검증 실행
- `done` 판정
