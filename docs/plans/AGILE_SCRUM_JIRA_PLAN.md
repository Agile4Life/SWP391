# KẾ HOẠCH CHI TIẾT THEO SPRINT — CHO TỪNG NGƯỜI
# Sports Center Management System (SWP391) — GROUP1_SWP

> Lịch giả định: mỗi Sprint 2 tuần (14 ngày), bắt đầu Sprint 1 từ **19/09/2026**. Điều chỉnh lại ngày thật với nhóm nếu lịch học/lịch thi khác đi — cấu trúc và thứ tự công việc vẫn giữ nguyên.
> Người: **Tài, An, Phong** (Backend) — **Khoa, Thịnh** (Frontend).

---

# SPRINT 1 — Nền tảng & Định danh (19/09 – 02/10/2026)

## Lịch sinh hoạt Scrum
| Nghi thức | Ngày | Nội dung |
|---|---|---|
| Sprint Planning | Thứ Bảy 19/09/2026 | Chốt US01–US06, tách subtask F01–F05, gán người, ước lượng điểm |
| Daily Standup | T2 21/09, T4 23/09, T6 25/09, T2 28/09, T4 30/09, T6 02/10 | 15 phút: hôm qua làm gì / hôm nay làm gì / vướng gì |
| Backlog Refinement | Thứ Sáu 25/09/2026 | Rà lại backlog Sprint 2, làm rõ US07+ trước khi Planning Sprint 2 |
| Sprint Review/Demo | Thứ Năm 01/10/2026 | Demo Login, Register, OTP, RBAC, Profile, Danh mục |
| Sprint Retrospective | Thứ Sáu 02/10/2026 | Nhìn lại: cái gì tốt / cái gì cần cải thiện cho Sprint 2 |

## Kế hoạch cá nhân

### 🔵 Tài — Backend, Identity Squad
| # | Công việc | Loại | Từ ngày | Đến ngày | Mã Jira |
|---|---|---|---|---|---|
| 1 | Khởi tạo Spring Boot + kết nối SQL Server + Flyway | Setup | 19/09 | 20/09 | — |
| 2 | Cấu hình Spring Security + JWT | Setup | 21/09 | 23/09 | — |
| 3 | API đăng nhập & tạo JWT/session theo role | API | 24/09 | 24/09 | SCRUM-35 |
| 4 | AOP ghi Audit Log tự động | Setup | 25/09 | 26/09 | — |
| 5 | Verify OTP, expiry và attempt limit | API | 27/09 | 27/09 | SCRUM-46 |
| 6 | Confirm OTP completion/status | API | 28/09 | 28/09 | SCRUM-48 |
| 7 | CRUD user và lock/unlock API | API | 29/09 | 29/09 | SCRUM-50 |
| 8 | Role/permission API và RBAC checks | API | 30/09 | 01/10 | SCRUM-52 |
| 9 | Profile/health API | API | 02/10 | 02/10 | SCRUM-55 |

### 🟢 An — Backend, Operations Squad
| # | Công việc | Loại | Từ ngày | Đến ngày | Mã Jira |
|---|---|---|---|---|---|
| 1 | Rà soát Flyway migration cùng Tài | Setup | 19/09 | 20/09 | — |
| 2 | Seed dữ liệu danh mục mẫu (bộ môn/phòng/gói) | Setup | 21/09 | 21/09 | — |
| 3 | Discipline API | API | 22/09 | 22/09 | SCRUM-58 |
| 4 | Room API | API | 23/09 | 23/09 | SCRUM-59 |
| 5 | Package API/status | API | 24/09 | 25/09 | SCRUM-60 |
| 6 | Register API *(nhận từ Tài để cân bằng)* | API | 26/09 | 27/09 | SCRUM-38 |
| 7 | Duplicate email/SĐT check *(nhận từ Tài)* | API | 28/09 | 28/09 | SCRUM-39 |
| 8 | Access và health data validation *(nhận từ Tài)* | API | 29/09 | 30/09 | SCRUM-56 |
| 9 | API tra cứu nhanh hội viên cho Lễ tân | API | 01/10 | 02/10 | — |

### 🟠 Phong — Backend, Finance & AI Squad
| # | Công việc | Loại | Từ ngày | Đến ngày | Mã Jira |
|---|---|---|---|---|---|
| 1 | Global Exception Handler & ApiResponse wrapper | Setup | 19/09 | 20/09 | — |
| 2 | Cấu hình Swagger/OpenAPI | Setup | 21/09 | 21/09 | — |
| 3 | Entity/DTO mapping Payments-Invoices (MapStruct) | Setup | 22/09 | 23/09 | — |
| 4 | Cấu hình Computed Column PERSISTED | Setup | 24/09 | 24/09 | — |
| 5 | PoC tích hợp OpenAI/Gemini API | PoC | 25/09 | 26/09 | — |
| 6 | Tích hợp FE-BE luồng đăng nhập + test | Integration | 27/09 | 27/09 | SCRUM-61 |
| 7 | Tích hợp luồng đăng ký + OTP + test | Integration | 28/09 | 28/09 | SCRUM-62 |
| 8 | Tích hợp RBAC + kiểm tra ma trận quyền | Integration | 29/09 | 29/09 | SCRUM-63 |
| 9 | Tích hợp Profile + dữ liệu sức khỏe | Integration | 30/09 | 30/09 | SCRUM-64 |
| 10 | Tích hợp quản lý danh mục + test CRUD | Integration | 01/10 | 02/10 | SCRUM-65 |

### 🟣 Khoa — Frontend, Staff & Admin Console
| # | Màn hình | Từ ngày | Đến ngày |
|---|---|---|---|
| 1 | Đăng nhập & Điều hướng theo Vai trò | 19/09 | 22/09 |
| 2 | Quản lý Người dùng & Phân quyền (RBAC) | 23/09 | 28/09 |
| 3 | Quản lý Danh mục (Bộ môn/Phòng/Gói tập) | 29/09 | 02/10 |

### 🟡 Thịnh — Frontend, Member App
| # | Màn hình | Từ ngày | Đến ngày |
|---|---|---|---|
| 1 | Đăng ký tài khoản | 19/09 | 22/09 |
| 2 | Xác thực OTP | 23/09 | 26/09 |
| 3 | Hồ sơ cá nhân & Chỉ số sức khỏe | 27/09 | 02/10 |

---

# SPRINT 2 — Gói tập, Lớp học, Thanh toán & Check-in (03/10 – 16/10/2026)

> **Mục tiêu Sprint 2 (Sprint Goal):** Hoàn thiện trọn vẹn luồng nghiệp vụ kinh doanh cốt lõi (Core Business Flow): Hội viên mua và gia hạn gói tập, xem thời khóa biểu và đặt chỗ lớp học (hỗ trợ hàng chờ Waitlist khi lớp đầy), thực hiện thanh toán tự động xuất hóa đơn điện tử, và quét mã QR điện tử check-in qua cổng trung tâm.

## 1. Lịch sinh hoạt Scrum (Sprint 2)
| Nghi thức Scrum | Thời gian | Người tham gia | Mục tiêu / Sản phẩm đầu ra |
|---|---|---|---|
| **Sprint Planning 2** | Thứ Bảy 03/10/2026 (08:30 – 11:30) | Cả nhóm (5 người) | Chốt Backlog Sprint 2, cam kết 93 Story Points, gán Assignee |
| **Daily Standup** | Thứ 2, 4, 6 (09:00 – 09:15) | Cả nhóm | 15 phút: Đã xong gì / Hôm nay làm gì / Có block gì cần hỗ trợ |
| **Backlog Refinement** | Thứ Sáu 09/10/2026 (16:00 – 17:30) | Cả nhóm | Làm rõ đặc tả AI & Coaching cho Sprint 3, rà soát trigger DB |
| **Sprint Review / Demo** | Thứ Năm 15/10/2026 (14:00 – 16:30) | Cả nhóm + Stakeholders | Demo End-to-End: Mua gói → Thanh toán → Book lớp → Quét QR Check-in |
| **Sprint Retrospective** | Thứ Sáu 16/10/2026 (16:30 – 17:30) | Cả nhóm | Phân tích tiến độ, chất lượng code, cải tiến phối hợp cho Sprint 3 |

---

## 2. Bảng tổng hợp Jira Backlog Sprint 2 (104 Points theo cập nhật Jira)

> **Cập nhật SCRUM-91 (08/10/2026):** Đã thêm ticket chuyển SQL Server sang Supabase PostgreSQL vào **SCRUM Sprint 2**, giao **Phong**, **5 Story Points**, **Priority High**, chưa đặt due date. Tổng sprint theo thông tin Jira được cung cấp là **104 điểm**, vượt **11 điểm** so với cam kết ban đầu **93 điểm**.
> **Đối soát:** Bảng dưới hiện có **24 ticket / 98 điểm** (SCRUM-66 → 88 và SCRUM-91); còn **6 điểm chênh lệch** với tổng Jira chưa có chi tiết để cập nhật. Không suy đoán ticket hoặc phân bổ 6 điểm này cho thành viên.

