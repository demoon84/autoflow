# Autoflow Order

## Order

- Title: Verifier runner 를 데스크탑 UI 에 연결 (placeholder → 실제 카드)
- Priority: high
- Status: ready
- Change Type: code

## Request

order_294 (Verifier 부활) 가 완료돼 `.autoflow/agents/verifier-agent.md`,
`.autoflow/scripts/start-verifier.ts`, `config.toml` 의 verifier 블록 (haiku-4-5,
enabled=true) 까지 모두 들어왔다. 그런데 데스크탑 UI 는 아직 verifier 를 인식
못 하고 "대기 자리 · order_294 구현 후 활성화" placeholder 만 보여줌.

해야 할 것:
1. **config.local.toml 에 verifier 블록 추가** (런타임은 local 을 우선 읽음)
   - id="verifier", role="verifier", agent="claude", model="claude-haiku-4-5-20251001"
   - mode="loop", interval_seconds=300 (5분), enabled=true, realtime_enabled=true
2. **renderer/main.tsx 의 displayProgressRoleLabel 에 verifier 케이스 추가**
   - `if (role === "verifier") return "Verifier";`
3. **renderer/main.tsx 의 TicketBoard runners.map 에서 verifier placeholder 제거 로직 추가**
   - 실제 verifier runner 가 board.runners 에 존재하면 placeholder `<article>` 렌더링 생략
   - 없을 때만 placeholder 표시 (점진 도입 대비)
4. **RunnerConsole 의 settings filter 에 verifier role 추가**
   - line ~3437 의 role 화이트리스트에 `runner.role === "verifier"` 추가해서 설정 페이지에도 표시
5. **agent 아이콘 / 색상 토큰** — Worker 와 동일 패턴이면 별도 작업 없음. 다르면 verifier 전용 lucide 아이콘 (예: `ShieldCheck`) 매핑 추가
6. **AGENTS.md / CLAUDE.md 토폴로지 표기 갱신** — "3-runner default" → "4-runner default (planner / worker / wiki / verifier)"

## Allowed Paths

- .autoflow/runners/config.local.toml
- apps/desktop/src/renderer/main.tsx
- AGENTS.md
- CLAUDE.md

## Done When

- [ ] config.local.toml 에 verifier [[runners]] 블록 추가 + enabled=true
- [ ] 데스크탑 재시작 후 grid-area: verifier 자리에 실제 Verifier 카드 표시 (Worker 와 동일 패턴: 상태 뱃지, 모델 드롭다운, live terminal, token 카운터)
- [ ] placeholder 점선 안내 카드는 사라짐
- [ ] worker pass 시 verifier 가 wake 해서 의미 검증 실행 (verifier-agent.md 동작)
- [ ] 의미 불일치 fixture 에서 verifier 가 inbox retry 발행 (회귀)
- [ ] AGENTS.md / CLAUDE.md 토폴로지 표기가 4-runner 로 갱신

## Verification

- Command: PROJECT_ROOT=. bash packages/cli/runners-project.sh list . .autoflow 로 runner_count=5 확인 (planner+worker+worker-2+wiki+verifier)

## Notes

- order_306 (위/아래 row 정렬) 과 같은 styles.css/main.tsx 영역 손대므로 머지 순서 주의 — 본 ticket 이 placeholder 제거하면서 grid 자리도 함께 점검
- 첫 활성화 시 verifier 의 claude-session-id 가 없으므로 새 session 으로 자동 시작
- 비용 영향: 5분 interval + worker pass 시점 wake → 일 수십 회 호출. haiku-4-5 라 비용 무시 가능
