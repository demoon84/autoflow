# Ticket

## Ticket

- ID: tickets_006
- PRD Key: prd_006
- Plan Candidate: Direct ticket-owner handoff from tickets/done/prd_006/prd_006.md
- Title: Ticket owner work for prd_006
- Stage: rejected
- Owner: owner-4
- Claimed By: owner-4
- Execution Owner: owner-4
- Verifier Owner: owner-4
- Last Updated: 2026-04-26T01:10:08Z

## Goal

- 이번 작업의 목표: Implement the approved spec for prd_006.

## References

- PRD: tickets/done/prd_006/prd_006.md
- Feature Spec:
- Plan Source: direct-ticket-owner

## Obsidian Links

- Project Note: [[prd_006]]
- Plan Note:
- Ticket Note: [[tickets_006]]

## Allowed Paths

- packages/cli/wiki-project.sh
- packages/cli/wiki-project.ps1
- packages/cli/cli-common.sh
- packages/cli/scaffold-project.sh
- packages/cli/scaffold-project.ps1
- bin/autoflow
- bin/autoflow.ps1
- runtime/board-scripts/finish-ticket-owner.sh
- .autoflow/scripts/finish-ticket-owner.sh
- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/rules/wiki/README.md
- scaffold/board/agents/wiki-maintainer-agent.md
- scaffold/board/rules/wiki/README.md
- scaffold/board/AGENTS.md
- scaffold/board/README.md
- AGENTS.md
- CLAUDE.md
- README.md
- tests/smoke

## Worktree
- Path: `/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006`
- Branch: autoflow/tickets_006
- Base Commit: aadf973ec6300c5a964baf012491b90dd88f0b68
- Worktree Commit:
- Integration Status: pending

## Done When

- [ ] finish-ticket-owner pass 후 wiki-maintainer runner 가 enabled 면 자동 1-shot 실행되고 출력에 `wiki_maintainer.status=ok` 등이 prefix 로 남는다.
- [ ] wiki-maintainer runner 가 없거나 disabled 일 때 finish-pass 출력은 `wiki_maintainer.status=skipped_no_runner` 로 비차단 기록되고 finish 는 그대로 done 으로 종료한다.
- [ ] `AUTOFLOW_WIKI_MAINTAINER_AUTO=off` 가 설정되면 트리거 자체를 건너뛴다.
- [ ] `autoflow wiki query --synth --term <text>` 가 grep 결과 + `synth_status` + (어댑터 있을 때) `synth_answer` / `synth_citation.N` 을 함께 출력한다.
- [ ] `autoflow wiki lint --semantic` 이 기본 lint 출력 + `semantic_status` + (어댑터 있을 때) `semantic_finding.N.*` 을 출력한다.
- [ ] 어댑터 부재 시 `--synth` / `--semantic` 모두 `*_status=skipped_no_adapter` 로 graceful skip, 기본 결과는 그대로 유지된다.
- [ ] `wiki-maintainer-agent.md` 의 Procedure 가 (1) 입력 식별 (2) entity/concept 페이지 생성/병합 (3) idempotent 보장 (4) 사람-편집 영역 보존 단계를 명시한다.
- [ ] `bin/autoflow help` 출력에 `wiki query --synth` 와 `wiki lint --semantic` 이 노출된다.
- [ ] `.autoflow/rules/wiki/README.md` 에 idempotent + 사람-영역 보존 규칙이 추가된다.
- [ ] `tests/smoke/ticket-owner-smoke.sh` 가 통과한다 (wiki-maintainer runner 없음 상태에서 finish-pass 정상 동작 검증 포함).
- [ ] 새 smoke 또는 정적 호출: `autoflow wiki query --term test --synth` 가 어댑터 없는 환경에서 exit 0 + `synth_status=skipped_no_adapter` 를 반환한다.
- [ ] `cd apps/desktop && npx tsc --noEmit` exit 0.
- [ ] `cd apps/desktop && node scripts/check-syntax.mjs` exit 0.
- [ ] `diff -q .autoflow/agents/wiki-maintainer-agent.md scaffold/board/agents/wiki-maintainer-agent.md` 출력 없음.
- [ ] `diff -q .autoflow/scripts/finish-ticket-owner.sh runtime/board-scripts/finish-ticket-owner.sh` 출력 없음.

