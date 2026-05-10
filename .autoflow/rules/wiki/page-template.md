# Wiki Page Template

New wiki pages synthesized by Wiki AI must cover the seven perspectives below.
Pages that lack two or more of these sections (or equivalent inline coverage) are
flagged as shallow by `autoflow wiki lint` and will appear in `lint-checklist.md`
warnings.

**Sections marked `(required)` must appear in every generated page. Sections
marked `(if applicable)` may be omitted only when the topic genuinely has
nothing to say — include at least a one-line explanation of why the section
is empty rather than silently dropping it.**

---

## Purpose  *(required)*

State why this page exists and what question it answers.
One to three sentences maximum.

## Sources  *(required)*

List every ticket, log, or conversation that informed this page.

- Ticket: `tickets/done/<project-key>/Todo-NNN.md`
- Verification: `tickets/done/<project-key>/verify_NNN.md`
- Log: `logs/verifier_NNN_<timestamp>_pass.md`

## Summary  *(required)*

Write a short factual summary (≤ 5 sentences) of what was done and what it means.

## Decision Rationale  *(required)*

Explain *why* this approach was chosen over alternatives.  Each decision entry
must cite its source ticket or log.

- Decision: …
- Why: …
- Alternatives considered: …
- Source: `tickets/done/<project-key>/Todo-NNN.md`

## Implementation Patterns  *(required)*

Describe the concrete implementation approach with enough detail that another
agent can replicate or extend it without re-reading the ticket.

Include at least one code snippet, config excerpt, or command sequence that
illustrates the pattern.  Mark each snippet with its file path.

```
# example: file-path/to/relevant/file.ext
<snippet here>
```

## Hidden Contracts and Gotchas  *(required)*

List invariants, ordering constraints, environment assumptions, and known
failure modes that are **not** obvious from the code or ticket title.

- Gotcha: …  (consequence if violated: …)
- Contract: …  (where enforced: …)

## Cross-reference Narrative  *(required)*

Describe how this feature or decision connects to related pages.  Use
`[[wikilink]]` syntax so `autoflow wiki lint` can detect broken links.

- Related to: `[[<slug>]]` — reason for the relationship
- Depends on: `[[<slug>]]` — dependency type

If no related pages exist yet, write "No existing related pages found at synth
time" rather than omitting the section.

## Affected Paths and Anchors  *(required)*

List the repo-relative file paths and the specific functions / classes /
config keys changed by the work this page documents.

```
apps/foo/bar.ts          — MyClass.doThing() modified
packages/cli/baz.sh      — run_xyz() added, lines 100-140
```

## Verification Results and Regression Guards  *(if applicable)*

Record the verification command and its outcome.  Include the exact command
and a one-line result summary.

- Command: `cd … && npm run check`
- Result: exits 0 / ✓ / failure details
- Regression guard: the check must continue to exit 0 after any future change
  to `<affected-path>`.

If the ticket had no verification command, write "No verification command
defined in this ticket."

## Future Considerations  *(if applicable)*

Note known limitations, follow-up work, or conditions under which this
decision should be revisited.

- [ ] Follow-up item with source.

If none are known, write "No follow-ups identified at synthesis time."

---

*Backfill note: this template applies to newly generated pages.  Existing
short pages are **not** required to be immediately retrofitted; they will be
updated organically as related work lands.*
