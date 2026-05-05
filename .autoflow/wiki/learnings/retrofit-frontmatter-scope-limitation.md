---
kind: learning
slug: retrofit-frontmatter-scope-limitation
title: Retrofit Frontmatter Tool Scope Limitation
created: 2026-05-05T00:00:00Z
updated: 2026-05-05T00:00:00Z
tags:
  - retrofit
  - frontmatter
  - limitation
  - wiki
---

# Retrofit Frontmatter Tool Scope Limitation

## Overview

During wiki maintenance, it was discovered that the `autoflow wiki retrofit-frontmatter` tool has a defined scope of operation, applying only to pages within the following directories:

*   `wiki/decisions/`
*   `wiki/features/`
*   `wiki/learnings/`
*   `wiki/architecture/`

Consequently, pages located outside these directories that are flagged by `autoflow wiki lint` for missing frontmatter cannot be automatically corrected by this tool.

## Implication

This limitation means that resolving missing frontmatter for pages outside the tool's scope requires manual intervention or the development of alternative mechanisms. This also highlights a potential need to update the `autoflow wiki lint` tool to either respect the `retrofit-frontmatter` scope or provide a different mechanism for addressing such issues.
