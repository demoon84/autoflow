# PRD Branch Policy

Autoflow는 PRD 단위 worktree를 사용한다. `autoflow` skill 대화가 PRD를 발행하면 전용 PRD branch/worktree가 만들어지고, Planner가 만든 TODO는 parent PRD worktree 안에서 처리된다.

`<id>`는 `001` 같은 숫자 ticket id다.

## 보드 Git 정책

설치 보드(`.autoflow/`)는 개인 로컬 실행 원장이며 기본적으로 Git 추적 대상이 아니다. `autoflow init|upgrade`는 대상 프로젝트의 `.gitignore`에 보드 디렉터리를 추가한다.

Git에는 제품 코드, 테스트, 문서, 설정처럼 팀이 공유할 결과물만 남긴다. PRD, work item, verifier evidence, wiki, runner state는 로컬 보드에 보관하고, 공유가 필요하면 별도 export나 PR 요약으로 명시적으로 꺼낸다.

## PRD Branch

PRD 발행은 스킬 단계와 플래너 단계로 나뉜다.

스킬 단계:

1. `autoflow` 스킬은 로컬 보드에 PRD 파일 `tickets/prd/PRD-<id>.md`만 작성한다.
2. 스킬은 branch/worktree를 만들지 않는다.
3. 발행 시점에 branch 정보가 아직 없으면 PRD `## Project` 섹션의 `Branch`와 `Base Commit`은 `TBD`로 둘 수 있다.

플래너 단계:

1. `git branch autoflow/prd-<id> <main HEAD>`로 PRD branch 생성.
2. PRD worktree 생성/보장.
3. PRD `## Project` 섹션에 다음 필드 기록:
   - `Branch: autoflow/prd-<id>`
   - `Base Commit: <git SHA>`

이 두 필드는 해당 PRD의 branch/worktree source of truth다.

## TODO Worktree

TODO는 parent PRD worktree를 사용한다. TODO가 parent PRD branch/worktree를 찾지 못하면 Worker는 구현을 시작하지 않고 `blocked` evidence를 남긴다.

Verifier pass 전에는 TODO 결과를 완료 commit으로 반영하지 않는다.

## Worker Commit

Verifier가 pass를 기록하면 Worker는 해당 TODO 결과를 PRD worktree에 commit으로 반영한다. Commit에는 제품 변경만 포함하고, TODO/verifier evidence는 로컬 보드에 남긴다.

Verifier가 revise 또는 replan을 기록하면 Worker는 Verifier 후속조치에 따른다. 실패한 결과는 완료 commit으로 반영하지 않는다.

## PRD Worktree Merge

PRD 기준 모든 TODO가 완료되면 마지막 TODO를 처리한 Worker가 PRD worktree를 main/master에 반영한다.

1. 해당 PRD의 모든 TODO가 verifier pass 이후 commit되었는지 확인한다.
2. PRD branch와 target branch 상태를 확인한다.
3. target branch에서 `git merge --squash autoflow/prd-<id>`를 실행한다.
4. 충돌이 있으면 PRD 범위 안에서 해결하거나 `blocked` evidence를 기록한다.
5. 필요한 final verification을 실행한다.
6. PRD와 TODO evidence를 로컬 보드의 `tickets/done/<project-key>/` 아래에 archive한다.
7. 커밋 메시지는 `PRD-<id> 완료`처럼 짧고 안정적인 subject를 사용한다.
8. 성공하면 해당 PRD worktree와 `autoflow/prd-<id>` branch를 정리한다.

`Merge` runner는 없다.

## 머지 방식

main/master 반영은 반드시 `git merge --squash`를 사용한다. `--no-ff`, plain `git merge`, fast-forward 전용 흐름은 사용하지 않는다.

## 충돌 해결

충돌이 발생하면 한쪽을 임의로 선택해 덮어쓰지 않는다.

1. 같은 파일을 다룬 done evidence를 확인한다.
2. LLM Wiki에 관련 결정이나 learning이 있으면 참고한다.
3. 두 변경이 통합 가능하면 통합한다.
4. 진짜로 상충하면 PRD/TODO `Notes`에 충돌 사유와 양쪽 의도를 기록하고 `blocked`로 둔다.

## 동시 PRD

여러 PRD는 서로 독립된 branch/worktree를 사용할 수 있다. 같은 파일을 건드리는 PRD는 마지막 Worker의 PRD worktree merge 시점에 충돌이 드러날 수 있다.

## 코드/문서 참조

- 워크트리 base 결정: `app/runtime/shared/runner-tool/worktree.ts`
- verifier diff base: `app/runtime/shared/runner-tool/diff.ts`
- PRD 발행: `app/runtime/runners/planner/tools/write-prd.ts`
- PRD 템플릿: `install/share/reference/prd-template.md`
- 호스트 규칙: `install/host/AGENTS.md`
