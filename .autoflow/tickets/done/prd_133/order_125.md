# Autoflow Order

## Order

- ID: order_125
- Title: logs/.md outcome 로그 retention 정책 부재 + deprecated 잔재
- Status: inbox
- Created At: 2026-05-03T08:52:57Z
- Source: autoflow order create

## Request

## Request

`.autoflow/logs/` 가 markdown outcome 로그(`verifier_*_{pass,fail}.md`, `owner_*_blocked.md`, `coordinator_*_blocked.md`, `manual_worktree_merge_*.md` 등)를 무한히 누적한다. 8일치 누적으로 약 318+개. 정리 정책 부재.

`packages/cli/cleanup-runner-logs.sh` 의 `cleanup_patterns` 는 `*_stdout.log`, `*_stderr.log`, `*_prompt.log`, `*_runtime.log`, `*_dry-run.log`, `*_live_*.log`, `*_last_message.txt` 만 처리. **`.md` 패턴은 모두 제외**.

추가 발견:
- deprecated 토폴로지 잔재 로그가 함께 누적: `coordinator_20260426T*_blocked.md` (현재 토폴로지에 coordinator 런너 없음), `owner_002_*`, `manual_worktree_merge_*`
- `branch-cleanup_20260426T043551Z/` 같은 디렉토리도 잔재

## Suggested Fix

### A) outcome log retention 정책
`cleanup-runner-logs.sh` 또는 별도 `archive-outcome-logs.sh` 에 다음 정책:

```
- verifier_<id>_*_pass.md / _fail.md
  - 14일 경과시 .gz 압축 또는 .autoflow/logs/archive/YYYY-MM/ 로 이동
  - 90일 경과시 삭제 (또는 .autoflow/wiki/log.md 에 통합 후 삭제)
- coordinator_*, owner_*, branch-cleanup_*
  - deprecated 패턴 → 즉시 정리 (현재 0건 유효)
- manual_worktree_merge_*
  - 30일 retention
```

### B) deprecated 패턴 즉시 정리
```bash
rm .autoflow/logs/coordinator_*_blocked.md
rm .autoflow/logs/owner_*_blocked.md
rm -rf .autoflow/logs/branch-cleanup_*
rm .autoflow/logs/manual_worktree_merge_*.md  # (또는 별도 archive 로 이동)
```

### C) Wiki 통합 옵션
verifier outcome 의 핵심 (pass/fail count, fail reasons) 은 `.autoflow/wiki/log.md` 에 이미 일부 통합됨. retention 정책에서 통합 후 원본 삭제도 검토.

## Allowed Paths

- packages/cli/cleanup-runner-logs.sh
- 또는 새 packages/cli/archive-outcome-logs.sh
- .autoflow/logs/ (정리 시)

## Verification

```bash
# 정책 적용 후
find .autoflow/logs -name "*.md" -mtime +14 | wc -l  # 0 또는 archive 폴더에만
find .autoflow/logs -name "coordinator_*" -o -name "owner_002_*" | wc -l  # 0
ls .autoflow/logs/ | wc -l  # 합리적 수 (50~100 수준)
```

## Notes

- ticket 처리 cycle 가 빠르게 돌고 있어 (5분에 verifier_*_pass.md 1~2개 추가) retention 정책 없으면 1년 안에 수만개 누적.
- `find -mtime +7 = 0` 인데도 4월 26일자 파일이 보이는 건 git checkout 으로 mtime 이 갱신됐기 때문. 정책은 파일명의 timestamp 기준으로 가는 것이 견고함.
- order_123 (stale state) 와 비슷한 cleanup 카테고리. 묶어서 PRD 로 가도 좋음.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/cleanup-runner-logs.sh`

### Verification

- Command: find .autoflow/logs -name 'coordinator_*' | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
