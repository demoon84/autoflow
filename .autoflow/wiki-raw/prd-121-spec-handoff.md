---
kind: raw_source
slug: prd-121-spec-handoff
original_path: ".autoflow/conversations/prd_121/spec-handoff.md"
ingested_at: 2026-05-03T23:48:39Z
updated_at: 2026-05-03T23:48:39Z
sha256: 5fee720db1a7292288750249bf240174f24681dec46e98dd6ad96855393b7371
---

# PRD Handoff

- Project: project_121
- Spec: tickets/backlog/prd_121.md
- Source: autoflow spec create

## Conversation Summary

```text
# Project

- ID: prd_121
- Title: telemetry layer 도입 - tick 별 구조화 이벤트 jsonl 추출
- AI: planner
- Status: draft

## Core Scope

- Goal: runner tick 마다 raw 로그 (`_live_stdout.log`, `_live_stderr.log`, runtime 메타데이터) 를 한 줄짜리 구조화 이벤트로 distill 해 `.autoflow/telemetry/runs.jsonl` 에 append 하고, 실패 이벤트는 `failures.jsonl` 에도 동시 기록한다. 이로써 metrics-project, coordinator, Wiki AI 가 raw 로그 스캔 대신 jsonl query 로 동일 신호를 얻게 만든다. 본 PRD-B 는 데이터 생성과 query/compact 도구만 담당하고, 기존 `_stdout.log` 보존 정책은 PRD-A 가 정한 대로 둔다.
- In Scope:
  - 신규 디렉토리 `.autoflow/telemetry/` 와 그 안의 `.gitignore` (`*.jsonl`, `*.jsonl.gz` 무시) 를 scaffold-project / upgrade-project 가 자동 생성하도록 한다.
  - 신규 스크립트 `packages/cli/telemetry-project.sh` 를 추가한다. 서브커맨드: `record`, `query`, `compact`, `self-test`.
    - `record` 는 stdin 으로 받은 JSON 또는 명령줄 플래그 (`--runner`, `--started-at`, `--ended-at`, `--result`, `--failure-class`, `--token-input`, `--token-output`, `--ticket-id`, `--prd-key`, `--model`, `--prompt-template-hash`, `--stdout-bytes`, `--stderr-bytes`) 를 받아 한 줄 jsonl 을 `.autoflow/telemetry/runs.jsonl` 에 append. `result` 가 `failed` 또는 `killed` 면 같은 행을 `.autoflow/telemetry/failures.jsonl` 에도 append.
    - `query` 는 `--runner`, `--result`, `--since`, `--until`, `--limit`, `--prd-key`, `--ticket-id`, `--target` (`runs|failures`) 옵션으로 jsonl 을 jq-friendly 로 stdout 출력 (corrupt 행은 skip).
    - `compact --before <ISO date>` 는 해당 날짜 이전 행을 `runs.YYYY-MM.jsonl.gz` 로 묶고 원본 jsonl 에서 제거. `failures.jsonl` 은 동일 키로 별도 archive.
    - `self-test` 는 임시 board 에서 record × 3 (1 success, 1 failed, 1 killed) → query → compact 시퀀스를 돌려 모든 단계 exit 0 을 확인하고 `self_test_status=ok` key=value 출력.
  - `packages/cli/run-role.sh` 의 adapter 종료 finalize 경로 (현재 `emit_file_block ... rm -f ...` 직전) 에서 telemetry record 를 1회 호출한다. 호출 실패는 silent (telemetry 손실은 다음 tick 에 영향 안 줌).
  - `bin/autoflow` dispatcher 에 `telemetry` 라우팅을 추가해 `autoflow telemetry record` / `query` / `compact` / `self-test` 가 동작한다.
  - `cli-common.sh` 에 `telemetry_root_path()`, `telemetry_runs_jsonl_path()`, `telemetry_failures_jsonl_path()` 헬퍼 함수를 추가해 다른 스크립트가 같은 경로를 일관되게 참조한다.
- Out of Scope:
  - PRD-A 의 prompt/runtime persist 폐쇄, loop tail rotation, legacy 644MB 정리.
  - PRD-C 의 Wiki AI synthesis 입력 확장.
  - PRD-D 의 metrics-project.sh 재작성. PRD-B 는 telemetry 데이터 생성만; 기존 metrics-project.sh 가 stdout.log 를 계속 읽는 것은 그대로.
  - desktop renderer UI 가 telemetry 를 표시하는 신규 화면 — 별건.
  - Codex 외 어댑터 (Claude / OpenCode / Gemini) 의 token 추출 로직 신설 — 일단 Codex stdout 의 token usage 라인 패턴만 다루고, 다른 어댑터는 `token_input`/`token_output` 가 0 이어도 record 는 정상 작동.

## Main Screens / Modules

- Module: 신규 telemetry 스크립트
  - Path: `packages/cli/telemetry-project.sh`
- Module: telemetry 헬퍼
  - Path: `packages/cli/cli-common.sh`
- Module: run-role finalize 후크
  - Path: `packages/cli/run-role.sh`
- Module: dispatcher 라우팅
  - Path: `bin/autoflow`
- Module: scaffold/upgrade telemetry 디렉토리 자동 생성
  - Path: `packages/cli/scaffold-project.sh`
  - Path: `packages/cli/upgrade-project.sh`
  - Path: `packages/cli/package-board-common.sh`

## Allowed Paths

- packages/cli/telemetry-project.sh
- packages/cli/cli-common.sh
- packages/cli/run-role.sh
- packages/cli/scaffold-project.sh
- packages/cli/upgrade-project.sh
- packages/cli/package-board-common.sh
- bin/autoflow

## Global Rules

- Allowed Paths are relative to the host project root.
- Verification commands run from the host project root unless a ticket says otherwise.
- Keep acceptance criteria observable.
- Human-readable PRD prose should be Korean by default. Preserve parser-sensitive section names, field names, ids, paths, commands, code, and runtime formats.
- 어떤 자동화에서도 `git push` 는 금지다.
- jsonl append 는 1줄 단위 atomic 으로 (`flock` + `printf '%s\n' "$row"` >> file). concurrent runner 가 같은 jsonl 에 동시에 쓸 때 행이 섞이지 않게 한다.
- corrupt 행이 발견돼도 query 는 `set -e` 로 죽지 않고 skip + stderr 에 1줄 경고 후 계속 진행한다.

## Global Acceptance Criteria

- [ ] `bash packages/cli/telemetry-project.sh self-test` 가 `self_test_status=ok` 를 stdout 에 출력하고 exit 0 으로 끝난다.
- [ ] worker runner 1 tick 을 실제로 실행한 직후 `.autoflow/telemetry/runs.jsonl` 의 라인 수가 정확히 +1 증가하고, 새로 추가된 행이 jq 로 parse 가능하며 `event_version`, `runner_id`, `started_at`, `ended_at`, `duration_ms`, `result` 필드가 모두 존재한다.
- [ ] adapter 가 stderr 에 비어있지 않은 출력을 남기고 exit code !=0 으로 끝나는 시뮬레이션 tick 후, `.autoflow/telemetry/failures.jsonl` 의 라인 수가 +1 증가하고 새로 추가된 행에 `result` 가 `failed` 또는 `killed` 이며 `failure_class` 가 비어있지 않다.
- [ ] `bin/autoflow telemetry query --limit 5 --target runs` 가 마지막 5행을 시간 내림차순 jsonl 형식으로 stdout 에 출력하고 exit 0 이다.
- [ ] `bin/autoflow telemetry query --runner worker --result success --limit 10` 가 `runner=worker AND result=success` 조건을 만족하는 행만 반환한다.
- [ ] `printf '{invalid' >> .autoflow/telemetry/runs.jsonl` 로 일부러 한 줄을 깨도 `bin/autoflow telemetry query --limit 5` 가 그 행을 skip 하고 정상 행 5개를 반환하며 exit 0 이다.
- [ ] `bin/autoflow telemetry compact --before 2026-01-01` 가 archive 대상이 없을 때 `archived_count=0` 와 `archive_path=` (빈 값) 을 출력하고 exit 0 이다.
- [ ] 임시 board 에 2026-04-01 mtime 의 가짜 행을 넣고 `bin/autoflow telemetry compact --before 2026-04-15` 를 호출하면 `archived_count>=1`, `archive_path=.../runs.2026-04.jsonl.gz` 가 출력되고 원본 `runs.jsonl` 에서 그 행이 제거된다.
- [ ] `packages/cli/scaffold-project.sh` / `upgrade-project.sh` 실행 후 `.autoflow/telemetry/` 디렉토리와 `.autoflow/telemetry/.gitignore` 가 존재한다.
- [ ] telemetry record 호출이 적용된 후 `packages/cli/run-role.sh` 의 한 tick 안에서 record 호출이 정확히 1회 일어나고 (telemetry self-trace log 또는 jsonl 라인 +1 로 확인), record 자체가 실패해도 tick 의 기존 finalize 흐름은 영향받지 않는다.
- [ ] `npm run desktop:check` 가 exit 0 으로 통과한다.

## Verification

- Command: `bash packages/cli/telemetry-project.sh self-test && bin/autoflow telemetry compact --before 2026-01-01 && npm run desktop:check`
- Notes: self-test 가 record/query/compact + corrupt 행 skip + concurrent flock 까지 단위로 검증한다. ticket owner 는 추가로 (a) worker 또는 planner runner 한 tick 을 실제로 실행해 `runs.jsonl` 에 1행 추가되는지 확인 (b) 의도적 실패 시뮬레이션으로 `failures.jsonl` 에 1행 추가되는지 확인 (c) 두 runner 를 동시에 띄워 `flock` 으로 라인 corrupt 가 발생하지 않는지 spot-check 한다. 자동 검증 최소 기준은 위 Command 시퀀스 exit 0 이다.

## Conversation Handoff

- Source: 채팅 스레드 (#autoflow 트리거, 2026-05-03). PRD-A `prd_120` 와 동일 세션 연속.
- Summary: 644MB 누적 로그 분석 결과 raw `_stdout.log`, `_stderr.log` 를 매번 스캔하는 metrics-project.sh 가 4분 36초까지 늘어났고, Wiki AI 도 raw 로그를 구조화 신호로 쓸 수 없었다. 본 PRD-B 는 tick 별 1줄 jsonl 이벤트로 distill 해 raw 로그 스캔 없이 동일 신호 (token 사용량, 실패 패턴, tick 시간) 를 빠르게 얻게 한다. PRD-A 는 retention/cleanup, PRD-C 는 Wiki AI 입력 확장, PRD-D 는 metrics-project.sh 를 telemetry 기반으로 재작성. PRD-B 는 데이터 생산자.

## Notes

- Sibling PRDs: PRD-A (`prd_120`) retention 정책, PRD-C Wiki AI synthesis 입력 확장, PRD-D metrics-project.sh 재작성. PRD-B 가 PRD-C / PRD-D 의 선행이다. PRD-A 와는 독립적이라 어느 쪽이 먼저 머지돼도 OK.
- `event_version=1` 로 시작. 향후 필드 추가는 lower-version reader 가 unknown 필드를 무시하는 형태로 backward-compatible.
- Codex 외 어댑터 (Claude / OpenCode / Gemini) 의 token 추출은 `metrics-project.sh` 의 기존 awk 패턴을 차용. 패턴 미스매치 시 `token_input=0`, `token_output=0` 그대로 기록.
- `flock` 은 macOS 와 Linux 모두 동작 검증됐다 (Autoflow 는 Linux/macOS 만 지원).
- `runs.jsonl` 의 일 누적 추정: 일 1,000 tick × 250 byte ≈ 250KB/day. 1년 = 90MB. compact 로 월별 gzip archive 시 ~1/5.
- Wiki query 결과 동일 주제 선행 PRD 없음.
```
