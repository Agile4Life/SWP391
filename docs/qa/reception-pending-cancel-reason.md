# Lý do hủy yêu cầu gói tập chưa thanh toán

## Phạm vi

- Trang `/staff/reception`: giữ popup xác nhận, thêm textarea giống KYC, bắt buộc lý do sau trim, tối đa 500 ký tự. Giữ yêu cầu và nội dung khi API lỗi; chống submit lặp và khóa đúng ID trong popup.
- `POST /api/v1/memberships/subscriptions/{id}/cancel` nhận `{ "reason": "..." }`. RECEPTIONIST/STAFF phải có lý do; MEMBER/CENTER_MANAGER vẫn có thể gọi không có body như trước.
- Service giữ nguyên khóa hội viên/yêu cầu, quyền sở hữu và guard payment/VNPay. Chỉ trạng thái `pending_payment` được chuyển sang `cancelled`; không thay refund/wallet/gia hạn/nâng cấp/KYC.
- Lưu lý do và thông báo `system`, entity `membership_subscription`, đúng ID/chủ yêu cầu, actionPath `/member/packages` trong transaction hiện có. External push dùng cơ chế after-commit hiện có; không bảo đảm thiết bị nhận push ngay. Thử lại yêu cầu đã hủy không thay lý do hoặc gửi thông báo lặp.

## Schema — cần backend/leader review trước phát hành

- Entity `MembershipSubscription` thêm `pending_cancellation_reason VARCHAR(500) NULL`. Chỉ lưu lý do hủy yêu cầu chưa thanh toán, không tái sử dụng cột bảo lưu hoặc entity yêu cầu hoàn tiền.
- Bản ghi cũ giữ NULL; không backfill lý do giả, không sửa dữ liệu đang chờ.
- Code-First: không tạo/chạy SQL migration thủ công. Backend/ops cần review phần bổ sung schema từ JPA và kiểm chứng nâng cấp trên PostgreSQL dev/test biệt lập trước release; không dựa vào app tự cập nhật production.
- `compose.yml` hiện ghim Hibernate `ddl-auto:update`; cần quy trình schema/config được leader duyệt trước deploy. Chưa sửa compose/profile hoặc khởi động backend trên DB chung. Khi dùng `validate`, cột mới chưa có sẽ làm startup thất bại; `none` không làm cột tự xuất hiện.
- Chưa kiểm thử PostgreSQL thật hoặc nghiệm thu nâng cấp schema. Unit/mock tests không chứng minh rollback/lock/schema trên DB thật. Rollback ứng dụng giữ lại cột và dữ liệu, không drop tự động.

## Kiểm tra thủ công trên localhost dev/test

1. Đăng nhập Receptionist, mở `/staff/reception`, chọn Hủy yêu cầu của một yêu cầu chưa thanh toán. Kiểm tra popup hiển thị đúng ID, hội viên và gói.
2. Bỏ trống/chỉ nhập khoảng trắng: không gửi API. Nhập lý do hợp lệ: payload chứa lý do đã trim, không quá 500 ký tự.
3. Giả lập API lỗi: yêu cầu và lý do còn nguyên, hiển thị lỗi, không có thông báo thành công. Thử lại không đổi ID.
4. Sau thành công: yêu cầu rời danh sách chờ; đăng nhập đúng chủ yêu cầu kiểm tra thông báo có ID/gói/lý do, không xuất hiện cho hội viên khác.
5. Kiểm tra Giữ yêu cầu không gửi API; thao tác thu tiền, gia hạn, trial và hủy gói hoàn tiền vẫn theo luồng cũ.
