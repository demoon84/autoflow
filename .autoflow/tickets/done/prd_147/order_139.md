---
title: 🚨 자원 고갈 / DOS 방어 — PID fan-out cap, 토큰 budget, rate limit, anomaly detection
priority: critical
created_at: 2026-05-03
source: claude-code /order
---

## Request

🚨 critical — Autoflow 자율 흐름이 다음 자원 고갈 시나리오에 노출되어 있어 방어 메커니즘 필요:

1. **PID 무한 증식 (fork-bomb)** — order_134 (bash leak ~1500), order_136 (listRunners IPC fork-bomb 2312 instance) 로 이미 실측됨. 코드 버그 또는 retry loop 가 호스트 자원 소진까지 폭증 가능.
2. **토큰 비정상 소비** — runner / 어댑터 / 인박스 prompt injection 등으로 LLM 호출이 비정상 빈도/크기로 발생해 비용 폭탄 + provider rate limit hit.
3. **악의적/실수 prompt injection** — 인박스 order 또는 PRD 본문이 "do X N times" 같은 지시를 포함해 자율 흐름이 무한 작업 생성.

1원칙(멈추지 않음) 자율 흐름이 "멈추지 않는다" 는 약속을 지키려면 자기 자신과 호스트 자원을 보호하는 가드가 필수.

## 위협 모델

| 위협 카테고리 | 사례 | 영향 |
|---|---|---|
| **A. 내부 코드 버그로 spawn 폭증** | order_134/136 의 listRunners fork-bomb | 호스트 process table 고갈, IDE git fork 실패 |
| **B. retry loop 로 LLM 호출 폭증** | IPC timeout → renderer retry → adapter retry → ... | 토큰 비용 폭탄, provider rate limit, quota 소진 |
| **C. 인박스 prompt injection** | 외부에서 PR / 협업자 / 자동화 가 인박스에 악성 order 삽입 ("create 1000 PRDs", "spawn 100 workers") | 무한 PRD/ticket 생성, 무한 LLM 호출 |
| **D. 어댑터 / 의존성 변조** | gemini/codex/claude CLI 또는 npm 패키지가 변조되어 비정상 호출 | 토큰 폭탄, 데이터 유출 |
| **E. 공유 호스트 multi-tenant** | 동일 머신에 다른 사용자/프로세스 공존 시 Autoflow 가 호스트 자원 독점 | 인접 사용자 영향, 신뢰 손상 |

## Scope (hint) — 다층 방어

### 1. PID / process fan-out cap (위협 A 대응)
- **runner 단위 자식 process 수 cap**:
  - `apps/desktop/src/main.js` 가 자기 자식 process 수 모니터링 (e.g., `ps --ppid $$ | wc -l`).
  - 임계값 (예: 200) 초과 시 새 IPC spawn reject + UI 경고 표시 + 자동 cleanup (오래된 자식 SIGKILL).
- **CLI 단위 fan-out 가드**:
  - `packages/cli/runners-project.sh`, `metrics-project.sh` 등이 다른 CLI 를 spawn 하기 전 환경변수 카운터 (`AUTOFLOW_FANOUT_DEPTH`) 검사. depth ≥ N 시 거부.
- **timeout 시 child 강제 cleanup**:
  - `withTimeout` wrapper 가 timeout 시 SIGTERM → 1s 후 SIGKILL 까지 자식 process 책임. 현재는 promise reject 만 하고 자식이 alive 로 leak (order_136 의 직접 원인).
- **inflight Promise dedup**:
  - 같은 IPC handler 가 inflight 인 동안 새 호출은 동일 Promise 반환. retry 가 spawn 폭증으로 이어지지 않도록.

### 2. 토큰 budget / rate limit (위협 B, D 대응)
- **시간/일 단위 토큰 quota**:
  - `.autoflow/runners/config.toml` 또는 별도 `.autoflow/policies/budget.toml` 에 runner 별 일 quota 정의 (예: planner 5M tokens/일, worker 10M, verifier 2M, wiki 500K).
  - `packages/cli/run-role.sh` 가 telemetry-runs.jsonl (PRD-129 정합 후) 의 누계와 quota 비교. 초과 시 runner halt + state `last_result=token_budget_exceeded` + 데스크톱 경고.
