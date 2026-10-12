# SCRUM-91 — Chuyển sang Supabase PostgreSQL bằng Code-First

## Mục tiêu và quyết định đã chốt

Ngày 08/10/2026, người dùng yêu cầu đối chiếu codebase và triển khai chuyển SQL Server sang Supabase PostgreSQL. Người dùng xác nhận giữ Hibernate Code-First và không cần chuyển dữ liệu SQL Server vì dữ liệu hiện tại chỉ là demo. Owner: Phong; Sprint 2; 5 SP; High; chưa có due date.

Không dùng Flyway để tạo bảng. Không xóa database SQL Server hiện có. React tiếp tục gọi Spring Boot API; database được truy cập bằng JDBC, không chuyển authentication sang Supabase Auth.

## Đối chiếu codebase

| Hạng mục | Hiện trạng | Thay đổi cần thực hiện |
|---|---|---|
| Driver và profile | `pom.xml` đã có PostgreSQL; mặc định `sqlserver,local` | Thêm profile Supabase, mặc định PostgreSQL, giữ SQL Server làm tùy chọn |
| Bảng và quan hệ | Entity JPA; `ddl-auto: update` | Giữ nguyên; kiểm chứng tạo schema từ DB rỗng bằng Hibernate |
| Computed columns | `Invoice` và `InvoiceItem` đã có `@GeneratedColumn` | Kiểm chứng `GENERATED ... STORED` và tính lại khi INSERT/UPDATE trên PostgreSQL |
| JSON | Audit, report và AI log đã có `@JdbcTypeCode(SqlTypes.JSON)` | Kiểm chứng cột `jsonb`, đọc/ghi JSON và từ chối dữ liệu JSON không hợp lệ |
| CHECK nghiệp vụ | Entity chưa khai báo CHECK trạng thái/level/method có trong schema SQL Server | Thêm 25 CHECK portable vào 21 Entity bằng annotation Hibernate; JSON dùng type native |
| P2/P3/P4 | Đã có PL/pgSQL, message và constraint name; provider tự chọn theo metadata | Giữ message; không cho khởi động thành công khi cài trigger bắt buộc thất bại |
| Partial index | Có `uq_enrollment_active`, `uq_waitlist_active`; username index chưa có predicate | Kiểm chứng điều kiện/tính duy nhất và bổ sung phone index theo schema chuẩn |
| Supabase security | Chưa có SSL/pool cấu hình riêng, RLS chưa được xử lý | Profile bắt buộc env credentials, SSL; session pooler, Hikari pool nhỏ; bật RLS trên các bảng ứng dụng với quyền Data API mặc định bị chặn |
| Windows runner | Luôn thêm `local`, luôn gọi `init-db.ps1` SQL Server | Chọn luồng theo profile/JDBC URL; không thêm `local` vào Supabase; không gọi T-SQL cho PostgreSQL |
| Kiểm thử | Trigger tests chỉ dò chuỗi/mock JDBC | Thêm kiểm thử DB thật cho trigger, partial indexes, generated columns, JSON và RLS; smoke test HTTP API đang tồn tại |
| Guard schema | `CodeFirstSchemaTest` đọc `../../databaseschema.sql` | Đọc `../../db/databaseschema.sql`, không skip âm thầm khi thiếu file |

Baseline: `apps/api/mvnw.cmd test -q` trả exit code 0; Surefire có 161 test, 0 failure, 0 error, 2 skipped (hai trường hợp đối chiếu bảng của `CodeFirstSchemaTest`). Máy hiện tại không phát hiện Docker/psql/PostgreSQL service; kiểm chứng DB thật cần endpoint test do người dùng cung cấp hoặc PostgreSQL local được chuẩn bị riêng.

## Thiết kế được đề xuất

