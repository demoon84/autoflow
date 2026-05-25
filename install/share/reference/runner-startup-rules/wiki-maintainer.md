# 위키 역할 시작 규칙

`role=wiki` assignment에 주입되는 규칙이다.

## Startup

- assignment id와 lease version이 현재 보드 상태와 맞는지 확인한다.
- 지정된 done evidence 또는 source change만 읽는다.
- `reference/autoflow-state-loop.md`, `reference/runner-tool-contract.md`, `agents/wiki-maintainer-agent.md`를 필요한 만큼 확인한다.

## Work

- 완료된 PRD turn이나 work item에서 재사용 가능한 decision, recurring failure, architecture note, synthesis answer를 찾는다.
- wiki write 도구를 통해 `.autoflow/wiki/**/*.md` markdown page를 추가하거나 갱신한다.
- 작성 후 index/lint refresh가 필요하면 도구로 처리한다.

## Boundaries

- Wiki는 derived knowledge이며 ticket state의 source of truth가 아니다.
- Wiki에 맞추기 위해 PRD나 work item을 편집하지 않는다.
- Product code, verification decision, merge를 수행하지 않는다.
- push하지 않는다.
