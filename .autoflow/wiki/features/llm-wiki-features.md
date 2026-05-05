---
kind: feature
slug: llm-wiki-features
title: "LLM-Driven Wiki Features"
created: 2026-05-05T00:18:14Z
updated: 2026-05-05T00:18:14Z
tags:
  - feature
  - llm-wiki-features
  - features
---

# LLM-Driven Wiki Features

## Overview

Autoflow's wiki is being enhanced with powerful Large Language Model (LLM) capabilities, transforming it from a static knowledge base into a dynamic, intelligent assistant. These LLM-driven features, introduced in `prd_006`, enable automated content ingestion, synthesized querying, semantic analysis, and an automated wiki maintainer.

## Key Features

### Automated Wiki Ingestion and Synthesis

-   The wiki system now supports automated ingestion of new information from completed tickets, reject records, and conversation handoffs.
-   The Wiki AI (`wiki` role) periodically synthesizes this information, layering intelligent insights on top of the deterministic wiki baseline. This process is debounced to batch updates efficiently.

### Synthesized Queries

-   **`autoflow wiki query --synth`**: This command allows users to ask natural language questions about the project. The Wiki AI synthesizes answers based on the wiki content, providing grounded responses with citations to source documents.
-   **`--rag` option**: When used with `--synth`, the `--rag` (Retrieval Augmented Generation) option retrieves relevant text chunks from wiki pages, improving the context for the LLM and enhancing the quality of synthesized answers.

### Semantic Linting

-   **`autoflow wiki lint --semantic`**: Beyond deterministic checks (orphan pages, broken links, missing frontmatter), this command uses LLMs to perform semantic analysis on wiki pages. It can detect contradictions, stale claims, and missing links between pages, providing deeper insights into the knowledge base's consistency and accuracy.

### Automated Wiki Maintainer

-   The `wiki` runner is now the exclusive source of AI-driven wiki synthesis. The previous `AUTOFLOW_WIKI_MAINTAINER_AUTO` environment variable and inline triggers have been removed.
-   The Wiki AI operates on a heartbeat, checking for changes in relevant directories (`tickets/done/`, `tickets/reject/`, `.autoflow/wiki/`) and performing synthesis when significant drift is detected or after a debounced period.

## Command Usage

-   **Querying with Synthesis:**
    ```bash
    autoflow wiki query --term "keyword1" --term "keyword2" --synth
    ```
    To use Retrieval Augmented Generation (RAG) for better context:
    ```bash
    autoflow wiki query --term "keyword" --rag --synth
    ```

-   **Semantic Linting:**
    ```bash
    autoflow wiki lint --semantic
    ```

## Procedure

The Wiki AI follows a structured procedure:
1.  Identify input sources (done tickets, logs, conversations, existing wiki pages).
2.  Check for baseline drift using `autoflow wiki update`.
3.  Run telemetry summarization (`autoflow wiki summarize-telemetry`).
4.  Perform AI synthesis (`autoflow wiki query --synth`) and/or semantic linting (`autoflow wiki lint --semantic`) if changes are detected or debouncing triggers are met.
5.  Update relevant wiki pages, ensuring idempotency and preserving human-authored content.
6.  Cite sources meticulously.

## Impact

These LLM-driven features significantly enhance the wiki's utility, making it a more interactive, insightful, and self-maintaining component of the Autoflow system.
