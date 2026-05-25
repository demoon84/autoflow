# Goal 완료 점검

이 문서는 `autoflow` skill 대화가 goal complete 직전에 확인하는 기준이다.

## 원칙

- goal complete는 `autoflow` skill 대화가 수행한다.
- PRD 1개 완료는 goal 완료가 아니다.
- 완료 판단은 최초 goal의 완료 조건이 보드 evidence로 덮였는지를 본다.
- LLM Wiki 작성 여부는 goal complete의 필수 조건이 아니다.
- 부족분이 있으면 새 PRD를 발행한다.

## 입력

Skill 대화는 최소한 아래를 확인한다.

- 최초 goal과 완료 조건.
- `autoflow status <project-root> <board-dir>` 결과.
- active PRD/TODO/verifier 상태.
- 완료된 PRD와 TODO evidence.
- Verifier `pass | revise | replan` 기록.
- PRD worktree commit/merge evidence.
- 사용자가 확인해야 하는 남은 gap.

## Pass 조건

- 최초 goal의 완료 조건이 PRD/TODO/verifier/commit/merge evidence로 설명된다.
- 진행 중인 critical PRD/TODO/verifier 작업이 없다.
- 실패한 verifier 후속조치가 남아 있지 않다.
- PRD worktree merge가 필요한 PRD는 merge evidence가 남아 있다.
- 사용자 확인이 필요한 항목이 없다.

## Fail 조건

- 완료 조건 중 하나 이상이 evidence로 덮이지 않았다.
- verifier 실패, revise, replan 후속조치가 남아 있다.
- PRD worktree commit/merge evidence가 누락되었다.
- 목표 수준 사용자 흐름이 아직 충족되지 않았다.

`fail`이면 goal complete를 호출하지 않고 새 PRD 발행, TODO 재작업, verifier 후속조치 중 하나로 돌린다.

## Needs User 조건

- 외부 계정, 실제 배포 환경, 유료 서비스, 사용자의 주관적 판단처럼 runner evidence만으로 판단할 수 없는 항목이 남았다.
- 목표 자체가 바뀌어야 한다.

## 완료 기록

가능하면 보드에 짧은 완료 점검 note를 남긴다.

권장 경로:

```text
conversations/goal-acceptance/<YYYYMMDD-HHMM>-<goal-slug>.md
```

권장 형식:

```markdown
# Goal 완료 점검

- Goal: <원 목표 요약>
- Decision: pass | fail | needs_user
- Checked At: <ISO time>
- Checked By: autoflow skill

## Completion Criteria

- [x] <조건과 evidence 연결>
- [ ] <미충족 또는 사용자 확인 필요 조건>

## Board State

- Active PRD: <none 또는 목록>
- Pending TODO: <none 또는 목록>
- Verifier Queue: <none 또는 목록>
- PRD Merge Pending: <none 또는 목록>

## Evidence

- <PRD/TODO/verifier/commit/merge evidence>

## Wiki

- Status: deferred | not_required | updated
- Note: LLM Wiki는 완료 차단 조건이 아니다.

## Next Action

- pass: goal complete
- fail: PRD 추가 발행 또는 runner 후속조치
- needs_user: 사용자 확인 요청
```
