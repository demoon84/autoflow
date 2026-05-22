# 러너와 러너 도구 계약

이 파일은 Autoflow 러너와 러너 도구 사이의 기준 계약이다.
다른 문서가 같은 경계를 설명할 때는 이 파일을 우선한다.

## 용어

- **Runner**: 하나의 역할(`planner`, `worker`, `verifier`, `wiki`)을 맡는 LLM 기반 행위자다. 러너는 보드를 읽고, 다음 안전한 행동을 판단하고, 도구를 호출하고, 결과를 해석하고, 지속 상태에 남는 결정을 기록한다.
- **Runner tool**: 러너가 하나의 명시적 행동을 위해 호출하는 결정론적 명령이다. 도구는 상태를 검사하고, 불변식을 검증하고, ID를 예약하고, 좁은 범위의 보드 변경을 수행하고, 증거를 준비하거나, 기계적 검사를 실행할 수 있다.
- **Runtime macro**: `autoflow run planner`, `autoflow run worker` / 별칭 `autoflow run ticket`, 워커 finish-ticket 모듈처럼 더 큰 단위의 런타임 표면이다. 매크로는 동일한 흐름을 작은 러너 도구가 아직 완전히 대체하지 못한 곳에서만 허용한다. 시작 매크로는 시작 컨텍스트를 제공할 수 있지만, 작업 선택, 티켓 claim, worktree 생성, worktree가 없을 때 `PROJECT_ROOT` 구현으로 조용히 fallback 하는 일을 해서는 안 된다.
- **Board state**: `.autoflow/tickets/`, `.autoflow/runners/`, `.autoflow/metrics/`, `.autoflow/conversations/`, `.autoflow/wiki/` 아래 파일과 관련 reference/runtime 상태다. 보드 상태가 source of truth 이며, 채팅 텍스트는 아니다.

## 핵심 규칙

러너 도구는 절대 워크플로의 두뇌가 아니다.

모든 의미 판단은 러너가 소유한다.

- 어떤 큐 항목을 처리할지
- 범위와 `Allowed Paths`가 무엇을 뜻하는지
- `Done When`이 무엇을 요구해야 하는지
- 증거가 티켓을 만족하는지
- pass, revise, replan, block, 사용자 질문 중 무엇을 선택할지
- merge 또는 blocked/replan 전략을 어떻게 정할지
- 위키에 어떤 의미를 기록할지

러너 도구는 러너가 명시적으로 요청한 일을 결정론적으로 실행하는 것만 소유한다.

## 결정 경계

모든 러너 도구는 `decision_boundary=result_only` 경계를 가져야 한다.

즉 도구는 다음과 같은 사실을 반환할 수 있다.

- 큐 스냅샷
- 해석된 경로
- 예약된 ID
- 변경 파일 목록
- 검증 실패
- diff 수치
- 증거 묶음
- 보드 변경 결과
- finalizer 상태

하지만 도구는 다음을 결정해서는 안 된다.

- "이 티켓을 claim 하는 것이 맞다"
- "이 PRD/티켓 범위는 충분하다"
- "이 Done When은 수용 가능하다"
- "검증이 의미적으로 통과했다"
- "merge conflict는 이렇게 해결해야 한다"
- "이 위키 요약이 올바른 의미다"
- "러너 프로세스를 시작, 중지, 재시작해야 한다"

도구가 모호함이나 위험을 감지하면 구조화된 증거와 non-success 상태를 반환한다. 러너는 그 결과를 해석하고 다음 안전한 행동을 보드 파일에 기록한다.

## 러너 책임

모든 러너는 다음을 지켜야 한다.

1. 보드 상태를 바꾸기 전에 관련 역할 계약을 읽는다.
2. 보드 증거를 바탕으로 다음 행동을 직접 선택한다.
3. 넓은 지시가 아니라 명시적 인자로 러너 도구를 호출한다.
4. 계속 진행하기 전에 도구 출력을 검사한다.
5. 필요에 따라 티켓, 러너 state, 위키, metrics 파일에 지속 상태를 기록한다.
6. 파서가 의존하는 필드와 key=value 출력은 안정적으로 유지한다.
7. 같은 tick 안에 일을 끝낼 수 없으면 재개 가능한 `Next Action` / `Resume Context`를 남긴다.

