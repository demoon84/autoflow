# Agent-Created Skills (자동 추출 / lifecycle 대상)

이 디렉터리는 Autoflow Impl AI 가 ticket 완료에서 **자동 추출** 한 skill 을 보관한다. Hermes 자가학습 패턴 Phase 1 (`prd_162`) 부터 사용한다.

## 구조

- `<category>/<name>/SKILL.md` — agent 가 생성한 skill 본문.
- `<category>/<name>/<부속자료>` — 예시 코드, snippet, reference (단일 파일 ≤ 1MiB).
- `.archive/<category>/<name>/` — 자동 archive 된 skill (절대 삭제 안 함).
- `.usage.json` — 모든 agent-created skill 의 통계 sidecar (atomic write).

## .usage.json

```json
{
  "<category>/<name>": {
    "view_count": 0,
    "last_viewed_at": "",
    "last_used_at": "",
    "success_count": 0,
    "failure_count": 0
  }
}
```

- 모든 갱신은 atomic write (tempfile + os.replace).
- 파일이 깨졌을 때는 best-effort 로 새 dict 로 재생성한다 (CLI 흐름은 막지 않는다).
- `view`/`update-stats` 로 갱신된다.

## Lifecycle (Phase 1 범위)

- 이 directory 의 skill 만 `autoflow skill archive` 로 `.archive/` 로 이동된다 (수동 호출).
- `pinned: true` frontmatter 가 있는 skill 은 archive 가 거부된다 — Phase 2 의 자동 transition 시뮬레이션도 우회된다.
- 자동 lifecycle (사용량 임계 기반 archive / retire) 은 Phase 2 curator 작업에서 도입된다.

## 안전성

- finish-ticket-owner.sh 의 `skill create --from-ticket` 호출은 best-effort 다 — 추출 실패가 ticket pass 를 막지 않는다.
- `AUTOFLOW_SKILL_AUTO_EXTRACT=off` 로 끌 수 있다.
- 모든 skill 은 `autoflow skill validate` 로 frontmatter / size cap 검증을 통과해야 한다.
