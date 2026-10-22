# SCRUM-86 — PR #46 review

Reviewed head: `c3eec826506804c78041fdd131d9ed12297a4b62`.
PR: https://github.com/Agile4Life/SWP391/pull/46
Original author: Lê Hoàng Thịnh. Screen owner: Thịnh; membership: An; finance: Phong.

## Findings and fixes

1. **P1 — Approving cancellation can remove separately paid class bookings.** `MembershipCancellationService` checked other subscriptions but then cancelled every upcoming enrollment, including classes with their own pending/successful payment. A JPQL guard now returns HTTP 409 before changing the subscription/request or touching bookings. Resolve the class entitlement first. The query considers booked enrollments with scheduled sessions that have not ended, or classes without sessions, matching the cancellation helper's scope. Completed/cancelled bookings and classes whose sessions have ended do not block cancellation. Added the error key to all three message bundles and updated OpenAPI.
2. **P1 — Reusing a subscription payment can settle an unrecorded additional enrollment.** POS could receive both subscription and enrollment IDs, mark that enrollment booked, then return the pre-existing payment that only recorded the subscription. Reusing a pending subscription payment now rejects an additional enrollment target before activation. The caller must settle these targets separately.
3. **P2 — Reused payments retain the wrong method/note.** POS changed status/cashier but retained the member's original payment method and note. It now stores the actual cashier method and note, as the new-payment path already does.

Each behavior regression failed against the original implementation and passed after the corresponding fix. The cancellation service uses constructor injection for the new payment dependency and EntityManager.

## Validation before integration

- Backend: 443 tests, 426 passed, 17 skipped, zero failures/errors.
- Frontend: 186 tests passed; lint/build passed (existing bundle-size warning).
- Database configuration script: 10 cases passed; `git diff --check` passed.
- JPQL compiles and accepts parameters against the real Hibernate entity mappings without a database connection.
- Live Supabase concurrency and schema upgrade tests were not run. Offline mapping validation does not prove those behaviors.

## Contribution history

Fixes are separate commits above the original PR commit. Preserve both original PR commits when integrating PR #45 and #46; do not squash or rewrite authors.
