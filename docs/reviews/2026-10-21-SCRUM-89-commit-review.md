# SCRUM-89 local checkpoint review

Scope: Google OAuth popup/redirect credentials, email OTP challenge, frontend login UI and environment-variable templates. This checkpoint is not a production-release approval.

## Verification

- Backend: 393 tests run, zero failures/errors; 17 Supabase integration tests skipped because their test environment was not configured.
- Frontend: 165 tests passed; lint and production build passed.
- Local runtime: API health returned 200/UP; login page returned 200; frontend received the expected client ID; API and Vite proxy returned Google authorization redirects with the registered localhost callback.
- Chromium opened the Google sign-in page from the local login form. Selecting a real Google account and completing email OTP remain manual checks.
- Credentials remain only in ignored local environment files. The example file contains placeholders.

## Follow-ups before merge or production release

1. Add browser-bound OAuth state generation and validation to the authorization redirect/callback flow. Remove unrestricted redirect overrides or validate them against configured callbacks.
2. Validate the client/audience binding of OAuth access tokens; UserInfo alone does not establish that a token was issued for this application's client ID.
3. Bind the OTP challenge to the local account resolved by Google subject. Currently a changed Google email is used for the challenge, while OTP verification looks the account up by its stored email.
4. Make the redirect debug OTP parameter consistent: the backend emits `debugOtp`, but the frontend consumes `debug_otp`.
5. Move OAuth authorization orchestration and expected-error handling from the controller into a service, as required by `docs/rules/backend-architecture.md`.

The unrelated Member Classes changes and existing `docs/examples/` files are outside this checkpoint.
