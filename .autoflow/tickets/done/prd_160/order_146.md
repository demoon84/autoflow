---
title: Hermes 자가학습 패턴 도입 — Skill auto-extraction + RAG 기반 자동 활용 closed loop
priority: high
created_at: 2026-05-03
source: claude-code /order
---

## Request

Hermes agent 의 자가 학습 루프 패턴을 Autoflow 에 접목:
- 복잡한 문제 해결 후 그 과정/패턴을 **skill** 로 자동 문서화
- 다음에 유사한 작업이 들어오면 자동으로 해당 skill 을 prompt 에 주입해 학습 효과
- 누적될수록 빠르고 정확하고 토큰 효율적 (compounding)

## Autoflow 현황 비교 — 부분적으로 비슷한 자산이 이미 있음

| 영역 | 현재 메커니즘 | Hermes 패턴과 차이 |
|---|---|---|
| `.autoflow/wiki/learnings/` (4건) | 사람 수동 작성, 검색 기반 활용 | 자동 추출 / 자동 활용 (closed loop) 부재 |
| `.autoflow/wiki/answers/` (~30건) | Wiki AI 가 query 응답 작성 | trigger 가 사용자 query 한정. PRD 완료/reject 회복 같은 자율 흐름 trigger 없음 |
| `.autoflow/wiki/decisions/` | 사람 의사결정 기록 | 정적 |
| `.autoflow/wiki/features/` | feature 설명 (사람 + Wiki AI) | 정적 |

→ **자동 추출 + 자동 활용의 closed loop** 가 약함. learnings 는 적은 인스턴스(4건), answers 는 자율 흐름 trigger 부재.

## 제안 — Hermes 자가학습 루프 도입

### 1. Skill auto-extraction trigger
Worker / Verifier / Planner 가 **고가치 이벤트** 후 자동으로 skill markdown 추출:

| Trigger | 학습 가치 | 추출 책임 |
|---|---|---|
| **PRD 완료 + verify pass** (성공 패턴) | 중 | worker (finish-ticket-owner.sh 단계) |
| **Reject → auto-replan 후 성공** (turnaround 패턴) | 높음 | planner (auto-replan 성공 시) |
| **Blocked → 사람 개입 → 풀림** (희귀 회복 패턴) | **최고** (가장 가치) | planner (blocked 해소 시) |
| **자동 개입 (orchestration cleanup)** | 중 | planner (order_135 의 check 와 통합) |

### 2. Skill 저장 위치
`.autoflow/wiki/skills/skill_NNN.md` (wiki 카테고리 신설)

```markdown
---
title: <패턴 한 줄 요약>
pattern_type: <ticket_completion | reject_turnaround | blocked_recovery | orchestration_cleanup>
applies_to:
  - module: <apps/desktop/src/renderer | packages/cli | ...>
  - keywords: <list>
  - PRD title pattern: <regex 또는 keywords>
success_count: 0
last_used_at: <ISO>
created_from:
  prd: PRD_NNN
  ticket: ticket_NNN
created_at: <ISO>
---

## Trigger
- 어떤 상황에서 이 skill 이 매칭되어야 하는지

## Recommended Procedure
- 단계별 절차 (간결, 5~10 step)

## Pitfalls
- 회피해야 할 함정

## Verification Pattern
- 성공 검증 방법

## Source Evidence
- 원 PRD/ticket/verify 본문 발췌 또는 ref
```

### 3. Skill 활용 (RAG injection)

**Planner / Worker 가 새 작업 받을 때:**
1. 입력 (PRD title / order body / ticket scope) 에서 keywords 추출
2. `wiki/skills/` 에서 매칭 (keyword 점수 + path overlap + pattern_type)
3. 매칭된 skill 본문 (top-N, 기본 N=2) 을 prompt 의 system 영역 또는 별도 `<learned_skill>` 태그로 주입
4. LLM 응답에서 `skill_used: skill_NNN` marker 노출 (활용 추적)

**활용 후 피드백:**
- 결과가 verify pass → 해당 skill 의 `success_count++`, `last_used_at` 갱신
- 결과가 fail/reject → `failure_count++` 누적, threshold 도달 시 priority 하향
- 90일 미사용 + low success → archive 후보

### 4. Skill 품질 관리
- **Auto-archive**: `last_used_at > 90일 && success_count == 0` → `wiki/skills/archive/` 이동
- **Promote**: `success_count >= 5 && success_rate >= 80%` → priority 상향, 매칭 가중치 ↑
- **Conflict resolution**: 같은 trigger 매칭 skill 이 여러 개면 success_rate 우선 → 동률 시 최근 last_used_at

