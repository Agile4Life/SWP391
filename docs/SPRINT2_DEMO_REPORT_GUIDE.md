# KỊCH BẢN BÁO CÁO SPRINT 2 THEO TÍNH NĂNG (UI/UX + BACKEND + DATABASE)
# Sports Center Management System (SWP391 — GROUP 1)

> **Phương pháp trình bày:** Thay vì tách rời "Backend nói riêng – Frontend nói riêng", nhóm trình bày theo **6 Cụm Tính Năng End-to-End (Vertical Slices)**.
> Ở mỗi tính năng: **Demo trực tiếp thao tác trên Giao diện UI/UX trước → Giải thích ngay luồng API, Nghiệp vụ Service và Ràng buộc Database (Trigger/Index/Computed Column) phía sau thao tác đó**.
> Đồng thời, tài liệu chia rõ **kịch bản của từng thành viên (Tài, An, Phong, Khoa, Thịnh)** để ai lên trình bày cũng nắm vững cả **UI/UX lẫn Backend** của tính năng.

---

## PHẦN 1: TỔNG QUAN SPRINT 2 & CHUẨN BỊ MÔI TRƯỜNG

### 1.1. Tóm tắt kết quả Sprint 2 (Mở đầu 1 phút)
- **Mục tiêu Sprint 2 (Core Business Flow):** Hoàn thiện trọn vẹn chuỗi giá trị cốt lõi của trung tâm thể thao:
  1. **Quản lý lớp học & Xếp lịch HLV** (Chống trùng lịch phòng/HLV bằng Trigger P3).
  2. **Mua & Gia hạn Gói tập Online / Tại quầy Lễ tân POS** (Tự động kích hoạt gói & phát hành Hóa đơn điện tử `INV-...`).
  3. **Thẻ hội viên điện tử & Quét mã QR Check-in/Check-out sảnh** (Kiểm soát hạn thẻ bằng Trigger P4).
  4. **Đặt chỗ lớp học & Hàng chờ thông minh Waitlist** (Kiểm soát sĩ số bằng Pessimistic Lock + Trigger P2).
  5. **Báo cáo doanh thu trung tâm & Lưu trữ Snapshot JSONB**.
  6. **Hồ sơ nhân sự (Coach/Receptionist), Thông báo In-App, Phiếu hỗ trợ (Support Ticket), Bảo mật RBAC 2 lớp & Chuyển đổi CSDL sang Supabase PostgreSQL Code-First**.
- **Khối lượng hoàn thành:** **24 Jira Tickets / 98 Story Points** (`SCRUM-66` → `SCRUM-88` và `SCRUM-91`).
- **Chất lượng kiểm thử:**
  - **Backend (`apps/api`):** `358 / 358` Unit & Integration Tests **PASS** (`.\mvnw.cmd test`), `10 / 10` kiểm tra chính sách Supabase **PASS**.
  - **Frontend (`apps/web`):** `19 / 19` Test Suites (`104 / 104` tests) **PASS**, `0` lỗi ESLint, Production Build **PASS**.

### 1.2. Chuẩn bị máy tính trước khi vào báo cáo 10 phút
```powershell
# Khởi chạy cả Backend (8080) và Frontend (5173)
npm start
```
**Mở sẵn 3 cửa sổ trên màn hình:**
1. **Trình duyệt 1 (Chế độ thường — Vai trò Nhân viên / Quản lý):** Đăng nhập sẵn `CENTER_MANAGER` / `RECEPTIONIST` tại `http://localhost:5173`.
2. **Trình duyệt 2 (Chế độ ẩn danh — Vai trò Hội viên):** Đăng nhập sẵn `MEMBER` tại `http://localhost:5173`.
3. **Trình duyệt 3 (Swagger UI + IDE):** Mở `http://localhost:8080/swagger-ui/index.html` và mở sẵn VS Code / IntelliJ để chỉ vào code Backend khi cô hỏi.

---

## PHẦN 2: KỊCH BẢN TRÌNH BÀY THEO 6 TÍNH NĂNG (UI/UX + BACKEND ĐẦY ĐỦ)

---

