# Agent Adapters

Adapters describe how Autoflow invokes local coding-agent CLIs.

Autoflow owns the board, ticket state, runner state, and verifier rules. The
adapter only defines how a local process is launched, which context it receives,
and how its result is interpreted.

Every adapter should document:

- install detection
- model selection
- reasoning or effort options
- role prompt input
- board context input
- log streaming
- idle, blocked, failed, and completed states
- approval boundaries

