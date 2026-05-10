# Autoflow Order

## Order

- ID: order_236
- Title: LLM Wiki 재구조화 — 노이즈 제거 + 4단 패턴 강제
- Status: inbox
- Priority: high
- Created At: 2026-05-10T15:22:35Z
- Source: autoflow order create

## Request

# Autoflow Order

## Order

- Title: LLM Wiki 재구조화 — 노이즈 제거 + Symptom/Cause/Fix/Verification 형식 강제 + 패턴 합성
- Priority: high
- Status: ready
- Change Type: code


현재 LLM Wiki (`.autoflow/wiki/`) 가 233 파일 / 8.7K 줄 규모인데 실제 가치 있는 내용은 11-16 개. 나머지 200+ 가 자동 생성된 PRD/ticket 요약 (`sources/` 97개) 으로 RAG 검색 시 노이즈가 결과를 점거. wiki 가 "한 번 묻고 답한 건 다시 묻지 말자" 의도인데 현재는 ticket 본문 중복 + 짧은 일회성 답변 위주라 의도 미달.

## 문제 진단 (실측)

| 폴더 | 파일 | 줄 | 평균 | 평가 |
|------|------|------|------|------|
| sources/ | 97 | 4066 | 41 | ⚠️ 대부분 ticket 본문 중복. 원 ticket 보면 됨. |
| answers/ | 68 | 2207 | 32 | 🟡 일부 좋음 (synth), 일부 경박 |
| features/ | 28 | 1190 | 42 | 🟡 보통 |
| learnings/ | 11 | 569 | 51 | ✅ 가장 실용적 (incident 기반) |
| decisions/ | 11 | 363 | 33 | 🟡 |
| operations/ | 5 | 241 | 48 | ✅ runner-health 같은 운영 분석 |

부실 패턴:
1. `sources/` 97개가 모두 PRD/ticket 의 자동 한 단락 요약 — 검색 노이즈
2. `index.md` 가 ticket 제목 ls 덤프 (`Done tickets: 747` + 모든 제목 나열)
3. 평균 30-50줄, frontmatter 빼면 본문 20줄 미만 — 행동 가능한 패턴 부족
4. descriptive 만, prescriptive 부재 ("이런 증상이면 이렇게 하라" 형식 부재)
5. 다국어 혼재 — 한 페이지 한국어 다음 영어 → RAG 일관성 저하
6. citations 가 자기 ticket 만 가리킴 — 외부 증거 / 코드 경로 / 명령 부재

## Allowed Paths

- .autoflow/agents/wiki-maintainer-agent.md
- .autoflow/scripts/update-wiki.sh
- .autoflow/scripts/update-wiki.ts (마이그레이션 시 신규)
- runtime/board-scripts/update-wiki.sh
- .autoflow/rules/wiki/page-template.md
- .autoflow/wiki/index.md (재작성)
- .autoflow/wiki/sources/ (대량 정리 대상)
- 기타 wiki/ 하위 정리 대상

## Done When

- [ ] **자동 생성 sources/ 폐기** — `update-wiki.sh` 가 PRD/ticket 마다 sources/<id>.md 를 더 이상 만들지 않게 변경. 기존 97개는 archive 폴더 (`wiki/_archive/sources/`) 로 이동 (gitignored)
- [ ] **index.md 카테고리 기반으로 재작성** — 평면 ls 덤프 폐기. 카테고리 별 (state-file / PTY / sanity-gate / token / ownership / merge / general) 로 그룹 + 각 카테고리에 Symptom 매트릭스 표
- [ ] **page-template.md 재정의** — 모든 learnings / answers 페이지가 다음 4단 구조 강제:
      ```
      ## Symptom (어떤 로그/UI 상태)
      ## Cause (어디서 origin 이 발생)
      ## Fix (구체 명령/코드/환경변수)
      ## Verification (어떻게 fix 확신)
      ```
- [ ] **wiki-maintainer-agent.md 재작성** — synth 시 위 4단 구조 따르게. PRD/ticket 자동 dump 금지. 같은 패턴 재발 횟수 ≥ 3 일 때 별도 합성 페이지 생성 의무.
- [ ] **언어 정책 확정** — 코드 가까운 페이지 (operations/, architecture/, agents/) 는 영어. 사용자 영역 (learnings/, answers/, features/) 는 한국어. 한 페이지 안에서 혼재 금지.
- [ ] **citations 강화 정규** — citations 에 다음 중 하나 이상 의무: (1) 코드 경로:line, (2) commit hash, (3) 외부 ticket 의 구체 섹션 ID. 자기 ticket 한 줄만은 거부.
- [ ] **TTL 적용** — 30일 이상 갱신 없는 learnings 는 wiki AI 가 archive 또는 superseded 마크. update-wiki 가 매번 점검.
- [ ] **재발 횟수 기반 합성** — `update-wiki.sh` 가 ticket 본문에서 동일 failure_class / 동일 root cause 가 N회 (env `AUTOFLOW_WIKI_PATTERN_THRESHOLD`, 기본 3) 발생 시 자동으로 패턴 페이지 draft 생성 후 wiki AI 가 채움.
- [ ] **archive 정리 후 RAG 재인덱스** — sources/ 폐기 후 `autoflow wiki query --rag` 결과 품질 비교 (Before/After) evidence 1쪽 작성 (operations/wiki-rag-quality-2026-05.md)
- [ ] runtime/board-scripts/ 미러 동기화

## Verification

- Command: ls .autoflow/wiki/sources/ | wc -l && rg -c "## Symptom" .autoflow/wiki/learnings/ .autoflow/wiki/answers/

## Notes

- learnings/manual-merge-recovery-20260427.md 와 answers/adapter-exit-126-analysis.md 는 좋은 참고 형식. 이걸 표준 템플릿으로 삼음.
- sources/ archive 는 gitignored 로 유지해 git 압박 없이 보존
- update-wiki.sh 의 자동 dump 로직이 핵심 부풀림 원인 — 그쪽 비활성이 1차
- 본 작업은 단계 분리 권장: (1) sources 정리 (mechanical) → (2) index.md 재작성 → (3) page-template / agent.md 재정비 → (4) 패턴 합성 자동화
- 이전 false-pass 사례 (Todo-257 / Todo-278) 가 좋은 first synthesis 후보 — "false-pass 방지 체크리스트" 페이지로 묶을 가치

## Hints

### Scope

- pending Plan AI inference

### Allowed Paths

- pending Plan AI inference

### Verification

- Command: pending Plan AI inference

## Planner Contract

- Plan AI treats this order as an implementation directive, infers concrete scope from repository context, and promotes it into a generated backlog PRD and todo ticket.
- Plan AI must not turn order intake into a repeated human-question loop. Only unsafe requests should be blocked; otherwise use the safest narrow interpretation.
