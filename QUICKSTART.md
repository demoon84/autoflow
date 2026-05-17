# Autoflow Quickstart

처음 만지는 사람이 현재 구조를 기준으로 보드를 설치하고 첫 흐름을 확인하는 최소 절차다. 전체 구조는 [README.md](README.md), 작업 규칙은 [AGENTS.md](AGENTS.md)를 본다.

## 1. 준비

- Node.js 20 이상
- Git
- 선택한 로컬 에이전트 CLI 하나 이상
  - Codex CLI
  - Claude Code
  - Gemini CLI

에이전트 인증 정보는 각 도구의 홈 설정에 둔다. `.autoflow/` 보드 안에는 API key나 로그인 토큰을 두지 않는다.

## 2. 설치

```bash
git clone <repo-url> <autoflow-repo>
cd <autoflow-repo>
npm install
npm run check
```

대상 프로젝트에 보드를 설치한다.

```bash
./app/bin/autoflow init <project-root>
./app/bin/autoflow doctor <project-root>
```

`doctor`가 `status=ok`이면 기본 보드 구조와 host guidance가 준비된 상태다. 경고가 있으면 메시지에 나온 파일을 먼저 확인한다.

## 3. 입력 만들기

작은 요청은 order로 넣는다.

```bash
./app/bin/autoflow order create <project-root> \
  --title "본문 폰트" \
  --request "본문 폰트 크기를 2px 키워줘" \
  --allowed-path app/src/renderer/styles.css \
  --verification "npm run check"
```

큰 작업은 PRD로 넣는다.

```bash
./app/bin/autoflow prd create <project-root> \
  --title "새 기능" \
  --goal "사용자가 완료 조건을 확인할 수 있게 한다" \
  --from-file ./request.md
```

Codex/Claude skill을 쓰는 프로젝트라면 사용자 대화에서는 `$autoflow` / `/autoflow` 로 PRD를 만들고, `$order` / `/order` 로 작은 요청을 만든다.

## 4. 러너 실행

처음에는 집중형 명령을 한 번씩 실행해서 보드 상태와 시작 컨텍스트를 확인한다.

```bash
./app/bin/autoflow run planner <project-root>
./app/bin/autoflow run worker <project-root>
./app/bin/autoflow run verifier <project-root>
./app/bin/autoflow run wiki <project-root>
```

`run planner`는 order/PRD를 다음 단계로 승격한다. `run worker`는 owned active ticket 또는 다음 todo 후보를 보여주는 시작 컨텍스트이며, 단독으로 구현 루프를 오래 실행하지 않는다. `run verifier`는 verifier 대기 티켓이 있을 때 wake marker를 준비한다. `run wiki`는 wiki baseline update 확인용이다. 일반 위키 러너 루프에서는 먼저 `autoflow tool runner-tool wiki tick`을 호출한다. `runners start` 계열 CLI는 runner state/config 준비 명령이며, 데스크톱 앱이 실제 PTY runner 프로세스를 띄운다.

역할:

- 플래너 러너(`planner`): order / PRD를 Todo 티켓으로 정리
- 워커 러너(`worker`): Todo claim, worktree 작업, 로컬 검증, 검증 러너 handoff, pass 후 merge/finalization, revise/replan 처리
- 검증 러너(`verifier`): pass / revise / replan 판단과 워커 wake
- 위키 러너(`wiki`): 완료된 작업에서 debounce 된 운영 지식 갱신

상태 확인:

```bash
./app/bin/autoflow status <project-root>
./app/bin/autoflow runners list <project-root>
```

## 5. 데스크톱 앱

```bash
cd <autoflow-repo>
npm run dev
```

앱에서 대상 프로젝트 폴더를 선택한다. 보드가 없으면 설치 버튼이 뜨고, 보드가 있으면 티켓, 러너, 로그, 위키, doctor 상태를 한 화면에서 볼 수 있다.

## 6. 운영 메모

- 플래너 러너와 위키 러너는 보통 한 보드에서 하나만 켠다.
- 워커 러너는 여러 개 둘 수 있지만, 한 워커는 한 번에 한 티켓만 claim한다.
- 루트 Autoflow 저장소에는 `.autoflow/` 보드를 만들지 않는다.
- `app/runtime/` 코드는 보드에 복사되지 않는다. `autoflow upgrade`는 `install/` source를 대상 프로젝트 보드에 동기화한다.
- 막힌 흐름은 `autoflow doctor <project-root>` 와 `tickets/inprogress/`, `tickets/verifier/`, `runners/logs/`를 먼저 본다.

## 7. 다음 문서

- [README.md](README.md): 현재 저장소 구조와 핵심 개념
- [app/docs/README.md](app/docs/README.md): 앱 레벨 구조
- [app/docs/cli.md](app/docs/cli.md): CLI command ownership
- [install/docs/README.md](install/docs/README.md): 설치 레벨 구조
