# 러너 시작 공통 규칙

데스크톱이 러너를 시작할 때 이 파일은 첫 prompt에 주입된다. 이 문서는 bootstrap contract이며, live state는 `tickets/`, `runners/`, `metrics/`, `conversations/`, `wiki/`에 둔다.

## Every Runner

- 주입된 `Project root`, `Board root`, `Runner id`, `Assignment id`, `Lease version`, `Role`을 현재 runtime context로 사용한다.
- 데스크톱에서 시작한 runner는 실행 가능한 shim인 `AUTOFLOW_CLI`를 받으며, 해당 shim directory는 `autoflow`로 `PATH` 앞에 추가된다. Autoflow CLI를 호출할 때는 먼저 `"$AUTOFLOW_CLI"`를 사용한다.
- `"$AUTOFLOW_CLI"` 자체가 없거나 실행 가능하지 않다면 host runner environment bug로 상태를 기록한다.
- 보드 상태가 source of truth다. Chat history와 wiki page는 supporting context일 뿐이다.
- assignment id와 lease version이 현재 보드 상태와 맞지 않으면 stale assignment로 보고 작업하지 않는다.
- 현재 assignment는 `"$AUTOFLOW_CLI" tool assignment current --runner "$AUTOFLOW_RUNNER_ID"`로 확인한다. 실행을 시작할 때는 `assignment start`, 완료/blocked/failed 시에는 `assignment complete`를 호출해 runner 상태를 닫는다.
- assignment 밖의 item을 선택하지 않는다.
- assignment 밖의 role로 행동하지 않는다.
- runner tool이 `assignment_required`, `assignment_role_mismatch`, `assignment_item_mismatch`, `assignment_not_active`를 반환하면 새 item을 고르지 말고 현재 runner 상태를 보드에 남긴 뒤 멈춘다.
- 실행 중 사용자에게 되묻거나 선택지를 제시하지 않는다. 러너 PTY 입력은 사용자 입력 채널이 아니므로 질문이 필요하면 `blocked` 또는 `replan` reason과 필요한 보정 정보를 보드에 남기고 멈춘다.
- role contract file은 assignment summary만으로 안전하게 진행할 수 없을 때만 읽는다.
- Runner tool은 deterministic helper로 사용한다. Scope, next action, pass/revise/replan, blocked 처리, evidence 충분성은 해당 role이 판단한다.
- 이 runner는 Sub-agent가 아니라 assignment 책임을 가진 메인 에이전트다. Sub-agent는 조사/분석/요약 helper로만 사용하고, board 상태 전이, assignment 처리, 최종 판단, runner tool 호출 책임을 넘기지 않는다.
- Durable progress는 board file에 유지한다: `Notes`, `Next Action`, `Resume Context`, `Verification`, `Result`, runner state, metrics.
- 어떤 runner에서도 `git push`를 실행하지 않는다.
- Active role boundary와 assigned item의 `Allowed Paths` 안에 머문다.
- 안전하게 계속할 수 없거나 처리할 작업이 없으면 종료 전에 board에 관찰 가능한 evidence와 다음 safe action을 남긴다.
- 완료 후 runner 상태를 `completed` 또는 명시적 no-work 상태로 닫는다. 처리할 작업이 없어도 데스크톱의 4개 고정 러너는 계속 표시되며, runner process 종료는 명시적 stop 요청이나 host 정책에 따른다.
- 정확한 live provider usage metadata가 emitted되면 end-of-turn token accounting은 Desktop host가 수집한다.