러너는 스크립트가 루프를 "운전"하기를 기다리면 안 된다. 러너가 도구를 tick 한다.

## 도구 책임

모든 러너 도구는 다음을 지켜야 한다.

1. 좁은 작업 하나만 수행한다.
2. 입력과 대상 경로를 검증한다.
3. 러너가 검사할 수 있는 JSON 또는 key=value 출력을 우선한다.
4. 실용적인 범위에서 멱등성을 유지한다.
5. 안전하지 않은 경로, 상태, 인자 모호성에서는 fail closed 한다.
6. 워크플로 의미를 바꾸는 숨은 retry를 피한다.
7. 사용자에게 직접 질문하지 않는다.
8. 이 문서나 역할 계약에 없는 새 정책을 만들지 않는다.

도구는 atomic filesystem 작업, lock 획득, ID 예약, 기계적 검사, 결정론적 formatting을 수행할 수 있다. 도구는 누락된 티켓 내용을 만들어내거나 범위를 조용히 넓혀서는 안 된다.

## 역할 경계

`planner`:

- PRD promotion, 티켓 초안 작성, 큐 선택, blocked/replan 후속 결정을 소유한다.
- 큐 스냅샷, ID 예약, 검증된 PRD/티켓 쓰기, 아카이브, blocked/replan 필드 갱신, guard 검사에는 `autoflow tool runner-tool planner ...`를 사용한다.
- product code 구현, 티켓 검증, 티켓 단위 merge, PRD 최종 merge, 위키 의미 갱신, 러너 프로세스 관리를 하지 않는다.

`worker`:

- 하나의 active ticket을 claim부터 구현, 로컬 검증 판단, 검증 러너 handoff, 검증 러너 revise/replan 처리, 검증 승인 merge, finalization 요청까지 소유한다. PRD track에서는 마지막 TODO를 처리한 워커 러너가 PRD branch의 최종 squash merge도 소유한다.
- active 조회, todo 스냅샷, 명시적 claim, worktree 준비/상태, context/stage 갱신, 증거 기록, Done When 검사, diff 검사, finalizer wrapper에는 `autoflow tool runner-tool worker ...`를 사용한다.
- 워커는 티켓을 선택하고, mini-plan을 쓰고, `Allowed Paths` 안의 코드를 수정하고, 검증을 실행하고, 증거를 판단하고, merge 작업을 해결한다. 도구는 그 행동을 기록하거나 검사할 뿐이다.

`verifier`:

- verifier lane 티켓의 의미 검토를 소유한다.
- 큐 스냅샷, 증거 묶음, 결정 기록, pass marker, 워커 ticket state 갱신에는 `autoflow tool runner-tool verifier ...`를 사용한다.
- 검증 러너는 완료된 diff가 티켓 Title, Goal, Done When과 맞는지 결정한다. 도구는 증거를 모으고 기록된 결정을 route 할 뿐이며, 검증 도구는 product code를 merge 하거나 finalize 해서는 안 된다.

`wiki`:

- 파생된 위키 지식을 소유한다.
- source snapshot, baseline update, hybrid source-scan lexical+vector index refresh, query/lint/telemetry wrapper, 결정론적 frontmatter repair, 검증된 page write, diff snapshot에는 `autoflow tool runner-tool wiki ...`를 사용한다.
- 위키 러너는 콘텐츠 갱신이 의미 있는지, 누락되거나 오래된 hybrid index를 refresh 해야 하는지 결정한다. 도구는 check timestamp만을 이유로 committed wiki page를 rewrite 하면 안 되며, RAG 도구는 다른 검색 경로를 조용히 선택하지 말고 hybrid-index 준비 상태를 보고해야 한다.

## 매크로 호환성

큰 runtime script는 동작을 더 작은 러너 도구로 나누는 동안 호환 layer로만 남는다.

