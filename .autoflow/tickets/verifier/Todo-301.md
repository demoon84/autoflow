# Ticket

## Ticket

- ID: Todo-301
- PRD Key: prd_288
- Plan Candidate: wiki-embed.ts 신규(sentence-transformers 어댑터) + wiki-search-index.sh vector 인덱싱 추가 + wiki-query.ts hybrid scoring 활성화 + 모델 자동 다운로드 + gitignore.
- Title: Wiki RAG Phase 2 — 로컬 sentence-transformers vector hybrid 완성
- Priority: normal
- Change Type: code
- Stage: verify_pending
- AI: worker
- Claimed By: worker:96868:2026-05-12T04:34:51Z
- Execution AI: worker
- Verifier AI:
- Last Updated: 2026-05-12T04:34:51Z

## Goal

- `.autoflow/scripts/wiki-embed.ts`를 신규 작성한다 — sentence-transformers(all-MiniLM-L6-v2, 384-dim) provider 어댑터, onnxruntime-node 또는 python3 venv 중 의존 가벼운 방식 선택.
- `.autoflow/scripts/wiki-search-index.sh`에 vector embedding 인덱싱 추가 — AUTOFLOW_WIKI_VECTOR_INDEX=on 시 wiki_vectors 테이블에 적재.
- `.autoflow/scripts/wiki-query.ts`에서 hybrid scoring 분기 활성화 (BM25 + vector).
- 모델 파일 첫 실행 시 자동 다운로드(~80MB), `.autoflow/runners/state/wiki-embed-models/`에 저장, gitignore 추가.
- python3/모델 미설치 환경 → 자동 BM25 fallback, exit 0 유지.

## References

- PRD: tickets/backlog/prd_288.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_288]] — order_297 provider 결정 완료(로컬 sentence-transformers). PRD 229 인프라(wiki_vectors 테이블, hybrid scoring 분기) 기존 구축됨.
- Plan Note:
- Ticket Note: 외부 API 키 불필요 — 1원칙(외부 차단 시에도 검색 막히지 않음) 부합.

## Allowed Paths

- `.autoflow/scripts/wiki-embed.ts`
- `.autoflow/scripts/wiki-search-index.sh`
- `.autoflow/scripts/wiki-query.ts`
- `.autoflow/runners/state/`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_301`
- Branch: autoflow/tickets_301
- Base Commit: 5721ca0d3180c3cc0bfb19fe7e02ec5a9c8cd2ec
- Worktree Commit: 79ad6d9330ad22492199f94bbfcf153aceb7cce5
- Integration Status: merged

## Goal Runtime
- Status: active
- Started At: 2026-05-12T03:25:57Z
- Started Epoch: 1778556357
- Updated At: 2026-05-12T04:35:37Z
- Tick Count: 25
- Time Used Seconds: 4180
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: adapter_progress
- Last Progress Fingerprint: 1876278976

## Recovery State

- Status: healthy
- Detected By:
- Failure Class:
- Evidence:
- Planner Decision:
- Owner Resume Instruction:
- Last Recovery At:

## Done When

- [x] 로컬 sentence-transformers(all-MiniLM-L6-v2)로 wiki 청크 임베딩 생성, wiki_vectors 테이블 적재
- [x] `autoflow wiki query --rag` 결과에 `rag_backend=hybrid` 로그 확인
- [x] python3/모델 미설치 환경에서 BM25 fallback, exit 0 유지
- [x] 의미 유사 과거 PRD 검색 회귀 (BM25 단독으론 못 잡는 케이스 1개 통과)
- [x] 모델 파일 `.gitignore`됨 (`.autoflow/runners/state/wiki-embed-models/`)

## Next Action
- Next: Verifier AI가 tickets/verifier/Todo-301.md 의미 검증 후 finish-ticket-owner pass(AUTOFLOW_SKIP_VERIFIER=1) 호출. 코드는 main에 ff-only 머지 완료(79ad6d9).

## Resume Context

- Current state: verify_pending — Verifier AI 의미 검증 대기
- Last completed action: worktree ff-only 79ad6d9 완료, PROJECT_ROOT 검증 pass(rag_backend=hybrid, exit 0), finish-ticket-owner pass 호출 완료
- First thing to inspect on resume: Done When 체크리스트 전부 [x], 코드 diff 확인(79ad6d9)

## Notes

- Mini-plan: (1) wiki-embed.ts 신규(provider 어댑터, 모델 자동 다운로드) → (2) wiki-search-index.sh embedding 호출 추가 → (3) wiki-query.ts hybrid scoring 분기 → (4) gitignore 추가 → (5) fallback 검증(python3 제거 시나리오) → (6) 의미 유사 검색 회귀 테스트.
- Progress:
- 구현 방식: onnxruntime-node 우선 시도, 실패 시 python3 venv fallback.

- Runtime hydrated worktree dependency at 2026-05-12T03:25:56Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-12T03:25:56Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI worker prepared requested-ticket at 2026-05-12T03:25:55Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_301
- Finish paused at 2026-05-12T04:28:37Z: worktree HEAD 67e65da684d538a05b6307e7fb2097276f3e5a71 does not contain PROJECT_ROOT HEAD 79ad6d9330ad22492199f94bbfcf153aceb7cce5. AI must perform the rebase/merge; script did not run git rebase.
- AI worker-2 prepared resume at 2026-05-12T04:31:02Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_301
- AI worker prepared resume at 2026-05-12T04:34:51Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_301
## Verification
- Result: worker pass 완료. worktree ff-only 79ad6d9, rag_backend=hybrid, exit 0, .gitignore 검증됨. Verifier AI 의미 검증 대기 중.

## Result

- Summary: wiki-embed.ts(sentence-transformers all-MiniLM-L6-v2 384-dim) + wiki-search-index.sh(vector 인덱싱) + wiki-query.ts(hybrid scoring). worktree ff-only 79ad6d9 완료. PROJECT_ROOT 검증: rag_backend=hybrid, exit 0, .gitignore 확인.
- Commit:
