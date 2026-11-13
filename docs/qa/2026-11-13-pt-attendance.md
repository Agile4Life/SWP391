# PT attendance — 13/11/2026

**Historical first-stage report.** The audit/schema restriction described below was subsequently lifted by the user/Leader. The current implementation, real PostgreSQL results and remaining trigger proposal are documented in [the audit migration report](2026-11-13-pt-attendance-audit-migration.md). Do not treat the blocked audit status below as the current status.

Branch: `fix/receptionist-pt-attendance`, based on fetched `origin/main` at `07caf27a`. Local main was six commits behind. No commits, pushes, resets, stash changes, secret inspection or shared database writes.

## Result and limits

Frontend concurrency, refresh, tab classification and counts are fixed in source. Backend UPCOMING filtering is corrected, and the existing attendance lock is exposed in the DTO without a schema change.

The original transaction error is **not fixed**: the user explicitly deferred all audit/schema changes pending Leader approval. No migration was created or executed. There is no verified isolated PostgreSQL environment available in this session; no database connection was attempted. The deployed constraint and original request's HTTP response/stack trace remain unverified.

## Trace and diagnosis

`router.tsx` maps `/staff/pt-attendance` to `features/coaching/PtAttendancePage.tsx`. Its unmark button calls `ptAttendanceApi.unmarkPtAttended(id)` → `POST /api/v1/coach-bookings/{id}/unmark-attended` → `CoachBookingController.unmarkAttended` → transactional `CoachBookingService.unmarkAttended` → `CoachBookingRepository.save` → DTO → reload `GET /coach-bookings/attendance`.

The existing security matcher allows COACH, RECEPTIONIST and CENTER_MANAGER. The service allows the desk/manager and checks coach ownership. A cancelled booking is rejected with 409, a missing booking with 404, and an unauthorized actor with 403. The unmark request has no body or Bean Validation payload. Manual marking requires the session to have started (400 otherwise); current business logic allows marking after the end time. No RBAC change was made.

The service clears `attendedAt` and sets `attendanceLocked=true` without changing booking status. Its existing `@Audited(action="PT_ATTENDANCE_UNMARK", entity="coach_bookings")` runs inside the same transaction (`TransactionConfig` advice wraps `AuditAspect`). The CHECK annotation on `AuditLog` defines `ck_audit_entity_type` as:

```text
entity_type IN (
 'users','members','coaches','receptionists','center_managers',
 'membership_packages','membership_subscriptions',
 'classes','class_sessions','class_enrollments','class_waitlists',
 'center_checkins','session_attendance',
 'payments','invoices','invoice_items',
 'training_plans','training_plan_items','session_evaluations',
 'notifications','support_requests','role_permissions',
 'products','product_categories','product_variants','product_orders'
)
```

This source constraint excludes `coach_bookings`. If the deployed constraint matches it, inserting the audit entry violates PostgreSQL CHECK (SQLSTATE 23514). Catching the repository exception does not repair an aborted PostgreSQL transaction or clear a JPA/Spring rollback-only flag. A rollback-only transaction can throw `UnexpectedRollbackException` at commit, reaching the generic HTTP 500 `INTERNAL_SERVER_ERROR` handler and matching the reported generic message. A DataIntegrityViolationException escaping directly instead reaches the generic 409 mapper. These paths must not be conflated.

`PtAttendanceTransactionDiagnosticTest` verifies the annotation mismatch and uses the real service, audit aspect, Spring transaction advice and MockMvc endpoint with a **mock** audit repository and transaction manager. The test deliberately injects SQLSTATE 23514/rollback-only, then observes rollback, no commit and HTTP 500. It demonstrates the failure mechanism; it does **not** execute a PostgreSQL CHECK or prove the deployed database is identical. The diagnostic intentionally documents the current blocked defect and must be updated when the constraint repair is approved.

A second source-level risk remains unchanged: `scms_guard_pt_schedule` runs for every coach booking UPDATE, including attendance-only updates, and checks current active membership, conflicts/rest rules and a global scheduling lock. An expired membership can therefore prevent correcting an old confirmed booking. No trigger/function/schema change was made under the latest restriction. This must be covered in the future isolated database test along with the audit repair.

## Proposal for Leader — not implemented

1. Obtain approval for a Code-First schema upgrade. Do not add a handwritten DDL migration to `db/migrations`; repository policy makes the Java Entity authoritative.
2. In an isolated Supabase dev/test schema, inspect the actual `ck_audit_entity_type` definition, existing entity types and row count before changing anything. Compare it with the Entity; stop on unexpected drift rather than overwriting an unknown allow-list.
3. Add only `coach_bookings` to the allow-list in `AuditLog` while preserving every existing allowed type.
4. Verify whether Hibernate actually updates the existing named CHECK. Do not assume `ddl-auto: update` reconciles it. If needed, implement an idempotent, schema-qualified upgrade through the existing PostgreSQL provider lifecycle, deriving the replacement constraint from the Entity annotation (following the legacy schema-upgrade pattern). Replace/validate the CHECK atomically; preserve table, IDs, actor/action fields and all historical rows. No disabling audit, truncation, deletes, renaming entity types or independent audit transaction is proposed.
5. Separately review a schedule-trigger guard that skips revalidation only for UPDATEs whose coach/member/date/start/end/status are all unchanged. Scheduling changes, new bookings and reactivation must retain all existing checks; do not disable mandatory triggers.
6. Isolated acceptance tests: existing schema with legacy audit history; denied insert before upgrade; approved PT audit insert after upgrade; real mark/unmark commit; rollback on failed audit; repeat upgrade; unchanged historical rows; expired-member historical correction; scheduling changes still rejected when invalid. Do not apply to shared/production Supabase until Leader approval and explicit deployment authorization.