- 새 동작에는 `autoflow tool runner-tool <role> ...`를 우선한다.
- repo-owned runtime behavior에 `.sh` entrypoint를 추가하지 않는다.
- 편의만을 위해 이름만 바꾼 runtime alias를 유지하지 않는다. 오래된 alias는 runner/tool 책임을 모호하게 만든다.
- JS/TS 구현이 단일 worker가 되고 package/smoke 문서가 더 이상 요구하지 않으면 legacy fallback을 제거한다.

## Pass, Revise, Replan, Merge 규칙

Finalizer 도구는 장부 기록과 기계적 gate다.

- `approve-merge`는 러너가 이미 pass를 결정한 뒤에만 호출해야 한다.
- worker pass의 경우, AI 워커가 현재 topology에 맞게 작업을 이미 검증하고 필요한 결과를 merge 또는 준비해둔 상태여야 한다.
- `verifier approve-merge`는 verifier lane ticket을 `tickets/inprogress/`로 되돌리고 `verified_pending_merge` 상태를 기록한다. 이후 워커 러너는 다음 명시적 실행에서 승인된 worktree를 merge/finalize 한다.
- `verifier request-revision`은 verifier lane ticket을 `tickets/inprogress/`로 되돌리고 `revision_requested` 상태를 기록한다. 이후 워커 러너는 다음 명시적 실행에서 같은 worktree를 수정한다.
- `verifier request-replan`은 verifier lane ticket을 `tickets/inprogress/`로 되돌리고 `replan_requested` 상태를 기록한다. 이후 워커 러너는 다음 명시적 실행에서 `worker request-replan`을 호출해 worktree를 정리하고, 같은 티켓을 `tickets/todo/Todo-NNN.md`로 되돌리며, `Goal Runtime.Replan Count` / `Replan Decision` / `Replan Fingerprint`를 증가시키고 `## Replan Reason` 블록을 추가한다.
- `planner item-archive`는 같은 `PRD Key`를 가진 Todo가 보드에 하나 이상 없으면 PRD를 `tickets/done/<project-key>/`로 옮기지 않는다. 이 규칙은 archive 된 모든 PRD에 구현 증거가 있음을 보장한다. 구현 작업이 없는 research/audit/policy-only PRD를 의도적으로 닫을 때만 `--force-archive-orphan`을 전달하고, 근거를 PRD `## Notes`에 기록한다.
- PRD branch 최종 squash merge는 planner tool이 아니라 `worker finalize-approved` 흐름에서 수행된다. 같은 `PRD Key`를 가진 모든 TODO가 `tickets/done/PRD-NNN/`에 도달하면 마지막 TODO를 완료한 워커 러너가 PRD branch(`autoflow/prd-NNN`)를 현재 branch(보통 `main`)로 squash-merge 하고, PRD 파일을 `tickets/done/PRD-NNN/`로 archive 하며, PRD branch/worktree를 정리한다. 자세한 내용은 [prd-branch-policy.md](prd-branch-policy.md)를 본다.
- finalizer는 diff/Done When 검증, ticket evidence archive, 로컬 completion commit 생성, verifier/replan flow routing을 할 수 있다.
- finalizer는 의미적 pass/revise/replan 결정을 내리거나 product-code merge conflict를 해결하는 행위자가 되어서는 안 된다.

## 확장 체크리스트

러너 도구를 추가하거나 변경할 때:

1. 명령을 `app/runtime/runners/<role>/tools/<command>.ts` 아래 좁은 feature file로 추가하고, 해당 역할 폴더의 `index.ts`에서 export 하며, `autoflow tool runner-tool` routing은 `app/runtime/runners/tool.ts`를 통하게 유지한다.
2. 관련 role agent 파일에 그 행동을 문서화한다.
3. `autoflow tool list` 계약 문구를 정확하게 유지한다.
4. 책임 경계가 바뀌면 이 파일을 갱신한다.
5. 파일이 이동하거나 사라지면 package install과 smoke test를 갱신한다.
6. `autoflow tool runner-tool --help` 또는 `npx tsx autoflow tool runner-tool --help`, `./app/bin/autoflow tool list`, installed-board status/runners 검사를 실행한다.
