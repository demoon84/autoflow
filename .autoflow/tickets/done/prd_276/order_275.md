# Autoflow Order

## Order

- Title: shell sanity gate 강화 — Allowed Paths 외부 파일 변경만으로 pass 통과 차단 (Todo-276 false-pass 재발 방지)
- Priority: high
- Status: ready
- Change Type: code

## Request

`finish-ticket-owner.ts` 의 shell sanity gate 가 현재 두 조건만 검사:
1. `git diff <Worktree.Base Commit>..HEAD` 변경 line 합 ≥ 1
2. `## Done When` 모든 `- [ ]` 가 `- [x]`

문제: ticket markdown 자체 (Done When 체크박스 [x] 박기) 가 diff 에 잡혀 line ≥ 1 조건 통과. 실제 코드는 0건이어도 pass.

실측 사례 (PRD_270 Todo-276, commit 1b57e9c, 2026-05-10 23:36):
- 변경 파일 2개: `tickets/done/prd_270/Todo-276.md`, `tickets/done/prd_270/order_234.md`
- 주장한 Done When: agent.md 3개 업데이트, buildInitialPrompt 힌트, start/finish hook, runtime/board-scripts 미러 — **전부 미적용**
- 결과: runner-tokens 통합이 dead 상태로 며칠 방치 (오늘 수동 보강)

## Allowed Paths

- .autoflow/scripts/finish-ticket-owner.ts
- .autoflow/scripts/common.sh
- runtime/board-scripts/finish-ticket-owner.ts
- runtime/board-scripts/common.sh

## Done When

- [ ] sanity gate 에 새 검사 추가: Done When 에 명시된 `Allowed Paths:` 섹션 (티켓 `## Allowed Paths` 또는 `## Order > Allowed Paths`) 의 path glob 중 **최소 1개 이상** 이 `git diff <base>..HEAD --name-only` 에 포함돼야 한다
- [ ] 단, 다음 경로는 항상 허용 (검증용 / 메타데이터):
  - `tickets/inprogress/Todo-*.md` (자기 자신만 수정한 경우는 차단)
  - `tickets/done/<key>/*.md` (finalizer 가 옮길 파일은 sanity gate 시점에 아직 존재 안 함)
- [ ] 실패 시 차단 reason: `shell_sanity_gate_allowed_paths_no_diff` 로 blocked 처리
- [ ] Change Type=`docs`, `cleanup` 인 티켓은 위 검사를 면제 (zero-diff 허용과 동일 정책)
- [ ] Change Type=`infra` 인 티켓도 그대로 적용 (실 코드 변경 필수)
- [ ] `runtime/board-scripts/` 미러 동기화
- [ ] 회귀 테스트: ticket markdown 만 수정해 pass 시도 → `shell_sanity_gate_allowed_paths_no_diff` 로 차단되는지 확인
- [ ] 정상 케이스: Allowed Paths 안의 파일 변경 + Done When [x] → pass 통과 확인

## Verification

- Command: grep -n "shell_sanity_gate_allowed_paths" .autoflow/scripts/finish-ticket-owner.ts

## Notes

- 1원칙 보존: sanity gate fail 시 ticket 은 `Stage: blocked` 로 두고 다음 worker tick 이 재시도. 사용자 park 안 함.
- Allowed Paths glob 매칭은 단순 prefix 또는 minimatch 수준이면 충분 (예: `.autoflow/scripts/*.ts` → `.autoflow/scripts/runner-tokens.ts` 매칭).
- false-pass 회복은 사후 처리. 이 PRD 는 재발 방지가 목적.
