# LLM Wiki Page Template

```md
---
kind: decision # concept | decision | source | question
slug: <stable-slug>
title: <Claude/Codex가 검색할 제목>
created: <ISO>
updated: <ISO>
tags: [<term>, <term>]
confidence: high # high | medium | low
last_verified: <YYYY-MM-DD>
stale_if: <schema, contract, module, command, or policy changes>
superseded_by:
status:
---

# <Title>

## Use When

- <Claude/Codex가 이 page를 읽어야 하는 상황>

## Facts

- <source로 확인되는 짧은 사실>
- <작업에 바로 쓰이는 제약 또는 결정>

## Invariants

- <깨면 안 되는 규칙>
- <runner/tool/board contract와 연결되는 조건>

## Procedure

1. <필요한 경우에만 짧은 실행 절차>
2. <명령어, 경로, 상태 field는 원래 표기 유지>

## Gotchas

- <과거 실패, 함정, 회피 규칙>

## Assumptions

- <확정 evidence가 약한 내용. 없으면 `none`>

## Sources

- `tickets/done/<project-key>/<artifact>.md`
- `conversations/<path>.md`
- `install/share/reference/<file>.md`
- `app/<path>`
```

작성 기준:

- 독자는 LLM(Claude/Codex)이다.
- 한 page는 하나의 재사용 지식만 다룬다.
- Source 없는 완료 주장, verifier 판단, merge 상태 주장은 쓰지 않는다.
- 실행 원장 내용을 복사하지 말고 다음 작업에 필요한 결정/제약/패턴만 압축한다.
- 페이지는 `wiki/<category>/<slug>.md` path로 `wiki write-page`를 통해 markdown 파일에 기록한다.
