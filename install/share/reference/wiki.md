# LLM Wiki Reference

LLM Wiki는 완료된 Autoflow 실행 원장을 Claude/Codex가 다음 작업에서 재사용할 수 있게 압축한 AI-facing markdown 지식 베이스다.

실행 원장은 `tickets/`, verification evidence, merge evidence, conversations에 남는다. LLM Wiki는 그 원장을 대신하지 않고, 다음 러너가 빠르게 검색하고 판단에 참고할 수 있도록 정리한다.

## 독자

LLM Wiki의 1차 독자는 Claude, Codex 같은 LLM 러너다. 사람에게 예쁘게 설명하기보다 다음 작업에 바로 쓰이는 사실, 결정, 제약, 패턴, 함정을 짧고 검색 가능하게 남긴다.

## 저장 방식

- Wiki content의 canonical source는 `.autoflow/wiki/**/*.md` markdown 파일이다.
- `.autoflow/wiki/index.md`는 content-oriented catalog다.
- `.autoflow/wiki/log.md`는 append-only timeline이다.
- `.autoflow/raw/`는 위키에 반영할 immutable source를 둔다.
- qmd 인덱스/cache/DB는 optional derived search accelerator이며 wiki source of truth가 아니다.
- qmd가 없으면 `rg`, `index.md`, markdown scan fallback으로 검색한다.

권장 구조:

```text
.autoflow/raw/
  clipped/
  conversations/
  evidence/
  external/

.autoflow/wiki/
  index.md
  log.md
  concepts/
  decisions/
  sources/
  questions/
```

## Source Of Truth 경계

Wiki는 실행 상태의 source of truth가 아니다.

Wiki로 판단하지 않는 것:

- active ticket stage
- assignment/claim 상태
- verifier decision
- commit/merge 상태
- work item done 여부

권위 있는 기록은 항상 `tickets/`, verification evidence, merge evidence, 제품 git commit이다. Wiki page는 반드시 source path를 인용하고, 확정 증거가 필요하면 source를 따라가게 작성한다.

## 검색 계층

검색 우선순위:

1. qmd가 구성되어 있으면 기본값으로 `qmd search`를 사용한다.
2. qmd가 없거나 실패하면 markdown scan fallback을 사용한다.
3. 작은 위키에서는 `index.md`와 `rg`만으로도 동작해야 한다.

qmd는 원본 저장소가 아니라 검색 가속기다. qmd cache, index, embedding 산출물은 언제든 재생성 가능한 파생물로 취급한다.

qmd 설치/구성 예시:

```bash
npm install -g @tobilu/qmd
qmd collection add <project-root>/.autoflow --name <project-name>-autoflow --mask "**/*.md"
export AUTOFLOW_QMD_COLLECTION=<project-name>-autoflow
```

`AUTOFLOW_QMD_COLLECTIONS`는 쉼표나 공백으로 구분한 여러 collection 이름을 받을 수 있다. embedding과 local model 기반 hybrid 검색이 필요할 때만 `AUTOFLOW_QMD_MODE=query`를 명시하고 `qmd embed`를 별도로 실행한다.

## 쓸 내용

Wiki page는 다음 종류의 재사용 지식을 담는다.

- `concept`: 반복 재사용되는 개념, 패턴, 제약
- `decision`: 왜 특정 설계나 정책을 선택했는지
- `source`: raw source를 읽고 정리한 source summary
- `question`: 질문에서 나온 답변과 분석 중 다시 쓸 가치가 있는 내용

## 페이지 내용 기준

각 page는 긴 서사가 아니라 context packet이어야 한다.

권장 구성:

- `Status`: confidence, last_verified, stale_if
- `Use When`: Claude/Codex가 언제 이 page를 읽어야 하는지
- `Facts`: 작업에 바로 쓰이는 확정 사실
- `Invariants`: 깨면 안 되는 규칙
- `Procedure`: 필요한 경우에만 짧은 절차
- `Gotchas`: 과거 실수나 위험
- `Sources`: 근거가 되는 board-relative path

추정과 확정 사실은 구분한다. 오래될 수 있는 내용에는 `stale_if`를 적는다. Source 없는 단정은 쓰지 않는다.

## Obsidian

Obsidian은 필수가 아니다. 사용하는 경우 Obsidian Web Clipper 결과를 `.autoflow/raw/clipped/`에 저장하고, 위키 러너가 그 source를 읽어 `.autoflow/wiki/` markdown page에 반영한다.
