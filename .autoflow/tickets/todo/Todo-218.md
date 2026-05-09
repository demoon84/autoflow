# Ticket

## Ticket

- ID: Todo-218
- PRD Key: prd_219
- Plan Candidate: Plan AI handoff from tickets/done/prd_219/prd_219.md
- Title: AI 스킬 탭 로딩/조회수 분리 재시도 (prd_208 retry 1)
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-09T06:17:16Z

## Goal

- 이번 작업의 목표: prd_208 의 작업(`run_list` usage sidecar 1회 dump + `view --no-bump` + 데스크톱 opt-out + 타입 선언) 을 다시 한 번 안전하게 통합한다. 직전 시도는 코드 변경과 `npm run desktop:check` exit 0 까지 끝냈으나 worker 가 PROJECT_ROOT 의 `packages/cli/skill-project.sh` 에 자기 자신의 패치 외에 무관 dirty 가 있다고 판단해 finalizer 를 호출하지 않고 blocked 로 끝났다. 본 retry 는 동일 변경 의도를 그대로 적용하고, PROJECT_ROOT 에 이미 동일 변경이 들어 있다면 추가 변경 없이 sanity gate 통과만 시도한다.

## References

- PRD: tickets/done/prd_219/prd_219.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_219]]
- Plan Note:
- Ticket Note: [[Todo-218]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `packages/cli/skill-project.sh`

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
- Time Used Seconds: 0
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event:
- Last Progress Fingerprint:
- Iteration Fingerprints: []
- Last Lint Status: ok
- Last Lint Vagueness Score: 0

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [ ] `packages/cli/skill-project.sh` 의 `run_list` 가 usage.json sidecar 를 단일 Python 인보케이션으로 1회만 파싱하고, run_list 본문 안의 매 스킬 반복 4회 `usage_get_field` 호출이 0회로 줄어든 상태다.
- [ ] `packages/cli/skill-project.sh` 의 `run_view` 가 trailing 인자 `--no-bump` 를 인식해 `usage_record_event ... view` 호출을 skip 한다. `bash packages/cli/skill-project.sh view <ref> --no-bump` 실행 후 `.autoflow/wiki/skills-local/.usage.json` 의 해당 key `view_count` 가 증가하지 않는다.
- [ ] `bash packages/cli/skill-project.sh view <ref>` (플래그 없이) 의 default 동작은 그대로 `view_count` 를 +1 한다.
- [ ] `apps/desktop/src/main.js` 의 `controlSkill` view 분기가 `options.bumpUsage === false` 일 때만 args 끝에 `--no-bump` 를 추가하고, 다른 분기(`list`, `archive`, `history`) 는 변경되지 않는다.
- [ ] `apps/desktop/src/renderer/main.tsx` 의 `viewSkill` 호출이 `controlSkill({action: "view", ..., bumpUsage: false })` 형태로 변경됐다.
- [ ] `apps/desktop/src/renderer/vite-env.d.ts` 의 `controlSkill` options 타입에 `bumpUsage?: boolean` 필드가 선언됐다.
- [ ] `npm run desktop:check` from `/Users/demoon2016/Documents/project/autoflow` exits 0.

## Next Action

- 다음에 바로 이어서 할 일: Plan AI 가 Allowed Paths 와 Done When 을 PRD 기준으로 더 좁힌다. Impl AI 는 이 티켓을 todo 에서 claim 한 뒤 mini-plan, 구현, 검증, 머지까지 한 턴에 끝낸다.

## Resume Context

- 현재 상태 요약: Plan AI 가 backlog PRD 에서 todo 티켓을 생성한 직후.
- 직전 작업: scripts/start-plan.sh 가 PRD 를 done 으로 보관하고 todo 티켓을 만들었다.
- 재개 시 먼저 볼 것: PRD, Goal, Allowed Paths, Done When.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_219/prd_219.md at 2026-05-09T06:17:16Z.

## Verification

- Command: `npm run desktop:check`
- Run file:
- Log file:
- Result: pending

## Result

- Summary:
- Remaining risk:
