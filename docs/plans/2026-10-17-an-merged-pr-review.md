# SCRUM-72 / SCRUM-73 / SCRUM-74 / SCRUM-75: review sau merge

Phạm vi: PR #17 (`4a5f924`), PR #20 (`f679298`), các commit SecurityConfig trong ảnh
và PR #26 (`cdf207c`). Đã fetch `origin/main`; HEAD và `origin/main` cùng ở `dd7561f`
khi bắt đầu chốt bản sửa. Không viết lại lịch sử các PR đã merge.

## Những lỗi đã được sửa trước lượt này

| Commit | Bản sửa được giữ lại |
| --- | --- |
| `ebdd0a2` | Constructor injection `EnrollmentService` đã có `@Autowired`. |
| `f72b52d` | Lỗi trigger PostgreSQL được chuyển thành response 409/403 có i18n. |
| `f6e6282` | Nâng cấp nullability `center_checkins.member_id` để lưu lượt QR không xác định được hội viên. |
| `f840d75` | Quyền truy cập payment của Member đã được sửa; giữ các matcher tương ứng. |

## Những lỗi còn sót đã xử lý

- SCRUM-72: kiểm tra cả ngày và giờ bắt đầu khi tạo buổi học; chặn `level` ngoài enum tại DTO.
- SCRUM-73/74: chỉ booking/xếp hàng cho buổi `scheduled` chưa bắt đầu, kiểm tra lại sau khi lấy khóa lớp.
- SCRUM-73/74: kiểm tra đầy đủ `start_date <= today <= end_date` và trạng thái `active` của gói tập.
- SCRUM-73/74: booking và vào hàng chờ dùng cùng khóa lớp; booking thành công đóng mục `waiting` của chính hội viên trong transaction đó.
- SCRUM-73: triển khai route đã có trong OpenAPI `GET /classes/enrollments/my`; lấy ID từ principal, lọc ở repository và kiểm tra role.
- SCRUM-75: khóa hội viên trước khi kiểm tra lượt đang mở để hai QR của cùng người không cùng nhận `GRANTED`.
- SCRUM-75: khóa subscription đang quét để không dùng QR đã bị hủy trong lúc scan; khóa bản ghi checkout để bảo toàn thời điểm checkout đầu tiên.
- SCRUM-75: từ chối QR của hội viên bị khóa/xóa, vẫn lưu bản ghi `DENIED`.
- SCRUM-75: lưu message key của lý do từ chối, dịch khi trả DTO theo ngôn ngữ hiện tại; giữ khả năng đọc dữ liệu câu chữ cũ.
- SCRUM-75: giới hạn tên cổng 50 ký tự ở request; cập nhật cả ba bundle i18n và OpenAPI.

Các enrollment/waitlist vẫn gắn với lớp theo entity và master guide hiện hành.
Không gán tùy ý buổi học cho các bản ghi cũ; các trường buổi học trong lịch sử enrollment có thể null.
Giữ nguyên trigger P2/P3/P4 và kiến trúc Code-First.

## Kiểm chứng

- Test mới được chạy RED trước khi sửa: ngày/giờ buổi học, ngày hiệu lực gói,
  booking còn hàng chờ, route thiếu, tài khoản bị khóa/xóa, ngôn ngữ và validation.
- Chạy toàn bộ Maven test với POM tạm chỉ đổi thư mục build để tránh `target`
  đang được agent CI/Supabase khác sử dụng. Không bỏ test trong lượt kiểm chứng cuối.
- Kết quả: **312 tests, 0 failures, 0 errors, 17 skipped**.
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-database-config.ps1`:
  **10 cases passed**.
- Kiểm tra security filter chain thực tế cho Member/Receptionist/Coach/Manager và anonymous.
- Bổ sung test Supabase thật cho scan/checkout đồng thời, hủy subscription khi scan,
  và biên ngày hiệu lực. Chưa chạy DB thật vì không có `SCMS_POSTGRES_TEST_*`;
  17 test skipped bao gồm các test DB này. Không coi unit test là bằng chứng khóa đã chạy trên Supabase.

Các thay đổi CI/Supabase/Finance và graph toàn repo của phiên khác được giữ ngoài commit sửa PR của An.
