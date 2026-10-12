# Chạy SCMS trên Supabase PostgreSQL — SCRUM-91

Backend truy cập PostgreSQL bằng JDBC. React tiếp tục gọi Spring Boot và dùng JWT hiện có. Không cần `NEXT_PUBLIC_SUPABASE_URL`, publishable/anon key hoặc service-role key cho cách kết nối này.

## Lấy thông tin kết nối

1. Mở project Supabase, chọn **Connect → Session pooler**. Copy đúng host, port, database và username của project; không tự đoán vùng triển khai từ project URL.
2. Database password là mật khẩu PostgreSQL của project, khác publishable/API key. Nếu quên, đặt lại tại **Project Settings → Database**.
3. Trong `.env` ở root, thay các biến kết nối SQL Server cũ bằng:

```dotenv
SPRING_PROFILES_ACTIVE=supabase
SPRING_DATASOURCE_URL=jdbc:postgresql://<SESSION_POOLER_HOST>:5432/postgres
SPRING_DATASOURCE_USERNAME=postgres.<PROJECT_REF>
SPRING_DATASOURCE_PASSWORD=<DATABASE_PASSWORD>
APP_JWT_SECRET=<BASE64_RANDOM_SECRET_AT_LEAST_32_BYTES>
DB_SSL_MODE=require
DB_POOL_MAX_SIZE=5
DB_POOL_MIN_IDLE=1
SPRING_JPA_HIBERNATE_DDL_AUTO=update
```

Các giá trị trong dấu `<...>` phải được thay bằng cấu hình thật. Không đưa password vào JDBC URL; không commit `.env`. Username thực tế phải lấy từ Connect, có thể khác ví dụ. Không kết hợp profile `supabase` với `local` hoặc `sqlserver`.

Tạo JWT secret ngẫu nhiên trên Windows (chỉ in secret vào terminal của bạn, không đưa vào log/chats):

```powershell
$jwtBytes = New-Object byte[] 32
$jwtRng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $jwtRng.GetBytes($jwtBytes) } finally { $jwtRng.Dispose() }
[Convert]::ToBase64String($jwtBytes)
```

## SSL, pooler và Data API

- Session pooler port 5432 phù hợp backend Spring Boot chạy lâu dài và hỗ trợ kết nối IPv4. Profile giới hạn Hikari pool 5 connection mặc định.
- `sslmode=require` bắt buộc mã hóa kết nối nhưng không xác minh danh tính server. Để xác minh đầy đủ, tải CA certificate từ Supabase và đặt `DB_SSL_MODE=verify-full`, `DB_SSL_ROOT_CERT=C:/certs/prod-supabase.cer`. File CA phải tồn tại trên máy chạy backend.
- Profile tắt server-side prepared statement (`prepareThreshold=0`) để tương thích cả transaction pooler khi cần; vẫn ưu tiên session pooler. Không dùng transaction pooler cho các thao tác cần session state/schema test.
- **Tắt Data API trong Supabase trước lần khởi động schema đầu tiên**, vì SCMS chỉ truy cập qua backend. Hibernate tạo bảng trước bước RLS nên tắt Data API giúp tránh cửa sổ truy cập trong lúc bootstrap. Nếu vẫn bật Data API, cần review exposed schemas, table grants, views/functions và các policy hiện có.
- Khi khởi động với `supabase`, hệ thống bật RLS trên các bảng JPA và bảng nối (bao gồm `role_permissions`). Không tạo policy cho client truy cập trực tiếp. Database role backend phải own bảng hoặc có `BYPASSRLS`; hệ thống kiểm tra quyền trước khi bật RLS. Không tự sửa bảng hệ thống `auth`, `storage` của Supabase.
- Với schema mới, RLS không có policy sẽ chặn truy cập dữ liệu bằng các role Data API chịu RLS. Nếu database đã có policy, initializer không xóa chúng: cần review riêng vì policy cũ vẫn có thể cấp quyền. Giữ phân quyền/soft-delete ở backend như hiện tại.

