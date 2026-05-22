# 위키 러너 시작 규칙

`wiki-maintainer` / `wiki` runner에 주입되는 role rule이다.

## Startup Scan

- Normal admitted wiki runner turn의 첫 command로 `"$AUTOFLOW_CLI" tool runner-tool wiki tick`을 실행한다. 이 tool은 source source summary, baseline update, telemetry summary, source 변경 시 index refresh, deterministic lint를 이미 batch한다. 기본 output은 compact이며, manual diagnostic일 때만 `--verbose`를 쓴다. 긴 index refresh는 기본적으로 background에서 시작하므로 LLM turn에서 그 background terminal을 기다리거나 poll하지 않는다.
- `tick`이 failed step을 보고하거나 사용자가 raw check를 명시적으로 요청하지 않는 한 `source-snapshot`, `update-baseline`, `telemetry-summary`, `index-refresh`, `lint`를 따로 fan out하지 않는다.
- Focused wiki synthesis가 필요한지 판단할 때 compact `tick.ai_followup_scope.inspect_only_recent_sources` path만 사용한다.
- Focused wiki page follow-up이 추천되면 page claim을 `tick.ai_followup_scope.inspect_only_recent_sources`에 포함된 최근 `tickets/done/` evidence path와만 비교한다. Page가 이미 있더라도 stale claim은 고친다.
- Focused review 중 broad search를 실행하지 않고, `tick.ai_followup_scope.inspect_only_recent_sources` 밖 file을 열지 않으며, 그 파일 안에서 발견한 reference를 따라가지 않는다. Scoped evidence가 부족하면 임의로 확장하지 말고 그 사실을 기록하고 idle한다.
- Turn 하나에서 focused wiki page는 최대 하나만 편집한다. 이후 `wiki tick --skip-telemetry`를 한 번 다시 실행한다. 재실행 결과 `ai_followup_recommended=true` 또는 `recent_done_pending_review_count > 0` 이면 완료처럼 말하지 말고 stop hook이 다음 focused wiki turn을 이어가게 둔다. 남은 follow-up이 없을 때만 idle한다.
- Focused wiki turn 중 `runner-stage`, `date`를 호출하지 않는다. Desktop이 PTY state를 추적하고, 정확한 timestamp를 위해 model/tool turn을 추가로 쓰는 것은 가치가 낮다. Exact timestamp가 이미 scope 안에 없으면 기존 frontmatter timestamp를 유지한다.
- `tick.ai_followup_recommended=false`이면 source file을 열지 말고 routine result를 요약한 뒤 idle한다.

## 위키 작업

- Material source drift가 있을 때만 deterministic baseline을 refresh한다.
- 재사용 가능한 decision, recurring failure, architecture note, synthesis answer를 위해 focused wiki page를 추가하거나 갱신한다.
- Focused wiki page를 수동 편집한 뒤에는 `wiki tick --skip-telemetry`를 한 번 다시 실행해 해당 edit 주변 index/lint를 refresh한다.
- Managed section 밖의 human-authored content는 보존한다.
- Prior wiki context가 이미 있을 수 있으면 새 concept page를 만들기 전에 RAG query를 사용한다.

## Boundaries

- Wiki는 derived knowledge이며 ticket state의 source of truth가 아니다.
- Wiki에 맞추기 위해 ticket을 편집하지 않는다.
- Board-local `wiki/`, `wiki-raw/`, runner state/log path 아래에만 쓴다.
- push하지 않는다.
