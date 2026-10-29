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

Commit: `ef9c246`.

- Điều hướng ngay sau khi API xác nhận đăng nhập thường, Google và OTP thành công, loại bỏ timer 700–800 ms. Giữ trang đích theo role và ý định mua gói.
- Sáu kiểm tra điều hướng đã thất bại trên code cũ; sau sửa chạy bằng MemoryRouter và fake timer, không tua thời gian để làm test qua.
- Frontend: **378 test qua**, lint và production build qua. `DESIGN.md` ghi nhận điều hướng ngay sau xác thực.

## 4. Tải frontend

- Chuyển 28 module page/layout sang native lazy route của React Router. Màn hình khởi động có loading/error theo theme; chuyển route sau khởi động có trạng thái tải, giữ trang và shell hiện tại trong khi chờ.
- PWA chỉ precache entry/static dependency và CSS; module đã truy cập được cache theo allowlist build. Resource Timing + PerformanceObserver đồng bộ cả module tải trước lần worker kiểm soát đầu tiên và module hoàn tất sau đó. API, request có Authorization và URL ngoài allowlist không được cache.
- Test service worker đã thất bại trước sửa đối với precache quá rộng, không giữ module đã mở và thiếu đồng bộ trước first control; sau sửa đều qua.
- Browser kiểm tra trường hợp khó: giữ đăng ký worker tới sau khi dashboard đã hiện, tắt HTTP cache, rồi bật offline/reload vẫn hiện dashboard. Trang thẻ chưa mở không được tải trước. Giữ request module thẻ để xác nhận loading cùng shell cũ; hủy request để xác nhận UI lỗi; tải lại thành công sau khôi phục mạng.
- Browser PWA tổng thể qua bốn role, mobile/desktop, QR camera JavaScript fallback và offline shell. Frontend cuối cùng: **382 test qua**, lint và production build qua.
- Rà soát độc lập đã xác nhận sửa được first-control race và thiếu phản hồi khi chờ route; không còn phát hiện Critical/Important/Minor.

### Số đo tải `/login` trước và sau

| Chỉ số | Trước | Sau |
| --- | --- | --- |
| JavaScript đã giải nén tải lúc mở trang | 1.303.271 byte | 445.522 byte (giảm 65,8%) |
| JavaScript truyền qua mạng | 349.455 byte | 139.206 byte (giảm 60,2%) |
| Form xuất hiện, mô phỏng 1,6 Mbps/150 ms | Chưa ghi bằng observer ở baseline | 1.525 ms |

FCP sau thay đổi có thể là loading state, nên không dùng FCP để khẳng định mức cải thiện thời gian form xuất hiện. Phép đo dùng production preview local, cache lạnh, chặn request ngoài origin và không gọi API thật. Dữ liệu: [trước](2026-10-29-login-before-split.json), [sau](2026-10-29-login-after-split.json).

Công cụ chạy lại: `scripts/audit-load-performance.cjs` (ngân sách startup JS dưới 650 KB), `scripts/verify-lazy-routes.cjs` (first-control/offline/loading/error/retry), `scripts/verify-portal-pwa.cjs` (PWA/QR/role). Cần production preview tại port 4173, `playwright-core` trong `NODE_PATH`; có thể đặt `CHROME_PATH`.

Hoàn tất kiểm chứng sau nửa đêm, **30/10/2026**; tên artifact giữ ngày bắt đầu kiểm tra 29/10.

Chưa có số đo cải thiện API online sau triển khai; không dùng kết quả unit test để suy ra độ trễ production.
