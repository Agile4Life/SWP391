# SCRUM-89 OAuth verification and review

Scope: Google popup/redirect credentials, email OTP challenge, login UI and environment templates. Original checkpoint findings are resolved in the follow-up fix.

## Corrections

1. Redirect OAuth uses browser-session-bound, single-use random state with a five-minute lifetime. A canonical backend hop scopes the cookie to the callback host even when entry passes through the frontend proxy. Missing, mismatched, expired and replayed states cannot exchange codes. Callback overrides must equal the configured URI; POST popup requests cannot accept authorization codes.
2. Access token verification checks Google tokeninfo audience, issued_to and expiry before UserInfo and checks subject consistency when provided. Provider error details are excluded from public errors.
3. OTP delivery and verification use the stored email of the account resolved by the stable Google subject.
4. Redirect debug OTP consistently uses debug_otp. Frontend also accepts the legacy debugOtp and removes callback parameters from browser history.
5. Redirect orchestration and expected domain-error handling live in GoogleOAuthRedirectService; the controller maps HTTP requests and responses.
6. Independent review found audit persistence of OTPs. Removed result-audit interception from both Google OTP and legacy Google JWT authentication methods, preventing login credentials from entering audit storage.

## Evidence

- Backend: 409 tests, zero failures/errors; 17 Supabase integration tests skipped because dedicated test database configuration is absent. Actual local API connects to the configured Supabase environment.
- Frontend: 166 tests passed; lint and production build passed. The existing bundle-size advisory remains.
- Database runner configuration: 10 cases passed. Render deployment helper: five offline tests passed. OpenAPI YAML parsed.
- New tests reproduced missing callback state, unrestricted redirects, renamed email OTP mismatch and debug query mismatch before correction. Real AuditAspect interception reproduced four credential-persistence failures before removal; all now pass.
- Local runtime restarted with final code: health 200; frontend proxy canonical hop; state generation; HttpOnly SameSite=Lax cookie; provider cancellation handling; replay rejection and redirect override rejection verified.
- Chromium rendered the real Google button and opened accounts.google.com/v3/signin/identifier without an OAuth error. Selecting a real account and completing actual email OTP still require an interactive account session and were not performed by the agent.
- Independent final review: important audit finding fixed and rechecked; no remaining findings.
- Credentials remain only in ignored local environment files. No secrets are intended for the PR.

Existing Member Classes checkpoint commits are retained in history. Untracked docs/examples and graph caches are excluded.

## Single Google entry follow-up

User requested one button labeled "Dang nhap bang Google" (Vietnamese UI label retains accents). Removed the duplicate GIS-rendered button, standalone Gmail OTP entry and unused email-input screen. The remaining button uses the existing Google popup with protected backend redirect fallback. Google verification still precedes the OTP screen; resend remains available. Choosing another account returns to the single Google entry.

Regression coverage checks a single visible entry, popup-to-OTP transition, redirect OTP, query cleanup, choosing another account and missing-client configuration. Full frontend suite, lint and build passed; independent review found no issues. Local browser verification is recorded with the PR.

Production probe after the earlier release: frontend and backend deployment jobs succeeded, but backend Google authorize returned google_oauth=not_configured. Production Google environment configuration is still required and is separate from this UI correction; local configuration is present. Actual interactive Google account/OTP verification remains pending.

## Returning active member follow-up

User requested no repeated confirmation email for accounts already activated. After Google identity verification, account matching and role/deletion/status guards, active members now receive normal authentication immediately and last-login metadata is updated. OTP generation and delivery are not invoked. New or inactive members still receive activation OTP; locked/deleted/staff accounts remain rejected. Existing authoritative-email linking restrictions remain intact.

Popup responses expose requiresOtp plus either authentication or OTP metadata. The frontend saves the normal session and navigates home for authenticated responses. Redirect completion uses a 60-second, single-use handoff fragment, bound to a browser-generated verifier via SHA-256. The verifier is retained only in sessionStorage; state binds its challenge to the backend browser session. Redeem uses POST and no-store responses. JWT never appears in redirect URLs, and auth results remain excluded from audit persistence. Handoffs are in-memory like existing browser sessions: instance restart or routing to another instance requires retry.

Verification: backend 419 tests, zero failures/errors, 17 dedicated Supabase integration tests skipped; frontend 171 passed; lint/build passed; database runner 10 cases passed; OpenAPI parsed. Regression tests first reproduced active accounts being sent OTP and absent direct frontend session handling. Focused tests cover active linked/existing-email accounts, new/pending accounts, renamed pending email, locked/deleted/staff rejection, no repeated email, handoff expiry/replay/wrong verifier and frontend URL/storage cleanup. Independent final review found no blockers.

Local API restart and runtime redirect checks use the final code. Real Google account selection and a successful interactive login are not simulated or claimed. Production Google credentials remain a separate deployment configuration requirement.
