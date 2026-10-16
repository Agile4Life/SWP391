# Backend architecture rules

These rules apply to all new backend work and refactors in `apps/api`. Follow the project business invariants in the root `AGENTS.md` as well; this file does not replace them.

## Required structure

Organize Java code by business feature under `com.swp391.scms.<feature>`. A feature that owns HTTP endpoints, business behavior, and persistence uses its own `controller`, `service`, `repository`, `entity`, `dto`, and (when mapping warrants it) `mapper` packages. Do not put feature logic in global `controller` or `service` packages. Keep `common` limited to genuinely cross-cutting concerns.

Use a strict three-layer flow:

1. **Controller:** HTTP routing, request/response DTOs, validation entry point, status/header mapping, and delegation to a service. Never call a repository directly, implement business rules, parse JWT manually, or catch domain exceptions to decide status codes.
2. **Service/use case:** business rules, authorization decisions that depend on domain state, orchestration, and transaction boundaries. Services coordinate repositories and outbound ports. Use `@Transactional` for writes and `@Transactional(readOnly = true)` for read-only use cases where appropriate.
3. **Repository:** persistence queries only, implemented with Spring Data JPA. Put filtering, sorting, and pagination in database queries rather than loading all rows for in-memory filtering.

## SOLID and dependency injection

- Give each class one primary responsibility; split classes when independent reasons to change emerge.
- Extend behavior through small, stable contracts where alternatives are real (for example OTP delivery or provider-specific persistence error translation). Do not add abstraction layers or interfaces that only duplicate one implementation without a replaceability or testing benefit.
- Keep interfaces focused on the methods each consumer needs. Implementations must preserve the contract's behavior.
- Keep business rules independent of infrastructure details. Services may depend on repositories and outbound ports; provider-specific and external integrations implement those ports.
- Use Spring constructor injection with `final` dependencies. Do not use field injection, service locators, static mutable state, or manually instantiate Spring-managed collaborators.
- Prefer explicit, named implementations and configuration conditions so selected adapters are visible during debugging.

## JPA, database support, and Code-First polymorphism

- **Nguyên tắc Code-First & ORM Polymorphism:** Toàn bộ cấu trúc bảng, kiểu dữ liệu, khóa chính/ngoại, index và computed columns được định nghĩa trực tiếp bằng Java Entity (Jakarta Persistence & Hibernate 6).
- **Database Supabase PostgreSQL:** Hibernate ORM đồng bộ schema qua `spring.jpa.hibernate.ddl-auto: update`. Entity là nguồn định nghĩa bảng, cột, khóa và quan hệ; không tạo script `CREATE TABLE` thủ công để bootstrap database.
- **Cột tính toán (Generated columns):** Bắt buộc sử dụng `@GeneratedColumn("expression")` của Hibernate 6 kết hợp `@Generated(event = {EventType.INSERT, EventType.UPDATE})`. PostgreSQL Dialect sinh `GENERATED ALWAYS AS ... STORED`.
- **Trigger toàn vẹn dữ liệu (Capacity, Schedule Conflict, Membership Invariants):** Không phụ thuộc vào DDL migration thủ công. Hệ thống sử dụng interface đa hình `DatabaseTriggerProvider` SPI kết hợp `DatabaseTriggerInitializer` để tự động nhận diện CSDL và kích hoạt trigger tương ứng ngay sau khi Hibernate Code-First sinh bảng.
- **Không dùng native vendor SQL trong Java:** Tuyệt đối không dùng native SQL ghim cứng cú pháp một hệ quản trị CSDL trong Repository/Service; ưu tiên derived query methods hoặc JPQL chuẩn.
- **Ranh giới Entity:** Giữ Entity bên trong persistence boundary; luôn dùng DTO và Mapper để giao tiếp với Controller.

## API, validation, security, and errors

- Use dedicated request and response DTOs. Apply Jakarta Bean Validation to request DTOs and `@Valid` at controller boundaries.
- Keep API contracts stable during refactors. If a route, DTO, or status code must change, update `docs/api-contracts/` before or alongside the implementation.
- Keep role checks in the backend. Use the authenticated Spring Security principal and authorities; do not manually decode the bearer token in feature controllers.
- Throw typed domain/application exceptions for expected failures. Map them in the global exception handler to the shared error response shape. Do not return stack traces, SQL messages, or internal identifiers to clients.
- Do not authenticate users whose `deleted_at` is set; exclude them from default lists.
- Do not log passwords, OTP secrets, bearer tokens, database credentials, or sensitive health data. Add contextual IDs and operation names to logs where they help diagnose failures.

## Đa ngôn ngữ (i18n - Internationalization)

- **Nguyên tắc không hard-code chuỗi thông báo:** Tuyệt đối không hard-code chuỗi thông báo (success message, error message, validation message) bằng tiếng Việt hoặc tiếng Anh trực tiếp trong Controller, Service, hay Exception.
- **Vị trí tài nguyên i18n:** Toàn bộ thông báo được quản lý tập trung tại `apps/api/src/main/resources/i18n/`:
  - `messages.properties`: Bộ từ khóa mặc định (Tiếng Việt).
  - `messages_vi.properties`: Tiếng Việt (`Locale("vi")`).
  - `messages_en.properties`: Tiếng Anh (`Locale("en")`).
- **Quy tắc bắt buộc khi code tính năng mới (Dành cho mọi Contributor và Agent):** Khi tạo mới endpoint API, thêm nghiệp vụ, hoặc thêm mã lỗi mới, **BẮT BUỘC** phải bổ sung các key tương ứng vào cả 2 file `messages_vi.properties` và `messages_en.properties`.
- **Cơ chế phân giải đa ngôn ngữ:**
  - Sử dụng component `MessageService` (`com.swp391.scms.common.i18n.MessageService`) với phương thức `messageService.getMessage("key.name", args...)`.
  - Hệ thống tự động nhận diện ngôn ngữ qua HTTP header `Accept-Language` (ví dụ: `Accept-Language: vi` hoặc `Accept-Language: en`, mặc định là `vi`).

## Change workflow checklist

Before opening or completing a backend change:

- Identify the feature owner, acceptance criteria, and relevant invariants in `docs/plans/AGILE_SCRUM_JIRA_PLAN.md`, `docs/PROJECT_MASTER_GUIDE.md`, and `db/databaseschema.sql`.
- Keep controller, service, repository, entity, and DTO responsibilities separated; inject dependencies through constructors.
- Keep transaction boundaries in service/use-case code and persistence logic in JPA repositories.
- Check Supabase PostgreSQL entity mappings, schema upgrades, generated columns, and constraint errors.
- Preserve role/subscription authorization and trigger-enforced constraints.
- Update API contracts and OpenAPI when public behavior changes.
- Bắt buộc bổ sung message key vào cả `messages_vi.properties` và `messages_en.properties` khi thêm endpoint, mã lỗi hoặc thông báo mới.
- Add or update focused tests for changed behavior and run the relevant Maven checks before committing.
- Review `git status` and stage only files belonging to the current feature-sized change. Make one small, descriptive commit per independently reviewable refactor part.
