# Auto Check-out sau 8 giờ

## Phạm vi

- Base: `origin/main` tại `82f408e938337e5a8640a843c38bf49b9ef6c086`.
- Chỉ Backend và tài liệu; không thay đổi API, UI, schema hoặc lịch sử đã đóng.
- Branch cũ được giữ tại `archive/thinh-auto-checkout-eight-hours-6db79125`; branch hiện tại bắt đầu từ main sạch.

## Quy tắc và khóa

- Chọn ID phiên `GRANTED`, `checkOutTime is null`, `checkInTime <= now - 8 giờ`, theo ID tăng dần.
- Trong transaction, lấy `PESSIMISTIC_WRITE` qua `findByIdForUpdate()`, đọc lại và kiểm tra trạng thái, giờ ra, ngưỡng thời gian.
- Chỉ phiên còn đủ điều kiện mới được ghi `checkOutTime = checkInTime + 8 giờ` và `SYSTEM_AUTO_CHECKOUT`.
- Scheduler mặc định `0 * * * * ?`, timezone `Asia/Ho_Chi_Minh`; Clock ứng dụng giữ cấu hình giờ trung tâm hiện có.
- Scheduler chỉ khóa phiên; Check-in giữ thứ tự Member → Subscription → phiên. Không thêm đường khóa ngược từ phiên lên Member/Subscription.
- Self-checkout cũng đọc ID rồi khóa phiên để tránh ghi đè auto-close. Endpoint thủ công được giữ.
- Không giới hạn ngày truy vấn: phiên tồn đọng sau rollback/restart vẫn được chọn ở lần chạy sau.

## Kiểm thử

- `mvnw.cmd package -q`: exit 0; Backend 1809 PASS, 48 SKIP, 0 failures/errors; package JAR thành công.
- Lượt chạy riêng tuần tự: CenterCheckinService/Controller/Access và CourseAttendance 60 PASS; OperationsConcurrencyPostgreSqlTest 14 SKIP (gồm 5 test Auto Check-out mới), 0 failures/errors.
- Test biên 7h59/8h/8h01, giờ ra +8, chạy lặp, phiên đã đóng/DENIED, nhiều phiên, Check-in kế tiếp và CourseAttendance được bổ sung/cập nhật.
- Bổ sung 5 test PostgreSQL: biên truy vấn, hai scheduler cạnh tranh, auto/manual, auto/self-checkout, rollback rồi chạy lại.
- Không có `SCMS_POSTGRES_TEST_*`: PostgreSQL integration/concurrency bị SKIP, không tính là PASS.
- Cron thực tế trên dev/test chưa được xác minh; test unit chỉ kiểm tra cấu hình lịch và gọi phương thức job.

## Điều kiện nghiệm thu còn thiếu

- Chạy PostgreSQL tests trên schema dev/test biệt lập, kiểm tra khóa và transaction cạnh tranh.
- Xác minh cron mỗi phút trên dev/test; kiểm tra cấu hình override `app.attendance.auto-checkout.cron` không còn lịch cũ hoặc bị tắt.
- Đo query plan và thời gian giữ khóa với nhiều phiên quá hạn. Hiện job lấy toàn bộ ID đủ điều kiện trong một transaction; chưa nghiệm thu tải lớn.
- Giờ ra tự động là mốc kết thúc phiên theo quy tắc, không phải bằng chứng giờ rời thực tế. Chưa kết luận production-safe.
