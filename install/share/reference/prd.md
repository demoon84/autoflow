# PRD Queue

`tickets/prd/`는 `/aprd`(`$aprd`, `#aprd`)로 handoff된 승인 PRD queue다. 작은 기계적 작업은 이 queue를 거치지 않고 `/atodo`를 통해 `tickets/todo/`로 바로 간다.

## Templates

- `reference/prd-template.md`
- `reference/project-spec-template.md`
- `reference/feature-spec-template.md`

## 규칙

- `aprd` skill handoff(`/aprd`, `$aprd`, `#aprd`)는 명시적 사용자 승인 이후에만 `PRD-NNN.md` 하나를 만들거나 갱신할 수 있다.
- 플래너 러너는 채워진 PRD를 소비하면서 `tickets/done/<project-key>/` 아래로 archive하고 하나 이상의 구체적인 `tickets/todo/Todo-NNN.md` 파일을 만든다. PRD 하나가 여러 worker-owned todo ticket으로 나뉘어야 하면 `## Todo Split Map`을 쓴다.
- 워커 러너는 PRD queue item을 직접 claim하지 않는다. 플래너 러너가 만든 todo ticket만 claim한다.
- Legacy `#plan` 호환 경로도 같은 prd-to-todo handoff를 쓴다.
- 소비된 PRD는 `tickets/done/<project-key>/`로 이동한다.
- 생성된 ticket, verification record, log는 `## Reference Notes`로 원 PRD를 다시 연결해야 한다.
- 작고 단일 파일의 기계적 작업은 PRD보다 `/atodo`를 선호한다. atodo skill은 planner step 없이 worker가 claim할 수 있는 완전한 todo를 `tickets/todo/` 아래에 직접 쓴다.
