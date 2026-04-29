---
kind: wiki_section_readme
title: Wiki Raw Sources
---

# Wiki Raw Sources

This directory stores immutable-ish raw source snapshots for `autoflow wiki ingest`.

The LLM reads these files as source material but should not edit them directly. Each source is copied verbatim after YAML frontmatter:

- `kind: raw_source`
- `slug`
- `original_path`
- `ingested_at`
- `updated_at`
- `sha256`

If the same source is ingested again with the same sha256, the raw file is left byte-for-byte unchanged. If the body changes, `ingested_at` is preserved and `updated_at` advances.
