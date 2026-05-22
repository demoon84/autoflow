---
name: atodo
description: 사용자가 $atodo 또는 #atodo를 호출하거나, 작고 명확한 Autoflow 작업을 전체 PRD draft 없이 tickets/todo/에 직접 넣길 원할 때 사용한다.
---

# Autoflow Direct Todo Intake

워커 러너가 즉시 claim할 수 있는 작고 명확한 변경을 위한 lightweight Autoflow intake hook으로 행동한다. 완전한 Todo ticket을 `{{BOARD_DIR}}/tickets/todo/TODO-NNN.md` 아래에 직접 쓴다. PRD 단계는 없다.

## 저장 전 조회

Todo를 쓰기 전에 관련 prior work를 드러내서 사용자가 과거 결정을 반복하지 않고 이어갈 수 있게 한다.

1. 사용자 요청에서 특징적인 keyword 1~3개를 고른다. 예: feature noun, file path basename, error string, UI element name.
2. Best-effort로 실행한다. 오류가 나면 "no hits"로 보고 계속한다.
   - `autoflow origin search "<keyword>"` — prompt, prd_path, ticket title, commit subject와 맞는 과거 PRD/todo.
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — prior decision, learning, failed/retried approach, 관련 done-ticket context. 강한 keyword가 여러 개면 `--term` flag를 여러 번 쓴다.
3. 의미 있는 hit가 있으면 origin/wiki finding을 사용자에게 한국어로 짧게 요약한다.
4. 관련 wiki finding으로 명확한 `--allowed-path`, `--done`, `--verification` hint를 더 좁힌다.
5. Lookup 결과와 무관하게 todo 저장으로 진행한다.

Keyword가 불안정한 매우 짧은 요청(8자 이하)은 lookup을 생략한다.

## 이 Skill과 `$aprd` 사용 기준

- `$atodo`: 명확한 `Allowed Paths` boundary와 구체적인 `Done When`이 있는 단일, 좁은, 기계적으로 명확한 변경. 워커 러너가 다음 tick에서 claim할 수 있다.
- `$aprd`: scope discussion, multi-file slicing, 여러 PRD/ticket 분리가 필요한 작업.

## 규칙

1. `$atodo`, `#atodo`, `/atodo`는 direct-todo trigger로 취급한다.
2. Worker가 claim할 수 있는 완전한 ticket을 `{{BOARD_DIR}}/tickets/todo/TODO-NNN.md`에 저장한다. Required field를 비우거나 `TBD`로 남기지 않는다.
3. 필수 worker field: `Title`, `Goal`, 구체적인 repo-relative `Allowed Paths`, 관찰 가능한 항목 2개 이상의 `Done When`, 실제 command 또는 file-review note가 있는 `none-shell` 형태의 `Verification.Command`.
4. 사용자의 원 요청은 `## Notes` 아래에 `User request: ...`로 시작하는 bullet 하나로 원문 그대로 보존한다.
5. Priority 기본값은 `normal`이다. `high`는 사용자가 해당 ticket이 다른 작업을 막는다고 명시했거나 urgent/긴급/최우선/blocking이라고 부른 경우에만 쓴다. 중요한 기능, 마이그레이션 후속, scope 확장, 일반 follow-up만으로는 `high`가 아니다. `critical`은 host/board emergency에만 쓴다. `low`는 non-urgent cleanup에만 쓴다.
6. CLI를 사용할 수 있으면 `autoflow todo create <project-root> <board-dir-name> --title "<title>" --allowed-path <path>... --done "<item>"... --verification "<cmd>"`를 선호한다. 아니면 파일을 직접 쓴다.
7. `/atodo`로 직접 생성된 ticket만 TODO worktree를 만든다. 작업 종료 후 해당 TODO를 처리한 워커 러너가 TODO worktree를 main/master에 squash merge한다.
8. PRD, code change, verification record, commit, push를 만들지 않는다.
9. Canonical todo 본문은 한국어로 쓴다. Parser-sensitive field, path, command, id는 필요한 format을 유지한다.
10. 저장 후 사용자에게 저장된 TODO-NNN path와 워커 러너(`autoflow run worker`)가 다음 tick에서 claim한다고 알려준다.

## Direct Todo 템플릿

```md
# Ticket

## Ticket

- ID: TODO-NNN
- PRD Key:
- PRD Slice: 1/1
- Plan Candidate: atodo direct intake
- Title: <short title>
- Priority: normal
- Change Type: code | docs | cleanup | infra
- Stage: todo
- AI: atodo
- Claimed By:
- Execution AI:
- Verifier Runner:
- Last Updated:

## Goal

- <워커가 실행할 수 있는 한 문장 implementation goal>

## References

- PRD:
- Feature Spec:
- Plan Source: atodo-direct

## Reference Notes

- Project Note:
- Plan Note:
- Ticket Note: [[TODO-NNN]]

## Allowed Paths

- path/to/file-or-folder

## Worktree

- Path:
- Branch:
- Base Commit:
- Worktree Commit:
- Integration Status: pending_claim

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Done When

- [ ] <Allowed Paths 안의 변경이 Goal 결과를 반영한다>
- [ ] <검증 명령이 exit 0으로 끝나거나, none-shell이면 파일 검토 근거가 기록된다>
- [ ] <최종 diff가 Allowed Paths 밖의 파일을 포함하지 않는다>

## Next Action

- 워커 러너가 claim 후 mini-plan을 작성하고 Allowed Paths 안에서 구현, 검증, 검증 러너 handoff까지 진행한다.

## Resume Context

- Current state: atodo가 직접 등록한 todo ticket이다.
- Last completed action: atodo skill이 이 ticket을 작성했다.
- 재개 시 먼저 확인할 것: Goal, Allowed Paths, Done When.

## Notes

- User request: <사용자의 원문 요청을 그대로 보존>

## Verification

- Command: <real command or none-shell>
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
```

Autoflow 보드를 찾지 못하면 프로젝트에 Autoflow 보드가 먼저 필요하다고 설명하고 `autoflow init <project-root>` 또는 desktop install flow를 제안한다.
