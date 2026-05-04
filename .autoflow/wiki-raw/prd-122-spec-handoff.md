---
kind: raw_source
slug: prd-122-spec-handoff
original_path: ".autoflow/conversations/prd_122/spec-handoff.md"
ingested_at: 2026-05-03T23:48:39Z
updated_at: 2026-05-03T23:48:39Z
sha256: b1eb0cca67706f7a5fd7e917727424d329f879c5b8b36bd113c6486f4e140db5
---

# PRD Handoff

- Project: project_122
- Spec: tickets/backlog/prd_122.md
- Source: autoflow spec create

## Conversation Summary

```text
# Project

- ID: prd_122
- Title: Wiki AI synthesis 가 telemetry jsonl 을 입력으로 받기
- AI: planner
- Status: draft

## Core Scope

- Goal: PRD-B 가 만드는 `.autoflow/telemetry/runs.jsonl` / `failures.jsonl` 을 Wiki AI 가 합성 입력으로 받아 runner health, timing, prompt 진화 같은 정량 정보가 담긴 wiki 페이지를 자동 갱신하게 만든다. 이로써 Wiki AI 가 raw 로그 스캔 없이 정량 데이터를 인용하는 합성을 산출할 수 있게 된다.
- In Scope:
  - `packages/cli/wiki-project.sh` 에 신규 subcommand `summarize-telemetry` 를 추가한다. 인자: `[project-root] [board-dir-name] --slug SLUG --window N` (`N` 은 `7d`, `30d`, `all` 같은 형식). 동작: jsonl 을 jq 로 집계해 한 wiki 페이지 markdown 을 생성/덮어쓰기.
  - 3개 표준 slug 를 정의해 하나의 명령으로 모두 갱신 가능하게 한다 (`--all-standard-slugs` 또는 `--slug-set telemetry-default`):
    - `operations/runner-health.md` — `failures.jsonl` 7일 기준 failure_class 별 count, 가장 빈번한 패턴 top 5, 자동 회복률 (다음 tick 에서 result=success 로 회복된 비율).
    - `operations/runner-timing.md` — `runs.jsonl` 7일 기준 runner 별 duration_ms 의 p50/p95/p99 와 tick 수.
    - `agents/prompt-evolution.md` — `runs.jsonl` 30일 기준 prompt_template_hash 별 success rate 와 사용 횟수.
  - 각 자동 생성 페이지의 첫 줄에 frontmatter `auto_generated: telemetry-summary`, `last_synced_at`, `window`, `source_event_count` 를 박는다.
  - empty input (`runs.jsonl` 또는 `failures.jsonl` 부재 또는 0 라인) 시에도 graceful: 페이지 본문에 "no telemetry data yet" 안내 + frontmatter 의 `source_event_count=0`. exit 0.
  - `.autoflow/agents/wiki-maintainer-agent.md` 의 procedure 섹션에 단계 추가: `wiki update` 가 끝난 직후 `wiki summarize-telemetry --slug-set telemetry-default --window 7d` 를 1회 호출하고, 이어 기존 `wiki query --synth` 또는 `wiki lint --semantic` 흐름으로 진입한다. 이 단계는 Wiki AI 의 debounce 정책 (`AUTOFLOW_WIKI_DEBOUNCE_*`) 적용 대상이며 별도의 신규 debounce 키는 만들지 않는다.
  - `wiki summarize-telemetry` 는 telemetry input 이 변하지 않았으면 (jsonl mtime 와 라인 수가 이전 sync 와 동일) 페이지 갱신을 skip 하고 `summary_status=skipped_unchanged` 를 출력한다.
- Out of Scope:
  - PRD-A 의 retention/cleanup, PRD-B 의 telemetry 데이터 생성, PRD-D 의 metrics-project.sh 재작성.
  - Wiki AI synthesis prompt 자체의 대규모 재작성 — 본 PRD 는 입력 페이지를 추가할 뿐, 합성 프롬프트는 기존 흐름을 그대로 사용한다.
  - 새로운 Wiki AI runner 추가. 기존 `wiki` runner 가 그대로 처리한다.
  - desktop renderer UI 의 새 wiki 표시 화면 — wiki 페이지는 기존 ingest 경로로 이미 표시 가능.
  - 정량 차트 / 그래프 렌더링. 본 PRD 는 markdown table + bullet list 까지만 생성한다.

## Main Screens / Modules

- Module: 신규 wiki summarize-telemetry subcommand
  - Path: `packages/cli/wiki-project.sh`
- Module: wiki AI procedure 갱신
  - Path: `.autoflow/agents/wiki-maintainer-agent.md`
- Module: 표준 slug 출력 페이지 (생성됨)
  - Path: `.autoflow/wiki/operations/runner-health.md`
  - Path: `.autoflow/wiki/operations/runner-timing.md`
  - Path: `.autoflow/wiki/agents/prompt-evolution.md`

## Allowed Paths

- packages/cli/wiki-project.sh
- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/wiki/operations/runner-health.md
- .autoflow/wiki/operations/runner-timing.md
- .autoflow/wiki/agents/prompt-evolution.md

## Global Rules

- Allowed Paths are relative to the host project root.
- Verification commands run from the host project root unless a ticket says otherwise.
- Keep acceptance criteria observable.
- Human-readable PRD prose should be Korean by default. Preserve parser-sensitive section names, field names, ids, paths, commands, code, and runtime formats.
- 어떤 자동화에서도 `git push` 는 금지다.
- 본 PRD-C 는 PRD-B (telemetry data 생성) 가 머지되어 `runs.jsonl` 가 존재하는 환경을 전제한다. 그러나 PRD-B 미머지 상태에서도 `summarize-telemetry` 는 empty input 으로 graceful 하게 동작해야 한다.
- 자동 생성 페이지는 ticket owner 또는 사람이 손으로 편집해도 다음 sync 시 덮어쓰기되므로 `## Manual notes` 같은 섹션을 별도 wiki 페이지에 두는 안내를 페이지 frontmatter 또는 본문 상단에 명시한다.