| Mã Jira | Loại | Tiêu đề Ticket (Summary) | Assignee | Points | Ưu tiên | Hạn hoàn thành |
|---|:---:|---|:---:|:---:|:---:|:---:|
| **SCRUM-66** | Story | [Identity] Mở rộng API cập nhật Hồ sơ cá nhân Coach & Receptionist | Tài | 3 | High | 05/10/2026 |
| **SCRUM-67** | Story | [Notification] Xây dựng Notification Module & In-App Notification API | Tài | 5 | High | 08/10/2026 |
| **SCRUM-68** | Story | [Support] Xây dựng Support Requests Module (Ticket Management) | Tài | 5 | High | 11/10/2026 |
| **SCRUM-69** | Task | [Security] Chuẩn hóa @PreAuthorize & Security Policy cho toàn bộ API Sprint 2 | Tài | 3 | High | 14/10/2026 |
| **SCRUM-70** | Task | [Testing] Unit & Integration Tests cho Identity, Notification & Support | Tài | 3 | Medium | 16/10/2026 |
| **SCRUM-71** | Story | [Membership] Xây dựng API Quản lý Gói thành viên & Sinh mã QR định danh | An | 5 | Highest | 06/10/2026 |
| **SCRUM-72** | Story | [Scheduling] Xây dựng API Lớp học & Lịch học cụ thể (Xử lý Trigger P3 Conflict) | An | 5 | Highest | 09/10/2026 |
| **SCRUM-73** | Story | [Scheduling] Xây dựng API Đăng ký & Hủy lớp học (Xử lý Trigger P2 & P4) | An | 5 | Highest | 12/10/2026 |
| **SCRUM-74** | Story | [Scheduling] Xây dựng Hàng chờ thông minh khi lớp đầy (Class Waitlists) | An | 3 | High | 14/10/2026 |
| **SCRUM-75** | Story | [Attendance] Xây dựng API Check-in cổng trung tâm bằng QR Code (Trigger P4) | An | 5 | Highest | 16/10/2026 |
| **SCRUM-76** | Story | [Finance] Tích hợp Flow Thanh toán Mua gói tập & Ghi danh (Payment Integration) | Phong | 3 | Highest | 05/10/2026 |
| **SCRUM-77** | Story | [Finance] Tự động phát hành Hóa đơn điện tử & Chi tiết hóa đơn (Invoices) | Phong | 3 | High | 08/10/2026 |
| **SCRUM-78** | Story | [Finance] Xây dựng Quy trình Hoàn tiền & Hủy giao dịch (Refund Workflow) | Phong | 3 | High | 11/10/2026 |
| **SCRUM-79** | Story | [Reporting] Xây dựng API Báo cáo Doanh thu Tài chính (Report Snapshots) | Phong | 5 | High | 14/10/2026 |
| **SCRUM-80** | Task | [Architecture] Chuẩn bị Hạ tầng AI Client & Bộ Test Tích hợp Triggers P2/P3/P4 | Phong | 3 | Medium | 16/10/2026 |
| **SCRUM-91** | Chưa cung cấp | [Database] Chuyển đổi Database từ SQL Server sang Supabase PostgreSQL | Phong | 5 | High | Chưa đặt |
| **SCRUM-81** | Story | [UI Staff] Hoàn thiện Màn hình Quản lý Lớp học & Xếp lịch HLV (StaffClassesPage) | Khoa | 5 | Highest | 06/10/2026 |
| **SCRUM-82** | Story | [UI Staff] Hoàn thiện Màn hình Lễ tân: Tra cứu & Thu ngân tại quầy (StaffReception) | Khoa | 5 | Highest | 10/10/2026 |
| **SCRUM-83** | Story | [UI Staff] Hoàn thiện Màn hình Quét QR Check-in Sảnh (StaffCheckInPage) | Khoa | 5 | Highest | 13/10/2026 |
| **SCRUM-84** | Story | [UI Manager] Hoàn thiện Màn hình Báo cáo Doanh thu Trung tâm (ManagerReports) | Khoa | 3 | High | 16/10/2026 |
| **SCRUM-85** | Story | [UI Member] Hoàn thiện Trang tổng quan Hội viên (MemberDashboardPage) | Thịnh | 3 | High | 05/10/2026 |
| **SCRUM-86** | Story | [UI Member] Xây dựng Màn hình Danh mục & Mua/Gia hạn Gói tập (MemberPackages) | Thịnh | 5 | Highest | 10/10/2026 |
| **SCRUM-87** | Story | [UI Member] Hoàn thiện Màn hình Thẻ hội viên điện tử & Mã QR Check-in (MemberCard) | Thịnh | 3 | Highest | 12/10/2026 |
| **SCRUM-88** | Story | [UI Member] Hoàn thiện Màn hình Thời khóa biểu & Đặt chỗ / Hàng chờ (MemberClasses) | Thịnh | 5 | Highest | 16/10/2026 |

---

## 3. Chi tiết Kế hoạch cá nhân Sprint 2 (Định dạng Jira Tickets)

### 🔵 TÀI — Backend (Identity, Security & Support Squad) — 19 Story Points

#### 📌 SCRUM-66: [Identity] Mở rộng API cập nhật Hồ sơ cá nhân Coach & Receptionist
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 03/10 – 05/10/2026
- **Mô tả:** Cung cấp endpoint cập nhật thông tin hồ sơ chuyên biệt cho HLV (`coaches`) và Lễ tân (`receptionists`), đảm bảo phân tách theo mô hình Table-per-Type (TPT).
- **Acceptance Criteria (AC):**
  - [ ] `PUT /api/v1/profile/coach`: HLV cập nhật được `specialization`, `bio`, `certification`.
  - [ ] `PUT /api/v1/profile/receptionist`: Lễ tân tự cập nhật được ca làm việc `shift` của mình.
    - [ ] `PUT /api/v1/users/{id}/receptionist`: Quản lý cập nhật được ca làm việc `shift` cho một Lễ tân bất kỳ.
  - [ ] Trả về `403 Forbidden` nếu người dùng không đúng vai trò hoặc cố sửa hồ sơ người khác.
  - [ ] Cập nhật đồng thời message keys i18n thông báo thành công và validation.
- **Kỹ thuật:** Package `users`, Entity `Coach`, `Receptionist`, Service `ProfileService`.

#### 📌 SCRUM-67: [Notification] Xây dựng Notification Module & In-App Notification API
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 06/10 – 08/10/2026
- **Mô tả:** Xây dựng hệ thống hộp thư thông báo in-app phục vụ nhắc lịch tập, xác nhận thanh toán và thay đổi lịch.
- **Acceptance Criteria (AC):**
  - [ ] `GET /api/v1/notifications`: Lấy danh sách thông báo của user đăng nhập có phân trang.
  - [ ] `GET /api/v1/notifications/unread-count`: Đếm chính xác số thông báo chưa đọc.
  - [ ] `PATCH /api/v1/notifications/{id}/read`: Đánh dấu một thông báo là đã đọc.
  - [ ] `PATCH /api/v1/notifications/read-all`: Đánh dấu toàn bộ là đã đọc.
  - [ ] Cung cấp public Java method `NotificationService.send(...)` cho các module khác gọi sự kiện.
- **Kỹ thuật:** Package `notifications`, Entity `Notification`, DTOs, Repository, Service, Controller.

#### 📌 SCRUM-68: [Support] Xây dựng Support Requests Module (Ticket Management)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 09/10 – 11/10/2026
- **Mô tả:** Hội viên gửi yêu cầu khiếu nại/hỗ trợ; Lễ tân hoặc Quản lý tiếp nhận và điều phối trạng thái.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/support/requests`: Member tạo yêu cầu mới (subject, description). Trạng thái khởi tạo: `open`.
  - [ ] `GET /api/v1/support/requests/my`: Member xem lịch sử yêu cầu của chính mình.
  - [ ] `GET /api/v1/support/requests`: Staff/Manager xem toàn bộ yêu cầu, lọc theo `status`.
  - [ ] `PATCH /api/v1/support/requests/{id}/status`: Đổi trạng thái (`in_progress`, `resolved`, `closed`), gán `assigned_to`.
- **Kỹ thuật:** Package `support`, Entity `SupportRequest`, `SupportRequestRepository`, `SupportRequestService`.

#### 📌 SCRUM-69: [Security] Chuẩn hóa @PreAuthorize & Security Policy cho toàn bộ API Sprint 2
- **Issue Type:** Task | **Story Points:** 3 | **Priority:** High | **Thời gian:** 12/10 – 14/10/2026
- **Mô tả:** Rà soát ma trận quyền hạn (Actor × Flow Matrix trong `PROJECT_MASTER_GUIDE.md`) và gắn `@PreAuthorize` trên toàn bộ controller mới.
- **Acceptance Criteria (AC):**
  - [ ] Member không thể truy cập các endpoint quản lý lớp của Manager hoặc thanh toán của Receptionist.
  - [ ] Receptionist không thể xóa người dùng hoặc sửa bảng giá gói tập.
  - [ ] Trả về đúng format `ApiResponse` kèm mã lỗi 403 khi truy cập trái phép.

#### 📌 SCRUM-70: [Testing] Unit & Integration Tests cho Identity, Notification & Support
- **Issue Type:** Task | **Story Points:** 3 | **Priority:** Medium | **Thời gian:** 15/10 – 16/10/2026
- **Acceptance Criteria (AC):**
  - [ ] 100% Unit test pass với `MockMvcBuilders.standaloneSetup` (null-safe `MessageService`).
  - [ ] Viết test case bao phủ các kịch bản: đổi trạng thái ticket, đếm unread notification, phân quyền 403.

---

### 🟢 AN — Backend (Core Operations & Membership Squad) — 23 Story Points

#### 📌 SCRUM-71: [Membership] Xây dựng API Quản lý Gói thành viên & Sinh mã QR định danh
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 03/10 – 06/10/2026
- **Mô tả:** Quản lý vòng đời đăng ký gói tập (`membership_subscriptions`): Mua mới, gia hạn, chuyển trạng thái và sinh mã QR duy nhất phục vụ check-in.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/memberships/subscriptions`: Tạo subscription mới ở trạng thái `pending_payment`.
  - [ ] Khi kích hoạt thành công: Tự động tính `end_date = start_date + package.duration_days`, sinh `qr_code` ngẫu nhiên bảo mật (UUID/Hash duy nhất).
  - [ ] `POST /api/v1/memberships/subscriptions/{id}/renew`: Tạo lượt gia hạn liên kết `previous_subscription_id`.
  - [ ] `GET /api/v1/memberships/subscriptions/my`: Lấy thông tin gói tập hiện tại kèm chuỗi `qr_code`.