- **호출 간 minimum interval**:
  - runner mode=loop 의 `interval_seconds` 외에 LLM 호출당 최소 간격 강제 (e.g., adapter 호출 사이 5s sleep).
  - retry backoff: 같은 작업 N회 실패 시 exponential backoff (5s → 30s → 5min → halt).
- **호출당 input/output 크기 cap**:
  - 어댑터 호출 시 prompt byte cap (이미 wiki 는 `AUTOFLOW_WIKI_INGEST_PROMPT_BYTES=16384` 적용). planner/worker/verifier 도 동일 정책 도입.
  - 응답 크기 cap (LLM 이 비정상적으로 긴 응답 생성 시 truncate + log).

### 3. Anomaly detection / circuit breaker (위협 A, B, D 대응)
- **baseline 학습 + 편차 감지**:
  - `.autoflow/metrics/` 의 누계로 평소 호출 빈도 / 토큰 / spawn 수 baseline 계산.
  - 단기간(예: 5분) 평균이 baseline × 5 초과 시 anomaly 판정 → runner 자동 halt + 데스크톱 경고 + check_NNN.md 생성 (order_135 정합).
- **circuit breaker**:
  - 연속 N회 timeout / N회 token cap 초과 / N회 verify fail 시 해당 runner 자동 halt. 사람 확인 전까지 재시작 안 됨 (state `last_result=circuit_breaker_tripped`).

### 4. Prompt injection 방어 (위협 C 대응)
- **인박스 order 입력 sanitize**:
  - `/order` 스킬 / `autoflow order create` 가 본문에 다음 패턴 포함 시 경고 + 생성 거부 또는 사람 확인 요구:
    - "do X N times" / "create N PRDs" / "spawn N workers" / "infinite loop" / "without asking"
    - 거대 본문 (>50KB) — 정상 order 는 작아야 함
    - 인코딩된 명령 (base64, hex) 감지
- **Plan AI prompt 내 source 격리**:
  - 인박스 본문은 `<order_content>` 같은 명시 태그로 감싸 Plan AI 가 instruction 으로 오인하지 않도록 (이미 일부 적용 가능성, 점검).
- **PRD/ticket 자동 생성 cap**:
  - planner tick 당 최대 N개 PRD/ticket 생성 (예: 5). 초과 시 다음 tick 으로 분산. 무한 폭증 방지.

### 5. 외부 모니터링 / kill switch (위협 E 대응)
- **emergency stop 명령**:
  - `autoflow halt --all` 즉시 모든 runner 강제 종료 + 새 spawn 거부.
  - 데스크톱 UI 에 "긴급 중지" 버튼 (사이드바 footer 또는 별도 alert 영역).
- **외부 watchdog**:
  - 별도 lightweight 프로세스 (또는 systemd / launchd timer) 가 Autoflow 의 자원 사용량 (CPU/MEM/PID/network) 모니터링. 임계 초과 시 강제 halt 시그널.
- **알림 hook**:
  - `.autoflow/scripts/run-hook.sh` 의 anomaly 발생 시 hook (e.g., Slack/이메일/desktop notification) — 사람이 즉시 인지.

### 6. 정책 / 문서 보강
- `AGENTS.md` rule 신설:
  - "자원 cap 초과 / anomaly 감지 시 1원칙(멈추지 않음) 보다 자기 보호 우선" — 1원칙 예외 정책 명시.
  - 모든 runner / adapter 호출은 timeout + cleanup 책임 명시.
- `.autoflow/policies/budget.toml` (신설): 토큰 quota / process cap / rate limit 정책 source-of-truth.
- `.autoflow/agents/*.md`: 각 runner agent 가 자기 budget 인지 + 초과 시 halt 정책.

## Allowed Paths (hint)

- `apps/desktop/src/main.js` (process cap, inflight dedup, withTimeout cleanup)
- `apps/desktop/src/renderer/main.tsx` (긴급 중지 버튼, anomaly 경고 표시)
- `packages/cli/run-role.sh` (token budget 검사, retry backoff, fan-out depth)
- `packages/cli/runners-project.sh` (자기-호출 루프 방어)
- `packages/cli/metrics-project.sh` (baseline 계산, anomaly detection)
- `packages/cli/cli-common.sh` (`withTimeout`, `run_with_timeout` 의 child cleanup 책임)
- `.autoflow/scripts/start-plan.sh`, `start-ticket-owner.sh`, `start-verifier.sh` (각자 budget/circuit breaker 적용)
- `.autoflow/scripts/run-hook.sh` (anomaly 알림 hook)
- `.autoflow/scripts/common.sh` (공통 가드 헬퍼)
- `.autoflow/policies/budget.toml` (신설)
- `AGENTS.md` (1원칙 예외 정책 명시)
- `.autoflow/agents/*.md` (각 agent 가 자기 budget 인지)
- `.claude/skills/order/SKILL.md` 등 (`/order` prompt injection 방어)
- `bin/autoflow` (`autoflow halt --all` 명령 추가)

## Verification (hint)

- **PID cap**:
  - 인위적 시뮬레이션: `for i in {1..500}; do bash bin/autoflow runners list ... & done` → main.js cap 200 적용으로 reject 되는지.
  - timeout 후 spawned bash 가 모두 SIGKILL 되는지 (`ps -ef | grep -c "runners-project.sh list"` 가 호출 종료 후 0 인지).
- **Token budget**:
  - planner quota 1000 tokens 로 임시 설정 → 호출 1회로 quota 초과 → runner halt + state `last_result=token_budget_exceeded` + 데스크톱 경고 표시.
- **Anomaly detection**:
  - baseline 대비 5x spawn 인위적 발생 → anomaly 판정 + check_NNN.md 자동 생성 (order_135 정합) + runner halt.
- **Circuit breaker**:
  - 연속 5회 timeout 시뮬레이션 → 해당 runner 자동 halt + state `circuit_breaker_tripped`.
- **Prompt injection**:
  - "create 1000 PRDs" 본문 order 작성 시도 → CLI 거부 + stderr 경고.
  - 거대 본문 (>50KB) → 거부.
- **Emergency stop**:
  - `autoflow halt --all` 호출 → 모든 runner 즉시 종료 + 새 spawn 거부 (`new_spawn_blocked` state).
  - 데스크톱 "긴급 중지" 버튼 동일 효과.
- **회귀**:
  - 정상 작업 (적정 빈도, 적정 토큰) 은 영향 없는지.
  - 1원칙 자율 흐름이 cap/budget 미초과 상황에서 평소처럼 동작.
- `npm run desktop:check` 통과.

## Notes

- **위험:**
  - 너무 보수적 cap → 정상 작업도 막힘. baseline 학습 후 점진 적용 권장.
  - circuit breaker false-positive → 사람 확인 전까지 멈춤. anomaly 판정 정확성 중요.
  - emergency stop 은 자율 흐름 정지 = 1원칙 위배지만 1원칙 보다 자기 보호 우선이라는 명시적 예외 정책 필요.
- **연관:**
  - order_134 (bash leak 사례), order_136 (fork-bomb 사례) — 본 order 가 근본 방어책.
  - order_135 (check_NNN.md) — anomaly 시 자동으로 check 파일 생성 통합.
  - order_137 / 138 (priority) — 본 order 의 priority=critical 이 자기 자신을 우선 처리하도록.
  - PRD-129 (토큰 집계) — token budget 정확성 의존. PRD-129 머지 후 budget 정책 의미 있음.
- **out of scope (별도 후속):**
  - 외부 watchdog 프로세스 (systemd/launchd) 의 정식 도입 — 본 order 는 in-process 가드 위주, watchdog 은 별도 PRD.
  - 분산 환경 / multi-host 정책 — 단일 호스트 가정.
  - 보안 audit 로그 (누가 언제 어떤 정책 변경) — 후속 PRD.
- **1원칙 정합 (예외 명시):**
  - 자율 흐름은 멈추지 않는다 → 그러나 호스트 자원 위협 / 토큰 폭탄 / 비정상 패턴 시 **자기 보호 우선**.
  - cap/budget/anomaly 발동 시 정상 종료 (state 기록 + check 파일 + 사람 알림) → 사람이 정책 조정 후 재개.
  - 이 예외는 자율 흐름의 장기 지속성을 보장하기 위한 필수 가드 (단기 멈춤 < 장기 안정).

## 우선순위

본 order 는 `priority: critical`. order_137 의 priority 정렬 메커니즘이 적용된 후 본 order 가 다음 자율 흐름에서 우선 처리되어 호스트 자원 안정성을 즉시 확보해야 함. order_137/138 (priority 메커니즘 자체) 가 선행되어야 본 order 의 critical 표기가 실제 우선 처리로 이어짐 — 강결합.
