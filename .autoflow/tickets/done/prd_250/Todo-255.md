# Ticket

## Ticket

- ID: Todo-255
- PRD Key: prd_250
- Plan Candidate: Plan AI handoff from tickets/backlog/prd_250.md
- Title: LivePtyView 좌우 여백 비대칭 보정
- Priority: normal
- Change Type: code
- Stage: done
- AI: 019e1175-cc66-7b32-91dd-d9f289894d09
- Claimed By: 019e1175-cc66-7b32-91dd-d9f289894d09
- Execution AI: 019e1175-cc66-7b32-91dd-d9f289894d09
- Verifier AI:
- Last Updated: 2026-05-10T10:39:53Z

## Goal

- 데스크톱 LivePtyView 의 PTY 출력에서 오른쪽 끝에서 단어가 어색하게 잘려 줄바꿈되는 현상을 제거하고, 좌우 여백을 시각적으로 균등하게 맞춘다. xterm FitAddon 의 cols 계산이 스크롤바 너비를 무시하는 것이 주원인으로 추정되며, CSS padding/box-sizing 비대칭도 함께 정리한다.

## References

- PRD: tickets/backlog/prd_250.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_250]]
- Plan Note:
- Ticket Note: [[Todo-255]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255`
- Branch: autoflow/tickets_255
- Base Commit: 6c7df4df975ebeca2dd5d4d1cef0dfdb57ebf110
- Worktree Commit: 
- Integration Status: already_in_project_root

## Goal Runtime
- Status: complete
- Started At: 2026-05-10T10:36:56Z
- Started Epoch: 1778409416
- Updated At: 2026-05-10T10:39:54Z
- Tick Count: 2
- Time Used Seconds: 178
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 1242221109

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] LivePtyView 의 텍스트 라인이 단어 경계에서 자연스럽게 wrap 되거나 끝까지 차서 오른쪽 끝에 닿음 (단어 중간 잘림 없음).
- [x] 좌측 여백과 우측 여백이 시각적으로 동일 (스크롤바 4px 차이는 허용).
- [x] PTY cols 가 xterm 이 실제 렌더하는 가시 칸 수와 일치 (xterm 의 `cols` 와 PTY 의 cols 가 같음).

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 inbox order_221 을 prd_250 로 승격하고 todo 티켓을 생성한 직후.
- 직전 작업: planner 가 `tickets/inbox/order_221.md` 를 `tickets/done/prd_250/` 로 옮기고 generated PRD 와 Todo-255 를 만들었다.
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_250/prd_250.md`, Goal, Allowed Paths, Done When. `main.tsx` 의 `fitAndResize` 보정/동기화 로직과 `styles.css`의 `.xterm`/`.xterm-screen` padding 정리 상태.

## Notes

- Created by planner (Plan AI) from tickets/backlog/prd_250.md at 2026-05-10T09:32:05Z.
- 원 order: `tickets/done/prd_250/order_221.md` (이전 위치 `tickets/inbox/order_221.md`).
- 가능한 원인: (1) xterm scrollbar(4px)가 FitAddon cols 계산에서 제외되지 않음, (2) container CSS padding/box-sizing 좌우 비대칭.
- `.xterm` 또는 `.xterm-screen` 의 `padding-right` 를 0으로 명시하고 host element 의 right padding 만 사용하는 방식 우선 검토.
- mini-plan (worker):
  1) `LivePtyView`에 `fit()` 직후 PTY resize IPC(`runnerPtyResize`)를 연결해 xterm cols/rows와 PTY cols/rows를 동기화.
  2) `fit()` 시점에 host 우측 4px를 임시 확보해 scrollbar 폭을 감안한 cols 계산을 유도.
  3) CSS에서 `.xterm`/`.xterm-screen` 좌우 padding을 명시적으로 0으로 고정해 여백 비대칭을 제거.
  4) PRD 검증 커맨드(`rg -n "FitAddon|xterm-screen|xterm-viewport|live-terminal-view\\b" ...`)로 변경 증거를 기록.
- wiki 참고: `./bin/autoflow wiki query --term "LivePtyView xterm FitAddon cols" --rag` 결과에서 `tickets/done/prd_247/*`, `tickets/done/prd_225/*` 를 확인했고, 기존 xterm 테마/레이아웃 패턴과 충돌 없이 LivePtyView 범위만 수정하기로 결정.

- Runtime hydrated worktree dependency at 2026-05-10T10:36:55Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T10:36:55Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI 019e1175-cc66-7b32-91dd-d9f289894d09 prepared todo at 2026-05-10T10:36:54Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255
- Queued without worktree commit at 2026-05-10T10:39:52Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI 019e1175-cc66-7b32-91dd-d9f289894d09 marked verification pass at 2026-05-10T10:39:52Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-10T10:39:53Z: worktree_dirty_already_in_project_root=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_255 deleted_branch=autoflow/tickets_255.
- Inline merge finalizer (worker 019e1175-cc66-7b32-91dd-d9f289894d09) finalized this verified ticket at 2026-05-10T10:39:53Z.
## Verification
- Result: passed by 019e1175-cc66-7b32-91dd-d9f289894d09 at 2026-05-10T10:39:52Z
- Log file: pending AI merge finalization

## Result

- Summary: LivePtyView fit 보정 및 xterm padding 대칭화
- Remaining risk: `runnerPtyResize` IPC가 현재 런타임에 미노출인 경우 PTY cols 동기화는 no-op이며, 이때는 fit 보정으로 wrapping 완화를 우선 달성한다.
