# Shell Adapter

Use shell commands as the deterministic baseline runner.

The shell adapter is useful for smoke tests before Codex, Claude, OpenCode, or
Gemini CLI support is wired in.

Expected contract:

- command is configured by Autoflow or the user
- stdout/stderr are captured into runner logs
- exit code `0` means completed or idle
- non-zero exit code means failed
- renderer does not execute arbitrary shell text directly

