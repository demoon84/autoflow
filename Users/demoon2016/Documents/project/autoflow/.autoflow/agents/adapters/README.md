# Runner Adapters

Adapters describe how Autoflow invokes local agent CLIs.

Each adapter file should state:

- required binary,
- expected input channel,
- useful model flags,
- safe dry-run behavior,
- log and artifact expectations.

Adapters are configuration guidance. They do not replace tickets or verifier evidence.
