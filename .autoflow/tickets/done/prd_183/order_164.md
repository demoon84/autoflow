---
title: 🚨 wiki "[wiki] wiki knowledge update" commit 너무 자주 (29분 8건, git noise)
priority: high
created_at: 2026-05-04T22:16Z
source: claude-code-monitoring
detected_during: realtime monitoring (사용자 보고)
---

## Request

`[wiki] wiki knowledge update` commit 이 git history 에 너무 자주 누적. 사용자 보고. 실측: **29분 동안 8건, 평균 4분 간격**. AGENTS.md rule 18 의 debounce 정책 (MIN_CHANGES=3, MAX_AGE=1800s=30min) 이 의도대로 동작 안 함. git history 노이즈 + commit message 정보 부재.

## 검출 증거

검출 시각: 2026-05-04T22:16Z (실시간 감시 중)

```
$ git log --since="24 hours ago" --pretty="%ai %h %s" --grep="\[wiki\]" | head
2026-05-05 07:15:24 +0900 477573f [wiki] wiki knowledge update
2026-05-05 07:12:38 +0900 afac9ae [wiki] wiki knowledge update
2026-05-05 07:09:56 +0900 594d30f [wiki] wiki knowledge update
2026-05-05 07:06:35 +0900 fb02f82 [wiki] wiki knowledge update
2026-05-05 07:03:57 +0900 9f0462d [wiki] wiki knowledge update
2026-05-05 06:59:51 +0900 6c10cde [wiki] wiki knowledge update
2026-05-05 06:56:45 +0900 de216b3 [wiki] wiki knowledge update
2026-05-05 06:46:08 +0900 4162530 [wiki] wiki knowledge update
```

**Commit 간격 (분):** 10, 3, 4, 2, 3, 2, 2 → 평균 ~4분.

```
$ git log --since="24 hours ago" --pretty="%s" --grep="\[wiki\]" | sort | uniq -c
   8 [wiki] wiki knowledge update
```

→ **모든 commit 이 동일 generic message** ("어떤 변경인지" 정보 0).

## debounce state 현황

```
$ cat .autoflow/runners/state/wiki.wiki-debounce.state
last_synth_at_epoch=1777932924    # 직전 synth 시각
pending_since_epoch=1777933008    # 새 변동 첫 시각 (직전 synth 후 84초 후)
```

→ 직전 synth 후 84초만에 새 pending 시작. 다음 synth 곧 발생 예정.

## 근본 원인 (분석)

AGENTS.md rule 18 의 debounce 정책:
- `AUTOFLOW_WIKI_DEBOUNCE_MIN_CHANGES=3` — 변동 3건 누적 후 trigger
- `AUTOFLOW_WIKI_DEBOUNCE_MAX_AGE_SECONDS=1800` (30분) — 변동 1건이라도 30분 경과 후 trigger

**문제:**
1. **MIN_CHANGES=3 임계가 너무 낮음** — 활발한 보드 (worker / planner / verifier 가 1~2분 tick 마다 ticket file 이동) 에서 3건 누적이 ~3분 만에 도달.
2. **debounce 가 합주 효과 없음** — wiki 가 매 4분에 LLM 호출 → wiki commit → debounce reset → 또 3건 누적 → 또 4분에 trigger.
3. **commit message 의미 없음** — 모든 commit `[wiki] wiki knowledge update` 동일. git history 가 무의미한 noise 로 채워짐. PRD/ticket 참조 없음.
4. **wiki ingest scope 가 너무 broad** — `tickets/done/`, `wiki/`, `logs/` 모두 변경 추적 → 하나라도 바뀌면 카운트.

## 영향

- **git history pollution**: 24시간 운영 시 ~360 wiki commit 누적 가능 (4분당 1건). 의미 있는 commit 사이에 검색 / blame 어려움.
- **불필요한 LLM 호출**: 매 wiki tick 의 LLM 비용 (gemini-flash-lite 라 작긴 하지만 누적). PRD-152 (verifier 다운) 같은 토큰 절감 노력 무력화.
- **diff 노이즈**: wiki/answers/, wiki/log.md 등이 매 4분 갱신 → review 시 noise.
- **운영 가시성 저하**: 사용자가 진짜 의미 있는 commit 찾기 어려움.

## Suggested Fix

### 정책 방향 — **파일 기반** 으로 전환 (사용자 명시)
시간 cooldown 대신 **변경 파일의 의미 / 종류 / 양** 기반으로 commit 결정.

### 🎯 핵심 원칙 (사용자 강조 2026-05-04T22:29Z)
**"위키가 실제로 작성했을 때만 commit"** — 다음은 commit 절대 안 됨:
- 매니페스트 / sidecar / fingerprint 갱신만 (`*.manifest`, `*.history`, `*.fingerprint`)
- mtime 만 변경된 파일 (content 동일)
- baseline.history 의 시간 marker 갱신
- 자동 생성 index 의 비-content 갱신 (날짜 stamp 등)
- LLM 호출 결과가 "변경 없음 / unchanged" 인 경우

→ Wiki AI 가 새 지식 (answer/learning/skill/decision) 또는 의미 있는 content delta 를 **명시적으로 작성**할 때만 commit. 그 외 모든 case 는 state 만 갱신.

검증 매커니즘:
- commit 직전 git diff 검사 — content delta 가 있는 파일만 카운트
- "작성된 파일" 정의: `git diff --shortstat` 의 +/- 라인이 있고 cosmetic (whitespace only) 이 아닌 경우
- cosmetic-only diff 거부 (`git diff -w` 결과 비어있으면 commit 안 함)

