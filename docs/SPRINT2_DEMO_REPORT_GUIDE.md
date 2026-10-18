# HƯỚNG DẪN BÁO CÁO & DEMO SPRINT 2 — CHO TỪNG THÀNH VIÊN
# Sports Center Management System (SWP391 — GROUP 1)

> **Mục tiêu Sprint 2:** Hoàn thiện trọn vẹn luồng nghiệp vụ kinh doanh cốt lõi (**Core Business Flow**):
> **Hội viên mua/gia hạn gói tập → Thanh toán (Online / POS tại quầy) & Tự động xuất Hóa đơn điện tử → Xem thời khóa biểu & Đặt chỗ lớp học / Hàng chờ thông minh (Waitlist) → Sinh thẻ hội viên số & Quét mã QR Check-in qua cổng → Báo cáo doanh thu & Hỗ trợ hội viên**, đồng thời hoàn tất chuyển đổi CSDL sang **Supabase PostgreSQL (Hibernate Code-First + PL/pgSQL Triggers P2/P3/P4 + RLS)**.

---

## PHẦN 1: CHUẨN BỊ CHUNG TRƯỚC GIỜ BÁO CÁO (CẢ NHÓM)

### 1.1. Số liệu tổng kết Sprint 2 (Trưởng nhóm đọc mở đầu 1 phút)
- **Tổng số Jira Tickets hoàn thành:** **24 Tickets / 98 Story Points** (`SCRUM-66` → `SCRUM-88` và `SCRUM-91`).
- **Kiến trúc & Công nghệ:**
  - **Backend (`apps/api`):** Java 21, Spring Boot 3, Spring Security JWT + `@PreAuthorize`, Hibernate Code-First ORM, đa ngôn ngữ i18n (`vi`/`en` qua `Accept-Language`).
  - **Database:** Supabase PostgreSQL qua TLS Pooler, bật RLS trên toàn bộ 34 bảng, cài đặt tự động Triggers PL/pgSQL (`P2` kiểm tra sĩ số lớp, `P3` chống trùng lịch phòng/HLV, `P4` kiểm tra hạn thẻ khi đặt lớp & check-in), Computed Columns (`GENERATED ALWAYS AS ... STORED`) và Partial Unique Indexes.
  - **Frontend (`apps/web`):** React + TypeScript + Vite, phong cách thiết kế *Quiet Luxury Editorial*, tách biệt `features/<feature>`, đầy đủ 4 trạng thái UI (`Loading`, `Empty`, `Error + Retry`, `403 Forbidden Guard`).
- **Kết quả Kiểm thử tự động (Automated Testing):**
  - **Backend:** `358 / 358` Unit & Integration Tests **PASS** (`.\mvnw.cmd test`).
  - **Database Policy:** `10 / 10` kiểm tra cấu hình Supabase PostgreSQL **PASS** (`.\scripts\test-database-config.ps1`).
  - **Frontend:** `19 / 19` Test Suites (`104 / 104` tests) **PASS** (`npm test`), `npm run lint` (`0` warnings/errors), `npm run build` **PASS**.

### 1.2. Lệnh khởi chạy hệ thống trước buổi báo cáo 15 phút
```powershell
# 1. Khởi chạy đồng thời Backend (port 8080) và Frontend (port 5173)
npm start

# 2. Mở sẵn các tab trình duyệt để Demo không bị trễ:
# - Web App:     http://localhost:5173
# - Swagger UI:  http://localhost:8080/swagger-ui/index.html
# - Health API:  http://localhost:8080/api/v1/health
```
Nếu giảng viên yêu cầu chạy lại bộ test ngay tại chỗ:
```powershell
# Chạy test Backend
cd apps/api
.\mvnw.cmd test

# Chạy test & lint Frontend
cd ../web
npm run lint
npm test -- --run
```

### 1.3. Thứ tự trình bày nối tiếp giữa 5 thành viên (Kịch bản End-to-End 15–20 phút)
Để buổi báo cáo mạch lạc, nhóm nên đi theo luồng dữ liệu thực tế:
1. **🟠 Phong (Backend Database & Finance — 4 phút):** Giới thiệu nền tảng Supabase PostgreSQL Code-First (`SCRUM-91`, `SCRUM-80`), luồng Thanh toán – Hóa đơn điện tử – Hoàn tiền – Báo cáo doanh thu (`SCRUM-76..79`).
2. **🔵 Tài (Backend Identity, Security, Notification & Support — 3.5 phút):** Trình bày phân quyền bảo mật `@PreAuthorize` toàn Sprint 2 (`SCRUM-69`), mở rộng hồ sơ HLV/Lễ tân (`SCRUM-66`), hệ thống Thông báo In-App (`SCRUM-67`), Phiếu hỗ trợ (`SCRUM-68`) và Unit Tests (`SCRUM-70`).
3. **🟢 An (Backend Membership, Scheduling, Waitlist & Check-in — 4 phút):** Trình bày API Gói tập & sinh mã QR (`SCRUM-71`), Xếp lịch lớp & Trigger P3 chống trùng lịch (`SCRUM-72`), Đặt lớp/Hàng chờ & Trigger P2/P4 (`SCRUM-73, 74`), Quét QR Check-in cổng (`SCRUM-75`).
4. **🟡 Thịnh (Frontend Member Portal — 4 phút):** Demo trực tiếp trên giao diện Hội viên: Trang tổng quan (`SCRUM-85`) → Mua/Gia hạn gói tập online (`SCRUM-86`) → Thẻ hội viên điện tử & tải mã QR (`SCRUM-87`) → Đặt lịch học & vào hàng chờ Waitlist (`SCRUM-88`).
5. **🟣 Khoa (Frontend Staff & Manager Console — 4 phút):** Demo trực tiếp trên giao diện Nhân viên & Quản lý: Quản lý lớp học & xếp lịch HLV (`SCRUM-81`) → Quầy Lễ tân POS tra cứu & thu tiền xuất hóa đơn (`SCRUM-82`) → Quét mã QR Check-in sảnh (`SCRUM-83`) → Báo cáo doanh thu trung tâm (`SCRUM-84`).