### 🏆 TÍNH NĂNG 1: QUẢN LÝ LỚP HỌC & XẾP LỊCH HUẤN LUYỆN VIÊN (CHỐNG TRÙNG LỊCH)
- **Mã Jira:** `SCRUM-81` (Frontend UI) + `SCRUM-72` (Backend API & Trigger P3)
- **Người trình bày cặp:** **Khoa (Demo UI/UX)** ↔ **An (Giải thích Backend & Trigger P3)**

#### Bước 1: Demo Giao diện UI/UX (`/staff/classes` — Khoa trình bày)
1. **Giao diện & Trạng thái UI/UX:**
   - Mở màn hình **Quản lý Lớp học & Lịch dạy (`/staff/classes`)** trong `apps/web/src/features/classes/StaffClassesPage.tsx`.
   - Giới thiệu bố cục: Bộ lọc theo trạng thái lớp (`Đang hoạt động / Tạm ngưng`), danh sách lớp học kèm sĩ số tối đa, tên HLV, phòng tập và lịch các buổi học (`sessions`).
   - Nhấn mạnh chuẩn UX: Có `Loading Skeleton` khi tải, `Empty State` khi chưa có lớp, `Error State + nút Thử lại`, và chặn `403 Forbidden` nếu hội viên cố truy cập.
2. **Thao tác 1 — Tạo lớp & Xếp buổi học mới (Happy Path):**
   - Bấm **"Mở lớp học mới"** → Chọn Bộ môn (*Reformer Pilates*), Phòng tập (*Studio 01*), Huấn luyện viên, Sĩ số tối đa (`12`), Ngày học và Khung giờ (`08:00 - 09:00`).
   - Bấm **Lưu** → Giao diện gọi liên tiếp `POST /api/v1/classes` và `POST /api/v1/classes/{id}/sessions` (trong `classesApi.ts`), hiện Toast thành công và cập nhật ngay buổi học lên màn hình.
3. **Thao tác 2 — Demo bắt lỗi Trùng lịch trên UI (Conflict Case):**
   - Bấm xếp thêm 1 buổi học khác dùng **cùng Phòng tập (*Studio 01*)** hoặc **cùng HLV** trong khung giờ giao nhau (`08:30 - 09:30` cùng ngày).
   - Giao diện lập tức hiển thị **Toast cảnh báo đỏ** từ thông điệp đa ngôn ngữ của Backend: *"Lịch học bị trùng phòng tập hoặc huấn luyện viên trong khung giờ này"*.

#### Bước 2: Giải thích Backend & Database phía sau (`SCRUM-72` — An trình bày)
1. **Luồng API & Validation (`ClassController.java` & `ClassService.java`):**
   - Mở `apps/api/src/main/java/com/swp391/scms/scheduling/ClassController.java`: Chỉ có `CENTER_MANAGER` mới có quyền gọi `@PostMapping` tạo lớp/xếp lịch (`@PreAuthorize("hasRole('CENTER_MANAGER')")`).
   - Mở `ClassService.java`:
     - Kiểm tra `startTime.isBefore(endTime)` (giờ bắt đầu phải trước giờ kết thúc).
     - Kiểm tra phòng tập phải đang ở trạng thái `available` (nếu phòng đang `maintenance` sẽ chặn ngay với lỗi `error.scheduling.room_unavailable`).
     - Kiểm tra HLV phải đang hoạt động (`status = 'active'`, `deletedAt == null`).
2. **Bất biến Database Trigger P3 (`PostgreSqlTriggerProvider.java`):**
   - Mở `apps/api/src/main/java/com/swp391/scms/config/PostgreSqlTriggerProvider.java`:
   - Giải thích: Ngay cả khi có 2 quản lý bấm xếp lịch cùng một thời điểm, trigger PL/pgSQL **`trg_sessions_check_conflict` (Trigger P3)** dưới Supabase PostgreSQL sẽ kiểm tra điều kiện giao thoa thời gian `(start_time < NEW.end_time AND end_time > NEW.start_time)` cho cả `room_id` và `coach_id`.
   - Nếu trùng, PostgreSQL raise exception và `GlobalExceptionHandler` / `ClassService` dịch sang HTTP `409 Conflict` kèm key i18n `error.scheduling.session_conflict`.

---

