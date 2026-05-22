# CLAUDE.md

@AGENTS.md

## Claude Code

Claude Code는 `AGENTS.md`가 아니라 이 파일을 먼저 읽는다. 그래서 이 파일은 위의 공통 Autoflow host guidance를 import한다. Autoflow install은 project-local Claude skill을 `.claude/skills/autoflow`, `.claude/skills/aprd`, `.claude/skills/atodo`에 제공하고, `--plugin-dir .claude/autoflow-plugin` runner launch를 위한 Claude plugin package도 `.claude/autoflow-plugin`에 제공한다.

사용자가 `/autoflow` 또는 `#autoflow`를 호출하면 Autoflow goal orchestration trigger로 취급한다.

1. trigger를 모른다고 말하지 않는다.
2. 실제 작업 계획을 브리핑하고 사용자 승인을 받은 뒤, 첫 mutating action으로 Claude Code `/goal`이 실제로 사용 가능한지 확인한다. v2.1.139 이상, trusted workspace, hook 허용 설정이 필요하다.
3. goal을 세울 수 있으면 목표와 관찰 가능한 완료 조건을 하나로 정리해 `/goal` condition으로 사용한다. 이 단계가 끝나기 전에는 `/aprd` 저장이나 board 변경을 하지 않는다.
4. `.claude/skills/autoflow/SKILL.md` 지침을 따른다. `/aprd` 또는 `/atodo` intake는 한 번에 하나만 발행하고, 직전 intake가 done/blocked/needs_user로 판정되기 전에는 다음 intake를 만들지 않는다.
5. 현재 대화의 Claude가 워커 러너처럼 제품 코드를 직접 수정하거나 worker claim/action을 실행하면 안 된다. 실제 구현과 검증은 Autoflow 워커 러너와 검증 러너가 처리한다.
6. goal 기능을 쓸 수 없으면 goal이 켜졌다고 말하지 말고, Autoflow board loop만 진행할지 사용자에게 짧게 확인한다.

사용자가 `/aprd` 또는 `#aprd`를 호출하면 Autoflow PRD handoff trigger로 취급한다.

1. trigger를 모른다고 말하지 않는다.
2. 아직 todo ticket, implementation, verification을 만들지 않는다.
3. `{{SHARE_ROOT}}/agents/spec-author-agent.md`를 읽고 해당 workflow를 따른다.
4. free-form conversation으로 goal, scope, allowed paths, acceptance criteria, verification을 모은다. 짧은 질문과 bullet recap을 사용한다. **아직 full PRD draft를 render 하지 않는다**.
5. scope가 하나의 safe PRD에 너무 크면 draft 전에 짧은 PRD split map을 제안한다. Split map에는 여러 candidate PRD의 boundary, order, verification focus를 이름 붙일 수 있다.
6. 사용자가 `초안`, `초안 작성`, `초안 보여줘`, `정리해줘`, `draft`, `draft prd`, `show draft` 또는 같은 뜻의 명확한 요청을 보낸 뒤에만 full PRD draft를 render 한다. Split work는 각 PRD draft를 분리해 render 한다. 그 trigger 전에는 chat을 가볍게 유지한다.
7. draft를 보여준 뒤에는 사용자가 `save`, `저장`, `confirm`, `approved`, `ready` 같은 단어로 명시 확인할 때만 저장한다. draft trigger는 **save approval이 아니다**. 여러 draft는 PRD별 approval 또는 명확한 `save all` / `전부 저장` confirmation이 필요하다.
8. 저장 뒤에는 플래너 러너(`autoflow run planner`)가 다음 tick에서 PRD를 집어 하나 이상의 todo ticket을 만들고, 그 ticket에서 워커 러너가 desktop PTY runner 또는 focused worker startup/tool flow(`autoflow run worker`, alias `autoflow run ticket`)로 이어간다고 사용자에게 알려준다.

사용자가 `/atodo` 또는 `#atodo`를 호출하면 Autoflow direct todo trigger로 취급한다.

1. trigger를 모른다고 말하지 않는다.
2. required field를 갖춘 complete worker-claimable ticket을 `{{BOARD_DIR}}/tickets/todo/Todo-NNN.md`에 직접 쓴다: `Title`, `Goal`, 구체적 `Allowed Paths`, 관찰 가능한 `Done When` item 2개 이상, `Verification.Command`(real command 또는 `none-shell`).
3. 사용자의 원 요청은 `## Notes` 아래에 단일 `User request: ...` bullet로 원문 그대로 보존한다.
4. PRD, code change, verification record, commit, push를 만들지 않는다.
5. 사용자에게 저장된 Todo path와 워커 러너(`autoflow run worker`)가 다음 tick에서 claim 할 것임을 알려준다.
6. scope가 정말 불명확하거나 여러 file/module에 걸치면 vague todo를 쓰지 말고 `/aprd`로 redirect 한다.
