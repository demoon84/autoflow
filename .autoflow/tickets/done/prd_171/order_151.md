# Autoflow Order

## Order

- ID: order_151
- Title: 🎯 worker self-refresh dirty deadlock — ticket Stage 갱신이 자기 Allowed Paths 를 dirty 화
- Status: inbox
- Priority: normal
- Created At: 2026-05-03T16:14:40Z
- Source: autoflow order create

## Request


worker 의 stage_blocked stuck 의 **결정적 root cause** — ticket 의 Allowed Paths 가 자기 자신 ticket markdown 파일을 포함하고, worker 가 tick 마다 그 파일의 Stage/Last Updated 를 갱신하므로 영원히 dirty 인식.

## 결정적 증거 (worker.loop.stdout.log 마지막)

```
runtime_output_begin
status=resume
status=blocked
reason=ticket_stage_blocked
ticket=/.../tickets_163.md
ticket_id=163
next_action=Runtime wait: PROJECT_ROOT has dirty changes in this ticket's 
  Allowed Paths (.autoflow/tickets/inprogress/tickets_163.md, 
                 .autoflow/tickets/inprogress/verify_163.md). 
  Commit/stash those changes or intentionally integrate them before ticket-owner continues.
runtime_output_end
```

## Self-refresh Deadlock

```
T+0:  worker tick 시작 → ticket_163.md Stage 갱신 (자기 자신 modified)
T+1:  worker 가 git status 읽음 → tickets_163.md, verify_163.md 가 dirty
T+2:  worker 가 "Allowed Paths 가 dirty" → wait + stage_blocked
T+3:  planner 가 dirty-orchestration 으로 commit (PRD_150)
T+4:  worker 다음 tick → ticket_163.md Stage 갱신 (또 dirty)
T+5:  loop ...
```

ticket_163 의 Allowed Paths 가 **자기 자신을 포함**하면 self-refresh 가 영원히 dirty 를 만든다. PRD_150 cleanup 후에도 다음 tick 의 self-refresh 로 다시 dirty.

## 부가 발견: worker process leak

```
PID 51945 (정상) — /Users/demoon2016/.../packages/cli/runners-project.sh loop-worker worker
PID 65987 (좀비) — /Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_155/packages/cli/...
```

PID 65987 의 stderr:
```
/Users/demoon2016/Documents/runtime/board-scripts/runner-common.sh: No such file or directory
```

→ tickets_155 worktree 안의 runners-project.sh 가 실행되면서 잘못된 path 로 board-scripts 참조 → 실패하지만 process 는 살아있음. worktree cleanup 이 worker process 를 kill 안 한 잔재.

## Suggested Fix

A) **ticket markdown 파일을 Allowed Paths 에서 자동 제외**:
- worker 가 dirty check 시 `Allowed Paths` 에서 자기 자신 ticket md / verify md 는 dirty 검사 대상에서 제외
- 또는 git diff 가 ticket meta 갱신 (Stage, Last Updated) 만이면 "non-content dirty" 로 분류 후 통과

B) **Stage 갱신 시 commit 자동 묶기**:
- worker 가 ticket Stage / Last Updated 를 갱신하면 그 즉시 같은 tick 안에 `[ticket_NNN] runtime: stage update` commit 으로 자동 정리
- 다음 tick 시작 시 dirty 0

C) **worktree process orphan cleanup**:
- worktree 정리 (`git worktree remove`) 시 그 worktree 안에서 도는 runner process kill
- `runners-project.sh stop` 명령에 worktree-aware cleanup 추가

권장: **A + C**. A 는 deadlock 즉시 해결, C 는 process leak 별도.

## Allowed Paths

- packages/cli/run-role.sh (worker 의 dirty check 로직)
- packages/cli/runners-project.sh (worktree process cleanup)

## Verification

```bash
# fix 후
grep '^last_result=' .autoflow/runners/state/worker.state
# 'ticket_stage_blocked' 30분+ 지속 안 함

# Stage 갱신 후 git status check
ls .autoflow/tickets/inprogress/ | grep -v gitkeep | wc -l
# < 2 이어야 함

# orphan worker process
ps -ef | grep "loop-worker worker" | grep -v grep | wc -l
# 1 이어야 함 (현재 2)
```

## Notes

- 6시간+ 모니터링의 가장 깊은 root cause. order_148/149/150 의 **공통 underlying mechanism**.
- monitor 가 8시간+ 같은 STATE_VIOLATION emit 하면서 잡아낸 결정적 패턴.
- 1원칙 = "멈추지 않음". 그러나 self-refresh deadlock 은 정확히 "바쁘게 멈춰있음" 의 형태.
- 사용자가 "워커가 일을 안하는거 같음 점검" 으로 직접 물어본 답.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/run-role.sh`
- `packages/cli/runners-project.sh`

### Verification

- Command: ps -ef | grep -c 'loop-worker worker' && grep '^last_result=' .autoflow/runners/state/worker.state

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