### Phase A — 카테고리별 가중치 + 임계
- wiki 디렉터리 분류:
  - **무가중치 (절대 commit trigger 안 됨, state 만 갱신)**:
    - `wiki/index.md` (manifest 갱신용)
    - `wiki/log.md` (단순 누적 로그)
    - 매니페스트 / hash sidecar (`*.manifest`, `*.history`, `*.fingerprint`)
  - **저가중치 (1점)**:
    - `wiki/sources/`, `wiki/operations/`, `wiki/architecture/`, `wiki/agents/`
  - **중가중치 (3점)**:
    - `wiki/features/`, `wiki/decisions/`
  - **고가중치 (5점)**:
    - `wiki/answers/` (LLM synth 결과 — 의미 있는 새 지식)
    - `wiki/learnings/` (사람 또는 자동 추출 lessons)
    - `wiki/skills/`, `wiki/skills-local/` (Hermes pattern, order_146)
- 환경변수 `AUTOFLOW_WIKI_COMMIT_WEIGHT_THRESHOLD` (기본 **5**) — 누적 가중치 합 5점 이상이어야 commit
- → 무가중치만 변경되면 commit 0회. 고가중치 1개 또는 저가중치 5개 누적 시에만 commit.

### Phase B — 변경 종류별 정책
- **새 파일 추가** — 즉시 commit (가장 의미 있는 변화, 새 지식 등록)
- **기존 파일 수정** — 가중치 합산, 임계 도달 시 commit
- **파일 삭제** — 즉시 commit (정리도 의미 있음)
- **단순 mtime 갱신 / hash sidecar** — commit trigger 아님

### Phase C — line 변화량 보조 임계
- 신규 환경변수: `AUTOFLOW_WIKI_COMMIT_MIN_LINES` (기본 30)
- 가중치 임계 도달 + 누적 라인 변화 (`git diff --stat | tail -1` 의 +/- 합) ≥ 30 인 경우만 commit
- 작은 오타 수정만 누적되면 commit 안 함 (가중치 합산 무관)

### Phase D — Commit message 의미화 (변경 안 함)
- `[wiki] update: <high_weight_pages> 핵심 / <total_pages> total, +<add>/-<del>`
- 예: `[wiki] update: 2 answers / 3 total, +85/-12`
- 어떤 카테고리가 변했는지 즉시 파악

### Phase E — debounce 정책 정리 (시간 max_age 보존, 단 파일 기반과 결합)
- `MIN_CHANGES` 폐기 (파일 가중치로 대체)
- `MAX_AGE_SECONDS` 는 안전망으로만 유지 (예: 24시간 — 진짜 오랜 idle 후에도 누적 작은 변경 sync)
- 평소에는 **파일 가중치 임계만** 으로 commit 결정

## Allowed Paths

- `packages/cli/wiki-project.sh` (debounce 임계 조정 + cooldown + commit message 보강)
- `.autoflow/scripts/update-wiki.sh` (필요 시)
- `.autoflow/agents/wiki-maintainer-agent.md` (정책 명시)
- `AGENTS.md` rule 18 (정책 갱신)

## Verification

```bash
# Phase A (가중치 임계) 적용 후 1시간 운영
git log --since="1 hour ago" --grep="\[wiki\]" | wc -l
# → 0~3 (현재 ~15건/시간 → 1/5 ~ 1/15 감소)
# → wiki/index.md, log.md 만 변경된 시기에는 0

# Phase B (변경 종류) 검증
# - 새 wiki/answers/foo.md 추가 → 즉시 commit (가중치 5점 도달)
# - wiki/sources/bar.md 단일 수정 → commit X (1점)
# - wiki/sources/{a,b,c,d,e}.md 5개 수정 → commit (5점 도달)
# - wiki/index.md만 매니페스트 갱신 → commit X (무가중치)

# Phase C (line) 검증
# - wiki/answers/foo.md 1줄 수정 (5점이지만 +1줄) → commit X (line 30 미만)
# - wiki/answers/foo.md 50줄 수정 → commit (5점 + 50줄)

# Phase D 검증
git log -1 --pretty="%s" --grep="\[wiki\]"
# → "[wiki] update: 2 answers / 3 total, +85/-12" 같은 의미

# 회귀
# - 진짜 큰 변경 (다수 answers + decisions 누적) 시 정상 commit
# - 24시간 idle 후 누적 작은 변경도 안전망으로 sync (MAX_AGE)
```

## Notes

- **연관:**
  - PRD-152~159 (토큰 절감) — wiki 호출 빈도 감소가 토큰 절감과 시너지.
  - order_146 (Hermes self-learning) — wiki 가 skill registry source 가 될 수 있음. commit 정합성 중요.
  - order_135 (check_NNN.md) — wiki commit 자체도 자동 개입 이력으로 추적 가능.
  - AGENTS.md rule 18 (wiki debounce 정책) — 본 order 가 보강.
- **위험:**
  - debounce 너무 길면 wiki content 가 stale (사용자가 wiki 본 시점에 outdated). 1시간 정도가 균형.
  - cooldown 이 emergency sync 막으면 안 됨 — `--force` 또는 manual trigger 우회.
- **1원칙 정합:**
  - wiki 자체 자율 흐름은 안 막음. 빈도만 합리화.
- **검출 source:**
  - 사용자 보고 + 실시간 감시 측정.