### 🏆 TÍNH NĂNG 2: MUA / GIA HẠN GÓI TẬP (ONLINE & QUẦY POS) + HÓA ĐƠN ĐIỆN TỬ & HOÀN TIỀN
- **Mã Jira:** `SCRUM-85`, `SCRUM-86` (UI Member) + `SCRUM-82` (UI Quầy Lễ tân POS) + `SCRUM-71` (Backend Subscription) + `SCRUM-76`, `SCRUM-77`, `SCRUM-78` (Backend Payment, Invoice, Refund)
- **Người trình bày:** **Thịnh (UI Member)** + **Khoa (UI Lễ tân POS)** + **Phong & An (Backend Finance & Membership)**

#### Bước 1: Demo UI/UX Hội viên tự mua/gia hạn gói tập (`/member` & `/member/packages` — Thịnh trình bày)
1. **Trang Tổng quan Hội viên (`/member` — `MemberDashboardPage.tsx`):**
   - Khi hội viên chưa có gói tập: Hiển thị banner *Quiet Luxury Empty State* với nút CTA **"Khám phá các gói tập ngay"**.
   - Khi đã có gói tập: Hiển thị thẻ tóm tắt gói hiện tại, số ngày còn hạn, thanh tiến trình thời gian (`progress bar`) và lịch tập sắp tới.
2. **Màn hình Danh mục & Mua/Gia hạn Gói tập (`/member/packages` — `MemberPackagesPage.tsx`):**
   - Hiển thị 3 hạng gói tập (*The Essential*, *The Sanctuary VIP*, *The Sovereign Annual*) kèm giá tiền, số ngày hiệu lực và quyền lợi.
   - Bấm **"Đăng ký gói"** (hoặc **"Gia hạn"**) → Mở **Modal Thanh toán Chuyển khoản** hiển thị mã QR ngân hàng, số tiền và nội dung chuyển khoản tự động.
   - Bấm **"Tôi đã chuyển khoản"** → Gửi request qua `membershipApi.ts` (`POST /api/v1/memberships/subscriptions/purchase` + `POST /api/v1/payments/process`), gói tập lập tức chuyển sang **`ACTIVE`** ngay trên giao diện.

#### Bước 2: Demo UI/UX Lễ tân bán gói tại quầy POS & Xuất Hóa đơn (`/staff/reception` — Khoa trình bày)
1. Mở màn hình **Quầy Lễ tân & Thu ngân (`/staff/reception` — `StaffReceptionPage.tsx`)**:
   - **Ô tra cứu nhanh:** Nhập SĐT hoặc tên hội viên → Gọi `GET /api/v1/members/lookup` trả về thông tin hội viên và trạng thái gói hiện tại.
   - **Form Thu ngân POS:** Chọn gói tập khách muốn mua tại quầy → Chọn phương thức thanh toán (*Tiền mặt / Quẹt thẻ POS / Chuyển khoản*).
   - Bấm **"Xác nhận thu tiền"** → Gọi `POST /api/v1/payments/process` kèm `packageId` → Bật ngay **Popup Hóa đơn điện tử (`INV-YYYYMMDD-XXXXX`)** hiển thị tiền trước thuế, thuế VAT, tổng tiền thanh toán và nút **In hóa đơn**.

#### Bước 3: Giải thích Backend & Database phía sau (`SCRUM-71, 76, 77, 78` — Phong & An trình bày)
1. **Vòng đời Gói tập & Cộng dồn ngày gia hạn (`MembershipSubscriptionService.java` — An):**
   - Khi mua mới hoặc gia hạn (`renewSubscription`), hệ thống liên kết `previousSubscription`. Nếu gói cũ vẫn còn hạn (`endDate >= today`), ngày bắt đầu gói mới tự động nối tiếp `currentEndDate.plusDays(1)` để hội viên không mất ngày tập còn dư.
2. **Xử lý Thanh toán nguyên tử (`PaymentService.java` — Phong):**
   - Mở `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java`:
   - Trong một `@Transactional` duy nhất:
     1. Kiểm tra số tiền thanh toán phải khớp 100% với giá gói tập (`error.finance.payment.amount_mismatch`).
     2. Chuyển trạng thái Payment sang `success`.
     3. Tự động gọi `subscriptionService.activateSubscription(...)` để chuyển gói từ `pending_payment` sang `active`, tính `endDate = startDate + durationDays` và sinh mã `qrCode` định danh duy nhất.
     4. Tự động gọi `invoiceService.issueForPayment(...)` phát hành Hóa đơn điện tử.
