# Design Spec: Khôi phục Lớp học nhóm (Chống đè lịch Manager) & Chuẩn hóa Sidebar 5 Role

**Date:** 2026-11-25
**Branch:** `feat/group-classes-and-sidebar`
**Status:** Approved & In Implementation (`/goal`)

---

## 1. Mục tiêu & Phạm vi

Khôi phục trọn bộ nghiệp vụ **khóa học định kỳ (lớp học nhóm)** trên cả Backend và Frontend (Manager, Member, Coach), giải quyết triệt để lỗi thẻ lịch đè nhau khi nhiều bộ môn chạy cùng giờ trên giao diện Manager, đồng thời chuẩn hóa toàn bộ tên sidebar, icon, i18n và điều hướng thông báo cho đủ **5 role** (`MEMBER`, `COACH`, `STAFF`, `MANAGER`, `ADMIN`).

### Trong phạm vi
- **Backend (`apps/api`):**
  - Bật `app.legacy.classes-enabled: true` trong `application.yml` (giữ `@ConditionalOnProperty` để test có thể bật/tắt).
  - Giữ nguyên mô hình **khóa học định kỳ** (`SingleSessionPolicy` tiếp tục chặn lớp lẻ 1 buổi).
  - Bảo đảm bất biến chống trùng lịch **2 chiều** giữa lớp nhóm và PT 1:1 cho cả HLV và Hội viên (Slot API, Service, DB Trigger).
  - Hoàn thiện thông báo cho mọi sự kiện vòng đời lớp học (đăng ký miễn phí & có phí, hủy đăng ký khóa, dời buổi học, hủy buổi học cho cả Member và Coach, nhắc lịch 2h trước, đổi HLV).
  - Đồng bộ quyền `@PreAuthorize` của `ClassController` (`CENTER_MANAGER` / `MANAGER`).
  - Cập nhật đồng bộ cả 3 file i18n: `messages.properties`, `messages_vi.properties`, `messages_en.properties`.
