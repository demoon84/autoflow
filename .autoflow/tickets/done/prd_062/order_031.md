---
id: memo_031
title: /af 스킬 명령어 제거
created: 2026-04-30
source: chat-order-trigger
---

## Request

/af 스킬 명령어 제거.

`/af` 와 `#af` 를 더 이상 노출하지 않는다. PRD 핸드오프 트리거는 `/autoflow` / `#autoflow` 한 가지로 통일한다 (`/order` / `#order` 는 별개의 quick intake 트리거이므로 영향 없음).

## Notes

- 제거 대상은 "alias 로서의 /af, #af" 다. 기능 자체(=PRD 를 backlog 으로 핸드오프) 는 `/autoflow` 가 그대로 수행한다.
- 사용자가 실수로 `/af` 를 입력했을 때 "unknown command" 로 떨어지는 것까지 그대로 두면 된다. 별도 deprecation 안내 메시지는 필요 없다 (사용자 본인이 트리거 제거를 명시했음).
- 향후 새 보드 install 에서도 af 스킬이 다시 깔리지 않도록 install 경로에서 빠지는지 확인.

## Allowed Paths (hint)

- `.claude/skills/af/` (디렉터리 통째로 제거)
- `.codex/skills/af/` (디렉터리 통째로 제거)
- `CLAUDE.md`
- `AGENTS.md`
- `.autoflow/README.md`
- `.autoflow/AGENTS.md`
- `.autoflow/agents/spec-author-agent.md`
- `.autoflow/rules/` (해당 트리거를 언급하는 규칙 문서)
- `.autoflow/automations/README.md` (해당 트리거를 언급하면)
- `MEMORY.md` 인덱스가 아닌 자동화 install 코드 경로:
  - autoflow CLI 안에서 `.claude/skills/af` / `.codex/skills/af` 를 만들거나 복사하는 install/refresh 스크립트 (예: `apps/cli/`, `packages/`, 혹은 `scripts/install-skills.*` 류). grep 으로 "skills/af" / `"af"` skill 이름을 찾아 같이 정리한다.

추가로 grep 결과에서 `#af`, `/af`, `"af"` (스킬 키), `skills/af` 가 나오면 같은 PR 안에서 같이 정리.

레거시 trigger alias 인 `#plan`, `#todo`, `#veri` 는 이번 작업의 범위가 **아니다** — 이 주문은 `/af` 만 제거한다.

## Verification (hint)

- `rg -n '\b/af\b|#af\b|skills/af|"af"\s*[:=]'` 같은 grep 으로 활성 트리거 / 스킬 정의가 남아 있지 않은지 확인 (archive, history 메모, done 티켓, wiki 회고 같은 read-only 기록은 그대로 둔다).
- `.claude/skills/` 와 `.codex/skills/` 에 `autoflow/`, `order/` 만 남고 `af/` 가 사라졌는지 확인.
- 데스크톱이나 터미널 어댑터의 트리거 자동완성/도움말에 `/af` 가 더 이상 노출되지 않는지 확인 (해당 UI 가 있다면).
- `CLAUDE.md` / `AGENTS.md` / `.autoflow/` 문서에서 alias 표기가 `/autoflow` / `#autoflow` (그리고 `/order` / `#order`) 만 남도록 정리됐는지 확인.