3. **Hóa đơn điện tử & Cột tính toán tự động PostgreSQL (`Invoice.java` & `InvoiceItem.java` — Phong):**
   - Mở `Invoice.java` và `InvoiceItem.java`:
   - Chỉ ra `@GeneratedColumn("subtotal_amount + tax_amount")` trên `Invoice.totalAmount` và `@GeneratedColumn("quantity * unit_price")` trên `InvoiceItem.amount`. PostgreSQL tự tính và lưu trữ (`GENERATED ALWAYS AS ... STORED`), đảm bảo không bao giờ sai lệch số liệu kế toán.
4. **Quy trình Hoàn tiền & Hủy dịch vụ (`POST /api/v1/payments/{id}/refund` — Phong):**
   - Mở hàm `refundPayment` trong `PaymentService.java` (có thể bấm thử trên Swagger UI):
   - Khi quản lý/lễ tân hoàn tiền giao dịch `success`, hệ thống chuyển Payment sang `refunded`, tự động hủy (`cancelled`) gói tập hoặc lượt đặt lớp liên kết, và AOP `AuditAspect` tự động ghi vết vào bảng `audit_logs`.

---

### 🏆 TÍNH NĂNG 3: THẺ HỘI VIÊN ĐIỆN TỬ & QUÉT MÃ QR CHECK-IN SẢNH (TRIGGER P4)
- **Mã Jira:** `SCRUM-87` (UI Thẻ hội viên) + `SCRUM-83` (UI Quét QR Sảnh) + `SCRUM-71`, `SCRUM-75` (Backend QR & Check-in)
- **Người trình bày:** **Thịnh (UI Thẻ hội viên)** ↔ **Khoa (UI Quét QR Sảnh)** ↔ **An (Backend Check-in & Trigger P4)**

#### Bước 1: Demo UI/UX Thẻ Hội viên Điện tử (`/member/card` — Thịnh trình bày)
1. Mở màn hình **Thẻ Hội viên Điện tử (`/member/card` — `MemberCardPage.tsx`)**:
   - Hiển thị thiết kế thẻ hội viên số: Họ tên, Mã hội viên, Hạng gói tập, Thời hạn (`startDate` – `endDate`) và **Mã QR Code** render trực tiếp từ chuỗi `subscription.qrCode` của Backend.
   - **Cơ chế cảnh báo thị giác theo hạn thẻ:**
     - Gói đang hoạt động bình thường: Viền và badge màu **Xanh (Active)**.
     - Gói còn $\le 7$ ngày: Đổi sang màu **Vàng cảnh báo (Expiring Soon)** nhắc gia hạn.
     - Gói đã hết hạn hoặc chưa thanh toán: Khóa mã QR, đổi sang trạng thái **Hết hạn (Expired)** kèm nút điều hướng sang trang Gia hạn gói.
   - Bấm nút **"Tải thẻ về máy"** (xuất ảnh thẻ PNG) và bấm **Sao chép mã QR** để chuyển sang quầy Lễ tân quét thử.

#### Bước 2: Demo UI/UX Quầy Lễ tân Quét QR Check-in (`/staff/checkin` — Khoa trình bày)
1. Mở màn hình **Quét QR Check-in Sảnh (`/staff/checkin` — `StaffCheckInPage.tsx`)**:
   - **Trường hợp 1 — Quét mã QR hợp lệ (`GRANTED`):**
     - Dán mã QR vừa copy từ thẻ của Hội viên vào ô máy quét và nhấn Enter.
     - Giao diện gọi `POST /api/v1/check-in/scan` (qua `checkinApi.ts`), lập tức hiển thị **Thẻ trạng thái GRANTED (Màu Xanh)** kèm tên hội viên, gói tập đang dùng, thời gian vào cổng.
     - Bảng **Lịch sử 10 lượt quét gần nhất** bên dưới tự động cập nhật thêm dòng vừa quét.
     - Bấm nút **"Check-out"** ngay trên dòng lịch sử → Gọi `POST /api/v1/check-in/{id}/checkout` ghi nhận giờ hội viên rời trung tâm.
   - **Trường hợp 2 — Quét mã QR hết hạn hoặc không hợp lệ (`DENIED`):**
     - Nhập mã QR của gói đã hết hạn hoặc mã sai → Hiển thị **Thẻ trạng thái DENIED (Màu Đỏ)** kèm lý do từ chối cụ thể do Backend trả về (*"Gói tập đã hết hạn"*, *"Tài khoản không hoạt động"*...).

