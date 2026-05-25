# PRD 작성 계약

## 임무

이 문서는 `autoflow` skill 대화가 PRD를 발행할 때 사용하는 작성 기준이다. Skill 대화는 프로젝트 현재 구현 상태와 LLM Wiki를 read-only로 참고해 goal 달성을 위한 PRD를 하나 이상 발행한다.

## 입력

- 사용자 goal과 완료 조건.
- 현재 보드 상태.
- 프로젝트 현재 구현 상태.
- 완료된 PRD/TODO/verifier/commit/merge evidence.
- 관련 LLM Wiki query 결과.
- `reference/autoflow-state-loop.md`.
- `reference/prd-template.md`.

## 출력

- 목표 달성에 필요한 PRD 하나 이상.
- 관찰 가능한 Global Acceptance Criteria.
- 안전한 Allowed Paths.
- Verification intent.
- Planner/Worker/Verifier가 이해할 수 있는 Conversation Handoff.

## 규칙

1. PRD는 하나 이상 발행할 수 있다.
2. Active PRD가 있다는 이유만으로 새 PRD 발행을 막지 않는다.
3. 같은 범위의 중복 PRD는 만들지 않는다.
4. 작은 요청도 PRD로 발행한다.
5. PRD 본문은 한국어로 쓴다.
6. 명령어, 경로, key=value, JSON/TOML/YAML key, ticket field, parser-sensitive heading은 원래 표기를 유지한다.
7. 불확실한 값은 추측하지 않고 `TBD` 또는 `undecided`로 표시한다.
8. PRD 하나에서 여러 TODO가 필요하면 `## Work Item Split`을 작성한다.
9. PRD는 구현, 검증 decision, PRD worktree commit/merge, 위키 작성을 수행하지 않는다.

## 작성 절차

1. 목표와 완료 조건을 한 문단으로 요약한다.
2. 현재 상태와 done evidence에서 부족분을 찾는다.
3. 부족분을 PRD 하나 이상으로 나눈다.
4. 각 PRD의 In Scope와 Out of Scope를 분리한다.
5. Allowed Paths를 좁힌다.
6. Acceptance Criteria를 관찰 가능하게 쓴다.
7. Verification command 또는 none-shell 검토 기준을 쓴다.
8. PRD별 TODO 분해가 필요하면 `Work Item Split`을 쓴다.
9. 다음 runner를 위한 handoff를 짧게 남긴다.

## Work Item Split 슬롯

`Work Item Split`의 각 항목에는 `Depends On:`과 `Notes:` 슬롯을 함께 둔다. `Depends On:`은 다른 work item이 먼저 완료되어야 같은 PRD worktree에서 안전하게 진행할 수 있을 때 해당 TODO id를 적고, 독립 실행 가능하면 `Depends On: (없음)`처럼 비운 이유를 명확히 남긴다. `Notes:`는 worker/verifier가 놓치면 안 되는 제약, 위험, 수동 확인 기준, handoff 맥락이 있을 때 채우고, 별도 메모가 없으면 `Notes: (없음)` placeholder를 권장한다.

## Acceptance Criteria 태그

`Global Acceptance Criteria`와 work item `Done When`의 체크박스는 `- [ ] (auto) ...` 또는 `- [ ] (manual) ...` 형식으로 작성한다.

- `(auto)`는 명령 실행, 파일 내용, diff, 상태값처럼 verifier가 evidence로 자동 확인할 수 있는 항목에 쓴다.
- `(manual)`은 UI 시각 확인, 문구의 자연스러움, 디자인 품질, 사람이 직접 봐야 하는 사용자 경험 판단에 쓴다.
- 한 항목 안에 자동 검증 가능한 조건과 사람 확인이 필요한 조건이 함께 있으면 한 줄에 섞지 않고 별도 체크박스로 분리한다.

## PRD 추가 발행

PRD 완료 뒤 skill 대화는 다음을 확인한다.

- 목표 완료 조건이 이미 충족됐는가?
- 남은 부족분이 있는가?
- 기존 PRD/TODO/verifier evidence가 새 제약을 드러냈는가?
- 추가 PRD가 필요한가?
- 사용자 확인 없이 계속 진행해도 되는가?

부족분이 있으면 PRD를 추가 발행한다. 목표 자체가 바뀐 경우에는 새 goal이 필요하다.
