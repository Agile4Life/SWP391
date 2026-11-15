# Thiết kế Hệ thống Khóa học Định kỳ & Quản lý Lượt Đăng ký theo Gói (Recurring Courses & Membership Quota)

**Ngày lập:** 09/11/2026  
**Trạng thái:** Đề xuất thiết kế hoàn chỉnh chờ duyệt  
**Phạm vi:** Backend (`apps/api`), Frontend (`apps/web`), CSDL Supabase PostgreSQL qua Hibernate Code-First

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Bối cảnh hiện tại
- Hiện tại, hệ thống quản lý lớp học (`GymClass`) chủ yếu vận hành theo các buổi học đơn lẻ (`ClassSession`), Manager/Staff phải xếp lịch từng buổi một và Member đặt chỗ theo từng buổi lẻ (`session_bookings`).
- Gói hội viên (`membership_packages`) đã có trường `class_credit_limit` (ví dụ: Gói Bạc có 2 lượt, Gói Vàng có 5 lượt, Gói Platinum không giới hạn), nhưng chưa được liên kết tự động để kiểm soát số lượt đăng ký của học viên.

### 1.2. Quyết định nghiệp vụ mới nhất
1. **Chuyển đổi hoàn toàn sang Khóa học định kỳ (Recurring Courses):**
   - Loại bỏ hoàn toàn luồng tạo và đặt chỗ từng buổi học lẻ (drop-in). Mọi lớp học fitness tại trung tâm đều được tổ chức dưới dạng **Khóa học trọn gói**.
2. **Lên lịch và mở đăng ký trước (Advance Scheduling & Enrollment):**
   - Manager có thể chủ động tạo và lên lịch các khóa học sẽ khai giảng trong **2 đến 3 tuần tới** (hoặc xa hơn).
   - Khóa học được hiển thị ở trạng thái *Sắp khai giảng* để hội viên đăng ký giữ chỗ trước.
3. **Quy tắc Lượt đăng ký theo gói (Membership Quota):**
   - **1 lượt credit = 1 Khóa học trọn gói** (ví dụ: Khóa Yoga 1 tháng gồm 12 buổi học được tính là 1 lượt).
   - Gói Bạc (Silver): Được đăng ký miễn phí **2 khóa học**.
   - Gói Vàng (Gold): Được đăng ký miễn phí **5 khóa học**.
   - Gói Bạch Kim (Platinum): **Không giới hạn** số khóa học.
4. **Xử lý khi hết lượt hoặc chưa có gói phù hợp:**
   - Nếu hội viên đã dùng hết số lượt miễn phí trong gói (ví dụ gói Bạc đã học đủ 2 khóa), hội viên có thể đăng ký khóa tiếp theo bằng cách **thanh toán học phí riêng của khóa đó** (`price`) qua VNPAY hoặc thanh toán tại quầy.

---

## 2. Luồng nghiệp vụ chi tiết

### 2.1. Luồng Quản trị: Tạo Khóa học & Tự động sinh lịch (`StaffClassesPage`)
1. **Thiết lập thông tin khóa học:**
   - Tên khóa học (VD: *Yoga Hatha Cơ Bản - Tháng 12/2026*).
   - Bộ môn (*Discipline*), HLV phụ trách (*Coach*), Phòng tập (*Room*), Sĩ số tối đa (*Capacity*), Trình độ (*Level*).
   - Học phí ngoài gói (*Price*): Đơn giá khóa học (VD: `500.000` VNĐ).
2. **Thiết lập thời gian & Lịch học định kỳ:**
   - Ngày khai giảng (*Start Date*): Có thể chọn trước 2 đến 3 tuần trong tương lai.
   - Ngày bế giảng (*End Date*): Ngày kết thúc khóa (thường là 1 tháng / 4 tuần sau ngày bắt đầu).
   - Các thứ học cố định trong tuần: Chọn nhanh bằng checkbox (VD: `[Thứ 2, Thứ 4, Thứ 6]` hoặc `[Thứ 3, Thứ 5]`).
   - Khung giờ học cố định: Giờ bắt đầu (`07:00`) – Giờ kết thúc (`08:30`).