#### Bước 3: Giải thích Backend & Database phía sau (`SCRUM-75` — An trình bày)
1. Mở `apps/api/src/main/java/com/swp391/scms/attendance/service/CheckInService.java`:
   - Khi nhận chuỗi `qrCode`, hệ thống dùng khóa bi quan (`findByQrCodeForUpdate`) để chặn lỗi quét đúp 2 lần liên tiếp trong cùng 1 giây tại cổng barrier.
   - Kiểm tra tuần tự: Tài khoản hội viên còn hoạt động (`status = 'active'`, `deletedAt == null`), trạng thái gói tập là `active`, và ngày hiện tại nằm trong khoảng `[startDate, endDate]`.
   - Nếu vi phạm, hệ thống vẫn lưu vết lượt quét thất bại với `status = DENIED` và `denyReason` đa ngôn ngữ (`MessageService`) để quản lý tra cứu an ninh.
2. **Bất biến Database Trigger P4 (`trg_checkins_check_membership`):**
   - Dưới tầng PostgreSQL, Trigger P4 kiểm tra chéo một lần nữa: nếu bản ghi `center_checkins` mang trạng thái `GRANTED` nhưng hội viên không có gói `active` còn hạn, Database sẽ chặn ngay lập tức.

---

### 🏆 TÍNH NĂNG 4: THỜI KHÓA BIỂU, ĐẶT CHỖ LỚP HỌC & HÀNG CHỜ THÔNG MINH (WAITLIST)
- **Mã Jira:** `SCRUM-88` (UI Member Classes) + `SCRUM-73` (Backend Enrollment) + `SCRUM-74` (Backend Waitlist)
- **Người trình bày:** **Thịnh (Demo UI/UX)** ↔ **An (Giải thích Backend & Trigger P2/P4)**

#### Bước 1: Demo Giao diện UI/UX Đặt lớp & Hàng chờ (`/member/classes` — Thịnh trình bày)
1. Mở màn hình **Thời khóa biểu & Đặt chỗ (`/member/classes` — `MemberClassesPage.tsx`)**:
   - **Bộ lọc trực quan:** Lọc các buổi học theo Bộ môn (*Pilates, Yoga, Boxing...*) và theo Ngày.
   - **Trường hợp 1 — Lớp còn chỗ trống (`enrolledCount < capacity`):**
     - Hiển thị sĩ số thực tế (ví dụ `5/12 học viên`) và nút **"Đặt chỗ ngay"**.
     - Bấm **"Đặt chỗ ngay"** → Gọi `POST /api/v1/classes/sessions/{id}/enroll` → Sĩ số tăng lên `6/12`, nút đổi thành badge **"Đã đặt chỗ"**.
   - **Trường hợp 2 — Lớp đã đầy sĩ số (`enrolledCount == capacity`):**
     - Khi lớp đạt `12/12`, giao diện tự động ẩn nút Đặt chỗ và hiển thị nút **"Tham gia hàng chờ (Waitlist)"**.
     - Bấm **"Tham gia hàng chờ"** → Gọi `POST /api/v1/classes/sessions/{id}/waitlist` → Hiển thị vị trí xếp hàng (`Position #1`) của hội viên.
   - **Trường hợp 3 — Quản lý lịch cá nhân & Hủy đặt chỗ / Rút hàng chờ:**
     - Xem danh sách các lớp đã đặt và đang chờ → Bấm **"Hủy đặt chỗ"** (`DELETE /api/v1/classes/enrollments/{id}`) hoặc **"Rút khỏi hàng chờ"** (`DELETE /api/v1/classes/waitlists/{id}`), sĩ số lớp lập tức được giải phóng.

