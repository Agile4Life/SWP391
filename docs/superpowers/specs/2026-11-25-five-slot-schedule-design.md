# Thiết kế Hệ thống Lịch 5 Slot Cố Định (07:00 – 19:30) cho Toàn bộ Portal & Nghiệp vụ Đặt lịch

**Ngày:** 25/11/2026  
**Phạm vi:** Toàn bộ lịch trên Portal (Manager, Member, Coach), nghiệp vụ & trigger xếp lịch Lớp nhóm và PT 1:1, tạo mới dữ liệu sạch chuẩn 5 slot, và chuẩn hóa thẻ sự kiện trên lịch.

---

## 1. Mục tiêu & Nguồn chuẩn 5 Slot cố định

Toàn bộ lịch học nhóm định kỳ (3 bộ môn `Gym`, `Boxing`, `Yoga`, mỗi bộ môn tối đa 1 lớp `active`) và lịch đặt PT 1:1 đều hoạt động trong khung giờ **07:00 – 19:30**, chia cố định thành đúng **5 Slot** với khoảng nghỉ 15 phút giữa hai slot kế tiếp:

| Mã Slot | Nhãn hiển thị (VI / EN) | Giờ bắt đầu | Giờ kết thúc | Thời lượng |
|---|---|---|---|---|
| `SLOT_1` | `Slot 1` (`07:00 – 09:30`) | `07:00:00` | `09:30:00` | 2 giờ 30 phút |
| `SLOT_2` | `Slot 2` (`09:45 – 11:15`) | `09:45:00` | `11:15:00` | 1 giờ 30 phút |
| `SLOT_3` | `Slot 3` (`11:30 – 14:00`) | `11:30:00` | `14:00:00` | 2 giờ 30 phút |
| `SLOT_4` | `Slot 4` (`14:15 – 16:45`) | `14:15:00` | `16:45:00` | 2 giờ 30 phút |
| `SLOT_5` | `Slot 5` (`17:00 – 19:30`) | `17:00:00` | `19:30:00` | 2 giờ 30 phút |

### Nguyên tắc lưu trữ dữ liệu
- Giữ nguyên cặp cột `start_time` / `end_time` (`TIME`) trong các bảng `classes`, `class_sessions`, `coach_bookings` (không thêm cột DB mới).
- Backend định nghĩa enum duy nhất `com.swp391.scms.common.ScheduleSlot` chứa 5 giá trị `SLOT_1`..`SLOT_5` cùng các hàm tra cứu `fromRange(LocalTime start, LocalTime end)` và `requireValid(LocalTime start, LocalTime end)`.
- Frontend định nghĩa hằng số duy nhất `apps/web/src/features/schedule/slots.ts` (`SCHEDULE_SLOTS`, `findScheduleSlot`, `slotDisplayLabel`, `slotTimeRange`) dùng chung cho mọi màn hình lịch và form chọn slot.
- API DTO giữ nguyên `startTime` / `endTime`; riêng `CoachAvailableSlotDto` bổ sung thêm `slotNumber` (`1..5`) để frontend hiển thị rõ số slot không cần đoán.

---

## 2. Quy tắc nghiệp vụ Backend & Trigger PostgreSQL

### 2.1. Lớp học nhóm (`ClassService`)
- `createRecurringClass`, `createClass`, `createSession`, `rescheduleSession`:
  - Bắt buộc `(startTime, endTime)` phải khớp chính xác 1 trong 5 `ScheduleSlot`. Nếu không khớp, ném `400 BadRequestException("SCHEDULING_INVALID_SLOT", "error.scheduling.invalid_slot")` (cập nhật đồng bộ 3 file `messages*.properties`: VI/EN).
  - Giữ nguyên quy tắc **mỗi bộ môn chỉ có tối đa 1 lớp `active` duy nhất** (`409 SCHEDULING_DISCIPLINE_CLASS_EXISTS`), kiểm tra xung đột phòng/HLV, và **chống trùng lịch 2 chiều Lớp nhóm ↔ PT 1:1**.

