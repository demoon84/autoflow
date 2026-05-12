# Autoflow Order

## Order

- Title: Wiki RAG Phase 2 — 로컬 sentence-transformers 임베딩으로 vector hybrid 완성
- Priority: normal
- Status: ready
- Change Type: code

## Request

PRD 229 에서 wiki_vectors 테이블 + hybrid scoring 분기 인프라는 이미 있음.
embedding provider 를 로컬 sentence-transformers 로 붙여서 BM25 + vector hybrid
완성. 외부 API 키/네트워크 의존 없이 동작 → Autoflow 1원칙 (외부 차단 시에도
검색 막히지 않음) 부합.

해야 할 것:
1. .autoflow/scripts/wiki-embed.ts 신규 — provider 어댑터 (sentence-transformers
   기본, OpenAI/Voyage 는 후속 옵션). python3 venv 또는 onnxruntime-node
   중 하나로 구현 (의존 가벼운 쪽 선택).
2. 모델: all-MiniLM-L6-v2 (80MB, 384-dim) — 작고 빠름
3. wiki-search-index.sh 가 vector embedding 도 함께 인덱싱
4. AUTOFLOW_WIKI_VECTOR_INDEX=on 활성화 시 hybrid scoring 동작
5. fallback: 모델 미설치/python 미존재 시 자동으로 FTS5 BM25 만 사용 (exit 0)
6. 첫 실행 시 모델 자동 다운로드 (~80MB, gitignored)

## Allowed Paths

- .autoflow/scripts/wiki-embed.ts
- .autoflow/scripts/wiki-search-index.sh
- .autoflow/scripts/wiki-query.ts
- .autoflow/runners/state/

## Done When

- [ ] 로컬 sentence-transformers (all-MiniLM-L6-v2) 로 wiki 청크 임베딩 생성, wiki_vectors 테이블 적재
- [ ] autoflow wiki query --rag 가 hybrid scoring 사용 (rag_backend=hybrid 로그 확인)
- [ ] 모델/파이썬 미설치 환경에서 자동 BM25 fallback (exit 0 유지)
- [ ] 의미적으로 비슷한 과거 PRD 검색 회귀 (BM25 만으론 못 잡는 케이스 1개 통과)
- [ ] 모델 파일 .gitignore 됨 (.autoflow/runners/state/wiki-embed-models/)

## Verification

- Command: autoflow wiki query --rag "<keyword>" 결과의 rag_backend 필드 확인 + BM25-only 와 비교

## Notes

- provider 어댑터 구조 유지 — OpenAI/Voyage 는 후속 order 로 옵션 추가 가능
- 자율주행 학습 효과 — 같은 실수 반복 차단의 기반 (retry_fingerprint 와 시너지)
