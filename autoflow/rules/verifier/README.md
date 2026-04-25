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
- `tickets/inprogress/verify_*.md`: verifier 가 작업 중일 때 쓰는 임시 검증 실행 결과
- `logs/`: verifier 완료 이력 로그

즉 `rules/verifier/` 는 규칙이고, 검증 record 는 작업 중에는 `tickets/inprogress/verify_*.md`, 완료 후에는 final ticket 옆 `verify_*.md` 다. `logs/` 는 verifier completion history 다.

권장 훅:

- `#veri`

주의:

- 실제 검증 명령은 `start-verifier.sh` 가 출력한 `working_root` 에서 실행한다. ticket worktree 가 있으면 worktree 가 우선이고, 없으면 `PROJECT_ROOT` 가 fallback 이다.
- 검증 기록 파일은 시작 시 `BOARD_ROOT/tickets/inprogress/verify_*.md` 로 만들고, 완료 후에는 pass 면 `tickets/done/<project-key>/verify_*.md`, fail 면 `tickets/reject/verify_*.md` 로 정리한다.
- verifier 가 pass / fail 판정을 끝내면 `BOARD_ROOT/logs/` 에 completion log 를 남긴다.
- 검증 기록과 completion log 에도 `## Obsidian Links` 를 남겨 `project / plan / ticket / verify` note 가 이어지게 한다.
- 브라우저 확인이 필요해도 기본값은 비브라우저 검증이다. HTTP 응답, 빌드 산출물, 로그, DOM 문자열 확인으로 충분하면 창을 열지 않는다.
- 실제 렌더링 확인이 필요하면 Playwright 를 사용하지 않고 현재 에이전트의 브라우저 도구를 쓴다. Codex 는 Codex 브라우저 도구, Claude 는 Claude browser tool 을 사용한다.
- 에이전트 브라우저 도구 탭을 현재 턴에서 열었다면, 사용자가 유지하라고 명시하지 않는 한 **같은 턴 안에서 반드시 닫고 끝낸다**.
