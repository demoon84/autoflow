# PRD Branch Policy

PRD 단위로 main 에 1커밋만 박히도록 하기 위해, Autoflow 는 PRD 발행 시점에
전용 git 브랜치를 따고, PRD 의 모든 티켓이 done 으로 진입했을 때 main 으로
squash 머지한다.

## 보드 tracking 정책

설치 보드(`.autoflow/`) 의 의미 있는 산출물(PRD/티켓/wiki/reference/policy)
은 **git tracked** 다. 머신-local runtime state(runner pid/lock, metrics,
runner output, automation state)만 보드 안 내부 `.gitignore` 가 잡는다. 결과:

- PRD 발행 → `tickets/prd/PRD-NNN.md` 가 PRD 브랜치에 자연스럽게 commit 됨
- 티켓 done 이동 → `tickets/done/PRD-NNN/TODO-N.md` 가 PRD 브랜치에 commit
- 워크트리 작업 → product 코드 변경이 PRD 브랜치에 commit
- 워커 PRD 최종 squash → **main 1커밋 안에 product 코드 + PRD 본문 + 모든
  done 티켓 + 관련 wiki 변경이 모두 포함**됨

루트 `.gitignore` 에 `.autoflow/` 또는 보드 경로가 통째로 등록되어 있으면
PRD 본문이 main 에 보존되지 않는다. 신규 설치는 `ensureInstallGitignore`
가 자동으로 보드 경로를 ignore 패턴에서 빼고, 기존 설치는 `autoflow
upgrade` 출력의 `board_ignore_legacy=true` 안내를 받으면 사용자가 수동으로
해당 라인을 제거한다.

## 트랙 구분

티켓은 두 트랙 중 하나로 진행된다. 트랙은 티켓 frontmatter 의 `PRD Key`
필드 유무로 자동 분기된다.

- **PRD 트랙**: `/aprd` 핸드오프로 발행된 PRD 가 만든 티켓. 티켓에 `PRD Key`
  값이 있고, 워크트리는 PRD 브랜치 worktree 자체다. 워커는 TODO별 브랜치를
  만들지 않고 PRD worktree에 변경과 done ticket을 누적한다. 같은 PRD의 모든
  TODO가 done되면 마지막 TODO를 완료한 워커가 PRD 브랜치를 main/master로
  squash 머지한다.
- **atodo 트랙**: `/atodo` 가 만든 단일 티켓. `PRD Key` 가 비어 있다. 워크트리
  base 는 main HEAD. 워커는 worktree → main 으로 squash 머지한다. main 에는
  티켓당 1커밋만 박힌다.

## PRD 브랜치 명명/저장

PRD 발행 시점에 플래너가 다음을 수행한다.

1. `git branch autoflow/prd-NNN <main HEAD>` 로 PRD 브랜치 생성.
2. PRD worktree 생성.
3. PRD 파일 `tickets/prd/PRD-NNN.md` 작성.
4. PRD frontmatter 의 `## Project` 섹션에 신규 필드 기록:
   - `Branch: autoflow/prd-NNN`
   - `Base Commit: <git SHA>`

이 두 필드가 PRD 트랙임을 식별하는 단일 진실(source of truth)이다.

## 워크트리 base

워커가 워크트리를 만들 때 다음 순서로 base 를 결정한다.

1. 티켓의 `PRD Key` 가 있고, PRD 파일의 `Branch` 가 존재하면 그 PRD 브랜치
   worktree를 그대로 사용한다.
2. 티켓의 `PRD Key` 가 있는데 PRD branch가 없으면 block 한다. PRD 파생 TODO가
   TODO worktree로 fallback 하면 안 된다.
3. `PRD Key` 가 비어 있는 atodo ticket만 main HEAD에서 direct TODO worktree를
   만든다.

verifier 는 워크트리에 기록된 `Base Commit` 을 그대로 사용하므로, 자동으로
새 정책을 따라간다.

## 워커 머지 대상

- PRD 트랙: AI 워커가 verifier pass 직후 PRD worktree에 ticket done 상태를
  누적한다. 같은 PRD의 모든 TODO가 done된 마지막 ticket에서 PRD branch를
  main/master로 squash 머지한다.
- atodo 트랙: AI 워커가 verifier pass 직후 worktree → `main` 으로 머지한다.
  결과적으로 main 에 `[TODO-N] <summary>` 1커밋만 박힌다.

## 머지 방식 (강제)

