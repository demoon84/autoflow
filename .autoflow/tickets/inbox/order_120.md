# Autoflow Order

## Order

- ID: order_120
- Title: run_with_timeout wrapper 가 codex 어댑터 stdin inheritance 끊는 버그
- Status: inbox
- Created At: 2026-05-03T07:35:10Z
- Source: autoflow order create

## Request

워킹트리에 미커밋 상태로 들어와 있는 packages/cli/run-role.sh 의 `run_with_timeout` wrapper (다른 동시 작업으로 추가됨, HEAD 에는 없음) 가 codex 어댑터 호출 시 stdin inheritance 를 끊는 production bug.

구체 증상:
- run_with_timeout 안에서 `"$@" &` 로 백그라운드 실행 후 wait 하는데, 이때 child 프로세스가 호출자의 stdin (`< "$prompt_file"` 으로 redirect 된 prompt) 을 받지 못함.
- 결과: `run_with_timeout ... run_adapter_with_identity codex exec ... < "$prompt_file"` 호출 시 codex 가 stdin (prompt) 을 0 byte 로 받음.
- 격리 재현: `echo "data" | run_with_timeout 5 5 cat -` → 빈 출력 (stdin 가 cat 까지 도달 못함).

실제 영향:
- `tests/smoke/ticket-owner-adapter-worktree-cwd-smoke.sh` 가 fail. HEAD baseline / HEAD + run_with_timeout 없는 변경 환경에서는 PASS, run_with_timeout wrapping 이 들어간 워킹트리에서만 FAIL.
- production: codex 어댑터 호출 시 prompt 가 전달되지 않아 빈 prompt 로 codex 가 실행될 수 있음 → planner / worker tick 이 의미 없는 결과를 emit 할 가능성. claude / opencode / gemini 경로도 같은 wrapper 를 쓰는지 확인 필요.

수정 방향 후보 (Plan AI 가 결정):
- run_with_timeout 안에서 stdin 을 child 에 명시적으로 redirect (예: stdin 을 fd 3 으로 보존 후 `"$@" <&3 &`).
- background `& wait` 패턴 대신 `timeout(1)` / `gtimeout(1)` 같은 외부 도구로 교체 (단, macOS BSD 호환 까다로움 — 현재 BSD-호환을 의도한 구현이라 의미가 작음).
- stdin 이 필요한 어댑터 호출 경로만 wrapper 우회.

배경: `/order` 트리거. raw transcript 노출 fix 작업 (narrative_text 도입) 검증 중에 발견. 내 narrative_text 변경 자체와는 무관 — HEAD + 내 변경만으로는 smoke PASS, run_with_timeout 가 들어간 워킹트리에서만 FAIL 함을 격리 검증으로 입증.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`

### Verification

- Command: bash tests/smoke/ticket-owner-adapter-worktree-cwd-smoke.sh; echo data | run_with_timeout 5 5 cat -

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
