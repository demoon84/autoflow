# Autoflow Order

## Order

- ID: order_157
- Title: wiki commit message 에 source ticket attribution 추가
- Status: inbox
- Priority: normal
- Created At: 2026-05-04T05:15:28Z
- Source: autoflow order create

## Request


`[wiki] wiki knowledge update` 형식의 commit message 가 어떤 PRD/ticket 의 변경에 대한 wiki update 인지 attribution 부재. board traceability 떨어짐.

## 증거 (10시간 모니터링)

monitor 가 emit 한 wiki commit 들 (40+ 건):
```
[wiki] wiki knowledge update     ← 모두 동일 message, 어떤 변경 반영인지 알 수 없음
```

Autoflow rule 8a: pass commit 형식은 `[PRD_NNN][ticket_NNN] 작업내용 요약본` 표준. 그러나 wiki commit 은 이 표준에 미포함.

영향:
- 사용자가 git log 에서 wiki 갱신 출처 추적 어려움
- monitor 의 NEW_COMMIT 알림이 정보량 적음
- 어떤 ticket 의 결과로 어떤 wiki 페이지가 갱신됐는지 매핑 부재

## Suggested Fix

A) **wiki commit 에 source ticket attribution 추가**:
```
# 기존
[wiki] wiki knowledge update

# 개선
[wiki][PRD_NNN][ticket_NNN] update runner-timing + prompt-evolution
또는
[wiki] runner-timing + prompt-evolution refresh (sources: ticket_158, ticket_162)
```

B) **wiki update trigger 에 ticket context 전달**:
- Wiki AI 가 runner adapter 호출 시 가장 최근 처리된 ticket id 를 prompt context 로 받음
- commit message 생성 시 그 ticket 명시

C) **wiki page 별 changelog**:
- 각 wiki .md 파일 끝에 last_update_from: ticket_NNN 같은 frontmatter
- commit message 와 별도로 wiki 안에서도 추적 가능

권장: **A**. 단순하고 traceability 즉시 회복.

## Allowed Paths

- packages/cli/wiki-project.sh
- packages/cli/run-role.sh (wiki adapter 호출부)

## Verification

```bash
# fix 후
git log --since="1 hour ago" --grep "\[wiki\]" --oneline
# 모든 라인이 [wiki][PRD_NNN][ticket_NNN] 또는 ticket attribution 포함
```

## Notes

- 1원칙 자율 회복 자체는 영향 없음. board observability / debuggability 측면.
- order_152 (commit 폭증) 의 후속. commit 갯수 줄임 + attribution 명확화 둘 다.

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- `packages/cli/wiki-project.sh`
- `packages/cli/run-role.sh`

### Verification

- Command: git log --since='1 hour ago' --grep='\[wiki\]' --oneline

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
