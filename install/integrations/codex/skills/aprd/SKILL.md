---
name: aprd
description: 사용자가 $aprd 또는 #aprd를 호출하거나, Autoflow PRD handoff 생성을 요청하거나, 요구사항을 나중에 플래너 러너와 워커 러너가 실행할 Autoflow PRD queue item 하나 이상으로 바꾸길 원할 때 사용한다.
---

# Autoflow PRD Handoff

Codex용 Autoflow PRD handoff entry point로 행동한다.

## Draft 전 조회

PRD content를 draft하기 전에 관련 prior work를 드러내서, 새 PRD가 기존 결정을 거스르지 않고 reference/reuse할 수 있게 한다.

1. 사용자가 말한 goal/scope에서 특징적인 keyword 1~3개를 고른다. 예: feature noun, module name, file path.
2. Best-effort로 실행한다. 오류가 나면 "no hits"로 보고 계속한다.
   - `autoflow origin search "<keyword>"` — 과거 PRD와 결과 commit.
   - `autoflow wiki query --term "<keyword>" --rag --limit 3` — prior decision, learning, failed/retried approach, 관련 done-ticket context. 강한 keyword가 여러 개면 `--term` flag를 여러 번 쓴다.
3. Hit가 있으면 origin/wiki finding을 한국어로 짧게 요약하고, 기존 PRD 확장, cross-reference가 있는 sibling PRD 분리, prior work supersede 중 무엇을 할지 묻는다. Supersede는 `Conversation Handoff`에 기록한다.
4. 관련 wiki finding은 scope, risk, `Allowed Paths`, acceptance criteria, verification hint를 만들 때 design constraint로 사용한다. Draft를 진행하면 유용한 wiki/ticket reference를 `Conversation Handoff` 또는 `Notes`에 인용한다.
5. 이후 conversation phase로 진행한다. Lookup 실패 때문에 PRD drafting을 막지 않는다.

## 규칙

1. `$aprd`, `#aprd`, `/aprd`는 PRD handoff trigger로 취급한다. 작고 단일 파일의 기계적 변경은 `$atodo` direct todo가 담당한다. 이 skill은 planner-driven slicing이나 실제 scope discussion이 필요한 작업에만 쓴다.
2. 현재 프로젝트에 `AGENTS.md`, `CLAUDE.md`, `{{BOARD_DIR}}/AGENTS.md`, `{{SHARE_ROOT}}/agents/spec-author-agent.md`가 있으면 draft 전에 관련 파일을 읽는다.
3. Free-form conversation으로 사용자 goal, scope, affected module, allowed paths, acceptance criteria, verification command를 수집한다. 짧은 질문과 bullet recap을 쓰고, 매 turn PRD template을 렌더링하지 않는다.
4. Scope가 여러 independent outcome, module, release, risk area, verification path에 걸치면 draft 전에 가벼운 PRD split map을 제안한다.
5. 사용자가 `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft` 또는 동등하게 명확한 요청을 하기 전에는 전체 PRD draft를 만들지 않는다.
6. Draft trigger가 들어오면 지금까지 모은 정보로 complete PRD를 한 번 렌더링한다. Split work는 각 PRD draft를 따로 렌더링하고 `Conversation Handoff` 또는 `Notes`에 sibling reference를 넣는다. 아직 모르는 값은 추측하지 말고 `TBD` / `undecided`로 표시한다.
7. `save`, `저장`, `confirm`, `approved`, `ready` 같은 별도의 명시적 저장 확인 이후에만 저장한다. Draft trigger는 저장 승인이 아니다. 여러 draft는 PRD별 승인 또는 명확한 `save all` / `전부 저장` 확인이 필요하다.
8. PRD queue item만 저장한다. Todo ticket, code change, verification record, commit, push를 만들지 않는다.
9. PRD 저장은 `autoflow spec create <project-root> <board-dir-name> --from-file <draft-file> --raw --save-handoff`를 사용한다. 이 경로가 `autoflow/prd-NNN` 브랜치와 PRD worktree를 먼저 만든 뒤 PRD queue item을 저장한다. CLI가 실행 불가능한 경우에만 사용자에게 legacy fallback임을 알린 뒤 승인된 markdown을 `{{BOARD_DIR}}/tickets/prd/PRD-NNN.md`에 직접 쓴다. 여러 PRD는 active slot 하나씩 별도 `PRD-NNN.md` 파일로 저장한다.
10. PRD에서 파생되는 TODO는 TODO worktree를 만들지 않는다. 플래너 러너가 만든 TODO는 해당 `autoflow/prd-NNN` worktree 안에서만 작업되며, 모든 TODO가 done되면 마지막 TODO를 완료한 워커 러너가 PRD worktree를 main/master에 squash merge한다.
11. 저장 후 사용자에게 저장 path, 관련된 경우 intended order, 그리고 플래너 러너(`autoflow run planner`)가 각 PRD를 하나 이상의 todo ticket으로 바꾼 뒤 워커 러너가 desktop PTY 또는 focused worker startup/tool flow(`autoflow run worker`, alias `autoflow run ticket`)로 이어간다고 알려준다.
12. Canonical PRD 본문은 기본적으로 한국어로 쓴다. 대화가 한국어가 아니어도 필요한 곳의 사용자 원문만 보존하고, problem, goal, scope, acceptance criteria, handoff, notes는 한국어로 쓴다.
13. Priority 기본값은 `normal`이다. `high`는 사용자가 해당 작업이 다른 작업을 막는다고 명시했거나 urgent/긴급/최우선/blocking이라고 부른 경우에만 쓴다. 중요한 기능, 마이그레이션 후속, scope 확장, 일반 follow-up만으로는 `high`가 아니다. `critical`은 보드 무결성 손상, 보안 노출, 실행 환경 고갈처럼 즉시 복구가 필요한 장애에만 쓴다. PRD의 `Priority: high`는 TODO로 자동 상속되지 않으므로, 특정 TODO가 정말 `high`여야 하면 `Todo Split Map`의 해당 slice에 `Priority: high`와 이유를 남긴다.

