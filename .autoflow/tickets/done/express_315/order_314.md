# Autoflow Order

## Order

- ID: order_314
- Title: 데스크톱 runner 카드 응답 지연 의심 표시 제거
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:03:10Z
- Source: autoflow order create

## Request

데스크톱 AI Autoflow runner 카드의 delay badge 중 "응답 지연 의심" 표시가 이제 필요 없다.

현재 코드 상태:
- apps/desktop/src/renderer/main.tsx 의 runnerDelayStage() 가 freshness age 기준으로 3단계 라벨을 반환한다.
  - adapter_running 이고 threshold 전: "LLM 응답 대기 중"
  - suspectThresholdSec 이후 timeout 전: "응답 지연 의심"
  - timeout/stuck threshold 이후: "멈춤 가능"
- apps/desktop/src/renderer/styles.css 에 ai-progress-delay-badge-suspect 스타일이 있다.
- 이 3단계 정책은 prd_188 / Todo-187 에서 false alarm 완화용으로 도입됐지만, 이제 중간 단계인 "응답 지연 의심" 표시를 제거한다.

해야 할 것:
1. runner 카드에서 "응답 지연 의심" badge/text가 더 이상 렌더링되지 않게 한다.
2. timeout 수준의 실제 위험 표시는 "멈춤 가능" 으로 계속 남겨도 된다.
3. 정상 adapter_running 상태의 "LLM 응답 대기 중" 표시는 유지해도 된다. 단, suspect threshold를 넘었다는 이유만으로 warning badge를 띄우지 않는다.
4. unused suspect CSS class / severity literal / tooltip 문구가 남으면 정리한다.
5. runner 자동화, timeout watchdog, lastEventAt/lastAdapterChunkAt 수집, activeStage 기록은 건드리지 않는다. UI 표시만 변경한다.

## Hints

### Scope

- Desktop runner progress card delay badge display policy only

### Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

### Verification

- Command: cd apps/desktop && npm run check; rg -n '응답 지연 의심|ai-progress-delay-badge-suspect|severity: "suspect"' src/renderer/main.tsx src/renderer/styles.css 가 남지 않는지 확인

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