- **Kỹ thuật:** Package `membership`, Entity `MembershipSubscription`, Service, Controller, i18n keys.

#### 📌 SCRUM-72: [Scheduling] Xây dựng API Lớp học & Lịch học cụ thể (Xử lý Trigger P3 Conflict)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 07/10 – 09/10/2026
- **Mô tả:** Quản lý thông tin lớp học (`classes`) và xếp lịch các buổi học cụ thể (`class_sessions`). Bắt buộc tích hợp Database Trigger P3 chống trùng lịch.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/classes`: Manager tạo lớp học (gán `discipline_id`, `coach_id`, `room_id`, `capacity`, `level`).
  - [ ] `POST /api/v1/classes/{id}/sessions`: Xếp lịch buổi học (`session_date`, `start_time`, `end_time`).
  - [ ] **Bất biến Trigger P3:** Nếu trùng lịch phòng tập hoặc trùng giờ dạy của HLV (`trg_sessions_check_conflict`), DB rollback và backend ném `ConflictException` với message i18n `error.scheduling.session_conflict`.
  - [ ] `GET /api/v1/classes/sessions`: Lấy danh sách lịch học có bộ lọc theo ngày, tuần, bộ môn, HLV.
- **Kỹ thuật:** Package `scheduling`, Entity `GymClass`, `ClassSession`, Repositories, Service.

#### 📌 SCRUM-73: [Scheduling] Xây dựng API Đăng ký & Hủy lớp học (Xử lý Trigger P2 & P4)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 10/10 – 12/10/2026
- **Mô tả:** Xử lý việc học viên giữ chỗ trong lớp học (`class_enrollments`), kiểm soát sĩ số tối đa và điều kiện gói tập.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/classes/sessions/{id}/enroll`: Hội viên đăng ký đặt chỗ.
  - [ ] **Filtered Index `uq_enrollment_active`:** Đảm bảo 1 hội viên chỉ có 1 bản ghi `booked` trong cùng lớp.
  - [ ] **Bất biến Trigger P2 (Capacity):** Nếu số lượng `booked` >= `classes.capacity`, DB kích hoạt trigger báo đầy lớp; ném `ConflictException` với message `error.scheduling.class_full`.
  - [ ] **Bất biến Trigger P4 (Membership):** Nếu hội viên không có gói tập `active` hoặc gói đã hết hạn, chặn ngay lập tức và ném `ForbiddenException` với message `error.scheduling.membership_expired_or_inactive`.
  - [ ] `DELETE /api/v1/classes/enrollments/{id}`: Hủy đặt chỗ, chuyển status thành `cancelled`, giải phóng sĩ số.
- **Kỹ thuật:** Package `scheduling`, Entity `ClassEnrollment`, Service, i18n messages.

#### 📌 SCRUM-74: [Scheduling] Xây dựng Hàng chờ thông minh khi lớp đầy (Class Waitlists)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 13/10 – 14/10/2026
- **Mô tả:** Cho phép hội viên xếp hàng chờ khi lớp học đã hết chỗ trống.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/classes/sessions/{id}/waitlist`: Tham gia hàng chờ khi sĩ số đã đầy.
  - [ ] Ràng buộc Filtered Index `uq_waitlist_active`: Không cho phép 1 hội viên xếp hàng 2 lần cùng lúc cho 1 lớp.
  - [ ] `DELETE /api/v1/classes/waitlists/{id}`: Rút khỏi hàng chờ.
  - [ ] `GET /api/v1/classes/waitlists/my`: Xem danh sách các lớp đang xếp hàng chờ.
- **Kỹ thuật:** Package `scheduling`, Entity `ClassWaitlist`, Service, Repository.

#### 📌 SCRUM-75: [Attendance] Xây dựng API Check-in cổng trung tâm bằng QR Code (Trigger P4)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 15/10 – 16/10/2026
- **Mô tả:** Lễ tân hoặc cổng barrier quét mã QR trên thẻ hội viên để xác thực quyền ra vào trung tâm.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/check-in/scan`: Quét chuỗi `qr_code`.
  - [ ] **Bất biến Trigger P4 (`trg_checkins_check_membership`):** Tự động đối soát trạng thái gói tập. Nếu hợp lệ, ghi nhận bản ghi vào `center_checkins` (`status: GRANTED`, `check_in_time = NOW()`). Nếu hết hạn hoặc không tồn tại, trả về lỗi `DENIED` kèm thông điệp rõ ràng.
  - [ ] `POST /api/v1/check-in/{id}/checkout`: Ghi nhận giờ rời trung tâm (`check_out_time = NOW()`).
  - [ ] `GET /api/v1/check-in/history`: Lấy lịch sử ra vào trong ngày tại các cổng.
- **Kỹ thuật:** Package `attendance`, Entity `CenterCheckin`, Service, Controller.

---

### 🟠 PHONG — Backend (Finance, System Architecture & AI Squad) — 22 Story Points

#### 📌 SCRUM-76: [Finance] Tích hợp Flow Thanh toán Mua gói tập & Ghi danh (Payment Integration)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** Highest | **Thời gian:** 03/10 – 05/10/2026
- **Mô tả:** Kết nối tầng Payment đã có với thực thể `membership_subscriptions` và `class_enrollments`.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/payments/process`: Tiếp nhận thanh toán (tiền mặt, POS, chuyển khoản).
  - [ ] Khi `Payment.status = 'success'`: Tự động gọi `MembershipService` để kích hoạt subscription sang `active` và sinh `qr_code`.
  - [ ] Bắt lỗi không tìm thấy đơn hàng, dữ liệu số tiền không khớp.
- **Kỹ thuật:** Package `finance`, `PaymentService`, `PaymentController`, kết nối `membership`.

#### 📌 SCRUM-77: [Finance] Tự động phát hành Hóa đơn điện tử & Chi tiết hóa đơn (Invoices)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 06/10 – 08/10/2026
- **Mô tả:** Khi thanh toán thành công, hệ thống tự động sinh hóa đơn điện tử với số hóa đơn chuẩn định dạng.
- **Acceptance Criteria (AC):**
  - [ ] Tự động tạo bản ghi `invoices` và danh sách `invoice_items` liên kết 1-1 với `Payment`.
  - [ ] Định dạng số hóa đơn: `INV-YYYYMMDD-XXXXX` (duy nhất).
  - [ ] **Bất biến Computed Columns PERSISTED:** Kiểm chứng `total_amount = subtotal_amount + tax_amount` và `invoice_items.amount = quantity * unit_price` được tính toán tự động chính xác tuyệt đối.
  - [ ] `GET /api/v1/invoices/{id}`: Trả về đầy đủ thông tin hóa đơn và các dòng hàng.
- **Kỹ thuật:** Package `finance`, `InvoiceService`, `InvoiceController`, `InvoiceMapper`.

#### 📌 SCRUM-78: [Finance] Xây dựng Quy trình Hoàn tiền & Hủy giao dịch (Refund Workflow)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 09/10 – 11/10/2026
- **Mô tả:** Xử lý yêu cầu hoàn tiền khi học viên hủy dịch vụ hợp lệ hoặc có sai sót thu ngân.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/payments/{id}/refund`: Ghi nhận hoàn tiền, chuyển trạng thái payment sang `refunded`.
  - [ ] Tự động chuyển trạng thái subscription hoặc enrollment liên quan sang `cancelled`.
  - [ ] Ghi nhận vết kiểm toán vào `audit_logs` có lưu lý do hoàn tiền và số tiền hoàn.
- **Kỹ thuật:** Package `finance`, `PaymentService`, `AuditAspect`.

#### 📌 SCRUM-79: [Reporting] Xây dựng API Báo cáo Doanh thu Tài chính (Report Snapshots)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 12/10 – 14/10/2026
- **Mô tả:** Tổng hợp doanh thu theo ngày, tuần, tháng và lưu trữ ảnh chụp báo cáo (`report_snapshots`).
- **Acceptance Criteria (AC):**
  - [ ] `GET /api/v1/reports/revenue/daily`: Thống kê doanh thu theo từng ngày trong khoảng thời gian.
  - [ ] `GET /api/v1/reports/revenue/by-package`: Thống kê tỷ trọng doanh thu theo từng loại gói tập.
  - [ ] `POST /api/v1/reports/snapshots/generate`: Lưu snapshot báo cáo dạng JSON (`ISJSON(data) = 1`) phục vụ đối soát nhanh cho Quản lý.
- **Kỹ thuật:** Package `reports`, Entity `ReportSnapshot`, Service, Controller.

