# Kiểm tra tải trang và xác thực — 29/10/2026

Commit được kiểm tra: `3bb16f1`. Lần này kiểm tra và ghi nhận bằng chứng; chưa thay đổi code ứng dụng.

Người dùng xác nhận **cả bản online và local đều chậm**, gồm đăng nhập và các thao tác. Vì vậy cần ưu tiên đường xử lý API/database và frontend dùng chung, thay vì chỉ điều tra cold start trên hosting.

## Số đo

API online lấy từ `apps/web/vercel.json`: `https://swp391-u1fs.onrender.com`.
Ba cặp request GET liên tiếp, mỗi request tạo kết nối HTTPS mới, server đang hoạt động:

| Endpoint | HTTP | Thời gian tổng |
| --- | --- | --- |
| `/api/v1/health` | 200 | 0,241–0,387 giây |
| `/api/v1/public/catalog` | 200 | 1,319–1,355 giây |

Health không truy vấn database; catalog thực hiện các truy vấn nghiệp vụ. Chênh lệch khoảng một giây nằm trên đường xử lý catalog, nhưng chưa tách được riêng thời gian SQL, chờ connection pool và serialize dữ liệu. Đây là số đo từ máy kiểm tra, không phải từ thiết bị của người dùng.

Frontend dùng build production local, Chrome headless, viewport 390×844, cache lạnh, tắt service worker và chặn request ngoài origin để tách phần ứng dụng. Kịch bản mạng giới hạn 1,6 Mbps, latency 150 ms, không giảm tốc CPU:

| Chỉ số trang `/login` | Không giới hạn mạng | Mạng giới hạn |
| --- | --- | --- |
| First Contentful Paint | 360 ms | 2.584 ms |
| Tải JavaScript chính | 54,7 ms | 2.188,2 ms |
| JS truyền qua mạng | 349.466 byte | 349.466 byte |

File JS sau giải nén dài 1.303.354 byte; CSS là 253.009 byte trên đĩa, 44.968 byte truyền qua mạng. Các số FCP này là phép đo mô phỏng có kiểm soát, không phải LCP/INP/CLS hoặc trải nghiệm production. Font, Google Identity và ảnh ngoài origin đã bị chặn nên chưa nằm trong số đo.

Dữ liệu gốc: [API](2026-10-29-api-latency.json), [frontend](2026-10-29-login-load.json).

### Kết nối database của bản local

Đo chỉ đọc qua PostgreSQL JDBC, dùng thông tin kết nối trong `.env` mà local runner sử dụng và TLS `sslmode=require` như profile `supabase`. Không khởi động API vì Hibernate khởi động có thể đồng bộ schema; không đọc dữ liệu tài khoản và không ghi dữ liệu.

- Mở kết nối mới: **1.507,9 ms**. Đây là chi phí mở kết nối, không phải chi phí bắt buộc cho mỗi request khi Hikari tái sử dụng connection.
- Sáu câu `SELECT 1` tuần tự trên cùng connection: **121,4 / 104,9 / 101,5 / 103,7 / 104,8 / 103,7 ms**. Trung vị khoảng **104,3 ms**, cho thấy ngay cả truy vấn gần như không xử lý dữ liệu vẫn chịu chi phí round trip đáng kể.
- Với đường xử lý thực hiện nhiều truy vấn tuần tự, phần chi phí này cộng dồn. Chưa đo số SQL thực tế của một lần đăng nhập nên không suy ra thời gian đăng nhập chỉ từ số đo này.
- API local chưa trả lời tại `127.0.0.1:8080` khi kiểm tra. Không xem thời gian timeout kết nối tới API local là độ trễ xử lý ứng dụng.

Dữ liệu gốc: [JDBC local](2026-10-29-local-db-latency.json).

## Nguyên nhân xác nhận được từ code

