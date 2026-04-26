# OpenCode Adapter

Use this adapter when a runner delegates work to OpenCode.

## Contract

- Binary: `opencode`.
- Input: a generated role prompt.
- Output: stdout, stderr, exit code, and copied artifacts.
- Best for: local coding-agent execution where OpenCode is installed.

## Safety

- Include board root, project root, allowed paths, and no-push rule in prompts.
- Keep durable progress in tickets and logs.
