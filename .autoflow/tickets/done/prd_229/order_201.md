# Autoflow Order

## Order

- Title: wiki RAG phase 2 — vector embedding + hybrid re-rank
- Priority: normal
- Status: ready

## Request

wiki RAG phase 1 (sqlite FTS5 + BM25) 은 prd_223 으로 이미 통합됨. phase 2 로 vector embedding + hybrid re-rank 를 도입해 키워드 매칭이 부족한 의미론적 쿼리(예: 개념 검색, 유사 사례 탐색)에서도 관련 결과를 반환하도록 개선한다.

## Notes

- phase 1 백엔드: sqlite FTS5 + bm25() ranking (`.autoflow/runners/state/wiki-search.db`)
- phase 2 목표: 각 chunk 에 대한 embedding 벡터 생성 → sqlite-vec 또는 별도 파일 기반 ANN 인덱스 → BM25 점수 + cosine similarity 를 결합한 hybrid re-rank
- embedding 모델: local (e.g. nomic-embed-text via ollama, 또는 openai text-embedding-3-small) — 의존성 최소화 방향으로 결정
- AUTOFLOW_WIKI_FTS_INDEX=on opt-in 정책 유지
- 인덱스 파일 없거나 embedding 모델 미설치 시 기존 BM25 fallback 유지 (1원칙)
- 출처: order_222_retry_1 (prd_223 phase 1 duplicate 정리 후 phase 2 신규 발의)
