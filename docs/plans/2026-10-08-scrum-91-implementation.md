# SCRUM-91 Implementation Plan

**Goal:** Chạy backend hiện có trên Supabase PostgreSQL bằng Entity Code-First.
**Spec:** `docs/specs/2026-10-08-scrum-91-supabase-design.md` — đã được người dùng duyệt, chọn triển khai trực tiếp.
**Architecture:** Tái sử dụng JPA và trigger SPI, bổ sung profile Supabase và bảo vệ Data API. Không chuyển dữ liệu demo, không dùng Flyway, giữ hợp đồng API.
**Tech Stack:** Java 21, Spring Boot 3.4.4, Hibernate 6.6, PostgreSQL JDBC, PowerShell.

## Global Constraints

- Cấu trúc bảng do Entity sinh; `ddl-auto: update`.
- P2/P3/P4 bắt buộc, giữ message/constraint name và HTTP/i18n hiện tại.
- Credentials chỉ từ môi trường; không sửa/in giá trị `.env` hiện có.
- Chưa có endpoint PostgreSQL test thì phải ghi rõ integration test chưa chạy.
- Thực hiện trực tiếp, không commit/push hay thay cloud project trong phiên này.

## Review Focus

- Thiếu bảng/trigger phải làm startup fail, không bỏ qua.
- Session pooler có SSL và pool hữu hạn; profile `local` không tự bật trên Supabase.
- Test schema không bị skip do sai đường dẫn và test DB thật dùng schema riêng.
- RLS chỉ tác động bảng JPA, không thay bảng hệ thống Supabase.
- Hai giao dịch booking cạnh tranh slot cuối không vượt capacity.

## Task 1: Profile và guard schema

**Files:** `application.yml`, `application-postgresql.yml`, `application-supabase.yml`, `application-sqlserver.yml`, `.env.example`, `CodeFirstSchemaTest.java`, `DatabaseProfilesTest.java`.
**Interface:** Profile `supabase` dùng env `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`; PostgreSQL driver và Hikari.

- [x] Viết test tải YAML và resolve placeholder, thiếu env phải lỗi; Supabase có SSL và không có debug OTP mặc định.
- [x] RED: `mvnw.cmd -Dtest=DatabaseProfilesTest test`.
- [x] Thêm Supabase profile, dùng `data-source-properties.sslmode: require`, Hikari tối đa 5; PostgreSQL default; nationalized chỉ ở profile SQL Server.
- [x] Sửa schema guard dùng `Path.of("..", "..", "db", "databaseschema.sql")`, assert tồn tại; kiểm chứng DDL PostgreSQL có `generated always as`, `stored`, `jsonb`.
- [x] GREEN: `mvnw.cmd -Dtest=DatabaseProfilesTest,CodeFirstSchemaTest test`.

## Task 2: Trigger bắt buộc và RLS

**Files:** `PostgreSqlTriggerProvider.java`, `DatabaseTriggerInitializer.java`, `PostgreSqlDataSecurityInitializer.java`, `postgresql-triggers.sql`, `TriggerProvidersTest.java`, `PostgreSqlDataSecurityInitializerTest.java`.
**Interface:** Trigger SPI không đổi; security runner chỉ active khi profile Supabase, lấy tên bảng từ JPA metamodel.

- [x] Test provider ném startup failure nếu thiếu bảng; RLS runner chỉ dùng các bảng map JPA và quote identifier đúng.
- [x] RED: `mvnw.cmd -Dtest=TriggerProvidersTest,PostgreSqlDataSecurityInitializerTest test`.
- [x] Bỏ nhánh skip lỗi PostgreSQL; trigger runner chạy trước seed; partial indexes username/phone có predicate tương ứng schema chuẩn.
- [x] RLS runner kiểm tra backend role là owner/bypass, bật RLS cho bảng JPA trước seed, không thêm policy public.
- [x] GREEN: chạy lại hai test trên.

## Task 3: Runner Windows và PostgreSQL integration test

**Files:** `scripts/run-local.ps1`, `scripts/init-db.ps1`, `scripts/test-database-config.ps1`, `PostgreSqlDatabaseIntegrationTest.java`.
**Interface:** `SCMS_POSTGRES_TEST_URL`, `SCMS_POSTGRES_TEST_USERNAME`, `SCMS_POSTGRES_TEST_PASSWORD` chỉ dùng test DB; schema test ngẫu nhiên, cleanup đúng schema đó.

