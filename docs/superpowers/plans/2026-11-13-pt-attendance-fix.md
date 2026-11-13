# PT attendance fix

Approved scope: keep RBAC, QR and audit unchanged. No commits, pushes, shared database writes or secret access.

Follow-up approval: Leader/user now authorizes adding coach_bookings to the audit CHECK with an explicit schema migration, preserving all existing allowed values and historical rows. Use the existing PostgreSQL provider upgrade lifecycle; do not rely on ddl-auto=update or add Flyway/Liquibase. Run real PostgreSQL tests only on a new loopback cluster labelled scms_pt_isolated. Review the historical membership trigger and report a minimal proposal; do not weaken it without approval.

Final approval: commit/push only on fix/receptionist-pt-attendance after default-off audit deployment gate, tests and scoped staging pass. Migration flag app.database.audit-entity-type-upgrade-enabled defaults false; explicit true is reserved for controlled rollout. No shared DB access or main merge is authorized. The original no-commit/no-push instruction below is historical and superseded by this final approval.

1. Add regression tests for upcoming vs in-progress, ended/unmarked sessions, unmark success/failure, concurrent clicks, reload and Vietnam time boundaries.
2. Keep the four tabs; show in-progress/unmarked sessions in All only. Match the backend UPCOMING filter to a future start, using Asia/Ho_Chi_Minh. Preserve the existing derived MISSED rule; never write ABSENT.
3. Fix frontend loading races, mutation locking, reload on focus and counts computed at the same instant as the visible list. Reload backend data after mutations.
4. Verify the audit constraint mismatch without schema changes. Report the expected transaction failure and propose an Entity-driven schema repair for Leader approval; do not apply it.
5. Run targeted frontend/backend tests, lint, TypeScript, build and database policy checks. Record unavailable isolated database/E2E validation separately.
