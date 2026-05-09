---
id: memo_062
title: Autoflow 메타-원칙 — AI 주도 개발, sh 는 AI 의 도구
status: archived
created: 2026-05-02
archived_from: tickets/inbox/memo_062.md
archived_at: 2026-05-02T11:15:00Z
archived_by: planner
---

## Request

Autoflow 는 AI 주도(AI-led) 개발 시스템이다. 따라서 시스템 아키텍처도 그에 맞춰 정렬되어야 한다.

### 메타-원칙 (architectural, 모든 원칙의 전제)

> **AI 가 주도한다. shell script (`*.sh`, `bin/autoflow`, scaffold 자동화 등) 는 AI 가 사용하는 도구일 뿐이다.**

이 메타-원칙은 memo_061 의 제 1원칙(사용자 정지만 멈춤) 과 제 2원칙(모든 stall 에 자동 forward-action) 이 실제로 구현 가능하려면 반드시 먼저 깔려야 하는 전제다. 현재 시스템은 이 메타-원칙과 정반대로 sh 가 주도하고 AI 를 부분 호출하는 구조라, 안에 박힌 정적 if 분기들이 1원칙을 자동으로 위배한다.

### 현재 구조의 문제

- `start-plan.sh`, `start-ticket-owner.sh`, `verify-ticket-owner.sh`, `finish-ticket-owner.sh`, `merge-ready-ticket.sh` 같은 shell 이 보드 정책의 결정권을 가짐.
- shell 이 "if dirty → park", "if conflict → reject", "if max_retries → needs_user" 같은 정적 분기를 하드코딩.
- AI (codex/claude) 는 shell 이 정해 둔 분기 안에서 텍스트만 생성하는 종속 도구.
- 결과: AI 가 dirty worktree 를 보고 "이건 자기 실패 흔적이니 폐기해도 됨" 이라고 판단할 자유가 없음. shell 이 이미 `needs_user` 로 결정해 버렸기 때문.
- 결과: 새 시나리오가 생길 때마다 shell 분기를 추가해야 함. AI 의 판단력이 활용되지 않음.

### 의도된 구조 (메타-원칙 반영)

- **AI 가 결정권을 가짐**: planner / worker / wiki 가 매 tick 마다 보드 상태를 읽고 다음 액션을 직접 판단한다. shell 이 분기를 미리 결정해 주지 않는다.
- **shell 은 thin tool**: AI 가 호출하는 도구 모음. 인풋·아웃풋이 명확한 단일 책임 함수. 예: "worktree 폐기", "ticket 파일 이동", "diff 백업", "guard 실행", "git status 읽기", "wiki 검색". 보드 정책 결정은 안 함.
- **AI 가 도구를 조합**: 상황 → AI 가 "이 도구 → 저 도구 → 결과 확인 → 다음 결정" 을 동적으로 결정.
- **shell 이 AI 출력을 해석하지 않음**: 기존엔 shell 이 codex 출력을 grep 으로 파싱해 분기. 의도된 구조에선 AI 가 다음 도구 호출까지 자기가 함.

## Notes

- Planner promotion note (2026-05-02T11:15:00Z): 메모 전체는 5단계 architectural pivot 이라 한 티켓 범위를 초과한다. 이번 planner 턴은 1단계인 "도구 인터페이스 정의 / thin tool catalog" 를 `prd_108` + `Todo-106` 으로 승격했고, 나머지 shell 정책 분기 제거/보드 contract 재배치/데스크톱 시각화는 후속 PRD 경계로 남겼다.
