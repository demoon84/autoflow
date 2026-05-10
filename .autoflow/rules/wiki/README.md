# Wiki Rules

The wiki is a derived knowledge layer.

Rules:

1. Preserve user-authored content outside managed sections.
2. Cite ticket, verification, or log sources.
3. Summarize decisions and reusable lessons.
4. Avoid copying whole tickets into wiki pages.
5. Do not decide pass/fail from wiki content.
6. Keep pages scannable but not shallow: a page that answers only "what was done"
   without explaining "why", "how", "what gotchas exist", and "what to watch next"
   is incomplete.  See `rules/wiki/page-template.md` for the required seven
   perspectives.
7. Automatic ingest must be idempotent: rerunning on the same inputs should converge instead of duplicating content.
8. Human-authored regions outside `AUTOFLOW:BEGIN ... / AUTOFLOW:END ...` markers are read-only to automation.
9. New pages must include at least the five required sections from `page-template.md`
   (`Purpose`, `Sources`, `Summary`, `Decision Rationale`, `Implementation Patterns`).
   Pages that miss two or more required sections are flagged as shallow by lint.
10. No immediate backfill of existing short pages is required.  Apply the depth
    standard to newly generated pages only; existing pages improve organically
    as related work lands.
