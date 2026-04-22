# Rules

`rules/` 는 보드의 기준 문서를 한곳에 모으는 상위 폴더다.

구성:

- `rules/spec/`
  - 무엇이 맞는지 정의
- `rules/plan/`
  - 어떤 일을 어떤 순서로 티켓화할지 정의
- `rules/verifier/`
  - 무엇을 통과해야 완료인지 정의

즉 `rules/` 는 live 상태가 아니라 판단 기준을 모아 둔 곳이다.

구분:

- `rules/`: 기준 문서
- `agents/`: 역할 정의
- `automations/`: 자동화 훅 정책
- `tickets/`: live 상태 보드와 실행 증거

권장 읽기 순서:

1. `rules/spec/README.md`
2. `rules/plan/README.md`
3. `rules/verifier/README.md`
