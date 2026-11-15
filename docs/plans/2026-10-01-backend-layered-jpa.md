# Backend Layered JPA Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the existing Spring Boot API into consistent feature-based three-layer modules using JPA, SOLID boundaries, and PostgreSQL as the deployment database while keeping SQL Server operational during transition.

**Architecture:** Keep package-by-feature and enforce Controller → Service/use case → Spring Data JPA Repository. Move HTTP concerns to controllers/global handlers, business rules and transactions to services, and database-specific schema/error behavior behind per-provider configuration and migrations. Use constructor injection and introduce ports only at replaceable or externally variable boundaries.

**Tech Stack:** Java 21, Spring Boot 3.4.4, Spring Data JPA, Jakarta Validation, Spring Security, Maven, PostgreSQL, SQL Server.

**Spec:** `docs/specs/2026-10-01-backend-layered-jpa-design.md`; PostgreSQL amendment: `docs/specs/2026-10-01-backend-postgresql-amendment.md`.

## Global Constraints

- Keep package-by-feature; do not move business logic into global controller or service packages.
- Keep DTOs at API boundaries; never serialize JPA entities directly.
- Use constructor injection; services own transactions and business orchestration.
- Preserve existing routes and response contracts unless a documented defect requires a change; update `docs/api-contracts/` before or with API changes.
- PostgreSQL is the deployment target; SQL Server remains supported during transition with provider-specific migrations and tests.
- Keep business code independent of vendor SQL; isolate native SQL, constraint translation, and schema-specific behavior.
- Never disable capacity/overlap database triggers or backend role checks.
- Exclude `users.deleted_at IS NOT NULL` users from authentication and default lists.
- Do not add real payment gateway, AI provider, native mobile, PDF/export, or unrelated schema changes.
- Check `git status` before each commit and stage only files belonging to that step.

## Review Focus

- Missing, deleted, or inactive account during authentication: deny authentication and do not return a token.
- Missing member/user for health recording: return a not-found/domain error; never create fixture entities.
- Member accessing another member's sensitive metrics: deny based on authenticated principal and role.
- PostgreSQL and SQL Server disagree on computed columns, unique constraints, generated values, or transaction behavior: verify on each provider before declaring support.
- Database constraint violations: return a stable client-safe conflict/validation response and do not expose SQL details.

---

### Task 1: Publish backend architecture rules

