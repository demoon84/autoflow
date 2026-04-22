# Spec

`rules/spec/` 은 `BOARD_ROOT` 안에 두는 기준 문서 폴더다.

## 최소 구성

- `project-spec-template.md`: 프로젝트 전체 기준
- `feature-spec-template.md`: 기능 단위 기준
- 패키지 소스 기준 예시: `autoflow-package-spec.md`
- generated board starter 예시: `templates/board/rules/spec/project_001.md`

## 원칙

- 스펙이 먼저다.
- 티켓은 실제 스펙 파일을 참조해야 한다.
- 템플릿 파일만 있고 실제 스펙이 없으면 티켓을 만들지 않는다.
- 스펙이 바뀌면 관련 티켓도 다시 점검한다.
- 제품 코드 경로는 `PROJECT_ROOT` 기준으로 설명하는 편이 좋다.
