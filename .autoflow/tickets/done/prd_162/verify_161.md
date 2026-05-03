# Verification Record

## Meta

- Ticket ID: 161
- Project Key: prd_162
- Verifier: worker (AI-led inline)
- Status: pass
- Started At: 2026-05-03T14:05:00Z
- Finished At: 2026-05-03T14:12:00Z
- Working Root: /Users/demoon2016/Documents/project/autoflow

- Target: tickets_161.md
- PRD Key: prd_162
## Reference Notes
- Project Note: [[prd_162]]
- Plan Note:
- Ticket Note: [[tickets_161]]
- Verification Note: [[verify_161]]

## Criteria Checked

- [x] Done When items were checked and reflected in the ticket `## Done When` checklist state.
- [x] Acceptance criteria were checked (folder skill create / list 표시 / validator cap 거부 / sidecar atomic & 손상 회복 / .archive view·list / pinned bypass / desktop:check).
- [x] Allowed Paths were checked.
- [x] Verification command was run.

## Command

- Command: `bash tests/smoke/skill-phase1-smoke.sh && bash tests/smoke/ticket-owner-smoke.sh && npm run desktop:check`
- Exit Code: 0

## Output

### stdout

```text
[skill-phase1-smoke.sh]
ok

[ticket-owner-smoke.sh]
(no output, exit 0 = success)

[npm run desktop:check]
> autoflow@0.1.0 desktop:check
> npm --prefix apps/desktop run check
> @autoflow/desktop@0.1.0 check
> node scripts/check-syntax.mjs && tsc --noEmit && vite build
vite v6.4.2 building for production...
✓ 1872 modules transformed.
✓ built in 1.62s
```

### stderr

```text
(none — only vite chunk-size warning, non-blocking)
```

## Evidence

- Result: pass
- Observations:
  - `autoflow skill create --from-ticket tickets_900` 가 `.autoflow/wiki/skills-local/ticket-completion/<slug>/SKILL.md` 폴더 단위로 생성되고 새 frontmatter (name/description/pattern_type/applies_to.module+keywords/pinned/created_from.{prd,ticket}/created_at) 형식 정상.
  - `autoflow skill list` 가 in-repo (legacy + folder) / agent-created / archived 모두 카운트.
  - validator: name>64 chars, description>1024 chars, content>100KB 모두 exit 2 + 명시적 issue 키 (`name_too_long`, `description_too_long`, `content_size_exceeds`) 로 거부.
  - `.usage.json` sidecar atomic write 동작; `view` 호출마다 view_count 1→2 증분; sidecar 를 손상시킨 뒤에도 view 가 ok 로 끝나고 sidecar 가 valid JSON 으로 회복됨.
  - `archive` 가 agent-created skill 을 `.archive/<category>/<name>/SKILL.md` 로 이동, archive 후에도 list/view 정상.
  - `pinned: true` skill 은 archive 시 exit 4 + reason=pinned_skill_bypasses_lifecycle 로 거부.
  - finish-ticket-owner.sh 의 `skill create --from-ticket` 호출 호환을 위해 새 출력에도 `skill_file=` / `skill_id=` / `created_from=` 키를 같이 emit.
  - npm run desktop:check (vite build + tsc) 통과.

## Findings

- Finding: prd_160 의 flat `skill_NNN.md` 와 prd_162 의 folder skill 이 한 디렉터리에서 공존 (legacy 는 category=legacy 로 표시) — list/view/match/update-stats 모두 호환.

## Blockers

- Blocker: 없음.

## Next Fix Hint

- Hint: Phase 2 curator 가 도입될 때 sidecar 통계 (success_count/failure_count, view_count) 를 기준으로 자동 archive 임계값을 결정한다.

## Result

- Verdict: pass
- Summary: Hermes Phase 1 skill 인프라 (dual storage / 폴더 단위 / validator+cap / .usage.json sidecar / pinned bypass / CLI list·view·validate·archive) 구현 + smoke + desktop:check 통과.
