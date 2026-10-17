---
name: scms-development
description: Use when implementing or reviewing a Sports Center Management System ticket in this repository with React, Spring Boot, Supabase PostgreSQL, Hibernate Code-First, and Jira.
---

# SCMS development

## 1. Bắt buộc đọc Rules & Tài liệu trước khi làm việc
Trước khi sửa hoặc thêm bất kỳ dòng code nào, Agent PHẢI đọc:
1. `AGENTS.md` (root): Quy tắc bất biến dữ liệu, trigger, bảo mật và phạm vi MVP.
2. `docs/rules/backend-architecture.md`: Kiến trúc 3 lớp, SOLID, IoC, Code-First & ORM Polymorphism, và chuẩn i18n.
3. `.agents/rules/mandatory-rules.md`: Bảng quy tắc bắt buộc về phân định squad và cấm hard-code.
4. `.agents/workflows/scms-development.md`: Quy trình 6 bước chuẩn mực để triển khai ticket.
5. `docs/plans/AGILE_SCRUM_JIRA_PLAN.md` & `docs/PROJECT_MASTER_GUIDE.md`: Xem Jira key, Acceptance Criteria và luồng nghiệp vụ.

## 2. Squad Boundaries (Ranh giới trách nhiệm)
- **Phong**: Backend Core Architecture, Hạ tầng Trigger Strategy, Global Exception, i18n, Phân hệ Finance (`payments`, `invoices`, computed columns), AI Services.
- **Tài**: Phân hệ Identity & Access Management (User Management, RBAC, Roles, Permissions, User Profile).
- **An**: Phân hệ Core Operations (Classes, Schedules, Enrollments, Check-in, Facilities, Subscriptions).
- **Tuyệt đối không can thiệp code vào phân hệ của người khác.**

## 3. Bất biến kiến trúc bắt buộc (Architectural Invariants)
- **Code-First & ORM Polymorphism:** Toàn bộ bảng, cột, quan hệ định nghĩa qua Java JPA Entity; Hibernate ORM đẩy thẳng (`ddl-auto: update`), không tạo file DDL thủ công.
- **Database duy nhất:** Dùng Supabase PostgreSQL với profile `supabase` cho cả chạy ứng dụng và kiểm thử DB thật. Kết nối JDBC qua TLS, lấy credentials từ môi trường; unit test dùng mock. Không thêm database/driver/profile thay thế.
- **Trigger đa hình:** Giữ SPI `DatabaseTriggerProvider`; triển khai đang hỗ trợ là `PostgreSqlTriggerProvider`, tự nạp `db/triggers/postgresql-triggers.sql` sau Hibernate. Không khôi phục adapter database cũ.
- **Nâng cấp schema:** Entity là nguồn định nghĩa schema. Với cột/quan hệ mới trên bảng có dữ liệu, phải xử lý dữ liệu cũ và kiểm thử nâng cấp; không tự gán buổi học hoặc bản ghi quan hệ tùy ý. Các file SQL lịch sử trong `db/` không phải script triển khai.
- **Đa ngôn ngữ (i18n bắt buộc):** Mọi response API message, exception message, validation message PHẢI dùng message key qua `MessageService`. Cấm tuyệt đối hard-code chuỗi tiếng Việt/tiếng Anh. Bắt buộc cập nhật đồng thời cả 3 file:
  + `apps/api/src/main/resources/i18n/messages_vi.properties`
  + `apps/api/src/main/resources/i18n/messages_en.properties`
  + `apps/api/src/main/resources/i18n/messages.properties`
- **Tương thích Standalone Unit Tests:** Controllers & Services khi inject `MessageService` luôn dùng constructor chaining null-safe để không làm gãy các test standalone.

## 4. Routing & Implementation
- **Backend (`apps/api`):** Tổ chức package-by-feature; DTOs ở ranh giới; Service quản lý transaction và ném `AppException` con kèm `(errorCode, messageKey, messageArgs, fallbackMessage)`; Controller chỉ điều phối và trả về `ApiResponse<T>`.
- **Frontend (`apps/web`):** Đặt UI trong `src/features/<feature>`; page chỉ compose feature; luôn có trạng thái loading, empty, error và forbidden.
- **Verification:** Chạy `./mvnw test` (bao gồm `DatabasePolicyTest` và `DatabaseProfilesTest`) và `scripts/test-database-config.ps1`. Test Supabase thật cần `SCMS_POSTGRES_TEST_*`; nếu skipped thì ghi rõ chưa kiểm chứng DB thật. Cập nhật `graphify update .` sau thay đổi kiến trúc trước khi commit.