**Files:**
- Create: `rules/backend-architecture.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces contributor/agent rules that subsequent tasks and future tickets follow.

- [ ] Write rules for three-layer responsibility, feature package layout, SOLID application, constructor IoC, JPA portability, PostgreSQL/SQL Server profiles, migration policy, API DTO boundaries, security, transactions, exception handling, logging, and a PR checklist.
- [ ] Link the new rules file from root `AGENTS.md` without contradicting existing business invariants.
- [ ] Review the rule file against the existing root instructions and remove duplicate/conflicting claims.
- [ ] Commit only `rules/backend-architecture.md` and `AGENTS.md` as `docs: define backend architecture rules`.

### Task 2: Establish provider-neutral persistence configuration

**Files:**
- Modify: `apps/api/pom.xml`
- Modify: `apps/api/src/main/resources/application.yml`
- Create: provider-specific profile configuration and migration directories under `apps/api/src/main/resources/`
- Review: `db/` and `databaseschema.sql`

**Interfaces:**
- Produces PostgreSQL deployment configuration and preserves SQL Server configuration for transition.
- Consumes existing entity mappings and schema constraints.

- [ ] Map current migrations/schema objects and classify each as portable JPA mapping or vendor-specific database behavior before editing runtime config.
- [ ] Add the PostgreSQL JDBC driver and environment-driven PostgreSQL profile; retain SQL Server driver and add/retain its explicit profile.
- [ ] Remove hard-coded SQL Server dialect selection from shared configuration; leave dialect selection to Hibernate unless an engine-specific profile needs an explicit dialect.
- [ ] Replace `ddl-auto: update` with a controlled schema mode and introduce versioned migrations separately for PostgreSQL and SQL Server; preserve trigger/computed-column semantics on each provider.
- [ ] Keep credentials out of tracked files and turn off verbose SQL output by default; document local profile variables in `apps/api/README.md` and `.env.example`.
- [ ] Verify application startup configuration for each database profile and commit configuration/migration changes as `build: add PostgreSQL persistence profile`.

### Task 3: Normalize users and roles feature

**Files:**
- Refactor: `apps/api/src/main/java/com/swp391/scms/users/`
- Update tests: `apps/api/src/test/java/com/swp391/scms/users/`
- Review API contracts for users, roles, and profile.

**Interfaces:**
- Consumes: configured JPA provider, global exception contract, Spring Security principal.
- Produces user/role/profile use cases with controller-service-repository separation.

- [ ] Move the existing DTO mapping into focused mapper components where useful and keep controller response DTOs independent of entity classes.
- [ ] Add repository methods for active/non-deleted lookups and list queries so soft-deleted rows are filtered in the database, not after `findAll()`.
- [ ] Replace generic `RuntimeException` and `IllegalArgumentException` for expected domain cases with shared not-found/conflict/validation exceptions handled globally.
- [ ] Keep service methods transaction-scoped, inject dependencies through constructors, and preserve role authorization.
- [ ] Cover deleted-user exclusion, uniqueness conflicts, update not-found, and role not-found behavior with focused tests.
- [ ] Run the users feature checks and commit only this feature as `refactor(users): enforce layered JPA boundaries`.

### Task 4: Refactor authentication and OTP boundaries

**Files:**
- Refactor: `apps/api/src/main/java/com/swp391/scms/auth/`
- Refactor: `apps/api/src/main/java/com/swp391/scms/security/`
- Update: auth API contracts and OpenAPI annotations as needed.

**Interfaces:**
- Consumes: persisted users/roles and password encoder.
- Produces auth use cases and an OTP delivery port with a development adapter that does not expose OTP in production responses.

- [ ] Replace `AuthController` in-memory user list and direct business logic with auth service/use cases backed by JPA repositories.
- [ ] Ensure login checks account state, soft deletion, password hashes, and role before issuing JWT.
- [ ] Extract OTP delivery behind a narrow interface and keep OTP generation/expiry/attempt rules in service; configure debug delivery only for local development.
- [ ] Move token identity/authority access to Spring Security integration and avoid controller-level JWT parsing.
- [ ] Update API contracts before changing any current response field/status and document migration from the current in-memory demo behavior.
- [ ] Add focused tests for bad password, locked/deleted account, duplicate registration, OTP expiry/attempts, and successful activation.
- [ ] Run auth checks and commit as `refactor(auth): persist authentication and isolate OTP delivery`.

### Task 5: Refactor health metrics feature

**Files:**
- Refactor: `apps/api/src/main/java/com/swp391/scms/health/`
- Review: `apps/api/src/main/java/com/swp391/scms/security/`
- Update tests and health API contract if needed.

**Interfaces:**
- Consumes: authenticated principal, existing Member/User persistence.
- Produces health metric use cases with explicit authorization and no fixture creation.

- [ ] Remove manual Authorization header parsing and use the authenticated principal/security authorities.
- [ ] Split health metric orchestration and authorization checks into service-level collaborators only where they have independent responsibilities.
- [ ] Replace fallback creation of Member/User records with explicit not-found/domain errors.
- [ ] Use DTO mapping at the feature boundary and keep all read/write operations transactionally scoped.
- [ ] Add focused tests for own-member read/write, Coach/Manager permissions, forbidden cross-member access, missing member/recorder, and unsupported metric names.
- [ ] Run health checks and commit as `refactor(health): use principal and remove fixture persistence`.

### Task 6: Normalize finance feature and persistence portability

**Files:**
- Refactor: `apps/api/src/main/java/com/swp391/scms/finance/`
- Update: `apps/api/src/test/java/com/swp391/scms/finance/InvoiceComputedColumnTest.java`
- Review: invoice/payment migrations and API contracts.

**Interfaces:**
- Consumes: provider-neutral repositories and global database error mapping.
- Produces stable invoice/payment DTO use cases that work on PostgreSQL and SQL Server.

- [x] Confirm computed columns and generated values for invoices on both database engines; preserve database ownership of computed values.
- [x] Keep payment/invoice state transitions in services and use repository query methods instead of controller persistence access.
- [x] Isolate provider-specific constraint translation and avoid SQL Server error numbers in feature services.
- [x] Add integration coverage for invoice computed values and duplicate/invalid payment constraints on both supported engines.
- [x] Run finance checks and commit as `refactor(finance): isolate provider-specific persistence behavior`.

### Task 7: Normalize common handlers and remaining existing modules

**Files:**
- Review/refactor: `apps/api/src/main/java/com/swp391/scms/common/`
- Review/refactor: `apps/api/src/main/java/com/swp391/scms/classes/`, `coaching/`, `membership/`, `reception/`, `reporting/`
- Review/refactor: `apps/api/src/main/java/com/swp391/scms/config/` and `security/`

**Interfaces:**
- Consumes: patterns established by users, auth, health, and finance.
- Produces consistent layering for every non-empty backend feature.

- [ ] Inventory each remaining non-empty package and classify controllers, services, repositories, entities, DTOs, and config responsibilities.
- [ ] Centralize expected exception-to-HTTP mapping without exposing database internals; remove per-controller exception-to-status handling.
- [ ] Refactor only existing code that violates the agreed architecture; leave empty feature placeholders without inventing new features.
- [ ] Verify authorization remains enforced in backend and global configuration is limited to cross-cutting concerns.
- [ ] Commit each feature/package independently; do not combine unrelated packages in one commit.

### Task 8: Final integration and handoff

**Files:**
- Update: `apps/api/README.md`, `.env.example`, `docs/api-contracts/`, and `rules/backend-architecture.md` as needed.
- Review all backend source and migrations.

**Interfaces:**
- Consumes: all feature commits and provider-specific migrations.
- Produces: documented PostgreSQL deployment path and verified SQL Server transition path.

- [ ] Build the API and run the full existing test suite after all feature commits.
- [ ] Start integration checks against PostgreSQL and SQL Server; verify soft delete, authorization, computed columns, and trigger-enforced constraints.
- [ ] Confirm API docs match controllers and response DTOs.
- [ ] Review final git status and commit only any documentation/contract fixes as their own commit.
- [ ] Report each commit, verification command/result, known database-specific limitations, and deployment profile variables.
