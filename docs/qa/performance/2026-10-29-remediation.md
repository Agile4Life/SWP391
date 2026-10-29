# Khắc phục hiệu năng theo từng commit

Phạm vi đã được người dùng yêu cầu: xử lý lần lượt các vấn đề đã chẩn đoán và commit riêng từng phần. Thực hiện trên nhánh hiện tại; không đổi API contract, schema hoặc quyền truy cập.

## 1. Xác thực mỗi request

Commit: `578b7c0`.

- Thay việc tải entity User và hồ sơ liên quan bằng JPQL constructor projection chỉ gồm ID, username, status và role.
- Mỗi request vẫn đọc trạng thái hiện tại từ database, loại user đã xóa mềm và từ chối tài khoản inactive/locked. Không cache quyền hoặc tin role cũ trong JWT.
- Test hồi quy đã thất bại trước khi đổi filter, sau sửa đã qua. Bao gồm role hiện tại, tài khoản bị khóa giữa hai request và JWT ký bằng secret khác.
- Bộ backend: 684 test được phát hiện, 0 failure/error, 20 skipped. Các kiểm thử cần Supabase dev/test chưa chạy khi thiếu biến `SCMS_POSTGRES_TEST_*`.
- Kiểm tra JPQL trên Hibernate entity mappings không cần kết nối DB; database policy/profile và 10 case script PowerShell đều qua.
- Môi trường máy gần hết committed memory; kiểm thử dùng một JVM, heap nhỏ và Serial GC. Không đổi cấu hình runtime ứng dụng để né lỗi môi trường.

## 2. Catalog

Commit: `2f84bf4`.

- Thay N truy vấn count theo từng buổi bằng một JPQL `GROUP BY` trên tập class ID duy nhất. Không có buổi học thì không truy vấn count.
- Các buổi cùng lớp dùng chung số đếm; lớp không có đăng ký trả 0. Giữ nguyên thứ tự buổi và response DTO.
- Regression test đã thất bại trước khi đổi service; sau sửa kiểm tra số đếm `[3, 3, 0]`, thứ tự buổi và chỉ một truy vấn nhóm.
- Hibernate xác minh cú pháp và kiểu kết quả của JPQL mà không truy cập DB. Bộ backend: **687 test, 0 failure/error, 20 skipped**.

## 3. Điều hướng sau xác thực

- Điều hướng ngay sau khi API xác nhận đăng nhập thường, Google và OTP thành công, loại bỏ timer 700–800 ms. Giữ trang đích theo role và ý định mua gói.
- Sáu kiểm tra điều hướng đã thất bại trên code cũ; sau sửa chạy bằng MemoryRouter và fake timer, không tua thời gian để làm test qua.
- Frontend: **378 test qua**, lint và production build qua. `DESIGN.md` ghi nhận điều hướng ngay sau xác thực.

## 4. Tải frontend

Chờ thực hiện: chia code theo route, giữ loading/error và luồng PWA; đo lại tải trang production.

Chưa có số đo cải thiện API online sau triển khai; không dùng kết quả unit test để suy ra độ trễ production.