1. **Tải tất cả trang ngay từ đầu.** `apps/web/src/app/router.tsx` import trực tiếp các trang Member, Staff, Coach, Manager và Chat. Mở `/login` vẫn tải bundle chung có các phần như QR, Supabase Realtime và xuất ảnh thẻ hội viên (`html2canvas` được import ở `MemberCardPage.tsx:3`). Phép đo mạng giới hạn xác nhận JS chung chiếm khoảng 2,19 giây tải.
2. **Chờ thêm 700–800 ms sau xác thực thành công.** `LuxuryLoginForm.tsx:85` và `:278` dùng `setTimeout(..., 700)` trước khi điều hướng cho cả Google và đăng nhập thường. `RegisterPage.tsx:113`–`:115` còn chờ 800 ms sau khi API xác nhận OTP thành công. Các khoảng chờ này xảy ra sau khi API đã trả kết quả thành công.
3. **Catalog gọi SQL đếm riêng cho từng buổi học.** `PublicCatalogService.java:50`–`:51` gọi `enrollments.countByGymClassIdAndStatus(...)` trong `.map(...)`. N buổi học tạo N lần gọi count ngoài các truy vấn gói, HLV và lịch học. Những buổi cùng lớp còn có thể đếm lặp cùng class ID. Số vòng truy vấn tăng theo dữ liệu; chưa đo riêng từng SQL ở production.
4. **Mỗi request có JWT đều đọc lại entity User từ database.** `JwtAuthenticationFilter.java:49` gọi `findWithRoleByIdAndDeletedAtIsNull`, sau đó kiểm tra status/role. Đây là kiểm tra bảo mật cần giữ; tuy nhiên filter chỉ cần ID, username, status và role mà đang hydrate cả entity User. User còn có ba quan hệ inverse one-to-one tới Member, Coach và Receptionist. Cần đo số SQL thực tế hoặc thay truy vấn này bằng scalar DTO/projection để giảm chi phí mà vẫn kiểm tra trạng thái tài khoản trên từng request. Chưa xác nhận số SQL/phút hoặc thời gian của filter từ production.
5. **Luồng gửi OTP chờ SMTP đồng bộ.** `AuthService.issueAndSendOtp` gọi `otpDeliveryPort.send` và `SmtpOtpDeliveryAdapter.send` gọi `mailSender.send` trước khi trả kết quả. Chưa cấu hình timeout SMTP trong `application.yml`. Điều này có thể gây chờ lâu khi mail server chậm, nhưng không giải thích được mọi lần xác nhận QR hoặc mọi API. Không gửi OTP thật trong lần kiểm tra này.

## Hạ tầng và giới hạn xác minh

- Hikari mặc định tối đa 5 connection, tối thiểu 1, timeout chờ connection 30 giây. Đây là cấu hình mặc định trong repo; biến môi trường production có thể ghi đè. Chưa có số đo pool active/pending, nên chưa kết luận pool đã nghẽn và chưa có cơ sở tăng pool.
- Backend được proxy từ Vercel tới Render. Nếu dịch vụ Render đang dùng Free instance, [Render ghi rõ](https://render.com/docs/free#spinning-down-on-idle) dịch vụ ngủ sau 15 phút không có traffic và lần đánh thức thường mất khoảng một phút. Chưa xác minh plan đang dùng hoặc quan sát cold start; ba mẫu health ở trên là lúc server đang hoạt động.
- Người dùng đã xác nhận cả online/local và đăng nhập/các thao tác đều chậm. Chưa có URL frontend người dùng đang truy cập hoặc trace của tài khoản thật. Kết nối Vercel hiện không có quyền đọc team của project, nên không xem được region, plan hay deployment logs bằng connector.
- Không đăng nhập bằng tài khoản thật, không giả mạo JWT, không thay đổi database, cấu hình dịch vụ hoặc subscription.

## Thứ tự xử lý đề xuất

1. Tách tải các route và các thư viện lớn theo nhu cầu; kiểm tra service worker hiện precache toàn bộ asset để việc chia bundle không tạo tranh chấp tải ngay lần cài PWA.
2. Bỏ thời gian chờ 700–800 ms trước điều hướng sau đăng nhập/xác nhận OTP thành công.
3. Gộp truy vấn đếm enrollment theo tập class ID, ánh xạ kết quả thay cho count trong vòng lặp.
4. Dùng truy vấn scalar DTO/projection cho principal; vẫn kiểm tra `deletedAt`, `status` và role trên database ở mỗi request, không cache quyền để đổi lấy tốc độ.
5. Đo request đăng nhập/OTP/check-in thực tế; kiểm tra SQL và pool trước khi đổi tài nguyên hạ tầng. Đặt timeout SMTP và tách việc giữ DB connection khỏi I/O gửi mail khi triển khai thay đổi này.

Không cam kết mức cải thiện cho các mục chưa có phép đo trước/sau.
