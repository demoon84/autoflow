---
name: skill-this
description: Use when the user invokes $skill-this, says #skill-this or /skill-this, says "이거 기억해줘" / "이걸 스킬로 만들어줘" / "스킬로 정리해줘", or asks to record the just-finished work pattern as a reusable Autoflow skill from Codex.
---

# Save current pattern as Autoflow skill (Codex)

When triggered, capture the immediately preceding work as a SKILL.md under `.autoflow/wiki/skills-local/<category>/<slug>/` so the next agent (worker, planner, wiki, or another Claude/Codex session) can reuse it.

## Procedure

1. **Decide a class-level slug** (≤ 64 chars, lowercase-hyphen). Reject one-off names like `fix-bug-123`, `pr-456`, `debug-X`. Name the *pattern*, not the incident: `runner-stuck-recovery`, `worktree-base-rebase`, `prd-split-rule`.
2. **Pick a category folder** under `.autoflow/wiki/skills-local/<category>/`:
   - `troubleshooting/` — recovery patterns
   - `orchestration/` — board / runner / worktree orchestration
   - `tooling/` — CLI / script usage tips
   - `domain/` — project-specific business logic
   - `manual/` — fallback when no clear fit
3. **Write SKILL.md** with this exact frontmatter:

   ```
   ---
   name: <slug>
   description: Use when ... (≤ 1024 chars, MUST start with "Use when")
   pattern_type: manual
   pinned: false
   created_from:
     prd:
     ticket:
   created_at: <UTC ISO 8601>
   ---

   # <Korean Title>

   ## Trigger
   - 어떤 상황에서 적용되는지 (한국어)

   ## Procedure
   1. <단계>

   ## Pitfalls
   - <함정>

   ## Verification
   - <확인 명령/관찰점>
   ```

4. **Save** to `.autoflow/wiki/skills-local/<category>/<slug>/SKILL.md`. Create parent directories.
5. **Tell the user** the saved path; run `autoflow skill list` to confirm registration.
6. Do **NOT** run any LLM review — `pattern_type: manual` is user-curated and bypasses the Hermes review queue.

## Rules

1. Class-level slugs only. Suggest renames for one-off-sounding names.
2. Body ≤ 60,000 chars, file ≤ 100 KB.
3. Never overwrite existing SKILL.md without showing diff + explicit user confirm.
4. Description starts with "Use when" — Hermes RAG retrieval depends on this prefix.
5. Korean prose for human-readable sections; English for slug, category, frontmatter keys, structural headings.
6. With no clear preceding work, ask one clarifying question rather than fabricating content.
7. `pinned: true` only on explicit user request.

If no Autoflow board is found, explain that the project needs an Autoflow board first and offer `autoflow init <project-root>` or the desktop install flow.
