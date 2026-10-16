# Phong review fixes: SCRUM-76, SCRUM-80, SCRUM-91

Scope approved by the user: fix the Phong-owned review findings and create local
commits named `[SCRUM-<key>]: <description>`. Base: `f679298`; branch:
`fix/phong-scrum-76-80-91`.

## SCRUM-76: payment access

- Reproduce member history and pending-payment failures through the actual HTTP
  security chain, method security and payment service.
- Add `/payments/my` with MEMBER method authorization and principal-derived ID.
- Allow MEMBER to create only their own pending requests; reject forged successful
  status, paidAt, cashier, foreign targets, wrong subscription price and non-pending
  subscriptions. Keep confirmation/refund/status operations staff-controlled.
- Update OpenAPI and all three message bundles; retain staff controller/service tests.

## SCRUM-80: trigger error translation

- Verify PostgreSQL SQLSTATE 23514/23P01 conversion through installed Hibernate/Spring.
- Keep P2/P3/P4 failures localized as 409/403 responses; preserve generic 500
  responses for unrelated syntax/connection errors and generic integrity handling.
- Verify with focused regression tests and the full Maven suite.

## SCRUM-91: Supabase-only runtime and legacy nullability

- Remove obsolete database drivers, profiles, providers and initialization paths;
  default to Supabase with TLS and reject unsupported database products.
- Reproduce the legacy NOT NULL case at the JDBC boundary before implementation.
- In the existing PostgreSQL strategy, reconcile the narrowly scoped check-in
  column with the nullable JPA mapping after Hibernate and before trigger setup.
- Keep the upgrade schema-qualified and idempotent, preserving data, foreign keys
  and mandatory triggers. Do not introduce standalone DDL migrations.
- Add an opt-in PostgreSQL upgrade regression using a generated isolated schema.

## Verification and boundaries

Run focused tests RED then GREEN; run the full backend suite and frontend lint/build.
Graphify was run, but its generated repository-wide changes are excluded from these
commits following the user's request to keep the review focused. Real PostgreSQL tests require the existing
SCMS_POSTGRES_TEST_* environment contract; do not claim they ran when skipped.
An's EnrollmentService constructor failure and all other owners' feature fixes
remain separate work. Do not merge PR #15, change SecurityConfig, or push remotely.

## Verification results after the Supabase-only scope update

- `mvnw.cmd clean test`: 273 tests, 0 failures, 0 errors, 13 opt-in database skips
  (260 executed). A clean build ensures removed provider/resource artifacts are gone.
- PostgreSQL upgrade regression executed separately: 1 passed, 0 skipped. It proves
  the legacy nullability gap, automatic repair, data/FK preservation, mandatory P4
  behavior and idempotence in a generated schema, which is cleaned after the test.
- Frontend lint/build passed; OpenAPI parsed with duplicate keys disallowed.
- Database runner tests: 7 passed. Four changed PowerShell scripts parse; `db:init`
  validates configuration and prints the Hibernate startup instruction without DB writes.
- Independent review found no P1/P2 issue in the final scoped source changes.
- The runtime, tests and current setup guides contain no obsolete provider support;
  historical schema/migration files remain read-only structural references for tests.
