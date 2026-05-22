# 처리된 PRD 큐

이전 Autoflow 버전은 소비된 spec에 `tickets/prd/processed/`를 사용했다.

현재 규칙:

- 워커는 소비된 spec을 `tickets/done/<project-key>/`로 옮긴다.
- Legacy planner도 소비된 spec을 `tickets/done/<project-key>/` 아래에 archive 한다.
- Upgrade script는 old processed spec을 done project folder로 migrate 한다.
- 새 board는 이 folder를 만들지 않는다.
