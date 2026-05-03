---
title: autoflow order create CLI + /order 스킬에 priority 항목 추가 (본문 섹션 필드 자동 삽입)
created_at: 2026-05-03
source: claude-code /order
---

## Request

order 본문의 `## Order` 섹션 필드에 `- Priority: <value>` 항목이 표준 포함되도록:
1. **`autoflow order create` CLI** 에 `--priority critical|high|normal|low` 옵션 추가.
2. **`/order` 스킬** (Claude/Codex/integrations) 에서 사용자 발화에 긴급/🚨/critical 같은 표현이 있으면 자동으로 `--priority critical` 부여.
3. order 본문 템플릿(`packages/cli/order-project.sh` 의 stdout 헤딩) 에 `- Priority:` 필드 표준 삽입.

→ order_137 의 priority 정렬 메커니즘이 입력단부터 일관되게 동작하도록 입력 단계 보강.

## Background

order_137 은 정렬 헬퍼(`list_matching_files` / `lowest_matching_file`) 와 4 영역(order/PRD/todo/verify) 일관 적용을 다룸. 본 order 는 그 입력단(=order 작성 단계) 에서 priority 표기가 표준화되도록 보강. 둘은 강결합 — 같은 PRD 로 묶거나 의존 PRD 로 진행 권장.

현재 order 본문 헤더 예시 (사용자 첨부):
```
## Order
- ID: order_136
- Title: 🚨 listRunners IPC fork-bomb (2312 instance) — desktop UI critical
- Status: inbox
- Created At: 2026-05-03T10:36:39Z
- Source: autoflow order create
```

원하는 형태:
```
## Order
- ID: order_136
- Title: 🚨 listRunners IPC fork-bomb (2312 instance) — desktop UI critical
- Status: inbox
- Priority: critical
- Created At: 2026-05-03T10:36:39Z
- Source: autoflow order create
```

## Scope (hint)

### 1. CLI 옵션 추가
- `packages/cli/order-project.sh`:
  - 인자 파싱에 `--priority <value>` 추가 (`critical | high | normal | low`).
  - 미지정 시 기본 `normal`.
  - 유효성 검사: 위 4값 외 거부 (또는 normal fallback + stderr warn).
  - stdout 본문 템플릿의 `## Order` 섹션 안 `- Priority: <value>` 라인 삽입 (위치: `Status` 다음).

### 2. /order 스킬 자동 인식
- `.claude/skills/order/SKILL.md` / `.codex/skills/order/SKILL.md` / `integrations/{claude,codex}/skills/order/SKILL.md`:
  - 사용자 발화 분석:
    - "긴급", "critical", "🚨", "fork-bomb", "leak", "blocker", "데이터 손실", "보안" 등 → `--priority critical` 자동 부여.
    - "중요", "high priority", "⚠️", "blocking" 등 → `--priority high`.
    - 명시 없으면 `--priority normal` (생략).
  - 트리거 시 사용자 의도가 모호하면 priority 생략(=normal) 안전 기본.
  - SKILL 본문에 자동 부여 가이드 1~2 줄 추가.

### 3. 본문 템플릿 일관화
- `packages/cli/order-project.sh` 의 `printf '## Order\n\n'` 블록에 priority 필드 표준 위치 삽입.
- 기존 inbox 의 order 들 (132~138) 은 backfill 안 함 (historical) — 정렬 헬퍼(order_137) 가 본문/frontmatter/emoji 다중 source 인식하도록 설계됐으므로 OK.

### 4. order_137 와의 정합
- order_137 의 `extract_priority_rank` 가 본문 `- Priority:` 필드를 인식하도록 우선순위:
  1. yaml frontmatter `priority:` (있으면)
  2. **본문 `## Order` 섹션의 `- Priority:` 필드** (본 order 가 도입)
  3. title 의 🚨 / ⚠️ marker
  4. fallback: normal
- 본 order 는 source #2 의 표준화. 다른 source 와 충돌 없음.

## Allowed Paths (hint)

- `packages/cli/order-project.sh` (CLI 옵션 + 본문 템플릿)
- `.claude/skills/order/SKILL.md`
- `.codex/skills/order/SKILL.md`
- `integrations/claude/skills/order/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`
- (참조만, 변경 없음) `.autoflow/scripts/common.sh` (order_137 의 `extract_priority_rank` 와 정합)

## Verification (hint)

- `bash bin/autoflow order create "$PWD" .autoflow --title "test critical" --priority critical` →
  - `.autoflow/tickets/inbox/order_NNN.md` 생성, 본문 `## Order` 섹션에 `- Priority: critical` 라인 포함.
- `bash bin/autoflow order create "$PWD" .autoflow --title "test"` (priority 미지정) →
  - 본문에 `- Priority: normal` 또는 라인 생략 (Plan AI 합의에 따름).
- `bash bin/autoflow order create "$PWD" .autoflow --title "test" --priority bogus` →
  - 거부 (stderr) 또는 normal fallback + warn.
- `/order` 시뮬레이션:
  - "긴급 데이터 손실 fix" 같은 발화 → 생성된 order 에 `Priority: critical`.
  - "메뉴 라벨 정리" 같은 발화 → `Priority: normal` 또는 생략.
- order_137 의 정렬 헬퍼와 결합:
  - 같은 인박스에 `Priority: critical` 1건 + 일반 다수 → planner tick 이 critical 부터 promote 하는지.
- `npm run desktop:check` 통과 (UI 영향 없음).

## Notes

- **연관:**
  - order_137 (priority 정렬 메커니즘) — 본 order 는 입력단 표준화. 같은 PRD 로 묶이거나 의존 PRD 로 진행 권장.
- **위험:**
  - /order 스킬의 자동 인식이 false-positive (예: 일반 발화에 우연히 "긴급" 포함) → 명시적 `--priority` 옵션이 우선되도록 가이드.
  - 기존 order 본문에 `Priority` 필드 없음 → order_137 의 fallback (normal) 으로 자동 처리. backfill 불필요.
- **out of scope:**
  - PRD/ticket 작성 단계의 priority 입력 (별도 order/PRD): backlog PRD 작성 시점은 spec-author-agent / `autoflow spec create` 가 다른 흐름이라 분리.
  - priority 변경 audit, 사람 토글 UI — 후속.
- **1원칙 정합:**
  - 입력단 priority 표기는 자율 흐름을 막지 않음. 미지정 시 normal fallback 으로 안전.