#### Bước 2: Giải thích Backend & Database phía sau (`SCRUM-73, 74` — An trình bày)
1. Mở `EnrollmentService.java` và `WaitlistService.java`:
   - **Chặn đặt lịch quá khứ:** Kiểm tra buổi học chưa diễn ra (`sessionDate` và `startTime` phải ở tương lai).
   - **Kiểm tra điều kiện gói tập (Trigger P4):** Hội viên bắt buộc phải có gói tập `active` và ngày học `sessionDate` phải nằm trong thời hạn gói `[startDate, endDate]`. Nếu gói hết hạn trước ngày học, ném `ForbiddenException` (`error.scheduling.membership_expired_or_inactive`).
   - **Chống vượt sĩ số khi tranh chấp đồng thời (Trigger P2 + Lock):**
     - Tầng Service khóa dòng buổi học bằng `sessionRepository.findByIdForUpdate(sessionId)`.
     - Tầng PostgreSQL có **Trigger P2 (`trg_enrollments_check_capacity`)** đếm số lượng `booked` thực tế; nếu `>= capacity` sẽ rollback và trả về `409 Conflict` (`error.scheduling.class_full`).
   - **Partial Unique Index (`uq_enrollment_active` & `uq_waitlist_active`):**
     - Chặn 1 hội viên đặt trùng 2 lần vào cùng 1 buổi học khi trạng thái đang là `booked` hoặc `waiting`, nhưng **cho phép đặt lại** nếu lần trước đã `cancelled`.
   - **Tự động làm sạch hàng chờ:** Khi hội viên được ghi danh chính thức vào lớp, hệ thống tự động đóng các bản ghi `waiting` của hội viên đó trong cùng buổi học.

---

### 🏆 TÍNH NĂNG 5: BÁO CÁO DOANH THU TRUNG TÂM & LƯU TRỮ SNAPSHOT (`JSONB`)
- **Mã Jira:** `SCRUM-84` (UI Manager Reports) + `SCRUM-79` (Backend Revenue Reports)
- **Người trình bày:** **Khoa (Demo UI/UX)** ↔ **Phong (Giải thích Backend & JSONB Snapshot)**

#### Bước 1: Demo Giao diện UI/UX Báo cáo Doanh thu (`/manager/reports` — Khoa trình bày)
1. Mở màn hình **Báo cáo Doanh thu Trung tâm (`/manager/reports` — `ManagerReportsPage.tsx`)**:
   - **Bộ lọc kỳ báo cáo:** Chọn khoảng thời gian (*7 ngày qua / 30 ngày qua / Tháng này*) hoặc nhập ngày `from` – `to`.
   - **4 Thẻ KPI Tổng quan:** Tổng doanh thu kỳ, Tổng số giao dịch/gói bán ra, Doanh thu trung bình ngày, Tỷ lệ gói chủ lực.
   - **Biểu đồ cột Doanh thu theo ngày (`Daily Revenue Chart`):** Tự động co giãn chiều cao cột theo ngày cao điểm nhất; nếu kỳ chưa phát sinh doanh thu sẽ hiển thị `Empty State` rõ ràng.
   - **Bảng Tỷ trọng Doanh thu theo Gói tập (`Revenue by Package`):** Thống kê từng gói (*The Essential, The Sanctuary VIP, The Sovereign Annual*) bán được bao nhiêu lượt và chiếm bao nhiêu % doanh thu.
   - **Tạo bản chụp đối soát (`Generate Snapshot`):** Bấm nút **"Lưu Snapshot"** → Gọi `POST /api/v1/reports/snapshots/generate`, hiện Toast xác nhận đã lưu ảnh chụp báo cáo xuống Database.

#### Bước 2: Giải thích Backend & Database phía sau (`SCRUM-79` — Phong trình bày)
1. Mở `ReportController.java`, `RevenueReportService.java` và `ReportSnapshot.java`:
   - Chỉ `CENTER_MANAGER` mới được phép truy cập các API `/api/v1/reports/**`.
   - Kiểm tra tính hợp lệ của kỳ báo cáo: nếu `from > to` sẽ ném `BadRequestException` (`error.reports.invalid_period`).
   - Khi gọi `generateSnapshot`, hệ thống tổng hợp toàn bộ dữ liệu doanh thu ngày + doanh thu theo gói, đóng gói thành cấu trúc JSON và lưu vào cột **`payload_json` kiểu `jsonb` của PostgreSQL** trên bảng `report_snapshots`, đồng thời ghi nhận `generatedBy` từ `@AuthenticationPrincipal` và kiểm tra ràng buộc `@Check(name = "ck_report_type")` (`revenue | membership | class_utilization`).

---

