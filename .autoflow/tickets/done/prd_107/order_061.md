---
id: memo_061
title: Autoflow 제품 1원칙 박기 + No-Park 자동 회복 정책
status: inbox
created: 2026-05-02
---

## Request

제품 이름이 "autoflow" 인 만큼, **제품의 1원칙** 을 명문화하고 그 1원칙이 코드 / agent 프롬프트 / 보드 정책 / 문서 전체에 일관되게 강제되도록 한다.

### 제 1원칙 (제품 헌법, 최상위)

> **Autoflow 는 사용자가 정지 버튼을 명시적으로 눌렀을 때만 멈춘다. 그 외 어떤 상황에서도 흐름은 계속 흐른다.**

- 이 1원칙은 다른 모든 정책/규칙/agent 지침에 우선한다.
- 이 1원칙은 root 문서에 박혀야 한다 — 모든 AI 와 사용자가 가장 먼저 읽는 위치:
  - `AGENTS.md` 의 Root Rules 가장 위 (현재 1번 자리에 1원칙으로 삽입, 기존 항목들은 한 칸씩 밀기)
  - `CLAUDE.md` 의 import 직후 첫 헌법 섹션
  - `.autoflow/rules/README.md` 의 가장 위
  - `README.md` (제품 설명) 의 첫 섹션
  - `.autoflow/agents/*.md` 모든 agent 지침의 머리에 한 줄 인용 또는 링크
- 1원칙에 위배되는 모든 잔존 정책 (`needs_user`, "wait for explicit user decision", "leave parked", "do not auto-resolve") 은 코드 / 프롬프트 / 문서에서 자동 forward-action 으로 교체.

### 제 2원칙 (1원칙의 구현 보장)

모든 stall 시나리오 (LLM 실패, reject 반복, dirty worktree, path conflict, merge conflict, PRD 모순, scaffold 회귀, OS 오류 등) 에 자동 forward-action 경로가 정의되어 있어야 한다. 어떤 분기도 dead-end 가 되어서는 안 된다. 사람 의견이 정말 필요한 경우는 알림(데스크톱 notification / 로그 / wiki) 으로만 통지하고, 그 동안에도 다른 흐름은 계속 진행한다.

이 메모의 나머지 본문은 2원칙의 시나리오별 강제 forward-action 을 정의한다.

## 2원칙 세부 규칙

(1원칙의 구현 보장. planner / worker / wiki 어느 단계에서도 "사용자 결정을 기다림" 으로 무기한 멈추지 않는다.)

1. **시간 기반 자동 escalate**: 같은 상태로 N분 이상 정체되면 (`AUTOFLOW_STALL_TIMEOUT_SECONDS`, 기본 600 = 10분) 무조건 다음 forward-action 으로 전환. "지금 결정을 보류한다" 는 결과는 무한 반복 금지.
2. **차단 분리**: 한 티켓이 막혀도 다른 티켓 / 다른 PRD / 다른 inbox 메모 처리는 계속. 한 ticket 의 stall 이 보드 전체를 멈추지 않는다.
3. **항상 forward path**: 모든 recovery 결정에 "이게 안 되면 그 다음" 이 정의되어 있어야 한다. dead-end 결정은 코드 / agent 프롬프트에서 금지.
4. **알림은 비차단**: 사람이 봐야 할 정보는 데스크톱 알림 / 로그 / wiki 결정 이력으로 통지. 통지가 흐름을 막지 않음.

## 시나리오별 강제 forward-action

memo_060 가 `leftover_worktree` 와 same-scope `allowed_path_conflict` 를 처리한다. 이 메모는 **그 외 모든 stall 시나리오** 에 forward-action 을 강제한다.

### A. LLM / 네트워크 / API 실패
- exponential backoff retry (최대 N회).
- 같은 provider 가 계속 실패하면 자동으로 다른 모델 / 다른 provider 로 fallback (`AUTOFLOW_LLM_FALLBACK_CHAIN`).
- 모든 fallback 이 실패해도 "park" 안 함 → ticket 을 `tickets/blocked-infra/` 같은 별도 lane 으로 옮기고 다른 ticket 은 계속 진행. infra 복구되면 자동 재투입.

### B. `allowed_path_conflict` 가 다른 영향권
- memo_060 의 same-scope 자동 확장에 해당하지 않으면, 자동으로 **PRD 자체를 다시 쓰는 경로** 로 보낸다.
- 처리: planner 가 새 PRD 후보 (`tickets/backlog/prd_NNN.md`) 를 자동 생성해 conflict 파일을 Allowed Paths 에 포함시킨 retry-PRD 로 전환. 원 PRD 는 superseded 로 마킹.
- 이것도 park 가 아니라 "다음 PRD" 로 흐른다.