This is a proposed upgrade design, not an executable or verified migration.

## Tab rules and transitions

Times are interpreted in Asia/Ho_Chi_Minh, including offset-free booking timestamps. Counts and visible rows use the same clock snapshot. The backend applies the same start/end boundaries.

| Tab / label | Condition for a non-cancelled booking |
|---|---|
| Tất cả | All returned rows in the selected inclusive date range |
| Đã có mặt | `attendedAt != null` |
| Không có mặt | `attendedAt == null` and end time <= now; derived MISSED/no-show, never a persisted ABSENT |
| Sắp diễn ra | `attendedAt == null` and start time > now |
| Đang diễn ra · Chưa có mặt | start <= now < end, no arrival; appears in Tất cả only |

The four tabs are retained; the three result counts need not sum to All when an unmarked session is ongoing. Cancelled rows are excluded. The default range is the last 14 calendar dates through today; future days appear only if the selected range includes them. No new Receptionist ABSENT operation was added because PT has no official persisted ABSENT state in this model.

For a successful transaction: `(attendedAt=time, lock=false/legacy)` → `(attendedAt=null, lock=true)`; booking status, QR history and existing audit history remain unchanged. An ended session moves from Attended to derived MISSED; an ongoing one moves to the in-progress label in All; an early QR-attended future session moves to Upcoming. The lock prevents automatic QR/sweep re-credit; a later valid manual mark clears it. For failed unmark/rollback the UI retains the pre-request row and counts; it does not simulate success.

After a successful mutation, the UI re-reads the backend list instead of trusting local edits. A synchronous ref blocks duplicate clicks even before React renders; controls stay locked through the reload. Date changes invalidate earlier reads; stale successes/errors cannot overwrite the latest range. Focus, pageshow, visibility return and remount reload the backend. The local timer only recomputes time-derived classification; it never writes attendance or polls the API.

## Verification

- Frontend full suite: PASS, 169 files / 1,253 tests, including PT component/API regressions. Existing tests emitted localhost:3000 connection-refused diagnostics but the suite exited 0.
- Backend relevant suite: PASS, 135 tests, zero failures/errors/skips: CoachBookingServiceTest, PtAttendanceServiceTest, PtAttendanceSecurityTest, PtAttendanceTransactionDiagnosticTest, CenterCheckinServiceTest, TriggerProvidersTest, TriggerPolymorphismIntegrationTest, GlobalExceptionHandlerTriggerTest, DatabasePolicyTest, DatabaseProfilesTest. No real DB tests were run.
- PT frontend targeted suite: PASS, 16 tests (12 component + 4 HTTP client).
- ESLint: PASS after fixing the effect cleanup warning.
- TypeScript and Vite build: PASS; existing large chunk warning remains.
- `scripts/test-database-config.ps1`: PASS, 10 cases (process-local ExecutionPolicy Bypass; no machine policy change).
- `git diff --check`: PASS. Knowledge graph refresh could not run because `graphify` is not installed; no existing `graphify-out/graph.json` was present.
- Initial red tests confirmed duplicate mutation, missing focus reload, ongoing misclassification and missing removed-mark label. Backend red regression confirmed ongoing sessions incorrectly included in UPCOMING; green after the source change.
- Review: a second agent reviewed supplied production snippets; no blocking issue found in those snippets. It confirmed the audit defect remains unresolved and requested confirmation of late manual marking; the existing service explicitly permits it. This was a snippet review, not a full independent checkout review.

Not verified E2E: browser-to-real-API persistence, deployed schema/error logs, actual PostgreSQL constraint/rollback behavior, schema upgrade and legacy history preservation, and expired-subscription trigger behavior. No production/shared data or real account was used.

## Changed files

- `apps/web/src/features/coaching/PtAttendancePage.tsx`, `.test.tsx`, `ptAttendanceApi.test.ts`: UI behavior and regression/HTTP tests; existing API endpoint client unchanged.
- `apps/web/src/features/member/coachBookingApi.ts`: optional lock property for backward-compatible frontend typing.
- `apps/web/src/shared/i18n/translations.ts`: translated error fallbacks.
- `apps/api/src/main/java/com/swp391/scms/coaching/dto/CoachBookingDto.java`: existing lock exposed, no new entity column.
- `apps/api/src/main/java/com/swp391/scms/coaching/service/CoachBookingService.java`: future-only UPCOMING and DTO lock mapping; mark/unmark/audit implementation unchanged.
- `apps/api/src/test/java/com/swp391/scms/coaching/CoachBookingServiceTest.java`, `PtAttendanceSecurityTest.java`, `PtAttendanceTransactionDiagnosticTest.java`: time/filter/state, security and blocked-defect diagnostics.
- `docs/api-contracts/openapi-membership-benefits.yaml`, `docs/specs/2026-11-10-membership-and-attendance-business-rules.md`, `DESIGN.md`: contract and current UI/business rules.
- This report and `docs/superpowers/plans/2026-11-13-pt-attendance-fix.md`.
