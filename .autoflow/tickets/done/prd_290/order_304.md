# Autoflow Order

## Order

- Title: Planner stale state report 차단 — adapter 호출 직전 보드 재읽기 + post-tick hash 검증
- Priority: high
- Status: ready
- Change Type: code

## Request

증상: planner adapter 가 "todo: Todo-298, Todo-299 (worker 픽업 대기)" 라고
출력했는데 실제 todo 디렉토리는 비어 있었음. fs.watch wake 이벤트 발생 시점의
스냅샷을 prompt 에 박은 뒤 LLM 호출 latency 동안 보드가 변했고, LLM 은 stale
스냅샷을 그대로 사용자에게 보고. 자율주행 정확도에 직접 영향.

해야 할 것:
1. .autoflow/scripts/start-planner.ts (또는 adapter wrapper) 가 LLM 호출 직전에
   보드를 한 번 더 읽어 prompt 의 "현재 보드" 섹션을 마지막 순간에 refresh.
2. prompt 에 board_snapshot_hash 박기 — sha256(`ls inbox todo inprogress backlog`).
   planner 출력에도 자기가 본 hash 를 함께 인용하게 강제.
3. post-tick guard: planner 출력의 hash 와 호출 직후 실측 hash 를 비교.
   불일치 ≥ 1회면 다음 tick 강제 wake (idle-skip 우회) 로 즉시 재실행.
4. log: .autoflow/runners/logs/planner-stale.log 에 stale 감지 이벤트 JSONL 기록.

## Allowed Paths

- .autoflow/scripts/start-planner.ts
- .autoflow/scripts/start-planner.sh
- .autoflow/scripts/start-planner.legacy.sh
- .autoflow/agents/plan-to-ticket-agent.md

## Done When

- [ ] planner LLM 호출 직전 보드 재읽기 동작 (timestamp 비교 로그 확인)
- [ ] planner prompt 에 board_snapshot_hash 포함, 출력에도 hash 인용 강제
- [ ] post-tick guard 가 hash 불일치 감지 시 다음 tick 강제 wake 발사
- [ ] stale 이벤트 JSONL 로그 기록
- [ ] 동일 stale 시나리오 (todo 가 LLM 호출 도중 비워짐) fixture 에서 planner 가
      "이전 스냅샷" 이라고 자가 인식하고 idle 처리 (잘못된 보고 차단)

## Verification

- Command: fixture 로 fs.watch wake 직후 todo 파일 mv 시뮬레이션 → planner 출력
  hash 와 실측 hash 비교, 불일치 검출 여부 확인

## Notes

- 별개 분석에서 발견 — 다른 자율주행 개선 ticket 의 정확도 전제 조건
- planner 의 자기인식(self-aware) 강화 — "내가 본 보드는 이미 옛것일 수 있다" 명시
- adapter prompt 가 길어지면 prompt cap (AUTOFLOW_PLANNER_PROMPT_BYTES) 검토 필요
