# SCRUM-89 Returning Google member login

User requested existing verified accounts enter directly without another confirmation email. Existing authorization to commit and merge into main continues to apply.

## Design

- After verified Google identity resolution and existing role/deletion/status guards, active members receive JWT immediately. New/inactive members retain activation OTP.
- Popup returns an explicit requiresOtp result and authentication data when appropriate. Frontend creates its normal session and navigates home for direct login.
- Redirect uses the same decision. Carry a random single-use, 60-second handoff code in a URL fragment; redeem through POST for authentication. Never put JWT in redirect URLs or audit results. Existing state validation remains mandatory.
- Use existing JPA schema, status and JWT helpers; no database or dependency changes.

## Steps

1. Reproduce repeated OTP for an active account; add frontend direct-login regression.
2. Implement conditional service result, DTO/controller contract, redirect handoff and frontend session handling.
3. Cover pending/new/locked/deleted/staff, no email for returning users, handoff expiry/replay, and URL cleanup. Update API contracts and i18n.
4. Run relevant and full checks, independent review, graph refresh, then commit/PR/CI/merge preserving history.

## Ledger

- Baseline: main 2fc64b9, tracked tree clean. Production Google credentials remain absent independently of this code change; local credentials are configured and ignored.
- Ruling: active is the existing account-activation marker; inactive still represents pending activation and must not bypass OTP.
- Ruling: short-lived in-memory handoff follows the existing single-instance browser-session deployment. A restart or different instance rejects the handoff and requires retry; it never bypasses authentication.

- Added browser SHA-256 verifier binding to the handoff to prevent transferred-link login CSRF. State stores only its challenge; redeem requires the initiating browser secret and consumes the code atomically.
- Verified: clean backend 419 tests (0 failures/errors, 17 integration skips); frontend 171 passed; lint/build and 10 database-config cases passed. Public contract and all i18n bundles updated.
- Independent final review checked active/pending decisions, guards, verifier binding, expiry/replay and URL cleanup with no blockers.
