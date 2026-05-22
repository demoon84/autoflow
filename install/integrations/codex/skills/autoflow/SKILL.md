---
name: autoflow
description: 사용자가 $autoflow, #autoflow, /autoflow를 호출하거나 goal 기능으로 Autoflow PRD cycle을 목표 완료까지 반복하길 원할 때 사용한다. 실제 작업 전 계획 브리핑과 승인 게이트를 적용하고, 러너를 직접 지휘하지 않으며 PRD 기준으로만 목표를 오케스트레이션한다.
---

# Autoflow Goal Orchestration

Codex용 Autoflow goal orchestration entry point다. 이 스킬은 Autoflow 시스템 상태를 조작하는 스킬이 아니라 사용자 목표를 PRD cycle 단위로 관리하는 스킬이다.

## 시작 전 승인 게이트

`$autoflow`를 사용하면 실제 작업 전에 반드시 사용자에게 계획을 브리핑하고 명시적 승인을 받는다.

승인 전 허용:

- 목표와 완료 조건을 이해하기 위한 질문.
- `get_goal`, `autoflow status`, ticket directory 확인 같은 read-only 상태 점검.
- 사용자에게 보여줄 계획 초안 작성.

승인 전 금지:

- 새 goal 생성/교체/완료 처리.
- `$aprd` intake 저장.
- 플래너/워커/검증/위키 러너 action 실행.
- 제품 파일, ticket, PRD, wiki, board 상태 변경.

브리핑에는 목표 요약, 완료 판정 기준, 확인할 read-only 상태, 이번 PRD cycle의 경계, 예상 Allowed Paths/Done When/Verification 기준을 포함한다. 사용자가 `진행`, `승인`, `좋아`, `계속`처럼 명확히 허락한 뒤에만 다음 단계로 간다.

## 승인 후 첫 단계: Goal 활성화

승인 직후 첫 mutating action은 PRD/ticket 작성이 아니라 host goal 기능 활성화다.

1. `get_goal`로 현재 goal 상태를 확인한다.
2. active goal이 없으면 `create_goal`을 호출해 `$autoflow` objective를 만든다. objective에는 "PRD 1개 cycle은 PRD 발행, 모든 파생 TODO done, 워커 러너의 PRD squash merge, PRD branch 정리까지 끝나야 완료"라는 완료 경계를 포함한다.
3. active goal이 같은 objective면 그 goal을 계속 사용한다.
4. active goal이 다른 objective면 사용자 승인 없이 덮어쓰지 않고 멈춘다.
5. goal tool을 실제로 사용할 수 없으면 goal이 켜졌다고 말하지 않는다. 이 경우 `$aprd` 저장이나 board 변경도 진행하지 말고 사용자에게 goal 없이 Autoflow board loop만 진행할지 확인한다.

이후 모든 `$autoflow` turn은 board loop 전에 `get_goal`로 active goal을 먼저 확인한다. Goal complete는 PRD 파일이 `tickets/done/PRD-NNN/PRD-NNN.md`에 있고, 관련 TODO가 모두 done이며, PRD branch/worktree가 정리된 evidence까지 확인된 뒤에만 한다.

## 핵심 계약

- `$autoflow`는 반드시 PRD 기준으로 동작한다. `$autoflow` 안에서 direct `$atodo` cycle을 선택하지 않는다.
- `$atodo`는 별도 direct todo intake skill이다. 사용자가 `$atodo`를 직접 호출한 경우에만 TODO worktree를 만드는 direct track이 열린다.
- `$autoflow`의 1 cycle은 `PRD 1개 발행 -> PRD 파생 TODO 1개 이상 처리 -> 모든 TODO done -> 워커 러너의 PRD worktree squash merge`까지다.
- active PRD cycle이 끝나기 전에는 다음 PRD를 발행하지 않는다.
- 플래너 러너는 PRD를 TODO로 나누는 역할만 가진다. 플래너 러너에게 merge/finalize 역할을 맡기지 않는다.
- PRD 파생 TODO는 TODO worktree를 만들지 않는다. 해당 PRD worktree 안에서만 작업된다.
- 모든 TODO가 `tickets/done/PRD-NNN/`에 도달하면 마지막 TODO를 완료한 워커 러너가 PRD worktree를 main/master에 squash merge한다. PRD와 TODO ticket 파일도 같은 최종 commit에 포함된다.
- 위키 러너는 선택 사항이다. 켜져 있고 정리할 내용이 있으면 별도 wiki commit을 만들 수 있지만, PRD/TODO 완료를 막지 않는다.

