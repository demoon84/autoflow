---
kind: synth_answer
slug: singleton-runner-display-labels
runner: wiki
created: 2026-05-03T06:15:00Z
updated: 2026-05-03T06:15:00Z
terms:
  - "singleton runner display labels"
  - "runner display labels"
  - "numeric suffix"
  - "worker display policy"
citations:
  - "tickets/done/prd_058/tickets_060.md"
  - "[[decisions/worker-display-policy]]"
---
# Singleton Runner Display Labels

Autoflow의 3-runner 기본 토폴로지에서 각 역할에 대해 활성화된 러너가 하나만 있는 경우, 사용자에게 보이는 러너 레이블은 숫자 접미사(-1)를 숨기고 "planner", "worker", "LLM Wiki"과 같이 표시됩니다. 역할에 두 개 이상의 활성화된 러너가 있는 경우에는 "worker-1", "worker-2"와 같이 인스턴스를 구분하기 위해 숫자 접미사를 유지합니다.

내부 저장소 ID, 러너 상태 파일 이름, 런타임 역할 키 및 파서에 민감한 필드 값은 변경되지 않고 "planner-1", "owner-1", "wiki-1"로 유지됩니다.
