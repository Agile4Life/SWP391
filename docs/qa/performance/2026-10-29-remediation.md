# Khắc phục hiệu năng theo từng commit

Phạm vi đã được người dùng yêu cầu: xử lý lần lượt các vấn đề đã chẩn đoán và commit riêng từng phần. Thực hiện trên nhánh hiện tại; không đổi API contract, schema hoặc quyền truy cập.

## 1. Xác thực mỗi request

- Thay việc tải entity User và hồ sơ liên quan bằng JPQL constructor projection chỉ gồm ID, username, status và role.
- Mỗi request vẫn đọc trạng thái hiện tại từ database, loại user đã xóa mềm và từ chối tài khoản inactive/locked. Không cache quyền hoặc tin role cũ trong JWT.
- Test hồi quy đã thất bại trước khi đổi filter, sau sửa đã qua. Bao gồm role hiện tại, tài khoản bị khóa giữa hai request và JWT ký bằng secret khác.
- Bộ backend: 684 test được phát hiện, 0 failure/error, 20 skipped. Các kiểm thử cần Supabase dev/test chưa chạy khi thiếu biến `SCMS_POSTGRES_TEST_*`.
- Kiểm tra JPQL trên Hibernate entity mappings không cần kết nối DB; database policy/profile và 10 case script PowerShell đều qua.
- Môi trường máy gần hết committed memory; kiểm thử dùng một JVM, heap nhỏ và Serial GC. Không đổi cấu hình runtime ứng dụng để né lỗi môi trường.

## 2. Catalog

Chờ thực hiện: gộp số đăng ký theo class ID bằng một truy vấn, giữ nguyên dữ liệu trả về.

## 3. Điều hướng sau xác thực

Chờ thực hiện: bỏ delay 700–800 ms sau login/OTP thành công và kiểm tra bằng router thực trong test.

## 4. Tải frontend

Chờ thực hiện: chia code theo route, giữ loading/error và luồng PWA; đo lại tải trang production.

Chưa có số đo cải thiện API online sau triển khai; không dùng kết quả unit test để suy ra độ trễ production.
