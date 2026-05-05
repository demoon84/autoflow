# Curated Skills (사람 작성 / 검토 배포본)

이 디렉터리는 사람이 작성하고 리뷰한 **배포 가능한 skill** 을 보관한다. Hermes 자가학습 패턴 Phase 1 (`prd_162`) 부터 dual storage 정책을 따른다.

## 저장 위치

- `.autoflow/wiki/skills/<category>/<name>/SKILL.md` — 사람 작성 / 검토 (배포본). lifecycle 자동 archive 대상이 **아님**.
- `.autoflow/wiki/skills-local/<category>/<name>/SKILL.md` — agent 가 ticket 완료에서 자동 추출한 skill (lifecycle 대상).
- `.autoflow/wiki/skills-local/.archive/...` — 자동 archive 된 skill (삭제하지 않고 복구 가능).

## Frontmatter 표준

```yaml
---
name: <lowercase-hyphen, ≤64 chars>
description: <≤1024 chars>
pattern_type: ticket_completion | reject_turnaround | blocked_recovery | orchestration_cleanup
applies_to:
  module: <path or keyword>
  keywords:
    - keyword1
    - keyword2
pinned: false           # true 면 lifecycle 자동 transition 우회
created_from:
  prd: <PRD_NNN | null>
  ticket: <ticket_NNN | null>
created_at: <ISO8601>
---
```

## 크기 / 검증 한도 (Hermes 동일)

- `name` ≤ 64 chars
- `description` ≤ 1024 chars
- 본문 ≤ 100KB (≈ 36K tokens)
- 단일 파일 ≤ 1MiB
- frontmatter YAML 파싱 실패 / 본문 비어 있음 → `autoflow skill validate` 가 거부.

## CLI

- `autoflow skill list <project-root> <board-dir-name>` — in-repo / agent-created / archived skill 모두 표시 + 통계.
- `autoflow skill view <project-root> <board-dir-name> <name|category/name|skill_NNN>` — 본문 표시 + sidecar `view_count` 갱신.
- `autoflow skill create <project-root> <board-dir-name> --from-ticket <ticket-id>` — ticket 본문에서 패턴 추출, agent-created skill 생성.
- `autoflow skill validate <project-root> <board-dir-name> <name>` — frontmatter / size cap 검증.
- `autoflow skill archive <project-root> <board-dir-name> <name>` — agent-created skill 을 `.archive/` 로 이동. `pinned: true` 인 skill 은 거부.
- `autoflow skill match <project-root> <board-dir-name> --keywords "..."` — 키워드 매칭 (Phase 3 RAG 까지 호환).
- `autoflow skill update-stats <project-root> <board-dir-name> <skill> --result pass|fail` — 사용 결과 통계 갱신 (sidecar + legacy frontmatter).

## 운영 규칙

- in-repo `skills/` 는 lifecycle 자동 archive 대상 아님. 직접 편집 / 삭제로 관리한다.
- agent-created `skills-local/` 는 finish-ticket-owner pass 경로에서 best-effort 로 생성된다. 추출 실패는 ticket pass 를 막지 않는다.
- `.archive/` 는 자동 정리 대상이지만, 절대 삭제하지 않고 복구가 가능하도록 유지한다.
- `pinned: true` 인 skill 은 어떤 자동 lifecycle transition (archive, retire) 에서도 우회된다.
- 통계 sidecar (`.usage.json`) 가 깨져도 CLI 는 동작한다 (best-effort 회복 후 다시 작성).

## 레거시

- `skill_NNN.md` 형식의 flat skill (`prd_160` 시절 산출물) 은 in-repo 에 그대로 둔다. `list` / `view` / `match` / `update-stats` 에서 `category=legacy` 로 표시되며, 검증 / archive 대상이 아니다.