## PRD 초안 템플릿

Draft trigger가 들어오면 PRD를 아래 형태 그대로 렌더링한다. PRD는 scope, assumption, acceptance criteria, verification intent의 첫 authoritative 문서다. Todo ticket은 planner-owned이며, direct simple work에서는 `$atodo`-owned다. 이 skill이 todo ticket을 쓰면 안 된다.

```md
# PRD PRD-NNN: <title>

## Project

- ID: PRD-NNN
- Title: <title>
- AI: <authoring agent>
- Status: draft
- Priority: normal
- Change Type: code | docs | cleanup | infra
- Requires Secrets: []

## Source

- Origin: conversation
- User Request: "<보존할 짧은 요청 요약>"
- Related Work: <wiki/ticket reference 또는 none>

## Problem

<잘못되었거나, 빠졌거나, 혼란스럽거나, 요청된 내용>

## Goal

<이 PRD가 가능하게 만들어야 하는 outcome>

## Scope

- In Scope: <포함되는 behavior/module/docs>
- Out of Scope: <제외되는 behavior/module/docs>
- Assumptions: <명시적 assumption>
- Remaining Unknowns: <ticket creation을 막지 않는 unknown>

## Main Screens / Modules

- Module: <screen, module, command, document area>
- Path: `path/to/file-or-folder`

## Allowed Paths

- path/to/file-or-folder

## Global Acceptance Criteria

- [ ] <command output, UI observation, file review에 근거한 관찰 가능한 criterion>
- [ ] <구체적 path, state, example, exit code, numeric signal이 있는 관찰 가능한 criterion>
- [ ] <관련 regression/reset/error condition>

## Verification

- Command: <repo-relative command or none-shell>
- Notes: <verification scope, manual check, browser check, evidence expectation>

## Conversation Handoff

- Source: conversation
- Summary: <다음 runner를 위한 짧은 한국어 handoff>

## Notes

- <constraint, risk, split/follow-up note, 관련 wiki/ticket reference>
```

Autoflow 보드를 찾지 못하면 프로젝트에 Autoflow 보드가 먼저 필요하다고 설명하고 `autoflow init <project-root>` 또는 desktop install flow를 제안한다.
