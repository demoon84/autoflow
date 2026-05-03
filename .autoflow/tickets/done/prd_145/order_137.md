---
title: order/PRD/todo/verify 4 영역 모두 우선순위 처리 메커니즘 도입
created_at: 2026-05-03
source: claude-code /order
---

## Request

현재 모든 영역(인박스 order, backlog PRD, todo ticket, verify) 가 파일 번호 오름차순으로만 처리됨. 긴급 이슈(🚨 fork-bomb, 🚨 IPC leak 등) 가 늦게 들어오면 이미 큐에 있던 일반 작업들이 모두 끝난 다음에야 처리되어 1원칙(멈추지 않음) 자율 흐름이 호스트 자원 위협 같은 critical 이슈에 의해 오히려 위험해짐. 4 영역 모두에 우선순위 처리 메커니즘이 도입되어야 함.

## 검토 결과 — 현재 정렬 메커니즘

| 영역 | 선택 함수 | 정렬 기준 |
|---|---|---|
| 인박스 order | `start-plan.sh:200` `select_inbox_order` → `list_matching_files` | 파일명 오름차순 (작은 번호 우선) |
| backlog PRD | `start-plan.sh` 안 PRD selection | 파일명 오름차순 |
| todo ticket | `start-ticket-owner.sh:596` `lowest_matching_file` | 파일명 오름차순 (가장 낮은 번호) |
| verify | `start-verifier.sh` (역시 lowest) | 파일명 오름차순 |
| 핵심 함수 | `.autoflow/scripts/common.sh:1097` `list_matching_files` → `find ... \| sort` | BSD/GNU sort 기본 |

→ 모든 영역이 같은 `list_matching_files` / `lowest_matching_file` 헬퍼를 통해 정렬. **단일 지점 보강으로 4 영역 일관 적용 가능**.

**현 인박스 예시 (사용자 스크린샷):**
- order_132 (IPC timeout) → order_133 (lock) → order_134 🚨 (bash leak) → order_135 (자동 개입 메뉴) → order_136 🚨 (fork-bomb)
- order_134 / 136 이 critical 인데 1·4·5번째에 처리됨

## Scope (hint) — 권장 설계

### 1. 우선순위 표기 메커니즘
파일 본문에 `priority` 정보 추가. 두 source 병행:

#### A. 명시적 frontmatter / 섹션 필드
```yaml
---
title: ...
priority: critical  # critical | high | normal | low  (default: normal)
---
```
또는 본문의 parser 가 인식하는 섹션 필드:
```markdown
## Order
- ID: order_NNN
- Priority: critical
```
- `critical`: 1원칙 흐름 자체를 위협하는 이슈 (호스트 자원, 보드 정합성, 보안)
- `high`: 다른 작업 진행을 막는 blocker
- `normal`: 기본 (생략 시 적용)
- `low`: 코스메틱, 문서, optional 개선

#### B. 자동 인식 (보조)
파일 title 또는 첫 줄에 다음 marker 가 있으면 priority 승격:
- `🚨` 또는 `[CRITICAL]` → critical
- `⚠️` 또는 `[HIGH]` → high
- 명시적 frontmatter 가 있으면 그게 우선

### 2. 정렬 헬퍼 보강 (단일 지점)
`.autoflow/scripts/common.sh:1097` `list_matching_files` 와 `:1105` `lowest_matching_file` 를 다음으로 변경:

```bash
list_matching_files() {
  local dir="$1"
  local pattern="$2"

  [ -d "$dir" ] || return 0
  # 정렬 기준: priority_rank ASC, 파일번호 ASC
  # priority_rank: critical=0, high=1, normal=2, low=3
  find "$dir" -maxdepth 1 -type f -name "$pattern" \
    | while read -r f; do
        rank="$(extract_priority_rank "$f")"
        printf '%d\t%s\n' "$rank" "$f"
      done \
    | sort -k1,1n -k2,2 \
    | cut -f2-
}
```

`extract_priority_rank` 헬퍼는 frontmatter / 섹션 필드 / emoji marker 순으로 검사:
1. yaml frontmatter `priority:` 값 → critical=0, high=1, normal=2, low=3
2. 본문 `- Priority:` 또는 `Priority:` 섹션 필드 → 동일 매핑
3. title 첫 줄에 `🚨` / `[CRITICAL]` → 0, `⚠️` / `[HIGH]` → 1
4. 매칭 실패 → normal=2

### 3. 4 영역 일관 적용
같은 헬퍼를 쓰는 모든 호출지가 자동으로 우선순위를 받음:
- 인박스 order (`start-plan.sh:select_inbox_order`)
- backlog PRD selection
- todo ticket claim (`start-ticket-owner.sh`)
- verify (`start-verifier.sh`)

추가 작업 거의 없음 — 단일 지점 변경이 전 영역에 전파.

### 4. 가시성 (데스크톱)
- `apps/desktop/src/renderer/main.tsx` 의 카드/뱃지에 priority 시각화:
  - critical: 빨간 점/뱃지 + 카드 테두리 강조
  - high: 노란 점/뱃지
  - normal/low: 일반 표시
