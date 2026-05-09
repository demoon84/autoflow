# Ticket

## Ticket

- ID: Todo-226
- PRD Key: prd_223
- Plan Candidate: Plan AI retry from tickets/done/prd_223/prd_223.md (retry_count=1, fingerprint=8f04955091c5)
- Title: wiki RAG sqlite FTS5 + BM25 phase 1 도입 (retry 1)
- Priority: normal
- Change Type: code
- Stage: done
- AI: worker
- Claimed By: worker
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-09T10:17:28Z

## Goal

- 이번 작업의 목표: `autoflow wiki query --rag` 가 sqlite FTS5 의 MATCH + bm25() ranking 으로 동작하도록 phase 1 만 좁게 도입한다. 직전 시도(Todo-222, 워크트리 commit `fbc29d4`, branch `autoflow/tickets_222`)는 verification 까지 통과로 표기됐지만 worktree base 가 `08454a8` 였고 PROJECT_ROOT 가 `bd5a3aa` (manual_order_196 xterm 도입 등)까지 진행해 finalizer 가 `post_merge_cleanup_failed` 로 막혔으며, merge 시점에 worktree 에 staged code 변경이 남아 있지 않았다. 본 retry 는 fresh worktree (base = 현 main HEAD `bd5a3aa`) 에서 동일 변경 의도를 다시 적용하고 `git diff <base>..HEAD` 가 **실제로 0 line 이상이 되도록** 코드 변경을 worktree 안에서 반드시 커밋한 뒤 finalizer pass 를 호출한다. `manual_order_196` 계열 변경(xterm.js LiveTerminalView, 라이브 stdout tail 등)과는 Allowed Paths 가 분리돼 있어 충돌 없음.

## References

- PRD: tickets/done/prd_223/prd_223.md
- Feature Spec:
- Plan Source: plan-ai-retry

## Reference Notes

- Project Note: [[prd_223]]
- Plan Note:
- Ticket Note: [[Todo-226]]

## Allowed Paths

- `.autoflow/scripts/wiki-search-index.sh`
- `packages/cli/wiki-project.sh`
- `.gitignore`
- `AGENTS.md`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_226`
- Branch: autoflow/tickets_226
- Base Commit: 3ed4bd121c64c32de74ebfb35982a142f6bdc38b
- Worktree Commit: da0e4388c1101f2a4e56f457f6b0eba33e743306
- Integration Status: integrated

## Goal Runtime
- Status: complete
- Started At: 2026-05-09T09:57:38Z
- Started Epoch: 1778320658
- Updated At: 2026-05-09T10:17:30Z
- Tick Count: 11
- Time Used Seconds: 1192
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: complete
- Last Progress Fingerprint: 297324654

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] `.autoflow/scripts/wiki-search-index.sh` 가 wiki + `tickets/done/` 본문을 chunk 1024 char (overlap 128) 단위로 자르고 FTS5 virtual table 에 idempotent 하게 INSERT 한다 (재실행 시 두 번째 실행이 indexed_files=0 또는 skipped_files 다수 로 빠르게 끝남).
- [x] `AUTOFLOW_WIKI_FTS_INDEX=on bash .autoflow/scripts/wiki-search-index.sh` 가 status=ok 로 종료, 인덱스 파일 `.autoflow/runners/state/wiki-search.db` 생성.
- [x] `bin/autoflow wiki query --rag --term "skill removal" --limit 3 . .autoflow` 가 인덱스 사용 시 `result_count >= 1` 반환하고 `rag_backend=fts5_bm25` (또는 동등) 로 표기된다. "ticket-owner reject", "express order" 중 최소 한 query 도 0 → ≥1 이동.
- [x] 인덱스 파일 삭제 후 같은 명령이 chunk grep fallback 으로 동작하고 stderr 에 `wiki-fts5: index unavailable, falling back to chunk grep` (또는 동등) 한 줄 경고만 남김 (CLI exit 0).
- [x] sqlite3 / FTS5 / python3 미존재 시 인덱서가 status=skipped + reason 출력 후 graceful 종료 (exit 0). guard 분기 코드로 검증.
- [x] `.gitignore` 가 `.autoflow/runners/state/wiki-search.db` 를 무시 (상위 `.autoflow/runners/state/` 가 이미 무시 중이면 명시 라인 추가 또는 노옵 확인).
- [x] `AGENTS.md` rule 18 본문에 RAG FTS5 phase 1 한 문단 추가 (인덱스 위치, opt-in env, fallback 정책 명시).
- [x] `bash -n .autoflow/scripts/wiki-search-index.sh` 와 `bash -n packages/cli/wiki-project.sh` 통과.
- [x] worktree 안에서 `git diff <Worktree.Base Commit>..HEAD` 가 0 이 아닌 실제 코드/문서 변경을 포함한 채로 finalizer pass 를 호출 (직전 시도의 zero-diff 회귀 방지).
- [x] Implementation stays inside Allowed Paths.

## Next Action
- Complete: the inline merge finalizer integrated the AI-merged ticket, archived evidence, and prepared the local completion commit.

## Resume Context

- 현재 상태 요약: prd_223 retry 1. 직전 시도(Todo-222) 는 worktree commit `fbc29d4` (branch `autoflow/tickets_222`, base `08454a8`) 까지 만들고 verification pass 표기까지 갔지만, PROJECT_ROOT 가 `bd5a3aa` 까지 이동하면서 inline merge 가 `post_merge_cleanup_failed` 로 차단됐고 merge 직전 worktree 에 staged code 변경이 없었다.
- 직전 작업: planner 가 inbox/order_222_retry_1_20260509T075628Z.md 를 promote 해 todo 재발행. 이전 worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_222` 와 branch `autoflow/tickets_222` 는 stale leftover (planner 는 worktree 정리 권한 없음 — 다음 worker tick 또는 사용자가 정리).
- 재개 시 먼저 볼 것: PRD `tickets/done/prd_223/prd_223.md`, 그리고 직전 worktree commit `fbc29d4` 의 변경분 (cherry-pick 후보 또는 처음부터 재작성). `manual_order_196` 계열 commit 들은 `apps/desktop/src/renderer/*` 와 LiveTerminalView 패키지를 건드렸으므로 본 ticket 의 Allowed Paths (`.autoflow/scripts/wiki-search-index.sh`, `packages/cli/wiki-project.sh`, `.gitignore`, `AGENTS.md`) 와는 분리.