3. **Cơ chế sinh buổi học và kiểm tra xung đột (Atomic Generation):**
   - Backend tính toán toàn bộ danh sách các ngày học trong khoảng `[startDate, endDate]`.
   - Quét kiểm tra xung đột lịch: Đảm bảo cả **Phòng tập** và **HLV** không bị trùng lịch với bất kỳ buổi học hoặc lịch đặt sân/PT nào khác trong toàn bộ chuỗi ngày học.
   - Nếu có bất kỳ buổi nào bị trùng: Rollback toàn bộ transaction và trả về lỗi chi tiết (ngày nào, khung giờ nào, trùng với ai).
   - Nếu hợp lệ: Lưu `GymClass` và tự động sinh toàn bộ danh sách `ClassSession` tương ứng (`status = 'scheduled'`).

### 2.2. Luồng Hội viên: Xem, Đăng ký & Thanh toán Khóa học (`MemberClassesPage`)
1. **Xem danh mục Khóa học:**
   - Xem danh sách các khóa học đang mở đăng ký hoặc sắp khai giảng (2-3 tuần tới).
   - Hiển thị thanh trạng thái hạn mức gói tập:
     - *Ví dụ Gói Bạc:* `🏷️ Gói Bạc (Silver) • Đã dùng: 1/2 khóa • Còn lại: 1 khóa miễn phí`
     - *Khi hết lượt:* `⚠️ Bạn đã dùng hết 2/2 lượt miễn phí trong gói Bạc`
2. **Đăng ký bằng Lượt của gói tập (Khi còn lượt):**
   - Hội viên nhấn **"Đăng ký khóa học"**.
   - Modal hiển thị xác nhận: Sử dụng 1 lượt của gói tập.
   - Khi xác nhận: Backend tạo bản ghi `ClassEnrollment` (`status = 'booked'`), giữ chỗ cố định trên toàn bộ các buổi học của khóa đó.
3. **Thanh toán học phí (Khi hết lượt hoặc không có gói):**
   - Modal thông báo: *"Bạn đã dùng hết lượt miễn phí trong gói. Học phí khóa này là 500.000 VNĐ"*.
   - Hội viên chọn phương thức thanh toán: **Cổng VNPAY** hoặc **Thanh toán tại quầy**.
   - Khi thanh toán VNPAY thành công: Hệ thống chuyển trạng thái `ClassEnrollment` thành `booked`, liên kết bản ghi `Payment`.
4. **Hủy đăng ký khóa học:**
   - Hội viên được phép hủy đăng ký trước ngày khai giảng khóa học.
   - Nếu đăng ký bằng lượt gói tập: Hoàn trả lại 1 lượt cho hội viên.
   - Nếu đăng ký bằng tiền thanh toán: Chuyển trạng thái `cancelled`, việc hoàn tiền xử lý qua quy trình kế toán/lễ tân.
5. **Điểm danh từng buổi:**
   - Trong quá trình diễn ra khóa học, HLV/Lễ tân điểm danh từng buổi bình thường thông qua bảng `session_attendance` gắn với `ClassSession`.

---

## 3. Kiến trúc Dữ liệu & Code-First (JPA Entities)

### 3.1. Cập nhật Entity `GymClass` (`classes`)
Bổ sung các trường để hỗ trợ Khóa học định kỳ trọn gói:
```java
@Column(name = "price", precision = 12, scale = 2)
private BigDecimal price = BigDecimal.ZERO;

@Column(name = "start_date")
private LocalDate startDate;

@Column(name = "end_date")
private LocalDate endDate;

@Column(name = "recurring_days", length = 100)
private String recurringDays; // Ví dụ: "MONDAY,WEDNESDAY,FRIDAY"

@Column(name = "start_time")
private LocalTime startTime;

@Column(name = "end_time")
private LocalTime endTime;
```

