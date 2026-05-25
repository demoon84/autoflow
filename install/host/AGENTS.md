# AGENTS.md

이 프로젝트에는 Autoflow sidecar board가 설치될 수 있다. Autoflow는 skill이며, 데스크탑 앱은 skill과 runner를 실행하는 sidecar다.

## 핵심 계약

1. `autoflow`는 사용자-facing skill이다.
2. `autoflow` skill은 goal 기능을 사용해 사용자 목표를 유지하고 완료한다.
3. Skill 대화의 주된 역할은 프로젝트 현재 구현 상태와 LLM Wiki를 read-only로 참고해 PRD를 하나 이상 발행하는 것이다.
4. Skill 대화는 구현, 검증, PRD worktree commit/merge, 위키 작성을 직접 하지 않는다.
5. Autoflow 스킬은 PRD `.md`만 발행하고, PRD branch/worktree 생성은 플래너 러너의 책임이다.
6. 데스크탑 sidecar는 보드 상태를 실시간 감지하고 4개 고정 러너를 실행/표시한다.
7. Runner는 `Planner`, `Worker`, `Verifier`, `LLM Wiki` 네 개다.
8. `Merge` runner는 없다.

## Autoflow Flow

```text
goal active
  -> autoflow skill이 PRD 발행
  -> Planner가 PRD 기준 TODO 생성
  -> Worker가 배정 TODO 수행
  -> Worker가 Verifier에게 검증 요청
  -> Verifier가 pass | revise | replan 기록
  -> pass면 Worker가 PRD worktree commit 반영
  -> PRD의 모든 TODO 완료 시 마지막 Worker가 PRD worktree merge
  -> autoflow skill이 goal 기준 부족분 확인
  -> PRD 추가 발행 또는 goal complete
```

## Runner 책임

- Planner: PRD를 TODO로 분해한다. PRD 하나에서 여러 TODO를 만들 수 있다.
- Worker: 배정 TODO를 수행한다. Verifier pass 뒤 PRD worktree commit을 반영한다. PRD의 마지막 TODO를 처리하면 PRD worktree merge를 수행한다.
- Verifier: Worker 결과를 검증하고 pass/revise/replan 후속조치를 기록한다.
- LLM Wiki: 완료 원장에서 파생 지식을 지연/배치로 정리한다.

## Wiki

LLM Wiki는 skill 대화가 PRD를 발행할 때 참고하는 read-only memory다. 위키 작성은 PRD 완료나 goal 완료를 막지 않는다.

## Goal 완료

Goal complete는 최초 목표의 완료 조건이 PRD/TODO/verifier/commit/merge evidence로 덮였고, active critical work가 없을 때만 수행한다. 부족분이 있으면 skill 대화가 PRD를 추가 발행한다.

## Trigger

- `#autoflow` / `/autoflow` / `$autoflow`: goal 기반 Autoflow skill을 시작한다.
- 승인 전에는 goal/board/LLM Wiki 상태만 read-only로 확인한다.
- 승인 뒤 첫 mutating action은 goal 활성화다.
- goal 기능을 실제로 사용할 수 없으면 goal이 켜졌다고 말하지 않는다.

## 경로

- 보드: `.autoflow/`
- PRD: `.autoflow/tickets/prd/`
- TODO: `.autoflow/tickets/todo/`, `.autoflow/tickets/inprogress/`, `.autoflow/tickets/verifier/`, `.autoflow/tickets/done/`
- Wiki: `.autoflow/wiki/`

`.autoflow/`는 개인 로컬 실행 원장이며 Git에 커밋하지 않는다. 팀에 공유할 내용은 제품 코드/문서 변경이나 PR 요약처럼 명시적인 산출물로 남긴다.
