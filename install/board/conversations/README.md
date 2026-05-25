# Conversations

이 폴더는 승인된 conversation handoff를 보관한다.

사용자가 PRD 또는 compact summary 저장을 승인한 뒤에만 사용한다.

권장 경로:

```text
conversations/PRD-<user>-NNN/spec-handoff.md
conversations/goal-acceptance/<YYYYMMDD-HHMM>-<goal-slug>.md
```

PRD queue item이 계속 실행의 source of truth다. Conversation file은 추적성을 위한 보조 자료다.

Goal 완료 note는 `autoflow` skill 대화가 goal complete 전에 수행한 목표 수준 검증의 durable evidence다. 세부 형식은 active core의 `install/share/reference/goal-acceptance-gate.md`를 따른다.