### 5. 토큰 절감 시너지 (PRD 152~159 와 결합)
- skill 주입은 **PRD-158 (prompt caching)** 과 시너지 — skill 본문이 stable prefix 라 cache hit
- skill 적용 시 LLM 이 처음부터 결정 안 해도 되니 **PRD-157 (reasoning 동적)** 의 dispatch 가 simple 로 가도 OK
- skill 매칭 신뢰도 매우 높은 케이스는 LLM 호출 없이 deterministic 처리 (장기 후속)

### 6. 데스크톱 노출
- 사이드바 메뉴에 "**스킬**" 항목 추가 (LLM 위키 메뉴 아래 또는 그 안 카테고리)
- skill 목록 + 매칭 통계 (success rate / last used / 사용 횟수)
- 사람이 직접 skill 본문 편집 가능 (수동 보강)
- 사람이 "이 skill 비활성화" 토글 (false-positive 차단)

## Scope (hint) — Phase 분리

### Phase 1 — 기본 인프라 (이 order 의 핵심)
- `.autoflow/wiki/skills/` 디렉터리 신설 + README + 파일 템플릿 + skill_NNN.md sequence
- `packages/cli/skill-project.sh` (신설) 또는 `packages/cli/wiki-project.sh` 확장:
  - `autoflow skill create --from-ticket <ticket_NNN>` — ticket 본문에서 패턴 추출 + skill 생성
  - `autoflow skill match --keywords ...` — 매칭 검색
  - `autoflow skill update-stats <skill_NNN> --result pass|fail` — 활용 후 stats
- `.autoflow/scripts/finish-ticket-owner.sh` 가 PRD 완료 시 skill auto-extraction 호출 (pattern_type=ticket_completion).

### Phase 2 — 자율 흐름 통합 (후속 PRD)
- planner 의 auto-replan / blocked-recovery 후 skill auto-extraction.
- planner / worker prompt 생성 시 skill RAG injection.
- skill 활용 결과 자동 stats 업데이트 (verify 결과 hook).

### Phase 3 — 데스크톱 UI (후속 PRD)
- 사이드바 "스킬" 메뉴 + 목록/통계 화면.
- 사람 수동 편집 / 비활성화 토글.

본 order 는 **Phase 1** 에 집중. Phase 2, 3 은 후속 PRD 권장.

## Allowed Paths (hint)

- `.autoflow/wiki/skills/` (신규 폴더 + .gitkeep + README + 템플릿)
- `packages/cli/skill-project.sh` (신설) 또는 `packages/cli/wiki-project.sh` 확장
- `bin/autoflow` (subcommand dispatch)
- `.autoflow/scripts/finish-ticket-owner.sh` (Phase 1 의 단순 trigger)
- `.autoflow/agents/ticket-owner-agent.md` (정책)
- `AGENTS.md` (skill 카테고리 명시)

## Verification (hint)

- `bash bin/autoflow skill create "$PWD" .autoflow --from-ticket tickets_NNN` 호출 → `.autoflow/wiki/skills/skill_NNN.md` 생성, frontmatter / 본문 형식 정상.
- `bash bin/autoflow skill match "$PWD" .autoflow --keywords "desktop sidebar"` 호출 → 매칭되는 skill 목록 + 점수.
- PRD 완료 시 자동 호출 (Phase 1 trigger) 후 skill 1건 생성 확인.
- 7일 운영 후 skills/ 누적 개수 + 평균 success_count 측정.
- `npm run desktop:check` 통과.

## Notes

- **연관:**
  - PRD-158 (prompt caching) — skill prefix caching 시너지.
  - PRD-157 (reasoning 동적) — skill 매칭 신뢰도 높을 때 reasoning low.
  - order_135 (check_NNN.md 자동 개입 이력) — 동일한 markdown 누적 + 사람 사후 확인 패턴.
  - PRD-129 (토큰 집계) — skill 적용 효과 측정 source.
- **위험:**
  - skill 자동 추출이 노이즈 (의미 없는 패턴) 를 누적하면 search precision 저하 → 추출 시 신호 강도(blocked recovery > reject turnaround > ticket completion) 우선.
  - skill 매칭 false-positive → 잘못된 절차 주입 → 결과 품질 저하. 매칭 점수 임계값 + activation 후 결과 모니터링 필수.
  - skill 무한 누적 → archive 정책 + cap (예: 활성 skill 100개 한도).
