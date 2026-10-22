# SCRUM-86 — PR #45 review

Reviewed head: `035c902210952fdd270816953c6f3581b6e4264f`.
PR: https://github.com/Agile4Life/SWP391/pull/45
Original author: Lê Hoàng Thịnh. Screen owner: Thịnh; membership: An; finance: Phong.

## Finding and fix

- **P2 — POS confirmation discards cashier details.** In `PaymentService.processPayment`, the existing pending payment receives the method, cashier and note before `updatePaymentStatus` refreshes that same managed payment. The refresh reloads stored values, losing the checkout edits. Confirm first, then apply the cashier details. The existing regression test now models refresh discarding unflushed values and checks the final method, cashier, note, successful payment and active subscription. It failed before the fix (`pos` expected, `bank_transfer` actual) and passes after it.

## Validation

- Backend: 449 tests, 432 passed, 17 skipped, no failures/errors (includes database policy/profile tests).
- Frontend: 182 tests passed.
- Database configuration script: 10 cases passed.
- Frontend lint/build and `git diff --check`: passed.
- Actual Supabase concurrency/schema tests were not run; the skipped tests do not establish transaction behavior on PostgreSQL.

## History and integration

The fix is a separate commit on top of the original PR commit. No squash, rebase, author change, force push or merge into main was performed. PR #46 is independently based on main and overlaps the payment/subscription/UI code; merging both needs conflict resolution and verification of the combined result.
