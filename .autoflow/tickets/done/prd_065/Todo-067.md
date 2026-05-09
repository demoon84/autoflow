# Ticket

## Ticket

- ID: Todo-067
- PRD Key: prd_065
- Plan Candidate: Plan AI handoff from tickets/done/prd_065/prd_065.md
- Title: Restore full-page loading overlay in desktop app
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-04-30T23:47:35Z

## Goal

- 이번 작업의 목표: 데스크톱 앱에서 초기 부트, 보드/프로젝트 전환, 페이지 갱신, 큰 로그 또는 위키 미리보기 읽기처럼 화면 전체가 기다리는 로딩 상태일 때 viewport 전체를 덮는 로딩 오버레이를 다시 표시한다. 과거 구현이 git history 또는 reflog 에 남아 있으면 우선 그 구조를 확인해 현재 MUI 정책에 맞게 복원하고, 찾지 못하면 기존 loading flag 를 재사용하는 가장 좁은 신규 구현으로 처리한다.

## References

- PRD: tickets/done/prd_065/prd_065.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Obsidian Links

- Project Note: [[prd_065]]
- Plan Note:
- Ticket Note: [[Todo-067]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/`

## Worktree
- Path: `/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-067`
- Branch: autoflow/Todo-067
- Base Commit: 4c2328357117af924d166fc529e615924b46c1b5
- Worktree Commit: 4fb294a
- Integration Status: no_code_changes

## Done When

- [x] 구현자는 `git log` 및 필요 시 reflog/old commit diff 를 확인해 이전 풀페이지 로딩 오버레이 구현 존재 여부를 ticket Notes 또는 Result 에 기록한다.
- [x] 앱 초기 부트 또는 보드 로딩 중 viewport 전체를 덮는 로딩 overlay 가 표시된다.
- [x] 프로젝트 루트 변경, 보드 새로고침, 설치/갱신처럼 `isBoardLoading`, `isPageRefreshing`, `isInstalling` 계열 상태가 켜진 동안 overlay 가 표시되고 종료 시 사라진다.
- [x] 큰 로그 또는 위키 미리보기 읽기처럼 `isReadingLog` 기반으로 전체 화면 대기가 필요한 흐름에서도 overlay 가 표시된다. 단, 작은 카드/버튼 내부 spinner 만 필요한 runner action 은 불필요하게 전체 화면을 막지 않는다.
- [x] overlay 는 클릭과 스크롤을 막고, 기존 MUI Dialog/detail layer overlay 와 class 충돌 또는 first-frame flicker 를 만들지 않는다.
- [x] 기존 버튼 아이콘 spinner, `LogPreview` 내부 loading 표시, Tickets detail layer loading 표시가 깨지지 않는다.
- [x] 보드 첫 로드(`isBoardLoading`이거나 `options.projectRoot`가 있는데 `board`가 아직 null`) 동안 `작업` 페이지의 `AI가 없습니다` runner empty state 와 `WorkflowStatStrip` 0 카운트 같은 빈-보드 표시가 사용자에게 노출되지 않는다 (overlay 가 가린다).
- [x] 구현은 `Allowed Paths` 안에만 머문다.
- [x] `apps/desktop` check command 가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: `autoflow/Todo-067`를 `PROJECT_ROOT`(`4c23283`) 기준으로 리베이스 완료했고, `showGlobalLoading` 상태 계산을 검증함.
- 직전 작업: `npm --prefix apps/desktop run check` 재실행 후 `exit 0` 통과.
- 재개 시 볼 것: `main.tsx`의 `showGlobalLoading` 계산, `styles.css`의 오버레이 스타일, `verify_067.md` 통과 항목.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_065/prd_065.md at 2026-04-30T04:07:06Z.

- Runtime hydrated worktree dependency at 2026-04-30T04:07:09Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-04-30T23:41:24Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-04-30T23:41:24Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-067; run=tickets/inprogress/verify_067.md
- AI worker prepared resume at 2026-04-30T23:42:36Z; worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-067; run=tickets/inprogress/verify_067.md
- Mini-plan:
  - 1) 기존 로딩 state(`isBoardLoading`, `isPageRefreshing`, `isInstalling`, `isReadingLog`)에서 단일 `showGlobalLoading`를 계산.
  - 2) `showGlobalLoading` 기반으로 `FullPageLoading` 로컬 래퍼 오버레이를 렌더링.
  - 3) `styles.css`에 오버레이 z-index/블러/텍스트 클래스 정의 추가.
  - 4) `verify-ticket-owner.sh` 기준 check 명령 실행하여 통과 기록 후 done로 이동.
- 구현 근거/검증:
  - `git log -- apps/desktop/src/renderer/main.tsx`에서 `overlay` 복원 힌트 커밋은 없었고, 기존 구현 히스토리를 바로 재사용하지 못해 신규 최소 구현으로 진행했음.
  - `autoflow wiki query`에서 `[[tickets/done/prd_065/prd_065.md]]` 및 관련 wiki 답변 문서를 조회해, 과거 오버레이 정책과 보드 동작 제약을 확인함. 

- No staged code changes found in worktree during merge preparation at 2026-04-30T23:47:35Z.
- Impl AI worker marked verification pass at 2026-04-30T23:47:35Z; runtime finalizer will not perform merge operations.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-04-30T23:47:35Z.
- Coordinator post-merge cleanup at 2026-04-30T23:47:35Z: removed_worktree=/Users/demoon2016/Documents/project/.autoflow-worktrees/autoflow/Todo-067 deleted_branch=autoflow/Todo-067.
## Verification
- Run file: `tickets/done/prd_065/verify_067.md`
- Log file: `logs/verifier_067_20260430_234738Z_pass.md`
- Result: passed

## Result

- Summary: 전역 로딩 오버레이 복원 완료
- Remaining risk: 추가 상태 플래그가 없는 부분에서는 기존 로딩 동작에 영향 없음.