### C. 실제 git merge conflict (main 이 움직임)
- 자동 rebase 시도.
- rebase 실패 시 dirty diff 백업 후 worktree 폐기 + 같은 ticket 을 최신 main 기준으로 재발급.
- 이전 작업분은 백업에서만 살아 있고 흐름은 그대로 진행.

### D. stale in-progress (같은 ticket 무진행)
- ticket 이 inprogress 에 있는데 commit / runner log / state 변경이 `AUTOFLOW_STALE_TICKET_SECONDS` (기본 1800 = 30분) 이상 없으면 자동 cancel.
- worktree 폐기 → ticket 을 `tickets/todo/` 로 되돌려 다른 worker / 다른 모델로 재시도.
- N회 stale 반복 시 PRD 재작성 lane 으로 escalate (시나리오 B 와 동일).

### E. PRD 자체 모순 / Done When 불가능
- 같은 PRD 의 ticket 이 `AUTOFLOW_REJECT_MAX_RETRIES` 도달 시 → 자동으로 PRD 를 `tickets/backlog/needs-rewrite/` lane 으로 이동.
- planner 가 wiki 검색 + 원 inbox memo 재참조 + 기존 reject 사유 종합해 **PRD 자체를 자동 재작성** 후 일반 backlog 로 재투입.
- N회 재작성 실패 시 사용자 알림만 보내고 ticket 은 closed-superseded 로 정리. 보드 흐름은 계속.

### F. autoflow CLI / scaffold 자체 버그
- guard 가 잡으면 그 PRD 만 격리, 다른 흐름은 진행.
- guard 에 안 잡히는 회귀가 같은 PRD 에서 N회 발생하면 자동으로 PRD 를 needs-rewrite lane 으로 이동 + wiki 에 회귀 패턴 기록.

### G. OS-level (디스크/권한/네트워크)
- 자동 retry + 사용자 알림 (데스크톱 banner / desktop notification).
- 다른 ticket 처리는 영향 없는 만큼 계속.

## 추가 요구사항

- env 토글: `AUTOFLOW_NO_PARK=on` (기본 on). off 는 디버깅 용도로만 사용.
- 모든 자동 forward-action 은 `.autoflow/runners/logs/planner.log` 와 wiki 결정 이력에 `event=auto_forward_action reason=...` 로 명시 기록.
- 데스크톱 앱 진행 화면에 "자동 회복 중" / "재PRD 중" / "infra 복구 대기" 같은 비차단 상태를 시각화. 사람이 보지 않아도 흐름은 진행.

## Notes

- 이 메모는 **메타 정책 헌법** 이라 Plan AI 가 시나리오별로 PRD 분할하기 좋다.
- 분할 후보 PRD: A(infra retry), B(re-PRD lane), C(merge conflict 자동 rebase), D(stale-inprogress 감지), E(PRD 자동 재작성), F(scaffold 회귀 격리), G(OS-level 알림).
- memo_060 (leftover worktree / same-scope path conflict) 와는 보완 관계. 두 메모를 같이 보면 모든 stall 시나리오 cover.

## Verification hint

- root 문서 박힘 확인:
  - `AGENTS.md` Root Rules 가장 위에 1원칙이 들어가 있는지 (이전 1번 항목들이 한 칸씩 밀려 있는지).
  - `CLAUDE.md`, `.autoflow/rules/README.md`, `README.md` 머리에 1원칙이 있는지.
  - `.autoflow/agents/*.md` 의 머리에 1원칙 한 줄 또는 링크가 있는지.
  - `git grep -n "needs_user"` 결과가 0건에 가깝게 떨어졌는지 (자동 forward-action 으로 교체됐는지).
- 의도적 시나리오 재현 테스트:
  - LLM provider 키 무효 → ticket 이 다른 provider 로 fallback 또는 infra-blocked lane 으로 격리되고 다른 ticket 은 정상 처리되는지.
  - inprogress ticket 의 worker 프로세스 강제 kill → stale 감지로 자동 cancel + 재발급되는지.
  - PRD 에 의도적 모순 (Allowed Paths vs Done When 불일치) → 자동 PRD 재작성 lane 으로 가는지.
  - 같은 PRD 가 N회 reject → max_retries 후 closed-superseded 로 정리되고 다른 PRD 흐름은 계속되는지.
- 어떤 시나리오에서도 보드의 다른 lane (다른 PRD / 다른 inbox memo) 처리가 멈추지 않는지 확인.
- `needs_user` 가 코드/프롬프트에 잔존하면 그건 모두 자동 forward-action 으로 교체되어야 함 — `git grep "needs_user"` 가 0건에 가깝게 떨어져야 함 (기록용 historical state 만 잔존 허용).
