# 위키 규칙

Wiki는 파생 지식 layer다.

규칙:

1. Managed section 밖의 사용자 작성 content는 보존한다.
2. Ticket, verification, log source를 인용한다.
3. 결정과 재사용 가능한 lesson을 요약한다.
4. Ticket 전체를 wiki page에 복사하지 않는다.
5. Wiki content만으로 pass/revise/replan을 결정하지 않는다.
6. Agent가 빠르게 scan할 수 있을 만큼 page를 짧게 유지한다.
7. Automatic ingest는 idempotent해야 한다. 같은 input으로 다시 실행하면 content 중복이 아니라 수렴이 일어나야 한다.
8. `AUTOFLOW:BEGIN ... / AUTOFLOW:END ...` marker 밖의 human-authored region은 automation 입장에서 read-only다.
