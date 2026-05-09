# Autoflow Order

## Order

- ID: order_155
- Title: worktree-bound runner loop orphan cleanup (PID 65987 사례, 11시간+ 좀비)
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T05:14:24Z
- Source: autoflow order create

## Request


git worktree 정리 시 그 worktree 안에서 동작 중이던 runner loop process 가 함께 종료되지 않아 orphan 으로 남는다. 사용자 시스템 자원을 잠식하고 잘못된 path 를 참조하며 stderr 로 노이즈 발생.

## 증거 (10시간 모니터링)

발견된 orphan:
```
PID 65987   ELAPSED 11:20:25  (11시간+ 살아있음)
COMMAND: bash /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/Todo-155/packages/cli/runners-project.sh \
         loop-worker worker /var/folders/2m/.../tmp.iqijrZ3yyv .autoflow
```

stderr (반복):
```
/Users/demoon2016/Documents/runtime/board-scripts/runner-common.sh: No such file or directory
```

→ Todo-155 worktree 가 이미 cleanup / merge 됐는데도 그 worktree path 안의 runner loop 가 살아남아 잘못된 path 로 board-scripts 참조. 매 tick 무한 실패하지만 process 자체는 종료 안 됨.

## Root Cause

`runners-project.sh stop` 또는 worktree merge / remove 흐름이 SIGTERM 을 그 worktree 안의 child process group 까지 전파하지 못함. orphan 화된 후 PID 1 (init) 부모로 reparent 되어 누구도 cleanup 못 함.

또한 `loop-worker` 자체가 fail loop 안에서 sleep + retry 하는 구조라 stderr 폭발 후에도 자기 자신을 종료하지 않음.

## Suggested Fix

A) **worktree cleanup hook**:
- `git worktree remove` / `worktree merge` finalizer 가 그 worktree path 로 시작하는 모든 자식 process kill
- 예: `pkill -f "/worktrees/autoflow/${ticket_id}/packages/cli/"`

B) **loop-worker self-stop on path 부재**:
- `loop-worker` 가 자신의 SCRIPT_DIR 의 board-scripts 가 사라졌음을 감지하면 self-exit (gracefully)
- 예: `[ -f "$(runtime_scripts_root)/runner-common.sh" ] || { log "scripts gone, exiting"; exit 0; }`

C) **runners list 의 stale process 표시**:
- desktop UI 의 runners 화면에 worktree-bound orphan 을 별도 표시 + 일괄 cleanup 버튼

권장: **A + B**. A 는 즉시 효과, B 는 추가 안전망.

## Allowed Paths

- packages/cli/runners-project.sh
- packages/cli/run-role.sh
- 또는 worktree finalizer 코드 (어디인지 확인 후 specify)

## Verification

```bash
# fix 후, 테스트:
# 1. Todo-NNN worktree 생성 → runner loop 시작
# 2. worktree merge 또는 remove
# 3. 그 worktree path 로 시작하는 process 확인:
ps -ef | grep -c "/worktrees/autoflow/Todo-NNN/"
# 0 이어야 함

# 사용자 환경 cleanup (현재):
pkill -9 -f "/Library/Caches/autoflow/worktrees/.*runners-project.sh"
ps -ef | grep -c "/worktrees/autoflow/"
# 살아남은 orphan 0
```

## Notes

- order_154 (master roadmap) 의 보강 항목 E.
- order_134 (process leak guard PRD_142) 와 카테고리 비슷하지만 root cause 다름:
  - PRD_142: adapter spawn cleanup (per-tick child)
  - 본 PRD: worktree-bound long-running loop (시간 단위 orphan)
- 1원칙 호스트 안전성 측면 잔여 vector. 사용자 IDE 영향 가능성.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/runners-project.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: ps -ef | grep -c '/worktrees/autoflow/.*runners-project.sh'

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
