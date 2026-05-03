---
title: order 본문 형식 표준 통일 — CLI 헤더 형식으로 일원화 + Request 중복 제거
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

(첨부 스크린샷 2장) 인박스 order 들이 작성 경로에 따라 형식이 일관되지 않음:

1. **CLI 작성 (`autoflow order create`)** — `Order-132` 같은 케이스
   ```markdown
   # Autoflow Order

   ## Order
   - ID: order_132
   - Title: ...
   - Status: inbox
   - Created At: ...
   - Source: autoflow order create

   ## Request
   ## Request   ← 중복 발생!
   본문...
   ```

2. **Claude 직접 작성 (Write)** — `Order-138` 등 최근 내 작업
   ```markdown
   ---
   title: ...
   priority: high
   created_at: ...
   source: ...
   ---

   ## Request
   본문...
   ## Background
   ...
   ```

→ 데스크톱 미리보기에서 yaml frontmatter(`---`) 가 markdown 으로 raw 렌더링되거나 (오른쪽 스크린샷), `## Request` 섹션이 두 번 표시되거나 (왼쪽 스크린샷). **표준 1개로 통일** 필요.

## Scope (hint)

### 1. 표준 형식 결정 — CLI 헤더 형식 권장
사용자 친화 + parser 친화 측면에서 **CLI 형식 (`# Autoflow Order` + `## Order` bullet list)** 을 표준으로 채택 권장:

```markdown
# Autoflow Order

## Order

- ID: order_NNN
- Title: <짧은 제목>
- Status: inbox
- Priority: critical | high | normal | low   ← order_138 와 정합
- Created At: <ISO timestamp>
- Source: <claude-code /order | autoflow order create | ...>

## Request

<원 요청 본문>

## Scope (hint)

<선택>

## Allowed Paths (hint)

<선택>

## Verification (hint)

<선택>

## Notes

<선택>
```

이유:
- 이미 다수 inbox order 가 CLI 형식 사용 중. 이미 Plan AI 가 이 구조를 기반으로 파싱 (`Order` 섹션 의 `Status:`, `Priority:` 등).
- 데스크톱 미리보기에서 markdown 헤더가 깔끔하게 렌더링.
- yaml frontmatter 는 데스크톱 렌더러가 별도 처리 안 하면 raw 표시되어 가독성 저해.

### 2. CLI 의 `## Request` 중복 제거
- `packages/cli/order-project.sh` 가 인자로 받은 본문에 이미 `## Request` 헤더가 있으면 그대로 사용. 없으면 추가.
- 또는 항상 본문 인자를 `## Request` 섹션 **안의 텍스트만** 받는다는 contract 으로 통일하고, 헤더 자체는 CLI 만 출력.
- 권장: contract 명확화 — CLI 는 헤더 + 메타 섹션 출력 책임, 본문 인자는 "Request 섹션의 본문" 만 받음.

### 3. Claude/Codex 스킬 가이드 갱신
- `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/{claude,codex}/skills/order/SKILL.md`:
  - 직접 Write 시에도 표준 형식을 따라야 한다고 명시.
  - 가능하면 `autoflow order create` CLI 를 우선 사용하도록 가이드 (현재도 그런 권장 있음, 보강).
  - frontmatter `---` 형식 사용 금지 또는 deprecated 명시.

### 4. 기존 inbox 의 frontmatter 형식 backfill (선택)
- 현재 인박스에 `---` frontmatter 형식의 order 가 다수 (135, 136, 137, 138, 139). 이들을 표준 형식으로 변환:
  - 변환 헬퍼 스크립트 또는 일회성 마이그레이션 (CLI `autoflow order normalize` 신설 후보).
  - 위험: planner 가 이미 처리 중인 order 변경 시 충돌. 안전한 timing: planner 가 idle 일 때만.
- 권장: 본 order 는 신규 작성 표준화에 집중. backfill 은 별도 후속.

### 5. 데스크톱 렌더링 보정 (보조)
- `apps/desktop/src/renderer/main.tsx` 의 markdown 미리보기가 yaml frontmatter `---` 블록을 인식하면 메타데이터로 흡수 (제목/날짜로 표시) 하거나 명시적으로 숨김.
- 표준 형식이 적용되면 frontmatter 자체가 사라져 이 보정이 중요도 낮아짐. fallback 차원.

## Allowed Paths (hint)

- `packages/cli/order-project.sh` (헤더 + Request 중복 제거 + Priority 필드 — order_138 와 통합 가능)
- `.claude/skills/order/SKILL.md`
- `.codex/skills/order/SKILL.md`
- `integrations/claude/skills/order/SKILL.md`
- `integrations/codex/skills/order/SKILL.md`
- (선택) `apps/desktop/src/renderer/main.tsx` (frontmatter 흡수)
- (별도 후속) backfill 마이그레이션 스크립트

## Verification (hint)

- `bash bin/autoflow order create "$PWD" .autoflow --title "test" --priority normal` 실행:
  - 생성 파일이 `# Autoflow Order` + `## Order` bullet + `## Request` 1회만 포함.
  - `## Request` 섹션이 중복되지 않음.
- `bash bin/autoflow order create ... --request "## Request 이미 포함된 본문"` 같은 입력에 대한 동작 정의 (헤더 1회만 보장).
- Claude 가 `/order` 트리거 시 작성한 신규 order 가 `# Autoflow Order` 형식 따르는지 (스킬 가이드 적용).
- 데스크톱 미리보기:
  - 신규 order 의 markdown 미리보기가 yaml frontmatter `---` 노출 없이 깔끔하게 표시.
  - `## Request` 1회만 표시.
- `grep -l "^---$" .autoflow/tickets/inbox/order_*.md` 결과가 신규 작성분에서 0건 (기존은 backfill 후속).
- `npm run desktop:check` 통과.

## Notes

- **연관:**
  - order_138 (priority 필드 추가) — 본 order 와 같은 PRD 로 묶일 수 있음. 둘 다 order 작성 표준화 영역. Plan AI 가 통합 결정.
  - order_137 (priority 정렬 메커니즘) — 정렬 헬퍼가 표준 형식의 `Priority:` 필드를 안정적으로 파싱하려면 본 order 의 형식 통일이 선행되면 좋음.
  - order_139 (자원 고갈 방어) — 별건. 독립.
  - order_135 (check_NNN.md) — 같은 표준 형식을 따라야 보드 전체 정합 (check 파일에도 frontmatter 대신 헤더 형식 권장).
- **위험:**
  - 기존 frontmatter 형식 order 들이 표준 변경 후에도 Plan AI 에 정상 인식되어야 함 (parser 가 두 형식 모두 fallback 인식하도록 일정 기간 유지).
  - CLI 의 `## Request` 중복 제거가 기존 호출자 (자동화) 에 영향 줄 수 있음 — contract 변경 명시.
- **out of scope:**
  - 기존 inbox order 일괄 backfill — 별도 후속 (`autoflow order normalize` 신설 검토).
  - PRD/ticket/check 파일의 형식 통일 — 같은 원칙 적용 가능하지만 별도 PRD 권장.
- **1원칙 정합:**
  - 형식 통일은 자율 흐름의 안정성 향상 (parser 일관성). fail-safe (두 형식 모두 인식 fallback) 유지하면 위험 없음.
