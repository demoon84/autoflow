# Automation State

`automations/state/` 는 heartbeat / stop hook 이 현재 thread context 를 기록하는 런타임 상태 폴더다.

원칙:

- `threads/<thread-key>.context` 는 스레드별 역할 문맥을 저장한다.
- `current.context` 는 thread id 를 모르는 환경을 위한 fallback 이다.
- 이 폴더는 runtime 이 갱신하므로 수동 편집보다 스크립트 (`set-thread-context.*`, `clear-thread-context.*`) 를 우선한다.
- stop hook 은 이 상태를 읽어 아직 남은 plan / todo / verifier 작업이 있으면 너무 이른 종료를 막는다.
- 역할 문맥(`role`, `worker_id`)과 현재 티켓 문맥(`active_ticket_id`, `active_ticket_path`, `active_stage`)을 같이 저장할 수 있다.
- 기능 단위 작업이 끝나면 전체 context 파일을 지우기보다 `clear-thread-context.* --active-only` 로 현재 티켓 문맥만 비운다. 역할 문맥은 heartbeat 유지와 stop hook 을 위해 남긴다.
- 상관관계는 Obsidian links, ticket `References`, `Resume Context`, run/log 파일에 남긴다. 다음 tick 은 대화 히스토리보다 보드 파일을 다시 읽어 재개한다.
