# Verifier Checklist Template

## Meta

- Ticket ID:
- Target:
- Verifier Version:

## Structural Checks

- [ ] 참조 스펙이 존재한다.
- [ ] Allowed Paths 가 명시되어 있다.
- [ ] 티켓 필수 항목이 비어 있지 않다.
- [ ] `Allowed Paths` 가 `PROJECT_ROOT` 기준으로 해석 가능하다.

## Functional Checks

- [ ] 티켓의 `Done When` 항목이 검증 가능하다.
- [ ] 실제 결과가 `Done When` 과 맞는다.
- [ ] 검증 명령이 올바른 루트에서 실행되었다.

## Quality Checks

- [ ] blocker 가 없다.
- [ ] warning 이 기록되었다.
- [ ] 결과 요약이 티켓과 runs 양쪽에 남는다.

## Result Policy

- 하나라도 치명적인 실패가 있으면 `done` 으로 이동하지 않는다.
- 검증 기록이 없으면 완료로 간주하지 않는다.
