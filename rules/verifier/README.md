# Verifier

`rules/verifier/` 는 `BOARD_ROOT` 안의 검증 기준 폴더다.

역할:

- 어떤 조건을 통과해야 `done` 으로 갈 수 있는지 정의
- 검증 체크리스트를 표준화
- 검증 템플릿을 한 곳에 모아 둠
- 에이전트가 같은 기준으로 pass/fail 을 판단하게 함

구분:

- `rules/verifier/checklist-template.md`: 검증 기준과 체크리스트
- `rules/verifier/verification-template.md`: 검증 기록 초안 템플릿
- `tickets/runs/`: 실제 검증 실행 결과와 로그

즉 `rules/verifier/` 는 규칙이고 `tickets/runs/` 는 증거다.

권장 훅:

- `start verifier`

주의:

- 실제 검증 명령은 보통 `PROJECT_ROOT` 에서 실행한다.
- 검증 기록 파일은 `BOARD_ROOT/tickets/runs/` 에 남긴다.
