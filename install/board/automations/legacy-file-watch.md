# Legacy File-Watch

File-watch hook(`watch-board.ts` -> `run-hook.ts`)은 deprecated된 legacy script-driven trigger다. 지원되는 모델은 PTY runner up과 runner tool 조합이다. file-watch는 하위 호환 fallback으로 명시적으로 켜졌을 때만 사용한다.

File-watch fallback이 명시적으로 활성화된 경우의 일반 route는 다음과 같다.

- prd 변경 -> planner
- todo 변경 -> worker
- verifier 변경 -> 기록된 결정에 따라 verifier 또는 worker
- done 변경 -> wiki

Hook dispatch history는 별도 파일로 저장하지 않는다.
