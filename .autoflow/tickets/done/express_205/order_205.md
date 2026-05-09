# Autoflow Order

## Order

- Title: 토큰 사용량 표기에서 왼쪽 ↓ 아이콘 제거
- Express: true
- Priority: normal
- Status: ready
- Change Type: code

## Request

토큰 사용량 왼쪽 아이콘 제거

## Allowed Paths

- apps/desktop/src/renderer/main.tsx

## Done When

- [ ] `RunnerActivityFooter` 의 `↓ ` prefix 가 제거되어 footer 가 `{N} tokens` 만 표시한다
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치: `apps/desktop/src/renderer/main.tsx:6857` —
  `<span>↓ {animatedTokens.toLocaleString()} tokens</span>` 의 `↓ ` 문자만 제거.
- Express rationale: 1줄 텍스트 변경이라 PRD 없이 바로 todo 가능.
