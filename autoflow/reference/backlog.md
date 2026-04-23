# Backlog

`tickets/backlog/` 는 `BOARD_ROOT` 안에서 아직 plan 전인 spec 을 받는 입력 큐다.

## 참고 템플릿

- `reference/project-spec-template.md`: 프로젝트 전체 기준
- `reference/feature-spec-template.md`: 기능 단위 기준

## 원칙

- 스펙이 먼저다.
- 티켓은 실제 스펙 파일을 참조해야 한다.
- 템플릿 파일만 있고 실제 스펙이 없으면 티켓을 만들지 않는다.
- 스펙이 바뀌면 관련 티켓도 다시 점검한다.
- 제품 코드 경로는 `PROJECT_ROOT` 기준으로 설명하는 편이 좋다.
- `tickets/plan/` 은 backlog 를 읽고 순서와 티켓화를 정리한다.
- planner 가 실제 todo ticket 을 만들면 대응 spec 은 `tickets/done/<project-key>/` 로 이동한다.
- 즉 `tickets/backlog/` 루트에는 아직 plan 전인 spec 만 남고, plan / todo / verifier 가 참조하는 처리 완료 spec 은 done 프로젝트 묶음 안에 남는다.
- 생성되는 plan / ticket / verification 문서는 이 spec note 이름 (`project_NNN`) 을 `## Obsidian Links` 로 다시 연결한다.