---

## PHẦN 2: HƯỚNG DẪN CHI TIẾT CHO TỪNG THÀNH VIÊN

---

### 🔵 THÀNH VIÊN 1: TÀI — Backend (Identity, Notification, Support & Security)
**Tổng điểm phụ trách:** `19 Story Points` (`SCRUM-66`, `SCRUM-67`, `SCRUM-68`, `SCRUM-69`, `SCRUM-70`)

#### 1. Danh mục Ticket & File Code cần mở sẵn trên IDE
| Mã Jira | Tên chức năng | Endpoint chính | File Code cần mở sẵn |
|---|---|---|---|
| **SCRUM-66** | Hồ sơ chuyên biệt Coach & Receptionist (TPT) | `PUT /api/v1/profile/coach`<br>`PUT /api/v1/profile/receptionist`<br>`PUT /api/v1/users/{id}/receptionist` | `users/ProfileController.java`<br>`users/UserController.java`<br>`users/UserService.java`<br>`users/entity/Coach.java`, `Receptionist.java` |
| **SCRUM-67** | Hộp thư Thông báo In-App (Notifications) | `GET /api/v1/notifications`<br>`GET /api/v1/notifications/unread-count`<br>`PATCH /api/v1/notifications/{id}/read`<br>`PATCH /api/v1/notifications/read-all` | `notifications/NotificationController.java`<br>`notifications/NotificationService.java`<br>`notifications/entity/Notification.java` |
| **SCRUM-68** | Quản lý Phiếu hỗ trợ / Khiếu nại (Support) | `POST /api/v1/support/requests` (`201`)<br>`GET /api/v1/support/requests/my`<br>`GET /api/v1/support/requests`<br>`PATCH /api/v1/support/requests/{id}/status` | `support/SupportRequestController.java`<br>`support/SupportRequestService.java`<br>`support/entity/SupportRequest.java` |
| **SCRUM-69** | Chuẩn hóa `@PreAuthorize` & Security Policy | Toàn bộ Controllers Sprint 2 | `security/SecurityConfig.java`<br>`security/JsonAccessDeniedHandler.java`<br>`security/JsonAuthenticationEntryPoint.java` |
| **SCRUM-70** | Unit & Integration Tests + Đa ngôn ngữ i18n | — | `users/ProfileControllerTest.java`<br>`notifications/NotificationServiceTest.java`<br>`support/SupportRequestServiceTest.java`<br>`security/MethodSecurityPolicyTest.java` |

#### 2. Kịch bản trình bày & Demo trước giảng viên (Tài)
1. **Mở đầu (Giới thiệu phạm vi):**
   > *"Em phụ trách 5 ticket (`SCRUM-66` đến `SCRUM-70`, 19 Story Points) gồm: mở rộng hồ sơ chuyên biệt cho HLV và Lễ tân theo mô hình kế thừa Table-per-Type, xây dựng module Thông báo In-App, module Phiếu hỗ trợ (Support Ticket), chuẩn hóa phân quyền bảo mật `@PreAuthorize` cho toàn bộ API Sprint 2 và viết bộ Unit/Policy Test."*
2. **Trình bày `SCRUM-66` (Hồ sơ Coach & Receptionist):**
   - Mở `Coach.java` và `Receptionist.java`: Giải thích thiết kế kế thừa bảng `users` (Table-per-Type / `@MapsId`).
   - Mở `ProfileController.java`:
     - `PUT /api/v1/profile/coach` chỉ cho phép role `COACH` tự cập nhật `specialization`, `bio`, `certification`, `experienceYears`.
     - `PUT /api/v1/profile/receptionist` cho phép `RECEPTIONIST` cập nhật ca trực (`shift`), và `PUT /api/v1/users/{id}/receptionist` cho phép `CENTER_MANAGER` điều phối ca trực cho lễ tân bất kỳ.
     - Kiểm tra chặt chẽ `deletedAt != null` (tài khoản xóa mềm không được thao tác).
