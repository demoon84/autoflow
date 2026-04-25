# Logs

`BOARD_ROOT/logs/` 는 verifier 완료 이력을 남기는 폴더다.

- 파일명 규칙: `verifier_<ticket-id>_<timestamp>_<outcome>.md`
- 생성 시점: verifier 가 pass 또는 fail 판정을 끝낸 직후
- 목적:
  - 당시 티켓 상태 스냅샷 보관
- 활성 검증 기록과 별개로 완료 이력 추적
  - done / reject 이동 뒤에도 사람이 빠르게 확인할 수 있는 요약 남김
- `hooks/`
  - file-watch hook 실행 로그 폴더
  - route별 dispatch 결과를 남김

주의:

- 검증 record 자체는 작업 중에는 `tickets/inprogress/verify_NNN.md`, 완료 후에는 final ticket 옆 `verify_NNN.md` 다.
- `logs/` 는 "이번 verifier 작업이 어떻게 끝났는지"를 남기는 completion log 다.
- pass / fail 둘 다 로그를 남긴다.
