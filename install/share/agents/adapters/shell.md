# Shell Adapter

Deterministic local command에는 이 adapter를 쓴다.

## 계약

- Binary: 현재 shell.
- Input: runner config 또는 생성된 prompt wrapper의 command text.
- Output: stdout, stderr, exit code.
- 적합한 용도: script, smoke check, local tool, dry-run preview.

## 안전

- Dry-run에는 read-only command를 선호한다.
- push하지 않는다.
- Command output은 runner log에 유지한다.
