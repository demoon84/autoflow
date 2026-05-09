# Autoflow Order

## Order

- ID: order_188
- Title: 데스크톱 러너 라벨 한국어 → 영어 (Worker / LLM Wiki)
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T05:20:31Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 데스크톱 러너 라벨 한국어 → 영어 (Worker / LLM Wiki)
- Priority: normal
- Status: ready


Worker, LLM Wiki 영어로 표기

## Notes

- 데스크톱 사이드바 / 러너 카드의 한국어 라벨을 영어로 변경:
  - "워커" → "Worker"
  - "LLM위키" → "LLM Wiki"
  - "LLM 위키" → "LLM Wiki" (settingsNavigation key=knowledge 의 label)
- "Planner" 는 이미 영어라 변경 없음.
- 후보 위치 (`apps/desktop/src/renderer/main.tsx`):
  - line 206 `label: "LLM 위키"` — settingsNavigation knowledge 항목.
  - line 5155 `["워커", item.aiLabel]` — 티켓 메타데이터 라벨.
  - line 6557 `singleton ? "LLM위키" : "LLM위키-1"` — wiki runner 표시.
  - line 6576 `if (role === "ticket-owner" || role === "owner") return "워커";`
  - line 6577 `if (role === "wiki-maintainer" || role === "wiki" || role.includes("wiki")) return "LLM위키";`
- 혹시 다른 위치(worker-N suffix 패턴 등) 도 있는지 grep 으로 마무리 확인 필요.
- 사용자 의도: 영어 라벨 단독 ("Worker AI" 같은 suffix 없이 "Worker"). 과거 2026-04-30 에 "Worker AI / Wiki AI" 로 변경한 적 있고 2026-05-02 에 한국어로 되돌렸음 — 이번은 다시 영어, suffix 없이.
- AGENTS.md rule 15a (사용자 노출 한국어 정책) 의 예외로 다뤄도 OK — 사용자가 이 위치만 영어 요청.
- AGENTS.md rule 16 (`worker`, `verification`, `log` 의 normalize 규칙) 와도 일치 (rule 16 자체가 "worker" 라는 영어 기준).

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
