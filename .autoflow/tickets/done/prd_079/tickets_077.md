# Ticket

## Ticket

- ID: tickets_077
- PRD Key: prd_079
- Plan Candidate: Plan AI handoff from tickets/done/prd_079/prd_079.md
- Title: 최근 프로젝트 목록에서 사라진 경로 처리 개선
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-04-30T23:22:05Z

## Goal

- 이번 작업의 목표: 데스크톱 앱의 프로젝트 선택 메뉴와 초기 프로젝트 로딩에서 이미 삭제되거나 이동된 최근 프로젝트 경로를 안전하게 처리해, 사용자가 오래된 경로를 선택해도 빈 화면에 머물지 않게 한다.

## References

- PRD: tickets/done/prd_079/prd_079.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_079]]
- Plan Note:
- Ticket Note: [[tickets_077]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `apps/desktop/src/preload.js`
- `apps/desktop/src/renderer/vite-env.d.ts`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_077`
- Branch: autoflow/tickets_077
- Base Commit: 6bb4f4b0f86cf89b20383f1d70a8311a6d13c21c
- Worktree Commit:
- Integration Status: already_in_project_root

## Done When

- [ ] When a path in `autoflow.recentProjects` no longer exists on disk, opening the project menu or project-required overlay no longer presents it as a normal clickable valid project.
- [ ] If a stale recent project path is selected before validation completes, the app removes or disables that path, shows an error/toast or equivalent user-visible guidance, and returns to a usable project selection or board-missing state instead of a blank screen.
- [ ] `persistRecentProjects` writes back a cleaned list that excludes confirmed missing paths while preserving valid paths and deduplication.
- [ ] A valid recent project path can still be selected and loads its board or install guidance as before.
- [ ] A valid existing project without `.autoflow` still shows the setup/install-required UI, not the stale-path error state.
- [ ] Both recent-project render sites in `apps/desktop/src/renderer/main.tsx` are handled consistently: the footer/sidebar project menu and the project-required overlay list.
- [ ] If main/preload IPC is changed, `apps/desktop/src/renderer/vite-env.d.ts` matches the exposed API and no TypeScript errors are introduced.
- [ ] Implementation stays inside Allowed Paths and does not mix in `memo_046` or `memo_047` work.
- [ ] Desktop check command passes.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_045.md` 를 `tickets/done/prd_079/prd_079.md` 생성 PRD 로 승격하고 이 todo 티켓을 만들었다.
- 직전 작업: wiki context pass 를 최근 프로젝트, `readRecentProjects`, `chooseProjectRoot`, `autoflow.recentProjects`, renderer/main 경로, 빈 화면 키워드로 실행했다. 직접 같은 결함을 고친 선행 완료 티켓은 없었고, 최근 데스크톱 UI 작업들은 이 요청을 scope 밖으로 남겼다.
- 재개 시 먼저 볼 것: `tickets/done/prd_079/prd_079.md`, `apps/desktop/src/renderer/main.tsx` 의 recent-project persistence/selection/rendering, `apps/desktop/src/main.js` 의 `pathExists` 와 `readBoard`.
- 최근 결정: `autoflow wiki query --term \"최근 프로젝트\" --term \"readRecentProjects\" --term \"chooseProjectRoot\" --term \"autoflow.recentProjects\" --term \"빈 화면\"`는 `tickets/done/prd_079/prd_079.md`와 `tickets/done/prd_045.md` 맥락을 확인했으며, 동일 결함 해결 완료 티켓은 없었고 `design-kit-mui-migration`은 현재 AGENTS Rule 17에 의해 예외 적용이 필요 없음을 확인했다.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_079/prd_079.md at 2026-04-30T22:54:24Z.
- Wiki context: `bin/autoflow wiki query ... --term "최근 프로젝트" --term "readRecentProjects" --term "chooseProjectRoot" --term "autoflow.recentProjects" --term "apps/desktop/src/renderer/main.tsx" --term "apps/desktop/src/main.js" --term "빈 화면"` returned mostly prior desktop renderer work such as `tickets/done/prd_002/tickets_002.md` and `tickets/done/prd_041/tickets_041.md`; no done ticket was found that already handles stale recent project paths. [[tickets/done/prd_002/tickets_002.md]] [[tickets/done/prd_041/tickets_041.md]]
- Ticket context: `tickets/done/prd_076/prd_076.md`, `tickets/done/prd_077/prd_077.md`, and `tickets/done/prd_078/prd_078.md` each excluded recent-project handling, so keep this implementation focused on stale recent path validation and fallback only. [[tickets/done/prd_076/tickets_076.md]] [[tickets/done/prd_078/tickets_078.md]]
- Mini-plan:
  - `apps/desktop/src/renderer/main.tsx`의 최근 프로젝트 목록 로딩/선택 흐름에서 stale 경로 차단을 먼저 강화한다. [[tickets/done/prd_079/prd_079.md]]
  - `refreshRecentProjects`/`sanitizeRecentProjects` 유사 경로에 경로 검증 중 상태를 추가해 메뉴/오버레이에서 비정상 경로를 즉시 클릭 불가로 처리한다.
  - 선택 시 경로 존재 여부 실패 경로는 `persistRecentProjects`에서 즉시 제거하고 사용자 안내(toast) 경로를 통해 피드백한다.
  - `npm run desktop:check`로 회귀 확인 후, `tickets/inprogress/verify_077.md`에 증거를 기록하고 `finish-ticket-owner`로 통합 완료한다.
- Planning constraint: current root `AGENTS.md` Rule 17 overrides the older `wiki/decisions/design-kit-mui-migration.md`; do not add new MUI/Emotion patterns while touching the desktop UI.

- Runtime hydrated worktree dependency at 2026-04-30T22:55:24Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-04-30T22:55:24Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_077; run=tickets/inprogress/verify_077.md
- AI worker prepared resume at 2026-04-30T23:20:08Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_077; run=tickets/inprogress/verify_077.md
- Queued without worktree commit at 2026-04-30T23:22:05Z: PROJECT_ROOT already matches the ticket worktree for all Allowed Paths with code changes.
- Impl AI worker marked verification pass at 2026-04-30T23:22:05Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-04-30T23:22:05Z.
- Coordinator post-merge cleanup at 2026-04-30T23:22:05Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/tickets_077 deleted_branch=autoflow/tickets_077.
## Verification
- Run file: `tickets/done/prd_079/verify_077.md`
- Log file: `logs/verifier_077_20260430_232206Z_pass.md`
- Result: passed

## Result

- Summary: Stale recent-project 경로 검증 강화 및 메뉴/오버레이 비정상 경로 비활성화 적용, desktop:check 통과
- Remaining risk: 검증 시작 직후 잠깐 stale 항목이 표시되는 레이스가 있을 수 있어 초기 표시 플리커 완화는 추가 최적화 여지.
