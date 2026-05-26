# 워커 역할 프로토콜

## 목적

Worker는 배정된 TODO 하나를 수행하고, 로컬 검증 evidence를 남긴 뒤 worker finalize-approved 를 호출해 단일 마무리 흐름으로 TODO 를 닫는다. 도구가 sanity gate(worktree/base/diff/Done When)와 merge target verification rerun 을 거쳐 PRD worktree commit 을 반영한다. PRD의 마지막 TODO를 처리한 Worker 의 finalize-approved 호출은 main squash merge 까지 자동 수행한다.

## 제1원칙

Runtime helper는 AI를 위한 결정론적 도구다. Helper는 범위 검사, worktree 확인, evidence 기록, 상태 쓰기를 도울 수 있지만 작업의 의미를 결정하지 않는다.

## 로컬 변경 격리

`PROJECT_ROOT`의 dirty change는 사용자 또는 다른 작업의 변경으로 취급한다. 지정 TODO의 `Allowed Paths`와 겹치는 dirty file이 있으면 구현을 시작하기 전에 경계를 확인하고, 안전하지 않으면 `blocked` evidence를 남긴다.

## 커밋 메시지 계약

PRD worktree merge의 최종 main/master commit subject는 마지막 TODO를 처리한 Worker가 짧고 안정적으로 결정한다. 긴 LLM summary, terminal transcript, `... [truncated]` 문자열을 commit subject로 만들지 않는다.

권장 subject:

```text
PRD-NNN 완료
```

## 워커 책임

워커 역할은 다음을 소유한다.

- 지정 TODO, 참조 PRD, reference, wiki context 읽기
- 코드 변경 전 mini-plan 작성
- `Allowed Paths`만 수정
- verification command 실행과 evidence 기록
- `Done When`과 diff 범위의 기계적 점검
- 로컬 검증 통과 후 worker finalize-approved 호출
- finalize-approved 가 자동 처리하는 PRD worktree commit / 마지막 TODO 의 main squash merge 결과를 evidence 로 기록
- sanity gate / verification rerun 실패 시 `blocked` 또는 `failed` 상태와 reason/evidence 기록

## 지속 가능한 진행 기록

완료되지 않은 모든 worker assignment는 적어도 하나의 지속 진행 필드를 갱신해야 한다.

- `Notes`
- `Resume Context`
- `Next Action`
- `Verification`
- `Result`

채팅에만 남은 진행 상황에 의존하지 않는다.

## Blocked 동작

blocked 상태에서는 TODO에 다음을 포함해야 한다.

- 관찰된 증거
- 시도한 내용
- 안전하게 계속할 수 없는 이유
- 다음 상태 판단에 필요한 최소 정보

권장 blocker class:

- `unclear_scope`
- `missing_dependency`
- `verification_failed`
- `dirty_root`
- `stale_worktree`
- `allowed_path_conflict`
- `tooling_failure`
- `needs_user_decision`

## 금지 사항

- 배정 밖 TODO를 처리하지 않는다.
- `Allowed Paths`를 조용히 넓히지 않는다.
- 증거 없이 finalize-approved 를 호출하지 않는다.
- 로컬 검증이 통과하기 전에는 finalize-approved 를 호출하지 않는다.
- 직접 `git commit`, `git merge --squash`, `git worktree remove` 를 호출하지 않는다. finalize-approved 가 수행한다.
- push 하지 않는다.
- 상태를 채팅에 숨기지 않는다.
