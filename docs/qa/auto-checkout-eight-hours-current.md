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

## Kiểm thử ban đầu tại d15ea037

- `mvnw.cmd package -q`: exit 0; Backend 1809 PASS, 48 SKIP, 0 failures/errors; package JAR thành công.
- Lượt chạy riêng tuần tự: CenterCheckinService/Controller/Access và CourseAttendance 60 PASS; OperationsConcurrencyPostgreSqlTest 14 SKIP (gồm 5 test Auto Check-out mới), 0 failures/errors.
- Test biên 7h59/8h/8h01, giờ ra +8, chạy lặp, phiên đã đóng/DENIED, nhiều phiên, Check-in kế tiếp và CourseAttendance được bổ sung/cập nhật.
- Bổ sung 5 test PostgreSQL: biên truy vấn, hai scheduler cạnh tranh, auto/manual, auto/self-checkout, rollback rồi chạy lại.
- Không có `SCMS_POSTGRES_TEST_*`: PostgreSQL integration/concurrency bị SKIP, không tính là PASS.
- Cron thực tế trên dev/test chưa được xác minh; test unit chỉ kiểm tra cấu hình lịch và gọi phương thức job.

## Xác minh PostgreSQL biệt lập ngày 27/11/2026

- Không có Docker trong PATH hoặc cấu hình `SCMS_POSTGRES_TEST_*` được cấp sẵn. Dùng PostgreSQL portable 17.6 đã có trong `target/pt-postgres`, tạo cluster mới `target/checkout-pg-verification`, chỉ nghe `127.0.0.1:55447`, nhãn `scms_checkout_isolated`, TLS bắt buộc. Guard kiểm tra nhãn, địa chỉ loopback và SSL trước khi chạy Maven. Không dùng `.env` ứng dụng hoặc database shared/production.
- Harness giữ profile `supabase`, schema UUID `operations_test_*` cho từng context và cleanup đúng schema do test tạo. Không thay đổi cấu hình database của ứng dụng.
- Lượt đầu 14 test: 9 PASS, 5 ERROR, 0 SKIP. Trigger đúng khi từ chối fixture GRANTED chưa có subscription hiệu lực. Sửa helper fixture để tạo subscription hợp lệ, không tắt trigger.
- Lượt hai 16 test: 15 PASS, 1 ERROR, 0 SKIP. Fixture self-checkout dùng mã cổng không tồn tại; sửa `Test gate` thành mã hợp lệ `A1`. Không đổi GateQrService hoặc business rule.
- Thêm test đo số câu lệnh thực tế/EXPLAIN và test context riêng bật cron mỗi phút. Test cron chỉ tạo phiên rồi chờ, không tự gọi phương thức auto-close.
- PostgreSQL ghi nhận SQL khóa `SELECT ... WHERE id=? FOR NO KEY UPDATE`, do Hibernate ánh xạ `PESSIMISTIC_WRITE`. Các test dùng connection/transaction riêng và `pg_stat_activity` để xác nhận worker thực sự chờ khóa trước khi thả blocker.

### Kết quả cuối sau sửa fixture

- Chạy `mvnw.cmd -f apps/api/pom.xml -Dtest=OperationsConcurrencyPostgreSqlTest,AutoCheckoutSchedulerPostgreSqlTest,CenterCheckinServiceTest,CenterCheckinControllerTest,CenterCheckinAccessTest,CourseAttendanceServiceTest package` với cấu hình test trỏ duy nhất cluster loopback đã guard.
- **76 PASS, 0 SKIP, 0 failures/errors; BUILD SUCCESS**. Đây là suite được chọn cho Auto Check-out, không phải lượt chạy lại toàn bộ Backend.
- OperationsConcurrencyPostgreSqlTest: **15 PASS** (14 test ban đầu và 1 test SQL mới). AutoCheckoutSchedulerPostgreSqlTest: **1 PASS**. Unit/controller/access/CourseAttendance: **60 PASS**.
- PostgreSQL đã kiểm chứng 7h59, đúng 8h, quá 8h; giờ ra +8; nhiều phiên; hai worker scheduler; auto/manual và auto/self-checkout cạnh tranh; không ghi đè phiên đóng; chạy lặp; rollback rồi job chạy lại; hiện diện và Check-in tiếp theo.
- Cron Spring thật thực thi lúc **14:32:00 +07**, phiên được quan sát đã đóng sau **40.759 ms** chờ (khoảng 40,8 giây); test không tự gọi job. Clock ứng dụng và session kiểm tra là `Asia/Ho_Chi_Minh`, SSL được xác nhận qua `pg_stat_ssl`.
- Fixture 5 phiên quá hạn: **11 prepared statements** (1 truy vấn ID + 5 SELECT khóa + 5 UPDATE); chạy lại **1 statement**, đóng 0 phiên. Cả lời gọi transaction khoảng **37 ms**; không suy ra SLA production từ mẫu này.
- EXPLAIN ANALYZE trước khi đóng 5 phiên: truy vấn toàn cục dùng **Seq Scan + Sort**, execution **0,137 ms**; truy vấn theo member dùng **ix_checkins_member_time + Sort**, execution **0,082 ms**. Mẫu nhỏ có 9 dòng, chưa đại diện dữ liệu lớn.
- Server log ghi 13 khoảng quan sát từ khi SELECT khóa hoàn tất tới COMMIT/ROLLBACK ở lượt cuối: **2–37 ms**. Đây là khoảng quan sát gần đúng, không phải phép đo chính xác thời điểm bắt đầu giữ khóa. Các blocker chủ động trong test khiến worker phải chờ khóa; không có lỗi lock timeout.
- `pg_stat_database.deadlocks = 0`; server log không có deadlock/lock-timeout. Guard cuối xác nhận **0 schema operations_test_* còn lại**. Cluster riêng đã dừng; không xóa hay sửa dữ liệu shared/production.

## Giới hạn còn lại

- Cluster loopback là môi trường kiểm thử; chưa xác minh cấu hình hoặc job trên VPS/dev server triển khai. Cần kiểm tra override `app.attendance.auto-checkout.cron` ở môi trường đó.
- Đo query plan và thời gian giữ khóa với nhiều phiên quá hạn. Hiện job lấy toàn bộ ID đủ điều kiện trong một transaction; chưa nghiệm thu tải lớn.
- Giờ ra tự động là mốc kết thúc phiên theo quy tắc, không phải bằng chứng giờ rời thực tế. Chưa kết luận production-safe.
