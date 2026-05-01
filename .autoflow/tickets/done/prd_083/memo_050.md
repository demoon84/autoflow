---
id: memo_050
title: 작업 메뉴 역할 라벨 변경 (Planner AI / Worker AI / Wiki AI)
status: inbox
created: 2026-05-01
---

## Request

작업 메뉴레 글자 표기를 변경하고 싶다

Planner => Planner AI
Worker => Worker AI
위키봇 => Wiki AI

(맥락: 데스크톱 앱 "작업" 메뉴 진행 카드에서 각 러너의 역할 라벨이 현재 `Planner` / `Worker` / `위키봇` 으로 표시되는데, 사용자는 이를 `Planner AI` / `Worker AI` / `Wiki AI` 로 통일하길 원함.)

## Notes

- 핵심 위치: `apps/desktop/src/renderer/main.tsx:5236-5245` 의 `displayProgressRoleLabel`
  ```tsx
  if (role === "planner" || role === "plan") return "Planner";
  if (role === "ticket-owner" || role === "owner") return "Worker";
  if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki")) return "위키봇";
  ```
  → `Planner AI` / `Worker AI` / `Wiki AI` 로 교체.
- 사용처: `displayProgressRoleLabel` 는 `apps/desktop/src/renderer/main.tsx:5334` (`agentTitle`) 등에서 작업 메뉴 진행 카드 헤더 라벨로 쓰임.
- 참고로 다른 표시 함수들도 같은 어휘를 쓰고 있으나, 이번 오더의 1차 범위는 "작업 메뉴" 라벨 한 곳만:
  - `apps/desktop/src/renderer/main.tsx:5208-5225` 의 `displayWorkflowRunnerId` 는 러너 id 디스플레이로 `"worker"` / `"planner"` / `"위키봇"` 같은 소문자 label 을 반환함. 여기까지 같이 바꿀지(예: `worker AI` 식) 는 Plan AI 가 판단. 보통은 storage id (owner-1, planner-1) 와 짝지어 쓰이므로 의미 깨지지 않게 유의.
  - 별도로 `apps/desktop/src/renderer/main.tsx:508-509` 의 worker slot 라벨 매핑은 이미 `"Wiki AI"` 를 사용 중이므로 일관성 ↑.
- 이번 변경은 사람이 보는 표기만 바꾸는 것이며, 러너 id, role key (`planner`, `ticket-owner`, `wiki-maintainer`), 보드 / parser 계약, ticket 필드, runtime contract 는 절대 건드리지 않는다 (CLAUDE.md 의 worker 표시 규칙 16 항 준수).

## Scope hint

- 후보 파일:
  - `apps/desktop/src/renderer/main.tsx` (`displayProgressRoleLabel` 등 작업 메뉴 진행 카드 라벨)

## Verification hint

- 데스크톱 앱 사이드바의 "작업" / 진행 메뉴에서 각 러너 카드 헤더가 `Planner AI` / `Worker AI` / `Wiki AI` 로 표시되는지 확인.
- 러너 카드 안의 다른 메타(상태, agent, model) 가 변경된 라벨과 잘 어울려 줄바꿈/잘림 없이 보이는지 확인.
- 칸반 / 티켓 디테일 / 로그 / 위키 / 스냅샷 등 다른 화면에서 라벨 대체로 인한 회귀가 없는지 가벼운 회귀 확인.
- 러너 id (예: `owner-1`, `planner-1`, `wiki-1`), 보드 contract, parser-sensitive 출력 (key=value 등) 은 그대로 유지되는지 확인.
