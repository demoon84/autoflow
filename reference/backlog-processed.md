# Legacy Processed Specs

`tickets/backlog/processed/` 는 이전 버전에서 planner 가 이미 plan / todo ticket 으로 넘긴 spec 을 보관하던 폴더다.

원칙:

- 현재 기준에서는 `#plan` 이 실제 todo ticket 을 만들면 대응 spec 을 `tickets/done/<project-key>/` 로 이동한다.
- 업그레이드는 이 폴더에 남은 `project_*.md` / `feature_*.md` 를 done 프로젝트 폴더로 옮긴다.
- 새 보드에서는 이 폴더를 만들지 않는다.
