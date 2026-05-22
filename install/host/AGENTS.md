# AGENTS.md

이 프로젝트는 `{{BOARD_DIR}}/` sidecar 보드로 운영한다.

실제 제품 코드는 프로젝트 루트에 있고, 하네스 보드는 `{{BOARD_DIR}}/` 안에 있다.

Autoflow 는 Codex, Claude Code 같은 코딩 에이전트를 위한 local work harness 다. 대화창은 작업 진입점일 수 있지만, 작업 상태의 source of truth 는 `{{BOARD_DIR}}/tickets/` 보드다.

## 읽는 순서

작업을 시작할 때는 아래 순서로 읽는다. 정적 템플릿/계약/룰/에이전트 정의는
프로젝트 단위 보드(`{{BOARD_DIR}}/`)가 아니라 사용자 단위 share 루트
(`{{SHARE_ROOT}}/`, 기본값 `~/.autoflow/share/`, `AUTOFLOW_SHARE_ROOT` env 로
override) 에 단 한 벌만 설치되고 모든 프로젝트가 공유한다.

1. `{{BOARD_DIR}}/README.md`
2. `{{SHARE_ROOT}}/rules/README.md`
3. `{{SHARE_ROOT}}/reference/prd.md`
4. `{{SHARE_ROOT}}/reference/plan.md`
5. `{{BOARD_DIR}}/automations/README.md`
6. `{{SHARE_ROOT}}/reference/tickets-board.md`
7. `{{SHARE_ROOT}}/rules/verifier/README.md`
8. `{{SHARE_ROOT}}/reference/runner-startup-common.md`
9. 역할별 시작 규칙: `{{SHARE_ROOT}}/reference/runner-startup-rules/`
10. 관련 문서:
   - PRD 정리면 `{{SHARE_ROOT}}/agents/spec-author-agent.md`
   - 기본 실행이면 `{{SHARE_ROOT}}/agents/worker-agent.md`
   - plan 도출 / replan 처리면 `{{SHARE_ROOT}}/agents/plan-to-ticket-agent.md`
   - todo claim + 구현이면 `{{SHARE_ROOT}}/agents/worker-agent.md`
   - verifier 검사면 `{{SHARE_ROOT}}/agents/verifier-agent.md`

## 루트 규칙

