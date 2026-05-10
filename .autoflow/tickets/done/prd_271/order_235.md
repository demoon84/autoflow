# Autoflow Order

## Order

- ID: order_235
- Title: PTY state wipe 회귀 + 슬립/웨이크 처리
- Status: inbox
- Priority: high
- Created At: 2026-05-10T14:36:54Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: PTY runner state 파일 wipe 회귀 + 슬립/웨이크 처리 강화
- Priority: high
- Status: ready
- Change Type: code


PTY 모드 운영 중 `wiki.state` 등 일부 runner state 파일이 핵심 필드 (`id`, `status`, `mode`, `pid`, `role`, `agent`)를 잃고 token 관련 5필드만 남아 UI 가 해당 runner 를 stopped 로 오인 (▶ 아이콘 표시) 하는 문제 반복 발생. 또 시스템 슬립/웨이크 시 PTY 는 살아있지만 fs.watch / state 동기화가 어긋나는 케이스도 함께 처리.

## 증상

- worker/planner 는 정상 (`status=running, pid=...`) 인데 `wiki.state` 만 부실해짐
- 사용자 수동 복구 후에도 token watcher publish() 사이클 반복되면 다시 깨짐
- 슬립 후 깨어나도 PTY 자체는 살아있으나 UI 카드 일부가 stopped 로 오인되는 패턴 관찰

## 추정 원인

1. `createClaudeTokenWatcher` 의 `publish()` 가 5필드 (`cumulative_tokens / last_turn_tokens / token_source / last_token_usage_source / last_event_at`) 만 보냄
2. `writePtyRunnerStateFile` 이 merge 방식이지만, race 조건에서 spawn 직후 status 박기 전에 token watcher 가 먼저 publish → 새 파일이 token 5필드만으로 생성됨
3. 이후 spawn 의 status write 가 어떤 이유로 누락되거나 token watcher 가 다시 덮어씀
4. 슬립/웨이크 시 fs.watch 가 끊어졌다 복귀하면서 같은 state mutation 이 다시 발화

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/main/runner-pty-manager.js (필요 시)
- runtime/board-scripts/ 미러 동기화 대상 (해당 시)

## Done When

- [ ] **race fix**: `createClaudeTokenWatcher` 의 첫 `publish()` 가 spawn 의 `writePtyRunnerStateFile({status, pid, ...})` 가 완료된 후에만 발화. 첫 publish 까지 setTimeout 또는 promise 동기화로 보장.
- [ ] **defensive merge**: `writePtyRunnerStateFile` 이 새 파일 생성 시 (existing 비어있을 때) `ptyRunnerMeta.get(runnerId)` 의 spawn 정보 (`role`, `agent`, `mode=pty`, `status=running`, `pid`, `started_at`) 를 자동으로 채워 넣어 부실 상태 발생 방지.
- [ ] **electron powerMonitor 통합**: `apps/desktop/src/main.js` 에 `powerMonitor` 의 `suspend` / `resume` 이벤트 처리 추가
  - suspend 시: fs.watch 디바운스 잠시 정지 + 마지막 known PTY 상태 보존
  - resume 시: PTY children 살아있는지 `kill -0` 검증 → 살아있으면 state 파일을 PTY 매니저 의 `list()` 결과로 rewrite (id/status/pid/mode/role/agent/started_at 보장) → 죽었으면 status=stopped 마크
- [ ] **state self-heal**: 데스크톱 부팅 시점 외에 매 N분 (`AUTOFLOW_STATE_SELFHEAL_MIN`, 기본 5) `__autoflowPtyManager.list()` 와 state 파일을 비교해 핵심 필드 누락 시 자동 보강
- [ ] **회귀 검증**: state 파일에서 `id` 를 빼고 강제로 token watcher publish 를 트리거 후 self-heal 한 turn 안에 보강되어 UI 가 ▶ → ■ 로 자동 전환됨을 확인
- [ ] runtime/board-scripts/ 미러 동기화 (해당 변경 영역에 미러가 있을 경우)

## Verification

- Command: rg -n "powerMonitor|writePtyRunnerStateFile|createClaudeTokenWatcher" apps/desktop/src/main.js apps/desktop/src/main/runner-pty-manager.js

## Notes

- `runner-tokens.ts` (LLM 능동 보고) 가 primary 가 되면 createClaudeTokenWatcher (session log fallback) 는 보강 역할이지만 현재 상태로도 이 race 이슈는 반복되므로 fix 필요
- powerMonitor 는 electron 기본 모듈이라 추가 의존성 없음
- state 파일이 sticky 하게 부실해지는 케이스는 다른 writer (legacy run-role.sh, 사용자 수동 편집 등) 의 잔해일 수도 — defensive merge 로 한 번만 박히면 이후 보강은 자동
- 1원칙: powerMonitor 콜백 / self-heal 모두 best-effort, 실패해도 메인 흐름 차단 금지

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
