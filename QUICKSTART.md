# Autoflow 빠른 시작

처음 만지는 사람이 현재 구조를 기준으로 보드를 설치하고 첫 흐름을 확인하는 최소 절차다. 전체 구조는 [README.md](README.md), 작업 규칙은 [AGENTS.md](AGENTS.md)를 본다.

## 1. 준비

- Node.js 20 이상
- Git
- 선택한 로컬 에이전트 CLI 하나 이상
  - Codex CLI
  - Claude Code

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

모든 작업은 `autoflow` 목표 한 가지 입력으로 들어간다. 작은 변경도 `autoflow` skill 대화가 필요한 PRD로 발행한다.

```bash
./app/bin/autoflow prd create <project-root> \
  --title "새 기능" \
  --goal "사용자가 완료 조건을 확인할 수 있게 한다" \
  --from-file ./request.md
```

Codex/Claude skill 을 쓰는 프로젝트라면 사용자 대화에서는 `$autoflow` / `/autoflow` 로 goal 기반 skill을 시작한다. Skill 대화는 프로젝트 상태와 LLM Wiki를 참고해 PRD를 발행하고, 보드 evidence로 목표 충족 여부를 확인한 뒤 goal complete를 선언한다.

## 4. 러너 실행

처음에는 집중형 명령을 한 번씩 실행해서 보드 상태와 시작 컨텍스트를 확인한다.

```bash
./app/bin/autoflow run planner <project-root>
./app/bin/autoflow run worker <project-root>
./app/bin/autoflow run wiki <project-root>
```

`run planner`, `run worker`, `run wiki`는 role assignment 실행 표면이다. 장기 실행 프로세스는 데스크톱 앱의 3개 고정 러너가 관리한다.

역할:

- 플래너 역할(`planner`): 지정 PRD를 work item으로 분해
- 워커 역할(`worker`): 지정 work item 구현, 로컬 검증 evidence 기록, sanity gate / merge target verification rerun 을 거쳐 worker finalize-approved 가 PRD worktree commit + (마지막 TODO 면) main squash merge 까지 자동 수행
- 위키 역할(`wiki`): 완료 evidence에서 파생 지식 갱신

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
- `.autoflow/`는 개인 로컬 실행 원장이며 Git에 커밋하지 않는다. 공유가 필요한 내용은 PR 요약이나 별도 문서로 명시적으로 export한다.
- 루트 Autoflow 저장소에는 `.autoflow/` 보드를 만들지 않는다.
- `app/runtime/` 코드는 보드에 복사되지 않는다. 보드의 `manifest.toml`은 전역 core/share 참조와 schema 정보를 기록한다.
- 개발 중에는 `./app/bin/autoflow dev-link`로 현재 core를 전역 registry에 등록하면 보드가 `<core-root>/install/share`와 runtime을 직접 참조하므로 공통 파일 업그레이드 없이 수정 사항을 바로 볼 수 있다.
- `autoflow upgrade`는 공통 파일 복사가 아니라 보드 schema migration, 누락 scaffold 보정, host guidance refresh에 집중한다.
- 막힌 흐름은 `autoflow doctor <project-root>` 와 `tickets/inprogress/`를 먼저 본다.

## 7. 다음 문서

- [README.md](README.md): 현재 저장소 구조와 핵심 개념
- [app/docs/README.md](app/docs/README.md): 앱 레벨 구조
- [app/docs/cli.md](app/docs/cli.md): CLI command ownership
- [install/docs/README.md](install/docs/README.md): 설치 레벨 구조
