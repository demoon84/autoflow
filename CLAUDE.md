# CLAUDE.md

@AGENTS.md

Claude Code는 이 파일을 먼저 읽으므로, 공통 규칙은 [AGENTS.md](AGENTS.md)를 import해서 따른다.

## Source Repo 경계

이 체크아웃은 Autoflow 제품/런타임 소스 저장소다. 루트에 설치 보드 `.autoflow/`를 만들지 않는다. 설치 보드에 들어갈 문서, 규칙, 템플릿, skill은 `install/` 아래 source를 수정하고, 실행 코드는 `app/` 아래에서 수정한다.

## 현재 러너 이름

사용자와 대화할 때는 아래 이름을 우선 사용한다.

- 플래너 러너 (`planner`)
- 워커 러너 (`worker`)
- 검증 러너 (`verifier`)
- 위키 러너 (`wiki`)

예전 AI식 runner 표기는 새 문서나 사용자-facing 설명에 추가하지 않는다.

## Handoff 언어

설치된 대상 프로젝트에서 `/autoflow`는 goal 기반 완료 루프, `/aprd`는 PRD 핸드오프, `/atodo`는 단일 파일 기계적 변경을 곧장 todo 로 보내는 경로다. 이 소스 저장소에서는 해당 설치 skill 의 원본을 `install/integrations/{claude,codex}/skills/{autoflow,aprd,atodo}/` 아래에서 관리한다.

새로 생성하는 PRD, 티켓, 사용자 설명은 한국어를 기본으로 한다. 단, 명령어, 파일 경로, section heading, key=value 출력, ticket id, runner id는 템플릿과 파서가 기대하는 그대로 유지한다.

## 검증

소스 변경 뒤에는 가능한 한 아래를 확인한다.

```bash
npm run typecheck
npm run check
./app/bin/autoflow doctor <project-root>
```

설치 검증은 이 저장소 밖의 별도 대상 프로젝트에서 `./app/bin/autoflow upgrade <project-root> .autoflow` 후 수행한다.
