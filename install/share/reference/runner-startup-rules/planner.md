# 플래너 러너 시작 규칙

`planner` / `plan` runner에 주입되는 role rule이다.

## Startup Scan

- File을 열기 전에 `"$AUTOFLOW_CLI" tool runner-tool planner queue-snapshot --runner <runner-id> --max-items 12`를 한 번 실행한다.
- `snapshot.ai_followup_recommended=false`이면 compact result를 요약하고 source file을 열지 않은 채 idle한다.
- Work가 필요하면 `snapshot.ai_followup_scope.inspect_only_recent_sources`만 inspect한다.
- Compact output이 명시적으로 요구하지 않는 한 scope 밖 file을 열지 않고, scoped file 안의 reference도 따라가지 않는다.
- 채워진 PRD queue item은 가장 좁고 안전한 scope로 구체적인 todo ticket으로 승격한다. PRD 하나가 여러 worker-owned todo ticket이 되어야 하면 `## Todo Split Map`을 쓴다.
- **모든 PRD는 archive되기 전에 Todo를 1개 이상 만들어야 한다.** Normal path에서는 runtime slicer가 이를 보장하고, `runner-tool planner item-archive`가 archive boundary에서 강제한다. 구현 작업이 없는 intentional research/audit/policy PRD에만 `--force-archive-orphan`을 쓴다.
- `/atodo` direct todo ticket(`Plan Source: atodo-direct`, PRD reference 없음)은 이미 worker-ready다. `Next Action`/`Notes`가 planner re-orchestration을 요구하지 않는 한 promote, archive, 수정하지 않는다.
- Ticket에 verifier-replan metadata(`Goal Runtime.Replan Count >= 1`)가 있으면 `Replan Decision`을 inspect한다. Limit 아래의 `replan`은 worker가 re-claim할 수 있다는 뜻이고, `needs_user`는 같은 fingerprint가 limit에 도달했다는 뜻이다. 사용자가 redirect하거나 또 다른 시도를 명시적으로 승인할 수 있도록 `replan_limit_reached`를 설명하는 명확한 `Next Action`과 `Notes`를 남긴다.
- Ticket이 blocked이거나 no-progress evidence를 담고 있으면 더 많은 work를 만들기 전에 구체적인 next-step note를 남긴다.
- 선택한 PRD의 worker-facing todo set은 focused startup turn 하나 안에서 만든다. Todo ticket을 만들기 위해 runnable PRD를 다음 turn까지 기다리게 두지 않는다.
- PRD-backed TODO set을 쓴 뒤에는 같은 focused turn 안에서 source `tickets/prd/PRD-NNN.md`가 active PRD queue에서 사라져야 한다. `write-ticket` tool의 `archived_prds` result를 선호하고, 기존 PRD source에 대해 missing/empty를 보고하면 idle 전에 해당 PRD에 `item-archive`를 실행한다.
- `write-prd`는 `autoflow/prd-NNN`을 만들고 PRD frontmatter에 `Branch` / `Base Commit`을 저장한다. 이후 PRD 파생 TODO는 해당 PRD worktree만 사용하고, 모든 TODO가 done되면 마지막 TODO를 완료한 워커 러너가 PRD branch를 main/master에 squash merge한다. 자세한 정책은 [prd-branch-policy.md](../prd-branch-policy.md)를 본다.

## Boundaries

- Product code를 편집하지 않는다.
- Ticket worktree를 만들거나 삭제하지 않는다.
- Worker output을 검증하거나 개별 ticket을 finalize하지 않는다.
- 어떤 merge도 실행하지 않는다. PRD 최종 squash merge도 워커 러너 책임이다.
- Board 아래 planner-owned markdown state만 쓴다.
- 가능하면 planner-authored markdown edit 이후 guard를 실행한다.
- Focused startup turn 중 `runner-stage`, `runner-tokens`, `date`를 호출하지 않는다.

## Idle

Actionable PRD 또는 todo work가 없음을 확인한 뒤에만 idle한다.
