# Autoflow Order

## Order

- ID: order_200
- Title: 어댑터 stream-json 전환 + 터미널 AI 실시간 신호
- Status: inbox
- Priority: high
- Created At: 2026-05-09T10:46:35Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 어댑터를 stream-json 으로 전환하고 터미널에 AI 실시간 신호 표시
- Priority: high
- Status: ready


ai가 일하는 터미널 신호가 같이 보여야 한다고. 지금 LiveTerminalView 는 `<runner>.log` 의 event metadata (`adapter_start`, `loop_tick` 등) 만 1초 폴링으로 보여줌. 실제 claude 가 일하는 5~10분 동안 사용자가 볼 수 있는 "AI가 동작 중" 신호가 없음 — adapter_start 와 adapter_finish 사이에 이벤트 공백.

원인: claude `-p --output-format text` 모드는 tick 이 끝날 때까지 stdout 을 buffer 함. live_stdout.log 가 0 byte 로 머물다 마지막에 한 번에 쏟아짐.

## Notes

### 권장 변경

claude CLI 호출을 다음으로 전환:
`claude -p --dangerously-skip-permissions --permission-mode bypassPermissions --output-format stream-json --include-partial-messages`

stream-json 은 partial message chunk, tool_use 시작/끝, message_delta 등을 JSONL 한 줄씩 즉시 stdout 으로 흘림. live_stdout.log 가 실시간으로 자라며 LiveTerminalView 가 1초마다 그 끝을 tail 함.

### 영향 범위

#### 1. 어댑터 명령 (5곳)
- `packages/cli/run-role.sh:4270` — `runner_claude_base_cmd` 의 기본 cmd
- `runtime/board-scripts/run-role.sh:4290` — 위 sync 본
- `packages/cli/wiki-project.sh:801` — wiki 어댑터
- `packages/cli/runners-project.sh:666` — runners CLI 도움말 표시용
- `runtime/board-scripts/runners-project.sh:669` — sync 본

#### 2. 어댑터 post-processor (run-role.sh line ~4449)
현재: live_stdout.log 의 raw text 를 그대로 `adapter_last_message` 에 복사.
변경 후: live_stdout.log 가 JSONL → 마지막 `{"type":"result","subtype":"success","result":"..."}` 의 `result` 필드를 추출해 `adapter_last_message` 에 기록. jq 또는 python -c 사용.

추출 실패 시 fallback: `type:assistant` 이벤트들의 `message.content[].text` 를 concat. 둘 다 실패하면 raw stdout 그대로 (legacy 보존).

#### 3. 데스크톱 LiveTerminalView 렌더링 (apps/desktop/src/renderer/main.tsx)
- `useLiveStdoutText` 가 현재 `<runner>.log` 만 tail 함.
- 추가: `runner.lastStdoutLog` (state 의 `last_stdout_log` 필드, 현재 active adapter 의 live_stdout.log) 도 함께 tail.
- 두 stream merge: persistent runner.log (event metadata) 위쪽, live_stdout.log (실시간 AI JSONL) 아래쪽.
- JSONL 라인은 사람이 읽을 수 있게 한 줄 요약으로 변환:
  - `{"type":"system","subtype":"init"}` → `[init] tools=N model=opus`
  - `{"type":"text","text":"..."}` → 그 text 그대로
  - `{"type":"tool_use","name":"Read","input":{"file_path":"..."}}` → `[tool] Read /path/to/file`
  - `{"type":"tool_result","content":"..."}` → `[result] <preview 80 chars>`
  - `{"type":"result","subtype":"success","result":"..."}` → `[done] <result preview>`
  - `{"type":"message_delta",...}` → text fragment 그대로 append
  - 기타 → 무시 (또는 dim 으로 표시 옵션)
- ANSI 컬러는 기존 `colorizeLogChunk` 유지.

#### 4. 토큰 / 통계 파싱 회귀 가드
- 현재 token usage 추출은 stdout 에서 정규식 매칭 (apps/desktop/src/main.js parseTokenUsage). stream-json 으로 바뀌면 마지막 `result` 이벤트의 `usage.{input_tokens,output_tokens,total_tokens,cache_read_input_tokens}` 필드에서 정확한 값 사용 가능.
- 기존 텍스트 정규식 path 도 유지 (Gemini / Codex 호환).

#### 5. 어댑터 timeout / sanity gate 회귀 가드
- `output_truncated` 마커는 raw JSONL 마지막 줄에 그대로 붙이거나 `result.subtype` 이 truncated 일 때 적용.
- `consecutive_timeout_count`, `consecutive_preflight_skip_count` 카운터는 변경 없음.
- shell sanity gate (zero-diff + Done When 체크) 영향 없음 — 계약은 ticket markdown 만 봄.

### 안전 장치

- env `AUTOFLOW_CLAUDE_STREAM=0` 으로 legacy text 모드 강제 가능 (기본 1).
- claude CLI 가 `stream-json` flag 미지원이면 (`claude --help | grep stream-json` 실패) 자동으로 text 모드로 fallback.
- stream-json 파싱이 실패한 line 은 디버그 stream 으로 분리, 사용자 view 에는 노출 안 함 (rule: AI 가 정리한 자연어만 화면에).

### 후보 Allowed Paths

- `packages/cli/run-role.sh`
- `runtime/board-scripts/run-role.sh`
- `packages/cli/wiki-project.sh`
- `packages/cli/runners-project.sh`
- `runtime/board-scripts/runners-project.sh`
- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/main.js`
- `AGENTS.md`

## Allowed Paths

- packages/cli/run-role.sh
- runtime/board-scripts/run-role.sh
- packages/cli/wiki-project.sh
- packages/cli/runners-project.sh
- runtime/board-scripts/runners-project.sh
- apps/desktop/src/renderer/main.tsx
- apps/desktop/src/main.js
- AGENTS.md

## Done When

- [ ] claude 어댑터가 `--output-format stream-json --include-partial-messages` 로 호출되며 tick 진행 중에 live_stdout.log 가 실시간으로 grow 한다 (0 byte 로 안 머묾).
- [ ] 어댑터 post-processor 가 JSONL 의 마지막 result 이벤트에서 final text 를 추출해 `*_last_message.txt` 에 기록한다.
- [ ] LiveTerminalView 가 persistent `<runner>.log` + active live_stdout.log 두 stream 을 merge 해서 표시한다.
- [ ] 사용자가 1~2 초 단위로 새 line (text fragment / tool 호출 / result preview) 이 터미널에 흐르는 것을 본다.
- [ ] tool_use, text, result 등 JSONL event 가 사람이 읽을 수 있는 한 줄 형식으로 변환돼 표시된다 (raw JSON 노출 금지).
- [ ] token usage 추출이 stream-json 의 result 이벤트 usage 필드에서 정확히 동작 (기존 정규식 fallback 보존).
- [ ] worker 의 sanity gate (zero-diff + Done When 체크) 와 ticket pass/fail 판정에 영향 없음.
- [ ] env `AUTOFLOW_CLAUDE_STREAM=0` 일 때 legacy text 모드로 동작 (rollback 가능).
- [ ] `npm run desktop:check` 통과.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 데스크톱 dev 앱에서 worker tick 시작 후 5초 안에 터미널에 새 line 이 흐르고, 5분짜리 adapter 호출 동안 지속적으로 신호가 보이는지 시각 확인.

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
