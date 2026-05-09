# Autoflow Order

## Order

- ID: order_195
- Title: 위키 검색 sqlite FTS5+BM25 도입 (vector 는 옵셔널 phase)
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T07:03:53Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 위키 RAG 의미 기반 검색 도입 (chunk grep → vector embedding)
- Priority: normal
- Status: ready


위키를 rag화 하는게 좋을거 같은데. 현재 `autoflow wiki query --rag` 는 chunk grep 수준이라 "skill removal" 같은 query 가 result_count=0. 의미 기반 검색으로 전환.

## Notes

### 현재 상태
- `packages/cli/wiki-project.sh` 의 `--rag` mode 는 chunk (32 line, overlap 6 line) 단위로 grep + scoring. 진짜 RAG (vector embedding + cosine similarity) 가 아님.
- 결과: order/autoflow skill 의 "Lookup Before Saving" 흐름에서 wiki query 가 거의 항상 0 hit. origin search 만 실효성 있음.

### 도입 방향 — 빈번한 호출 (order/autoflow skill 매번 호출) 이라 latency 가 가장 중요. **sqlite FTS5 + BM25 가 1순위**.

- **(권장) FTS5 + BM25**: sqlite 내장. 의존 0, 모델 다운로드 0, cold start 0. query latency < 5ms (수만 chunk 기준). 키워드 / 코드 / 식별자 검색에 충분히 강력. tokenizer 는 unicode61 (한국어/영어 모두 OK) + 추가 ngram tokenizer 옵션. 2026 현재 sqlite3 빌드 대부분 FTS5 포함.
- **(옵셔널 phase) Vector embedding 추가**: BM25 가 못 잡는 의미 매칭 (예: "skill removal" ↔ "스킬 시스템 제거") 이 자주 필요하면 차후 phase 로 hybrid (BM25 top-N → vector re-rank) 로 추가. cold start 감수 가능 — query 당 vector 호출은 캐싱.
  - Local sentence-transformers (`all-MiniLM-L6-v2`, 90MB) 첫 실행 ~500-2000ms cold start, 그 후 ~30-80ms/query.
  - 단독 vector RAG 는 latency 부담 + 모델 의존 — **첫 phase 로는 적절하지 않음**.
- (제외) Anthropic / OpenAI embedding API — 외부 의존 + offline 불가능 + rate limit + 비용 — autoflow portable 기조와 안 맞음.
- (제외) 어댑터 차용 (Claude/Codex/Gemini 의 embedding 호출) — 어댑터 사이 호환성 + rate limit.

### 가장 빠른 구현 = FTS5 only (Phase 1)
- 의존: sqlite3 (이미 state.db 로 검증됨). 신규 의존 0.
- query latency: < 5ms (수천 chunk 기준), 모델 cold start 없음.
- 자주 쓰는 흐름 (skill 의 Lookup Before Saving 매번) 에 latency 부담 없음.

### Phase 분할 (planner 가 적용)

- **Phase 1 — FTS5 인덱서 + query 전환** (1차 본 작업):
  - `.autoflow/state-schema/v1.sql` 또는 별도 `wiki_search.db` 에 FTS5 virtual table:
    ```sql
    CREATE VIRTUAL TABLE wiki_search USING fts5(
      path, chunk_idx, title, body,
      tokenize="unicode61 remove_diacritics 2"
    );
    ```
  - `.autoflow/scripts/wiki-search-index.sh` 신규: 위키 + ticket done/ 본문을 chunk (1024 char) 로 자르고 INSERT. 동일 path+chunk_idx 의 hash 가 같으면 skip (idempotent).
  - `wiki-project.sh` 의 `--rag` mode 가 FTS5 MATCH + bm25() ranking 으로 top-k 반환. 기존 chunk grep 은 fallback (DB 없으면).
  - `AUTOFLOW_WIKI_FTS_INDEX=on` 으로 opt-in. 기본 off 라 기존 흐름 영향 없음.