#### 📌 SCRUM-80: [Architecture] Chuẩn bị Hạ tầng AI Client & Bộ Test Tích hợp Triggers P2/P3/P4
- **Issue Type:** Task | **Story Points:** 3 | **Priority:** Medium | **Thời gian:** 15/10 – 16/10/2026
- **Mô tả:** Chuẩn bị sẵn module Spring AI / RestClient kết nối LLM (Gemini/OpenAI) cho Sprint 3; viết integration tests kiểm thử đa hình các trigger P2, P3, P4.
- **Acceptance Criteria (AC):**
  - [ ] Config AI Client sẵn sàng nhận API Key từ môi trường, có fallback mock adapter cho môi trường test.
  - [ ] Bộ integration tests kiểm chứng Trigger P2, P3, P4 hoạt động đồng nhất trên cả SQL Server và PostgreSQL (100% tests pass).
- **Liên quan SCRUM-91:** Phong bố trí hai ticket gần nhau; bộ test PostgreSQL P2/P3/P4 của SCRUM-80 là bằng chứng nghiệm thu phần trigger của SCRUM-91.

#### 📌 SCRUM-91: [Database] Chuyển đổi Database từ SQL Server sang Supabase PostgreSQL
- **Issue Type:** Chưa được cung cấp | **Assignee:** Phong | **Sprint:** SCRUM Sprint 2 | **Story Points:** 5 | **Priority:** High | **Due date:** Chưa đặt.
- **Mô tả:** Chuyển database của hệ thống từ SQL Server sang Supabase PostgreSQL, bảo toàn ràng buộc nghiệp vụ, thông điệp lỗi trigger và hoạt động của các API hiện có.
- **Nguồn đặc tả:** Ticket Jira có **10 Business Rules và 6 Acceptance Criteria**. Nội dung dưới đây tóm tắt các điểm đã được cung cấp, không phải bản chép nguyên văn đầy đủ của ticket.
- **Business Rules — các điểm chính:**
  - Chuyển Computed Column `PERSISTED` thành `GENERATED ... STORED`.
  - Chuyển Filtered Index thành Partial Index, giữ nguyên điều kiện và tính duy nhất.
  - Viết lại trigger P2/P3/P4 bằng PL/pgSQL; giữ nguyên message lỗi để backend tiếp tục xử lý, không vô hiệu hóa trigger.
  - Chuyển dữ liệu/ràng buộc JSON dùng `ISJSON` sang `jsonb`.
  - Thông tin kết nối chỉ đọc từ biến môi trường; dùng SSL và connection pooler.
  - Xem xét RLS để dữ liệu không bị lộ qua Supabase Data API.
- **Acceptance Criteria — tổng hợp từ thông tin được cung cấp:**
  - [x] Computed Column và Filtered Index được chuyển sang cú pháp PostgreSQL tương ứng, giữ nguyên hành vi nghiệp vụ.
  - [x] Trigger P2/P3/P4 chạy bằng PL/pgSQL và giữ nguyên message lỗi mà backend đang xử lý.
  - [x] Dữ liệu JSON dùng `jsonb` thay cho kiểm tra `ISJSON`.
  - [x] Kết nối lấy cấu hình từ biến môi trường, dùng SSL và pooler; có kết quả rà soát RLS/quyền truy cập Data API.
  - [x] Hibernate Code-First (`ddl-auto: update`) tạo schema thành công từ database PostgreSQL rỗng; trigger được cài qua `DatabaseTriggerProvider`.
  - [x] Bộ test PostgreSQL P2/P3/P4 phục vụ SCRUM-80 pass và smoke test các API hiện có pass.
- **Kiểm chứng codebase (08/10/2026):** Toàn bộ 183 backend tests pass, 0 failure/error/skip, gồm 12 integration tests chạy trên Supabase thật trong schema biệt lập. Kiểm tra capacity đồng thời, trùng lịch, subscription, partial index, generated column, JSON, CHECK, RLS và API JWT/payment/invoice đều pass. Khởi động profile `supabase` tạo 34 bảng trong `public`, bật RLS cho cả 34 bảng, cài 5 trigger; không có policy public. JDBC đến session pooler dùng TLS 1.3; schema test đã được dọn sạch. Đây là kết quả tại repository và Supabase; trạng thái/mô tả Jira chưa được cập nhật trực tiếp.
- **Phối hợp:** Làm gần SCRUM-80 (cùng owner Phong); kiểm thử các luồng mua gói/thanh toán, booking và check-in cùng các owner API liên quan.
- **Quyết định triển khai (08/10/2026):** Người dùng xác nhận **giữ Code-First**, thay tiêu chí Flyway bằng kiểm chứng Hibernate tạo schema PostgreSQL từ DB rỗng. Dữ liệu SQL Server hiện tại chỉ là demo, không cần chuyển sang Supabase. Bảng/cột/quan hệ vẫn định nghĩa qua Entity; trigger được nạp qua `DatabaseTriggerProvider`. Quyết định này cần được đồng bộ vào mô tả Jira khi cập nhật ticket.
- **Đối chiếu và thiết kế:** [SCRUM-91 Supabase design](../specs/2026-10-08-scrum-91-supabase-design.md); [implementation plan](2026-10-08-scrum-91-implementation.md).
- **Tải Sprint 2:** Phong có **22 điểm / 6 ticket** (SCRUM-76 → 80 và SCRUM-91). Có thể cân nhắc dời SCRUM-80 hoặc SCRUM-70 sang Sprint 3 khi nhóm chốt giảm tải; đây là đề xuất, chưa thay đổi sprint của các ticket. Nếu dời SCRUM-80, vẫn cần bảo đảm bộ test trigger PostgreSQL phục vụ nghiệm thu SCRUM-91.

---

### 🟣 KHOA — Frontend (Staff & Admin Console) — 18 Story Points

#### 📌 SCRUM-81: [UI Staff] Hoàn thiện Màn hình Quản lý Lớp học & Xếp lịch HLV (StaffClassesPage)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 03/10 – 06/10/2026
- **Mô tả:** Thay thế mock state trong `StaffClassesPage.tsx` bằng API thực tế, hỗ trợ phân công HLV và phòng học.
- **Acceptance Criteria (AC):**
  - [ ] Tích hợp API `GET /api/v1/classes` và `GET /api/v1/classes/sessions`.
  - [ ] Modal tạo lớp học và xếp lịch: Dropdown chọn Bộ môn, Phòng tập, Huấn luyện viên, khung giờ.
  - [ ] Bắt lỗi trùng lịch (P3 conflict): Hiển thị Toast cảnh báo trực quan khi HLV hoặc phòng tập bị trùng giờ.
  - [ ] Đầy đủ 4 trạng thái: Loading skeleton, Empty list, Error retry, Forbidden guard.
- **Kỹ thuật:** `apps/web/src/features/classes/StaffClassesPage.tsx`, tạo `classesApi.ts`.

#### 📌 SCRUM-82: [UI Staff] Hoàn thiện Màn hình Lễ tân: Tra cứu & Thu ngân tại quầy (StaffReception)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 07/10 – 10/10/2026
- **Mô tả:** Kết nối API tra cứu hội viên, bán gói tập tại quầy và xuất hóa đơn thanh toán trực tiếp.
- **Acceptance Criteria (AC):**
  - [ ] Ô tra cứu: Tìm theo SĐT, Mã hội viên hoặc CCCD qua `MemberLookupService`.
  - [ ] Form thu ngân: Chọn gói tập khách muốn mua/gia hạn, chọn hình thức thanh toán (Tiền mặt / POS / Chuyển khoản QR).
  - [ ] Sau khi bấm "Xác nhận thu tiền": Gọi `Payment API`, nhận kết quả thành công và hiển thị popup Hóa đơn điện tử (`INV-...`) có nút In hóa đơn.
- **Kỹ thuật:** `apps/web/src/features/reception/StaffReceptionPage.tsx`, tạo `receptionApi.ts`.

#### 📌 SCRUM-83: [UI Staff] Hoàn thiện Màn hình Quét QR Check-in Sảnh (StaffCheckInPage)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 11/10 – 13/10/2026
- **Mô tả:** Xây dựng màn hình quầy tiếp tân kiểm soát ra vào bằng quét mã QR thẻ hội viên.
- **Acceptance Criteria (AC):**
  - [ ] Input quét mã: Tự động bắt sự kiện enter từ máy quét barcode hoặc nhập tay chuỗi QR.
  - [ ] Gọi API `check-in/scan`:
    - Nếu hợp lệ: Hiển thị thẻ trạng thái **GRANTED (Xanh)**, kèm ảnh/tên hội viên, loại gói tập, số ngày còn hạn.
    - Nếu vi phạm: Hiển thị thẻ trạng thái **DENIED (Đỏ)**, nêu rõ lý do (Gói đã hết hạn ngày xx/xx, chưa kích hoạt, sai cổng).
  - [ ] Bảng lịch sử quét 10 lượt gần nhất cập nhật tức thì.
- **Kỹ thuật:** `apps/web/src/features/reception/StaffCheckInPage.tsx`, tạo `checkinApi.ts`.

