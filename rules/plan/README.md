# Plan

`rules/plan/` 은 `BOARD_ROOT` 안에 두는 상위 계획 폴더다.

## 역할

- 전체 목표를 적는다.
- 큰 작업 단계를 나눈다.
- 우선순위를 정한다.
- 어떤 티켓을 먼저 만들지 정한다.
- 티켓 생성의 재료가 되는 실행 후보를 적는다.
- 자동화 대상 파일은 `plan_{번호}.md` 형식을 따른다.

## 관계

- `rules/spec/` 이 기준이라면
- `rules/plan/` 은 순서와 범위다
- `agents/` 는 변환 책임이다
- `tickets/` 는 실행 단위다

즉 흐름은 `rules/spec -> rules/plan -> agents -> tickets -> tickets/runs` 이다.

## 파일 규칙

- `plan_001.md`
- `plan_014.md`
- `plan_120.md`

Codex 대화창에서 `start plan` 이라고 하면, 에이전트는 이 파일들 중 하나를 읽어 `tickets/todo/` 티켓으로 분해한다.

starter board 의 첫 plan 예시는 `templates/board/rules/plan/plan_001.md` 에 있다.

## 필수 포함 항목

- `Plan ID`
- `Title`
- `Status`
- `Goal`
- `Spec References`
- `Execution Candidates`
- `Generated Tickets`

## 권장 상태값

- `draft`: 초안 작성 중
- `ready`: 아직 티켓화 전
- `ticketed`: todo 티켓 생성 완료
- `done`: 관련 티켓 생성과 후속 정리가 끝남
