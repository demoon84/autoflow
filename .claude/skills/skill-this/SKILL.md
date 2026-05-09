---
name: skill-this
description: Use when the user says "/skill-this", "#skill-this", "이거 기억해줘", "이걸 스킬로 만들어줘", "스킬로 정리해줘", or asks to record the just-finished work pattern as a reusable Autoflow skill.
---

# Save current pattern as Autoflow skill

When triggered, capture the immediately preceding work as a SKILL.md under `.autoflow/wiki/skills-local/<category>/<slug>/` so the next agent (worker, planner, wiki, or another Claude/Codex session) can reuse it via `autoflow wiki query --rag` or RAG surface in PRD 11.

## Procedure

1. **Decide a class-level slug** (≤ 64 chars, lowercase-hyphen). Reject one-off names like `fix-bug-123`, `pr-456`, `debug-X`. Good slugs name the *pattern*, not the incident: `runner-stuck-recovery`, `worktree-base-rebase`, `prd-split-rule`, `wiki-rag-keyword-tuning`.
2. **Pick a category folder** under `.autoflow/wiki/skills-local/<category>/`. Common categories:
   - `troubleshooting/` — recovery patterns when something breaks
   - `orchestration/` — board / runner / worktree orchestration
   - `tooling/` — CLI / script usage tips
   - `domain/` — project-specific business logic (UI, auth, db, etc.)
   - `manual/` — fallback when no clear fit
3. **Write SKILL.md** with this exact frontmatter and section structure:

   ```
   ---
   name: <slug>
   description: Use when ... (≤ 1024 chars, MUST start with "Use when")
   pattern_type: manual
   pinned: false
   created_from:
     prd:
     ticket:
   created_at: <UTC ISO 8601 like 2026-05-09T01:23:45Z>
   ---

   # <Korean Title>

   ## Trigger

   - 어떤 상황에서 적용되는지 (한국어)

   ## Procedure

   1. <단계 1>
   2. <단계 2>
   ...

   ## Pitfalls

   - <자주 빠지는 함정>

   ## Verification

   - <적용이 맞았는지 확인할 명령/관찰점>
   ```

4. **Save to** `.autoflow/wiki/skills-local/<category>/<slug>/SKILL.md`. Create parent directories as needed. Use the absolute path or repo-relative path based on the current working dir.
5. **Tell the user** the saved path. Run `autoflow skill list` if it is available to confirm the skill registered.
6. Do **NOT** run any LLM review on this skill — `pattern_type: manual` marks it as user-curated, bypassing the Hermes review queue.

## Rules

1. **Class-level slugs only**. If the user proposed a one-off name, suggest a class-level rename and ask for confirmation before saving.
2. **Body ≤ 60,000 chars**, **single file ≤ 100 KB**.
3. **Never overwrite an existing SKILL.md** without showing the diff and asking the user explicitly.
4. **Description starts with "Use when"** and is ≤ 1024 chars — Hermes RAG retrieval depends on this prefix.
5. Korean prose for human-readable sections (Trigger / Procedure / Pitfalls / Verification body); English for slug, category, frontmatter keys, and structural headings.
6. If the user says "/skill-this" with no clear preceding work in the conversation, ask one clarifying question: "어떤 작업/패턴을 스킬로 만들까요?" Do NOT generate placeholder content.
7. Set `pinned: true` only when the user explicitly says "이건 자동 archive 되지 않게 해줘" or equivalent. Default `false`.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
