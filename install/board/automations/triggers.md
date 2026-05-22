# Trigger 계약

PRD handoff skill(`/aprd`, `$aprd`, `#aprd`):

- 먼저 가벼운 chat으로 요구사항을 모은다.
- `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`,
  `show draft` 같은 명시적인 draft trigger가 있을 때만 전체 PRD 초안을 렌더링한다.
- 별도의 명시적 승인 후에만 저장한다.
- `tickets/prd/PRD-NNN.md`와 선택적 conversation handoff만 쓴다.
- todo ticket, code, verification record, commit, push를 만들지 않는다.

Direct todo skill(`/atodo`, `$atodo`, `#atodo`)과 `autoflow todo create`:

- `Title`, `Goal`, 구체적인 `Allowed Paths`, 관찰 가능한 `Done When` 항목 2개 이상,
  `Verification.Command`를 포함한 완전한 `tickets/todo/Todo-NNN.md` 하나를 쓴다.
- 사용자의 원 요청은 `## Notes` 아래에 `User request: ...` 형식으로 원문 그대로 보존한다.
- PRD, code, verification record, commit, push를 만들지 않는다.
- 작업이 단일 파일의 기계적 변경이 아니라면 `/aprd` 흐름으로 전환한다.
