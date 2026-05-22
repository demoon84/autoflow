# Claude CLI Adapter

Runner가 Claude Code에 작업을 위임할 때 이 adapter를 쓴다.

## 계약

- Binary: `claude`.
- Input: Autoflow ticket 또는 PRD에서 생성한 role prompt.
- Output: stdout, stderr, exit code, 복사된 prompt/runtime artifact.
- 적합한 용도: Claude Code가 chat entry point일 때의 Worker work와 PRD handoff.

## 요구사항

- Claude Code는 `AGENTS.md`가 아니라 `CLAUDE.md`를 읽는다. `AGENTS.md`를 import하는 host `CLAUDE.md`를 제공한다.
- Prompt에는 board root, project root, ticket path, allowed paths, no-push rule을 포함해야 한다.
- Browser check는 필요할 때만 Claude browser tool을 쓴다.

## 안전

- push하지 않는다.
- Board state는 file에 보존한다.
- `/aprd` / `#aprd` handoff 중 plan이나 ticket을 만들지 않는다.