#### 📌 SCRUM-84: [UI Manager] Hoàn thiện Màn hình Báo cáo Doanh thu Trung tâm (ManagerReports)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 14/10 – 16/10/2026
- **Mô tả:** Kết nối màn hình `ManagerReportsPage.tsx` với API doanh thu thật.
- **Acceptance Criteria (AC):**
  - [ ] Hiển thị 4 thẻ KPI: Doanh thu ngày, Doanh thu tháng, Số gói bán ra, Tỷ lệ gia hạn.
  - [ ] Biểu đồ trực quan doanh thu theo tuần/tháng và bảng danh sách giao dịch gần nhất.
- **Kỹ thuật:** `apps/web/src/features/manager/ManagerReportsPage.tsx`, tạo `reportsApi.ts`.

---

### 🟡 THỊNH — Frontend (Member Portal & App) — 16 Story Points

#### 📌 SCRUM-85: [UI Member] Hoàn thiện Trang tổng quan Hội viên (MemberDashboardPage)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 03/10 – 05/10/2026
- **Mô tả:** Hiển thị bức tranh toàn cảnh cho hội viên sau khi đăng nhập vào hệ thống.
- **Acceptance Criteria (AC):**
  - [ ] Gọi API lấy gói tập hiện tại: Tên gói, số ngày còn lại, thanh tiến trình thời hạn.
  - [ ] Hiển thị danh sách các buổi học đã đăng ký trong tuần tới kèm giờ học và phòng.
  - [ ] Trạng thái Empty: Nếu chưa mua gói, hiển thị banner Quiet Luxury kèm nút kêu gọi "Khám phá các gói tập ngay".
- **Kỹ thuật:** `apps/web/src/features/member/MemberDashboardPage.tsx`.

#### 📌 SCRUM-86: [UI Member] Xây dựng Màn hình Danh mục & Mua/Gia hạn Gói tập (MemberPackages)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 06/10 – 10/10/2026
- **Mô tả:** Giao diện cho phép hội viên xem danh mục gói dịch vụ, so sánh quyền lợi và thực hiện thanh toán online.
- **Acceptance Criteria (AC):**
  - [ ] Hiển thị danh sách các gói dịch vụ (Essential, Sanctuary, Sovereign VIP) với giá và thời hạn.
  - [ ] Bấm "Đăng ký gói" hoặc "Gia hạn": Mở Modal thanh toán hiển thị thông tin chuyển khoản kèm mã QR VietQR / Mock ngân hàng.
  - [ ] Nút "Tôi đã chuyển khoản": Gửi yêu cầu xác nhận thanh toán và tự động cập nhật trạng thái gói tập khi hoàn tất.
- **Kỹ thuật:** Tạo mới `apps/web/src/features/member/MemberPackagesPage.tsx`, `membershipApi.ts`.

#### 📌 SCRUM-87: [UI Member] Hoàn thiện Màn hình Thẻ hội viên điện tử & Mã QR Check-in (MemberCard)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** Highest | **Thời gian:** 11/10 – 12/10/2026
- **Mô tả:** Thẻ định danh số hóa thay thế thẻ nhựa vật lý, tích hợp mã QR động dùng quét qua cổng sảnh.
- **Acceptance Criteria (AC):**
  - [ ] Thiết kế thẻ hội viên sang trọng: Mã hội viên, Họ tên, Hạng gói tập, Ngày hết hạn.
  - [ ] Hiển thị mã QR Code tạo từ `subscription.qr_code`.
  - [ ] Trạng thái cảnh báo: Đổi viền sang vàng khi còn dưới 7 ngày, đổi sang xám/đỏ khi đã hết hạn.
  - [ ] Nút "Tải thẻ về máy" (hỗ trợ lưu ảnh thẻ qua `html2canvas`).
- **Kỹ thuật:** `apps/web/src/features/member/MemberCardPage.tsx`.

#### 📌 SCRUM-88: [UI Member] Hoàn thiện Màn hình Thời khóa biểu & Đặt chỗ / Hàng chờ (MemberClasses)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 13/10 – 16/10/2026
- **Mô tả:** Xem lịch học trực quan, đặt chỗ giữ chỗ trước hoặc tham gia hàng chờ (Waitlist) khi lớp đầy.
- **Acceptance Criteria (AC):**
  - [ ] Bộ lọc lịch theo Bộ môn (Gym, Yoga, Pilates, Boxing) và Thứ trong tuần.
  - [ ] Với lớp còn chỗ: Nút "Đặt chỗ ngay" -> Bấm đặt -> Cập nhật sĩ số và hiển thị badge "Đã đặt chỗ".
  - [ ] Với lớp đã đầy sĩ số (`enrolled == capacity`): Nút tự động chuyển thành "Tham gia hàng chờ (Waitlist)".
  - [ ] Tab "Lịch học của tôi": Xem danh sách các lớp đã book, nút "Hủy đặt chỗ" kèm popup xác nhận hoàn lượt.
- **Kỹ thuật:** `apps/web/src/features/member/MemberClassesPage.tsx`, tạo `memberClassApi.ts`.

---

# SPRINT 3 — AI, Huấn luyện, Thông báo & Hoàn thiện (17/10 – 30/10/2026)

> **Mục tiêu Sprint 3 (Sprint Goal):** Tích hợp Động cơ Trí tuệ Nhân tạo (AI Recommendation gợi ý giáo án bài tập cho HLV, AI Chatbot hỗ trợ hội viên 24/7); Số hóa quy trình Huấn luyện & Điểm danh buổi học; Xây dựng Trung tâm thông báo tự động (Scheduler) và Báo cáo quản trị cao cấp; Hoàn thiện kiểm thử, bảo mật và đóng gói Docker sẵn sàng nghiệm thu toàn diện.

## 1. Lịch sinh hoạt Scrum (Sprint 3)
| Nghi thức Scrum | Thời gian | Người tham gia | Mục tiêu / Sản phẩm đầu ra |
|---|---|---|---|
| **Sprint Planning 3** | Thứ Bảy 17/10/2026 (08:30 – 11:30) | Cả nhóm (5 người) | Chốt Backlog Sprint 3, cam kết 91 Story Points, gán Assignee |
| **Daily Standup** | Thứ 2, 4, 6 (09:00 – 09:15) | Cả nhóm | 15 phút: Tiến độ AI, Điểm danh, Background jobs, Fix bugs |
| **Backlog Refinement** | Thứ Sáu 23/10/2026 (16:00 – 17:00) | Cả nhóm | Rà soát tiêu chí nghiệm thu (DoD), chuẩn bị kịch bản Demo cuối kỳ |
| **Sprint Review / Final Demo** | Thứ Năm 29/10/2026 (14:00 – 17:00) | Cả nhóm + Giảng viên/Hội đồng | Demo toàn diện 6 Luồng nghiệp vụ End-to-End từ Landing đến AI Chatbot |
| **Sprint Retrospective & Project Closeout** | Thứ Sáu 30/10/2026 (16:00 – 18:00) | Cả nhóm | Tổng kết đồ án SWP391, đánh giá đóng góp từng cá nhân, bàn giao mã nguồn |

---

## 2. Bảng tổng hợp Jira Backlog Sprint 3 (46 Tickets / 91 Points)

