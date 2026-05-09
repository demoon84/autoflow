# Autoflow Order

## Order

- Title: LiveTerminalView 토큰 한도 토스트 — rate limit / quota 구분 및 메시지 개선
- Priority: normal
- Status: ready

## Request

LiveTerminalView 의 "토큰 한도 도달" 토스트가 Codex API rate limit(일시적 속도 제한)에도 뜨는데, 제목이 "토큰 한도 도달"이라 사용자가 자신의 토큰 예산이 소진된 것으로 오해한다. 실제로 토큰 카운터에는 8,406,177 tokens 같이 정상 값이 표시되어 있어 더 혼란스럽다.

### 문제

1. `RUNNER_QUOTA_KEYWORD_PATTERN` 이 rate limit(일시적) 과 quota 소진(영구적) 을 구분 없이 잡음
2. 제목 "토큰 한도 도달" 은 quota 소진 의미라 rate limit 에 쓰기 부적절
3. 메시지 "한도 회복을 기다려주세요" 는 rate limit 상황에서는 맞지만 quota 소진 상황과 구분이 안 됨

### 개선 방향

- rate limit 패턴(`rate limit`, `too many requests`, `429`) 과 quota 소진 패턴(`usage limit`, `quota exceeded`, `resource_exhausted`, `model_capacity_exhausted`) 을 분리 감지
- rate limit 일 때: 제목 `API 속도 제한`, 메시지 `일시적 제한입니다. 잠시 후 자동으로 재시도됩니다.` + retryAfter 표시
- quota 소진 일 때: 제목 `사용 한도 소진`, 메시지 `{agent} 한도가 소진됐습니다. 모델을 교체하거나 한도 회복을 기다려주세요.`
- 두 경우 모두 기존 닫기(X) 버튼 유지

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`

## Done When

- [ ] rate limit 감지 시 토스트 제목이 `API 속도 제한` 으로 표시된다
- [ ] quota 소진 감지 시 토스트 제목이 `사용 한도 소진` 으로 표시된다
- [ ] 두 타입의 메시지가 각각 다른 안내 문구를 보여준다
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