## Global Acceptance Criteria

- [ ] `bin/autoflow wiki summarize-telemetry /Users/demoon2016/Documents/project/autoflow .autoflow --slug operations/runner-health --window 7d` 가 exit 0 이고 stdout 에 `summary_status=`, `slug=operations/runner-health`, `source_event_count=` key=value 를 출력한다.
- [ ] 위 명령 실행 후 `.autoflow/wiki/operations/runner-health.md` 가 존재하고 첫 줄 frontmatter 에 `auto_generated: telemetry-summary`, `window: 7d`, `source_event_count`, `last_synced_at` 4개 키가 모두 존재한다.
- [ ] `bin/autoflow wiki summarize-telemetry ... --slug-set telemetry-default --window 7d` 가 3개 페이지 (`operations/runner-health.md`, `operations/runner-timing.md`, `agents/prompt-evolution.md`) 를 한 번에 갱신하고 stdout 에 각 slug 의 `summary_status` 가 줄단위로 출력된다.
- [ ] `runs.jsonl` 가 존재하지 않는 board 에 대해 위 명령을 실행하면 페이지가 생성되되 본문에 "no telemetry data yet" 문구를 포함하고 frontmatter `source_event_count=0` 이며 exit 0 이다.
- [ ] 동일 input 으로 두 번째 호출하면 모든 slug 의 `summary_status=skipped_unchanged` 가 출력되고 페이지 mtime 가 변하지 않는다.
- [ ] `failures.jsonl` 에 의도적으로 5개 행을 추가한 뒤 `summarize-telemetry --slug operations/runner-health --window 7d` 를 호출하면 페이지의 `## Failure Patterns` 섹션에 failure_class 별 카운트 표가 포함된다.
- [ ] `runs.jsonl` 에 worker / planner runner 의 duration_ms 행 10개를 추가한 뒤 `summarize-telemetry --slug operations/runner-timing --window 7d` 를 호출하면 페이지에 runner 별 p50/p95/p99 표가 포함된다.
- [ ] `.autoflow/agents/wiki-maintainer-agent.md` 의 procedure 섹션에 `wiki summarize-telemetry --slug-set telemetry-default` 호출 단계가 명시되어 있고, 그 단계가 기존 `wiki update` 와 `wiki query --synth` 사이에 들어간다.
- [ ] Wiki AI runner 가 한 tick 을 실제로 돌리면 (debounce 통과 가정) 3개 자동 생성 페이지의 mtime 가 갱신되고 runner state 의 last_result 가 `idle` 또는 `success` 다 (`failed` 가 아니다).
- [ ] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Verification

- Command: `bin/autoflow wiki summarize-telemetry /Users/demoon2016/Documents/project/autoflow .autoflow --slug-set telemetry-default --window 7d && bin/autoflow wiki summarize-telemetry /Users/demoon2016/Documents/project/autoflow .autoflow --slug-set telemetry-default --window 7d && npm run desktop:check`
- Notes: 첫 호출이 페이지 생성/갱신, 두 번째 호출이 idempotent skip 을 검증한다. ticket owner 는 (a) telemetry 가 비어있는 fresh board 에서 graceful empty 케이스 (b) 의도적 failure 행 5개 + duration 행 10개 주입 후 페이지 표 검증 (c) Wiki AI runner 1 tick 수동 실행으로 procedure 통합 검증 을 추가로 spot-check 한다. 자동 검증 최소 기준은 위 Command 시퀀스 exit 0 이다.

## Conversation Handoff

- Source: 채팅 스레드 (#autoflow 트리거, 2026-05-03). PRD-A/B 와 동일 세션 연속.
- Summary: PRD-B 가 만든 telemetry jsonl 을 Wiki AI 가 합성 입력으로 끌어쓰게 한다. 신규 subcommand `wiki summarize-telemetry` 가 jsonl 을 집계해 3개 표준 wiki 페이지 (runner-health, runner-timing, prompt-evolution) 를 자동 갱신하고, Wiki AI procedure 가 매 tick 에 한 번 그 명령을 호출한다. PRD-C 는 PRD-B 선행 필요. PRD-A 와 무관.

## Notes

- Sibling PRDs: PRD-A (`prd_120`) retention, PRD-B (`prd_121`) telemetry data, PRD-D metrics-project 재작성. PRD-C 는 PRD-B 선행이 필요하지만 PRD-D 와는 독립적이다.
- 자동 생성 wiki 페이지 안에 사람이 편집한 내용은 다음 sync 에서 덮어쓰기된다. 이를 명시하는 안내 문구를 페이지 본문 상단에 박아 자동/수동 영역을 분리한다. 사용자가 별도로 보존하고 싶은 메모는 `wiki/answers/` 또는 `wiki/decisions/` 같은 사람이 소유하는 슬러그 영역에 두도록 권장한다.
- Wiki AI debounce (`AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES`, `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS`) 가 telemetry sync 호출에도 그대로 적용된다. 매 분 호출되는 게 아니라 debounce 통과 시점에만 호출된다.
- 페이지 frontmatter 의 `auto_generated: telemetry-summary` 키를 `wiki retrofit-frontmatter` 가 보존해야 한다. 본 PRD 에서 retrofit 동작 변경은 안 하지만 ticket owner 가 동작을 spot-check 한다.
- Wiki query 결과 동일 주제 선행 PRD 없음.
```