| Mã Jira | Loại | Tiêu đề Ticket (Summary) | Assignee | Points | Ưu tiên | Hạn hoàn thành |
|---|:---:|---|:---:|:---:|:---:|:---:|
| **SCRUM-106** | Story | [Support] Xây dựng Hệ thống Trao đổi trong Phiếu Hỗ trợ (Support Messages) | Tài | 5 | High | 19/10/2026 |
| **SCRUM-107** | Story | [Scheduler] Xây dựng Background Jobs Thông báo Tự động (Expiry & Reminders) | Tài | 5 | High | 23/10/2026 |
| **SCRUM-108** | Story | [Notification] Tích hợp Bộ điều phối Thông báo Đa kênh (Multi-channel Port) | Tài | 3 | Medium | 26/10/2026 |
| **SCRUM-109** | Story | [Audit] Xây dựng API Quản trị & Tra cứu Nhật ký Kiểm toán (Audit Log Viewer) | Tài | 3 | High | 28/10/2026 |
| **SCRUM-110** | Task | [Security & DevOps] Hoàn thiện CORS, Rate Limiting, Dockerfile & Production Prep | Tài | 3 | Highest | 30/10/2026 |
| **SCRUM-111** | Story | [Attendance] Xây dựng API Điểm danh Buổi học 4 Trạng thái (Session Attendance) | An | 5 | Highest | 20/10/2026 |
| **SCRUM-112** | Story | [Scheduler] Xây dựng Tác vụ Tự động Hết hạn Waitlist & Đôn hàng chờ (24h Promotion) | An | 5 | High | 23/10/2026 |
| **SCRUM-113** | Story | [Scheduling] Xử lý Hủy Buổi học bởi HLV & Tự động Thông báo Học viên | An | 3 | High | 26/10/2026 |
| **SCRUM-114** | Task | [Testing] Kiểm thử Tải (Concurrency) & Kiểm tra Tính Toàn vẹn Dữ liệu Operations | An | 3 | High | 28/10/2026 |
| **SCRUM-115** | Task | [Docs] Xuất bản Toàn bộ Postman Collection & Tài liệu API Phân hệ Operations | An | 2 | Medium | 30/10/2026 |
| **SCRUM-116** | Story | [Coaching] Xây dựng API Quản lý Kế hoạch Huấn luyện & Bài tập (Training Plans) | Phong | 5 | Highest | 20/10/2026 |
| **SCRUM-117** | Story | [AI Engine] Tích hợp AI Gợi ý Giáo án Huấn luyện Cá nhân hóa (/ai/recommend) | Phong | 5 | Highest | 24/10/2026 |
| **SCRUM-118** | Story | [AI Engine] Xây dựng Trợ lý Ảo AI Chatbot Tư vấn Hội viên 24/7 (AI Chatbot) | Phong | 5 | Highest | 27/10/2026 |
| **SCRUM-119** | Story | [Coaching] Xây dựng API Đánh giá Buổi tập & Tiến độ Học viên (Evaluations) | Phong | 3 | High | 29/10/2026 |
| **SCRUM-120** | Story | [Reporting] Xây dựng Báo cáo Công suất Sử dụng & Tỷ lệ Lấp đầy Lớp học | Phong | 3 | Medium | 30/10/2026 |
| **SCRUM-121** | Story | [UI Coach] Xây dựng Màn hình Danh sách Lớp & Học viên Phụ trách của HLV | Khoa | 3 | High | 19/10/2026 |
| **SCRUM-122** | Story | [UI Coach] Xây dựng Giao diện Soạn Giáo án Bài tập Tích hợp AI Gợi ý | Khoa | 5 | Highest | 24/10/2026 |
| **SCRUM-123** | Story | [UI Coach] Hoàn thiện Màn hình HLV Điểm danh Buổi học & Đánh giá (Attendance) | Khoa | 5 | Highest | 27/10/2026 |
| **SCRUM-124** | Story | [UI Manager] Xây dựng Màn hình Giám sát Audit Log & Báo cáo Lấp đầy Lớp | Khoa | 3 | High | 30/10/2026 |
| **SCRUM-125** | Story | [UI Member] Xây dựng Màn hình Lịch sử Giao dịch & Hóa đơn Điện tử | Thịnh | 3 | High | 19/10/2026 |
| **SCRUM-126** | Story | [UI Member] Tích hợp Trợ lý Trí tuệ Nhân tạo AI Chatbot (LiquidGlass Chatbot) | Thịnh | 5 | Highest | 23/10/2026 |
| **SCRUM-127** | Story | [UI Member] Xây dựng Trung tâm Thông báo Đẩy In-App (MemberNotifications) | Thịnh | 3 | High | 25/10/2026 |
| **SCRUM-128** | Story | [UI Member] Xây dựng Màn hình Gửi Yêu cầu Hỗ trợ & Khiếu nại (MemberSupport) | Thịnh | 3 | High | 27/10/2026 |
| **SCRUM-129** | Story | [UI Member] Xây dựng Màn hình Theo dõi Tiến độ Thể lực & Giáo án (Progress) | Thịnh | 3 | High | 30/10/2026 |

---

## 3. Chi tiết Kế hoạch cá nhân Sprint 3 (Định dạng Jira Tickets)

### 🔵 TÀI — Backend (Identity, Security & Support Squad) — 19 Story Points

#### 📌 SCRUM-106: [Support] Xây dựng Hệ thống Trao đổi trong Phiếu Hỗ trợ (Support Messages)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 17/10 – 19/10/2026
- **Mô tả:** Cho phép hội viên và nhân viên lễ tân/hỗ trợ chat trao đổi tin nhắn qua lại trong từng ticket hỗ trợ (`support_request_messages`).
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/support/requests/{id}/messages`: Gửi tin nhắn mới vào ticket.
  - [ ] `GET /api/v1/support/requests/{id}/messages`: Lấy toàn bộ lịch sử hội thoại xếp theo thời gian.
  - [ ] Tự động bắn thông báo in-app cho người nhận tương ứng khi có tin nhắn mới.
- **Kỹ thuật:** Package `support`, Entity `SupportRequestMessage`, Service, Controller.

#### 📌 SCRUM-107: [Scheduler] Xây dựng Background Jobs Thông báo Tự động (Expiry & Reminders)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 20/10 – 23/10/2026
- **Mô tả:** Tác vụ nền định kỳ (Cron Scheduler) tự động quét dữ liệu và kích hoạt thông báo cảnh báo.
- **Acceptance Criteria (AC):**
  - [ ] **Job 1 (Hết hạn gói):** Chạy lúc 08:00 sáng mỗi ngày, quét các `membership_subscriptions` có `end_date` còn đúng 7 ngày; tạo notification `package_expiry`.
  - [ ] **Job 2 (Nhắc lịch học):** Chạy mỗi 30 phút, quét các `class_sessions` diễn ra trong vòng 2 giờ tới; gửi notification `class_reminder` cho toàn bộ hội viên có enrollment `booked`.
- **Kỹ thuật:** Package `notifications`, `@Scheduled`, `@EnableScheduling`, `NotificationScheduler`.

#### 📌 SCRUM-108: [Notification] Tích hợp Bộ điều phối Thông báo Đa kênh (Multi-channel Port)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** Medium | **Thời gian:** 24/10 – 26/10/2026
- **Mô tả:** Thiết lập kiến trúc cổng mở rộng (Port & Adapter) để bắn thông báo qua Mock Email / Webhook / In-app.
- **Acceptance Criteria (AC):**
  - [ ] Interface `NotificationDispatcher` với adapter ghi nhận log email / push giả lập chuẩn chỉnh.
  - [ ] Không làm tắc nghẽn luồng request chính (sử dụng `@Async` của Spring).

#### 📌 SCRUM-109: [Audit] Xây dựng API Quản trị & Tra cứu Nhật ký Kiểm toán (Audit Log Viewer)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 27/10 – 28/10/2026
- **Mô tả:** Cung cấp endpoint cho Quản lý Trung tâm tra cứu 100% các biến động dữ liệu quan trọng trong hệ thống.
- **Acceptance Criteria (AC):**
  - [ ] `GET /api/v1/admin/audit-logs`: Lọc theo `user_id`, `entity_type` (PAYMENT, SUBSCRIPTION, USER...), `action`, khoảng thời gian `from` – `to`.
  - [ ] Hiển thị chi tiết `old_value` và `new_value` dạng JSON có format đẹp mắt.
  - [ ] Phân quyền chặt chẽ: Chỉ `CENTER_MANAGER` mới có quyền truy cập.
- **Kỹ thuật:** Package `audit`, `AuditLogRepository`, Service, Controller.

#### 📌 SCRUM-110: [Security & DevOps] Hoàn thiện CORS, Rate Limiting, Dockerfile & Production Prep
- **Issue Type:** Task | **Story Points:** 3 | **Priority:** Highest | **Thời gian:** 29/10 – 30/10/2026
- **Acceptance Criteria (AC):**
  - [ ] Dockerfile backend 2 giai đoạn (Multi-stage build) dựa trên JDK 21 Alpine dung lượng tối ưu (<250MB).
  - [ ] Cấu hình CORS chặt chẽ theo biến môi trường production, bật Rate Limit cho Auth endpoint.
  - [ ] Rà soát toàn bộ dependencies, không còn lỗ hổng bảo mật nghiêm trọng.

---

### 🟢 AN — Backend (Core Operations & Membership Squad) — 18 Story Points

#### 📌 SCRUM-111: [Attendance] Xây dựng API Điểm danh Buổi học 4 Trạng thái (Session Attendance)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 17/10 – 20/10/2026
- **Mô tả:** Cho phép Huấn luyện viên điểm danh từng học viên tham gia lớp học (`session_attendance`).
- **Acceptance Criteria (AC):**
  - [ ] `GET /api/v1/attendance/sessions/{id}`: Lấy danh sách học viên cần điểm danh trong buổi học.
  - [ ] `POST /api/v1/attendance/sessions/{id}/batch`: Điểm danh hàng loạt học viên với 4 trạng thái chuẩn: `present` (có mặt), `absent` (vắng mặt), `late` (đi muộn), `excused` (vắng có phép).
  - [ ] Ràng buộc duy nhất `UNIQUE(session_id, member_id)`: Không cho phép điểm danh trùng lặp.
  - [ ] Ghi nhận `recorded_by = coach_user_id` và thời gian điểm danh thực tế `checked_in_at`.
- **Kỹ thuật:** Package `attendance`, Entity `SessionAttendance`, Service, Controller.

#### 📌 SCRUM-112: [Scheduler] Xây dựng Tác vụ Tự động Hết hạn Waitlist & Đôn hàng chờ (24h Promotion)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** High | **Thời gian:** 21/10 – 23/10/2026
- **Mô tả:** Tự động giải phóng vị trí hàng chờ khi quá thời hạn giữ chỗ 24h và đôn người tiếp theo lên.
- **Acceptance Criteria (AC):**
  - [ ] Scheduler chạy mỗi 15 phút: Quét các bản ghi `class_waitlists` có `status = 'notified'` nhưng quá 24h chưa bấm xác nhận đặt chỗ.
  - [ ] Chuyển trạng thái sang `expired`, tìm người kế tiếp theo `requested_at ASC` có `status = 'waiting'` và chuyển sang `notified`.
  - [ ] Kích hoạt gửi thông báo in-app mời học viên mới xác nhận đặt lớp.
- **Kỹ thuật:** Package `scheduling`, `WaitlistPromotionScheduler`.

#### 📌 SCRUM-113: [Scheduling] Xử lý Hủy Buổi học bởi HLV & Tự động Thông báo Học viên
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 24/10 – 26/10/2026
- **Mô tả:** Quy trình an toàn khi HLV hoặc Quản lý buộc phải hủy buổi học do sự cố hoặc thời tiết.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/classes/sessions/{id}/cancel`: Yêu cầu nhập lý do hủy `cancel_reason`.
  - [ ] Chuyển `class_sessions.status = 'cancelled'`.
  - [ ] Toàn bộ enrollments đang `booked` tự động chuyển sang `cancelled` và hoàn lại credit lượt học.
  - [ ] Bắn thông báo hàng loạt loại `schedule_change` đến tất cả học viên bị ảnh hưởng.
