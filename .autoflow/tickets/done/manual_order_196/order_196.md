# Autoflow Order

## Order

- ID: order_196
- Title: 러너 패널에 진행 중 활동 인디케이터 (elapsed + tokens)
- Status: inbox
- Priority: normal
- Created At: 2026-05-09T07:13:01Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: 러너 패널에 진행 중 활동 인디케이터 (elapsed time + token 카운트)
- Priority: normal
- Status: ready


일을 하고 있는것인지 모르겠는데 이런식으로 (스크린샷: "※ 45s · ↓ 272 tokens") 하단에 여백을 주고 표시가 가능할까? 아니면 저기에 터미널을 직접 넣어도 좋을거 같아.

## Notes

- 사용자가 가리킨 영역: 러너 패널 (`AiConversationPanel`, `apps/desktop/src/renderer/main.tsx` line ~6364) 의 narrative 요약본 영역. 현재는 작업 narrative 한 덩어리만 보이고 "지금도 진행 중" 인지 알기 어려움.
- 사용자가 직접 hint 한 두 옵션 (planner 가 결정):
  - **A. 활동 인디케이터** (사용자 1번 스크린샷, 권장): 패널 하단에 작은 한 줄 — `※ 45s · ↓ 272 tokens` 형식. "elapsed time" + "수신 토큰" 으로 AI 가 살아 있음을 무거운 UI 없이 알림. 데이터 소스 모두 IPC 로 이미 들어옴 (`runner.startedAt`, `runner.lastEventAt`, 토큰은 telemetry / runner.tokenUsage). UI 비용 작음.
  - **B. 터미널 임베드** (사용자 2안): 같은 자리에 raw stdout 스트림을 직접 embed. xterm.js / 단순 `<pre>` 둘 다 가능. 사용자가 한눈에 흐름 보지만 UI 면적 크고 narrative 요약과 경합. 별도 dialog 또는 expand toggle 로 보여주는 형태가 합리적.
- 직전 PRD 207 (commit 94a57b4) 의 binary running/stopped 인디케이터, 직전 order_193 (todo 큐 대기) 의 타이핑 애니메이션 — 둘 다 "running 인지 멈췄는지" 신호인데 정량 (몇 초 / 몇 토큰) 정보 부족. 이 order 가 그 gap 채움.
- 데이터 매핑 (옵션 A 기준):
  - elapsed: `Date.now() - new Date(runner.startedAt).getTime()` (또는 lastEventAt 기반 since-last-event), 60초 미만 `45s`, 이상 `12m 30s` 식.
  - tokens: `runner.tokenUsage` 또는 telemetry stream 의 token_input/output 합산. 화살표 ↓ 는 "수신" 의미 시각화 (추가 의미 부여 시 ↑ ↓ 분리도 OK).
  - icon: lucide-react `Sparkles` 또는 `Loader2` (기존 패널 톤 일관). 사용자 스크린샷의 ※ 비슷한 톤이면 `Asterisk` 도 후보.
- 회귀 가드:
  - `prefers-reduced-motion` 시 spinner 같은 회전 애니메이션 비활성, 정적 dot.
  - 러너가 idle/stopped 일 때는 elapsed/token 표시 숨김 또는 dimmed.
  - 기존 binary status badge (PRD 207) 는 유지 — 그 위/옆 추가 영역으로 표시.

## Allowed Paths

- `apps/desktop/src/renderer/main.tsx`
- `apps/desktop/src/renderer/styles.css`

## Done When

- [ ] AiConversationPanel 하단에 elapsed time + token 카운트 한 줄이 표시된다.
- [ ] running 일 때만 표시, idle/stopped 시 숨김 또는 dimmed.
- [ ] 데이터 소스 IPC (`runner.startedAt` / `runner.lastEventAt` / `runner.tokenUsage`) 만 사용 — 새 IPC 추가 0.
- [ ] elapsed 가 1초마다 자동 갱신 (setInterval / RAF), unmount 시 cleanup.
- [ ] `prefers-reduced-motion` 사용자에서 spinner 등 회전 애니메이션 없음.
- [ ] `npm run desktop:check` 통과.
- [ ] 기존 binary status badge (PRD 207) 변동 없음.

## Verification

- Command: `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check`
- 보조: 데스크톱 dev 앱에서 worker 가 ticket 처리 중 패널 하단에 elapsed + token 한 줄이 시각 확인.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
