# PRD Handoff

- Project: project_123
- Spec: tickets/backlog/prd_123.md
- Source: autoflow spec create

## Conversation Summary

```text
# Project

- ID: prd_123
- Title: metrics-project.sh 를 telemetry 기반으로 재작성하고 _stdout.log persist 종료
- AI: planner
- Status: draft

## Core Scope

- Goal: 현재 `metrics-project.sh` 가 4분 36초 걸리는 원인 (105개 done 티켓에 대한 git log/show + 10,000+ runner stdout 의 awk 토큰 파싱) 을 제거하고, PRD-B 가 만드는 `.autoflow/telemetry/runs.jsonl` 을 단일 토큰 사용량 소스로 사용하게 한다. 동시에 `run-role.sh` 의 `_stdout.log` 영구 persist 도 제거해 PRD-A 의 retention 체인을 닫는다 (이후 신규 시스템은 raw `_stdout.log` 가 디스크에 남지 않는다).
- In Scope:
  - `packages/cli/metrics-project.sh` 의 토큰 집계 경로 (`compute_runner_log_token_usage`, `token_usage_from_file`, `token_cache_file` 관련 awk 처리) 를 제거하고 `bin/autoflow telemetry query --target runs --since <window-start> --target runs` 결과를 jq 로 sum 하는 경로로 교체한다.
  - `packages/cli/metrics-project.sh` 의 git-log 기반 commit / numstat 집계 (`process_done_ticket_commits`) 를 캐시 도입 또는 제거 — telemetry 로 집계 가능한 부분 (commit count) 은 telemetry 에 의존하고, code volume 은 별도 helper 또는 하나의 `git log --numstat <since>` 호출 1회로 단축한다.
  - `packages/cli/run-role.sh` 에서 `persist_run_artifact "$adapter_stdout" "stdout"` 호출과 그 경로를 state 에 기록하는 라인 (`last_stdout_log=...`) 을 제거한다. PRD-A 가 이미 닫은 prompt/runtime/dry-run 과 동일한 패턴.
  - `packages/cli/run-role.sh` 의 finalize 경로가 `_live_stdout.log` 를 telemetry record 호출에 마지막으로 1회 사용한 뒤 (PRD-B 의 hook 가 token_input / token_output / stdout_bytes 추출 완료) 즉시 `rm -f` 로 정리하도록 한다 (live log cleanup 이 이미 수행되지만 stdout persist 가 빠진 만큼 흐름이 단순해진다는 점을 명시).
  - 기존 `metrics/token-cache.tsv` 가 cleanup 이후 더 이상 생성되지 않도록 metrics-project.sh 에서 그 파일을 읽고 쓰는 코드 경로를 제거한다. cleanup 후 stale token-cache.tsv 가 board 에 남아있으면 metrics 실행 시 무시되며 exit 0 이다 (자동 삭제는 별건).
  - `metrics/daily.jsonl` 스냅샷 행의 `autoflow_token_usage_count`, `autoflow_token_report_count`, `autoflow_commit_count`, `autoflow_code_files_changed_count`, `autoflow_code_insertions_count`, `autoflow_code_deletions_count`, `autoflow_code_volume_count` 7개 키의 의미는 그대로 유지하되, 산출 소스가 raw 로그/git 전수 스캔 → telemetry+증분 git 으로 바뀜을 README 또는 metrics-project.sh 의 스크립트 헤더 주석에 명시한다.
- Out of Scope:
  - PRD-A 의 prompt/runtime persist 폐쇄, loop tail rotation, legacy 644MB 정리.
  - PRD-B 의 telemetry layer 그 자체.
  - PRD-C 의 wiki summarize-telemetry.
  - desktop renderer UI 의 metrics 표시 변경 — 산출 형식이 동일하므로 UI 변경 불필요.
  - daily.jsonl 의 row schema 변경 — 호환성 유지를 위해 키 이름과 타입 그대로.
  - run-role.sh 의 live log lifecycle 자체 변경 — PRD-A 의 sweep 정책 그대로 사용.

## Main Screens / Modules

- Module: metrics 집계 재작성
  - Path: `packages/cli/metrics-project.sh`
- Module: stdout persist 제거
  - Path: `packages/cli/run-role.sh`

## Allowed Paths

- packages/cli/metrics-project.sh
- packages/cli/run-role.sh

## Global Rules

- Allowed Paths are relative to the host project root.
- Verification commands run from the host project root unless a ticket says otherwise.
- Keep acceptance criteria observable.
- Human-readable PRD prose should be Korean by default. Preserve parser-sensitive section names, field names, ids, paths, commands, code, and runtime formats.
- 어떤 자동화에서도 `git push` 는 금지다.
- PRD-D 는 PRD-B (telemetry data 생성) 의 선행을 전제한다. PRD-B 미머지 상태에서는 telemetry/runs.jsonl 가 없으므로 metrics 토큰 집계가 0 으로 떨어진다는 사실을 PR 머지 전 점검해야 한다.
- daily.jsonl 의 호환성은 깨지 않는다. 스키마/키 이름/타입 변경 금지.

## Global Acceptance Criteria

- [ ] `time bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow .autoflow` 의 real wall time 이 5초 미만이다 (현재 약 4분 36초 대비). 측정은 5회 평균.
- [ ] 위 명령의 stdout 에 출력되는 `autoflow_token_usage_count=N` 의 N 이 `bin/autoflow telemetry query --target runs --since 1970-01-01 | jq -s 'map(.token_input + .token_output) | add // 0'` 의 결과와 정확히 일치한다.
- [ ] worker 또는 planner runner 1 tick 을 실제로 실행한 직후 `.autoflow/runners/logs/` 디렉토리에 새 `_stdout.log` 파일이 생성되지 않는다 (`*.loop.stdout.log` 와 `_live_stdout.log` 는 영향 없음).
- [ ] `.autoflow/telemetry/runs.jsonl` 가 존재하지 않는 fresh board 에 대해 `bin/autoflow metrics` 를 실행하면 `autoflow_token_usage_count=0`, `autoflow_token_report_count=0` 이 나오고 exit 0 으로 끝난다.
- [ ] `metrics-project.sh` 에서 `token_cache_file` / `token_cache_next` / `token_usage_from_file` / `compute_runner_log_token_usage` 식별자가 더 이상 참조되지 않는다 (`grep -n` 결과 0 라인).
- [ ] `metrics/daily.jsonl --write` 모드 (`bin/autoflow metrics ... --write`) 실행 후 새 행이 추가되고, 기존 행의 키 이름과 타입이 그대로 유지된다 (jq schema diff 결과 키 추가/제거 0 건).
- [ ] readBoard IPC 가 30초 안에 응답한다 (cleanup + telemetry 기반 metrics 결합 효과).
- [ ] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Verification

- Command: `time bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow .autoflow && bin/autoflow metrics /Users/demoon2016/Documents/project/autoflow .autoflow --write && npm run desktop:check`
- Notes: 첫 호출이 wall time 5초 미만 검증. 두 번째 `--write` 호출이 daily.jsonl 호환성 검증. 세 번째 desktop:check 가 영향 없음 검증. ticket owner 는 (a) PRD-B 머지된 board 에서 telemetry/runs.jsonl 의 행 수와 metrics 가 보고하는 token sum 일치 확인 (b) telemetry 가 비어있는 fresh board 에서 graceful 0 동작 (c) worker tick 1회 후 새 `_stdout.log` 가 안 생기는지 확인 (d) `grep -n token_cache_file packages/cli/metrics-project.sh` 가 0 라인인지 확인. 자동 검증 최소 기준은 위 Command 시퀀스 exit 0 + 첫 호출 wall time < 5s.

## Conversation Handoff

- Source: 채팅 스레드 (#autoflow 트리거, 2026-05-03). PRD-A/B/C 와 동일 세션 연속.
- Summary: PRD-A 가 prompt/runtime persist 를 닫고 644MB 를 정리했고, PRD-B 가 telemetry layer 를 도입했고, PRD-C 가 Wiki AI 합성 입력에 telemetry 를 추가했다. 본 PRD-D 가 마지막으로 metrics-project.sh 의 4분 36초짜리 raw stdout 스캔을 telemetry jsonl sum 으로 교체하고, run-role.sh 의 `_stdout.log` persist 도 제거해 retention 체인을 닫는다. 결과적으로 `.autoflow/runners/logs/` 의 안정 상태 크기는 약 30MB (loop tail + last_message + 활성 tick 의 live log) 로 수렴한다.

## Notes

- Sibling PRDs: PRD-A (`prd_120`) retention/cleanup, PRD-B (`prd_121`) telemetry data, PRD-C (`prd_122`) Wiki AI 통합. PRD-D 는 PRD-B 선행이 필요하지만 PRD-A / PRD-C 와는 독립적이다.
- 본 PRD 머지 후 PRD-A 의 cleanup 스크립트 (`cleanup-runner-logs.sh`) 의 삭제 대상에 `_stdout.log` 도 포함되도록 했음을 ticket owner 가 한 번 더 확인한다 (PRD-A 의 in-scope 명세에 이미 포함됨).
- `metrics/token-cache.tsv` 는 본 PRD 가 작성/읽기 경로 양쪽을 모두 끊는다. 기존 파일의 board-level 삭제는 별도 1회성 작업으로, ticket owner 가 머지와 함께 수동 1회 `rm -f .autoflow/metrics/token-cache.tsv` 를 권장한다 (PRD 의 자동화 범위 외).
- 측정 기준: "5초 미만" 은 현재 4분 36초 대비 ~50배 가속을 목표로 하는 보수적 기준이다. 실제로는 jq sum 만 하므로 1초 미만이 기대치이지만, jsonl 행 수가 100k 를 넘는 케이스도 5초 안에 들어와야 한다는 운영 SLA 로 둔다.
- Wiki query 결과 동일 주제 선행 PRD 없음.
```
