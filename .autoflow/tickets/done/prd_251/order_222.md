# Autoflow Order

## Order

- ID: order_222
- Title: PTY runner 토큰 사용량 집계 + UI
- Status: inbox
- Priority: high
- Created At: 2026-05-10T09:44:31Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: PTY runner 토큰 사용량 집계 + UI 노출
- Priority: high
- Status: ready
- Change Type: code


PTY 모드로 전환 후 데스크톱 runner 카드의 토큰 카운터가 항상 `0 tokens` 로 표시된다. legacy `run-role.sh` 가 어댑터 stdout/사이드카에서 token usage 를 파싱해 state 파일과 telemetry 에 적었지만, PTY 경로는 그 단계가 없어 UI 가 빈 값을 받음.

각 CLI 가 자체 세션 로그에 turn 단위 token usage 를 기록하고 있으므로, 그 파일을 watch/parse 해서 runner state 와 UI 에 반영한다.

## Allowed Paths

- apps/desktop/src/main.js
- apps/desktop/src/main/runner-pty-manager.js
- apps/desktop/src/preload.js
- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/main/

## Done When

- [ ] worker (claude / codex / gemini) PTY runner 가 동작 중일 때 LivePtyView 하단 "0 tokens" 영역에 누적 토큰 (input + output + cache_read + cache_creation) 이 실시간 갱신된다
- [ ] runner state 파일에 `cumulative_tokens=NNN`, `last_turn_tokens=NNN`, `token_source=session_log` (또는 `pty_stdout`) 필드가 기록된다
- [ ] claude 의 경우 `~/.claude/projects/<hash>/<session-id>.jsonl` 에서 `message_delta.usage` 를 파싱해 누적
- [ ] codex 의 경우 `~/.codex/sessions/` 의 최신 세션 디렉토리에서 transcript / rollout 파일 파싱
- [ ] gemini 의 경우 `~/.gemini/sessions/` 또는 stdout TUI 에서 token 추출
- [ ] PTY spawn 시점에 각 CLI 의 sessions 디렉토리 mtime 을 기록해 "이 PTY 가 만든 새 세션 파일" 만 추적 (기존 세션 token 이 합산되지 않게)
- [ ] PTY stop 시 token watcher dispose
- [ ] 각 agent 의 token 추출 실패 시 graceful fallback (`0 tokens` 또는 `-` 표시) — UI 가 깨지지 않음

## Verification

- Command: rg -n "cumulative_tokens|TokenUsageWatcher|parseSessionUsage" apps/desktop/src/main.js apps/desktop/src/main/

## Notes

- PTY 자체의 `--include-partial-messages --output-format stream-json` 같은 어댑터 모드 token JSON 은 interactive PTY 에선 불가능. 세션 로그가 유일한 reliable source
- claude 세션 파일 경로 도출: `~/.claude/projects/$(echo $PROJECT_PATH | tr '/' '-')/`
- codex 세션 위치는 `codex --version` 또는 `~/.codex/sessions/` 의 최신 mtime 디렉토리
- gemini 는 `--telemetry` 옵션 등 별도 설정 필요할 수 있음 — 안 되면 PTY stdout 의 "tokens" 패턴 fallback
- Phase 1 으로 claude 만 먼저 구현하고 codex/gemini 는 follow-up 으로 분리해도 OK (작은 PRD 로 split 권장)
- legacy 의 `last_token_usage_source`, `token_budget_*` state 필드와 호환 유지 — UI 가 이미 그쪽 필드를 읽고 있으면 그대로 채워줌

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
