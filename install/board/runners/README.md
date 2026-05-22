# Runners

Runner는 Autoflow 작업을 소비하는 local process다.

Runner record는 다음 값을 정의할 수 있다.

- `id`,
- `role`,
- `agent`,
- `codex_history`,
- `model`,
- `reasoning`,
- `enabled`,
- `command`.

Codex runner에서 `codex_history = "isolated"`는 runner session file을 사용자의 기본
Codex chat history가 아니라 Autoflow app data에 보관한다. Runner가 의도적으로 기본
Codex history home을 써야 할 때만 `shared`를 사용한다.

규칙:

- `config.toml`은 tracked default topology다. `autoflow runners set/add/remove`는 machine-local override를 ignored `config.local.toml`에 쓰며, reader는 파일이 있을 때 `config.local.toml`을 우선한다.
- Runner는 명시적 PTY session이다. 사용자나 desktop automation이 시작하면 role별 startup scan을 실행한다. 보드는 더 이상 `mode`나 `interval_seconds` scheduling field를 저장하지 않는다.
- Desktop은 같은 runner id를 여러 project에서 열 수 있도록 live PTY session을 내부적으로 `projectRoot + boardDirName + runnerId`로 keying할 수 있다. Board-facing state file, log, CLI output은 계속 `planner`, `worker`, `verifier`, `wiki` 같은 public runner id를 쓴다.
- Runner state는 process state이지 ticket state가 아니다.
- Ticket이 계속 authoritative하다.
- `last_result`는 `ticket_stage_blocked`, `adapter_exit_0`처럼 가장 최근의 의미 있는 runtime 또는 adapter result를 보존해야 한다.
- 기본값은 4-runner topology(planner + worker + verifier + wiki)다. `wiki`는 위키 러너다. 오래된 config에는 coordinator role identifier가 나타날 수 있지만 legacy evidence일 뿐이며 새 보드는 coordinator runner를 추가하면 안 된다.
- Runner는 LLM-backed decision-maker다. Runner tool은 runner가 안전한 board action 하나를 위해 호출하는 작은 deterministic command다.
- Runner에서 push하지 않는다.
