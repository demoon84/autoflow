# Agent Adapters

Adapters describe how Autoflow invokes local coding-agent CLIs.

Autoflow owns the board, ticket state, runner state, and verifier rules. The
adapter only defines how a local process is launched, which context it receives,
and how its result is interpreted.

Every adapter should document:

- install detection
- model selection
- reasoning or effort options
- role prompt input
- board context input
- log streaming
- idle, blocked, failed, and completed states
- approval boundaries

Current CLI surface:

- `autoflow run <role> --runner <runner-id>` invokes the configured adapter.
- `agent=shell|manual` calls the deterministic board runtime directly.
- `agent=codex|claude|opencode|gemini` builds a role prompt and invokes the
  matching local CLI in one-shot mode.
- `command` overrides the default adapter command. Autoflow passes the prompt
  path in `AUTOFLOW_PROMPT_FILE` and also pipes the prompt on stdin.
- Prompt, stdout, stderr, and runtime output are copied to `runners/logs/` and
  reported as `*_log_path` fields.
- `--dry-run` prints the command and prompt without calling the model.
