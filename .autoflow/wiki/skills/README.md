# Learned Skills

이 디렉터리는 완료된 Autoflow ticket에서 추출한 재사용 가능한 실행 패턴을 저장한다.

- 파일명: `skill_NNN.md`
- 생성 경로: `autoflow skill create <project-root> <board-dir-name> --from-ticket <ticket>`
- 조회 경로: `autoflow skill match <project-root> <board-dir-name> --keywords "<text>"`
- 통계 갱신: `autoflow skill update-stats <project-root> <board-dir-name> <skill_NNN> --result pass|fail`

운영 규칙:

- 여기의 skill은 managed wiki baseline(`wiki/index.md`, `wiki/log.md`, `wiki/project-overview.md`)과 별도인 learned-skill artifact다.
- 완료 후 auto-extract는 best-effort다. skill 생성 실패가 ticket pass/finalization을 실패로 바꾸면 안 된다.
- `enabled: true` 인 skill만 후속 prompt/RAG 주입 후보로 간주한다.
