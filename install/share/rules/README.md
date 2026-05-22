# 규칙

Rules는 agent가 safety와 completion을 판단하는 방식을 정의한다.

Board state를 바꾸기 전에 다음 문서를 읽는다.

- `rules/verifier/README.md`
- `rules/verifier/checklist-template.md`
- `rules/verifier/verification-template.md`
- `rules/wiki/README.md`

Ticket file과 verification record는 인상이 아니라 관찰 가능한 evidence를 인용해야 한다.
Auto-resolution도 관찰 가능한 evidence를 남겨야 한다. Backup diff, planner log entry, ticket `Notes`는 무엇을 왜 자동 해결했는지 일치해야 한다.