1. 보드 문서는 `{{BOARD_DIR}}/` 안에 둔다.
2. 실제 제품 코드는 프로젝트 루트에서 관리한다.
3. `Allowed Paths` 는 repo-relative 경로로 해석한다. 워커 러너(`worker`) 는 git 저장소에서 티켓별 worktree 를 사용한다. worktree 생성/확인이 실패하면 구현을 시작하지 않고 ticket 을 blocked 상태로 남긴다.
4. `{{BOARD_DIR}}/` 밖의 제품 파일도 티켓의 `Allowed Paths` 안에 있으면 수정할 수 있지만, 병렬 작업에서는 티켓별 worktree 안에서 수정한다.
5. 기본 토폴로지는 **플래너 러너 + 워커 러너 + 검증 러너 + 위키 러너 (4-runner)** 모델이다. 입력 채널은 세 가지: `/autoflow` 는 goal 기능을 켜고 PRD cycle을 한 번에 하나씩 반복하는 목표 완료 루프, `/aprd` 는 PRD 큐(`tickets/prd/`)로 큰 작업을 보내 플래너가 todo 로 잘게 쪼개는 경로, `/atodo` 는 단일 파일 기계적 작업을 곧장 `tickets/todo/Todo-NNN.md` 로 작성하는 경로다. PRD cycle은 PRD 1개 발행, todo 1개 이상 생성, 모든 todo done, 워커 러너의 PRD worktree squash merge까지 끝나야 완료다. PRD 파생 TODO는 TODO worktree를 만들지 않고 해당 PRD worktree 안에서 처리된다. PRD 의 모든 티켓이 done 으로 진입하면 마지막 TODO를 완료한 워커 러너가 PRD 브랜치를 `main` 으로 squash 머지해 1커밋으로 압축한다. 검증 러너(`verifier`) 는 의미 검증만 수행하고 pass/revise/replan 중 하나로 worker 를 깨운다. 위키 러너(`wiki`) 는 `tickets/done/` 변동을 감지해 `{{BOARD_DIR}}/wiki/` 의 AI synthesis 를 갱신한다.
6. `#plan`, `#todo`, `#veri` 는 레거시 role-pipeline 호환 트리거다. 새 작업은 역할 분리보다 플래너/워커/검증/위키 러너의 명시적 실행 흐름을 우선한다.
7. 러너 idle 은 종료가 아니라 다음 scan 또는 tick 대기 상태다. 러너 중지는 사용자의 명시적 지시로만 처리한다.
8. worker 또는 verifier 는 local commit 을 할 수 있고, `git push` 는 어떤 러너/자동 실행에서도 절대 금지다.
9. 브라우저 확인 기본 우선순위는 `비브라우저 확인 -> 현재 에이전트의 내장 브라우저 도구` 다. Playwright 는 사용하지 않는다. Codex 는 Codex 브라우저 도구를, Claude 는 Claude browser tool 을 사용한다.
10. 현재 턴에서 Codex 브라우저 도구 / Claude browser tool 탭을 열었다면, 사용자가 유지하라고 하지 않는 한 같은 턴에서 반드시 닫고 끝낸다.
11. worker 또는 verifier 는 `{{BOARD_DIR}}/` 보드, 프로젝트 루트, ticket worktree 범위 안의 검증 명령 실행, 브라우저 확인, verifier 관련 파일 이동, worktree 통합, local `git add` / `git commit`, `autoflow/prd-NNN` / `autoflow/TODO-NNN` 브랜치의 체크아웃·머지·삭제에 대해 추가 허락을 묻지 않는다. 범위를 벗어나거나 `git push` 가 필요한 경우만 멈춘다.
12. `tickets/` 는 실행 원장이고, 향후 `wiki/` 는 완료된 작업과 의사결정을 정리하는 파생 지식 지도다. wiki 문서만으로 done/pass 를 판단하지 않는다.
13. 기본 흐름: `/aprd` → PRD worktree 생성 → 플래너 러너가 todo 분할 → 워커 러너가 PRD worktree 에서 구현/검증 → 검증 러너 pass → 모든 PRD TODO done 시 마지막 TODO를 처리한 워커가 PRD 브랜치를 `main` 에 1커밋으로 **`git merge --squash`** (--no-ff 금지). `/atodo` 트랙은 PRD 브랜치 없이 direct TODO worktree를 `main` 으로 직접 squash. board/wiki 변경은 같은 squash commit 에 stage 또는 `git commit --amend` (별도 sync commit 금지). 세부 절차는 `{{SHARE_ROOT}}/reference/runner-startup-rules/worker.md` 와 `{{SHARE_ROOT}}/agents/worker-agent.md` 참고.
14. runner tick 이 종료될 때는 현재 공정률을 표기한다. 가능하면 `autoflow metrics` 또는 보드의 spec/ticket 집계를 기준으로 한 percent 를 tick 의 마지막 대화/로그 요약에 남긴다.
15. 문서/대화 언어 기본 = 한국어. PRD, todo, verifier note, wiki, reference, 러너 사용자-facing 대화/요약, 제품 README/UI/릴리스 노트 모두 해당. 단 key=value 출력, 경로, 명령어, 코드, ticket field, parser-sensitive section, id, project key, runtime contract 는 원래 포맷 유지.

## Trigger 해석

- `#aprd` / `/aprd` / `$aprd` — PRD handoff. 자유 대화로 요구사항을 모으고 명시적 draft trigger 가 있을 때만 PRD 초안 출력, 명시적 save 확인 후 `autoflow spec create` 호출하면 PRD markdown 이 자동으로 `autoflow/prd-NNN` 브랜치 + worktree 안에 commit 됨. 자세한 흐름은 `{{SHARE_ROOT}}/agents/spec-author-agent.md`. todo/구현은 만들지 않는다.
- `#atodo` / `/atodo` / `$atodo` — 단일 파일 기계적 변경을 곧장 `autoflow todo create` 로 발행. todo markdown 이 자동으로 `autoflow/TODO-NNN` 브랜치 + worktree 안에 commit 된다 (base = main). Title/Goal/Allowed Paths/Done When 2+/Verification 필수. 원 요청은 `## Notes` 에 보존. 모호하면 `/aprd` 로 전환.
- `#autoflow` / `/autoflow` / `$autoflow` — goal 기반 Autoflow orchestration. 계획 브리핑과 사용자 승인 뒤 첫 mutating action은 반드시 host goal 기능 활성화다. Codex는 `get_goal`/`create_goal`/`update_goal`, Claude Code는 `/goal`을 실제로 사용해 현재 objective를 세운 뒤 PRD cycle을 한 번에 하나만 진행한다. Goal 기능을 실제로 쓸 수 없으면 goal이 켜졌다고 말하지 않고, PRD/ticket 저장도 진행하지 않는다. 현재 대화 에이전트가 워커 러너처럼 제품 코드를 직접 구현하거나 worker claim/action을 실행하면 안 된다. PRD cycle은 PRD 발행만으로 끝나지 않으며 모든 todo done과 워커 러너의 PRD squash merge가 끝나기 전에는 다음 PRD를 만들지 않는다.
- `#plan` / `#todo` / `#veri` — Legacy compatibility 트리거. 기본 토폴로지에서는 plan 은 플래너 러너, todo claim+구현은 워커 러너, 의미 검증은 검증 러너가 자동 처리하므로 새 작업에서는 사용하지 않는다. 명시적 호출 시에만 해당 러너의 startup scan 으로 이어간다.
