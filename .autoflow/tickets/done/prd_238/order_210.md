# Autoflow Order

## Order

- Title: 보드 / wiki / 텔레메트리 미커밋 변경 정리 및 staging 정책 점검
- Priority: normal
- Status: ready
- Change Type: cleanup

## Request

git 변경 내용 중 커밋되지 않은 내용 정리 (53개 untracked, 8개 modified, 4개 deleted)

## Context

`git status --short` 현재 상태:

- **Modified (8건)**:
  - `.autoflow/telemetry/runs.jsonl` (텔레메트리 누적, 정기 commit 필요)
  - `.autoflow/tickets/done/prd_232/Todo-234.md` (worker 완료 후 잔여 변경?)
  - `.autoflow/wiki/agents/prompt-evolution.md`, `index.md`, `log.md`,
    `operations/runner-health.md`, `operations/runner-timing.md` (Wiki AI 산출물)
  - `AGENTS.md` (호스트 규약 변경)
- **Deleted (4건)**: `.autoflow/tickets/todo/Todo-218.md`, `Todo-220.md`,
  `Todo-222.md`, `Todo-223.md` — 이미 done/<prd>/ 으로 이동했지만
  todo/ 의 원본 삭제는 아직 commit 안 됨
- **Untracked (53건)**:
  - `.autoflow/tickets/done/prd_215/`, `prd_219/`, `prd_221/`, `prd_236/`
    아래 `order_*_retry_*.md` (retry 흔적)
  - `.autoflow/tickets/inbox/order_209.md` (방금 발행한 order)
  - `.autoflow/wiki-raw/order_*.md`, `prd_*.md` (Wiki AI 가 생성한 raw 자료)

문제:
1. wiki 변경이 master commit 으로 흘러들어가면 PROJECT_ROOT dirty 가 자동화에 충돌.
   `.autoflow/wiki/` 는 `.gitignore` 대상이어야 하는데 staging 에 modified 가 남는 건
   gitignore 정책 (curated `skills/` 만 트래킹) 위반 또는 누락 신호.
2. `.autoflow/wiki-raw/` 은 Wiki AI 의 work directory — gitignored 여야 정상.
3. retry order 흔적 (`done/<prd>/order_*_retry_*.md`) 은 보존해야 하는 evidence 인지,
   휘발성 흔적인지 정책 명시 필요.
4. todo/Todo-* 삭제와 done/<prd>/ 이동은 한 commit 으로 묶여야 정합성 유지.

## Allowed Paths

- .autoflow/
- .gitignore
- AGENTS.md

## Done When

- [ ] `.gitignore` 가 `.autoflow/wiki/` (curated `skills/` 제외) 와 `.autoflow/wiki-raw/` 를 모두 제외하는지 확인하고, 누락이면 추가
- [ ] 현재 modified 8건 중 정상 산출물(`telemetry/runs.jsonl`, `AGENTS.md`, 적절한 ticket markdown 변경)은 commit, 누수(wiki dirty 등)는 정책에 따라 처리
- [ ] deleted 4건과 그에 대응되는 `done/<prd>/` 추가가 한 commit 으로 묶이거나, 이미 별 commit 으로 정합성이 맞으면 그 사실을 commit message 에 기록
- [ ] retry order (`done/<prd>/order_*_retry_*.md`) 의 보존 정책을 AGENTS.md 또는 README 에 한 줄로 명시
- [ ] 정리 후 `git status --short` 가 비거나, 의도된 변경(이번 정리 commit) 만 남는다
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- `git push` 는 절대 사용하지 않는다 (1원칙).
- 관련 규약: AGENTS.md rule 18 (wiki autocommit content gate),
  `.autoflow/` 는 board 영역, wiki 는 gitignored (curated 제외).
- 이번 cleanup 은 worker 가 직접 실행하기보다, 사용자/Plan AI 가 단일 commit
  단위로 분류해 처리하는 게 안전. worker 에게 위임할 때는 Allowed Paths 가
  `.autoflow/` 전체이므로 신중한 staged commit 흐름이 필요.