### 2.2. Đặt lịch PT 1:1 (`CoachBookingService`)
- `getAvailableSlots(coachId, date, currentMemberId)`:
  - Trả về đúng **5 phần tử** tương ứng `Slot 1` → `Slot 5`.
  - Kiểm tra điều kiện: HLV nghỉ phép (`coach_on_leave`), sát giờ chưa đủ 2 tiếng trước giờ bắt đầu slot (`too_soon`), HLV bận dạy lớp nhóm hoặc PT 1:1 khác (`coach_busy`), hội viên bận lớp nhóm hoặc PT 1:1 khác (`member_busy`).
- `createBooking`:
  - Bắt buộc `(startTime, endTime)` khớp chính xác 1 trong 5 `ScheduleSlot`; sai trả `400 INVALID_COACH_BOOKING_SLOT` (`error.coach_booking.invalid_slot`).
  - **Bỏ hoàn toàn quy tắc HLV nghỉ sau 3 slot PT liên tiếp** (gỡ `requiresCoachRest`, lý do `"coach_rest"` và mọi thông báo/UI liên quan) vì mỗi ngày chỉ có 5 slot và giữa mọi slot đã có 15 phút nghỉ.
  - **Giữ nguyên** giá PT 1:1 ngoài gói **`200.000đ / slot`** (hoặc trừ 1 lượt gói PT miễn phí theo hạng gói) và quy tắc **đặt trước giờ bắt đầu slot tối thiểu 2 giờ** (`ADVANCE_MINUTES_REQUIRED = 120`).

### 2.3. Trigger PostgreSQL (`postgresql-triggers.sql`)
- Gỡ hoàn toàn nhánh kiểm tra 3 giờ PT liên tiếp (`trg_coach_bookings_rest_required`) khỏi `scms_guard_pt_schedule()` và bỏ ánh xạ trigger đó trong `GlobalExceptionHandler`.
- Thêm hàm SQL dùng chung `scms_is_valid_schedule_slot(p_start TIME, p_end TIME)` kiểm tra đúng 5 cặp giờ chuẩn (`07:00–09:30`, `09:45–11:15`, `11:30–14:00`, `14:15–16:45`, `17:00–19:30`).
- Áp dụng kiểm tra `scms_is_valid_schedule_slot(NEW.start_time, NEW.end_time)` trong trigger cho cả `class_sessions` (`trg_sessions_check_conflict`, khi `status <> 'cancelled'`) và `coach_bookings` (`scms_guard_pt_schedule`, khi `status = 'confirmed'`) với mã lỗi `trg_schedule_invalid_slot` được map thành `400 SCHEDULING_INVALID_SLOT` trong `GlobalExceptionHandler`.

### 2.4. Xóa sạch dữ liệu lịch cũ & tạo mới dữ liệu 5 slot (Idempotent)
- Thêm `LegacyScheduleSlotResetRunner` (`@Component`, `@Order(195)` — chạy **trước** `DemoDataSeeder` `@Order(200)` và `DemoClassSeeder` `@Order(210)`):
  - Kiểm tra trên DB có bản ghi nào trong `classes`, `class_sessions` hoặc `coach_bookings` có `(start_time, end_time)` **không thuộc 5 slot chuẩn** (hoặc bị `NULL`) không.
  - Nếu **không có** bản ghi lệch slot nào → kết thúc ngay (**no-op**), không bao giờ đụng tới dữ liệu mới sau khi chuyển đổi.
  - Nếu **có** bản ghi lệch slot (lần deploy đầu tiên lên VPS): chạy một lần trong transaction tháo khóa ngoại an toàn (`payments.class_enrollment_id = NULL`, `payments.coach_booking_id = NULL`, `training_plans.class_id = NULL`) rồi xóa toàn bộ dữ liệu lịch cũ (`session_attendance`, `session_evaluations`, `coach_reviews`, `session_bookings`, `class_enrollments`, `class_sessions`, `classes`, `coach_bookings`).