## Khởi động

```powershell
npm start
```

Runner đọc `.env`, chọn PostgreSQL, không gọi script SQL Server. Hibernate tạo bảng, generated column/JSON; trigger P2/P3/P4 và partial indexes được cài trước seed. Thiếu cấu hình hoặc không cài được trigger bắt buộc sẽ báo lỗi khởi động.

`npm run db:init` trên PostgreSQL chỉ hướng dẫn khởi động API, không chạy T-SQL. Không dùng `db:init:force` cho Supabase.

Trên DB rỗng, có thể tạo manager ban đầu bằng hai biến `APP_BOOTSTRAP_MANAGER_EMAIL` và `APP_BOOTSTRAP_MANAGER_PASSWORD`. Không có mật khẩu manager mặc định khi dùng Supabase. Sau khi tạo manager, bỏ hai biến bootstrap và dùng chức năng quản lý user của hệ thống.

Không cần copy dữ liệu demo từ SQL Server. Database SQL Server cũ không bị xóa hoặc chỉnh sửa bởi bước chuyển này.

## Kiểm thử trên PostgreSQL thật

Dùng test database riêng hoặc project Supabase dành cho dev; role cần quyền tạo schema. Test dùng schema ngẫu nhiên `scrum91_test_<uuid>`, tạo bảng bằng Hibernate và chỉ xóa schema này khi kết thúc; không reset `public`.

Điền trong `.env`:

```dotenv
SCMS_POSTGRES_TEST_URL=jdbc:postgresql://<TEST_SESSION_POOLER_HOST>:5432/postgres?sslmode=require
SCMS_POSTGRES_TEST_USERNAME=<TEST_DB_USERNAME>
SCMS_POSTGRES_TEST_PASSWORD=<TEST_DB_PASSWORD>
```

Nạp **chỉ các biến test** rồi chạy Maven:

```powershell
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*(SCMS_POSTGRES_TEST_(URL|USERNAME|PASSWORD))\s*=(.*)$') {
        [Environment]::SetEnvironmentVariable($Matches[1], $Matches[3].Trim(), 'Process')
    }
}
Push-Location apps/api
try { .\mvnw.cmd '-Dtest=PostgreSqlDatabaseIntegrationTest' test } finally { Pop-Location }
```

Test kiểm chứng P2/P3/P4 trên DB thật, booking đồng thời, partial index, generated columns, CHECK constraint, `jsonb`, cài RLS và HTTP smoke qua MockMvc với Spring Security/JPA thật. Smoke bao gồm health, login, catalog, tạo/đọc payment và phát hành/đọc invoice; không tuyên bố kiểm chứng API booking/check-in chưa có controller trong codebase.

Thiếu `SCMS_POSTGRES_TEST_URL` thì cả lớp integration test **skipped**, không tính là PostgreSQL đã được nghiệm thu. Nếu bị ngắt giữa chừng có thể còn schema test; chỉ xóa schema có tên do lần chạy đó tạo, không xóa schema ứng dụng.

Test không cần Supabase API key. RLS test kiểm tra cờ bảo vệ, quyền đọc của JDBC owner và từ chối role `anon` hoặc `pg_read_all_data` nếu test role được phép `SET ROLE`; trường hợp không đủ quyền này được ghi skipped riêng. Để kiểm chứng end-to-end Data API còn cần xác nhận setting/policy Supabase thật. Không tuyên bố cloud an toàn chỉ từ unit test.

Entity nay khai báo các CHECK portable từ schema chuẩn. `ddl-auto: update` không bảo đảm thêm tất cả CHECK vào bảng đã tồn tại; nghiệm thu SCRUM-91 cần chạy trên database/schema rỗng như đã chốt.

## Nguồn

- [Supabase: kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Spring Boot](https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot)
- [Supabase: bảo vệ dữ liệu](https://supabase.com/docs/guides/database/secure-data)
- [pgJDBC: SSL và certificate verification](https://jdbc.postgresql.org/documentation/ssl/)
