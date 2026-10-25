# Portal full viewport — 22/10/2026

Quyết định cuối: đồng bộ màu với landing và phủ toàn trang; giữ nguyên tổ chức component. Dashboard bốn cột, rail icon 76px, ảnh/thẻ, thứ tự nội dung, cỡ chữ, khoảng cách bên trong và tương tác được giữ nguyên. Chỉ bỏ giới hạn/padding/viền khung ngoài và thay bảng màu.

Nền `#202020`, bề mặt `#292929` / `#303030`, nút chính salmon `#ce9180` và hover `#e1aa98`. Form, dropdown, bộ chọn ngày/giờ, dialog, trạng thái và các màu viết trực tiếp trong màn nghiệp vụ được điều chỉnh cùng phạm vi portal. Hóa đơn giữ nền trắng để in.

Kiểm chứng bằng `scripts/verify-ux-consistency.cjs`, dùng Playwright Core và API giả lập trên preview local. Script kiểm tra 13 route tại 390/1440px; dashboard thêm 768/1920/2560px; full viewport, màu nút, không tràn document, giữ rail/bốn cột, cuộn native, ba form tạo mới, picker ngày/giờ, focus/Escape và trạng thái trống/lỗi. Không tạo hoặc sửa dữ liệu backend thật.

Build, lint và 196 test frontend đã qua. Cấu trúc JSX của các màn được sửa được đối chiếu với bản trước để xác nhận không thay tổ chức component; phần nội dung chỉ rút gọn text và bỏ thông tin giả/không có căn cứ.

- [Desktop](member-dashboard-1440.png)
- [Màn hình rộng](member-dashboard-2560.png)
- [Mobile](member-dashboard-390.png)
- [Form lớp học](staff-classes-create.png)
