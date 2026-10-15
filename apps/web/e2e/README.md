# Playwright browser tests

Run from `apps/web`:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

Playwright builds the frontend and starts a production preview at
`http://127.0.0.1:4173`. Keep that port available. No backend, database,
credentials or `.env` file is required.

The suite covers public navigation, anonymous route guards, login validation,
password visibility, API/network errors, session persistence, member role guards,
logout, expired-session messaging, and registration with OTP verification.
API responses are mocked: these tests validate browser behavior and request
payloads, not real authentication, email delivery or database persistence.
The backend CI job separately tests API authorization and PostgreSQL invariants.

`npm run test:e2e:ui` opens the interactive runner.
`npx playwright show-report` opens the HTML report after a run.
Failures retain screenshots, videos and traces under `test-results/`.

GitHub Actions installs Chromium and its system dependencies, runs the suite,
and uploads `playwright-results` (HTML/JUnit reports and failure evidence).
The required `CI passed` check includes Playwright. Unit tests remain under
`src/**/*.test.{ts,tsx}` and run separately with `npm test`.