워커가 main/master에 반영하는 모든 머지는 **반드시 `git merge --squash`** 를 사용한다.
`--no-ff`, plain `git merge`, fast-forward 외 방식은 허용하지 않는다.
이유: main/master에서 PRD cycle은 1커밋, atodo는 TODO당 1커밋만 남기기 위함이다.

머지 직후 board metadata / wiki 변경 같은 추가 사항은 **별도 commit 으로
분리하지 않는다.** 머지 commit 의 staging 에 함께 포함시키거나
`git commit --amend` 로 통합한다. promokit 로그에 보였던 `sync2/sync3` 같은
연속 commit 패턴은 모두 금지다.

충돌 해결은 AI 워커의 책임이다. 머지 도구는 충돌을 자동 해결하지 않는다.
충돌이 났다고 `--squash` 외 다른 머지 전략으로 우회하지 않는다 — 워크트리
또는 머지 대상에서 충돌을 직접 해결하고 같은 squash commit 을 완성한다.

### 충돌 해결 시 이전 작업 덮어쓰기 금지

충돌이 발생하면 한 쪽을 임의로 선택해 덮어쓰지 않는다. 워커는 충돌 영역의
이전 작업 의도를 먼저 파악해야 한다:

1. **위키 검색 필수**: `autoflow tool runner-tool wiki query --runner
   <runner-id> --question "<conflict 파일 경로 또는 함수명>"` 으로 충돌
   영역의 누적 지식을 확인한다.
2. **done 티켓 확인**: `tickets/done/<project-key>/` 에서 같은 파일을 만진
   이전 티켓들을 읽어 의도와 제약을 확인한다.
3. **양쪽 의도 보존**: 두 변경이 통합 가능하면 통합한다. 한 쪽 변경을
   단순 폐기하지 않는다.
4. **상충 시 멈춤**: 두 의도가 진짜로 상충하면 ticket `## Notes` 에 충돌
   사유와 양쪽 의도를 기록하고 멈춘다. 임의로 한 쪽을 선택하지 않는다.
   사용자 지시를 기다린다.

이 규칙은 PRD 트랙과 atodo 트랙 모두에 적용된다.

## PRD 최종 squash

PRD 의 모든 티켓이 `tickets/done/PRD-NNN/` 아래에 도착하면 마지막 TODO를
완료한 워커 러너가 PRD 최종 squash 단계를 실행한다.

1. 모든 티켓이 done 상태인지 검증 (아니면 fail).
2. PRD 브랜치가 존재하는지, main 으로 머지 가능한지 검증.
3. main 체크아웃 → `git merge --squash autoflow/prd-NNN`.
4. 커밋 메시지 `PRD-NNN 완료` 으로 1커밋 발행. 긴 PRD 제목이나 `... [truncated]` summary를 subject에 넣지 않는다.
5. PRD 파일을 `tickets/prd/PRD-NNN.md` → `tickets/done/PRD-NNN/PRD-NNN.md`
   로 아카이브 (`item-archive` 와 동일 정책).
6. 성공: `git branch -d autoflow/prd-NNN`.
   실패/취소: `git branch -m autoflow/prd-NNN autoflow/prd-NNN-abandoned` 로
   rename 보관 (재개·디버그 가능).

## 동시 PRD

여러 PRD 가 병렬 진행될 수 있다. 각 PRD 는 main 에서 분기된 독립 브랜치라
서로 영향이 없다. 두 PRD 가 같은 파일을 건드리는 경우는 마지막 squash 머지
시점에 충돌이 발생한다. 그때 AI/사람이 해결한다.

## 미완 PRD 마이그레이션

이 정책은 신규 PRD를 기준으로 한다. 현 시점에는 기존 PRD 마이그레이션을
자동 수행하지 않는다. PRD frontmatter 의 `Branch` 필드가 비어 있는 PRD 파생
TODO는 TODO worktree로 fallback하지 않고 block 한다.

## 코드/문서 참조

- 워크트리 base 결정: [worktree.ts](app/runtime/shared/runner-tool/worktree.ts)
- verifier diff base: [diff.ts](app/runtime/shared/runner-tool/diff.ts)
- PRD 발행: [write-prd.ts](app/runtime/runners/planner/tools/write-prd.ts)
- PRD 아카이브: [item-archive.ts](app/runtime/runners/planner/tools/item-archive.ts)
- PRD 템플릿: [prd-template.md](install/share/reference/prd-template.md)
- 워커 머지 규칙: [worker.md](install/share/reference/runner-startup-rules/worker.md)
- 호스트 규칙: [AGENTS.md](install/host/AGENTS.md)
