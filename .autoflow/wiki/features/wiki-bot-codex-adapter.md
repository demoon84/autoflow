# Wiki Bot Codex Adapter

Wiki Bot (`wiki-1`) can run through the Codex adapter while preserving Gemini as a selectable provider.

## Summary

- `wiki-1` supports `agent = "codex"` with Codex model and reasoning settings in runner config.
- `autoflow run wiki --dry-run` exposes the Codex command path and still uses `.autoflow/agents/wiki-maintainer-agent.md` as the role prompt.
- Desktop AI management keeps shared runner provider/model/reasoning controls available for Wiki Bot, including both Codex and Gemini.
- Provider-specific behavior stays behind the runner adapter abstraction; wiki synthesis logic should not branch on Codex or Gemini directly.

## Reusable Constraints

- Preserve the internal runner id `wiki-1`; do not rename it to `wiki-maintainer` in active config.
- Keep Gemini selectable when adding or changing Codex support.
- When checking Wiki Bot adapter changes, include a dry-run assertion for `adapter=codex`, the `codex exec` command, and the wiki maintainer prompt file.

## Citations

- Source: `tickets/done/prd_038/tickets_038.md`
- Verification: `tickets/done/prd_038/verify_038.md`
- PRD: `tickets/done/prd_038/prd_038.md`