- **Phase 2 — Wiki AI 인크리멘탈 인덱싱**:
  - Wiki AI runner 가 매 tick 끝에 새 wiki / 새 ticket done 변화 감지 → 해당 파일만 re-index.
  - `autoflow wiki search-rebuild` CLI 로 사용자가 강제 전체 재구축 가능.
- **Phase 3 (옵셔널) — Vector hybrid**:
  - BM25 가 자주 miss 하는 의미 매칭이 사용자에게 불편하면 그때 도입.
  - sentence-transformers `all-MiniLM-L6-v2` 모델 + sqlite-vss 또는 별도 numpy 캐시.
  - BM25 top-20 → vector re-rank → top-3 반환 (hybrid). cold start 는 인덱싱 단계에만, query 는 BM25 우선이라 < 10ms 유지.
  - 본 order 범위 밖 — 별도 후속 order.

### 후보 의존
- 신규 의존 0. sqlite3 (FTS5 포함) 이미 state.db 로 사용 중.
- 인덱스 캐시 위치: `.autoflow/runners/state/wiki-search.db` (gitignored).

### 회귀 가드
- 인덱스 미존재 / 모델 다운로드 실패 / Python 미설치 → keyword grep fallback (1원칙: rag 도입이 wiki query 흐름을 막지 않음).
- 사용자가 `AUTOFLOW_WIKI_RAG_INDEX=off` 로 두면 인덱서는 안 돌고 기존 동작 그대로.
- 모델 / 인덱스 파일은 gitignored. master commit 영향 없음.

### prd_215 (order/autoflow skill 의 RAG injection 제거) 와의 관계
- 별도 결정 필요: prd_215 는 SKILL 시스템 제거 phase 4 의 일부로 wiki RAG 호출을 skill 에서 빼기로 했음.
- 본 order 가 RAG 를 진짜로 동작하게 만든다면 prd_215 의 결정을 reverse 할 가치 있음 (제거하지 말고 유지). 두 작업은 동시 진행 시 충돌.
- planner 가 처리 순서 결정 시 본 order 가 phase 1~3 만 도입하고 skill 의 RAG hook 결정은 사용자에게 별도 확인.

## Allowed Paths

- `.autoflow/scripts/`
- `packages/cli/wiki-project.sh`
- `runtime/board-scripts/`
- `.autoflow/state-schema/`
- `scaffold/board/state-schema/`
- `packages/cli/package-board-common.sh`
- `.autoflow/runners/state/` (gitignored, 모델/인덱스 캐시)
- `.gitignore`
- `AGENTS.md`

## Done When (rough — planner 가 phase 별로 구체화)

- [ ] `autoflow wiki query --rag --term "<query>"` 가 FTS5 BM25 기반 hit 를 반환 — 키워드 / 식별자 / 코드 단어 매칭으로 result_count > 0 (현재 chunk grep 으로는 0 hit 인 case 도 잡힘).
- [ ] query latency < 10ms (수천 chunk 기준, time 명령으로 측정).
- [ ] FTS5 인덱서가 idempotent — 같은 chunk hash 재처리 skip.
- [ ] `wiki-search.db` gitignored, master commit 영향 0.
- [ ] sqlite FTS5 미지원 환경 (구버전 sqlite3) 또는 인덱스 미존재 시 기존 chunk grep fallback.
- [ ] AGENTS.md rule 18 에 wiki 검색 인덱스 섹션 추가.
- [ ] `bash -n packages/cli/wiki-project.sh .autoflow/scripts/wiki-search-index.sh` 통과.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow && bin/autoflow wiki query --rag --term "skill removal" --limit 3 . .autoflow && time bin/autoflow wiki query --rag --term "AiConversationPanel" --limit 3 . .autoflow`
- 보조 시나리오: "ticket-owner reject", "express order", "starvation guard" 같은 query 들이 BM25 ranking 으로 관련 wiki/ticket chunk 반환.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