- **Kỹ thuật:** Package `scheduling`, `ClassSessionService`.

#### 📌 SCRUM-114: [Testing] Kiểm thử Tải (Concurrency) & Kiểm tra Tính Toàn vẹn Dữ liệu Operations
- **Issue Type:** Task | **Story Points:** 3 | **Priority:** High | **Thời gian:** 27/10 – 28/10/2026
- **Acceptance Criteria (AC):**
  - [ ] Viết test đa luồng (ExecutorService) mô phỏng 50 user đồng thời book 1 slot cuối cùng của lớp học.
  - [ ] Kết quả kiểm chứng: Trigger P2 bảo đảm chỉ đúng 1 user thành công, 49 user còn lại nhận lỗi đầy lớp hoặc chuyển vào Waitlist mà không làm rách dữ liệu sĩ số.

#### 📌 SCRUM-115: [Docs] Xuất bản Toàn bộ Postman Collection & Tài liệu API Phân hệ Operations
- **Issue Type:** Task | **Story Points:** 2 | **Priority:** Medium | **Thời gian:** 29/10 – 30/10/2026
- **Acceptance Criteria (AC):**
  - [ ] Xuất bản file Postman Collection JSON hoàn chỉnh cho toàn bộ 5 nhóm API Operations (Catalogs, Subscriptions, Classes, Enrollments, Check-in/Attendance).

---

### 🟠 PHONG — Backend (Finance, System Architecture & AI Squad) — 21 Story Points

#### 📌 SCRUM-116: [Coaching] Xây dựng API Quản lý Kế hoạch Huấn luyện & Bài tập (Training Plans)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 17/10 – 20/10/2026
- **Mô tả:** Cho phép HLV xây dựng giáo án tập luyện chi tiết cho từng học viên (`training_plans`, `training_plan_items`).
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/coaching/training-plans`: Tạo giáo án (gán `member_id`, `goal`, thời gian bắt đầu - kết thúc). Trạng thái khởi tạo: `draft`.
  - [ ] Thêm chi tiết bài tập theo thứ tự (`day_of_week`, `exercise_name`, `sets`, `reps`, `duration_minutes`).
  - [ ] `PUT /api/v1/coaching/training-plans/{id}/activate`: HLV phê duyệt kích hoạt giáo án (`status = 'active'`).
  - [ ] `GET /api/v1/coaching/training-plans/my`: Hội viên xem giáo án bài tập đang hoạt động của mình.
- **Kỹ thuật:** Package `coaching`, Entity `TrainingPlan`, `TrainingPlanItem`, Service, Controller.

#### 📌 SCRUM-117: [AI Engine] Tích hợp AI Gợi ý Giáo án Huấn luyện Cá nhân hóa (/ai/recommend)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 21/10 – 24/10/2026
- **Mô tả:** Động cơ AI phân tích thể trạng của hội viên và sinh ra gợi ý giáo án bài tập phù hợp cho HLV.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/ai/generate-workout-plan`: Tiếp nhận `memberId` và yêu cầu bổ sung của HLV.
  - [ ] Đọc tự động các chỉ số thể chất của hội viên: Chiều cao, cân nặng, BMI, `fitness_goal`, `health_notes` (tiền sử chấn thương).
  - [ ] Tích hợp mô hình AI (OpenAI GPT-4o / Google Gemini) qua Prompt chuẩn, trả về JSON cấu trúc giáo án chuẩn xác.
  - [ ] Lưu vết vào `ai_recommendation_logs` (`input_context`, `recommended_content`, `model_name`).
  - [ ] Khi HLV bấm "Áp dụng vào Giáo án": Tự động điền dữ liệu sang `training_plans` và set `is_ai_generated = 1`, `is_applied = 1`.
- **Kỹ thuật:** Package `ai`, `AiService`, `AiRecommendationLogRepository`.

#### 📌 SCRUM-118: [AI Engine] Xây dựng Trợ lý Ảo AI Chatbot Tư vấn Hội viên 24/7 (AI Chatbot)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 25/10 – 27/10/2026
- **Mô tả:** Trợ lý ảo AI thông minh trả lời thắc mắc của học viên về kỹ thuật bài tập, dinh dưỡng và dịch vụ của trung tâm.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/ai/chat/sessions`: Khởi tạo phiên trò chuyện (`ai_chat_sessions`).
  - [ ] `POST /api/v1/ai/chat/sessions/{id}/messages`: Gửi tin nhắn và nhận câu trả lời thông minh từ AI kèm lưu vết tin nhắn (`ai_chat_messages`).
  - [ ] Thiết lập System Prompt định vị: Trợ lý chuyên gia thể hình của trung tâm SCMS, lịch sự, chuẩn xác, từ chối trả lời nội dung phi thể thao.
  - [ ] `GET /api/v1/ai/chat/sessions/{id}/history`: Lấy lịch sử đoạn chat.
- **Kỹ thuật:** Package `ai`, Entity `AiChatSession`, `AiChatMessage`, Controller.

#### 📌 SCRUM-119: [Coaching] Xây dựng API Đánh giá Buổi tập & Tiến độ Học viên (Evaluations)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 28/10 – 29/10/2026
- **Mô tả:** Ghi nhận đánh giá của HLV sau mỗi buổi tập và cập nhật chỉ số thể chất định kỳ cho học viên.
- **Acceptance Criteria (AC):**
  - [ ] `POST /api/v1/coaching/evaluations`: HLV chấm điểm tiến bộ `progress_score` (1-100), nhận xét kỹ thuật `performance_notes` và phản hồi cho học viên (`session_evaluations`).
  - [ ] `POST /api/v1/health/metrics`: Cập nhật các chỉ số cân nặng, % mỡ, vòng eo... vào `member_progress_logs`.
  - [ ] `GET /api/v1/health/metrics/my`: Trả về dữ liệu chuỗi thời gian để vẽ biểu đồ tiến độ.
- **Kỹ thuật:** Package `coaching`, `health`, Repositories, Services.

#### 📌 SCRUM-120: [Reporting] Xây dựng Báo cáo Công suất Sử dụng & Tỷ lệ Lấp đầy Lớp học
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** Medium | **Thời gian:** 30/10 – 30/10/2026
- **Mô tả:** Cung cấp báo cáo phân tích hiệu suất khai thác phòng tập và tỷ lệ lấp đầy sĩ số các lớp học.
- **Acceptance Criteria (AC):**
  - [ ] `GET /api/v1/reports/class-utilization`: Thống kê tỷ lệ đặt chỗ trung bình (`enrolled / capacity`) theo từng lớp và từng bộ môn.
  - [ ] Thống kê tỷ lệ tham gia thực tế (`present / booked`) dựa trên dữ liệu điểm danh.

---

### 🟣 KHOA — Frontend (Staff & Admin Console) — 16 Story Points

#### 📌 SCRUM-121: [UI Coach] Xây dựng Màn hình Danh sách Lớp & Học viên Phụ trách của HLV
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 17/10 – 19/10/2026
- **Mô tả:** Giao diện chuyên biệt cho HLV xem thời khóa biểu dạy và danh sách học viên đã ghi danh vào từng lớp.
- **Acceptance Criteria (AC):**
  - [ ] Hiển thị lịch dạy theo tuần của HLV đăng nhập.
  - [ ] Xem danh sách học viên trong từng buổi học kèm mục tiêu thể lực (`fitness_goal`) và lưu ý sức khỏe (`health_notes`).
- **Kỹ thuật:** `apps/web/src/features/coaching/CoachClassesPage.tsx`.

#### 📌 SCRUM-122: [UI Coach] Xây dựng Giao diện Soạn Giáo án Bài tập Tích hợp AI Gợi ý
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 20/10 – 24/10/2026
- **Mô tả:** Bàn làm việc số của HLV để thiết kế bài tập, có nút bấm gọi AI trợ lực.
- **Acceptance Criteria (AC):**
  - [ ] Form soạn giáo án theo ngày trong tuần: Tên động tác, số hiệp (sets), số lần lặp (reps), thời gian nghỉ.
  - [ ] Nút "✨ Gợi ý giáo án bằng AI": Mở modal tương tác, hiển thị kết quả phân tích thể trạng và bài tập đề xuất từ AI.
  - [ ] Nút "Áp dụng vào giáo án": Tự động điền dữ liệu gợi ý vào form soạn thảo cho HLV tinh chỉnh trước khi bấm Lưu & Kích hoạt.
- **Kỹ thuật:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx`, tích hợp `aiApi.ts`.

#### 📌 SCRUM-123: [UI Coach] Hoàn thiện Màn hình HLV Điểm danh Buổi học & Đánh giá (Attendance)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 25/10 – 27/10/2026
- **Mô tả:** Kết nối API điểm danh thật trong `CoachAttendancePage.tsx`.
- **Acceptance Criteria (AC):**
  - [ ] Hiển thị danh sách toàn bộ học viên đã book trong buổi học.
  - [ ] Radio button chọn nhanh 4 trạng thái: Có mặt (Xanh) / Vắng mặt (Đỏ) / Đi muộn (Vàng) / Có phép (Xám).
  - [ ] Form con đánh giá nhanh từng học viên: Thang điểm tiến bộ (slider 1-100) và ô nhập nhận xét kỹ thuật.
  - [ ] Nút "Lưu điểm danh & Đánh giá": Gửi dữ liệu batch lên backend và hiển thị toast xác nhận thành công.
