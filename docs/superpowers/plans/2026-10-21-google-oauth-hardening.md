# SCRUM-89 Google OAuth corrections

User authorized implementation and merge into main. Execute inline, preserving existing commits and authors.

1. Add failing regression tests for browser state, replay/expiry, redirect allowlist, access token audience, renamed Google email, and debug OTP query cleanup.
2. Move redirect orchestration into a service. Start the browser session on the configured backend origin before redirecting to Google; bind a single-use five-minute state to that session. Accept only the configured callback URI. Keep controllers thin.
3. Validate access token client ownership before UserInfo. Use the resolved local account email for OTP. Standardize debug_otp and remove callback parameters from browser history.
4. Update i18n and API contracts. Run targeted and full checks, refresh the architecture graph, and obtain an independent review.
5. Commit with Jira keys, push, create PR, wait for CI, merge with a merge commit, then verify main.

## Execution ledger

- Baseline: 8ea1e10; tracked tree clean. Existing ignored local OAuth secrets and untracked user artifacts remain outside commits.
- Ruling: use a canonical backend authorize/start hop because frontend reverse-proxy cookies would otherwise be scoped to a different host than the Google callback.

- Implementation complete: state service, strict redirects and popup validation, access-token client binding, stable-account OTP and debug cleanup.
- Review fix: removed credential-returning auth audit annotations; real AOP regression failed four cases before fix, then passed.
- Verification: backend 409/0 failures/0 errors/17 skipped; frontend 166 passed; lint/build passed; database runner 10 cases; deployment script 5 tests; local runtime and real GIS popup verified. Interactive Google account/actual OTP completion remains manual.
- Independent review rechecked fixes and found no remaining issues. Proceed with already-authorized PR and merge after CI.
