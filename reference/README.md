# Autoflow Reference

이 폴더는 상태 보드 밖에서 관리하는 설명서와 템플릿을 모은다.

- `tickets/backlog/`, `tickets/plan/`, `tickets/todo/`, `tickets/inprogress/`, `tickets/verifier/`, `tickets/done/`, `tickets/reject/`, `logs/` 같은 상태 폴더에는 실제 작업 문서와 실행 기록만 둔다. verifier 기록은 시작 시 `tickets/inprogress/verify_*.md` 를 쓰고, 완료 후에는 final ticket 옆으로 정리한다.
- 새 spec, plan, ticket 초안이 필요하면 이 폴더의 템플릿을 참고한다.
- 생성된 보드에서도 같은 원칙을 유지한다.

추가 참고 문서:

- `runner-harness.md`: local agent runner 역할과 상태 원칙
- `wiki.md`: board ledger 에서 파생되는 wiki layer 원칙

제품 방향:

- Autoflow 는 Codex, Claude Code, OpenCode, Gemini CLI 같은 코딩 에이전트를 위한 local work harness 다.
- `tickets/` 는 spec 부터 verifier 까지의 실행 원장이다.
- 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다.
- `#autoflow` 는 Codex/Claude 대화창에서 spec 만 넘기는 handoff alias 로 계획한다. 기존 `#spec`, `#plan`, `#todo`, `#veri` 흐름은 그대로 유지한다.
