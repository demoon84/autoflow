# PRD Queue

`tickets/prd/`는 `autoflow` skill 대화가 발행한 PRD를 담는다. 모든 사용자 요청은 goal에서 출발하며, skill 대화는 목표 달성에 필요한 PRD를 하나 이상 발행할 수 있다.

## Templates

- `reference/prd-template.md`
- `reference/project-spec-template.md`
- `reference/feature-spec-template.md`

## 규칙

- Skill 대화는 사용자 승인과 goal 활성화 이후 PRD를 발행한다.
- Active PRD가 있어도 목표 달성을 위해 필요한 다른 PRD를 추가 발행할 수 있다.
- Skill 대화는 프로젝트 현재 상태와 LLM Wiki를 read-only로 참고해 PRD를 작성한다.
- PRD 하나는 Planner가 여러 TODO로 나눌 수 있다.
- 여러 TODO가 필요하면 PRD에 `## Work Item Split`을 둔다.
- Worker는 PRD queue item을 직접 처리하지 않고 Planner가 만든 TODO를 수행한다.
- PRD 완료는 해당 PRD의 TODO가 모두 verifier pass 이후 commit되고, 마지막 TODO를 처리한 Worker가 PRD worktree merge evidence를 남긴 상태다.
- PRD 완료 뒤 skill 대화는 goal 기준 부족분을 확인하고 필요하면 PRD를 추가 발행한다.
- LLM Wiki 작성은 PRD 완료 조건이 아니다.
