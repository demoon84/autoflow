# Trigger 계약

Autoflow의 사용자-facing trigger는 `autoflow` 하나다.

`/autoflow`, `$autoflow`, `#autoflow`:

- 먼저 목표와 완료 조건을 확인한다.
- 실제 작업 방향을 브리핑하고 사용자 승인을 받는다.
- 승인 뒤 첫 mutating action은 host goal 기능 활성화다.
- goal을 세우기 전에는 PRD, TODO, runner state, board mutation을 만들지 않는다.
- `autoflow` skill 대화는 현재 프로젝트 상태와 LLM Wiki를 read-only로 참고한 뒤 PRD를 하나 이상 발행할 수 있다.
- PRD 완료 뒤 goal 기준 부족분이 남으면 PRD를 추가 발행한다.

작은 요청도 PRD로 발행한다. 사용자는 PRD와 TODO를 직접 선택하지 않는다.