- [x] Test PowerShell runner phát hiện PostgreSQL và không gọi SQL Server initializer, không thêm local vào Supabase.
- [x] RED: `powershell -NoProfile -File scripts/test-database-config.ps1`.
- [x] Chọn provider theo profile/URL; kiểm tra env bắt buộc trước khởi động; bảo vệ `init-db.ps1` không chạy T-SQL vào cấu hình PostgreSQL.
- [x] GREEN: chạy lại script kiểm chứng và parse AST PowerShell.
- [x] Viết test DB thật tạo schema biệt lập bằng Hibernate, cài provider, test P2/P3/P4, partial index, generated column, JSON và smoke API.
- [x] Chạy `mvnw.cmd -Dtest=PostgreSqlDatabaseIntegrationTest test`; chưa có test credentials thì ghi skip, không coi là nghiệm thu.

## Task 4: Tài liệu và kiểm chứng cuối

**Files:** README, local guide, hướng dẫn Supabase, backlog SCRUM-91.

- [x] Ghi cấu hình session pooler, SSL certificate, biến môi trường và Data API/RLS; không cần Supabase API key.
- [x] Đổi AC Flyway sang Hibernate từ database rỗng theo quyết định người dùng.
- [x] Chạy `mvnw.cmd test`, `git diff --check`, kiểm tra Surefire failures/errors/skipped và parse PowerShell.
- [x] Cập nhật graph nếu công cụ hỗ trợ incremental an toàn; tự review diff, báo đúng phần chưa kiểm chứng cloud.

## Progress ledger

- Baseline: 161 tests, 0 failures/errors, 2 skipped vì schema path cũ.
- Ruling: làm trực tiếp tại workspace hiện có theo người dùng; không tạo worktree, không commit tự động.
- Ruling: giữ Code-First theo xác nhận; Flyway AC được thay bằng Hibernate bootstrap.
- Ruling: không chuyển dữ liệu demo; không xóa database cũ.
- Task 1: complete — Supabase profile + guard TLS/credentials/profile; schema guard chạy cả hai dialect, generated stored/jsonb được kiểm chứng offline.
- Task 2: complete — trigger fail-fast, RLS gồm bảng nối role_permissions; test owner guard và kiểm chứng RLS trên Supabase thật pass.
- Task 3: complete — 7 tình huống provider pass, AST PowerShell pass. Cả 12 PostgreSQL integration tests pass trên Supabase thật, schema test riêng được cleanup.
- Task 4: complete — backend 183 tests: 183 passed, 0 skipped/failures/errors; web production build pass (cảnh báo bundle >500 kB có sẵn); diff whitespace pass.
- Review ruling: đóng connection metadata trước provider dispatch để pool 1 connection không kẹt; test RED rồi GREEN.
- Review ruling: bổ sung 25 CHECK portable vào 21 Entity để schema PostgreSQL rỗng giữ ràng buộc schema tham chiếu; schema guard RED ở ck_users_gender rồi GREEN trên cả hai dialect. JSON dùng mapping native thay ISJSON.
- Independent review: không còn Critical/Important sau sửa lỗi metadata pool và rà soát CHECK mappings. Review bổ sung integration tests payment/invoice/RLS không phát hiện Important issue.
- Code graph: `python -m graphify update . --no-cluster` thành công: 7.667 nodes, 13.410 edges. Giữ graph/manifest, dọn cache/backup phát sinh trong phiên; tài liệu ngữ nghĩa chưa được re-extract bằng LLM.
- Live test diagnosis: hai assertions ban đầu tìm tên constraint trong JDBC getMessage(), trong khi PostgreSQL trả constraint ở trường protocol riêng. Đã tái hiện và sửa assertions kiểm tra SQLState 23514 cùng nguyên văn thông báo nghiệp vụ; toàn bộ suite chạy lại pass.
- Supabase bootstrap: người dùng điền DB password vào `.env` bị git ignore; không in password/JWT. Profile `supabase` khởi tạo thành công schema `public` rỗng: 34 bảng, cả 34 bật RLS, 5 trigger, 0 public policies. Session pooler nhận JDBC qua TLS 1.3; `pg_stat_ssl` phản ánh chặng pooler → database, không dùng chỉ số đó để suy luận TLS phía JDBC.
- Live HTTP: API kiểm chứng cổng 18080 trả health UP tại `/api/v1/health`, payments không xác thực trả 401. API kiểm chứng đã dừng; database và `.env` sẵn sàng cho runner thông thường. Các luồng có JWT/payment/invoice đã pass trong integration tests trên DB thật, không ghi dữ liệu test vào `public`.
- Code graph follow-up: thử incremental update sau sửa assertion hai lần; Python/native extractor thoát 0xC0000005. Giữ graph/manifest từ lần update thành công trước đó; graph chưa phản ánh thay đổi assertion cuối và tài liệu nghiệm thu. Không ảnh hưởng build/test ứng dụng.
- External status: chưa thao tác trực tiếp với Jira hoặc cấu hình Data API trong dashboard. RLS không có policy public đã được kiểm chứng chặn đọc với role không bypass; không cần API key Supabase cho backend JDBC.