### 3.2. Cập nhật Entity `ClassEnrollment` (`class_enrollments`)
Bảo lưu cấu trúc `class_enrollments` làm thực thể chính đại diện cho việc một học viên đăng ký trọn gói vào một khóa học:
- Khóa học: `gymClass` (`@ManyToOne GymClass`)
- Học viên: `member` (`@ManyToOne Member`)
- Trạng thái: `status` (`'booked'`, `'cancelled'`, `'completed'`)
- Thời gian ghi danh: `enrolledAt`
- Thời gian hủy (nếu có): `cancelledAt`, `cancelledBy`, `cancelReason`
- Liên kết thanh toán: `payments.class_enrollment_id` đã có sẵn trong bảng `payments`.

### 3.3. Cơ chế đếm số lượt đã sử dụng (Credit Usage Calculation)
Trong `EnrollmentService` / `SessionEligibility`:
```java
long usedCredits = enrollments.countByMemberUserIdAndStatusAndDateRange(
    memberId, 
    "booked", 
    subscription.getStartDate(), 
    subscription.getEndDate()
);
```
- Nếu `package.getClassCreditLimit() == null`: Không giới hạn (Platinum).
- Nếu `usedCredits < package.getClassCreditLimit()`: Cho phép đăng ký miễn phí bằng lượt gói.
- Nếu `usedCredits >= package.getClassCreditLimit()`: Yêu cầu thanh toán theo giá `gymClass.getPrice()`.

---

## 4. Đặc tả API Endpoints

### 4.1. Dành cho Quản trị (Manager / Staff)
- `POST /api/classes`: Tạo Khóa học định kỳ mới.
  - Payload:
    ```json
    {
      "name": "Yoga Hatha Cơ Bản - Khóa Tháng 12",
      "disciplineId": 1,
      "coachId": 3,
      "roomId": 2,
      "capacity": 20,
      "level": "beginner",
      "description": "Khóa học 12 buổi trong 4 tuần",
      "price": 500000,
      "startDate": "2026-11-30",
      "endDate": "2026-12-25",
      "recurringDays": ["MONDAY", "WEDNESDAY", "FRIDAY"],
      "startTime": "07:00",
      "endTime": "08:30"
    }
    ```
  - Xử lý: Kiểm tra xung đột HLV/Phòng trên toàn chuỗi $\rightarrow$ Lưu `GymClass` $\rightarrow$ Tự động sinh danh sách `ClassSession`.
- `GET /api/classes`: Lấy danh sách toàn bộ các khóa học kèm thống kê số buổi, số học viên đã đăng ký, sĩ số còn lại.
- `PUT /api/classes/{id}`: Chỉnh sửa thông tin khóa học.
- `DELETE /api/classes/{id}`: Hủy khóa học (kèm lý do và thông báo cho học viên đã đăng ký).

### 4.2. Dành cho Hội viên (Member)
- `GET /api/classes/available`: Danh sách các khóa học đang mở đăng ký hoặc sắp khai giảng trong 2–3 tuần tới.
- `GET /api/classes/my-quota`: Lấy thông tin hạn mức gói tập của hội viên:
  - Tên gói (Gói Bạc, Vàng, Platinum).
  - Tổng số lượt miễn phí (`totalCredits`).
  - Số lượt đã dùng (`usedCredits`).
  - Số lượt còn lại (`remainingCredits`).
- `POST /api/classes/{id}/enroll`: Đăng ký tham gia khóa học (sử dụng lượt miễn phí).
- `POST /api/classes/{id}/checkout`: Khởi tạo thanh toán học phí qua VNPAY khi đã hết lượt miễn phí.
- `DELETE /api/classes/{id}/enroll`: Hủy đăng ký khóa học trước ngày khai giảng (hoàn trả 1 lượt vào gói).
- `GET /api/classes/my-enrollments`: Danh sách các khóa học mà hội viên đã đăng ký kèm lịch chi tiết các buổi học.

---

## 5. Cập nhật Giao diện Frontend (`apps/web`)