- **Kỹ thuật:** `apps/web/src/features/coaching/CoachAttendancePage.tsx`.

#### 📌 SCRUM-124: [UI Manager] Xây dựng Màn hình Giám sát Audit Log & Báo cáo Lấp đầy Lớp
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 28/10 – 30/10/2026
- **Mô tả:** Bảng điều khiển quản trị trung tâm: Xem nhật ký kiểm toán và báo cáo lấp đầy phòng học.
- **Acceptance Criteria (AC):**
  - [ ] Bảng tra cứu Audit Log có phân trang, bộ lọc theo Người thực hiện và Hành động (ACTION).
  - [ ] Modal xem chi tiết thay đổi `old_value` và `new_value` dạng so sánh diff rõ ràng.
  - [ ] Biểu đồ trực quan tỷ lệ lấp đầy phòng học theo bộ môn.
- **Kỹ thuật:** `apps/web/src/features/manager/ManagerAuditLogsPage.tsx`.

---

### 🟡 THỊNH — Frontend (Member Portal & App) — 17 Story Points

#### 📌 SCRUM-125: [UI Member] Xây dựng Màn hình Lịch sử Giao dịch & Hóa đơn Điện tử
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 17/10 – 19/10/2026
- **Mô tả:** Xem lại toàn bộ các khoản thanh toán gói tập/lớp học và xem chi tiết hóa đơn điện tử.
- **Acceptance Criteria (AC):**
  - [ ] Danh sách các giao dịch thanh toán thành công kèm mã giao dịch, số tiền, ngày thanh toán.
  - [ ] Bấm vào giao dịch: Hiển thị Modal Hóa đơn điện tử chi tiết (Mã HĐ, thuế VAT, tổng tiền PERSISTED, nút tải file).
- **Kỹ thuật:** Tạo mới `apps/web/src/features/member/MemberInvoicesPage.tsx`.

#### 📌 SCRUM-126: [UI Member] Tích hợp Trợ lý Trí tuệ Nhân tạo AI Chatbot (LiquidGlass Chatbot)
- **Issue Type:** Story | **Story Points:** 5 | **Priority:** Highest | **Thời gian:** 20/10 – 23/10/2026
- **Mô tả:** Tích hợp component chat sang trọng `LiquidGlassChatbot.tsx` với API AI Chatbot thật.
- **Acceptance Criteria (AC):**
  - [ ] Cửa sổ chat nổi bật với hiệu ứng kính mờ (Liquid Glass shader) sinh động.
  - [ ] Gửi câu hỏi và nhận câu trả lời dạng streaming/typing effect từ AI Assistant.
  - [ ] Lưu lại lịch sử hội thoại của phiên chat hiện tại và hỗ trợ tạo phiên chat mới.
  - [ ] Xử lý mượt mà trạng thái đang chờ AI suy nghĩ (loading dots).
- **Kỹ thuật:** `apps/web/src/shared/liquid-glass/LiquidGlassChatbot.tsx`, `aiChatApi.ts`.

#### 📌 SCRUM-127: [UI Member] Xây dựng Trung tâm Thông báo Đẩy In-App (MemberNotifications)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 24/10 – 25/10/2026
- **Mô tả:** Màn hình trung tâm nhận các thông báo về nhắc lịch học, đổi phòng, hết hạn gói tập.
- **Acceptance Criteria (AC):**
  - [ ] Chuông thông báo trên Navbar hiển thị badge đỏ số tin nhắn chưa đọc.
  - [ ] Trang danh sách thông báo: Phân loại theo icon (Lịch học, Thanh toán, Hệ thống, Hỗ trợ).
  - [ ] Bấm vào thông báo: Đánh dấu đã đọc và điều hướng nhanh đến trang liên quan (ví dụ nhắc lịch -> mở trang Lớp học).
- **Kỹ thuật:** Tạo mới `apps/web/src/features/member/MemberNotificationsPage.tsx`.

#### 📌 SCRUM-128: [UI Member] Xây dựng Màn hình Gửi Yêu cầu Hỗ trợ & Khiếu nại (MemberSupport)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 26/10 – 27/10/2026
- **Mô tả:** Giao diện cho phép hội viên gửi yêu cầu trợ giúp và chat trao đổi trực tiếp với nhân viên sảnh.
- **Acceptance Criteria (AC):**
  - [ ] Form tạo yêu cầu mới (chọn phân loại: Gói tập, Thiết bị, Lịch học, Khác).
  - [ ] Danh sách các phiếu hỗ trợ kèm nhãn trạng thái (Đang chờ / Đang xử lý / Đã giải quyết).
  - [ ] Giao diện nhắn tin trao đổi trực tiếp trong từng phiếu hỗ trợ.
- **Kỹ thuật:** Tạo mới `apps/web/src/features/member/MemberSupportPage.tsx`.

#### 📌 SCRUM-129: [UI Member] Xây dựng Màn hình Theo dõi Tiến độ Thể lực & Giáo án (Progress)
- **Issue Type:** Story | **Story Points:** 3 | **Priority:** High | **Thời gian:** 28/10 – 30/10/2026
- **Mô tả:** Xem giáo án bài tập được HLV giao và biểu đồ trực quan hóa tiến trình cải thiện vóc dáng.
- **Acceptance Criteria (AC):**
  - [ ] Biểu đồ đường (Line Chart) theo dõi biến động Cân nặng & Chỉ số BMI qua các tuần.
  - [ ] Danh sách bài tập cần thực hiện trong ngày được đồng bộ từ `training_plans` của HLV.
  - [ ] Checkbox đánh dấu hoàn thành bài tập về nhà.
- **Kỹ thuật:** Tạo mới `apps/web/src/features/member/MemberProgressPage.tsx`.

---

# TỔNG KẾT PHÂN BỔ TẢI CÔNG VIỆC TOÀN DỰ ÁN

## 1. Ma trận Story Points qua 3 Sprint

| Thành viên | Phân hệ chính đảm nhiệm | Sprint 1 (Xong) | Sprint 2 | Sprint 3 | Tổng Points | Đánh giá tải |
|---|---|:---:|:---:|:---:|:---:|:---:|
| **🔵 Tài** | Identity, RBAC, Support, Notifications, Security | 9 tickets | 19 pts (5 tickets) | 19 pts (5 tickets) | **38 pts** | Cân bằng lý tưởng |
| **🟢 An** | Catalogs, Subscriptions, Scheduling, Check-in, Attendance | 9 tickets | 23 pts (5 tickets) | 18 pts (5 tickets) | **41 pts** | Đã giảm tải Sprint 2 |
| **🟠 Phong** | Architecture, Finance, Invoices, Triggers, AI Engine | 10 tickets | 22 pts (6 tickets) | 21 pts (5 tickets) | **43 pts** | Tăng 5 điểm do SCRUM-91; cần rà soát tải |
| **🟣 Khoa** | Frontend Staff & Admin Console (Classes, Reception, Reports) | 3 screens | 18 pts (4 tickets) | 16 pts (4 tickets) | **34 pts** | Cân bằng lý tưởng |
| **🟡 Thịnh** | Frontend Member App (Dashboard, Packages, Classes, AI Chat) | 3 screens | 16 pts (4 tickets) | 17 pts (5 tickets) | **33 pts** | Cân bằng lý tưởng |
| **TỔNG CỘNG** | **Toàn bộ hệ thống SCMS** | **31 tasks** | **104 pts theo Jira; 98 pts / 24 tickets đã liệt kê** | **91 pts (23 tickets)** | **195 pts theo tổng Jira; 189 pts đã liệt kê** | **Sprint 2 vượt cam kết 11 điểm; cần đối soát 6 điểm** |

---

## 2. Hướng dẫn nhanh đưa Kế hoạch lên Jira (Jira Import Guide)

1. **Tạo Sprint:**
   - Tạo **Sprint 2** (Start: `03/10/2026`, End: `16/10/2026`, Goal: *Subscriptions, Scheduling, Billing & Check-in*).
   - Tạo **Sprint 3** (Start: `17/10/2026`, End: `30/10/2026`, Goal: *AI Engine, Coaching, Notifications & System Polish*).
2. **Tạo Issue:**
   - Copy chính xác **Mã Jira**, **Issue Type**, **Tiêu đề (Summary)**, **Story Points**, và **Assignee** từ bảng tổng hợp trên.
   - Dán toàn bộ nội dung mục **Mô tả & Acceptance Criteria (AC)** vào ô Description trên Jira (Jira Markdown hỗ trợ đầy đủ checkbox `- [ ]`).
3. **Quy tắc làm việc hàng ngày:**
   - Khi bắt đầu làm ticket: Chuyển trạng thái từ `TO DO` sang `IN PROGRESS`.
   - Tạo branch git theo chuẩn: `git checkout -b <Mã_Jira>/<tên-ngắn-gọn>` (ví dụ: `SCRUM-71/membership-subscriptions`).
   - Kiểm tra `./mvnw test` và `npm test` trước khi tạo Pull Request và chuyển trạng thái sang `IN REVIEW`.



