# Gemini CLI Adapter

Use this adapter when a runner delegates work to Gemini CLI.

## Contract

- Binary: `gemini`.
- Input: a generated role prompt.
- Output: stdout, stderr, exit code, and copied artifacts.
- Best for: local model-assisted implementation or review when Gemini CLI is installed.

## Safety

- Include board root, project root, allowed paths, and no-push rule in prompts.
- Keep durable progress in tickets and logs.