- **1원칙 정합:**
  - skill 자동 활용 실패해도 자율 흐름은 진행 (skill 없이 LLM 호출 fallback).
  - skill 추출 실패도 fail-safe (best-effort, 실패 시 skip).
- **현재 자산과의 관계:**
  - learnings/ — 사람 lessons → skill 의 source 로 manual import 가능 (4건 backfill 권장)
  - answers/ — Wiki AI query 답변 → 별개 (skill 은 절차/실행 패턴, answer 는 query 응답)
  - decisions/ — 의사결정 history → skill 은 decision 의 적용 결과 패턴
- **검토 필요 사항 (Plan AI 가 PRD 작성 시 결정):**
  - skill auto-archive 90일 정책이 적절한지
  - 사람이 만든 learnings 와 자동 추출 skill 의 위치 통합 vs 분리
  - 매칭 매커니즘 — 단순 keyword vs 의미 기반 (RAG embedding)
  - skill 용량 cap (활성 100개 / 디스크 10MB 등)
- **장기 비전 (Phase 4+):**
  - skill 매칭 신뢰도 매우 높은 deterministic case 는 LLM 호출 없이 직접 실행 → 토큰 0 으로 처리.
  - skill clustering — 비슷한 skill 묶어서 meta-skill 추출.
  - cross-project skill sharing — 같은 호스트의 다른 Autoflow 보드와 skill 공유.

## Hermes 실제 코드 분석 결과 — 추가 mechanism 8가지 (보강)

`~/Documents/lab/hermes-agent/` 코드 직접 분석 후 발견한 mechanism. 본 order 의 Phase 1~3 에 반영 권장:

### 1. 저장소 이중화 (in-repo vs user-local)
- Hermes: `skills/<category>/<name>/SKILL.md` (배포본, ship-with-package) **vs** `~/.hermes/skills/<category>/<name>/SKILL.md` (agent-created, 개인)
- Autoflow 적용:
  - **`.autoflow/wiki/skills/<category>/<name>/SKILL.md`** (배포본/curated, 사람 작성 + 검토)
  - **`.autoflow/wiki/skills-local/<category>/<name>/SKILL.md`** (agent-created, 자동 추출, lifecycle 관리 대상)
  - 분리 이유: agent-created 는 lifecycle 자동 archive, in-repo 는 사람 책임 영구 유지.

### 2. 폴더 단위 skill (단일 .md 가 아님)
- Hermes: 각 skill 이 폴더로 `<name>/SKILL.md` + 부속 파일 (예시 코드, 자산, 인라인 shell snippet 등) 같이 들고 다님.
- Autoflow 적용: 단일 파일 `skill_NNN.md` 보다 **폴더 패턴** 권장 — 복잡한 패턴은 부속 reference (예: 변경 diff snippet, 검증 스크립트) 같이 들고 다닐 수 있음.

### 3. `tools/skill_usage.py` — `.usage.json` sidecar
- Hermes: `~/.hermes/skills/.usage.json` 하나에 모든 skill 의 view_count, last_viewed_at, last_used_at, manage_action_count 추적. Atomic write (tempfile + os.replace). frontmatter 오염 안 함.
- Autoflow 적용: **`.autoflow/wiki/skills-local/.usage.json`** sidecar 신설. 활용 시 자동 bump, 실패해도 silent (best-effort, 통계가 흐름 막지 않음).

### 4. `agent/curator.py` — 자율 lifecycle orchestrator
- Hermes: 7일 주기, idle 2h+ 후에만 fork 된 background AIAgent 가 review.
  - 30일 unused → STATE_STALE
  - 90일 unused → STATE_ARCHIVED (`.archive/` 이동, **삭제 안 함, 복구 가능**)
  - Pinned 은 모든 auto-transition 우회
- **핵심 invariant: "auxiliary client; never touches the main session's prompt cache"** — main session 의 caching 효과 보존.
- Autoflow 적용:
  - **Wiki AI 가 Curator owner** (이미 wiki 영역 책임). 별도 runner 추가 불필요.
  - 7일 주기 + Wiki AI idle 시점에만 review.
  - **별도 어댑터 호출** (PRD-158 caching 보호) — main planner/worker prompt cache 보존.
  - 30일 stale, 90일 archive, 삭제 금지.

### 5. Pinned 보호 + 비활성화 가드
- Hermes: `_pinned_guard` — 사용자가 pin 한 skill 은 절대 자동 변경 안 됨.
- `tools/skills_guard.py` — security scan, validation, blocking.
- Autoflow 적용: skill frontmatter `pinned: true` 시 lifecycle 우회. 데스크톱 UI 에서 "고정" 토글.

