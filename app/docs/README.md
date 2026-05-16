# App Level

이 폴더는 **앱 레벨** 영역이다. Autoflow 데스크톱 앱(Electron)과 그 안에 흡수된 CLI 코드가 한 단위로 묶여 있다. 즉 "이 저장소에서 실행하는 것" 은 모두 이곳에 있다.

## 구조

```text
app/
  bin/autoflow     사용자 진입점 (Node -> app/cli/autoflow.ts)
  cli/             autoflow CLI 구현
    autoflow.ts      실제 command router
    runners/         planner/worker/verifier/wiki CLI surfaces
    system/          install/status/doctor/runners/tool 등 시스템 명령
    shared/          CLI 공통 헬퍼
  runtime/         runner 실행 코드 (BOARD_ROOT/PROJECT_ROOT env 만 받아 동작)
    runners/         planner/worker/verifier/wiki 별 도구·시작·종료 흐름
    system/          board-guard, stop hook, wake/stage/token, janitor
    shared/          공통 markdown/git/board/runner-tool 헬퍼
  src/             Electron 앱 본체
    main.js          Electron main process
    preload.js
    renderer/        React + Vite renderer
    main/            main-process TS helpers (e.g. node-pty-permissions.ts)
    components/
  scripts/         dev / check-syntax / postinstall 헬퍼 (.mjs)
  docs/            앱 레벨 설명 문서
  tsconfig.json    renderer + main 용
  vite.config.ts   renderer 빌드 설정
  components.json
```

## 문서 인덱스

| 문서 | 내용 |
|---|---|
| [README.md](README.md) | 앱 레벨 전체 구조, 빌드/실행, 설계 원칙 |
| [cli.md](cli.md) | `app/cli/` 내부 구조와 command ownership |
| [runtime/typescript-migration-inventory.md](runtime/typescript-migration-inventory.md) | runtime TypeScript migration 계약과 남은 호환 범위 |

`app/cli/` 의 자세한 내부 구조는 [cli.md](cli.md) 참고.

## 빌드 / 실행

루트에서 `npm install` 한 번이면 데스크톱 앱과 CLI 모두 동작한다. workspace 없음 — package.json 은 루트 하나.

```bash
npm install           # 의존성 설치 (electron native rebuild 포함)
npm run dev           # Electron dev + Vite HMR
npm run check         # syntax + tsc + vite build
npm run typecheck     # board + cli TS 타입 체크만
./app/bin/autoflow ...    # CLI 직접 호출
```

## 설계 원칙

- **단일 앱 정책.** 모노레포 시늉 없이 한 package.json, 한 node_modules. apps/, packages/ 같은 외형은 두지 않는다.
- **CLI 는 앱의 일부.** 사용자가 `app/bin/autoflow` 로 호출해도, GUI 가 spawn 해서 호출해도 같은 `app/cli/` 코드가 실행된다.
- **앱은 "설치 대상" 이 아니다.** 이 폴더의 어떤 파일도 target 보드로 복사되지 않는다. 보드로 들어가는 데이터 source 는 모두 [../../install/](../../install/) 에 있다.
- **runtime/ 도 앱이다.** runner 실행 코드는 보드 안이 아니라 여기 산다. 앱/CLI 가 `BOARD_ROOT`/`PROJECT_ROOT` env var 만 넘기고 실행. 보드가 자기 코드를 갖고 다니지 않으므로 보드는 데이터 폴더(`tickets/`, `logs/`, `state/`, `wiki/`) 만 갖는다.

## 데스크톱 화면 1차

프로젝트 루트 선택, `.autoflow/` 없으면 보드 설치, 마지막 업데이트/스냅샷, runner 목록·상태·add/remove·start/stop/restart·dry-run·one-shot, runner agent/model/reasoning/mode/interval/enabled/command 편집, runner 출력 패널 + 최근 실행 이력 + runtime/prompt/stdout/stderr artifact 열람, `doctor` health 와 runner adapter/mode, 상태 카운트·티켓 큐·로그·wiki·metrics history, ticket/log/wiki/metrics 검색·미리보기. 자세한 동작은 [../src/main.js](../src/main.js) 와 [../src/renderer/main.tsx](../src/renderer/main.tsx) 참고.
