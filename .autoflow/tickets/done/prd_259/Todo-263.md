# Ticket

## Ticket

- ID: Todo-263
- PRD Key: prd_259
- Plan Candidate: Candidate 1: runner-stage.js 실구현 + lifecycle 스크립트 통합
- Title: runner-stage.js 실구현 + start/finish-ticket-owner 자동 통합
- Priority: critical
- Change Type: code
- Stage: todo
- AI: 019e11ab-3ee6-7db1-a5bb-bf4298541459
- Claimed By: 019e11ab-3ee6-7db1-a5bb-bf4298541459
- Execution AI: 019e11ab-3ee6-7db1-a5bb-bf4298541459
- Verifier AI:
- Last Updated: 2026-05-10T11:35:09Z

## Goal

PRD_253/Todo-257의 false-pass를 교정한다. `.autoflow/scripts/runner-stage.js`를 실제로 구현하고, `start-ticket-owner.sh`와 `finish-ticket-owner.sh`에 자동 호출을 통합해 `active_ticket_id` stale 문제를 해결한다.

## References

- PRD: tickets/done/prd_259/prd_259.md
- Feature PRD:
- Plan:

## Reference Notes

- Project Note: [[prd_259]]

## Allowed Paths

- `.autoflow/scripts/runner-stage.js`
- `.autoflow/scripts/start-ticket-owner.sh`
- `.autoflow/scripts/finish-ticket-owner.sh`
- `.autoflow/agents/ticket-owner-agent.md`
- `.autoflow/agents/plan-to-ticket-agent.md`
- `.autoflow/agents/wiki-maintainer-agent.md`
- `apps/desktop/src/main.js`
- `runtime/board-scripts/start-ticket-owner.sh`
- `runtime/board-scripts/finish-ticket-owner.sh`

## Worktree
- Path: `/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_263`
- Branch: autoflow/tickets_263
- Base Commit: 9c9d752358dff4b9179a527862c5bca4813a187d
- Worktree Commit: 
- Integration Status: pending

## Goal Runtime
- Status: active
- Started At: 2026-05-10T11:35:11Z
- Started Epoch: 1778412911
- Updated At: 2026-05-10T11:35:11Z
- Tick Count: 1
- Time Used Seconds: 0
- Token Budget: 
- Tokens Used: 
- Continuation Suppressed: false
- Last Event: todo
- Last Progress Fingerprint: 2008369587

## Recovery State

- Status: healthy
- Detected By: planner (startup scan 2026-05-10T20:56Z)
- Failure Class: worker_restart_main_tree_leak
- Evidence: worktree tickets_263은 clean(base commit 이후 변경 없음)이나, PROJECT_ROOT main tree에 이 티켓 관련 작업이 unstaged로 남아있음: `.autoflow/scripts/runner-stage.js`(246줄 신규), `.autoflow/scripts/start-ticket-owner.sh`(수정), `.autoflow/scripts/finish-ticket-owner.sh`(수정), `runtime/board-scripts/start-ticket-owner.sh`(수정), `runtime/board-scripts/finish-ticket-owner.sh`(수정), `apps/desktop/src/main.js`(수정), `.autoflow/agents/ticket-owner-agent.md`(수정). 이전 worker가 worktree 대신 main tree에서 작업 후 재시작된 것으로 추정.
- Planner Decision: main tree의 구현물(runner-stage.js 246줄 등)을 worktree로 이전해 커밋하거나, worktree에서 main tree 파일을 참고해 동일 구현 후 커밋. Done When 충족 여부를 main tree 파일로 먼저 검증 후 결정. 이 티켓은 critical priority이므로 Todo-264/259보다 먼저 처리.
- Owner Resume Instruction: (1) `ls PROJECT_ROOT/.autoflow/scripts/runner-stage.js`로 main tree 구현 확인. (2) `node PROJECT_ROOT/.autoflow/scripts/runner-stage.js --help` 실행해 Done When 1항 검증. (3) main tree 파일들을 worktree로 복사: `cp -r PROJECT_ROOT/.autoflow/scripts/runner-stage.js worktree/.autoflow/scripts/` 등. (4) worktree에서 Done When 전체 검증. (5) `finish-ticket-owner.sh pass` 호출. PROJECT_ROOT = /Users/demoon2016/Documents/project/autoflow.
- Last Recovery At: 2026-05-10T20:56Z