### 🏆 TÍNH NĂNG 6: HỒ SƠ NHÂN SỰ, THÔNG BÁO IN-APP, PHIẾU HỖ TRỢ, BẢO MẬT RBAC & SUPABASE CODE-FIRST
- **Mã Jira:** `SCRUM-66`, `SCRUM-67`, `SCRUM-68`, `SCRUM-69`, `SCRUM-70` (Tài) + `SCRUM-80`, `SCRUM-91` (Phong)
- **Người trình bày:** **Tài (Demo Swagger UI + Backend Identity/Notification/Support/Security)** ↔ **Phong (Kiến trúc Supabase PostgreSQL Code-First & Trigger Tests)**

#### Bước 1: Demo Giao diện & Swagger UI cho Hồ sơ, Thông báo, Phiếu hỗ trợ & RBAC (Tài trình bày)
1. **Demo Phân quyền 403 trên Web UI & API (`SCRUM-69`):**
   - Trên trình duyệt của **Member**, thử truy cập đường dẫn `/manager/reports` hoặc `/staff/reception` → Giao diện chặn ngay bằng màn hình **403 Forbidden Guard**, và nếu gọi API trực tiếp cũng bị chặn bởi `SecurityConfig` + `@PreAuthorize` với phản hồi JSON chuẩn `ApiResponse` (hỗ trợ cả Tiếng Việt `Accept-Language: vi` và Tiếng Anh `Accept-Language: en`).
2. **Demo Luồng Phiếu hỗ trợ (Support Ticket) kết hợp Thông báo In-App trên Swagger UI (`SCRUM-67`, `SCRUM-68`):**
   - Mở `http://localhost:8080/swagger-ui/index.html`:
     1. **Member gửi phiếu hỗ trợ:** Gọi `POST /api/v1/support/requests` với `subject` và `description` → Trả về `201 Created`, trạng thái khởi tạo `open`.
     2. **Lễ tân / Quản lý xử lý phiếu:** Gọi `PATCH /api/v1/support/requests/{id}/status` chuyển trạng thái theo đúng State Machine (`open` → `in_progress` → `resolved` → `closed`).
     3. **Tự động bắn Thông báo In-App:** Ngay khi phiếu đổi trạng thái, `SupportRequestService` tự động gọi `NotificationService.send(...)`.
     4. **Member kiểm tra hộp thư:** Gọi `GET /api/v1/notifications/unread-count` (tăng lên 1) và `GET /api/v1/notifications` (có lọc theo `read=false`), sau đó gọi `PATCH /api/v1/notifications/{id}/read` để đánh dấu đã đọc.
3. **Demo Cập nhật Hồ sơ chuyên biệt Coach & Receptionist (`SCRUM-66`):**
   - Mở `ProfileController.java`, `Coach.java` và `Receptionist.java`:
   - Giải thích thiết kế kế thừa **Table-per-Type (TPT)** dùng `@MapsId` nối khóa chính với bảng `users`:
     - `PUT /api/v1/profile/coach`: HLV cập nhật chuyên môn (`specialization`), chứng chỉ (`certification`), tiểu sử (`bio`).
     - `PUT /api/v1/profile/receptionist` & `PUT /api/v1/users/{id}/receptionist`: Lễ tân tự cập nhật hoặc Quản lý phân ca trực (`shift`).

#### Bước 2: Trình bày Kiến trúc Supabase PostgreSQL Code-First & Kiểm thử Tự động (`SCRUM-91`, `SCRUM-80`, `SCRUM-70` — Phong & Tài trình bày)
1. **Kiến trúc Code-First & Đa hình Trigger (`SCRUM-91` — Phong):**
   - Mở `PostgreSqlTriggerProvider.java`, `CodeFirstSchemaTest.java` và `DatabasePolicyTest.java`:
   - Toàn bộ 34 bảng CSDL được khởi tạo tự động từ JPA Entities (`hibernate.ddl-auto: update`) trên Supabase PostgreSQL qua kết nối TLS Pooler.
   - Tự động bật **Row Level Security (RLS)** trên cả 34 bảng để bảo vệ dữ liệu khỏi truy cập trái phép qua Supabase Data API.
