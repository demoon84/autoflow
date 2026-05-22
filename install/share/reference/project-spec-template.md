# Project PRD Template

## Project

- ID: PRD-NNN
- Title:
- AI:
- Status: draft
- Requires Secrets: []

## Core Scope

- Goal: 이 PRD가 달성해야 하는 사용자 또는 시스템 outcome을 적는다.
- In Scope: 이 작업에 포함되는 범위를 적는다.
- Out of Scope: 이 작업에서 제외되는 범위를 적는다.

## Main Screens / Modules

- Module: 영향을 받는 screen, module, command, document area 이름을 적는다.
- Path: `path/to/file-or-folder`

## 전역 규칙

- Allowed Paths는 host project root 기준 상대 경로다.
- ticket이 달리 지시하지 않는 한 검증 명령은 host project root에서 실행한다.
- acceptance criteria는 관찰 가능하게 작성한다.
- 사람이 읽는 PRD 본문은 기본적으로 한국어로 쓴다. Parser-sensitive section name, field name, id, path, command, code, runtime format은 보존한다.
- Verification에 외부 credential이 필요하면 `Requires Secrets`에 environment variable 이름만 적는다. 예: `[OPENAI_API_KEY]`. Secret value는 저장하지 않는다.

## Global Acceptance Criteria

- [ ] Command output, UI observation, file review로 뒷받침되는 관찰 가능한 completion criterion.
- [ ] 완료를 증명하는 user-visible behavior 또는 system-visible result.

## Verification

- Command: `command-to-run`
- Notes: verification scope, extra check, manual review 기준을 적는다.

## Conversation Handoff

- Source: 원 요청 또는 conversation reference를 적는다.
- Summary: 다음 runner가 읽을 수 있게 요청을 요약한다.

## Notes

- Constraint, risk, 관련 wiki/ticket reference를 기록한다.
