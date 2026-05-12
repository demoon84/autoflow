# Ticket

## Ticket

- ID: Todo-325
- PRD Key: prd_303
- Plan Candidate: LivePtyView/xterm onData 입력 → preload bridge → main IPC → runner-pty-manager stdin writer → 타입/CSS 보강 → desktop check 및 수동 PTY 입력 확인.
- Title: 데스크톱 러너 터미널 입력 지원
- Priority: normal
- Change Type: code
- Stage: todo
- AI:
- Claimed By:
- Execution AI:
- Verifier AI:
- Last Updated: 2026-05-12T10:44:22Z

## Goal

desktop runner LivePtyView/xterm 터미널에서 사용자가 포커스 후 키 입력, 붙여넣기, Enter를 입력하면 해당 runner PTY stdin으로 전달되게 한다.

## References

- PRD: tickets/done/prd_303/prd_303.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_303]]
- Plan Note:
- Ticket Note: `preload.js`에는 runner PTY bridge가 read-only라는 주석이 있고, 이번 티켓은 그 정책을 scoped stdin write API로 바꾼다.

## Allowed Paths

- `apps/desktop/src/main/runner-pty-manager.js`
- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/vite-env.d.ts`
- `apps/desktop/src/renderer/styles.css`

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

- [ ] `LivePtyView` registers xterm input (`onData` or equivalent) and sends typed bytes to the active `runnerId`.
- [ ] `preload.js` exposes a narrow runner PTY input API and `apps/desktop/src/renderer/vite-env.d.ts` declares it.
- [ ] `apps/desktop/src/main.js` handles the new IPC channel and forwards input to `PtyRunnerManager`.
- [ ] `apps/desktop/src/main/runner-pty-manager.js` provides a user-input writer that safely refuses missing/non-running runner IDs and preserves existing `writePrompt` / `writeSlashCommand` automation.
- [ ] Paste and Enter input are delivered to the PTY stdin without duplicating output or corrupting snapshot replay.
- [ ] Terminal focus/input affordance is present without large layout changes.
- [ ] `npm run desktop:check` passes.
- [ ] Manual acceptance probe records whether desktop runner LivePtyView terminal focus + key input + paste + Enter reach the PTY.

## Next Action

worker가 이 티켓을 claim한 뒤 `LivePtyView` mount/input lifecycle과 `PtyRunnerManager` write queue를 먼저 읽는다. 그 다음 renderer→preload→main→manager의 좁은 stdin path를 추가하고 `npm run desktop:check` 및 가능한 수동 PTY 입력 probe를 기록한다.

## Resume Context

- Current state: planner가 order_322를 generated PRD/todo로 승격했다.
- Last completed action: repository scan으로 read-only bridge 주석과 missing stdin IPC path를 확인했다.
- First thing to inspect on resume: `apps/desktop/src/preload.js` runner PTY bridge 주석, `apps/desktop/src/main.js` `autoflow:runnerPty*` IPC handler block, `LivePtyView` xterm mount section.

## Notes

- Mini-plan: ① existing PTY APIs/read-only 주석 확인 ② manager raw input writer 추가 ③ main/preload/types bridge 추가 ④ LivePtyView xterm input forwarding 연결 ⑤ focus affordance/CSS 최소 보강 ⑥ `npm run desktop:check`와 manual probe 기록.
- Progress: generated from order_322.
- Planner wiki pass: RAG query returned `result_count=0`; order hints and repository scan are sufficient.
- Repository scan: `git grep` found the PTY path in `apps/desktop/src/main.js`, `apps/desktop/src/main/runner-pty-manager.js`, `apps/desktop/src/preload.js`, and `apps/desktop/src/renderer/main.tsx`.

## Verification

- Command: `npm run desktop:check`
- Manual Probe: desktop 앱에서 runner LivePtyView 터미널 포커스 후 키 입력, 붙여넣기, Enter가 해당 PTY stdin으로 전달되는지 확인.
- Run file:
- Result:

## Result

- Summary:
- Commit:

## Path Notes

- `References` are relative to `BOARD_ROOT`.
- `Allowed Paths` are relative to the implementation worktree root. If no worktree exists, they fall back to `PROJECT_ROOT`.
- `Plan Candidate` must copy the exact candidate text from `Execution Candidates`. It is a duplicate-detection key.

