---
id: memo_060
title: Planner recovery 자동화 — needs_user 자동 해소 정책
status: inbox
created: 2026-05-02
---

## Request

오케스트레이터가 recovery 케이스를 자동으로 풀어야 함. 지금처럼 사람이 매번 결정해 달라고 멈추는 건 오케스트레이터의 존재 이유와 맞지 않는다. `needs_user` 는 진짜 사람이 봐야만 풀리는 케이스에만 남기고, 다음 조건에서는 자동 회복으로 전환해야 한다.

## 자동 회복 조건 (Plan AI 가 직접 처리해야 함)

1. **dirty worktree 가 에이전트 자기 실패로만 생긴 경우**
   - "에이전트 자기 실패" 의 정의: 해당 worktree 안에 사용자가 직접 만든 commit / staged change / push 가 없고, 모든 변경이 직전 ticket-owner 또는 verifier 의 자동 실행으로 발생한 흔적인 경우.
   - 처리: planner 가 worktree 를 폐기(`git worktree remove --force` 또는 동등 cleanup) 하고 retry 또는 reject 정리로 보드 흐름 복구. 사용자 동의 묻지 않음.
   - 안전망: 폐기 직전에 dirty diff 를 `.autoflow/runners/state/recovery-discarded/<ticket>-<timestamp>.diff` 같은 위치에 보존해 사후 검증 가능하도록 한다.

2. **`allowed_path_conflict` 가 동일 영향권 안에서 발생한 경우**
   - 정의: reject 사유의 unmet path 가 현재 Allowed Paths 의 부모 디렉터리 또는 같은 종류의 파일군에 속하는 경우 (예: Allowed Paths 가 `scaffold/board/**` 를 포함하는데 conflict 가 `scaffold/board/reference/{README,backlog,tickets-board}.md` 처럼 같은 트리 안에 있을 때).
   - 처리: planner 가 새 retry 티켓을 만들어 Allowed Paths 에 그 unmet path 를 자동 확장하고 1회 자동 retry. `AUTOFLOW_REJECT_MAX_RETRIES` 카운터에 포함.
   - 안전 가드: 동일 영향권이 아닌 경우(예: `scaffold/board/**` 작업인데 unmet path 가 `apps/desktop/**` 처럼 완전히 다른 트리) 까지 자동 확장하지 않는다. 그건 진짜 `needs_user`.

3. **`AUTOFLOW_REJECT_MAX_RETRIES` 도달 후에만** 진짜 `needs_user` 로 파킹.
   - 같은 사유로 N 회 실패 → 그때만 사람이 봐야 한다는 의미. 기본 N 은 환경변수로 설정 가능.

## 추가 요구사항

- env 토글: `AUTOFLOW_RECOVERY_AUTO=on` (기본 on) / `off` (지금처럼 즉시 needs_user). off 는 회의적 환경/디버깅 용.
- 결정 로그: 자동 회복으로 처리한 케이스를 `.autoflow/runners/logs/planner.log` 에 `event=auto_recovery_resolved reason=...` 로 명시 기록. wiki 합성에도 반영되어 결정 이력 추적 가능.
- 사람 손댄 흔적이 worktree 에 있을 때(예: 사용자 commit, branch divergence) 는 무조건 `needs_user` 유지. 자동 폐기 금지.

## 현 케이스 (배경 — 동기 부여용)

- `tickets/inprogress/tickets_102.md` (PRD prd_098, "Order/PRD wording 변경") 가 `Recovery State: needs_user`, `Failure Class: leftover_worktree` 로 무기한 멈춤.
- 원인: dirty worktree (에이전트 자기 실패), `allowed_path_conflict` 가 `scaffold/board/reference/*` (같은 영향권). 위 자동 회복 정책 둘 다에 해당.
- 사용자 입장: 이런 거 해결하라고 오케스트레이터를 붙였는데, 사람한테 결정 받으려고 멈추는 건 본말전도.

## Notes

- 핵심 변경 지점 후보:
  - `bin/autoflow` 또는 `packages/cli/start-plan.sh` 안의 recovery 분기 로직.
  - planner adapter 가 호출하는 recovery 결정 코드 (`packages/cli` / `.autoflow/automations/` 안 어딘가).
  - 보드 가드/검증 코드 — 자동 확장된 Allowed Paths 를 PRD 의 원본과 구분해 후속 회귀에서 자동 확장분만 롤백하기 좋게 표시.
  - Plan AI / Impl AI 의 agent 지침 (`.autoflow/agents/plan-to-ticket-agent.md`, `.autoflow/agents/ticket-owner-agent.md`) 도 새 정책에 맞춰 갱신.
- 이번 변경은 보드 contract / parser-sensitive 출력 / runner state 파일 포맷은 그대로 두고, recovery 결정 분기 로직과 그 결정 기록만 손본다.

## Scope hint

- 후보 파일 (Plan AI 가 정확한 위치 확인):
  - `bin/autoflow`
  - `packages/cli/**` (특히 start-plan / recovery 관련)
  - `.autoflow/automations/**`
  - `.autoflow/agents/plan-to-ticket-agent.md`, `.autoflow/agents/ticket-owner-agent.md`
  - `.autoflow/rules/**` 의 recovery 정책 문서

## Verification hint

- 의도적으로 dirty worktree + allowed_path_conflict 를 만들어 reject 시나리오 재현 → planner 가 사람 개입 없이 한 tick 또는 두 tick 안에 자동 폐기/확장/재시도하는지 확인.
- 사용자 commit 이 있는 worktree 는 그대로 `needs_user` 유지하는지 확인.
- `AUTOFLOW_RECOVERY_AUTO=off` 환경에서 기존(현재) 동작이 그대로 재현되는지 확인.
- `AUTOFLOW_REJECT_MAX_RETRIES` 도달 케이스가 진짜 `needs_user` 로 가는지 확인.
- planner.log 에 `event=auto_recovery_resolved` 가 기록되는지 확인.
- 현재 막힌 `tickets_102` 가 새 정책 적용 후 자동 흐름으로 풀리는지 (또는 별도 retry 티켓이 자동 발급되는지) 확인.