3. **Trình bày `SCRUM-67` (Notification Module):**
   - Mở `NotificationService.java`: Chỉ ra hàm `send(...)` để các module khác (Thanh toán, Lớp học, Support) gọi tự động khi phát sinh sự kiện.
   - Mở `NotificationController.java`: Hỗ trợ phân trang, lọc theo trạng thái đã đọc/chưa đọc (`read`), đếm nhanh `unread-count` và đánh dấu đã đọc 1 hoặc toàn bộ thông báo (chỉ chủ sở hữu thông báo mới được đánh dấu).
4. **Trình bày `SCRUM-68` (Support Requests State Machine):**
   - Mở `SupportRequestService.java`: Giải thích vòng đời trạng thái chặt chẽ (`open` → `in_progress` → `resolved` → `closed`). Khi phiếu đã `closed` thì khóa không cho chuyển ngược lại. Khi nhân viên cập nhật trạng thái phiếu, hệ thống tự động gọi `NotificationService.send(...)` để báo cho hội viên.
5. **Trình bày `SCRUM-69` & `SCRUM-70` (Bảo mật 2 lớp & Kiểm thử):**
   - Mở `SecurityConfig.java` và `MethodSecurityPolicyTest.java`: Giải thích bảo mật 2 lớp (URL-level matcher tại `SecurityConfig` + Method-level `@PreAuthorize` tại từng Controller) và trả về chuẩn JSON `ApiResponse` đa ngôn ngữ (`vi`/`en`) khi lỗi `401`/`403`.

#### 3. Câu hỏi giảng viên thường hỏi & Gợi ý trả lời (Tài)
- **Hỏi:** *Làm sao đảm bảo Member A không đánh dấu đã đọc thông báo của Member B hoặc xem phiếu hỗ trợ của người khác?*
  - **Trả lời:** Trong `NotificationService.markAsRead(id, currentUserId)` và `SupportRequestService`, em không nhận `userId` từ body/param mà lấy trực tiếp từ `@AuthenticationPrincipal` trong JWT SecurityContext, đối chiếu với `notification.getUser().getId()`. Nếu không khớp sẽ ném `ForbiddenException` (`403`).
- **Hỏi:** *Tại sao nhóm vừa cấu hình quyền trong `SecurityConfig` vừa dùng `@PreAuthorize` ở Controller?*
  - **Trả lời:** Đây là cơ chế **Defense-in-Depth (Phòng thủ nhiều lớp)** và được kiểm tra tự động bằng `MethodSecurityPolicyTest` để đảm bảo không một API mới nào bị quên phân quyền.

---

### 🟢 THÀNH VIÊN 2: AN — Backend (Membership, Scheduling, Waitlist & QR Check-in)
**Tổng điểm phụ trách:** `23 Story Points` (`SCRUM-71`, `SCRUM-72`, `SCRUM-73`, `SCRUM-74`, `SCRUM-75`)

#### 1. Danh mục Ticket & File Code cần mở sẵn trên IDE
| Mã Jira | Tên chức năng | Endpoint chính | File Code cần mở sẵn |
|---|---|---|---|
| **SCRUM-71** | Quản lý Gói thành viên & Sinh mã QR | `POST /api/v1/memberships/subscriptions`<br>`POST /api/v1/memberships/subscriptions/purchase`<br>`POST /api/v1/memberships/subscriptions/{id}/renew`<br>`GET /api/v1/memberships/subscriptions/my`<br>`GET /api/v1/memberships/subscriptions/history` | `membership/MembershipSubscriptionController.java`<br>`membership/service/MembershipSubscriptionService.java`<br>`membership/entity/MembershipSubscription.java` |
| **SCRUM-72** | Quản lý Lớp học & Xếp lịch (Trigger P3) | `POST /api/v1/classes`<br>`POST /api/v1/classes/{id}/sessions`<br>`GET /api/v1/classes/sessions` | `scheduling/ClassController.java`<br>`scheduling/service/ClassService.java`<br>`config/PostgreSqlTriggerProvider.java` |
| **SCRUM-73** | Đăng ký & Hủy đặt chỗ lớp học (Trigger P2 & P4) | `POST /api/v1/classes/sessions/{id}/enroll`<br>`GET /api/v1/classes/enrollments/my`<br>`DELETE /api/v1/classes/enrollments/{id}` | `scheduling/EnrollmentController.java`<br>`scheduling/service/EnrollmentService.java` |
| **SCRUM-74** | Hàng chờ thông minh khi lớp đầy (Waitlist) | `POST /api/v1/classes/sessions/{id}/waitlist`<br>`GET /api/v1/classes/waitlists/my`<br>`DELETE /api/v1/classes/waitlists/{id}` | `scheduling/WaitlistController.java`<br>`scheduling/service/WaitlistService.java` |
| **SCRUM-75** | Quét mã QR Check-in cổng trung tâm (Trigger P4) | `POST /api/v1/check-in/scan`<br>`POST /api/v1/check-in/{id}/checkout`<br>`GET /api/v1/check-in/history` | `attendance/CheckInController.java`<br>`attendance/service/CheckInService.java` |

