# 티켓 보드

이 디렉터리는 `BOARD_ROOT` 안의 상태 보드다. 보드 상태가 Autoflow의 source of truth이며, 대화 텍스트나 runner 출력은 보드 상태를 대신하지 않는다.

## State Lanes

- `prd/`: `autoflow` skill 대화가 발행한 PRD.
- `todo/`: Planner가 PRD에서 만든 pending TODO.
- `inprogress/`: Worker가 수행 중이거나 재개해야 하는 TODO.
- `done/`: 완료된 PRD, TODO, 로컬 검증 evidence, PRD worktree commit/merge evidence.

`merge/` lane은 사용하지 않는다. PRD worktree merge는 마지막 TODO를 처리한 Worker가 수행한다. 기존 보드의 legacy `verifier/` lane은 upgrade가 `inprogress/`로 이동시킨다.

## 용어

- **Autoflow skill**: goal을 사용해 목표를 완료하는 사용자-facing skill.
- **Desktop sidecar**: skill과 runner를 실행하고 보드 상태를 실시간 감지하는 데스크탑 앱.
- **PRD**: skill 대화가 발행하는 목표 실행 문서. 여러 개 발행될 수 있다.
- **TODO**: Planner가 PRD에서 만든 실행 단위. PRD 하나에서 여러 TODO가 나올 수 있다.
- **Runner**: Planner, Worker, LLM Wiki 세 종류로 고정한다.

## 생명주기

```text
goal active
  -> skill 대화가 PRD 발행
  -> Planner가 TODO 생성
  -> Worker가 TODO 수행
  -> Worker가 로컬 검증 evidence 기록
  -> Worker가 finalize-approved로 PRD worktree commit 반영
  -> PRD의 모든 TODO 완료 시 마지막 Worker가 PRD worktree merge
  -> skill 대화가 goal 기준 부족분 확인
  -> PRD 추가 발행 또는 goal complete
```

## 상태 규칙

- `prd/`
  - skill 대화가 발행한 PRD를 담는다.
  - active PRD가 있어도 다른 PRD를 추가 발행할 수 있다.
  - 모든 TODO와 PRD worktree merge가 끝나면 관련 evidence와 함께 `done/<project-key>/`로 이동한다.
- `todo/`
  - Planner가 만든 TODO를 담는다.
  - Worker가 임의로 새 TODO를 만들지 않는다.
- `inprogress/`
  - Worker가 수행 중인 TODO를 담는다.
  - Worker는 배정된 TODO만 처리한다.
- `done/`
  - 완료된 evidence를 묶는다.
  - 로컬 검증, Worker commit, PRD worktree merge 기록을 포함한다.

## 필수 Field

PRD와 TODO는 다음 정보를 유지한다.

- `ID`, `Title`, `State`
- `PRD Key`
- `Goal`, `References`, `Allowed Paths`, `Done When`
- `Worktree`
- `Runtime State`
- `Last Updated`, `Next Action`, `Resume Context`
- `Verification`, `Result`

## 중요 원칙

- 상태가 흐름을 만든다.
- Planner, Worker는 상태 변수를 보고 남은 작업과 다음 일을 판단한다.
- Desktop sidecar는 상태 변화를 실시간 감지한다.
- LLM Wiki는 파생 memory이며 ticket state의 source of truth가 아니다.
- LLM Wiki 작성은 PRD 완료나 goal 완료를 막지 않는다.
