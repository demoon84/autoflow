# Legacy Review Startup Rule

이 파일은 이전 `verifier` role 호환을 위해 남겨둔 비활성 startup rule이다.

현재 데스크톱이 기본으로 표시하고 실행하는 active runner는 `planner`, `worker`, `wiki-maintainer`다. TODO 마무리는 워커 러너의 `worker finalize-approved` 단일 흐름을 사용한다.

새 설치와 새 runner prompt에서는 이 파일을 active startup rule로 사용하지 않는다.