- Sau đó, các seeder chạy ngay trong cùng lần khởi động để tạo bộ dữ liệu mẫu hoàn toàn mới chuẩn 5 slot:
  - `DemoClassSeeder` (3 bộ môn, đúng 1 lớp `active`/bộ môn):
    - **Gym — `Full Body Strength 101`** (`Phòng Gym Tiêu chuẩn`): T2, T4, T6 — **Slot 1 (`07:00 – 09:30`)**
    - **Yoga — `Hatha Yoga Nền Tảng`** (`Zen Garden Studio`): T2, T4, T6 — **Slot 2 (`09:45 – 11:15`)**
    - **Boxing — `Boxing Cơ Bản`** (`Ring Arena 01`): T3, T5, T7 — **Slot 5 (`17:00 – 19:30`)**
  - `DemoDataSeeder`: các lượt đặt PT 1:1 mẫu dùng đúng 5 `ScheduleSlot` (ví dụ Slot 3 `11:30–14:00`, Slot 4 `14:15–16:45`, không trùng lịch dạy lớp nhóm của HLV).

---

## 3. Thiết kế Frontend: Toàn bộ Lịch Portal, Thẻ Sự kiện & Form Chọn Slot

### 3.1. Lưới lịch tuần dạng 5 hàng Slot (`WeeklyTimetable` & `MemberCalendar`)
Áp dụng đồng nhất cho **Manager** (`/manager/classes`), **Coach** (`/coach/classes`), và **Member** (`/member/classes` tab Lịch của tôi):
- Cột trái thay hoàn toàn dải giờ liên tục (`06:00`, `07:00`...) bằng **đúng 5 hàng cố định** (`--mcal-rows: 5`, chiều cao mỗi hàng `~104px`, tổng ~520px vừa gọn trong 1 màn hình desktop).
- Mỗi ô ở cột trái hiển thị **2 dòng**:
  - Dòng trên (in đậm, rõ ràng): **`Slot 1`**, **`Slot 2`**, **`Slot 3`**, **`Slot 4`**, **`Slot 5`**
  - Dòng dưới (cỡ chữ nhỏ hơn, màu muted, `tabular-nums`): **`07:00 – 09:30`**, **`09:45 – 11:15`**, **`11:30 – 14:00`**, **`14:15 – 16:45`**, **`17:00 – 19:30`**
- **Bỏ nút chuyển đổi khung giờ `08:00–20:00 / Cả ngày`** trên thanh công cụ vì lưới 5 slot luôn gọn, không cần thu gọn theo giờ.
- Đường chỉ thời gian hiện tại (today indicator) tự quy đổi vị trí theo hàng slot đang diễn ra (hoặc ẩn nếu ngoài khoảng `07:00–19:30`).
- Các sự kiện được đặt chính xác vào đúng hàng slot của mình (`slotIndex = 0..4`); trên `Lịch tổng cả tuần` của Manager vẫn giữ gom làn **`+N lớp`** khi 3 bộ môn học trùng 1 slot.
- Trên màn hẹp (mobile `<768px`), giữ dải chọn 1 ngày phía trên + 5 hàng Slot bên dưới.

### 3.2. Thiết kế lại thẻ sự kiện trên lịch (theo yêu cầu giao diện)
- **Bỏ hoàn toàn viền dày bên trái (`border-left: 4px solid ...`)** trong `apps/web/src/features/schedule/calendar.css`: thẻ sự kiện dùng **viền mảnh đều 4 cạnh** (`border: 1px solid color-mix(in srgb, var(--event-accent) 48%, var(--portal-border))`) kết hợp nền tint nhẹ để các góc bo tròn sắc nét, không bị lẹm viền trái.
- **Hiển thị rõ tên HLV ngay phía dưới** trên thẻ sự kiện của cả `WeeklyTimetable` và `MemberCalendar`:
  - Dòng 1 (in đậm): Tên lớp / buổi (`Hatha Yoga Nền Tảng`, hoặc `Tập 1:1 cùng ...`)
  - Dòng 2 (phòng tập, nếu có): `Zen Garden Studio`
  - Dòng 3 (tên HLV, phía dưới): `HLV Lý Thanh Mai` / `Trịnh Quang Hùng` (tránh lặp tên nếu tiêu đề PT đã ghi sẵn tên HLV đó; ở Coach timetable dòng dưới hiển thị tên học viên hoặc phòng tùy loại buổi).

