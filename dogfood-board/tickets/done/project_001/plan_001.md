# Plan

## Plan

- Plan ID: plan_001
- Title: Runner/Wiki Board Scaffold Phase 1
- Status: done

## Goal

- 이 plan 이 해결하려는 큰 목표: generated Autoflow board 가 local agent runner harness 의 기본 폴더와 문서 계약을 갖도록 확장한다.

## Spec References

- Project Spec: `tickets/done/project_001/project_001.md`
- Feature Spec:

## Obsidian Links
- Project Note: [[project_001]]
- Plan Note: [[plan_001]]

## Scope

- In Scope:
  - generated board 에 `runners`, `wiki`, `metrics`, `conversations`, `agents/adapters`, `rules/wiki` scaffold 추가
  - scaffold / upgrade 경로에서 기존 live board state 를 보존하며 새 구조 추가
  - doctor 또는 status 계열에서 runner/wiki scaffold 존재 여부를 관찰 가능하게 노출
  - README/reference 문서에 runner harness 와 wiki layer 방향 반영
- Out of Scope:
  - 실제 agent CLI 실행
  - desktop terminal embedding
  - `autoflow run`, `autoflow runners`, `autoflow wiki`, metrics command 구현
  - todo/verifier lifecycle 변경
  - git push

## Execution Candidates

- [ ] Add runner, wiki, metrics, conversations, adapter, and wiki-rule template files to the generated board scaffold.
- [ ] Update init/package-board logic so fresh boards include the new runner/wiki scaffold without overwriting existing state.
- [ ] Update upgrade logic so existing boards receive missing runner/wiki scaffold files and directories safely.
- [ ] Update doctor/status checks to report runner/wiki scaffold health in machine-readable output.
- [ ] Update README and reference docs to describe Autoflow as a local coding-agent harness with board ledger and wiki map.

## Ticket Rules

- Allowed Paths:
  - scripts/cli/scaffold-project.sh
  - scripts/cli/scaffold-project.ps1
  - scripts/cli/package-board-common.sh
  - scripts/cli/package-board-common.ps1
  - scripts/cli/upgrade-project.sh
  - scripts/cli/upgrade-project.ps1
  - scripts/cli/doctor-project.sh
  - scripts/cli/doctor-project.ps1
  - templates/board/
  - agents/
  - reference/
  - rules/
  - README.md
  - plan.md
- Ticket split notes:
  - Keep template additions separate from CLI behavior updates where possible.
  - Keep doctor/status reporting separate so it can be verified with smoke boards.
  - Documentation updates should not change runtime behavior.

## Generated Tickets

- 아직 없음

## Notes

- This plan intentionally keeps Phase 1 limited to board schema and documentation.
- Runner execution and desktop terminal controls come in later plans.
