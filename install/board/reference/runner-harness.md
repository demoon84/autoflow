# Runner Harness

The runner harness lets local processes consume Autoflow board work.

Core contracts:

- runners read board files,
- runners write durable state back to tickets and logs,
- runner stdout/stderr is copied to `runners/logs/`,
- runner state is stored under `runners/state/`,
- tickets remain the source of truth.
