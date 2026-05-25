# Autoflow Board

이 디렉터리는 host project 안에 설치되는 Autoflow 보드다. 보드는 `autoflow` skill, 데스크탑 sidecar, 4개 고정 러너가 공유하는 file-based source of truth다.

## 기본 흐름

1. 사용자가 `/autoflow`, `$autoflow`, `#autoflow`로 목표를 말한다.
2. `autoflow` skill 대화가 goal 기능을 활성화한다.
3. Skill 대화가 프로젝트 현재 상태와 LLM Wiki를 read-only로 참고한다.
4. Skill 대화가 목표 달성에 필요한 PRD를 하나 이상 발행한다.
5. Desktop sidecar가 보드 상태를 실시간 감지한다.
6. Planner가 PRD 기준 TODO를 만든다.
7. Worker가 배정 TODO를 수행하고 Verifier에게 검증을 요청한다.
8. Verifier가 `pass | revise | replan`과 후속조치를 기록한다.
9. `pass`면 Worker가 PRD worktree commit을 반영한다.
10. PRD의 모든 TODO가 완료되면 마지막 TODO를 처리한 Worker가 PRD worktree를 merge한다.
11. Skill 대화가 goal 기준 부족분을 확인하고 PRD 추가 발행 또는 goal complete를 수행한다.

LLM Wiki 작성은 PRD 완료나 goal 완료를 막지 않는다.

## 주요 디렉터리

- `tickets/prd/`: skill 대화가 발행한 PRD.
- `tickets/todo/`: Planner가 만든 TODO.
- `tickets/inprogress/`: Worker가 수행 중이거나 재개해야 하는 TODO.
- `tickets/verifier/`: Verifier 검증 대상.
- `tickets/done/<project-key>/`: 완료된 PRD/TODO/verifier/commit/merge evidence.
- `automations/state/`: runner와 sidecar runtime state.
- `runners/config.local.toml`: local runner 설정.
- `runners/state/`: runner state와 local runtime cache.
- `conversations/`: skill 대화 handoff와 goal 완료 점검 note.
- `wiki/`: 로컬 markdown LLM Wiki.
- `raw/`: 위키에 반영할 원본 source.
- `metrics/`: progress snapshot과 telemetry summary.

## 4개 Runner

Desktop sidecar는 다음 4개 러너를 표시한다.

- `Planner`
- `Worker`
- `Verifier`
- `LLM Wiki`

`Merge` runner는 없다.

## Runner Tool

Runner tool은 scope 선택, pass/revise/replan 결정, goal 완료 판단, wiki 의미 판단을 하지 않는다. 도구는 좁은 상태 전이와 evidence 기록만 돕는다.

## Wiki 규칙

Wiki는 Claude/Codex가 다음 작업에서 재사용하는 markdown derived knowledge map이다. State, verifier decision, commit/merge state의 source of truth가 아니다.

Wiki 원본은 `wiki/**/*.md`에 저장한다. qmd cache/index/DB는 선택 검색 가속기다. 보드 전체는 개인 로컬 실행 원장이며 기본적으로 Git에 포함하지 않는다.
