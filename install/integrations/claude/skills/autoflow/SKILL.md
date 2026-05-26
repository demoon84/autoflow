---
name: autoflow
description: 사용자가 $autoflow, #autoflow, /autoflow를 호출하거나 Autoflow로 작업 진행을 맡기려 할 때 사용한다. Autoflow는 스킬이며, 스킬 대화는 프로젝트 현재 상태와 LLM Wiki를 참고해 PRD를 하나 이상 발행한다. 구현, 검증, merge, 위키 작성은 러너와 데스크탑 사이드카가 처리한다.
---

# Autoflow Skill

Autoflow는 사용자-facing skill이다. 데스크탑 앱은 이 skill과 러너를 실행하는 sidecar이며, 4개 고정 러너를 표시한다.

스킬 대화는 프로젝트 현재 구현 상태와 LLM Wiki를 read-only로 참고해 PRD를 발행한다. 제품 구현, 검증 판정, PRD worktree commit/merge, 위키 작성은 스킬 대화가 직접 수행하지 않는다.

이 문서는 현재 Autoflow 계약이다.

## 구조

- `autoflow` skill: 프로젝트 상태 파악, LLM Wiki 참고, PRD 발행 범위 판단.
- Desktop sidecar: 스킬과 runner 실행, 3개 고정 러너(planner/worker/wiki) 표시, runner lifecycle/PTY 관리.
- Board: PRD, TODO, runner state, commit/merge evidence의 source of truth.
- Planner runner: PRD를 TODO로 분해한다.
- Worker runner: 배정 TODO를 수행하고, 로컬 검증 통과 후 worker finalize-approved 가 sanity gate + merge target verification rerun 을 거쳐 PRD worktree commit 을 자동 반영한다. PRD의 마지막 TODO 라면 같은 호출이 main squash merge 까지 수행한다.
- LLM Wiki runner: 완료 원장에서 파생 지식을 지연/배치로 정리한다. 위키는 source of truth가 아니며 작업 완료를 막지 않는다.

## 시작 게이트

`$autoflow`를 사용하면 스킬 대화는 먼저 read-only로 요청 범위와 현재 상태를 파악하고 사용자에게 실행 방향을 짧게 브리핑한다.

승인 전 허용:

- 요청 범위와 완료 조건을 이해하기 위한 질문.
- `autoflow status`, ticket/runner state, LLM Wiki read-only 확인.
- 발행할 PRD 묶음과 완료 조건 초안 작성.

승인 전 금지:

- PRD/TODO/runner state/wiki/제품 파일 변경.
- runner action 실행.
- 외부 리서치나 제품 구현에 해당하는 작업 수행.

브리핑 전에는 LLM Wiki를 read-only로 확인한다. 기본 순서는 `.autoflow/wiki/index.md`, `.autoflow/wiki/log.md`, 관련 wiki page, 필요 시 wiki query다. 관련 기록이 없으면 `LLM위키 참고: 관련 기록 없음`을 적는다.

## PRD 발행

스킬 대화의 주된 산출물은 PRD다.

- PRD는 하나 이상 발행할 수 있다.
- active PRD가 있다는 이유만으로 새 PRD 발행을 막지 않는다.
- 같은 요청 범위 안에서 병렬로 진행 가능한 작업은 여러 PRD로 발행할 수 있다.
- PRD 하나는 Planner가 여러 TODO로 나눌 수 있게 `## Work Item Split`을 포함할 수 있다.
- PRD는 관찰 가능한 작업 범위, `Allowed Paths`, `Done When`, `Verification`, 부족분/후속 후보를 담는다.
- 스킬 대화는 PRD 발행 후 구현 세부를 직접 해결하지 않는다.

## Runner

데스크탑 sidecar는 4개 고정 러너를 표시한다.

- `Planner`
- `Worker`
- `Verifier`
- `LLM Wiki`

`Merge` runner는 없다. PRD worktree merge는 해당 PRD의 마지막 TODO를 처리한 Worker가 수행한다.

Planner, Worker, Verifier는 자신의 상태 변수를 보드에 기록한다.

## 러너 입력 금지

4개 고정 러너(플래너 러너, 워커 러너, 검증 러너, 위키 러너)는 실행 중 사용자에게 되묻거나 선택지를 제시하지 않는다. 러너 PTY는 사용자 입력 채널이 아니며 입력이 차단될 수 있으므로, 실행 중 질문은 `blocked` 상태와 같다.

- 질문이 필요한 요청 범위, 완료 조건, 선호도는 시작 게이트에서 PRD/TODO/assignment 발행 전에 확인한다.
- PRD/TODO/assignment가 발행된 뒤에는 이미 결정된 계약으로 보고 선택지를 만들지 않는다.
- 정보가 부족하면 계약 안에서 가장 보수적인 safe action을 선택하고, 가정과 evidence를 보드의 `Assumptions`, `Notes`, `Next Action`, `Verification`, `blocked` 또는 `replan` reason에 남긴다.
- 사용자 입력 없이는 결정할 수 없는 경우에도 질문하지 않는다. 구체적 blocker와 필요한 보정 정보를 기록하고 러너 상태를 닫아 다음 스킬/플래너 루프가 처리하게 한다.

## 위키

LLM Wiki는 스킬 대화가 PRD를 발행할 때 참고하는 read-only memory다. LLM Wiki runner의 작성/정리는 지연/배치 작업이며 `PRD turn`, worker 진행을 막지 않는다.
