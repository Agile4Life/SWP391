# Rà soát cỡ tiêu đề — 23/10/2026

Đã đo `getComputedStyle` trên 19 trang hiện hành tại 390, 768, 1440 và 2560px (76 lượt trang), thêm trạng thái popup nhóm cơ và dialog tạo tài khoản. Dùng theme sáng mặc định, reduced motion và API giả lập; không gọi API dữ liệu thật. Chưa thay cỡ chữ giao diện trong lần rà soát này.

## Những nơi nên tăng cỡ chữ

| Vị trí | Cỡ render hiện tại | Đề xuất |
| --- | --- | --- |
| Dashboard: tên bốn cột “Gói tập của tôi”, “Lịch tập của tôi”, “Thẻ & thanh toán”, “Sức khỏe & cân bằng” | 12px desktop, 13px mobile | 16px |
| Dashboard: tên lớp trong lịch đã đặt, link thẻ “Lịch lớp học” | 12px | 15–16px |
| Dashboard: “Mã QR check-in”, “Hồ sơ sức khỏe” | 13px | 16px |
| Dashboard: tên gói tập, “Lớp đã đăng ký” | 14px | 16–18px |
| Hồ bơi / tennis: tiêu đề ba chương trình | 14px | 18px |
| Popup nhóm cơ ở hero: tên cơ | 13px | 15–16px, kiểm tra lại chiều cao popup |
| Landing: tên trong thẻ câu chuyện | 14px mobile, 15px desktop | 16px |
| Landing: tiêu đề ba bước tuần đầu | 15px | 17–18px |
| Trang lịch học: tên lớp trong thẻ | 15px | 16–17px |

Đây là đánh giá phân cấp thị giác, không phải khẳng định mọi tiêu đề dưới 16px đều vi phạm một tiêu chuẩn bắt buộc. Nhãn phụ, badge, số thứ tự và metadata không được xem là tiêu đề cần phóng lớn đồng loạt.

## Những phần đang ổn

- Tiêu đề trang portal: 24px mobile, khoảng 32px desktop.
- Tiêu đề section chính ở landing: thường 28–45px; hero và CTA có thang riêng.
- Tiêu đề trang/form đăng nhập, đăng ký và trang HLV đủ nổi bật.
- Tiêu đề card thông thường và dialog portal: 17px; có thể chuẩn hóa 18px sau nếu muốn phân cấp mạnh hơn.
- Không có tiêu đề tràn ngang/cắt chữ theo phép đo `scrollWidth`/`clientWidth`; không có lỗi JavaScript trong browser.

## Nguồn

- Dashboard: `apps/web/src/features/member/member-board.css`.
- Landing, thể thao và popup nhóm cơ: `apps/web/src/features/landing/fitness-public.css`.
- Tiêu đề portal dùng chung: `apps/web/src/features/portal/portal-shell.css`.
- [Số đo chi tiết](sizes.json), [dashboard desktop](dashboard-1440.png), [dashboard mobile](dashboard-390.png).
- Chạy lại: `node scripts/audit-heading-sizes.cjs`, với Playwright qua `NODE_PATH` và Chromium qua `CHROME_PATH` nếu cần.

Giữ dashboard bốn cột và sidebar icon khi điều chỉnh sau này; tăng cỡ chữ có chọn lọc và cho tiêu đề xuống dòng tự nhiên. Theo `DESIGN.md`, mọi quyết định đổi cỡ chữ cần được cập nhật cùng phần quy chuẩn liên quan.