- `parsePriority(content)` 헬퍼 신설 → ticket workspace / 인박스 핀 레이어 / todo 카드 모두 적용
- 정렬: 데스크톱 측에서도 같은 priority 우선 정렬 (파일명 정렬은 fallback)

### 5. 정책 보강
- `.autoflow/agents/plan-to-ticket-agent.md`: priority 필드 정의 + 정렬 정책 명시
- `.autoflow/agents/ticket-owner-agent.md`: claim 시 priority 우선 명시
- `.autoflow/agents/verifier-agent.md`: verify 시 priority 우선 명시
- `AGENTS.md`: priority 표기 가이드 (`order` 스킬 작성 시 critical 이면 frontmatter 명시 또는 🚨 marker)
- `.claude/skills/order/SKILL.md` / `.codex/skills/order/SKILL.md` / `integrations/`: `/order` 트리거 시 사용자 발화에 "긴급/critical/🚨" 같은 표현이 있으면 자동으로 frontmatter `priority: critical` 추가하는 가이드

### 6. 1원칙(멈추지 않음) 정합
- 우선순위 정렬은 자율 흐름을 막지 않음. critical 이 처리되면 다음 high → normal → low 자연 흐름.
- starvation 방지: 같은 priority 내에서는 여전히 번호 오름차순 (FIFO 보장).
- 만약 critical 이 무한 폭증하면 대응: critical 처리 후 일정 normal 작업 보장하는 fairness 정책은 후속 PRD (본 order 는 단순 priority 정렬까지).

## Allowed Paths (hint)

- `.autoflow/scripts/common.sh` (`list_matching_files`, `lowest_matching_file`, `extract_priority_rank` 신설)
- `.autoflow/scripts/start-plan.sh` (priority 인지 확인, 필요 시 변경 없음 — 헬퍼 단일 지점)
- `.autoflow/scripts/start-ticket-owner.sh` (동상)
- `.autoflow/scripts/start-verifier.sh` (동상)
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/verifier-agent.md`
- `AGENTS.md`
- `apps/desktop/src/renderer/main.tsx` (priority 시각화 + 정렬)
- `apps/desktop/src/renderer/styles.css` (priority 뱃지 스타일)
- `.claude/skills/order/SKILL.md`, `.codex/skills/order/SKILL.md`, `integrations/{claude,codex}/skills/order/SKILL.md` (트리거 시 priority 자동 추가 가이드)

## Verification (hint)

- `npm run desktop:check` 통과.
- 단위 검증 (BSD bash):
  - `extract_priority_rank` 가 frontmatter `priority: critical` → 0, `priority: high` → 1, 미지정 → 2, `priority: low` → 3 반환.
  - title 의 🚨 marker 인식.
- 통합 검증 (현재 인박스 시뮬레이션):
  - order_134, 136 frontmatter 에 `priority: critical` 추가 (또는 title 의 🚨 자동 인식).
  - planner tick 1회 → 다음 promote 대상이 order_134 또는 136 인지 확인 (132/133/135 보다 먼저).
  - 처리 후 다음 tick 에서 132/133/135 (normal) 가 번호 순으로 promote.
- 4 영역 회귀:
  - 인박스 order: 위 시나리오.
  - backlog PRD: 더미 PRD 두 개에 priority 다르게 부여 후 plan tick 순서 확인.
  - todo ticket: 더미 tickets 에 priority 부여 후 worker claim 순서 확인.
  - verify: 더미 verify 큐에 priority 부여 후 verifier 처리 순서 확인.
- 데스크톱:
  - 인박스 핀 레이어 / 티켓 카드에 critical/high priority 뱃지 시각화.
  - 정렬 결과가 화면에서도 priority 우선으로 표시.
- starvation:
  - critical 만 계속 들어와도 같은 priority 내 FIFO (번호 오름차순) 가 유지되는지 확인.

## Notes

- **위험:**
  - 우선순위 잘못 부여 → 일반 작업 무한 지연. 가이드에 "critical 은 1원칙 흐름 자체를 위협하는 이슈만" 명시.
  - frontmatter 파싱 실패 → 모두 normal 로 fallback (fail-safe). starvation 위험 없음.
  - emoji marker 자동 인식이 false-positive (title 안에 🚨 가 인용 등으로 들어감) 일 가능성 — 명시적 frontmatter 가 있으면 그게 우선 정책으로 안전.
- **연관:**
  - order_134 (bash leak), order_136 (fork-bomb) 가 본 메커니즘으로 우선 처리 대상.
  - order_135 (자동 개입 check 메뉴) 와 독립.
  - PRD-129 (토큰 집계) 와 독립.
- **out of scope (별도 후속):**
  - critical 폭증 시 fairness 보장 (예: 5건 critical 후 1건 normal 보장) — 후속 PRD.
  - priority 변경 audit (누가 언제 어떤 priority 로 변경) — 후속.
  - 데스크톱에서 사람이 직접 priority 토글 UI — 본 order 는 read-only 시각화까지.
- **1원칙 정합:**
  - 우선순위 정렬은 자율 흐름의 효율성을 높임 (critical 빨리 처리 → 1원칙 흐름 자체의 안정성 향상).
  - 헬퍼 변경은 fail-safe (priority 추출 실패 시 normal) 라 자율 흐름을 막지 않음.
