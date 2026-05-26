# 처리된 PRD

완료된 PRD는 `tickets/done/<project-key>/` 아래에 archive한다.

규칙:

- active PRD는 모든 TODO가 로컬 검증과 finalize gate 이후 commit되고, 마지막 TODO를 처리한 Worker가 PRD worktree merge evidence를 남긴 뒤 done으로 이동한다.
- done archive에는 PRD 본문, TODO evidence, 로컬 검증 evidence, PRD worktree commit/merge evidence가 함께 있어야 한다.
- 새 board는 별도 processed queue를 만들지 않는다.
