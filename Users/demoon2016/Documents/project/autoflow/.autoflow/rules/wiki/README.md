# Wiki Rules

The wiki is a derived knowledge layer.

Rules:

1. Preserve user-authored content outside managed sections.
2. Cite ticket, verification, or log sources.
3. Summarize decisions and reusable lessons.
4. Avoid copying whole tickets into wiki pages.
5. Do not decide pass/fail from wiki content.
6. Keep pages short enough for agents to scan quickly.
7. Automatic ingest must be idempotent: rerunning on the same inputs should converge instead of duplicating content.
8. Human-authored regions outside `AUTOFLOW:BEGIN ... / AUTOFLOW:END ...` markers are read-only to automation.
