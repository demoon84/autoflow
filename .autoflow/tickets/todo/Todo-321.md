# Ticket

## Ticket

- ID: Todo-321
- PRD Key: prd_299
- Plan Candidate: packages/cli 대형 shell entrypoint별 위험도/계약 inventory 작성 → 낮은 위험도 entrypoint부터 TS/Node primary slice 이관 → bin/autoflow dispatch 경계와 runtime mirror 보존 → runners list/doctor/runner idle smoke 검증.
- Title: sh to ts 전환 5단계 CLI 대형 shell 이관
- Priority: normal
- Change Type: infra
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T07:55:00Z

## Goal

`packages/cli`의 대형 shell entrypoint를 TypeScript/Node 중심으로 단계 이관한다. run-role/runners-project는 runner loop, adapter timeout, realtime wake, budget preflight, token telemetry, process cleanup 등 위험 계약이 많으므로 마지막 단계에서 진행한다.

## References

- PRD: tickets/done/prd_299/prd_299.md

## Reference Notes

- Project Note: CLI usage/output 계약과 runtime mirror 관계를 유지하며 낮은 위험도 entrypoint부터 진행한다.
- Ticket Note: macOS bash 3.2 호환 회피용 패치가 사라져도 동일 동작이 유지되는지 검증한다.

## Allowed Paths

- `bin/autoflow`
- `packages/cli`
- `runtime/board-scripts/run-role.sh`
- `runtime/board-scripts/runners-project.sh`
- `runtime/board-scripts/wiki-project.sh`
- `tests/smoke`
- `package.json`
- `package-lock.json`

## Worktree

- Branch:
- Path:
- Base:
- Created At:

## Goal Runtime

- Status:
- Started At:
- Started Epoch:
- Updated At:
- Tick Count: 0
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status:
- Last Lint Vagueness Score:

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] packages/cli 대형 shell entrypoint별 위험도와 output 계약이 inventory로 정리된다.
- [ ] 낮은 위험도 entrypoint부터 TS/Node primary slice가 이관된다.
- [ ] `run-role.sh`와 `runners-project.sh` 고위험 계약은 마지막 단계로 남기거나 충분한 smoke 보호 뒤에만 수정된다.
- [ ] `bin/autoflow` dispatch 경계와 runtime mirror 관계가 유지된다.
- [ ] macOS bash 3.2 호환 회피용 동작이 JS/TS 경로에서도 유지된다.
- [ ] `find packages/cli runtime/board-scripts -type f -name '*.sh' -exec bash -n {} \; && ./bin/autoflow runners list . .autoflow && ./bin/autoflow doctor . .autoflow && bash tests/smoke/runner-idle-preflight-skip-smoke.sh`가 통과한다.

## Next Action

`packages/cli` shell entrypoint별 역할, output contract, runtime mirror 유무, 위험도를 inventory로 작성하고 가장 낮은 위험도 slice부터 TS/Node primary path를 만든다.

## Resume Context

- Current state: ticket 생성됨, worker 클레임 대기 중.
- Last completed action: order_320을 prd_299/Todo-321로 승격했다.
- First thing to inspect on resume: `packages/cli` entrypoint 목록과 `bin/autoflow` dispatch mapping.

## Notes

- Mini-plan: ① CLI entrypoint inventory ② 낮은 위험도 slice 선정 ③ TS/Node primary path 구현 ④ runtime mirror 유지 ⑤ runners list/doctor/idle smoke 검증.

## Verification

- Command: `find packages/cli runtime/board-scripts -type f -name '*.sh' -exec bash -n {} \; && ./bin/autoflow runners list . .autoflow && ./bin/autoflow doctor . .autoflow && bash tests/smoke/runner-idle-preflight-skip-smoke.sh`
- Run file:
- Result:

## Result

- Summary:
- Commit:
