---
title: 오케스트레이터 자동 개입 이력 → check_NNN.md 누적 + 사이드바 "통계" 아래 신규 메뉴/페이지로 노출
created_at: 2026-05-03
source: claude-code /order
---

## Request

Autoflow 1원칙(멈추지 않는다) 으로 오케스트레이터(planner) 가 자동 개입한 사례 — `orchestration cleanup` commit, reject `auto-close` / `auto-replan`, `blocked-auto-recover`, `blocked-dirty-orchestration` 등 — 의 상황을 `.autoflow/tickets/check/check_NNN.md` 파일로 정리 누적하고, 데스크톱 사이드바 "통계" 메뉴 바로 아래 새 메뉴를 신설해 페이지로 사람 사후 확인 가능하게 추가해줘.

## 배경 — 흔적이 분산되어 있어 한 자리에서 못 봄

| Source | 위치 | 사람 확인성 |
|---|---|---|
| `[PRD_NNN][ticket_NNN] orchestration cleanup: ...` commit | git log | 터미널 필요, 데스크톱 미노출 |
| reject 본문 `## Manual Resolution (auto-close)` 섹션 | `done/prd_NNN/reject_*.md` | 본문 열어야 보임, 자동/수동 구분 뱃지 없음 |
| planner state `source=blocked-dirty-orchestration` / `auto-replan` / `blocked-auto-recover` | `runners/state/planner.state` (last value only) | 데스크톱 미노출 |
| auto-replan 후 todo 재진입 reject | `tickets/todo/` (시각 구분 없음) | 일반 todo 와 동일 |

→ 사용자가 통합 페이지에서 "최근 자동 개입 N건" 조회 가능해야 함.

## Scope (hint)

### 1. 데이터 적층 — `.autoflow/tickets/check/check_NNN.md`
- 신규 폴더 `.autoflow/tickets/check/` + `.gitkeep`.
- 번호 별도 sequence (`check_001.md` 부터). 다른 `tickets_NNN`/`prd_NNN`/`order_NNN` 와 충돌 없음.
- 오케스트레이터(planner) 가 자동 개입을 수행한 직후 한 건 작성. 동작 자체는 변경하지 않고 "기록만" 추가.
- 본문 템플릿:
  ```markdown
  ---
  title: <자동 개입 종류 한 줄 요약>
  created_at: <ISO timestamp>
  event_type: <orchestration_cleanup | reject_auto_close | reject_auto_replan | blocked_auto_recover | blocked_dirty_orchestration>
  prd_key: <PRD_NNN>
  ticket_id: <ticket_NNN | reject_NNN>
  source: planner
  ---

  ## What Happened

  - 자동 개입 종류와 발생 사유를 한국어로 요약.

  ## Evidence

  - Commit: `[PRD_NNN][ticket_NNN] orchestration cleanup: ...` (sha: <short>)
  - Reject ref: `tickets/done/prd_NNN/reject_NNN.md` (해당 시)
  - Planner source signal: `source=blocked-dirty-orchestration`
  - Dirty paths / 처리 대상 path 목록 (해당 시)

  ## Recommended Human Action

  - 검토만 → 체크박스 토글 후 그대로 두거나 archive.
  - 정책 조정 필요 → 관련 PRD/order 발행.
  - 회귀/오작동 의심 → 해당 commit revert 검토.

  ## Status

  - [ ] 사람 확인 완료
  ```

### 2. 자동 생성 트리거 위치
- `.autoflow/scripts/start-plan.sh` 또는 `.autoflow/scripts/common.sh` 안에 헬퍼 함수 신설 (예: `record_orchestration_check`).
- 다음 코드 경로에서 호출:
  - blocked-dirty-orchestration 시 dirty path commit 직후
  - reject auto-replan (todo 재진입) 직후
  - reject auto-close (`Manual Resolution (auto-close)` append + done 이동) 직후
  - blocked-auto-recover (blocked → todo) 직후
  - orchestration cleanup commit 직후
- 같은 commit 에 함께 staged 되어 git history 와 자연 정합되도록.

### 3. 데스크톱 사이드바 신규 메뉴 (사용자 명시)
- `apps/desktop/src/renderer/main.tsx` 의 `settingsNavigation` 배열에서 `{ key: "snapshot", label: "통계", icon: BarChart3 }` 다음에 신규 항목 추가:
  ```ts
  { key: "check", label: "자동 개입 이력", icon: ShieldCheck }  // 라벨/아이콘 후보
  ```
  라벨 후보: "자동 개입 이력" / "확인 대기" / "오케스트레이터 점검" — Plan AI 가 사용자 톤에 맞게 결정.
- `visibleSettingsSection === "check"` 분기 추가:
  - 좌측: `LogList` 와 유사한 패턴으로 `check_NNN.md` 목록 (시간 역순, event_type 필터, 미확인/확인 토글).
  - 우측: 선택된 check 파일 본문 미리보기 (`LogPreview` 패턴 재사용).
  - 헤더: "자동 개입 N건 (미확인 M건)" 카운트.

### 4. 보드 통합 (선택, 보조)
- `tickets/check/` 를 `apps/desktop/src/main.js` 의 보드 인덱서가 자동 탐색하도록 하면, 기존 "티켓" 화면에도 같은 데이터가 카드 형태로 노출됨. 단 사용자 명시는 "통계 아래 새 메뉴" 이므로 이쪽이 메인. 보드 노출은 후속에서 결정.

### 5. 정책 문서 보강
- `.autoflow/agents/plan-to-ticket-agent.md`: 자동 개입 시 check 파일 생성 책임 명시.
- `AGENTS.md` rule 5a: "자동 개입 발생 시 `tickets/check/check_NNN.md` 한 건 생성" 추가.
- `.autoflow/reference/tickets-board.md`: check 카테고리 추가.

## Allowed Paths (hint)

- `.autoflow/tickets/check/` (신규 폴더 + .gitkeep)
- `.autoflow/scripts/start-plan.sh` (자동 개입 코드 경로에 check 파일 생성 호출)
- `.autoflow/scripts/common.sh` (`record_orchestration_check` 헬퍼)
- `.autoflow/agents/plan-to-ticket-agent.md` (정책)
- `AGENTS.md` (rule 5a 보강)
- `.autoflow/reference/tickets-board.md` (카테고리 추가)
- `apps/desktop/src/renderer/main.tsx` (사이드바 메뉴 추가 + check 페이지 분기)
- `apps/desktop/src/renderer/styles.css` (페이지 전용 스타일)
- `apps/desktop/src/main.js` (필요 시 IPC handler — check 파일 목록 / 본문 read)

## Verification (hint)

- `npm run desktop:check` 통과.
- 자동 생성 검증:
  - 인위적 시뮬레이션 (PROJECT_ROOT 더미 dirty path → planner tick → blocked-dirty-orchestration 발생) 으로 `check_NNN.md` 1건 생성 확인.
  - reject 한 건 max_retries 도달 → auto-close → check 파일 1건 생성 확인.
- 데스크톱 미리보기:
  - 사이드바에 새 메뉴(`자동 개입 이력` 등) 가 "통계" 바로 아래에 노출되는지.
  - 클릭 시 좌측 check 파일 목록 + 우측 본문 미리보기로 정상 동작.
  - event_type 필터 / 미확인 토글 동작.
  - 헤더의 "N건 (미확인 M건)" 카운트가 실제 파일 수와 일치.
  - 빈 상태 ("자동 개입 이력이 아직 없습니다.") fallback 노출.
- 사람 액션:
  - 본문 `[ ] 사람 확인 완료` 체크 후 미확인 카운트 감소 확인 (또는 별도 store 로 처리).
  - check 파일을 `tickets/check/done/` 으로 이동 또는 archive 시 데스크톱이 즉시 반영.
- 회귀:
  - 기존 사이드바 메뉴 (AI 진행 현황 / 티켓 / LLM 위키 / 통계 / 로그) 의 layout / 탭 동작 영향 없는지.
  - 보드 인덱싱 시간이 의미 있게 증가하지 않는지.
  - planner tick 시간이 check 파일 생성 한 건 추가로 인해 의미 있게 증가하지 않는지 (markdown write 한 번이라 무시 가능 수준이어야 함).

## Notes

- **연관:**
  - order_128 ("로그" 메뉴 삭제) — 이번 신규 메뉴가 사람이 봐야 할 핵심 정보 자리를 대체하므로 로그 메뉴 삭제 정당화 강화.
  - order_129 (통계 페이지 가독성) — 통계 페이지에 "이번 7일 자동 개입 N건" 카운터를 후속 추가 가능 (본 order 의 데이터 source 활용).
  - order_130 (앱 아이콘) — 별건. 독립.
- **위험:**
  - 자동 개입이 잦은 시기에 check 파일 폭발적 누적 → 30일 미확인 시 자동 archive 정책은 후속 PRD.
  - check 파일을 매번 별도 commit 으로 만들면 git history 노이즈. **권장: 자동 개입 commit 과 같은 commit 에 함께 stage**.
  - planner tick 안에서 check 파일 생성이 실패해도 자동 개입 자체는 멈추지 않아야 함 (1원칙 정합 — best-effort 작성, 실패 시 stderr 로 경고만).
- **out of scope:**
  - 자동 archive 정책 (30일 cap 등) — 후속 PRD.
  - check 파일 종류별 시각 뱃지/색상/필터 고도화 — 후속 보강.
  - 통계 페이지의 자동 개입 카운터 카드 — order_129 와 통합.
- **1원칙 정합:**
  - 본 메뉴는 read-only (사람 사후 확인용). 자율 흐름 자체를 막지 않음.
  - check 파일 생성 실패가 planner 흐름을 막지 않도록 best-effort 처리.
