# Autoflow Order

## Order

- ID: order_123
- Title: runners/state stale 파일 cleanup (legacy + mktemp 잔재)
- Status: inbox
- Created At: 2026-05-03T08:23:48Z
- Source: autoflow order create

## Request

## Request

`.autoflow/runners/state/` 에 토폴로지 refactor 이후 더 이상 어떤 코드도 참조하지 않는 stale 파일이 누적돼 있다. 새 토폴로지(`planner` / `worker` / `wiki` / `verifier`)는 suffix 없이 동작하지만 legacy `-1` suffix 파일과 mktemp 잔재로 보이는 random-suffix 파일이 함께 남아 있다.

확인된 stale 파일 (2026-05-03 시점):
```
owner-1.state                     # legacy ticket-owner runner (5/2)
planner-1.state                   # legacy 5/2
wiki-1.state                      # legacy 5/2
wiki-1.semantic-lint.fingerprint
wiki-1.semantic-lint.pages.d/     # 60 sub-files
wiki-1.wiki-debounce.state
wiki-1.wiki-inputs.fingerprint
wiki-1.wiki-inputs.manifest       # 85,634 bytes
wiki.state.CWxbDK                 # 8B mktemp 잔재 (5/2)
wiki.state.wLVnDN                 # 40B mktemp 잔재 (5/3)
```

검증: `grep -rn "owner-1\|wiki-1\|planner-1" packages/cli/*.sh` → 매치 없음. 즉 코드에서 더 이상 참조하지 않음.

`wiki.state.<RANDOM>` 패턴은 wiki-project.sh 의 `autoflow_mktemp` 가 state 디렉토리를 TMPDIR 로 사용하면서 atomic write 의 `.state.tmp.XXX` 잔재로 추정. 정상 흐름에서는 `mv` 로 state 본체로 이동되거나 trap 으로 cleanup 되어야 하는데 빠진 케이스가 있는 듯.

## Suggested Fix

A) one-shot 정리 (즉시):
```bash
rm .autoflow/runners/state/owner-1.state
rm .autoflow/runners/state/planner-1.state
rm .autoflow/runners/state/wiki-1.*
rm -rf .autoflow/runners/state/wiki-1.semantic-lint.pages.d
rm .autoflow/runners/state/wiki.state.CWxbDK
rm .autoflow/runners/state/wiki.state.wLVnDN
```

B) cleanup-runner-logs.sh 또는 새 `cleanup-runner-state.sh` 에 stale state 패턴 추가:
- `*-1.state` (legacy suffix), 일정 mtime 이상 오래되고 현재 runner config 에서 비활성인 경우만
- `wiki.state.<6char>` 같은 mktemp 잔재 (24h 이상 mtime)
- 매 worker tick 직후 또는 별도 스케줄 cleanup hook

C) `wiki.state.<RANDOM>` leak 의 root cause 분석: wiki-project.sh 의 `autoflow_mktemp` 가 `state/` 안에 임시파일을 만드는 호출 경로 추적 + `trap rm -f` 추가.

## Allowed Paths

- packages/cli/cleanup-runner-logs.sh
- packages/cli/wiki-project.sh
- 또는 새 packages/cli/cleanup-runner-state.sh
- .autoflow/runners/state/  (한번 정리 시)

## Verification

```bash
# fix 후
ls .autoflow/runners/state/ | grep -E "(-1\.|\.state\.[A-Za-z]{4,})" | wc -l   # 0 이어야 함
# 1주일 동안 한 번 더 확인하여 leak 재발 여부 점검
```

## Notes

- B 옵션이 정공법. C 까지 가면 mktemp leak 재발 자체를 막음.
- `cleanup-runner-logs.sh` 는 이미 존재하므로 기능 확장이 자연스러움.
- 이 order 가 runtime 에 영향을 주는 위험은 낮음 (참조되지 않는 파일이라 삭제만 안전).

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/cleanup-runner-logs.sh`
- `packages/cli/wiki-project.sh`

### Verification

- Command: ls .autoflow/runners/state/ | grep -E '(-1\.|\.state\.[A-Za-z]{4,})' | wc -l

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
