# Codex CLI Adapter

Runner가 local Codex CLI에 작업을 위임할 때 이 adapter를 쓴다.

## 계약

- Binary: `codex`.
- Input: Autoflow ticket 또는 PRD에서 생성한 role prompt.
- Output: stdout, stderr, exit code, 복사된 prompt/runtime artifact.
- 적합한 용도: Allowed paths 안의 Worker work, code change, local verification.

## 요구사항

- Prompt에는 board root, project root, ticket path, allowed paths, no-push rule을 포함해야 한다.
- Durable progress는 board file에 써야 한다.
- Browser check는 필요할 때만 Codex built-in browser tool을 쓴다.

## 안전

- push하지 않는다.
- State를 chat output에 숨기지 않는다.
- Host `AGENTS.md` 지침을 따른다.