## Next Action
- reject 처리됨: Reject Reason 을 기준으로 재작업 범위를 정한다.

## Resume Context

- 현재 상태 요약: spec 의 Allowed Paths 가 현재 checkout 구조와 맞지 않아 구현을 시작하지 못한 blocked 티켓.
- 직전 작업: `bin/autoflow wiki query . --term wiki --term maintainer --term synth` 로 prior context 를 확인했고, worktree 에서 `packages/cli`, `runtime/board-scripts`, `.autoflow/...`, `tests/smoke` 부재를 재현했다.
- 재개 시 먼저 볼 것: `tickets/done/prd_006/prd_006.md`, 현재 repo tree (`scripts/cli`, `autoflow/scripts`, `rules/wiki`, `scripts/tests`), Reject Reason.

## Notes

- Created by owner-4 from tickets/done/prd_006/prd_006.md at 2026-04-26T01:08:42Z.

- Ticket owner owner-4 prepared spec at 2026-04-26T01:08:42Z; worktree=/Users/demoon/Documents/project/.autoflow-worktrees/autoflow/tickets_006; run=tickets/inprogress/verify_006.md
- Mini-plan at 2026-04-26T01:22:00Z:
  1. Check prior context with `autoflow wiki query` using `wiki`, `maintainer`, `synth`.
  2. Compare spec `Allowed Paths` with the current worktree checkout before editing.
  3. If the checkout and spec mismatch outside Allowed Paths, reject with concrete replanning guidance instead of making unsafe path substitutions.
- Wiki query checkpoint: `tickets/done/prd_006/prd_006.md` was the top prior result and confirmed this ticket expects `packages/cli`, `runtime/board-scripts`, `.autoflow/...`, and `tests/smoke` paths.
- Path audit checkpoint: current worktree exposes `scripts/cli/wiki-project.sh`, `scripts/runtime/finish-ticket-owner.sh`, `autoflow/agents/wiki-maintainer-agent.md`, `rules/wiki/README.md`, and `scripts/tests/ticket-owner-smoke.sh` instead of the spec paths. Missing spec paths were confirmed directly for `packages/cli/wiki-project.sh`, `packages/cli/cli-common.sh`, `runtime/board-scripts/finish-ticket-owner.sh`, `.autoflow/agents/wiki-maintainer-agent.md`, `.autoflow/rules/wiki/README.md`, and `tests/smoke`.
- Decision: stop before implementation. Mapping these paths by assumption would violate the ticket's repo-relative `Allowed Paths` contract and could edit the wrong tree shape.
- Ticket owner verification failed at 2026-04-26T01:09:56Z: command exited 254
- Ticket owner owner-4 marked fail at 2026-04-26T01:10:08Z.
## Verification
- Run file: `tickets/reject/verify_006.md`
- Log file: `logs/verifier_006_20260426_011008Z_fail.md`
- Result: failed

## Result

- Summary: Blocked and prepared for reject because the spec's Allowed Paths do not exist in the claimed worktree checkout.
- Remaining risk: prd_006 needs replanning against the current repository layout or a corrected checkout before implementation can begin safely.

## Reject Reason

- Spec paths are stale for this checkout: Allowed Paths reference packages/cli, runtime/board-scripts, .autoflow/... and tests/smoke, but the claimed worktree only has scripts/cli, scripts/runtime, autoflow/... and scripts/tests. Verification also failed with ENOENT under apps/desktop/lib. Replan against the current repo layout or claim the correct checkout before retrying.
