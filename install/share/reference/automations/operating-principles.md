# 운영 원칙

Board stage가 권위 있는 상태다. Chat transcript는 권위 있는 상태가 아니다.

Planner, Worker, LLM Wiki는 runner다. Runner는 LLM-backed decision-maker다.
Runner tool은 runner가 하나의 안전한 action을 위해 호출하는 작은 deterministic command다.
Runtime script와 runner tool이 blocked/replan 계획, 구현, 검증, rebase, cherry-pick, conflict resolve, PRD worktree merge, wiki 의미 갱신을 스스로 결정해서는 안 된다.

Wiki 갱신도 같은 AI-first 원칙을 따른다. LLM Wiki runner가 input을 살피고, 새 결정/패턴이 있으면 `autoflow wiki write-page`로 `.autoflow/wiki/**/*.md` markdown page를 갱신한다. qmd cache/index/DB는 선택 검색 가속기이며 wiki source of truth가 아니다. Wiki 작성은 PRD 완료나 goal 완료를 막지 않는다.
