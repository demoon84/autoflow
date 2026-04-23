# Rules

`rules/` 는 보드 안의 공용 규칙 문서를 모으는 상위 폴더다.

구성:

- `rules/verifier/`
  - 무엇을 통과해야 완료인지 정의

- 별도 canonical spec / plan 위치:

- `tickets/backlog/`
  - 무엇이 맞는지 정의
- `tickets/plan/`
  - 어떤 일을 어떤 순서로 티켓화할지 정의

즉 `rules/` 는 지금 기준으로 주로 verifier 계약을 담고, spec / plan 기준은 `tickets/` 아래에 둔다. 템플릿과 설명서는 state 폴더가 아니라 `reference/` 에 둔다.

구분:

- `rules/`: 기준 문서
- `agents/`: 역할 정의
- `automations/`: 자동화 훅 정책
- `tickets/`: live 상태 보드와 실행 증거

권장 읽기 순서:

1. `reference/backlog.md`
2. `reference/plan.md`
3. `rules/verifier/README.md`