#### 2. Kịch bản trình bày & Demo trước giảng viên (An)
1. **Mở đầu (Giới thiệu phạm vi):**
   > *"Em phụ trách 5 ticket cốt lõi của phân hệ Vận hành (`SCRUM-71` đến `SCRUM-75`, 23 Story Points): Quản lý vòng đời gói tập & sinh mã QR định danh, Quản lý lớp học & xếp lịch buổi tập, Đặt chỗ lớp học, Hàng chờ thông minh Waitlist khi lớp đầy, và Quét mã QR Check-in/Check-out tại cổng trung tâm."*
2. **Trình bày `SCRUM-71` (Vòng đời Gói tập & Mã QR):**
   - Mở `MembershipSubscriptionService.java`:
     - Khi hội viên đăng ký mua gói (`purchase`) hoặc gia hạn (`renew`), gói được tạo ở trạng thái `pending_payment` hoặc kích hoạt nối tiếp ngày hết hạn của gói cũ (`previousSubscription`).
     - Khi thanh toán hoàn tất (`activateSubscription`), hệ thống tự tính `endDate = startDate.plusDays(durationDays)` và sinh chuỗi `qrCode` duy nhất (`SCMS-SUB-...` kết hợp UUID bảo mật).
3. **Trình bày `SCRUM-72` (Lớp học, Lịch học & Trigger P3 chống trùng lịch):**
   - Mở `ClassService.java`: Kiểm tra giờ bắt đầu `<` giờ kết thúc, phòng tập phải ở trạng thái `available`, HLV phải đang hoạt động.
   - Khi xếp lịch buổi học (`createSession`), ngoài kiểm tra ở tầng Service, PostgreSQL còn có **Trigger P3 (`trg_sessions_check_conflict`)** chặn tuyệt đối việc xếp trùng phòng tập hoặc trùng HLV trong cùng khung giờ và ánh xạ thành lỗi HTTP `409 Conflict` (`error.scheduling.session_conflict`).
4. **Trình bày `SCRUM-73` & `SCRUM-74` (Đặt chỗ lớp học & Hàng chờ Waitlist — Trigger P2 & P4):**
   - Mở `EnrollmentService.java` và `WaitlistService.java`:
     - Chặn đặt chỗ hoặc vào hàng chờ cho các buổi tập đã diễn ra trong quá khứ (`sessionDate` / `startTime` đã qua).
     - Kiểm tra điều kiện gói tập còn hạn (`status = 'active'` và `startDate <= sessionDate <= endDate`) kết hợp **Trigger P4**.
     - Dùng khóa bi quan (`findByIdForUpdate` / Pessimistic Write Lock) + **Trigger P2 (`trg_enrollments_check_capacity`)** để chống race-condition khi nhiều người bấm đặt chỗ cùng lúc vào chỗ trống cuối cùng.
     - Khi lớp đầy (`enrolledCount >= capacity`), hội viên được chuyển sang đăng ký **Waitlist (`SCRUM-74`)** với thứ tự ưu tiên `position` tự tăng và Partial Unique Index `uq_waitlist_active` chống xếp hàng trùng.
5. **Trình bày `SCRUM-75` (Quét QR Check-in cổng trung tâm):**
   - Mở `CheckInService.java`:
     - Quét mã `qrCode`, dùng khóa đồng thời trên subscription để chống double-scan liên tiếp.
     - Đối chiếu trạng thái tài khoản, trạng thái gói tập `active`, thời hạn gói và **Trigger P4 (`trg_checkins_check_membership`)**.
     - Ghi nhận lịch sử `GRANTED` hoặc `DENIED` (kèm lý do từ chối đã dịch i18n) và hỗ trợ `checkout` ghi nhận giờ rời phòng tập.