### 3.3. Form tạo khóa học, dời buổi & đặt PT 1:1 theo Slot
- **Manager (`ClassFormModals.tsx` — Tạo khóa học & Dời lịch buổi):**
  - Thay hoàn toàn 2 ô chọn giờ tự do (`TimePicker` Giờ bắt đầu / Giờ kết thúc) bằng **bộ chọn 5 Slot cố định** (5 nút chọn dạng lưới/chip hoặc select trực quan, mỗi mục hiện `Slot N` ở trên và `HH:mm – HH:mm` ở dưới).
  - Bấm ô trống ở hàng `Slot N` trên lịch sẽ tự điền sẵn đúng `Slot N` vào form tạo khóa học.
- **Member đặt PT 1:1 (`MemberCoachBookingView.tsx`):**
  - Thay 3 nhóm Sáng/Chiều/Tối (15 nút giờ) bằng **5 thẻ Slot cố định (`Slot 1` → `Slot 5`)** hiển thị `Slot N` in đậm ở trên, khung giờ cụ thể (`07:00 – 09:30`, v.v.) ngay phía dưới, và trạng thái còn trống hoặc lý do bận (`HLV nghỉ phép`, `Cần đặt trước 2 tiếng`, `HLV đã có lịch`, `Bạn đã có lịch trùng`).
  - Gỡ hoàn toàn dòng lưu ý & nhãn `HLV nghỉ sau 3 slot liên tiếp`.
- **Các bảng & chi tiết lịch khác:**
  - `ClassListTable`, `ClassSessionDetailModal`, `MemberGroupClassesView`, `CoachClassesPage`, `CoachAttendancePage`, `PtAttendancePage`, `MemberCalendar` (banner "Tiếp theo", modal chi tiết, ô ngày ở chế độ tháng), và `CatalogSections` (Landing): hiển thị nhất quán **`Slot N (HH:mm – HH:mm)`** (ví dụ `Slot 1 · 07:00–09:30`).

---

## 4. Phạm vi kiểm thử & Tài liệu
- **Backend:** Unit test cho `ScheduleSlot`, `LegacyScheduleSlotResetRunnerTest`, `ClassServiceTest` (chấp nhận đúng 5 slot, từ chối giờ ngoài 5 slot với `400 SCHEDULING_INVALID_SLOT`), `CoachBookingServiceTest` (trả đúng 5 slot, cho phép đặt 4–5 slot liên tiếp không bị chặn nghỉ, giữ quy tắc đặt trước 2 giờ và giá `200.000đ`), `DemoClassSeederTest`, `GlobalExceptionHandlerTriggerTest`, `MessageBundlesConsistencyTest`. Chạy toàn bộ `./mvnw test`.
- **Frontend:** Cập nhật `slots.test.ts` (mới), `WeeklyTimetable.test.tsx`, `MemberCalendar.test.tsx`, `MemberCoachBookingView.test.tsx`, `ManagerClassesPage.test.tsx`, `CoachClassesPage.test.tsx`, `website.coverage.test.ts`. Chạy `npm test`, `npm run lint`, `npm run build`.
- **Docs & OpenAPI:** Cập nhật `DESIGN.md`, `docs/BUSINESS_FLOWS.md`, `docs/api-contracts/openapi-group-classes-restored.yaml`, `docs/api-contracts/openapi-public.yaml`, `sol-knowledge.md` & `AiChatService.java` (khung giờ 5 slot `07:00–19:30`).
