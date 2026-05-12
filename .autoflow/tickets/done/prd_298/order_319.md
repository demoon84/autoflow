# Autoflow Order

## Order

- ID: order_319
- Title: sh to ts 전환 4단계 worker finalizer 실제 이관
- Status: inbox
- Priority: normal
- Created At: 2026-05-12T07:44:59Z
- Source: autoflow order create

## Request

3단계 start-plan 이관 이후, worker/finalizer 핵심 스크립트의 실제 로직을 TypeScript/Node 중심으로 이관한다.

대상은 start-ticket-owner, finish-ticket-owner, merge-ready-ticket, handoff-todo 계열이다. 현재 일부 .js entrypoint는 preflight만 수행하거나 .legacy.sh로 위임한다. 목표는 ticket claim, worktree setup, sanity gate, verifier handoff/skip, pass/fail routing, retry inbox 생성, completion archive/draft 생성 등 핵심 로직을 JS/TS로 옮기고 .legacy.sh는 제거 가능하거나 fallback-only로 축소하는 것이다.

소유권 lock, Done When gate, allowed-path gate, verifier 재도입 계약, branch_only push opt-in, wiki deferred 정책을 보존해야 한다.

## Hints

### Scope

- sh-to-ts 4단계: start-ticket-owner/finish-ticket-owner/merge-ready-ticket/handoff-todo 실제 로직 이관

### Allowed Paths

- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/start-ticket-owner.js`
- `.autoflow/scripts/start-ticket-owner.legacy.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/scripts/finish-ticket-owner.js`
- `.autoflow/scripts/merge-ready-ticket.sh`
- `.autoflow/scripts/merge-ready-ticket.ts`
- `.autoflow/scripts/merge-ready-ticket.js`
- `.autoflow/scripts/handoff-todo.sh`
- `.autoflow/scripts/handoff-todo.js`
- `.autoflow/scripts/runner-common.sh`
- `.autoflow/scripts/common.sh`
- `runtime/board-scripts`
- `tests/smoke`

### Verification

- Command: find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.sh' -o -name 'handoff-todo*.sh' \) -exec bash -n {} \; && find .autoflow/scripts runtime/board-scripts -maxdepth 1 -type f \( -name '*ticket*.js' -o -name '*ticket*.ts' -o -name 'handoff-todo*.js' \) -exec node --check {} \; && bash tests/smoke/ticket-owner-smoke.sh

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