## Notes

- Created by planner (Plan AI) from inbox retry order order_222_retry_1_20260509T075628Z.md at 2026-05-09T08:05:00Z.
- 이전 실패 클래스: rejected (post_merge_cleanup_failed). retry fingerprint 8f04955091c5, retry_count 1/3.
- Stale leftover: branch `autoflow/tickets_222` (commit fbc29d4) + worktree `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_222` 는 본 retry 와 무관. Impl AI 는 새 worktree `tickets_226` 를 사용하고, 기존 stale 흔적 제거는 다음 worker/owner tick 또는 사용자에게 위임.
- Wiki 컨텍스트: prd_200 (post_merge_cleanup 가시화) 와 manual_order_196 시리즈 (xterm LiveTerminalView, byte/s tail 등)이 같은 시기 main 을 진행시킴. Allowed Paths 가 wiki 인덱서 + CLI + .gitignore + AGENTS.md 로 좁아 manual_order_196 와 path 충돌 없음.
- 직전 시도의 핵심 회귀 원인: shell sanity gate 통과 시점에 worktree 에 staged code 가 사라져 있었음. retry 에서는 `git status -sb` 와 `git diff <base>..HEAD --stat` 으로 commit 누락 여부를 pass 직전에 확인한다.

- Runtime hydrated worktree dependency at 2026-05-09T09:57:37Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-09T09:57:37Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared todo at 2026-05-09T09:57:37Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_226
- Finish paused at 2026-05-09T10:10:13Z: worktree HEAD 3500109ff4ba01096945f6a2eaa7869e182cb7a9 does not contain PROJECT_ROOT HEAD 674cbf36a44b46770e89ac479ba24b876c945ef8. AI must perform the rebase/merge; script did not run git rebase.
- Finish paused at 2026-05-09T10:11:36Z: worktree HEAD 693daff968e294a9a2bccc4f1ef3259a226ddd1b does not contain PROJECT_ROOT HEAD 7208c4dd4c384c86d65e35f0c3cc4deee43d8422. AI must perform the rebase/merge; script did not run git rebase.
- No staged code changes found in worktree during merge preparation at 2026-05-09T10:11:54Z.
- Impl AI worker marked verification pass at 2026-05-09T10:11:54Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T10:11:54Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-09T10:12:09Z.
- Impl AI worker marked verification pass at 2026-05-09T10:12:08Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T10:12:08Z: post_merge_cleanup_failed
- Finish paused at 2026-05-09T10:12:16Z: worktree HEAD 20e41f7a7036676ca2f146c6f5cc2dfbee82e3ae does not contain PROJECT_ROOT HEAD 84f5b0ef37adc3f8830622502b638625bb30d900. AI must perform the rebase/merge; script did not run git rebase.
- No staged code changes found in worktree during merge preparation at 2026-05-09T10:12:28Z.
- Impl AI worker marked verification pass at 2026-05-09T10:12:27Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T10:12:27Z: post_merge_cleanup_failed
- No staged code changes found in worktree during merge preparation at 2026-05-09T10:15:19Z.
- Impl AI worker marked verification pass at 2026-05-09T10:15:18Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T10:15:18Z: post_merge_cleanup_failed
- Impl AI worker marked verification pass at 2026-05-09T10:16:01Z; runtime finalizer will not perform merge operations.
- Inline merge blocked at 2026-05-09T10:16:01Z: post_merge_cleanup_failed
- Finish paused at 2026-05-09T10:16:36Z: worktree HEAD 7fa25ad674d409e90a86b0714cf7dad9331f007f does not contain PROJECT_ROOT HEAD da0e4388c1101f2a4e56f457f6b0eba33e743306. AI must perform the rebase/merge; script did not run git rebase.
- Impl AI worker marked verification pass at 2026-05-09T10:17:28Z; runtime finalizer will not perform merge operations.
- Coordinator post-merge cleanup at 2026-05-09T10:17:28Z: worktree_processes_stopped=0 removed_worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_226 deleted_branch=autoflow/tickets_226.
- Inline merge finalizer (worker worker) finalized this verified ticket at 2026-05-09T10:17:28Z.
## Verification
- Result: passed by worker at 2026-05-09T10:17:28Z
- Log file: pending AI merge finalization

## Result

- Summary: prd_223 retry 1: cherry-pick fbc29d4 + integrated to main as 6e45b9d; FTS5+BM25 wiki RAG phase 1 verified
- Remaining risk: 없음. phase 2/3 (vector embedding, hybrid re-rank) 는 후속 PRD 범위.
