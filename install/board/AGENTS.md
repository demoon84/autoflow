# AGENTS.md

이 보드는 host project 안에 설치된 Autoflow sidecar board다.

## 기본 모델

- Autoflow는 skill이다.
- 데스크탑 앱은 skill과 runner를 실행하는 sidecar다.
- `autoflow` skill 대화는 프로젝트 현재 구현 상태와 LLM Wiki를 read-only로 점검한 뒤 PRD를 하나 이상 발행한다.
- Skill 대화는 구현, 검증, PRD branch/worktree 생성, commit/merge, 위키 작성을 직접 하지 않는다.
- Desktop sidecar는 보드 상태를 실시간 감지하고 4개 고정 러너를 표시한다.

## 4개 Runner

- `Planner`
- `Worker`
- `Verifier`
- `LLM Wiki`

`Merge` runner는 없다.

## 흐름

```text
autoflow skill 대화가 read-only 점검 후 PRD 발행
  -> Planner가 PRD 기준 TODO 생성
  -> Worker가 배정 TODO 수행
  -> Worker가 Verifier에게 검증 요청
  -> Verifier가 pass | revise | replan 기록
  -> pass면 Worker가 PRD worktree commit 반영
  -> PRD의 모든 TODO 완료 시 마지막 Worker가 PRD worktree merge
  -> 추가 작업이 필요하면 skill 대화가 새 PRD 발행
```

## 디렉터리

- `tickets/prd/`: skill 대화가 발행한 PRD.
- `tickets/todo/`: Planner가 만든 pending TODO.
- `tickets/inprogress/`: Worker가 수행 중이거나 재개해야 하는 TODO.
- `tickets/done/<project-key>/`: 완료된 PRD/TODO/commit/merge evidence. (legacy `tickets/verifier/` 잔재는 upgrade 가 자동으로 `tickets/inprogress/` 로 이동시킨다.)
- `runners/`: runner config와 runtime state.
- `wiki/`: LLM Wiki markdown source.
- `raw/`: 위키에 반영할 원본 source.

이 보드는 개인 로컬 실행 원장이며 Git에 커밋하지 않는다. 공유가 필요한 내용은 PR 요약이나 별도 문서로 명시적으로 export한다.

## 규칙

1. PRD는 `autoflow` skill 대화가 발행한다.
2. Planner는 PRD에서 TODO를 하나 이상 만든다.
3. Worker는 배정 TODO만 수행한다.
4. Worker는 작업 완료 후보를 Verifier에게 넘긴다.
5. Verifier pass 전에는 완료 commit으로 반영하지 않는다.
6. Verifier 실패 시 Worker는 Verifier 후속조치에 따른다.
7. PRD의 모든 TODO가 완료되면 마지막 TODO를 처리한 Worker가 PRD worktree merge를 수행한다.
8. LLM Wiki 작성은 deferred maintenance다.
