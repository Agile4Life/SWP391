# Hướng dẫn cho contributor và coding agent

Quy tắc chi tiết về kiến trúc backend, ba lớp, SOLID, IoC, JPA và Supabase PostgreSQL nằm tại `docs/rules/backend-architecture.md`; mọi contributor và agent làm backend phải tuân theo cả hai tài liệu.

## Bối cảnh

- Nguồn nghiệp vụ: `docs/PROJECT_MASTER_GUIDE.md`; schema triển khai được định nghĩa bằng JPA Entity, `db/databaseschema.sql` chỉ là tham chiếu cấu trúc lịch sử; backlog: `docs/plans/AGILE_SCRUM_JIRA_PLAN.md`.
- Stack cố định: React + TypeScript ở `apps/web`, Java 21 + Spring Boot 3 ở `apps/api`, database Supabase PostgreSQL.
- Mọi môi trường chạy API dùng profile `supabase`, JDBC PostgreSQL qua TLS và thông tin kết nối từ biến môi trường. Không thêm lại database/profile/driver SQL Server, H2 hoặc MySQL. Test DB thật dùng project Supabase dành cho dev/test và schema biệt lập.

## Cách làm một ticket

1. Xác định Jira key, owner màn hình và acceptance criteria trong backlog.
2. Nếu đổi API, cập nhật OpenAPI ở `docs/api-contracts/` trước hoặc cùng PR.
3. Backend: giữ package-by-feature, dùng DTO, validation, service transaction và global error handler. Không trả entity trực tiếp. Bắt buộc bổ sung message key i18n (`messages_vi.properties`, `messages_en.properties`) cho thông báo thành công hoặc lỗi mới.
4. Frontend: đặt UI trong `features/<feature>`, page chỉ compose feature; luôn có loading, empty và error state.
5. Chạy test/lint phù hợp trước khi mở PR và ghi Jira key trong mô tả PR.

## Bất biến nghiệp vụ và kiến trúc dữ liệu

- **Code-First & ORM Polymorphism bắt buộc:** Toàn bộ bảng, cột, khóa và quan hệ định nghĩa qua Java Entity; chuyển đổi CSDL không viết lại DDL thủ công mà dùng Hibernate ORM đẩy thẳng (`ddl-auto: update`).
- **Trigger đa hình:** Các trigger nghiệp vụ bắt buộc (capacity, trùng lịch) được nạp tự động qua `DatabaseTriggerProvider` và `PostgreSqlTriggerProvider` sau Hibernate. Chỉ hỗ trợ Supabase PostgreSQL; không tạo adapter cho database khác.
- **CI bắt buộc:** `DatabasePolicyTest`, `DatabaseProfilesTest` và `scripts/test-database-config.ps1` kiểm tra chính sách database. `db/databaseschema.sql` và ba migration V1–V3 là tài liệu lịch sử; không sửa hoặc chạy chúng để triển khai, không thêm migration DDL mới.
- **Đa ngôn ngữ (i18n bắt buộc):** Hệ thống hỗ trợ đa ngôn ngữ qua `Accept-Language` (mặc định `vi`). Bất kỳ tính năng backend mới nào khi thêm thông báo/mã lỗi bắt buộc phải cập nhật đồng thời cả `i18n/messages_vi.properties` và `i18n/messages_en.properties`, dùng `MessageService` để resolve.
- Chỉ Member có subscription `active` và chưa hết hạn được booking/check-in.
- Database trigger kiểm tra capacity và trùng lịch là bắt buộc. Map lỗi SQL đó thành lỗi HTTP dễ hiểu, không vô hiệu trigger.
- `users.deleted_at IS NOT NULL` không được xác thực hoặc hiện trong list mặc định.
- Backend luôn kiểm tra role; ẩn menu ở frontend không phải là authorization.

## Phạm vi MVP

Không tự thêm mobile native, payment gateway thật, AI provider thật, PDF/export hoặc đổi database nếu ticket không nêu rõ.
