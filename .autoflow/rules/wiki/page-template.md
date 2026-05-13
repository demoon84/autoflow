# Wiki Page Template

Wiki AI 가 생성하거나 실질 수정하는 모든 페이지는 아래 4단 구조를 따른다.
`(required)` 섹션이 빠지거나 두 개 이상 누락되면 `autoflow wiki lint` 가
`lint_shallow_page.*` 로 표시한다.

**언어 정책**: `operations/`, `architecture/`, `agents/` 는 영어로 작성한다.
`learnings/`, `answers/`, `features/` 는 한국어로 작성한다.
섹션명, 필드명, key=value 출력, 경로, 명령어, 코드, ticket id 는 원형을 유지한다.

**Citations 규칙**: 모든 사실 주장은 반드시 아래 형식 중 하나로 출처를 명시한다.
- 코드 경로: `` `path/to/file.ts:123` ``
- 커밋 해시: `` `abc1234` ``
- 티켓 섹션: `` `tickets/done/<key>/Todo-NNN.md#done-when` ``
- 외부 이슈: `` [Issue #NNN](url) ``
출처 없는 주장은 `autoflow wiki lint --semantic` 이 `citation_gap` 으로 표시한다.

---

## Symptom  *(required)*

이 현상이 나타날 때 무엇이 관찰되는지를 한두 문장으로 서술한다.
가능하면 에러 메시지, exit code, 로그 라인 형식으로 표현한다.

예시:
```
shell_sanity_gate_zero_diff — git diff <base>..HEAD line count = 0
finish-ticket-owner.ts pass 차단됨
```

## Cause  *(required)*

왜 이 현상이 발생하는지 근본 원인을 설명한다.
코드 경로나 설계 제약을 명시하고 citations 규칙을 적용한다.

- 원인: … (`path/to/script.ts:42`)
- 설계 의도: … (`tickets/done/<key>/Todo-NNN.md`)

## Fix  *(required)*

재현 가능한 수정 절차를 단계별로 기술한다.
최소 하나의 명령어, 코드 조각, 설정 변경을 포함한다.

```bash
# 예시: 경로를 명시한 수정 절차
cd <worktree>
git diff <base>..HEAD | wc -l   # 0이면 실제 코드 변경 필요
```

- 주의: … (위반 시 결과: …)

## Verification  *(required)*

수정이 올바른지 확인하는 명령어와 기대 결과를 기술한다.
"통과 기준"과 "실패 기준"을 모두 명시한다.

- Command: `cd <root> && <verification-command>`
- Pass: exits 0, 출력에 `status=pass` 포함
- Fail indicator: exits 1, `shell_sanity_gate_*` 메시지

---

## Hidden Contracts and Gotchas  *(if applicable)*

코드나 티켓 제목만 봐서는 알 수 없는 불변 조건, 순서 제약, 환경 가정, 알려진 실패 모드를 나열한다.

- Gotcha: … (위반 시: …)
- Contract: … (적용 위치: …)

섹션에 해당하는 내용이 없으면: "이 페이지 시점에서 알려진 숨겨진 계약 없음."

## Cross-reference Narrative  *(if applicable)*

연관 페이지를 `[[wikilink]]` 형식으로 표현하고 관계 이유를 한 줄로 설명한다.

- Related to: `[[<slug>]]` — 관계 이유
- Depends on: `[[<slug>]]` — 의존 관계 유형

연관 페이지가 없으면: "합성 시점에서 연관 기존 페이지 없음."

## Affected Paths and Anchors  *(if applicable)*

이 페이지가 문서화하는 작업이 변경한 파일 경로와 구체적인 함수/클래스/설정 키를 나열한다.

```
path/to/file.ts       — MyClass.doThing() 수정
packages/cli/foo.ts   — run_xyz() 추가, lines 100-140
```

## Future Considerations  *(if applicable)*

알려진 한계, 후속 작업, 이 결정을 재검토해야 할 조건을 기술한다.

- [ ] 후속 항목 (출처 명시)

해당 없으면: "합성 시점에서 파악된 후속 작업 없음."

---

*적용 범위: 이 템플릿은 Wiki AI 가 새로 생성하거나 실질 수정하는 페이지에 적용한다.
기존 단편 페이지는 소급 적용하지 않는다 — 관련 작업이 이루어질 때 유기적으로 갱신한다.*
