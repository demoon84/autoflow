# CLAUDE.md

@AGENTS.md

Claude Code는 이 파일을 먼저 읽으므로, 공통 규칙은 [AGENTS.md](AGENTS.md)를 import해서 따른다.

## Source Repo 경계

이 체크아웃은 Autoflow 제품/런타임 소스 저장소다. 새 보드의 source of truth 는 `install/` 아래에 있고, runner 동작 코드는 `app/runtime/` 에 있다. 보드에 들어갈 문서/규칙/템플릿/skill 은 `install/` 을 수정하고, 실행 코드는 `app/` 아래에서 수정한다.

루트의 `.autoflow/` 는 dev test 용 인스턴스로 사용할 수 있다. 동작 코드는 보드에 복사되지 않고 `app/runtime/` 에서 실행되며, `.gitignore` 가 `.autoflow/` 와 그 안의 derived 데이터를 git tree 에서 보호한다. `.autoflow/` 안의 변경은 인스턴스 데이터일 뿐이고 source of truth 가 아니다. 보드 템플릿을 바꾸려면 항상 `install/board/` 의 source 를 수정한다.

## 현재 러너 이름

사용자와 대화할 때는 아래 이름을 우선 사용한다.

- 플래너 러너 (`planner`)
- 워커 러너 (`worker`)
- 위키 러너 (`wiki`)

검증 러너(`verifier`)는 legacy 비활성 역할이다. 사용자-facing 새 문서에는 활성 역할로 안내하지 않는다. 워커 finalize-approved 가 sanity gate + merge target verification rerun 으로 단일 마무리한다.

예전 AI식 runner 표기는 새 문서나 사용자-facing 설명에 추가하지 않는다.

## Handoff 언어

설치된 대상 프로젝트에서 `/autoflow`는 goal 기반 skill 진입점이다. 이 소스 저장소에서는 설치 skill 원본을 `install/integrations/{claude,codex}/skills/autoflow/` 아래에서 관리한다.

새로 생성하는 PRD, 티켓, 사용자 설명은 한국어를 기본으로 한다. 단, 명령어, 파일 경로, section heading, key=value 출력, ticket id, runner id는 템플릿과 파서가 기대하는 그대로 유지한다.

## 검증

소스 변경 뒤에는 가능한 한 아래를 확인한다.

```bash
npm run typecheck
npm run check
./app/bin/autoflow doctor <project-root>
```

설치 검증은 source repo 루트 또는 별도 대상 프로젝트에서 `./app/bin/autoflow upgrade <project-root> .autoflow` 후 수행한다.
