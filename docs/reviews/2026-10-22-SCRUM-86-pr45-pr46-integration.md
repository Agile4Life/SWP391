# SCRUM-86 — PR #45 and #46 integration

Original author of both PRs: Lê Hoàng Thịnh.

| PR | Reviewed head | Separate fix commit |
| --- | --- | --- |
| [#45: unlimited renewal](https://github.com/Agile4Life/SWP391/pull/45) | `035c902` | `95a2cc1` |
| [#46: membership cancellation](https://github.com/Agile4Life/SWP391/pull/46) | `c3eec82` | `915efed` |

## Review fixes

- **P1, #46:** Stop approving membership cancellation while an upcoming booked class has a separate pending/successful payment. Return 409 before mutation; preserve the booking, subscription and pending cancellation request. The check also covers classes without sessions, which the existing cancellation helper treats as upcoming.
- **P1, #46:** Reject adding an enrollment target when reusing an existing subscription payment, preventing booking activation without its corresponding payment record.
- **P2, #45 and #46:** Preserve the actual POS method, cashier and note when settling an existing payment; avoid refresh discarding cashier edits and avoid retaining the old transfer method/note.

Behavior regressions failed before fixes. Individual reports document their reproduction and per-PR verification.

## Conflict resolution

- Retain #45's paid renewal-chain validation, future-period display, member serialization, frozen-membership/future-paid-period guards and fixed renewal dates.
- Retain #46's pending cancellation confirmation, idempotency, manager approval flow, role checks and paid-entitlement protections.
- Use one POS settlement path for both pending registrations and renewals. Resolve the pending payment, activate once, then save the final cashier metadata. Do not refresh away pending edits or create a duplicate payment. Validate payment owner/amount and reject additional enrollment targets.
- Keep both sets of regression tests; consolidate duplicate injected fields and QR methods; document subscription state conflicts as HTTP 409.
- Reuse the established constructor-injection, JPQL, error-handler and i18n patterns. No handwritten schema DDL, database adapters or trigger bypasses were added.

## Combined validation

- `mvn -q -f apps/api/pom.xml test`: **462 tests, 445 passed, 17 skipped, zero failures/errors**. Includes `DatabasePolicyTest`, `DatabaseProfilesTest`, payment/subscription/cancellation regressions and offline Hibernate JPQL compilation.
- `npm test -- --reporter=dot`: **187 passed**.
- `npm run lint` and `npm run build`: passed; the existing bundle-size warning remains.
- `scripts/test-database-config.ps1`: 10 cases passed.
- `git diff --check`: passed.
- `graphify update .`: code graph refreshed (8,983 nodes, 19,591 edges). Existing historical snapshots and cache files are preserved; no semantic/LLM extraction was run.

Live Supabase concurrency and schema upgrade tests remain unverified. The 17 skipped tests and offline mapping check must not be interpreted as live database validation.

## Contributions and workspace

Both original PR heads remain ancestors of main through merge commits; no squash, author rewrite, rebase or force push. Review fixes retain the configured contributor identity. Merge preserves author history; GitHub contribution credit still depends on GitHub's account/email rules.

Pre-existing local Docker edits remain unstaged and are excluded from these commits. The pre-existing CI workflow adjustment was already present in the pulled main branch.
