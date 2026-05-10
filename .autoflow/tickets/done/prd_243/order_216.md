# Autoflow Order

## Order

- Title: Wiki AI 프롬프트 + 페이지 템플릿 업그레이드 — 실용적 깊이 확보
- Priority: normal
- Status: ready
- Change Type: code

## Request

Wiki AI 프롬프트와 페이지 템플릿 업그레이드 - 실제로 도움이 되는 깊이로 (결정 근거/구현 패턴/gotcha/cross-reference 포함)

## Context

현재 `.autoflow/wiki/prd_*.md` 가 평균 28~30줄 (메타 7줄 + description 1~2문장 +
변경 bullet 5줄 + 관련 ticket 4개 링크 + source 파일 1개) 로 끝난다. 실제로
"이 기능 어떻게 동작하나?" / "왜 이렇게 만들었나?" 답을 못 줌. 자주 쓰는
지식 자산인데 깊이 부족.

빠진 핵심 7가지:

1. **결정 근거 (WHY)** — 왜 다른 옵션 대신 이걸 택했나, trade-off
2. **구현 패턴** — 핵심 함수/regex/sequence 의 코드 스니펫 (≥ 3 블록)
3. **hidden contract (gotcha)** — 회귀 막기 위한 invariant (예: claude
   stream-json 는 result 만 신뢰, codex item.completed 는 skip, JSONL
   fallback 0 처리 등)
4. **cross-reference narrative** — 단순 link 가 아니라 "이건 prd_X 위에
   쌓인 보강이고, prd_Y 의 follow-up 이다" 식 1-2 문단 서술
5. **affected paths + line ranges** — `apps/desktop/src/main.tsx:6970-6986`
   같은 anchor (검색 시 바로 jump 가능)
6. **검증 결과 / 회귀 가드** — 테스트 fixture / 검증 명령 / 통과 evidence
7. **future considerations** — 후속 PRD 후보, 알려진 한계

## Allowed Paths

- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/rules/wiki/page-template.md
- .autoflow/rules/wiki/lint-checklist.md
- .autoflow/rules/wiki/README.md
- packages/cli/wiki-project.sh

## Done When

- [ ] `wiki/page-template.md` 가 위 7가지 섹션을 명시적으로 요구하도록 갱신
- [ ] `wiki-maintainer-agent.md` 가 동일 7가지 항목을 강조하는 system prompt 보강
- [ ] `lint-checklist.md` 가 새 섹션 누락 시 warning emit (semantic lint 단계)
- [ ] 새 wiki page 가 평균 100~200줄 이상 (코드 스니펫 + 결정 근거 포함) 으로 생성된다 (sample 1건 manual 검증)
- [ ] 기존 짧은 wiki page 는 backfill 강제 X (점진적 갱신)
- [ ] `cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check` exits 0

## Verification

- Command: cd /Users/demoon2016/Documents/project/autoflow/apps/desktop && npm run check

## Notes

- 위치 reference:
  - `.autoflow/agents/wiki-maintainer-agent.md` — Wiki AI 의 system prompt
  - `.autoflow/rules/wiki/page-template.md` — 새 page 의 골격
  - `.autoflow/rules/wiki/lint-checklist.md` — semantic lint 룰
- gemini-2.5-flash-lite 가 워낙 짧게 답하는 경향이 있어 prompt 에서 명시적
  최소 길이 / 섹션 요구가 핵심.
- 회귀 가드:
  - existing wiki page 의 short summary backfill 강제하지 않음 (점진적)
  - wiki autocommit content gate (PRD 18, file-weight ≥ 5 + line ≥ 30) 그대로 유지
  - debounce / RAG 인덱스 동작 영향 없음
- 후속 후보 (별도 PRD):
  - wiki page 자동 quality score (코드 스니펫 수 / cross-ref 수 / 결정 근거 유무)
  - wiki page 평균 길이 metric 을 통계 대시보드에 추가
