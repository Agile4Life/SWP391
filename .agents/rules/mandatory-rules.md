# Quy tắc bắt buộc cho AI Agent & Contributor trong SCMS

Mọi Agent hoặc lập trình viên khi tham gia phát triển trong dự án này PHẢI đọc và tuân thủ nghiêm ngặt các quy tắc dưới đây trước khi sinh hoặc chỉnh sửa bất kỳ dòng code nào.

## 1. Nguồn chân lý & Tài liệu bắt buộc phải đọc trước khi làm việc
1. `AGENTS.md` (tại thư mục gốc): Nguồn chân lý về quy tắc nghiệp vụ, schema, phân vai và kiến trúc tổng quan.
2. `docs/rules/backend-architecture.md`: Hướng dẫn chi tiết về kiến trúc 3 lớp, SOLID, IoC, Spring Boot 3, JPA Entity và xử lý lỗi.
3. `docs/PROJECT_MASTER_GUIDE.md`: Đặc tả chi tiết từng tính năng, luồng nghiệp vụ và quy tắc vận hành.
4. `docs/plans/AGILE_SCRUM_JIRA_PLAN.md`: Kế hoạch Sprint, danh sách tickets, Jira keys và người phụ trách màn hình/tính năng.

## 2. Phân định quyền hạn & Ranh giới trách nhiệm (Squad Boundaries)
Tuyệt đối KHÔNG can thiệp, tự ý sửa đổi hoặc code vào phân hệ của thành viên khác nếu không được giao rõ ràng:
- **Phong**: Backend Core Architecture, Hạ tầng chung (Exception, i18n, Triggers), Phân hệ Finance (Thanh toán `payments`, Hóa đơn điện tử `invoices`, Computed Columns), AI Services.
- **Tài**: Phân hệ Identity & Access Management (Quản lý User, RBAC, Roles, Permissions, Hồ sơ cá nhân profile).
- **An**: Phân hệ Core Operations & Membership (Lớp học, Lịch tập, Ghi danh enrollment, Điểm danh check-in, Thiết bị facility, Gói tập subscription).

## 3. Các bất biến kiến trúc cốt lõi (Core Invariants)
- **Database duy nhất — Supabase PostgreSQL:** Dùng profile `supabase`, JDBC qua TLS và credentials từ môi trường trong mọi môi trường chạy API. Không thêm lại database/driver/profile SQL Server, H2 hoặc MySQL. Test DB thật chạy trong schema biệt lập trên Supabase dev/test.
- **Code-First & ORM Polymorphism:** Toàn bộ bảng, cột, khóa chính, khóa ngoại, computed column và quan hệ dữ liệu BẮT BUỘC định nghĩa qua Java JPA Entity. Khi đổi CSDL không viết lại file DDL thủ công mà Hibernate ORM đẩy thẳng (`ddl-auto: update`).
- **Database Trigger đa hình qua Strategy:** Các trigger nghiệp vụ bắt buộc (sức chứa capacity, trùng lịch coach/room, kiểm tra gói tập active) được nạp tự động qua SPI `DatabaseTriggerProvider` và `PostgreSqlTriggerProvider` sau Hibernate. Không khôi phục các adapter database đã ngừng hỗ trợ.
- **Đa ngôn ngữ (i18n bắt buộc - Cấm Hard-code Strings):**
  - Mọi thông báo thành công (API response message), thông điệp lỗi (exception message), và ràng buộc kiểm tra dữ liệu đầu vào (Bean Validation message) BẮT BUỘC sử dụng message keys thông qua `MessageService`.
  - Tuyệt đối KHÔNG viết chuỗi tiếng Việt hoặc tiếng Anh trực tiếp trong controller, service, dto.
  - Khi thêm mới bất kỳ message key nào, BẮT BUỘC cập nhật đồng thời cả 3 file:
    + `apps/api/src/main/resources/i18n/messages_vi.properties` (Tiếng Việt - Mặc định)
    + `apps/api/src/main/resources/i18n/messages_en.properties` (English)
    + `apps/api/src/main/resources/i18n/messages.properties` (Fallback)
- **Kiến trúc Exception chuẩn hóa:**
  - Kế thừa từ `AppException`. Sử dụng các exception tương ứng: `BadRequestException` (400), `UnauthorizedException` (401), `ForbiddenException` (403), `ResourceNotFoundException` (404), `ConflictException` (409), `TooManyRequestsException` (429), `ServiceUnavailableException` (503).
  - Luôn truyền `errorCode`, `messageKey`, `messageArgs` và `fallbackMessage` vào constructor exception để `GlobalExceptionHandler` tự động phân giải i18n theo request locale.
- **Tương thích Null-Safe cho Standalone Unit Tests:**
  - Controllers và Services khi inject `MessageService` BẮT BUỘC hỗ trợ constructor chaining hoặc null-check fallback (`if (messageService != null) ... else return fallbackMessage`) để không làm gãy các bộ unit test dùng `MockMvcBuilders.standaloneSetup`.
- **An ninh & Phân quyền:**
  - Backend luôn kiểm tra Role/Authority qua Spring Security; ẩn nút bấm ở frontend không phải là bảo mật.
  - `users.deleted_at IS NOT NULL` không được phép đăng nhập hoặc xuất hiện trong danh sách dữ liệu hoạt động.

## 4. Ponytail - Triết lý tối giản hóa code & Chống over-engineering (YAGNI)
- **YAGNI (You Aren't Gonna Need It):** Không viết code, abstraction (interface 1 impl, factory 1 product) hay cấu hình cho những thứ chưa được yêu cầu trong ticket.
- **Tái sử dụng trước khi tạo mới (Reuse First):** Tìm kiếm và dùng lại helper, mapper, entity, component có sẵn trong dự án.
- **Tận dụng Standard Library & Built-in:** Dùng thư viện chuẩn của Java/Spring/Web thay vì cài thêm thư viện bên ngoài.
- **Diff ngắn nhất - Xóa hơn là thêm (Deletion over Addition):** Mã nguồn ít nhất mà vẫn chạy đúng và an toàn luôn là lựa chọn tối ưu.
- **Sửa lỗi tận gốc (Root Cause):** Khi fix bug, grep mọi nơi gọi hàm đó để sửa 1 lần tại gốc rễ, không vá chắp vá ở từng caller riêng lẻ.

## 5. Quy trình kiểm thử và hoàn thiện (Verification)
- Trước khi tuyên bố hoàn thành hoặc push code, BẮT BUỘC chạy `./mvnw test` (backend) và `npm run build` / lint (frontend) để đảm bảo 100% tests pass.
- Chạy `graphify update .` sau khi thay đổi mã nguồn để đồng bộ knowledge graph kiến trúc.
