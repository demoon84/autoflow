# PRD Template

승인된 `/aprd` handoff(`$aprd`, `#aprd`)에서 생성되는
`tickets/prd/PRD-NNN.md` 파일에는 이 템플릿을 쓴다.

PRD는 scope, assumption, acceptance criteria, verification intent를 담는 첫 번째
authoritative 문서다.

```md
# PRD PRD-NNN: <title>

## Project

- ID: PRD-NNN
- Title: <title>
- AI: <authoring agent>
- Status: draft | generated | approved
- Priority: normal
- Change Type: code | docs | cleanup | infra
- Requires Secrets: []
- Branch: <planner.write-prd 가 autoflow/prd-NNN 으로 자동 채움>
- Base Commit: <planner.write-prd 가 main HEAD SHA 로 자동 채움>

## Source

- Origin: conversation | manual
- User Request: "<보존할 짧은 요청 또는 요약>"
- Related Work: <유용한 wiki/ticket reference>

## Problem

<잘못되었거나, 빠졌거나, 혼란스럽거나, 요청된 내용>

## Goal

<이 PRD가 가능하게 만들어야 하는 outcome>

## Scope

- In Scope: <포함되는 behavior/module/docs>
- Out of Scope: <제외되는 behavior/module/docs>
- Assumptions: <검증하거나 보존해야 하는 planner/spec assumption>
- Remaining Unknowns: <ticket creation을 막지 않는 unknown>

## Main Screens / Modules

- Module: <module, screen, command, document area>
- Path: `path/to/file-or-folder`

## Allowed Paths

- path/to/file-or-folder

## Global Acceptance Criteria

- [ ] <user-visible behavior, command output, file evidence에 근거한 관찰 가능한 criterion>
- [ ] <구체적 path, command, state, example이 있는 관찰 가능한 criterion>
- [ ] <관련 reset/error/regression behavior를 다루는 관찰 가능한 criterion>

## Verification

- Command: npm run test
- Command: none-shell
- Notes: <manual check, browser check, evidence expectation, shell command가 맞지 않는 이유>

## Todo Split Map

- Title: <선택적 todo slice title>
  - Goal: <worker가 소유할 implementation outcome 하나>
  - Priority: normal
  - Scope: <이 todo의 좁은 boundary>
  - Allowed Paths: path/to/file-or-folder, path/to/other-file
  - Done When: <이 todo의 관찰 가능한 criterion>
  - Verification: npm run test

## Conversation Handoff

- Source: <conversation path>
- Summary: <다음 runner를 위한 짧은 한국어 handoff>

## Notes

- <constraint, 관련 wiki/ticket reference, risk, split/follow-up note>
```

## Notes

- PRD 본문은 기본적으로 한국어로 쓴다. Parser-sensitive heading, id, path, command, code, runtime format은 보존한다.
- Priority 기본값은 `normal`이다. `high`는 사용자가 해당 작업이 다른 작업을 막는다고 명시했거나 urgent/긴급/최우선/blocking이라고 부른 경우에만 쓴다. 중요한 기능, 마이그레이션 후속, scope 확장, 일반 follow-up만으로는 `high`가 아니다. `critical`은 보드 무결성 손상, 보안 노출, 실행 환경 고갈처럼 즉시 복구가 필요한 장애에만 쓴다.
- PRD acceptance criteria는 나중에 Todo `Done When`이 될 수 있으므로 `autoflow tool lint-ticket`가 판단할 수 있을 만큼 구체적으로 쓴다.
- `Todo Split Map`은 선택 사항이다. PRD 하나를 여러 worker-owned todo ticket으로 구현해야 할 때 쓴다. 플래너 러너는 각 todo의 `Allowed Paths`와 `Done When`을 구체적으로 유지하면서 split item마다 todo 하나를 만들 수 있다.
- PRD의 `Priority: high`는 TODO로 자동 상속되지 않는다. TODO를 `high`로 만들어야 하면 `Todo Split Map`의 해당 slice에 `Priority: high`를 명시하고 위 기준을 만족하는 이유를 `Notes`나 `Ticket Note`에 남긴다.
