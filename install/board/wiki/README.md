# LLM Wiki

이 디렉터리는 Autoflow 위키 러너가 유지하는 로컬 markdown 지식 베이스다.

위키 원본은 이 디렉터리의 markdown 파일이며, qmd 같은 검색 인덱스는 언제든 재생성 가능한 파생 캐시로만 취급한다.

기본 구조:

- `index.md`: 위키 탐색용 목차. 위키 러너 또는 `autoflow wiki ingest`가 갱신한다.
- `log.md`: ingest, query, decision page 갱신 이력을 append-only로 남기는 타임라인.
- `concepts/`: 반복 재사용되는 개념과 패턴.
- `decisions/`: 왜 특정 결정을 했는지 남기는 decision note.
- `sources/`: raw source를 읽고 정리한 source summary.
- `questions/`: 질문에서 나온 답변과 분석 중 다시 쓸 가치가 있는 내용.

위키 페이지는 다음 작업의 Claude/Codex가 바로 읽을 수 있도록 짧고 근거 중심으로 작성한다.
