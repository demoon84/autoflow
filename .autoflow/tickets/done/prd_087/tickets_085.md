# Ticket

## Ticket

- ID: tickets_085
- PRD Key: prd_087
- Plan Candidate: Plan AI handoff from tickets/done/prd_087/prd_087.md
- Title: 위키 문서 뷰어 모드
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI: worker
- Last Updated: 2026-05-01T21:26:31Z

## Goal

- 이번 작업의 목표: 데스크톱 Wiki 문서 상세/미리보기 영역이 raw console/pre 형식이나 편집형 표시가 아니라, 사용자가 읽기 쉬운 읽기 전용 Markdown viewer mode로 표시되게 한다.

## References

- PRD: tickets/done/prd_087/prd_087.md
- Feature Spec:
- Plan Source: plan-ai-direct

## Reference Notes

- Project Note: [[prd_087]]
- Plan Note:
- Ticket Note: [[tickets_085]]

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`
- `apps/desktop/src/components/ui/markdown-viewer.tsx`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_085`
- Branch: autoflow/tickets_085
- Base Commit: f7e85f14602a669fea5f93733ab66f8fcde29b4b
- Worktree Commit: 4a99f7df5aa858f04c89595fe64eb69c9543e2e9
- Integration Status: integrated

## Goal Runtime
- Status: complete
- Started At: 2026-05-01T21:25:10Z
- Started Epoch: 1777670710
- Updated At: 2026-05-01T21:26:33Z
- Tick Count: 3
- Time Used Seconds: 83
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 2492267281

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] Wiki 섹션에서 Wiki 문서, handoff 문서, wiki query 결과 문서를 선택하면 본문이 `MarkdownViewer` 기반 viewer mode로 표시된다.
- [x] Wiki preview body는 raw console/pre 박스가 아니라 heading, list, code block, table 등 Markdown 구조가 렌더링된 읽기 전용 문서 뷰로 보인다.
- [x] Wiki 문서 preview에는 `textarea`, `contentEditable`, 편집 toolbar, 편집 가능한 입력 커서가 노출되지 않는다.
- [x] 기존 Wiki preview 흐름은 유지된다: Wiki 진입 시 닫힘, 항목 선택 시 열림, 닫기 버튼, "미리보기 열기" 토글이 계속 동작한다.
- [x] 일반 로그/터미널/runner output preview를 raw 형식으로 보여야 하는 화면은 이 변경 때문에 Markdown viewer로 강제 전환되지 않는다.
- [x] Markdown viewer가 긴 code block, table, link를 포함한 문서에서도 preview pane 폭을 넘겨 레이아웃을 깨지 않고 스크롤 가능하게 표시한다.
- [x] 구현은 Allowed Paths 안에만 머문다.
- [x] `cd apps/desktop && npx tsc --noEmit && node scripts/check-syntax.mjs` 가 통과한다.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: Plan AI 가 `tickets/inbox/memo_054.md` 를 `tickets/done/prd_087/prd_087.md` 로 승격하고 todo 티켓을 생성했다.
- 직전 작업: `scripts/start-plan.sh` 가 PRD 를 done 으로 보관하고 `tickets/todo/tickets_085.md` 를 만들었다. Wiki context pass 는 `markdown-viewer.tsx` 이력(`tickets/done/prd_009/prd_009.md`, `tickets/done/prd_039/prd_039.md`)과 기존 Wiki preview flow(`.autoflow/wiki/features/wiki-preview-flow.md`)를 확인했다.
- 재개 시 먼저 볼 것: `apps/desktop/src/renderer/main.tsx` 의 knowledge section `LogPreview` 호출부와 하단 `LogPreview` 구현, `apps/desktop/src/components/ui/markdown-viewer.tsx`, `.markdown-viewer`/`.knowledge-preview-pane` CSS.

## Notes

- Created by planner (Plan AI) from tickets/done/prd_087/prd_087.md at 2026-05-01T00:14:25Z.
- Planner wiki context: `tickets/done/prd_009/prd_009.md` 와 `tickets/done/prd_039/prd_039.md` 는 `markdown-viewer.tsx` 가 기존 markdown preview 보조 처리에 쓰인 이력을 보여준다.
- Planner wiki context: `.autoflow/wiki/features/wiki-preview-flow.md` 의 hidden-by-default, select-to-open, close/reopen toggle 흐름은 유지해야 한다.
- Planner constraint: `tickets/reject/reject_003.md` 는 Wiki preview toggle 재시도가 runtime cleanup/smoke 계약 블로커로 max retry에 도달했음을 보여준다. 이 티켓은 그 reject를 재시도하지 않고 Wiki 문서 viewer mode만 다룬다.
- Mini-plan: `LogPreview`는 wiki 패널에서만 Markdown 모드로 분기하고, 로그/런너/티켓 등 기존 raw 미리보기 화면은 유지한다. 이를 위해 `selectedLogPath` 기반으로 `위키/대화 문서` 경로를 판별해 `MarkdownViewer` 사용 여부를 결정하고, Markdown 렌더러가 wiki 패널 내부에서만 스크롤/폭 오버플로우가 안전하도록 클래스 제약을 보강한다. 참고: `[[tickets/done/prd_087/prd_087.md]]`, `[[tickets/done/prd_057/tickets_059.md]]`, `.autoflow/wiki/features/wiki-preview-flow.md`.
- Planner wiki context 반영: 기존 `LogPreview`는 wiki와 로그에서 공통 사용되어 있어서, 이번 변경은 해당 컴포넌트에 `viewerMode` 분기를 넣어 공통 UX(닫힘/열림 토글, close 버튼, selection open 흐름)는 유지한다. 이전 위키 플로우 계약: `.autoflow/wiki/features/wiki-preview-flow.md`의 hidden-by-default + 선택 열림 규칙.
- 위키 패널은 `LogPreview`의 `mode` 분기를 통해 Markdown 렌더링을 적용하고, 로그 패널은 기본 `text` 모드(raw `<pre>`)를 유지하여 기존 로그/터미널 흐름을 방해하지 않음.
- 위키 대상 판별은 `isMarkdownViewerTargetPath`가 `/wiki/`, `/conversations/` 패턴과 `board.wikiFiles`, `board.conversationFiles` 경로 매칭으로 제한.

- Runtime hydrated worktree dependency at 2026-05-01T21:25:09Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- AI worker prepared todo at 2026-05-01T21:25:08Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_085; run=tickets/inprogress/verify_085.md
- AI worker prepared resume at 2026-05-01T21:25:19Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_085; run=tickets/inprogress/verify_085.md
- Prepared worktree commit 4a99f7df5aa858f04c89595fe64eb69c9543e2e9 at 2026-05-01T21:26:30Z; Impl AI integrates it into PROJECT_ROOT and the inline finalizer creates the local completion commit.
- Impl AI worker marked verification pass at 2026-05-01T21:26:30Z; runtime finalizer will not perform merge operations.
- Merge finalizer verified at 2026-05-01T21:26:31Z: AI already integrated worktree commit 4a99f7df5aa858f04c89595fe64eb69c9543e2e9 into PROJECT_ROOT; script performed no rebase or cherry-pick.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-01T21:26:31Z.
- Coordinator post-merge cleanup at 2026-05-01T21:26:31Z: removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_085 deleted_branch=autoflow/tickets_085.
## Verification
- Run file: `tickets/done/prd_087/verify_085.md`
- Log file: `logs/verifier_085_20260501_212632Z_pass.md`
- Result: passed

## Result

- Summary: Wiki 미리보기에서 위키/전달문서만 MarkdownViewer 분기
- Remaining risk: 없음.