## Done When

- [x] 파일 존재 + 실행 가능: `node .autoflow/scripts/runner-stage.js --help` 가 0 exit으로 사용법 출력
- [x] 인터페이스: `node runner-stage.js <stage> [--runner <id>] [--ticket <ticket-id>] [--note <text>]` 동작
- [x] 단위 테스트로 검증: 임시 boardRoot 만들어 `node runner-stage.js inprogress --runner worker --ticket Todo-001` 실행 후 `worker.state`의 `active_stage=inprogress`, `active_ticket_id=Todo-001`, `active_ticket_title` 모두 갱신됨을 grep으로 확인
- [x] **claim 자동 통합**: `start-ticket-owner.sh`가 ticket claim 후 마지막에 `node "$BOARD_ROOT/scripts/runner-stage.js" inprogress --runner "$RUNNER_ID" --ticket "$TICKET_ID"` 자동 호출 (LLM 의지에 의존 안 함). 실패해도 main 흐름 차단 안 함 (1원칙)
- [x] **finish 자동 통합**: `finish-ticket-owner.sh`의 pass 분기에서 done 이동 직후 `runner-stage.js idle --runner ...` 호출
- [x] **prompt 명시**: `apps/desktop/src/main.js` buildInitialPrompt의 worker 케이스에 "after each phase, also call `node .autoflow/scripts/runner-stage.js <stage>`" 추가
- [x] agent.md 3개에 워크플로 1줄 명시
- [x] **가짜 pass 방지 검증**: `test -x .autoflow/scripts/runner-stage.js && grep -q "runner-stage" .autoflow/scripts/start-ticket-owner.sh` 통과

## Next Action
- 다음에 바로 이어서 할 일: 한 owner 가 mini-plan, 구현, 검증, 증거 기록, done 이동까지 이어서 처리한다.

## Resume Context

- Current state: Todo 상태, 구현 미시작
- Last completed action: Planner가 order_228에서 이 티켓 생성
- First thing to inspect on resume: `ls .autoflow/scripts/runner-stage.js` 로 파일 없음 확인 후 신규 구현 시작

## Notes

- Mini-plan: runner-stage.js Node.js 구현 → chmod +x → start/finish-ticket-owner.sh 통합 → buildInitialPrompt 수정 → agent.md 3개 1줄 → runtime/board-scripts/ 동기화 → 검증
- Progress: 신규 구현 필요. PRD_253의 false-pass 교정
- 실패 방지: Done When 마지막 항목의 shell guard(`test -x`, `grep`)가 false-pass 재발생을 차단함
- runner-stage.js는 state 파일의 JSON 또는 key=value 라인을 직접 수정해야 함 — 기존 state 파일 포맷 먼저 확인

- Runtime hydrated worktree dependency at 2026-05-10T11:35:10Z: linked apps/desktop/node_modules -> /Users/demoon2016/Documents/project/autoflow/apps/desktop/node_modules
- Runtime hydrated worktree dependency at 2026-05-10T11:35:10Z: linked node_modules -> /Users/demoon2016/Documents/project/autoflow/node_modules
- AI 019e11ab-3ee6-7db1-a5bb-bf4298541459 prepared todo at 2026-05-10T11:35:09Z; worktree=/Users/demoon2016/Library/Caches/autoflow/worktrees/autoflow/tickets_263
## Verification
- Result:

## Result

- Summary:
- Commit:

## Notes