#### 3. Câu hỏi giảng viên thường hỏi & Gợi ý trả lời (An)
- **Hỏi:** *Nếu lớp chỉ còn 1 chỗ trống mà 2 hội viên bấm "Đặt chỗ" cùng một mili-giây thì hệ thống xử lý thế nào?*
  - **Trả lời:** Em bảo vệ ở cả 2 tầng: Tầng ứng dụng dùng `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`findByIdForUpdate`) trên buổi học để tuần tự hóa giao dịch; tầng CSDL có **Trigger PL/pgSQL P2 (`trg_enrollments_check_capacity`)** đếm trực tiếp số bản ghi `booked`. Giao dịch thứ 2 sẽ bị rollback và nhận mã lỗi `409 Conflict` thông báo lớp đã đầy để chuyển sang Hàng chờ.
- **Hỏi:** *Khi hội viên gia hạn gói tập lúc gói cũ vẫn còn 5 ngày nữa mới hết hạn thì ngày bắt đầu gói mới tính thế nào?*
  - **Trả lời:** Trong `MembershipSubscriptionService.renewSubscription`, nếu gói cũ còn hạn sau ngày hôm nay, `startDate` của gói gia hạn sẽ được nối tiếp bằng `currentEndDate.plusDays(1)` để hội viên không bị mất ngày tập còn dư.

---

### 🟠 THÀNH VIÊN 3: PHONG — Backend (Finance, Reporting, AI Readiness & Supabase PostgreSQL)
**Tổng điểm phụ trách:** `22 Story Points` (`SCRUM-76`, `SCRUM-77`, `SCRUM-78`, `SCRUM-79`, `SCRUM-80`, `SCRUM-91`)

#### 1. Danh mục Ticket & File Code cần mở sẵn trên IDE
| Mã Jira | Tên chức năng | Endpoint chính | File Code cần mở sẵn |
|---|---|---|---|
| **SCRUM-76** | Tích hợp Thanh toán Gói tập & Ghi danh | `POST /api/v1/payments/process`<br>`POST /api/v1/payments`<br>`GET /api/v1/payments/my` | `finance/PaymentController.java`<br>`finance/service/PaymentService.java`<br>`finance/dto/PaymentProcessDto.java` |
| **SCRUM-77** | Tự động phát hành Hóa đơn điện tử (Invoices) | `GET /api/v1/invoices/{id}`<br>`GET /api/v1/invoices/by-payment/{paymentId}` | `finance/InvoiceController.java`<br>`finance/service/InvoiceService.java`<br>`finance/entity/Invoice.java`, `InvoiceItem.java` |
| **SCRUM-78** | Quy trình Hoàn tiền & Hủy dịch vụ (Refund) | `POST /api/v1/payments/{id}/refund` | `finance/service/PaymentService.java`<br>`audit/AuditAspect.java` |
| **SCRUM-79** | Báo cáo Doanh thu & Lưu trữ Snapshot (`jsonb`) | `GET /api/v1/reports/revenue/daily`<br>`GET /api/v1/reports/revenue/by-package`<br>`POST /api/v1/reports/snapshots/generate` | `reports/ReportController.java`<br>`reports/service/RevenueReportService.java`<br>`reports/entity/ReportSnapshot.java` |
| **SCRUM-80** | Hạ tầng AI Client & Bộ Test Tích hợp Triggers P2/P3/P4 | — | `ai/AiClientConfig.java`<br>`config/SupabaseTriggerIntegrationTest.java` |
| **SCRUM-91** | Chuyển đổi Database sang Supabase PostgreSQL Code-First | — | `config/PostgreSqlTriggerProvider.java`<br>`config/CodeFirstSchemaTest.java`<br>`config/DatabasePolicyTest.java` |

#### 2. Kịch bản trình bày & Demo trước giảng viên (Phong)
1. **Mở đầu (Giới thiệu phạm vi):**
   > *"Trong Sprint 2, em phụ trách 6 ticket (`SCRUM-76` đến `SCRUM-80` và `SCRUM-91`, 22 Story Points) gồm: Chuyển đổi toàn bộ CSDL sang Supabase PostgreSQL theo kiến trúc Hibernate Code-First & Trigger đa hình, xây dựng luồng Thanh toán – Tự động phát hành Hóa đơn điện tử – Hoàn tiền (Refund) – Báo cáo doanh thu Snapshot JSONB và hạ tầng AI Client."*
2. **Trình bày `SCRUM-91` & `SCRUM-80` (Supabase PostgreSQL Code-First & Triggers P2/P3/P4):**
   - Mở `PostgreSqlTriggerProvider.java` và `Invoice.java`:
     - Giải thích cách toàn bộ 34 bảng được định nghĩa 100% qua JPA Entity (`ddl-auto: update`).
     - Chỉ ra cột tính toán tự động trong PostgreSQL `@GeneratedColumn("subtotal_amount + tax_amount")` (`GENERATED ALWAYS AS ... STORED`) trên bảng `invoices` và `quantity * unit_price` trên bảng `invoice_items`.
     - Chỉ ra cách `PostgreSqlTriggerProvider` tự động nạp 5 trigger PL/pgSQL (P2 sĩ số, P3 trùng lịch, P4 hạn thẻ gói tập), Partial Unique Indexes và bật **Row Level Security (RLS)** cho toàn bộ 34 bảng ngay khi ứng dụng khởi động.
3. **Trình bày `SCRUM-76` & `SCRUM-77` (Thanh toán & Xuất Hóa đơn điện tử tự động):**
   - Mở `PaymentService.java` và `InvoiceService.java`:
     - Hỗ trợ cả 2 luồng: Hội viên tự thanh toán gói `pending_payment` hoặc Lễ tân bán gói trực tiếp tại quầy POS qua `POST /api/v1/payments/process` (nhận `subscriptionId` hoặc `packageId`).
     - Kiểm tra số tiền thanh toán phải khớp tuyệt đối với giá gói tập (`amount_mismatch`).
     - Ngay khi thanh toán `success`, trong cùng một `@Transactional`: hệ thống tự động kích hoạt gói tập (`active`), sinh mã QR, và gọi `InvoiceService.issueForPayment(...)` phát hành hóa đơn định dạng `INV-YYYYMMDD-XXXXX`.
4. **Trình bày `SCRUM-78` (Hoàn tiền — Refund Workflow):**
   - Mở hàm `refundPayment` trong `PaymentService.java`:
     - Chuyển trạng thái Payment từ `success` sang `refunded`, lưu lý do hoàn tiền đa ngôn ngữ, đồng thời tự động chuyển gói tập (`subscription`) hoặc lượt đăng ký lớp (`enrollment`) liên quan sang `cancelled` và ghi nhận Audit Log.
5. **Trình bày `SCRUM-79` (Báo cáo doanh thu & Snapshot JSONB):**
   - Mở `RevenueReportService.java` và `ReportSnapshot.java`:
     - Thống kê doanh thu theo ngày (`daily`) và tỷ trọng theo gói tập (`by-package`).
     - Lưu trữ bản chụp báo cáo (`ReportSnapshot`) vào cột kiểu `jsonb` của PostgreSQL kèm người tạo (`generatedBy`) và kiểm tra ràng buộc `periodStart <= periodEnd`.

#### 3. Câu hỏi giảng viên thường hỏi & Gợi ý trả lời (Phong)
- **Hỏi:** *Tại sao nhóm dùng Computed Column `GENERATED ALWAYS AS ... STORED` cho tổng tiền hóa đơn mà không tính bằng Java rồi lưu xuống?*
  - **Trả lời:** Để đảm bảo **toàn vẹn dữ liệu tài chính ở mức Database**: dù dữ liệu được cập nhật từ bất kỳ đâu thì `total_amount = subtotal_amount + tax_amount` và `amount = quantity * unit_price` luôn đúng tuyệt đối ở tầng PostgreSQL, không bao giờ xảy ra lệch số học giữa các cột.
- **Hỏi:** *Nếu kích hoạt gói tập thành công nhưng bước tạo Hóa đơn bị lỗi thì sao?*
  - **Trả lời:** Cả quá trình xử lý thanh toán, kích hoạt gói và phát hành hóa đơn đều nằm trong cùng một `@Transactional` tại `PaymentService.processPayment`. Nếu bất kỳ bước nào lỗi, toàn bộ giao dịch được rollback nguyên tử (Atomic).

---

### 🟣 THÀNH VIÊN 4: KHOA — Frontend (Staff & Manager Console)
**Tổng điểm phụ trách:** `18 Story Points` (`SCRUM-81`, `SCRUM-82`, `SCRUM-83`, `SCRUM-84`)

#### 1. Danh mục Ticket & Màn hình cần mở sẵn để Demo
| Mã Jira | Tên màn hình | Đường dẫn UI (Route) | File Code cần mở sẵn |
|---|---|---|---|
| **SCRUM-81** | Quản lý Lớp học & Xếp lịch HLV | `/staff/classes` | `features/classes/StaffClassesPage.tsx`<br>`features/classes/classesApi.ts` |
| **SCRUM-82** | Quầy Lễ tân POS: Tra cứu & Thu ngân | `/staff/reception` | `features/reception/StaffReceptionPage.tsx`<br>`features/reception/receptionApi.ts` |
| **SCRUM-83** | Quét mã QR Check-in Sảnh | `/staff/checkin` | `features/reception/StaffCheckInPage.tsx`<br>`features/reception/checkinApi.ts` |
| **SCRUM-84** | Báo cáo Doanh thu Trung tâm (Manager) | `/manager/reports` | `features/manager/ManagerReportsPage.tsx`<br>`features/manager/reportsApi.ts` |

#### 2. Kịch bản trình bày & Thao tác Demo trực tiếp trên Web (Khoa)
1. **Mở đầu (Giới thiệu phạm vi):**
   > *"Em phụ trách 4 màn hình phân hệ Nhân viên & Quản lý (`SCRUM-81` đến `SCRUM-84`, 18 Story Points): Quản lý lớp học & xếp lịch HLV, Quầy lễ tân POS tra cứu hội viên & thu ngân xuất hóa đơn, Quầy quét mã QR Check-in sảnh, và Dashboard Báo cáo doanh thu cho Quản lý."*
2. **Demo المàn hình 1 — Quản lý Lớp học & Xếp lịch (`SCRUM-81` tại `/staff/classes`):**
   - **Thao tác Happy Path:** Bấm **"Tạo lớp học mới"**, chọn Bộ môn (ví dụ *Reformer Pilates*), chọn Phòng tập (*Studio 01*), chọn HLV, nhập khung giờ và sĩ số → Bấm Lưu → Hệ thống gọi `POST /api/v1/classes` và `POST /api/v1/classes/{id}/sessions`, hiển thị lớp vừa tạo trên lịch.
   - **Thao tác Bắt lỗi Trùng lịch (Trigger P3):** Tạo thêm 1 buổi học trùng đúng Phòng tập hoặc HLV trong cùng khung giờ → Chỉ cho giảng viên thấy Toast cảnh báo lỗi trùng lịch trả về từ Backend (`409 Conflict`).
3. **Demo Màn hình 2 — Quầy Lễ tân POS & Xuất Hóa đơn (`SCRUM-82` tại `/staff/reception`):**
   - **Thao tác:**
     1. Nhập SĐT hoặc tên hội viên vào ô tra cứu (`GET /api/v1/members/lookup`).
     2. Chọn hội viên vừa tìm được → Chọn gói tập muốn mua tại quầy (ví dụ *The Sanctuary VIP*) → Chọn phương thức thanh toán (*Tiền mặt / POS / Chuyển khoản*).
     3. Bấm **"Xác nhận thu tiền"** → Hệ thống gọi `POST /api/v1/payments/process` kèm `packageId`, kích hoạt gói tập ngay lập tức và bật **Popup Hóa đơn điện tử (`INV-YYYYMMDD-...`)** có chi tiết thuế VAT và nút **In hóa đơn**.
4. **Demo Màn hình 3 — Quét QR Check-in Sảnh (`SCRUM-83` tại `/staff/checkin`):**
   - **Thao tác Happy Path:** Dán mã QR thẻ hội viên đang `active` vào ô quét và nhấn Enter → Hiển thị thẻ trạng thái **GRANTED (Xanh lá)** kèm tên hội viên, tên gói tập, cổng vào và cập nhật ngay vào **Bảng 10 lượt quét gần nhất** bên dưới. Bấm nút **Check-out** trên dòng lịch sử để ghi nhận giờ ra về.
   - **Thao tác Bắt lỗi (`DENIED`):** Nhập một mã QR không hợp lệ hoặc của hội viên đã hết hạn → Hiển thị thẻ trạng thái **DENIED (Đỏ)** kèm lý do từ chối cụ thể từ Backend.
5. **Demo Màn hình 4 — Báo cáo Doanh thu Trung tâm (`SCRUM-84` tại `/manager/reports`):**
   - **Thao tác:** Chọn bộ lọc khoảng thời gian (7 ngày / 30 ngày / Tháng này) → Hiển thị 4 thẻ KPI (Tổng doanh thu, Số gói bán ra, Doanh thu trung bình, Tỷ lệ tăng trưởng), biểu đồ cột doanh thu theo ngày (`GET /api/v1/reports/revenue/daily`), cơ cấu doanh thu theo gói (`by-package`), và bấm nút **"Lưu Snapshot Báo cáo"** (`POST /api/v1/reports/snapshots/generate`).

#### 3. Câu hỏi giảng viên thường hỏi & Gợi ý trả lời (Khoa)
- **Hỏi:** *Khi API đang tải hoặc bị lỗi mạng, hoặc khi tài khoản không đủ quyền truy cập vào trang Quản lý thì giao diện xử lý thế nào?*
  - **Trả lời:** Toàn bộ 4 màn hình đều tuân thủ chuẩn 4 trạng thái của dự án: có `Loading Skeleton`, `Empty State` khi chưa có dữ liệu, `Error Banner` kèm nút **Thử lại (Retry)** (không dùng dữ liệu giả fallback che giấu lỗi), và `Forbidden Guard (403)` chặn truy cập trái quyền.

---

### 🟡 THÀNH VIÊN 5: THỊNH — Frontend (Member Portal & Digital Card)
**Tổng điểm phụ trách:** `16 Story Points` (`SCRUM-85`, `SCRUM-86`, `SCRUM-87`, `SCRUM-88`)

#### 1. Danh mục Ticket & Màn hình cần mở sẵn để Demo
| Mã Jira | Tên màn hình | Đường dẫn UI (Route) | File Code cần mở sẵn |
|---|---|---|---|
| **SCRUM-85** | Trang tổng quan Hội viên (Dashboard) | `/member` | `features/member/MemberDashboardPage.tsx`<br>`features/member/memberDashboardApi.ts` |
| **SCRUM-86** | Danh mục & Mua / Gia hạn Gói tập | `/member/packages` | `features/member/MemberPackagesPage.tsx`<br>`features/member/membershipApi.ts` |
| **SCRUM-87** | Thẻ hội viên điện tử & Mã QR Check-in | `/member/card` | `features/member/MemberCardPage.tsx`<br>`features/member/memberCardApi.ts` |
| **SCRUM-88** | Thời khóa biểu & Đặt chỗ / Hàng chờ (Waitlist) | `/member/classes` | `features/member/MemberClassesPage.tsx`<br>`features/member/memberClassesApi.ts` |

#### 2. Kịch bản trình bày & Thao tác Demo trực tiếp trên Web (Thịnh)
1. **Mở đầu (Giới thiệu phạm vi):**
   > *"Em phụ trách 4 màn hình trải nghiệm Hội viên trên Member Portal (`SCRUM-85` đến `SCRUM-88`, 16 Story Points): Trang tổng quan Member Dashboard, Màn hình Mua & Gia hạn gói tập trực tuyến, Thẻ hội viên điện tử tích hợp mã QR động, và Màn hình Thời khóa biểu đặt chỗ lớp học & xếp hàng chờ Waitlist."*
2. **Demo Màn hình 1 — Trang tổng quan Hội viên (`SCRUM-85` tại `/member`):**
   - **Thao tác:** Đăng nhập bằng tài khoản Member:
     - Nếu chưa có gói tập: Chỉ cho giảng viên thấy banner *Quiet Luxury Empty State* kèm nút CTA điều hướng thẳng sang trang **Khám phá gói tập**.
     - Nếu đã có gói tập: Hiển thị tên gói hiện tại, số ngày còn lại, thanh tiến trình thời hạn và danh sách các buổi học sắp tới đã đăng ký (`booked`).
3. **Demo Màn hình 2 — Mua & Gia hạn Gói tập (`SCRUM-86` tại `/member/packages`):**
   - **Thao tác:**
     1. Xem bảng so sánh các gói tập (*The Essential*, *The Sanctuary VIP*, *The Sovereign Annual*).
     2. Bấm **"Đăng ký gói"** (hoặc **"Gia hạn"** nếu đang có gói) → Mở Modal thanh toán chuyển khoản hiển thị mã QR ngân hàng và nội dung chuyển khoản.
     3. Bấm xác nhận thanh toán → Hệ thống gọi API tạo subscription & xử lý thanh toán (`membershipApi.ts`), tự động kích hoạt gói và cập nhật trạng thái ngay trên giao diện.
4. **Demo Màn hình 3 — Thẻ hội viên điện tử & Mã QR (`SCRUM-87` tại `/member/card`):**
   - **Thao tác:**
     1. Mở trang Thẻ hội viên số: Hiển thị thiết kế thẻ sang trọng gồm Họ tên, Mã hội viên, Hạng gói tập, Ngày hết hạn và **Mã QR thực tế** sinh từ `subscription.qrCode` của Backend.
     2. Giải thích cơ chế đổi màu cảnh báo thông minh: Đang hoạt động (Xanh), sắp hết hạn dưới 7 ngày (Vàng cảnh báo), đã hết hạn (Đỏ/Xám và khóa mã QR).
     3. Bấm nút **"Tải thẻ về máy"** để xuất thẻ thành file ảnh PNG lưu vào điện thoại và copy chuỗi QR này gửi cho bạn **Khoa** quét thử ở màn hình Check-in Sảnh (`SCRUM-83`).
5. **Demo Màn hình 4 — Thời khóa biểu & Đặt chỗ / Hàng chờ (`SCRUM-88` tại `/member/classes`):**
   - **Thao tác:**
     1. Lọc lịch học theo Bộ môn (Pilates, Yoga, Boxing...) và ngày trong tuần.
     2. Với lớp còn chỗ: Bấm **"Đặt chỗ ngay"** → Sĩ số cập nhật tức thì và hiện badge **"Đã đặt chỗ"**.
     3. Với lớp đã đầy (`enrolledCount >= capacity`): Nút tự động chuyển thành **"Tham gia hàng chờ (Waitlist)"** → Bấm vào để xếp hàng chờ và xem vị trí ưu tiên (`position`).
     4. Chuyển sang khu vực **Lịch học của tôi / Hàng chờ của tôi**: Thực hiện **"Hủy đặt chỗ"** hoặc **"Rút khỏi hàng chờ"** để giải phóng sĩ số.

#### 3. Câu hỏi giảng viên thường hỏi & Gợi ý trả lời (Thịnh)
- **Hỏi:** *Làm sao tránh việc hội viên có thẻ hết hạn hoặc gói tập chưa thanh toán (`pending_payment`) vẫn lấy được mã QR để đi qua cổng?*
  - **Trả lời:** Ở cả Frontend (`MemberCardPage.tsx`) và Backend (`CheckInService.java`), em đều kiểm tra điều kiện kép: `status === 'active'` **và** ngày hiện tại nằm trong khoảng `startDate <= today <= endDate`. Nếu gói đang `pending_payment` hoặc đã quá `endDate`, giao diện sẽ ẩn mã QR và hiển thị nút yêu cầu thanh toán/gia hạn, đồng thời được kiểm chứng bằng 17 unit tests trong `MemberCardPage.ui.test.tsx`.

---

## PHẦN 3: CHECKLIST RÀ SOÁT NHANH 5 PHÚT TRƯỚC KHI LÊN BÁO CÁO

- [ ] **Git branch:** Đang ở nhánh `main` mới nhất (`git pull origin main`).
- [ ] **Env & Database:** File `.env` đã cấu hình đúng kết nối Supabase PostgreSQL (`profile: supabase`).
- [ ] **Server chạy ổn định:** `http://localhost:8080/api/v1/health` trả về `200 OK` và `http://localhost:5173` lên giao diện mượt mà.
- [ ] **2 cửa sổ trình duyệt mở song song (Incognito & Normal):**
  - Cửa sổ 1: Đăng nhập sẵn tài khoản **Member** (để **Thịnh** demo mua gói, lấy mã QR, đặt lớp).
  - Cửa sổ 2: Đăng nhập sẵn tài khoản **Manager / Receptionist** (để **Khoa** demo xếp lịch lớp, thu ngân POS, quét mã QR vừa copy từ cửa sổ Member, và xem báo cáo doanh thu tăng lên tức thì).
- [ ] **Swagger UI / Postman:** Mở sẵn tại `http://localhost:8080/swagger-ui/index.html` để **Tài, An, Phong** có thể gọi trực tiếp bất kỳ API nào nếu giảng viên yêu cầu kiểm tra sâu dưới tầng Backend.
