---
name: scms-development
description: Quy trình thực hiện task/ticket chuẩn mực trong dự án SCMS, bắt buộc đọc rules, xác định squad owner và tuân thủ bất biến kiến trúc
---

# Quy trình phát triển tính năng & Tuân thủ Rules dự án SCMS

Tất cả AI Agent hoặc lập trình viên khi bắt đầu một tác vụ mới, sửa lỗi, hay triển khai ticket BẮT BUỘC phải thực hiện tuần tự theo quy trình 6 bước dưới đây.

---

## Bước 1: Đọc và nắm vững bộ Rules dự án (BẮT BUỘC)
Trước khi đọc hay sửa bất kỳ dòng code nào, Agent PHẢI dùng công cụ `view_file` để đọc tối thiểu các tài liệu sau:
1. `AGENTS.md` (tại thư mục gốc): Nguồn chân lý về kiến trúc chung, bất biến dữ liệu, và phạm vi MVP.
2. `docs/rules/backend-architecture.md`: Quy định kiến trúc 3 lớp, SOLID, IoC, Code-First & ORM Polymorphism, Trigger Strategy, và quy tắc đa ngôn ngữ (i18n).
3. `.agents/rules/mandatory-rules.md`: Bảng quy tắc bắt buộc về phân quyền squad và cấm hard-code chuỗi.
4. `.agents/rules/ponytail.md`: Quy tắc tối giản hóa mã nguồn (Ponytail - Lazy Senior Dev Mode), chống over-engineering.
5. `docs/PROJECT_MASTER_GUIDE.md`: Xem phần nghiệp vụ tương ứng với ticket cần làm.
6. `docs/plans/AGILE_SCRUM_JIRA_PLAN.md`: Tra cứu Jira key, acceptance criteria, và người phụ trách.

---

## Bước 2: Xác định Squad Boundary & Quyền hạn phân hệ
Kiểm tra xem ticket thuộc về ai. **TUYỆT ĐỐI KHÔNG code vào phân hệ của người khác**:
- **Phong**: Phân hệ Finance (`payments`, `invoices`, computed columns), AI Services, Core Architecture (Hạ tầng Trigger Strategy, Global Exception, i18n, Common Auth).
- **Tài**: Phân hệ Identity & Access Management (User Management, RBAC, Roles, Permissions, User Profile).
- **An**: Phân hệ Core Operations (Classes, Schedules, Enrollments, Check-in, Facilities, Subscriptions).

Nếu người dùng yêu cầu làm ticket thuộc phân hệ của người khác, phải thông báo rõ và yêu cầu xác nhận trước khi can thiệp.

---

## Bước 3: Thiết kế tuân thủ bất biến kiến trúc & Ponytail Ladder
Trước khi viết mã triển khai:
1. **Áp dụng các bậc thang Ponytail (The Ladder):**
   - **YAGNI (Cần thiết thực sự?):** Không viết tính năng để "phòng xa" nếu ticket không yêu cầu.
   - **Tái sử dụng (Reuse first):** Kiểm tra xem codebase đã có helper, mapper, entity, component nào tương tự chưa; tái sử dụng thay vì viết mới.
   - **Standard Library & Built-in:** Tận dụng thư viện chuẩn của Java/Spring/Web, không thêm dependency mới khi vài dòng code built-in có thể giải quyết.
   - **Diff ngắn nhất hoạt động an toàn:** Ưu tiên xóa bớt hơn là thêm mới (Deletion over addition). Đơn giản, rõ ràng, ít file nhất có thể.
2. **Code-First & ORM Polymorphism:**
   - Mọi bảng, cột, kiểu dữ liệu, ràng buộc quan hệ PHẢI định nghĩa bằng Java JPA Entity trong `apps/api`.
   - CSDL do Hibernate tự động đồng bộ (`ddl-auto: update`), không viết file DDL migration thủ công riêng biệt.
3. **Trigger đa hình (DatabaseTriggerProvider Strategy):**
   - Database triển khai duy nhất là Supabase PostgreSQL, profile `supabase`, JDBC qua TLS và credentials từ môi trường.
   - Giữ SPI `DatabaseTriggerProvider`; cập nhật `db/triggers/postgresql-triggers.sql` qua `PostgreSqlTriggerProvider` sau Hibernate. Không thêm adapter, driver hoặc profile database thay thế.
   - Kiểm thử DB thật trên Supabase dev/test trong schema biệt lập. Không dùng các script SQL lịch sử để bootstrap hoặc nâng cấp; không thêm migration DDL thủ công mới.
   - Khi thêm quan hệ hoặc cột bắt buộc vào bảng có dữ liệu, xử lý backfill có căn cứ và bổ sung test nâng cấp trước khi yêu cầu merge.
4. **Đa ngôn ngữ (i18n) - CẤM HARD-CODE STRING:**
   - Mọi câu thông báo response API, exception message, validation message PHẢI dùng mã khóa (message key).
   - Khai báo đồng thời vào cả 3 file:
     + `apps/api/src/main/resources/i18n/messages_vi.properties`
     + `apps/api/src/main/resources/i18n/messages_en.properties`
     + `apps/api/src/main/resources/i18n/messages.properties`
   - Đặt message validation trong DTO dạng `@NotNull(message = "{validation.feature.field.not_null}")`.

---

## Bước 4: Triển khai mã nguồn (Implementation)
1. **Tổ chức Package-by-Feature:**
   - Đặt controller, service, repository, entity, dto, mapper trong cùng package tính năng (ví dụ `com.swp391.scms.finance`).
2. **Nguyên tắc 3 lớp & SOLID:**
   - Controller: Chỉ làm nhiệm vụ tiếp nhận HTTP request, validate DTO, gọi Service và trả về `ApiResponse<T>`. Controller inject `MessageService` kèm constructor chaining null-safe:
     ```java
     public FeatureController(FeatureService service) {
         this(service, null);
     }
     public FeatureController(FeatureService service, MessageService messageService) { ... }
     ```
   - Service: Chứa toàn bộ nghiệp vụ, quản lý `@Transactional`, ném các lớp con của `AppException` kèm `(errorCode, messageKey, messageArgs, fallbackMessage)`. Không trả Entity trực tiếp ra Controller mà qua DTO.
   - Repository: Chỉ phụ trách truy vấn dữ liệu từ CSDL.
3. **Xử lý ngoại lệ:**
   - Dùng `BadRequestException`, `ConflictException`, `ResourceNotFoundException`, `ForbiddenException`, `UnauthorizedException`.
   - `GlobalExceptionHandler` sẽ tự động dịch messageKey theo locale của request.

---

## Bước 5: Kiểm thử tự động & Xác minh (Verification)
1. Viết unit test cho Controller và Service tương ứng trong `src/test/java`.
2. Chạy toàn bộ test backend:
   ```bash
   ./mvnw test
   ```
   **BẮT BUỘC 100% tests phải pass.** Nếu có bất kỳ test nào fail, phải debug và sửa chữa triệt để trước khi tiếp tục.

---

## Bước 6: Cập nhật Knowledge Graph & Hoàn tất Commit
1. Cập nhật knowledge graph kiến trúc:
   ```bash
   graphify update .
   ```
2. Kiểm tra `git status` và `git diff` để đảm bảo không có file lạ hoặc vô tình sửa code ngoài phạm vi phụ trách.
3. Commit với Jira key rõ ràng theo Conventional Commits:
   ```bash
   git commit -m "feat(module): implement [JIRA-KEY] short description"
   ```
