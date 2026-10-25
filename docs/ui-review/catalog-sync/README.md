# Đồng bộ landing và portal — 23/10/2026

Nguồn dữ liệu: `GET /api/v1/public/catalog`, dùng cùng JPA Entity với danh mục quản lý, hồ sơ HLV và lịch lớp trong portal. Không sửa giá hoặc hồ sơ trong database khi thực hiện thay đổi này.

- Bảng giá hiển thị tên, giá VND, thời hạn, mô tả và giới hạn lượt đặt lớp; dùng chung helper trình bày với trang mua gói của hội viên.
- HLV chỉ công khai tên, chuyên môn, giới thiệu, chứng chỉ và avatar; bỏ hồ sơ inactive/đã xóa. Trang chi tiết dùng ID thật và lịch thực tế.
- Lịch công khai gồm buổi scheduled còn trong tương lai trong 7 ngày tới. Chỗ trống sử dụng cùng cách đếm ghi danh hiện có của portal.
- Ảnh HLV mới `coach-aquatics.jpg`, `coach-tennis.jpg`, `coach-personal.jpg` được dùng theo bộ môn khi chưa có avatar, luôn có nhãn minh họa. Không đổi ảnh minh họa thành danh tính HLV thật.
- Landing tải lại khi focus và mỗi 60 giây, chỉ nhận phản hồi mới nhất; lỗi sẽ ẩn giá/lịch cũ và hiện thử lại. Bộ lọc lịch tự về tất cả khi bộ môn đã chọn không còn tồn tại.

Kiểm chứng:

- Frontend: build, lint, 200 tests đạt.
- Backend: 511 tests, 0 failures/errors; 17 skipped theo điều kiện môi trường. Chưa kiểm thử truy vấn trên Supabase dev/test thật.
- `scripts/test-database-config.ps1`: 10 ca đạt.
- `scripts/verify-public-ui.cjs`: 8 viewport, menu, auth/OTP và CTA hội viên đạt.
- `scripts/verify-public-animation.cjs`: reveal/replay, lọc động, native scroll, mobile, reduced motion và fallback đạt.
- `scripts/verify-ux-consistency.cjs`: 13 route, 5 kích thước dashboard, dialog, loading/empty/error; giữ dashboard 4 cột và sidebar icon.
- `scripts/verify-catalog-sync.cjs`: đối chiếu giá landing–portal, đổi giá, hồ sơ HLV, lịch, empty/error/retry; viewport 320/390/768/1024/1440/1920/2560px.

Các ảnh trong thư mục này dùng **API giả lập để kiểm chứng giao diện**, không phải bảng giá hoặc HLV của trung tâm. Môi trường chạy thật luôn lấy API, không fallback về fixture.

Chạy các script browser bằng `NODE_PATH` trỏ tới `playwright-core`, `CHROME_PATH` trỏ tới Chromium và `PUBLIC_UI_URL` nếu dùng cổng khác `5173`.