1. `application-supabase.yml` kích hoạt cấu hình PostgreSQL, không dùng profile `local`. URL, username và password không có giá trị mặc định. JDBC SSL được áp qua datasource properties; tài liệu cung cấp lựa chọn verify-full với CA khi có certificate. Dùng session pooler port 5432 phù hợp backend Spring Boot chạy lâu dài; pool Hikari mặc định nhỏ và có thể chỉnh qua môi trường.
2. Tái sử dụng Entity, PostgreSQL dialect và `PostgreSqlTriggerProvider`. PostgreSQL DDL từ Entity vẫn là nguồn cấu trúc bảng. Trigger/partial index và bảo vệ RLS được cài sau khi Hibernate tạo schema. Thực thi trước seed; lỗi thiếu bảng bắt buộc gây startup failure, không ghi cảnh báo rồi tiếp tục.
3. Chỉ áp RLS lên bảng ứng dụng được map trong JPA; không đụng bảng hệ thống Supabase. Không tạo policy cấp quyền browser: quyền người dùng/role do backend kiểm soát. JDBC deployment role phải là table owner hoặc có quyền bypass RLS, vì JWT hiện tại không phải Supabase JWT. Tài liệu khuyến nghị tắt Data API khi không sử dụng; không tự sửa project cloud khi chưa có kết nối.
4. `.env.example` ghi tên biến cần điền, không chứa mật khẩu hoặc API key. Hướng dẫn chỉ yêu cầu JDBC URL session pooler, DB username/password, JWT secret; anon/service-role key không cần cho JDBC. Giữ `.env` đang có nguyên vẹn đến khi người dùng điền cấu hình mới.
5. Script khởi động phát hiện provider, kiểm tra biến thiếu trước khi chạy. PostgreSQL không cần script tạo database bằng T-SQL: Supabase đã cấp database `postgres`, Hibernate tạo bảng khi API chạy.

## Kiểm chứng và giới hạn

- Test offline: schema chuẩn được đối chiếu trên SQL Server và PostgreSQL; xác nhận generated DDL và jsonb; startup provider không bỏ qua lỗi.
- Test PostgreSQL thật: schema test biệt lập, tạo bằng Hibernate; P2 vượt capacity và tranh slot cuối, P3 trùng coach/room và ca nối tiếp hợp lệ, P4 subscription active/hết hạn/tương lai; thông điệp lỗi và rollback được giữ; index cho phép lịch sử cancelled và chặn duplicate active.
- Kiểm chứng tài chính: DB tự tính tổng tiền, cập nhật lại generated column; JSON đúng kiểu.
- RLS: đọc từ role chịu RLS không thấy dữ liệu; bảng vẫn truy cập được bằng JDBC role phù hợp.
- Smoke HTTP: health, login, catalog và các API finance hiện có theo hợp đồng hiện tại; không coi API chưa triển khai là đã kiểm thử.
- Không dùng H2 hoặc mock làm bằng chứng PostgreSQL thật. Khi chưa có DB test, báo rõ integration test chưa chạy; SCRUM-91 chưa được nghiệm thu đầy đủ.

## File dự kiến thay đổi

- `apps/api/src/main/resources/application*.yml`, `.env.example`.
- `apps/api/src/main/java/com/swp391/scms/config/DatabaseTriggerInitializer.java`, `config/trigger/PostgreSqlTriggerProvider.java`.
- `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql`; bổ sung bảo vệ RLS PostgreSQL qua infrastructure hiện có khi cần.
- `apps/api/src/test/java/com/swp391/scms/config/CodeFirstSchemaTest.java`, `config/trigger/TriggerProvidersTest.java`; test DB thật mới trong `config`.
- Các Entity có CHECK nghiệp vụ trong schema tham chiếu: khai báo annotation portable, không sửa hành vi service/controller.
- `scripts/run-local.ps1`, `scripts/init-db.ps1` (guard chống chạy sai engine), hướng dẫn chạy/test.
- `README.md`, `docs/LOCAL_DEV_GUIDE.md`, `docs/plans/AGILE_SCRUM_JIRA_PLAN.md`; không đổi public API.

## Nguồn kỹ thuật

- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot
- https://supabase.com/docs/guides/database/secure-data
- https://jdbc.postgresql.org/documentation/ssl/

Thông tin chính thức đã được đối chiếu ngày 08/10/2026.