### 5.1. Trang Quản trị Lớp học (`StaffClassesPage`)
- Bỏ bộ tạo buổi lẻ rời rạc.
- Thay bằng Form tạo Khóa học định kỳ:
  - Date Picker cho Ngày khai giảng (cho phép chọn trước 2-3 tuần).
  - Nút chọn nhanh thời lượng "1 tháng / 4 tuần".
  - Checkbox chọn các thứ trong tuần (T2, T3, T4, T5, T6, T7, CN).
  - Time Picker cho khung giờ học chẵn (07:00 - 08:30).
  - Trường nhập học phí ngoài gói (`price`).
- Khi tạo xong, lịch học các buổi xuất hiện đầy đủ trên `WeeklyTimetable`.

### 5.2. Trang Lớp học Hội viên (`MemberClassesPage`)
- Bỏ bảng chọn buổi học lẻ và nút "Đặt theo buổi".
- Hiển thị danh mục **Khóa học định kỳ**:
  - Banner hiển thị hạn mức gói: `🏷️ Gói Bạc (Silver) • Còn 1/2 lượt đăng ký khóa học miễn phí`.
  - Bộ lọc theo Bộ môn (Yoga, Gym, Boxing, Bơi lội...) và Tab: *"Sắp khai giảng (2-3 tuần tới)"* / *"Tất cả khóa học"*.
  - Thẻ Khóa học trực quan:
    - Hiển thị lịch: *Thứ 2, 4, 6 • 07:00 – 08:30 (12 buổi)*.
    - Sĩ số: *Còn 8/20 chỗ*.
    - Nút bấm:
      - Khi còn lượt: **[Đăng ký khóa học (Miễn phí theo gói)]**
      - Khi hết lượt: **[Thanh toán học phí: 500.000đ (VNPAY)]**
- Tab **"Khóa học của tôi"**:
  - Danh sách các khóa học đã ghi danh.
  - Xem danh sách chi tiết các buổi học trong khóa và trạng thái điểm danh.
  - Nút Hủy đăng ký trước ngày khai giảng.

---

## 6. Kế hoạch Kiểm thử & Edge Cases

1. **Kiểm tra tự động sinh buổi học:**
   - Khóa học 4 tuần, 3 buổi/tuần (Thứ 2 - 4 - 6) $\rightarrow$ sinh chính xác 12 buổi học.
   - Không bị lệch múi giờ (`Asia/Ho_Chi_Minh`).
2. **Kiểm tra phát hiện xung đột lịch (Conflict Detection):**
   - Nếu phòng tập hoặc HLV đã có lịch dạy vào bất kỳ buổi nào trong chuỗi 12 buổi $\rightarrow$ Transaction bị rollback, trả về lỗi chi tiết, không tạo dữ liệu rác.
3. **Kiểm tra hạn mức gói tập (Quota Enforcement):**
   - Hội viên Gói Bạc đăng ký khóa thứ 1 $\rightarrow$ Thành công, còn 1 lượt.
   - Hội viên Gói Bạc đăng ký khóa thứ 2 $\rightarrow$ Thành công, còn 0 lượt.
   - Hội viên Gói Bạc đăng ký khóa thứ 3 $\rightarrow$ Chặn đăng ký miễn phí, yêu cầu thanh toán `500.000đ`.
   - Hội viên Gói Platinum $\rightarrow$ Đăng ký không giới hạn số khóa học.
4. **Kiểm tra tạo khóa trước 2-3 tuần:**
   - Manager tạo khóa khai giảng ngày 30/11/2026 (sau 3 tuần) $\rightarrow$ Thành công.
   - Hội viên nhìn thấy khóa học trong danh mục "Sắp khai giảng" và giữ chỗ trước thành công.
5. **Kiểm tra hủy khóa & Hoàn lượt:**
   - Hội viên hủy khóa học trước ngày khai giảng $\rightarrow$ Lượt của gói tập được hoàn lại (từ 0/2 lên 1/2 lượt).
   - Chỗ trống được giải phóng cho hội viên khác.
