# PRD Handoff

- Project: project_093
- Spec: tickets/backlog/prd_093.md
- Source: autoflow spec create

## Conversation Summary

```text
# Project PRD

## Meta

- Project Key: prd_093
- Title: Worker 작업 생명주기 격리
- Status: populated

## Goal

Worker가 티켓 작업을 시작한 순간부터 완료 처리까지 제품 코드와 보드 변경이 main working tree를 계속 더럽히지 않도록 격리한다. worker는 티켓별 worktree 또는 branch 기반 격리 환경에서 구현, 검증, 보드 상태 갱신, 최종화 준비를 수행하고, main에는 검증된 결과를 명시적인 통합 지점에서만 반영해야 한다.

## Core Scope

### In Scope

- worker 시작 시 제품 코드뿐 아니라 worker가 쓰는 티켓 상태/검증 증거/완료 준비 변경까지 가능한 한 격리된 작업 루트에서 처리하는 구조를 설계하고 구현한다.
- 현재 main 프로젝트 루트에 생기는 변경 유형을 분류한다: `.autoflow/tickets/*` 이동/삭제, `.autoflow/wiki/*` deterministic 갱신, 제품 코드 변경, verifier log, local completion commit.
- ticket worktree 또는 integration branch/worktree 중 Autoflow에 맞는 기본 격리 모델을 결정한다.
- `needs_ai_merge` 이후 worker가 main에 변경을 남긴 채 멈추지 않도록, 최종 통합을 atomic하게 수행하거나 main에 반영된 직후 반드시 commit/cleanup까지 이어지게 한다.
- 실패/반려/중단 시 main working tree가 깨끗하게 남고, 격리된 worktree/branch와 board evidence만 복구 대상으로 남도록 한다.
- 기존 보드 source-of-truth 원칙과 충돌하지 않도록 planner/owner/wiki 역할별 쓰기 경계를 문서화한다.
- smoke test로 worker 작업 중 main dirty가 생기지 않는 경로와 pass 최종화 후 main이 깨끗한 경로를 검증한다.

### Lifecycle Isolation Contract

- Worker 시작 시점에는 반드시 티켓별 isolation context를 먼저 만든다. 구현 방식은 worktree, branch, integration worktree 중 하나를 선택할 수 있지만, 선택된 context의 경로/브랜치/기준 commit은 티켓에 기록한다.
- Worker 실행 중에는 제품 코드 변경, 검증 산출물, 완료 준비 상태가 isolation context 밖의 main working tree로 새지 않아야 한다.
- Worker 종료 시점에는 성공/pass, reject/fail, blocked, retry-limit 모두 main working tree가 깨끗한 상태로 끝나야 한다.
- 성공/pass 경로에서 main에 반영되는 순간은 finalization 단계 하나뿐이어야 하며, 반영 직후 commit, wiki baseline 갱신, 티켓 이동, worktree/branch cleanup까지 atomic하게 이어진다.
- 종료 전 cleanup에 실패하면 다음 티켓 claim을 막고, 티켓에는 남은 isolation context와 복구 명령을 `Recovery State`로 기록한다.

### Out of Scope

- 원격 push.
- 여러 Impl AI 병렬 확장.
- 제품 UI 기능 변경.
- 기존 완료 티켓 이력 전체 재작성.
- 사용자의 미커밋 로컬 변경 강제 삭제.

## Main Screens / Modules

- `runtime/board-scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `runtime/board-scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `runtime/board-scripts/common.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts/update-wiki.sh`
- `.autoflow/scripts/update-wiki.sh`
- `.autoflow/agents/ticket-owner-agent.md`
- `scaffold/board/agents/ticket-owner-agent.md`
- `.autoflow/reference/tickets-board.md`
- `scaffold/board/reference/tickets-board.md`
- `.autoflow/automations/README.md`
- `scaffold/board/automations/README.md`
- `tests/smoke/ticket-owner-*.sh`

## Allowed Paths

- runtime/board-scripts/start-ticket-owner.sh
- .autoflow/scripts/start-ticket-owner.sh
- runtime/board-scripts/finish-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- runtime/board-scripts/merge-ready-ticket.sh
- .autoflow/scripts/merge-ready-ticket.sh
- runtime/board-scripts/common.sh
- .autoflow/scripts/common.sh
- runtime/board-scripts/update-wiki.sh
- .autoflow/scripts/update-wiki.sh
- .autoflow/agents/ticket-owner-agent.md
- scaffold/board/agents/ticket-owner-agent.md
- dogfood-board/agents/ticket-owner-agent.md
- .autoflow/reference/tickets-board.md
- scaffold/board/reference/tickets-board.md
- .autoflow/automations/README.md
- scaffold/board/automations/README.md
- tests/smoke/ticket-owner-*.sh
- tests/smoke/worker-*.sh

## Global Acceptance Criteria

- [ ] Worker가 티켓을 claim/resume한 직후 main working tree에 제품 코드 변경이 생기지 않는다.
- [ ] Worker claim 시 isolation context 경로/브랜치/기준 commit이 티켓에 기록된다.
- [ ] Worker 구현/검증 중 제품 코드 변경은 ticket worktree 또는 integration worktree/branch 안에만 존재한다.
- [ ] `needs_ai_merge` 상태 이후에도 main에 미커밋 제품 코드 변경을 남긴 채 다음 티켓을 claim하지 않는다.
- [ ] pass 최종화가 성공하면 main에는 완료 commit만 남고 working tree는 깨끗하며, 성공한 isolation worktree/branch는 삭제되거나 archived 상태로 명시된다.
- [ ] fail/reject/max retry/blocked 경로에서는 main working tree가 깨끗하고, 복구 대상은 격리 worktree/branch 또는 board evidence로 남는다.
- [ ] cleanup 실패 상태에서는 owner가 새 티켓을 claim하지 않고 planner/owner가 복구 지시를 볼 수 있다.
- [ ] `.autoflow` 보드 변경이 main에 직접 남아야 하는 경우와 격리되어야 하는 경우가 문서와 smoke로 구분된다.
- [ ] deterministic wiki 갱신이 main dirty를 남긴 채 중단되지 않도록 finalization commit 경계 안에서 처리된다.
- [ ] 기존 `ticket-owner-smoke`, dirty-root, needs-ai-merge 관련 smoke가 새 격리 계약에 맞게 통과한다.

## Verification

- Command: bash -n runtime/board-scripts/common.sh .autoflow/scripts/common.sh runtime/board-scripts/start-ticket-owner.sh .autoflow/scripts/start-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/merge-ready-ticket.sh .autoflow/scripts/merge-ready-ticket.sh
- Command: bash tests/smoke/ticket-owner-smoke.sh
- Command: bash tests/smoke/ticket-owner-dirty-unrelated-integration-smoke.sh
- Command: bash tests/smoke/ticket-owner-goal-runtime-smoke.sh
- Command: bash tests/smoke/board-protocol-scaffold-sync-smoke.sh
- Command: git diff --check

## Notes

- 이 PRD는 worker 실행 격리 자체를 다룬다. `prd_092`의 retry-limit 오케스트레이터 처리와는 별도 작업이다.
- 현재 구조는 ticket worktree에서 구현하더라도 최종 AI-led merge 단계에서 `PROJECT_ROOT`/main을 직접 변경한다. 이 때문에 worker가 최종화 전에 멈추면 main dirty가 남을 수 있다.
- 목표는 main에 절대 변경을 하지 않는 것이 아니라, worker 작업 중간 상태가 main에 새지 않고 성공/실패 종료 경계가 명확해지는 것이다.
- 구현 시 선택지는 (a) 제품 코드만 ticket worktree 격리 + board는 main 유지, (b) board 변경까지 worker branch/worktree에 격리 후 finalization에서 통합, (c) 별도 integration worktree로 main 통합 commit을 만든 뒤 fast-forward하는 방식이 있다. Planner/owner는 위험과 구현 비용을 비교해 가장 작은 안전한 방식을 선택한다.
```
