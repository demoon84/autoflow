# Agent Adapters

This directory documents how Autoflow talks to local coding-agent CLIs.

Adapters are intentionally thin. Autoflow owns the board, queue state, runner
state, and verification rules. The adapter only explains how to invoke an
agent for a specific role and how to interpret its result.

Each adapter should answer:

- How to detect whether the CLI is installed.
- How to select a model.
- How to select reasoning or effort settings when supported.
- How to pass role instructions.
- How to pass board context.
- How to stream logs.
- How to identify idle, blocked, failed, and completed states.
- Which actions require human approval.

The first runnable implementation should use the shell adapter as a deterministic
baseline before adding agent-specific behavior.

