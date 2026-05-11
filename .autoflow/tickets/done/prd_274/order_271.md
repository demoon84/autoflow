# Autoflow Order

## Order

- Title: PTY 워커 wake 안전망 — queue gate + idle 감지 기반 주기 폴링 (토큰 낭비 없이 멈춤 회복)
- Priority: high
- Status: ready
- Change Type: code

## Request

현재 PTY mode 워커는 `apps/desktop/src/main.js` 의 `ensureBoardWatcher()` 가 발사하는 fs.watch 이벤트에만 의존해 wake 받는다. 다음 구조적 구멍이 7시간 워커 정체로 실측됨 (2026-05-10 01:01 KST ~ 08:13 KST, Todo-279):

1. claude 가 한 턴 작업 후 inprogress 티켓 파일을 안 건드리면 후속 wake 트리거 자체가 발사 안 됨 — Allowed Paths 가 `.autoflow/wiki/`, `.autoflow/agents/` 같은 watch 밖 경로일 때 영구 idle
2. fs.watch 가 sleep/wake / rapid rename / OS edge case 로 이벤트를 누락해도 백업 폴링이 코드 주석에만 있고 실제 구현 없음 (`apps/desktop/src/main.js:1050` 참조)
3. `recursive: false` 또는 watcher handle 손실 시 silent drop

핵심 요구: 주기 폴링을 도입하되 **빈 큐일 때 헛 wake 보내지 않음** + **작업 중 claude 방해 안 함** + **fingerprint 변화 또는 장시간 정체 회복 한정**으로 토큰 낭비를 제거한다.

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/main/runner-pty-manager.js
- .autoflow/scripts/runner-wake.ts

## Done When

- [ ] `apps/desktop/src/main.js` 에 `queueHasPendingWork(role, scope)` 게이트 함수 추가
  - planner: `inbox/order_*.md` 또는 `backlog/prd_*.md` 1개 이상이면 true
  - ticket-owner: `inprogress/Todo-*.md` 또는 `todo/Todo-*.md` 1개 이상이면 true
  - wiki-maintainer: `done/<key>/Todo-*.md` 또는 `wiki/*.md` mtime > baseline.mtime 일 때 true
- [ ] 기존 `broadcast()` (fs.watch 경로) 가 writePrompt + runner-wake emit 직전에 `queueHasPendingWork(role)` 통과한 역할에만 발사
- [ ] PTY runner 별 idle 감지 헬퍼 — 최근 N초 (env `AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC`, 기본 30) 동안 token report / stage report / PTY stdout signal 없을 때 idle = true
- [ ] PTY runner 별 queue fingerprint 캐시 — 마지막 wake 시점에 본 큐 파일명+mtime sha256 12자리 저장
- [ ] Safety poll setInterval — 주기 `AUTOFLOW_WAKE_POLL_INTERVAL_SEC` (기본 60)
  - 모든 PTY runner 순회, AND 조건 통과 시에만 wake:
    - (1) `queueHasPendingWork(role)` = true
    - (2) idle 상태 (위 헬퍼)
    - (3) `(fingerprint 변경)` OR `(idle 지속 ≥ AUTOFLOW_WAKE_STALL_THRESHOLD_SEC, 기본 1800)`
  - wake 발사 시 fingerprint 갱신, 발사 안 한 경우 갱신 안 함
- [ ] wake 발사 카운터 로그 — `.autoflow/runners/logs/wake-poll.log` 에 JSONL 1줄 (`runner`, `reason`, `queue_size`, `fingerprint_changed`, `idle_seconds`, `at`)
- [ ] env knob 3개 README 또는 AGENTS.md 한 줄 설명 추가
- [ ] 검증 1: `tickets/todo/` `tickets/inbox/` `tickets/inprogress/` 모두 비운 상태에서 60초 대기 → `wake-poll.log` 에 wake 라인 0건 (헛 wake 없음)
- [ ] 검증 2: `tickets/todo/Todo-XXX.md` 1개 둔 상태로 워커가 idle 일 때 60초 안에 wake-poll.log 에 worker wake 1건 기록
- [ ] 검증 3: 워커가 막 token 보고한 직후 (busy 상태) 60초 polling tick 도래해도 wake 안 보냄 (idle 조건 fail)

## Verification

- Command: node -e "console.log(require('./.autoflow/runners/state/worker.state'))" && tail -5 .autoflow/runners/logs/wake-poll.log

## Notes

- 1원칙: 멈추지 않는다 — 폴링은 안전망이지 1차 트리거가 아니다. fs.watch 는 빠른 신호용으로 그대로 유지하고 같은 게이트 통과시키기
- 토큰 회피 핵심: 빈 큐일 때 wake 0회 + 작업 중 claude 방해 0회 + 같은 fingerprint 반복 wake 0회 (30분 wedged guard 만 예외)
- 실측 트리거 케이스: Todo-279 (Wiki 구조 정리) — Allowed Paths 가 `.autoflow/wiki/`, `.autoflow/agents/` 라 워커 편집이 worker wake 라우팅 경로 (`tickets/todo/`, `tickets/inprogress/`) 밖이라 self-sustaining wake 0건
- env 조정 가능 knob: `AUTOFLOW_WAKE_POLL_INTERVAL_SEC` (기본 60), `AUTOFLOW_WAKE_IDLE_THRESHOLD_SEC` (기본 30), `AUTOFLOW_WAKE_STALL_THRESHOLD_SEC` (기본 1800)
- claude prompt 변경 없음 — startup-scan 지시는 그대로 유지, 인프라 레벨에서만 안전망 추가
