# Ticket

## Ticket

- ID: Todo-193
- PRD Key: prd_194
- Plan Candidate: Plan AI handoff from tickets/done/prd_194/prd_194.md
- Title: 오른쪽 러너/AI 카드 모델 변경 설정 항상 표시
- Priority: normal
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-08T05:23:16Z

## Goal

- 이번 작업의 목표: 데스크톱 오른쪽 러너/AI 카드에서 모델 변경 설정 접기/펼치기 토글을 제거하고, 모델/추론 설정 영역을 항상 보이게 한다.

## References

- PRD: tickets/done/prd_194/prd_194.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_194]]
- Plan Note:
- Ticket Note: [[Todo-193]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-193`
- Branch: autoflow/Todo-193
- Base Commit: db5aa143d1b0032dc08b7e441b62936fc6857920
- Worktree Commit:
- Integration Status: integrated_manual_cleanup_after_finalizer_cleanup_failure

## Goal Runtime
- Status: complete
- Started At: 2026-05-08T05:17:44Z
- Started Epoch: 1778217464
- Updated At: 2026-05-08T05:23:16Z
- Tick Count: 3
- Time Used Seconds: 332
- Token Budget:
- Tokens Used:
- Continuation Suppressed: false
- Last Event: done
- Last Progress Fingerprint: 1797986191

## Recovery State

- Status: healthy
- Detected By: worker
- Failure Class:
- Evidence: `finish-ticket-owner.sh 193 pass` completed implementation and verification but routed to retry after `post_merge_cleanup_failed`; worker manually removed the leftover worktree/branch and restored the done ledger because PROJECT_ROOT already contained the verified staged result.
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At: 2026-05-08T05:23:16Z

## Done When

- [x] 오른쪽 러너/AI 카드에서 모델 변경 설정 영역을 접거나 펼치는 사용자 노출 toggle button/control 이 렌더링되지 않는다.
- [x] 모델 selector, 추론 effort selector, 일반 저장 버튼, dirty indicator 가 카드에서 항상 보이는 설정 영역으로 렌더링된다.
- [x] 모델/추론 변경 후 기존 일반 저장 흐름과 `config_applying`/적용 대기 UI 는 유지된다.
- [x] 시작/중지/강제 종료 같은 runner lifecycle control 은 기존처럼 렌더링되고 동일 handler 를 호출한다.
- [x] 제거된 toggle 전용 style/class 가 남아 있으면 불필요한 빈 공간, 접힘 상태 잔재, 어색한 gap 을 만들지 않게 정리된다.
- [x] Backend IPC, runner restart/start/stop/kill command, config apply fingerprint logic 은 이 PRD에서 변경하지 않는다.
- [x] `npm run desktop:check` exits 0.

## Next Action
- 완료됨. Wiki AI 가 필요 시 done ticket 과 product diff 를 반영한다.

## Resume Context

- 현재 상태 요약: 오른쪽 runner/AI 카드의 설정 toggle state/control 을 제거했고 `RunnerConfigControls` 는 `canConfigure` 일 때 항상 렌더링된다.
- 직전 작업: `Settings2`, `configOpen`, `setConfigOpen`, `aria-expanded={configOpen}` 잔여 참조가 없음을 확인했다. worktree와 PROJECT_ROOT의 Allowed Paths 파일 내용은 동일했다.
- 재개 시 먼저 볼 것: 없음. `npm run desktop:check` 는 worktree와 PROJECT_ROOT 양쪽에서 exit 0 이었다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_194/prd_194.md at 2026-05-06T00:13:05Z.
- Planner wiki pass: `bin/autoflow wiki query --term "모델 변경 토글 오른쪽 러너 AI 카드 model change settings apps/desktop src/renderer main.tsx styles.css" --rag` returned `result_count=0`.
- Relevant prior ticket: `tickets/done/prd_021/Todo-021.md` introduced shared runner model/reasoning/save controls in workflow cards. Preserve ordinary model/reasoning/save behavior while removing only the collapse/expand toggle affordance.
- Relevant prior ticket: `tickets/done/prd_174/prd_174.md` established config apply waiting feedback around runner config saves. Preserve `config_applying`/applied fingerprint behavior and do not treat IPC save as completion.
- Relevant prior ticket: `tickets/done/prd_193/prd_193.md` is adjacent runner settings UI cleanup. Follow the same narrow pattern: remove only the visible affordance requested, not underlying runner lifecycle or config plumbing.
- Mini-plan 2026-05-08T05:19:41Z:
  1. `AiProgressRow` 의 오른쪽 runner/AI 카드에서 `configOpen` 상태, Settings 토글 버튼, toggle 전용 `aria-expanded` 노출을 제거한다.
  2. 기존 `RunnerConfigControls` 컴포넌트와 `onConfigure` / `onDraftChange` / `config_applying` 흐름은 그대로 사용해 모델, 추론, 저장, dirty indicator 를 항상 렌더링한다.
  3. 시작/중지/강제 종료 lifecycle 버튼은 동일 handler 호출을 유지한다.
  4. wiki RAG 결과는 `tickets/done/prd_194/prd_194.md` 의 동일 수락 기준만 반환했다. 기존 Notes 의 `prd_021`, `prd_174`, `prd_193` 제약을 보존 기준으로 삼는다.
- Implementation evidence 2026-05-08T05:22:47Z:
  - Removed the right AI progress card settings toggle state/control from `AiProgressRow`: no remaining `Settings2`, `configOpen`, `setConfigOpen`, or `aria-expanded={configOpen}` references in `apps/desktop/src/renderer/main.tsx`.
  - `RunnerConfigControls` remains the single settings renderer and is now mounted whenever `canConfigure` is true, preserving model selector, reasoning selector, save button, dirty dot, and `config_applying` / `config_applying_restart` labels.
  - Runner lifecycle buttons still call `onControl?.("start" | "stop", runner.id, options)` directly; no backend IPC, start/stop/kill/restart command, or config fingerprint logic was changed.
  - PROJECT_ROOT had pre-existing same-file changes in `apps/desktop/src/renderer/main.tsx` and `styles.css`; the AI integration preserved them, applied this ticket's toggle removal on top, and synced the ticket worktree Allowed Paths to match PROJECT_ROOT exactly.
- Finalizer recovery 2026-05-08T05:23:16Z: `finish-ticket-owner.sh 193 pass` routed to retry with `failure_class=post_merge_cleanup_failed` after implementation/verification had passed. Worker manually removed the stale worktree/branch, removed the retry order, and completed the done ledger without changing product code further.

## Verification
- Result: passed by worker at 2026-05-08T05:23:13Z
- 2026-05-08T05:22:47Z worktree command: `npm run desktop:check` in `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-193` exited 0 (`node scripts/check-syntax.mjs && tsc --noEmit && vite build`; Vite build completed).
- 2026-05-08T05:22:47Z PROJECT_ROOT command: `npm run desktop:check` in `/Users/demoon2016/Documents/project/autoflow` exited 0 (`node scripts/check-syntax.mjs && tsc --noEmit && vite build`; Vite build completed).
- 2026-05-08T05:22:47Z content check: `cmp` confirmed worktree and PROJECT_ROOT match for `apps/desktop/src/renderer/main.tsx` and `apps/desktop/src/renderer/styles.css`.

## Result

- Summary: 오른쪽 러너 AI 카드 설정 상시 표시
- Remaining risk: 낮음. 같은 파일에 선행 미커밋 UI 정리 변경이 있어 최종 통합본에 함께 보존되었고, 양쪽 루트에서 desktop check 를 통과했다.