### 6. Nudge interval (자기 환기 메커니즘)
- Hermes: `_memory_nudge_interval`, `_skill_nudge_interval` — 일정 turn 마다 agent 가 자기에게 "지금 본 것 skill 화 할만한가?" 자가 self-prompt.
- Curator 는 자기 review 안에서는 nudge 비활성 (재귀 방지).
- Autoflow 적용:
  - planner/worker tick 안에 nudge marker — N tick 마다 또는 PRD 완료 직후에 "skill 추출 가치 있나?" self-prompt.
  - tick 내에 자체 nudge 작동 시 skill_extraction_in_progress flag 로 재귀 방지.

### 7. Validator + Security scan + Size cap
- Hermes:
  - frontmatter validator: `name` ≤64 chars, `description` ≤1024 chars, YAML 파싱 가능.
  - content cap: 100KB (≈36K tokens), file cap: 1MiB.
  - `_security_scan_skill` — 악성 패턴 감지.
- Autoflow 적용:
  - 자동 추출된 skill 도 동일 validator + cap 적용 (남용 방지).
  - 본 적용은 PRD-153 (PROMPT_BYTES cap) / order_139 (자원 방어) 와 정합.

### 8. Template / inline shell + explicit invocation
- Hermes:
  - SKILL.md 본문에 `${HERMES_SKILL_DIR}`, `${HERMES_SESSION_ID}` 템플릿 (preprocessing 시 치환).
  - 인라인 shell ``!`cmd` `` (출력 4000자 cap, runaway 방지).
  - `/skill-name` 슬래시 명령으로 **explicit invocation** (RAG 자동 주입 외에).
- Autoflow 적용:
  - 템플릿 변수: `${AUTOFLOW_BOARD_ROOT}`, `${AUTOFLOW_TICKET_ID}`, `${AUTOFLOW_PRD_KEY}`.
  - 인라인 shell 도입 가치 — 단 보안 가드 강함 (allow-list 명령만, output cap).
  - 데스크톱 UI 또는 CLI 에서 `autoflow skill apply <skill_name> --to-ticket <id>` explicit invocation 모드.

## 보강된 Phase 분리

### Phase 1 (본 order 핵심) — 인프라
- 저장소 분리 (`.autoflow/wiki/skills/` 배포본 + `.autoflow/wiki/skills-local/` 자동)
- 폴더 단위 skill (`<name>/SKILL.md` + 부속 파일)
- `.usage.json` sidecar
- frontmatter validator + content cap
- `autoflow skill create / view / list` CLI

### Phase 2 — Curator + auto-extraction
- Wiki AI Curator (7일 주기, auxiliary client)
- finish-ticket-owner.sh trigger → skill 자동 추출
- planner blocked-recovery / auto-replan trigger → skill 추출
- nudge mechanism (planner/worker self-prompt)

### Phase 3 — RAG injection + 활용
- planner/worker prompt 에 매칭 skill 자동 주입
- explicit invocation (`/autoflow skill apply ...`)
- 활용 결과 자동 stats 업데이트

### Phase 4 — 데스크톱 UI
- 사이드바 "스킬" 메뉴
- 사람 편집 / pin / archive 토글
- 활용 통계 시각

### Phase 5 — 고도화
- security scan
- agentskills.io 호환 (cross-tool 공유)
- skill clustering / meta-skill
- deterministic deterministic 모드 (skill 신뢰도 100% 시 LLM 호출 없이 직접 실행)

## 추가 검토 사항 (Plan AI 가 PRD 작성 시 결정)

- **Wiki AI 가 Curator 책임을 맡을지** vs 별도 새 runner (`curator`) 신설할지 — Wiki AI 가 이미 wiki 영역 책임이라 Wiki AI 가 자연스러움. 단 Wiki AI 의 debounce 정책과 충돌 가능 — Curator 는 7일 주기 별도 cadence.
- **agentskills.io 호환** — Hermes 가 호환 명시. Autoflow 도 호환하면 future cross-tool 공유 가능. 호환 비용 vs 단순성 트레이드오프.
- **Auxiliary client (PRD-158 정합)** — Curator 호출이 main session prompt cache 를 깨지 않게. Anthropic SDK 직호출 시 별도 client instance.
- **인라인 shell 도입 위험** — Hermes 는 인라인 shell 지원하지만 보안 위험 큼. Autoflow 는 1차 도입 시 shell 제외 권장 (skill 본문은 instruction 만, 실행은 worker 가 별도 판단).