- **Frontend (`apps/web`):**
  - **Chuẩn hóa Sidebar 5 role** theo sentence case (`DESIGN.md:208`), thống nhất ký hiệu `1:1`, sửa icon & dịch EN/VI, thêm `ADMIN` vào `/member/notifications` và đủ 3 mục mobile bar cho `ADMIN`.
  - **Khôi phục `shared/ui/TimePicker`** theo đúng quy chuẩn `DESIGN.md:79` (không dùng `<input type="time">` native).
  - **Màn Manager `/manager/classes` (`Lớp học & xếp lịch`):**
    - Thanh chip lọc 1 chạm theo **Bộ môn** (vd: bấm `Yoga` → hiện full lịch tuần của riêng Yoga) + lọc phụ theo **Khóa học cụ thể**, **Phòng**, **HLV**.
    - **4 chế độ rõ ràng:**
      1. `Lịch theo môn / lớp` (lịch tuần 7 ngày lọc theo bộ môn/lớp đang chọn)
      2. `Lịch tổng cả tuần` (7 ngày toàn bộ bộ môn, chống đè bằng gom cụm tối đa 2 thẻ + nút `+N lớp` mở popover/modal đầy đủ)
      3. `Tổng quan theo phòng` (lịch ngày `Phòng × Khung giờ`, 100% không bao giờ bị đè nhờ bất biến 1 phòng 1 lớp/giờ; bấm ô trống điền sẵn Phòng + Ngày + Giờ)
      4. `Danh sách khóa học` (bảng CRUD khóa học & từng buổi)
    - Click vào bất kỳ thẻ lịch nhỏ nào (trên cả 3 chế độ lịch và trong popover `+N lớp`) → mở **Modal chi tiết buổi học** hiển thị đủ: tên khóa, bộ môn, ngày/giờ, trạng thái, phòng, HLV, sĩ số (`đã đặt/sức chứa`), danh sách học viên đã ghi danh, cùng thao tác nhanh `Dời lịch`, `Hủy buổi`, `Sửa khóa học`.
  - **Màn Member `/member/classes` (`Lịch học & đặt PT`):**
    - 3 tab: `Lịch của tôi` (gộp lớp nhóm + PT 1:1), `Đăng ký lớp học` (hạn mức gói, lọc chip theo bộ môn, xem lịch các buổi, đăng ký miễn phí bằng hạn mức hoặc trả phí VNPay/Ví/Quầy, hủy trước ngày bắt đầu), `Đặt lịch HLV 1:1` (`?tab=pt` và tương thích ngược `?tab=coach_booking`).
    - Cập nhật `MemberDashboardPage` hiển thị lịch lớp nhóm sắp tới cùng PT 1:1.
  - **Màn Coach:**
    - Sidebar **`Điểm danh`** (vị trí #1 khớp `homePath`) gộp 2 tab con: `Điểm danh PT 1:1` (`/coach/pt-attendance`) và `Điểm danh lớp nhóm` (`/coach/attendance`, `/coach/attendance/:sessionId`).
    - Sidebar **`Lịch dạy & học viên`** (`/coach/classes`): gộp thời khóa biểu lớp nhóm + PT 1:1 (có nút đi thẳng tới điểm danh / hủy buổi lớp nhóm) và tab `Học viên phụ trách` gộp cả học viên lớp nhóm lẫn học viên PT 1:1.
  - **Manager phụ trợ:** bỏ lọc ẩn `'CLASS'` ở `ManagerCoachAssignmentsPage` (hiển thị lại học viên theo lớp nhóm).
  - **Điều hướng thông báo (`notificationsApi.ts`):** định tuyến chính xác thông báo lớp nhóm, PT 1:1, điểm danh, nhắc lịch và đổi lịch cho cả `MEMBER`, `COACH`, `MANAGER`, `STAFF`.
- **Tài liệu & Hợp đồng API:**
  - Cập nhật `AGENTS.md`, `DESIGN.md`, `docs/BUSINESS_FLOWS.md`, và `docs/api-contracts/`.

### Ngoài phạm vi (giữ nguyên tắt)
- Đặt sân (`app.legacy.courts-enabled`), Cửa hàng (`app.shop.enabled`), Thiết bị (`app.legacy.equipment-enabled`), Đánh giá HLV/buổi học (`app.coaching.reviews.enabled`, `app.coaching.evaluations.enabled`), Chỉ số cơ thể (`app.health.metrics.enabled`), Tiến độ/Lịch sử tập (`app.coaching.progress.enabled`, `app.coaching.completions.enabled`), Streak.
- Không thêm mục sidebar cho `STAFF` (Lễ tân giữ gọn 3 mục; `/staff/classes` chỉ redirect sang `/manager/classes` cho Manager và `/staff/reception` cho Staff).

---

## 2. Kiến trúc Backend & Bất biến nghiệp vụ

### 2.1. Bật cờ lớp học nhóm
- `apps/api/src/main/resources/application.yml`: thêm `app.legacy.classes-enabled: ${APP_LEGACY_CLASSES_ENABLED:true}`.
- Giữ nguyên `@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")` trên các controller/scheduler lớp học để unit test có thể chủ động kiểm thử cả hai trạng thái.

### 2.2. Bất biến chống trùng lịch giữa Lớp nhóm và PT 1:1 (3 tầng)
| Chiều kiểm tra | Slot/UI | Service (Java) | Database Trigger |
|---|---|---|---|
| **HLV có lớp nhóm → Member đặt PT 1:1** | `CoachBookingService.getAvailableSlots()` đánh dấu `available=false, reason="coach_busy"` | `CoachBookingService.createBooking()` ném `409 COACH_SCHEDULE_CONFLICT` (`error.coach_booking.coach_busy`) | `trg_pt_schedule_booking` (`scms_guard_pt_schedule`) |
| **HLV có PT 1:1 confirmed → Manager tạo/dời lớp hoặc đổi HLV lớp** | Manager thấy lỗi chi tiết ngay trên form | **Bổ sung mới** trong `ClassService.ensureNoSessionConflict()` (tiêm tùy chọn `CoachBookingRepository`, null-safe cho test cũ): kiểm tra `findActiveByCoachAndDate` và ném `409 SCHEDULING_COACH_PT_CONFLICT` (`error.scheduling.coach_pt_conflict`) | `trg_pt_schedule_session` & `trg_pt_schedule_class` (`scms_guard_pt_schedule`) |
| **Member có lớp nhóm ↔ Member đặt PT 1:1** | `getAvailableSlots()` đánh dấu `reason="member_busy"` | `CoachBookingService.createBooking()`, `MemberScheduleGuard.ensureCourseFree()` | `trg_pt_schedule_booking` & `trg_pt_schedule_enrollment` |
| **Cùng phòng không thể có 2 lớp trùng giờ** | `RoomDayTimetable` 1 cột/phòng | `ClassService.ensureNoSessionConflict()` ném `409 SCHEDULING_ROOM_CONFLICT` | `trg_sessions_check_conflict` |

### 2.3. Chuẩn hóa Thông báo vòng đời Lớp học & PT
| Sự kiện | Người nhận | Type / Entity | ActionPath / Route Frontend |
|---|---|---|---|
| Member đăng ký khóa (miễn phí hoặc có phí) | Member | `system` / `class_enrollment` | `/member/classes` |
| Member hủy đăng ký khóa trước khi bắt đầu | Member | `system` / `class_enrollment` | `/member/classes` |
| Manager dời buổi học (`rescheduleSession`) | Tất cả Member `booked` + Coach phụ trách | `schedule_change` / `class_session` | Member → `/member/classes`; Coach → `/coach/classes` |
| Manager/Staff hủy buổi học (`cancelSession`) | Tất cả Member `booked` + Coach (nếu không phải chính Coach hủy) | `schedule_change` / `class_session` | Member → `/member/classes`; Coach → `/coach/classes` |
| Nhắc lịch học trước 2h (`NotificationScheduler`) | Tất cả Member `booked` (idempotent) | `class_reminder` / `class_session` | Member → `/member/classes` |
| Manager đổi HLV buổi PT (`CoachAssignmentService`) | Member + Coach mới + Coach cũ | `system` / `null` | Member → `/member/classes?tab=pt` (đổi từ `?tab=coach_booking`); Coach → `/coach/classes` |
| Duyệt đơn nghỉ HLV có lớp/PT ảnh hưởng | Manager + Coach | `system` / `staff_internal_request` | Manager → `/manager/classes` hoặc `/manager/requests`; Coach → `/staff/requests` |

Tất cả message key mới (`error.scheduling.coach_pt_conflict`, `notifications.session.rescheduled.title`, `notifications.session.rescheduled.body`, `notifications.session.rescheduled.coach_body`, `notifications.session.cancelled.coach_body`) được bổ sung đầy đủ vào cả 3 file `messages.properties`, `messages_vi.properties`, `messages_en.properties`.

---

## 3. Chuẩn hóa Sidebar 5 Role (`portalNavigation.ts` & `PortalShell.tsx`)

Quy chuẩn: **sentence case** cho VI và EN (chỉ viết hoa chữ cái đầu và danh từ riêng/viết tắt như `PT`, `HLV`, `3D`, `QR`), ký hiệu **`1:1`** đồng nhất, mỗi role không trùng route và không trùng icon.

- **`MEMBER` (7 mục):**
  1. `Bảng điều khiển` / `Dashboard` (`/member/dashboard`, `board`)
  2. `Gói tập & bảo lưu` / `Memberships & hold` (`/member/packages` + `/member/hold`, `package`)
  3. `Lịch học & đặt PT` / `Classes & 1:1 PT` (`/member/classes`, `calendar`)
  4. `Thẻ & check-in` / `Card & check-in` (`/member/card` + `/member/check-in`, `card`)
  5. `Giao dịch & hóa đơn` / `Transactions & invoices` (`/member/invoices`, `receipt`)
  6. `Giáo án` / `Training plans` (`/member/progress`, `dumbbell`)
  7. `Tham quan 3D` / `Explore 3D` (`/member/explore`, `compass`)
- **`COACH` (4 mục, #1 = homePath):**
  1. `Điểm danh` / `Attendance` (`/coach/pt-attendance` [Tab: `Điểm danh PT 1:1` / `1:1 PT attendance`] + `/coach/attendance` [Tab: `Điểm danh lớp nhóm` / `Group class attendance`], `check`)
  2. `Lịch dạy & học viên` / `Teaching schedule & trainees` (`/coach/classes`, `calendar`)
  3. `Giáo án huấn luyện` / `Training plans` (`/coach/training-plans` [`Soạn giáo án` / `Plan builder`] + `/coach/saved-plans` [`Giáo án đã lưu` / `Saved plans`], `dumbbell`)
  4. `Đơn từ nội bộ` / `Internal requests` (`/staff/requests`, `file`)
- **`STAFF` (3 mục):**
  1. `Quầy lễ tân & check-in` / `Front desk & check-in` (`/staff/reception` [`Quầy lễ tân` / `Front desk`], `/staff/check-in`, `/staff/check-out`, `/staff/reception-history`, `card`)
  2. `Duyệt hồ sơ & bảo lưu` / `Identity & holds` (`/staff/kyc`, `/staff/holds`, `shield`)
  3. `Đơn từ nội bộ` / `Internal requests` (`/staff/requests`, `file`)
- **`MANAGER` (6 mục):**
  1. `Báo cáo & doanh thu` / `Reports & revenue` (`/manager/reports`, `chart`)
  2. `Lớp học & xếp lịch` / `Classes & schedule` (`/manager/classes`, `calendar`)
  3. `Danh mục vận hành` / `Operational catalogs` (`/manager/catalogs`, `catalog`)
  4. `Phân công HLV` / `Coach assignments` (`/manager/coach-assignments`, `users`)
  5. `Duyệt đơn từ nội bộ` / `Review internal requests` (`/manager/requests`, `inbox`)
  6. `Tài khoản nhân sự` / `Staff accounts` (`/manager/staff-accounts`, `badge`)
- **`ADMIN` (3 mục):**
  1. `Tài khoản & phân quyền` / `Accounts & permissions` (`/admin/users`, `users`)
  2. `Nhật ký & lấp đầy` / `Audit & occupancy` (`/admin/audit-logs`, `chart`)
  3. `Đối soát thanh toán` / `Payment reconciliation` (`/admin/payments`, `receipt`)
- **Mục ẩn rail & Mobile:**
  - `/member/notifications`: thêm `'ADMIN'` vào `roles` (`['MEMBER', 'COACH', 'MANAGER', 'STAFF', 'ADMIN']`); sửa redirect cho `COACH` về `/coach/pt-attendance`.
  - `/member/profile`: đổi nhãn gốc từ `Hồ sơ & Sức khỏe` → `Hồ sơ cá nhân` (`My profile`).
  - `MOBILE_PRIMARY_NAV.ADMIN`: đủ 3 mục (`Tài khoản` `/admin/users`, `Nhật ký` `/admin/audit-logs`, `Đối soát` `/admin/payments`).
  - `MOBILE_PRIMARY_NAV.MANAGER`: `Báo cáo`, `Lớp học` (`/manager/classes`), `Phân công`.
  - `MOBILE_PRIMARY_NAV.MEMBER`: `Tổng quan`, `Lịch học` (`/member/classes`), `Quét QR`.
  - `PortalShell` search placeholder: `Ví dụ: lớp học, gói tập, điểm danh…` / `e.g. classes, memberships, attendance…`.

---

## 4. Kiến trúc Giao diện Lịch chống đè (`schedule/` & `classes/`)

### 4.1. Thuật toán gom cụm trong `apps/web/src/features/schedule/timetable.ts`
Bổ sung `groupVisibleLanes<T>(positioned: PositionedEvent<T>[], maxVisible = 2)` trả về:
- `visible`: các sự kiện vẽ trực tiếp (với `lane` và `lanes` hiệu chỉnh `<= maxVisible`, đảm bảo thẻ luôn đủ rộng để đọc chữ).
- `overflows`: danh sách cụm tràn `{ id, topPct, heightPct, count, events, rangeLabel }` đặt ở làn cuối cùng của cụm chồng giờ (`+N lớp`).
- **Bất biến toán học:**
  - Với mọi `events`: tổng số sự kiện trong `visible` + tất cả `overflows` luôn khớp chính xác 100% số sự kiện đầu vào (không bao giờ rơi rớt sự kiện).
  - Nếu cụm chỉ có `<= maxVisible` làn song song → `overflows` rỗng, vẽ bình thường.
  - Nếu cụm có `> maxVisible` làn song song → tối đa `maxVisible - 1` thẻ trực tiếp (hoặc `maxVisible` tùy bề rộng) + 1 nút gom `+N lớp` (`overflowCount = hiddenEvents.length`), bảo đảm mỗi cột thẻ có độ rộng tối thiểu `>= 50%` cột ngày (không bao giờ bị ép xuống 15–30px).

### 4.2. Component `RoomDayTimetable` (`apps/web/src/features/schedule/RoomDayTimetable.tsx`)
- Hiển thị lịch 1 ngày theo cấu trúc **`Phòng × Khung giờ (06:00–22:00)`**.
- Thanh chọn ngày nhanh: `<`, `>`, `Hôm nay`, dải 7 ngày `T2–CN` của tuần hiện tại có hiện số buổi của từng ngày.
- Mỗi phòng là 1 cột cố định `minmax(190px, 1fr)` với header phòng dính (`position: sticky`), cuộn ngang mượt khi nhiều phòng.
- Các buổi trong cùng phòng hiển thị 100% bề rộng cột phòng với: chấm/viền màu phân biệt Bộ môn (dùng bảng màu dịu đọc rõ ở cả Dark và Light, không dùng hex salmon/Volt vi phạm `DESIGN.md`), Tên lớp, Badge Bộ môn, HLV, Sĩ số `booked/capacity`.
- Ô trống `(Phòng X, Giờ Y)` bấm được (`onSlotClick({ date, startTime, endTime, roomId })`) để mở form tạo lớp điền sẵn phòng + ngày + giờ.

### 4.3. Trang Manager `/manager/classes` (`apps/web/src/features/classes/ManagerClassesPage.tsx`)
Tách mô-đun sạch thay file monolith cũ:
- `ManagerClassesPage.tsx`: điều phối state, fetch song song `classes`, `sessions`, `disciplines`, `rooms`, `coaches`, thanh filter Bộ môn (chip 1 chạm: `Lịch tổng cả tuần` + từng Bộ môn với số buổi trong tuần) + filter phụ `Khóa học cụ thể` (hiện khi đã chọn bộ môn), `Phòng`, `HLV`.
- **4 tab xem:**
  1. `Lịch theo môn / lớp` (chọn chip Yoga/Boxing… tự bật tab này, hiện full lịch tuần của môn/lớp đó).
  2. `Lịch tổng cả tuần` (hiện toàn bộ bộ môn trên lưới 7 ngày có gom `+N lớp` khi ≥ 3 lớp trùng giờ).
  3. `Tổng quan theo phòng` (`RoomDayTimetable`, không bao giờ đè).
  4. `Danh sách khóa học` (`ClassListTable` với tìm kiếm, sửa, thêm buổi, xóa, xem buổi).
- **Modal chi tiết buổi học (`ClassSessionDetailModal.tsx`):**
  - Mở khi bấm bất kỳ ô lịch nhỏ nào trên bất kỳ view nào (kể cả từ popover `+N lớp`).
  - Tải danh sách học viên đã ghi danh (`GET /api/v1/classes/sessions/{id}/students`), hiển thị tên khóa, bộ môn, ngày giờ, phòng, HLV, sĩ số (`bookedCount / capacity`), trạng thái & lý do hủy.
  - Nút hành động nhanh: `Dời lịch`, `Hủy buổi`, `Sửa khóa học`.
- **Modal tạo/sửa/dời/hủy:**
  - Dùng hoàn toàn `Select`, `DatePicker`, `TimePicker` (không dùng control native).
  - Kiểm tra xung đột client trước khi gọi API (phòng, HLV) và hiển thị chính xác lỗi từ server (bao gồm lỗi trùng PT 1:1 của HLV hoặc HLV đang nghỉ phép).

---

## 5. Luồng Member & Coach

### 5.1. Member (`/member/classes`)
- `MemberClassesPage.tsx`: 3 tab rõ ràng:
  - Tab 1 (`Lịch của tôi`, mặc định khi không có `?tab`): `MemberCalendar` gộp buổi lớp nhóm đã đăng ký (`class_enrollments` + `classes/sessions`) và lịch PT 1:1 (`coach-bookings/my`).
  - Tab 2 (`Đăng ký lớp học`, `?tab=classes` hoặc khi có `?discipline=`): `MemberGroupClassesView` — banner hạn mức khóa học (`GET /api/v1/classes/my-quota`), chip lọc theo Bộ môn, thẻ khóa học hiện rõ lịch định kỳ, phòng, HLV, sĩ số còn trống, học phí (miễn phí theo hạn mức hoặc giảm 10%/20% theo hạng), đăng ký/checkout (`free_quota`, `online_wallet`, `vnpay`, `cash` tại quầy), hủy đăng ký trước ngày khai giảng.
  - Tab 3 (`Đặt lịch HLV 1:1`, `?tab=pt` hoặc `?tab=coach_booking`): `MemberCoachBookingView` giữ nguyên.

### 5.2. Coach (`/coach/pt-attendance`, `/coach/attendance`, `/coach/classes`)
- `/coach/attendance` & `/coach/attendance/:sessionId`: khôi phục `CoachAttendancePage` (từ lịch sử git và chỉnh theo chuẩn component portal hiện hành), điểm danh hàng loạt Có mặt/Vắng mặt + lịch sử điểm danh buổi lớp nhóm.
- `/coach/classes`: `CoachClassesPage` gộp thời khóa biểu **lớp nhóm** (`GET /api/v1/classes/sessions?coachId=...`) và **PT 1:1** (`GET /api/v1/coach-bookings/coach-schedule`); bấm buổi lớp nhóm hiện modal chi tiết với nút **`Điểm danh buổi này`** (dẫn tới `/coach/attendance/:sessionId`) và **`Hủy buổi`**; tab `Học viên phụ trách` gộp học viên lớp nhóm + học viên PT 1:1 (không bị lỗi 404).

---

## 6. Chiến lược Kiểm thử & Xác minh

1. **Backend (`./mvnw test`):**
   - Toàn bộ suite hiện có xanh 100% khi `app.legacy.classes-enabled=true`.
   - Test mới & tăng cường:
     - `CoachBookingServiceTest`: xác nhận khi `legacyClassesEnabled=true` và HLV có lớp nhóm lúc `18:00–19:00` → `getAvailableSlots` trả `available=false, reason="coach_busy"` và `createBooking` ném `ConflictException("COACH_SCHEDULE_CONFLICT")`; Member đã có lớp nhóm cùng giờ → `member_busy` / `MEMBER_SCHEDULE_CONFLICT`.
     - `ClassServiceTest`: xác nhận chiều ngược lại (HLV đã có PT `confirmed` → `createSession` / `rescheduleSession` / `createRecurringClass` ném `ConflictException("SCHEDULING_COACH_PT_CONFLICT")`); xác nhận `rescheduleSession` gửi thông báo `schedule_change` cho cả học viên `booked` và HLV.
     - `ClassSessionServiceTest`: xác nhận Manager hủy buổi học gửi thông báo cho cả học viên `booked` và HLV phụ trách (còn chính HLV tự hủy thì chỉ gửi cho học viên, không tự gửi cho mình).
     - `EnrollmentServiceTest`: xác nhận `checkoutCourse` (paid) và `cancelCourseEnrollment` gửi thông báo `class_enrollment` cho Member.
     - `CoachAssignmentServiceTest`: xác nhận thông báo chuyển HLV PT trỏ `/member/classes?tab=pt`.
     - `NotificationSchedulerTest`: xác nhận nhắc lịch lớp 2h trước chạy idempotent khi `classesEnabled=true`.
     - `MessageBundlesConsistencyTest`: xác nhận 3 file i18n đồng bộ 100% key và tham số.
2. **Frontend (`npm test`, `npm run lint`, `npm run build`):**
   - `timetable.test.ts`: test kỹ mọi edge case chồng giờ (1, 2, 3, 5, 10 lớp cùng giờ; lớp chồng một phần `18:00–19:30` với `18:30–20:00`; lớp ngoài khung `06:00–22:00`; tổng sự kiện bảo toàn 100%).
   - `WeeklyTimetable.test.tsx`: test nút `+N lớp` xuất hiện khi ≥ 3 lớp trùng giờ, click mở danh sách đầy đủ và chọn từng lớp.
   - `RoomDayTimetable.test.tsx`: test cột theo phòng, lọc bộ môn, click ô trống điền đúng `(date, startTime, endTime, roomId)`, click thẻ buổi học mở chi tiết.
   - `ManagerClassesPage.test.tsx`: test filter chip theo bộ môn (bấm Yoga chỉ hiện Yoga), lọc khóa học con, chuyển `Lịch tổng cả tuần` / `Tổng quan theo phòng` / `Danh sách`, click ô lịch nhỏ mở modal đủ chi tiết + học viên + thao tác dời/hủy.
   - `MemberClassesPage.test.tsx` & `MemberCalendar.test.tsx`: test đủ 3 tab, đăng ký miễn phí/trả phí, hủy đăng ký, lọc bộ môn, tương thích `?tab=pt` và `?tab=coach_booking`.
   - `CoachClassesPage.test.tsx` & `CoachAttendancePage.test.tsx`: test gộp lịch lớp + PT, điểm danh lớp nhóm, tab học viên gộp.
   - `notificationsApi.test.ts`: test đầy đủ định tuyến thông báo lớp nhóm / PT / điểm danh / dời lịch / hủy buổi / nhắc lịch cho cả 5 role (`MEMBER`, `COACH`, `MANAGER`, `STAFF`, `ADMIN`).
   - `portalNavigation.test.ts`, `AppLayout.test.tsx`, `router.gymScope.test.tsx`, `website.coverage.test.ts`: xác nhận nhãn sidebar 5 role, icon không trùng, route guards, i18n coverage 100%.
