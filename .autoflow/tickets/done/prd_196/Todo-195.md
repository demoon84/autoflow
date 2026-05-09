# Ticket

## Ticket

- ID: Todo-195
- PRD Key: prd_196
- Plan Candidate: Plan AI handoff from tickets/done/prd_196/prd_196.md
- Title: desktop wiki runner config full width
- Priority: normal
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-08T05:56:37Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 LLM 위키 영역에서 위키 runner 카드 위쪽에 보이는 셀렉트 3개와 저장 버튼 컨트롤 row가 카드 폭 전체를 채우도록 레이아웃을 정리한다.

## References

- PRD: tickets/done/prd_196/prd_196.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_196]]
- Plan Note:
- Ticket Note: [[Todo-195]]

## Allowed Paths

- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/renderer/main.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-195`
- Branch: autoflow/Todo-195
- Base Commit: 4aa7434c8758bb98a4abe6aa844d222f3bb99cfe
- Worktree Commit:
- Integration Status: integrated_manual_cleanup_after_finalizer_cleanup_failure

## Goal Runtime
- Status: complete
- Started At: 2026-05-08T05:52:26Z
- Started Epoch: 1778219546
- Updated At: 2026-05-08T05:56:37Z
- Tick Count: 3
- Time Used Seconds: 251
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event: done
- Last Progress Fingerprint: 2717565655

## Recovery State

- Status: healthy
- Detected By: worker
- Failure Class:
- Evidence: `finish-ticket-owner.sh Todo-195 pass` completed implementation and verification but routed to retry after `post_merge_cleanup_failed`; worker manually removed the retry order and completed the done ledger because PROJECT_ROOT already contained the verified staged result.
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At: 2026-05-08T05:56:37Z

## Done When

- [x] `apps/desktop/src/renderer/styles.css`에서 progress runner 카드의 `ai-progress-config` 또는 해당 `runner-config` row가 `width: 100%` 기준으로 부모 카드 폭 전체를 채운다.
- [x] 위키 runner 카드에서 셀렉트 3개와 저장 버튼이 한 row 안에서 같은 카드 폭 기준으로 정렬되고, 왼쪽 일부 폭만 차지하지 않는다.
- [x] 셀렉트와 저장 버튼은 긴 모델명/상태 텍스트에서도 부모 grid track 안에서 줄바꿈/overflow 없이 축소 가능하게 유지된다.
- [x] 같은 row의 회색 카드 3개 영역과 설정 컨트롤 row의 외곽 폭이 시각적으로 동일한 부모 폭에 맞춰진다.
- [x] `RunnerConfigControls`의 저장 버튼 disabled, dirty dot, `config_applying`/`config_applying_restart` 표시, 모델/추론 변경 handler는 기존 동작을 유지한다.
- [x] 위키 검색 패널(`WikiQueryPanel`), 위키 목록/미리보기 split pane, runner start/stop/force-stop 제어 UI는 동작 변경 없이 유지된다.
- [x] `npm run desktop:check` exits 0.

## Next Action
- 완료됨. Wiki AI 가 필요 시 done ticket 과 product diff 를 반영한다.

## Resume Context

- 현재 상태 요약: worktree와 PROJECT_ROOT 모두 `apps/desktop/src/renderer/styles.css`의 runner config row CSS가 반영됐고 `npm run desktop:check`가 양쪽에서 통과했다.
- 직전 작업: `.ai-progress-config`에 full-width/min-width/stretch 보강, `.ai-progress-config-with-agent`를 실제 4개 컨트롤 기준 grid로 수정, `.runner-save-button span` overflow ellipsis를 추가했다.
- 재개 시 먼저 볼 것: 없음. `npm run desktop:check` 는 worktree와 PROJECT_ROOT 양쪽에서 exit 0 이었다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_196/prd_196.md at 2026-05-08T05:48:51Z.
- Planner wiki pass: `bin/autoflow wiki query --term "desktop wiki select save button card width" --rag` returned `result_count=0`; no prior direct constraint was found for this exact width issue.
- Planner code finding: `apps/desktop/src/renderer/main.tsx` renders planner/worker/wiki runner progress cards with `RunnerConfigControls` and `className="ai-progress-config runner-config ai-progress-config-with-agent"`.
- Planner scope decision: keep the implementation centered on `apps/desktop/src/renderer/styles.css`; use `main.tsx` only if a class application adjustment is needed. Do not change runner config save IPC, model/reasoning option policy, or wiki list/preview layout.
- Worker wiki pass: `bin/autoflow wiki query --term "desktop wiki runner config controls full width ai-progress-config runner-config" --rag` returned `result_count=0`; no additional prior constraint found.
- Mini-plan:
  - Keep `RunnerConfigControls` behavior in `main.tsx` unchanged.
  - Update only `styles.css` so `.ai-progress-config` is an explicit full-width grid with stretch/min-width safeguards.
  - Replace the 5-track `.ai-progress-config-with-agent` desktop grid with the actual 4 controls: agent, model, reasoning, save.
  - Preserve responsive breakpoints and verify with `npm run desktop:check`.
- Implementation evidence 2026-05-08T05:56:37Z:
  - `.ai-progress-config` keeps `width: 100%` and now also sets `box-sizing: border-box`, `justify-items: stretch`, and `min-width: 0`.
  - `.ai-progress-config-with-agent` now uses four grid tracks, matching the actual agent/model/reasoning/save controls and removing the unused fifth track that left controls visually confined to the left.
  - `.ai-progress-config > *` and `.runner-save-button span` now allow shrink/ellipsis behavior for long model or applying labels inside their grid tracks.
  - `RunnerConfigControls`, `WikiQueryPanel`, wiki split pane, and runner lifecycle control handlers were not modified.
- Finalizer recovery 2026-05-08T05:56:37Z: `finish-ticket-owner.sh Todo-195 pass` routed to retry with `failure_class=post_merge_cleanup_failed` after implementation/verification had passed. Worker removed the retry order and completed the done ledger without changing product code further.

## Verification
- Result: passed by worker at 2026-05-08T05:55:31Z
- 2026-05-08T05:55:31Z worktree command: `npm run desktop:check` in `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-195` exited 0 (`node scripts/check-syntax.mjs && tsc --noEmit && vite build`; Vite build completed).
- 2026-05-08T05:55:31Z PROJECT_ROOT command: `npm run desktop:check` in `/Users/demoon2016/Documents/project/autoflow` exited 0 (`node scripts/check-syntax.mjs && tsc --noEmit && vite build`; Vite build completed).
- 2026-05-08T05:56:37Z content check: worktree and PROJECT_ROOT product diff match for `apps/desktop/src/renderer/styles.css`; `apps/desktop/src/renderer/main.tsx` was not changed by this ticket.

## Result

- Summary: 데스크톱 progress runner config row가 부모 카드 폭 전체를 쓰도록 CSS grid track과 overflow 처리를 정리했다.
- Remaining risk: 낮음. 브라우저/데스크톱 렌더 스냅샷은 별도로 열지 않았고, 정적 CSS 검토와 양쪽 `desktop:check`로 검증했다.