## 역할 경계

`autoflow`는 흐름 관리자다. 현재 대화의 Codex가 워커 러너처럼 제품 코드를 구현하면 안 된다.

허용:

- Goal 상태 확인/설정/완료 처리.
- 목표 cycle 중복 방지와 완료 판정에 필요한 read-only board scan.
- 승인 뒤 `$aprd` intake 하나 작성.
- 기록된 ticket 상태, verifier decision, done evidence를 읽고 다음 cycle 여부 판단.

금지:

- `Allowed Paths` 아래 제품 파일 직접 수정.
- 플래너/워커/검증/위키 러너 start/stop/wake 지휘.
- `worker claim`, `worktree-ensure`, `submit-to-verifier`, `finalize-approved`, `request-replan` 같은 runner action 직접 실행.
- 플래너 러너 대신 TODO를 직접 생성하거나, 워커 러너 대신 merge/finalize 수행.
- 검증 러너 대신 pass/revise/replan 결정.

## Goal 기능 확인

1. Codex goal tool이 있으면 `get_goal`, `create_goal`, `update_goal`을 실제로 사용 가능 여부까지 확인한다.
2. Slash command 환경에서는 `/goal <objective>`, `/goal`, `/goal pause`, `/goal resume`, `/goal clear`가 기준이다.
3. Claude Code에도 `/goal`이 있다. Claude Code에서는 v2.1.139 이상, trusted workspace, hook 허용 설정이 필요하다.
4. Goal 기능을 실제로 조작할 수 없으면 goal이 켜졌다고 말하지 않는다. 차선책으로 Autoflow board loop만 진행할지 사용자에게 확인한다.

## Autoflow 계약 만들기

1. `$autoflow <목표>`의 첫 메시지를 objective source로 삼는다.
2. 완료 조건, 바꾸지 말아야 할 경계, 검증 기준이 관찰 가능하도록 목표 문장을 다듬는다.
3. active goal이 있으면 같은 objective인지 확인한다. 다른 objective면 사용자 승인 없이 덮어쓰지 않는다.
4. 새 Codex goal을 만들 수 있으면 objective에 "Autoflow는 PRD 1개 cycle을 끝낸 뒤에만 다음 PRD를 발행한다. PRD cycle은 모든 PRD TODO done과 워커 러너의 PRD squash merge까지 포함한다"는 중지 조건을 포함한다.

## 루프

1. Board와 host 지침을 read-only로 읽는다: `AGENTS.md`, `CLAUDE.md`, `{{BOARD_DIR}}/AGENTS.md`, 필요한 `{{SHARE_ROOT}}` reference.
2. `autoflow status <project-root> {{BOARD_DIR}}`와 ticket directory/file 존재만 확인한다. runner tool은 런타임 진단 요청이 있을 때만 사용한다.
3. active PRD cycle이 있으면 새 `$aprd`를 만들지 않는다. active 기준은 `tickets/prd/PRD-NNN.md`, 같은 `PRD Key`의 `tickets/todo/`, `tickets/inprogress/`, `tickets/verifier/`, 아직 완료 merge 전인 `tickets/done/PRD-NNN/`, 남아 있는 `autoflow/prd-NNN` branch 중 하나라도 있는 경우다.
4. active cycle이 없고 목표에 다음 부족분이 있으면 `aprd` skill을 읽고 PRD 1개만 작성/저장한다.
5. PRD가 발행되면 현재 대화는 플래너 러너나 워커 러너를 직접 깨우지 않는다. Autoflow 앱/러너 wake 체계가 처리할 work가 생겼다고 보고하고 멈춘다.
6. 모든 PRD TODO가 done되고 PRD file까지 `tickets/done/PRD-NNN/PRD-NNN.md`에 들어가며 PRD branch가 정리된 뒤에만 해당 cycle이 끝난 것으로 본다.
7. cycle 종료 뒤 done evidence와 남은 objective를 분석한다. 남은 일이 있으면 다음 PRD cycle 계획을 다시 브리핑하고 승인받는다. 완료 조건을 만족하면 goal을 complete 처리한다.

Autoflow 보드를 찾지 못하면 프로젝트에 Autoflow 보드가 먼저 필요하다고 설명하고 `autoflow init <project-root>` 또는 desktop install flow를 제안한다.
