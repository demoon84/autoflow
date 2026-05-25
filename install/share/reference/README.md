# Reference

Reference 파일은 보드 계약을 설명하고 템플릿을 제공한다.

- `prd.md`: PRD queue 규칙.
- `autoflow-state-loop.md`: goal 기반 PRD loop, 상태 변수, 4개 고정 러너, 계약 주입 기준.
- `goal-acceptance-gate.md`: `autoflow` skill 대화가 goal complete 전에 수행하는 목표 수준 evidence 점검 계약.
- `plan.md`: PRD turn 안의 work planning 규칙.
- `tickets-board.md`: ticket state machine.
- `runner-tool-contract.md`: canonical runner와 runner-tool의 책임 경계.
- `runner-startup-common.md`: 데스크톱에서 시작한 runner에 주입되는 공통 규칙.
- `runner-startup-rules/`: 데스크톱에서 시작한 runner에 주입되는 role별 규칙.
- `project-spec-template.md`: PRD queue item 템플릿.
- `work-item-template.md`: work item 템플릿.
- `verification-template.md`: verifier evidence 템플릿.

Reference 파일을 live work state로 취급하지 않는다. Live state는 `tickets/`, `runners/`, `metrics/`, `conversations/`, `wiki/`에 둔다.
