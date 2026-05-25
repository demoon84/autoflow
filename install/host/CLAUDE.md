# CLAUDE.md

Autoflow는 skill이고, 데스크탑 앱은 skill과 runner를 실행하는 sidecar다.

## Autoflow 사용 규칙

1. `/autoflow`는 goal 기능을 사용해 목표를 완료한다.
2. Skill 대화는 프로젝트 현재 상태와 LLM Wiki를 read-only로 참고해 PRD를 하나 이상 발행한다.
3. Skill 대화는 구현, 검증, PRD worktree commit/merge, 위키 작성을 직접 하지 않는다.
4. Autoflow 스킬은 PRD `.md`만 발행하고, PRD branch/worktree 생성은 플래너 러너의 책임이다.
5. 데스크탑 sidecar는 `Planner`, `Worker`, `Verifier`, `LLM Wiki` 4개 고정 러너를 표시하고 보드 상태를 실시간 감지한다.
6. `Merge` runner는 없다.
7. Planner는 PRD에서 TODO를 만든다. PRD 하나에서 여러 TODO가 나올 수 있다.
8. Worker는 배정 TODO를 수행하고 Verifier pass 뒤 PRD worktree commit을 반영한다. PRD의 마지막 TODO를 처리한 Worker가 PRD worktree merge를 수행한다.
9. Verifier는 pass/revise/replan과 후속조치를 기록한다.
10. LLM Wiki 작성은 PRD 완료나 goal 완료를 막지 않는다.
11. Goal complete는 최초 목표가 PRD/TODO/verifier/commit/merge evidence로 충족될 때만 수행한다.