2. **Bộ Kiểm thử Tự động 100% Pass (`SCRUM-80` & `SCRUM-70` — Phong & Tài):**
   - Mở kết quả chạy test (`358` tests Backend + `104` tests Frontend):
   - Chỉ ra `SupabaseTriggerIntegrationTest.java` (kiểm chứng trực tiếp Trigger P2, P3, P4 trên schema PostgreSQL biệt lập) và `MethodSecurityPolicyTest.java` / `OperationsSecurityRegressionTest.java` (kiểm chứng ma trận phân quyền RBAC trên toàn bộ Controllers).

---

## PHẦN 3: BẢNG TÓM TẮT CÁ NHÂN (AI NÓI PHẦN NÀO & MỞ FILE NÀO)

| Thành viên | Vai trò trong buổi Demo | Các Tính năng tham gia trình bày | Màn hình UI / Swagger cần thao tác | File Code chính cần mở sẵn trên IDE |
|---|---|---|---|---|
| **🟣 Khoa** | Frontend Staff & Manager (`18 SP` — `SCRUM-81..84`) | **Tính năng 1, 2, 3, 5** (Phần UI Nhân viên & Quản lý) | 1. `/staff/classes` (Tạo lớp, xếp lịch, báo lỗi trùng lịch)<br>2. `/staff/reception` (Tra cứu SĐT, thu tiền POS, in hóa đơn)<br>3. `/staff/checkin` (Quét QR `GRANTED`/`DENIED`, Check-out)<br>4. `/manager/reports` (4 KPI, biểu đồ cột, lưu Snapshot) | `StaffClassesPage.tsx`, `classesApi.ts`<br>`StaffReceptionPage.tsx`, `receptionApi.ts`<br>`StaffCheckInPage.tsx`, `checkinApi.ts`<br>`ManagerReportsPage.tsx`, `reportsApi.ts` |
| **🟡 Thịnh** | Frontend Member Portal (`16 SP` — `SCRUM-85..88`) | **Tính năng 2, 3, 4** (Phần UI Hội viên) | 1. `/member` (Dashboard tiến trình gói & lịch sắp tới)<br>2. `/member/packages` (Chọn gói, Modal QR chuyển khoản, gia hạn)<br>3. `/member/card` (Thẻ số, đổi màu theo hạn, tải ảnh PNG, copy QR)<br>4. `/member/classes` (Lọc bộ môn, Đặt chỗ, vào Waitlist, Hủy lịch) | `MemberDashboardPage.tsx`<br>`MemberPackagesPage.tsx`, `membershipApi.ts`<br>`MemberCardPage.tsx`, `memberCardApi.ts`<br>`MemberClassesPage.tsx`, `memberClassesApi.ts` |
| **🟢 An** | Backend Operations (`23 SP` — `SCRUM-71..75`) | **Tính năng 1, 2, 3, 4** (Phần Backend Gói tập, Lớp học, Waitlist, Check-in) | Hỗ trợ chỉ log/response API khi Khoa & Thịnh bấm trên UI | `MembershipSubscriptionService.java`<br>`ClassService.java`<br>`EnrollmentService.java`<br>`WaitlistService.java`<br>`CheckInService.java` |
| **🟠 Phong** | Backend Finance, Reports & DB (`22 SP` — `SCRUM-76..80, 91`) | **Tính năng 2, 5, 6** (Phần Backend Thanh toán, Hóa đơn, Hoàn tiền, Báo cáo, Supabase DB) | Demo `POST /api/v1/payments/{id}/refund` trên Swagger UI + Mở cấu trúc Trigger/RLS | `PaymentService.java`<br>`InvoiceService.java`, `Invoice.java`<br>`RevenueReportService.java`, `ReportSnapshot.java`<br>`PostgreSqlTriggerProvider.java`<br>`SupabaseTriggerIntegrationTest.java` |
| **🔵 Tài** | Backend Identity, Notification, Support & Security (`19 SP` — `SCRUM-66..70`) | **Tính năng 6** (Hồ sơ nhân sự, Thông báo, Phiếu hỗ trợ, Bảo mật RBAC & Unit Tests) | Demo trên Swagger UI (`http://localhost:8080/swagger-ui/index.html`) luồng tạo Support Ticket → đổi trạng thái → nhảy Unread Notification + Demo 403 RBAC | `ProfileController.java`, `Coach.java`, `Receptionist.java`<br>`NotificationController.java`, `NotificationService.java`<br>`SupportRequestController.java`, `SupportRequestService.java`<br>`SecurityConfig.java`, `MethodSecurityPolicyTest.java` |
