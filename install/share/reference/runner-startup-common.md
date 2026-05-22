# 러너 시작 공통 규칙

데스크톱 start button이 runner를 시작할 때 이 파일은 runner의 첫 prompt에 주입된다.
이 문서는 bootstrap contract이며, live state는 계속 `tickets/`, `runners/`, `metrics/`, `conversations/`, `wiki/`에 둔다.

## Every Runner

- 주입된 `Project root`, `Board root`, `Runner id`, `Role`을 현재 runtime context로 사용한다.
- 데스크톱에서 시작한 runner는 항상 실행 가능한 shim인 `AUTOFLOW_CLI`를 받으며, 해당 shim directory는 `autoflow`로 `PATH` 앞에 추가된다. Autoflow CLI를 호출할 때는 먼저 `"$AUTOFLOW_CLI"`를 사용한다. 예: `"$AUTOFLOW_CLI" tool runner-tool worker active-get --runner <runner-id>`.
- Plain `autoflow` 또는 `npx autoflow`가 실패해도 `"$AUTOFLOW_CLI"`를 계속 쓴다. Global CLI가 없다는 이유로 idle하거나 `worker claim`을 건너뛰지 않는다. `"$AUTOFLOW_CLI"` 자체가 없거나 실행 불가능하면 ticket file 이동이나 worktree 생성으로 우회하지 말고 host runner environment bug로 기록한다.
- Work state의 source of truth는 `tickets/`다. Chat history와 wiki page는 supporting context일 뿐이다.
- 시작 prompt의 `Startup handoff links`는 `conversations/` 아래 승인된 대화 handoff 경로를 링크로만 전달한다. Startup scan이 matching PRD/Todo scope를 선택하기 전에는 열지 않으며, 열더라도 PRD 또는 ticket file이 계속 source of truth다.
- 데스크톱에서 시작한 runner는 사용자가 명시적으로 시작할 때 PTY를 연다. 보이는 runner turn 안에서 deterministic startup check를 실행하고, 발견한 work를 처리하거나 왜 idle인지 기록한다.
- Planning, implementation, verification, wiki, blocked/replan 결정을 내리기 전에 role-specific startup rule의 첫 read 순서를 따른다. Role에 compact deterministic startup tool이 있으면, 예를 들어 wiki `tick`, 추가 project/board contract file을 열기 전에 그 tool을 실행한다. Extra contract file은 compact output 또는 active work가 요구할 때만 읽는다.
- Runner tool은 deterministic helper로 사용한다. Scope, next action, pass/revise/replan, blocked 처리, evidence 충분성은 runner가 결정한다.
- Durable progress는 board file에 유지한다: `Notes`, `Next Action`, `Resume Context`, `Verification`, `Result`, runner state, metrics.
- 어떤 runner에서도 `git push`를 실행하지 않는다.
- Active role boundary와 ticket `Allowed Paths` 안에 머문다.
- Runner가 안전하게 계속할 수 없으면 idle 전에 board에 관찰 가능한 evidence와 다음 safe action을 남긴다.
- 첫 startup turn에서는 file을 열기 전에 role-specific compact startup tool만 실행한다: `planner queue-snapshot`, `worker active-get`/`todo-snapshot`, `verifier queue-snapshot`, `wiki tick`. Tool의 `ai_followup_scope.inspect_only_recent_sources`를 initial read boundary로 사용한다.
- 첫 focused startup turn에서는 generic `runner-stage`, `runner-tokens`, `date`를 호출하지 않는다. Desktop이 PTY state와 provider usage를 추적하며, 실제 state transition이 필요할 때 role-specific tool이 durable board state를 갱신한다.
- 정확한 live provider usage metadata가 emitted되면 end-of-turn token accounting은 Desktop host가 수집한다. 같은 Desktop PTY turn에 manual token report를 추가로 실행하지 않는다.
- Manual reporting은 Desktop PTY run 밖이거나 host가 명시적으로 요청했고 정확한 input/output/cache 값이 보일 때만 사용한다: `autoflow tool runner-tokens report --runner <runner-id> --tick-id <unique> --input <N> --output <N> [--cache-read <N>] [--cache-create <N>]`.
- 정확한 값이 없으면 token report를 생략한다. `0/0`, `1` 또는 `1000` 같은 placeholder, 대략 추정치를 보고하지 않는다.
- Role contract file은 compact startup output 또는 active work가 명시적으로 요구할 때만 읽는다. Runner process가 restart되지 않았다면 매 turn 반복해서 읽지 말고, compact runner tool이 관련 bounded scope를 이미 반환했을 때 optional project/board rule을 확장하지 않는다.
