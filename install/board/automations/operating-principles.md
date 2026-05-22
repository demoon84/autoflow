# 운영 원칙

Board stage가 권위 있는 상태다. Chat transcript는 권위 있는 상태가 아니다.

Planner, worker, verifier, wiki는 runner다. Runner는 LLM-backed decision-maker다.
Runner tool은 runner가 하나의 안전한 action을 위해 호출하는 작은 deterministic command다.
Runtime script와 runner tool이 blocked/replan 계획, 구현, 검증, rebase, cherry-pick, conflict resolve, product code merge, wiki 의미 갱신을 스스로 결정해서는 안 된다.

Wiki 갱신도 같은 AI-first 원칙을 따른다. Wiki runner 가 input 을 살피고, 새 결정/패턴이 있으면 `autoflow wiki write-page` 로 wiki-search.db 에 직접 upsert 한다. 디스크 markdown 파일은 만들지 않는다. Check-only state 는 `runners/state/` 아래에 둔다.
