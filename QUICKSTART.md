# Autoflow 빠른 시작

처음 만지는 팀원이 5분 안에 첫 티켓을 흘려보내기 위한 최소 절차다. 깊은 내용은 [`README.md`](README.md) 와 [`AGENTS.md`](AGENTS.md) 를 본다.

## 1. 사전 준비

- macOS / Linux, Bash, Git
- Node 20+ (데스크톱 앱을 쓰려면)
- 어댑터 CLI 중 **하나 이상** 을 직접 설치하고 본인 계정으로 로그인해 둔다.
  - Claude Code: <https://docs.claude.com/en/docs/claude-code/quickstart>
  - Codex CLI: <https://github.com/openai/codex>
  - Gemini CLI: <https://github.com/google-gemini/gemini-cli>

> 어댑터 인증 자격은 각자 홈(`~/.claude/`, `~/.codex/`, `~/.config/`)에 저장된다. **`.autoflow/` 폴더에는 어떤 키도 두지 않는다.** 보드는 git 으로 공유돼서 키가 새는 사고를 막아야 한다.

## 2. 설치

```bash
# 이 저장소를 어딘가에 둔다 (예: ~/code/autoflow)
git clone <this-repo> ~/code/autoflow

# 작업할 프로젝트에 보드를 설치
~/code/autoflow/bin/autoflow init /path/to/your/project
```

`init` 출력에 `adapter.claude=ok`, `adapter.codex=ok`, `adapter.gemini=ok` 중 적어도 하나가 있어야 한다. 모두 `missing` 이면 어댑터 CLI 가 PATH 에 없다는 뜻이다 — 1번 단계로 돌아간다.

## 3. 첫 PRD / 첫 주문 만들기

방법은 두 가지다.

- **PRD 핸드오프** (큰 작업): Claude / Codex 에서 `/af` 또는 `#af` 를 쓴다. AI 가 PRD 를 정리해서 `.autoflow/tickets/prd/prd_NNN.md` 에 저장한다.
- **빠른 주문** (작은 변경): `/order` 또는 `#order` 를 쓴다. `.autoflow/tickets/order/order_NNN.md` 에 짧은 노트로 떨어진다.

CLI 로 직접 만들 수도 있다.

```bash
~/code/autoflow/bin/autoflow order create /path/to/your/project \
  --request "본문 폰트 크기를 2px 키워줘" \
  --title "본문 폰트" \
  --allowed-path apps/desktop/src/renderer/styles.css \
  --verification "npm run desktop:check"
```

## 4. 자동화 띄우기

```bash
# 한 번씩 손으로 돌려보면서 흐름 익히기
~/code/autoflow/bin/autoflow run planner /path/to/your/project    # PRD queue/order queue → todo
~/code/autoflow/bin/autoflow run ticket  /path/to/your/project    # todo → done

# 익숙해지면 loop 모드로 두 runner 를 켠다
~/code/autoflow/bin/autoflow runners start planner /path/to/your/project
~/code/autoflow/bin/autoflow runners start worker   /path/to/your/project
~/code/autoflow/bin/autoflow runners start wiki    /path/to/your/project
```

상태는 `~/code/autoflow/bin/autoflow status /path/to/your/project` 로 본다.

## 5. 데스크톱 앱

```bash
cd ~/code/autoflow/apps/desktop
npm install
npm run dev
```

좌측 사이드바 → "프로젝트 폴더 선택" → 본인 프로젝트를 고른다. 보드가 없으면 "Install" 버튼이 뜬다.

## 6. 팀 출시 시 꼭 알 것

- **Plan AI 는 한 머신에서만 돌린다.** 여러 명이 동시에 `planner` loop 을 켜면 `tickets/prd` `tickets/todo` 가 git 충돌난다.
- **티켓 보드는 git 으로 추적**된다. 각자 작업한 결과를 `git pull/push` 로 공유한다. 어댑터 키, runner state, 로그는 git 무시.
- **막힌 티켓이 보이면**: `bin/autoflow doctor /path/to/your/project` 로 진단을 본다. retry 가 필요하면 verifier replan 뒤 worker 가 `tickets/order/order_*_retry_*.md` 로 재발행한다.

## 7. 자주 하는 실수

| 증상 | 원인 / 해결 |
|---|---|
| `adapter.X=missing` 로그 | 어댑터 CLI 가 PATH 에 없음. 본인 셸의 `PATH` 를 확인. |
| 티켓이 며칠째 inprogress | verifier revise/replan 이후 worker 처리가 막혔을 가능성. 최신 `.autoflow/logs/verifier_NNN_*.md` 와 ticket `Next Action` 을 본다. |
| Wiki 가 갱신 안 됨 | `wiki` 은 debounce(기본 3변동/30분)를 적용한다. 즉시 보고 싶으면 `bin/autoflow run wiki <project>` 를 한 번 직접 호출. |
| 보드 충돌 | 여러 명이 같은 ticket 을 동시에 claim. Plan/Wiki AI 는 1명만, worker 은 자기 worktree 안에서만 동작. |

## 8. 더 자세히

- 운영 규칙: [`AGENTS.md`](AGENTS.md)
- 보드 구조: [`.autoflow/README.md`](.autoflow/README.md)
- 에이전트 워크플로우: [`.autoflow/agents/`](.autoflow/agents/)
