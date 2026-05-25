# PRD Template

`autoflow` skill 대화가 발행하는 `tickets/prd/PRD-<id>.md` 파일에는 이 템플릿을 쓴다.

PRD는 현재 turn의 scope, assumption, acceptance criteria, verification intent를 담는 authoritative 문서다.

```md
# PRD PRD-<id>: <title>

## Project

- ID: PRD-<id>
- Title: <title>
- AI: autoflow-skill
- State: active
- Change Type: code | docs | cleanup | infra
- Requires Secrets: []
- Branch: autoflow/prd-<id> 또는 TBD
- Base Commit: <git SHA> 또는 TBD

## Source

- Origin: autoflow
- User Request: "<보존할 짧은 요청 또는 요약>"
- Related Work: <유용한 wiki/work reference 또는 none>

## Problem

<잘못되었거나, 빠졌거나, 혼란스럽거나, 요청된 내용>

## Goal

<이 PRD turn이 가능하게 만들어야 하는 outcome>

## Scope

- In Scope: <포함되는 behavior/module/docs>
- Out of Scope: <제외되는 behavior/module/docs>
- Assumptions: <검증하거나 보존해야 하는 assumption>
- Remaining Unknowns: <work item 생성을 막지 않는 unknown>

## Main Screens / Modules

- Module: <module, screen, command, document area>
- Path: `path/to/file-or-folder`

## Allowed Paths

- path/to/file-or-folder

## Global Acceptance Criteria

- [ ] (auto) <command output, file evidence에 근거한 자동 검증 가능한 criterion>
- [ ] (manual) <사람의 UI/문서/시각 확인이 필요한 user-visible criterion>
- [ ] (auto) <관련 reset/error/regression behavior를 다루는 자동 검증 가능한 criterion>

## Verification

- Command: npm run test
- Command: none-shell
- Notes: <manual check, browser check, evidence expectation, shell command가 맞지 않는 이유>

## Work Item Split

- Title: <선택적 work item title>
  - Goal: <worker role이 소유할 implementation outcome 하나>
  - Scope: <이 work item의 좁은 boundary>
  - Allowed Paths: path/to/file-or-folder, path/to/other-file
  - Done When: - [ ] (auto) <이 work item의 자동 검증 가능한 criterion>
  - Verification: npm run test
  - Depends On: <먼저 완료되어야 하는 work item id 또는 (없음)>
  - Notes: <추가 제약, 위험, handoff note 또는 (없음)>

## Conversation Handoff

- Source: <conversation path>
- Summary: <다음 role assignment를 위한 짧은 한국어 handoff>

## Notes

- <constraint, 관련 wiki/work reference, risk, split/follow-up note>
```

## Notes

- PRD 본문은 기본적으로 한국어로 쓴다. Parser-sensitive heading, id, path, command, code, runtime format은 보존한다.
- PRD acceptance criteria는 work item `Done When`이 될 수 있으므로 기계적 검사와 사람의 파일 검토로 관찰 가능해야 한다.
- `Work Item Split`은 선택 사항이다. PRD 하나를 여러 work item으로 구현해야 할 때 쓴다.
- `Branch`와 `Base Commit`은 발행 시점에 `TBD`일 수 있다. 플래너가 PRD worktree를 생성/보장한 뒤 두 필드를 실제 값으로 채운다.
