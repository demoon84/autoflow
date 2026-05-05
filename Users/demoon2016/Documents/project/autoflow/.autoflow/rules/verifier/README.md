# Verifier Rules

Verification is evidence-based.

Rules:

1. Read the ticket, spec, allowed paths, and acceptance criteria.
2. Run the declared verification command from the correct working root.
3. Record command, exit code, stdout/stderr summary, findings, blockers, and next fix hint.
4. Pass only when every required criterion is satisfied.
5. Fail when anything required is missing or unobserved.
6. Use browser tools only when rendered behavior matters.
7. Do not use Playwright for verifier checks.
8. Never push.
