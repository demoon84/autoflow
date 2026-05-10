# Wiki Lint Checklist

## Deterministic checks (run by `autoflow wiki lint` without an adapter)

- [ ] Each generated entry cites a ticket or log source.
- [ ] No page claims work is done without a done ticket source.
- [ ] No orphan feature or decision page lacks an index link.
- [ ] Managed sections are clearly marked.
- [ ] Human-authored sections are preserved.
- [ ] Links use stable board-relative paths.
- [ ] No `stale_reference.*` entries remain in the latest `autoflow wiki lint` run; cited `tickets/`, `logs/`, or `conversations/` paths must still exist on disk.

## Depth and completeness warnings (flagged as `lint_shallow_page.*`)

A generated page is **shallow** and should be flagged when any two or more of
the following conditions hold:

- Missing `## Decision Rationale` section (or no decision entries with a `Why:` line).
- Missing `## Implementation Patterns` section (or no code snippet / command excerpt).
- Missing `## Hidden Contracts and Gotchas` section.
- Missing `## Cross-reference Narrative` section (or no `[[wikilink]]` references).
- Missing `## Affected Paths and Anchors` section.
- Page body (excluding frontmatter) is under 100 lines and the topic is not a
  trivial stub intentionally scoped to a single decision.

**Shallow-page warnings do not block the wiki commit.**  They are advisory and
surfaced to Wiki AI so future ticks can improve coverage.  Existing pages that
predate this checklist are exempt from retroactive enforcement.

## Semantic checks (run only with `--semantic`)

- Contradiction between page claims and referenced ticket outcomes.
- Stale claim: page asserts a behavior that a later ticket explicitly reversed.
- Missing link: page mentions a component or feature that has a wiki page but
  does not link to it via `[[wikilink]]`.
- Citation without citation-gap: page cites a path that does not exist on disk
  (`stale_reference`).
