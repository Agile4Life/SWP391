# SÖL iOS (SwiftUI native)

App iOS thuần SwiftUI (iOS 17+), gọi thẳng REST `/api/v1` của VPS `https://scms.bluesymphony.site` bằng Bearer token (lưu Keychain).
Không có backend/database riêng: dữ liệu dùng chung với web. Bản bọc WebView cũ (Capacitor) vẫn ở `apps/web/ios`.

## Chạy

```bash
open apps/ios/SOL.xcodeproj          # chọn iPhone 18 Pro rồi Run
xcodebuild -project apps/ios/SOL.xcodeproj -scheme SOL \
  -destination 'platform=iOS Simulator,name=iPhone 18 Pro' test CODE_SIGNING_ALLOWED=NO
```

Trỏ sang máy chủ khác: biến môi trường `SOL_API_BASE` (vd. `http://localhost:8080/api/v1`).

Bản Debug có chế độ demo không cần tài khoản (dữ liệu mẫu, chỉ GET): `SOL_DEMO_ROLE=member|staff|coach|manager`,
tuỳ chọn `SOL_DEMO_TAB=<số tab>`. Bản Release không chứa mã này.

## Cấu trúc

- `SOL/Core`: `APIClient` (bóc `ApiResponse.data`, `Accept-Language`, xử lý 401), `AuthStore`, Keychain, theme (token Light charcoal–salmon / Dark charcoal–bạc theo `DESIGN.md`), `Lang` (vi/en).
- `SOL/UI`: thành phần dùng chung (Loader + loading/empty/error, card, nút, QR).
- `SOL/Features/Auth`: đăng nhập, đăng ký + OTP, quên mật khẩu.
- `SOL/Features/Member`: tổng quan, lớp học, thẻ QR động, check-in (quét QR cổng), gói tập (đăng ký/gia hạn/thanh toán ví/VNPay/tiền mặt), ví, thanh toán + hoá đơn PDF, tiến độ + giáo án, thông báo, hồ sơ.
- `SOL/Features/Shop` (xem sản phẩm, API public), `Chat` (tin nhắn trực tiếp, thăm dò 4 giây), `Courts` (xem giờ trống, đặt/huỷ sân).
- `SOL/Features/Staff`: lễ tân (thu tiền mặt, huỷ yêu cầu, duyệt bảo lưu, tra cứu hội viên), check-in quầy (quét QR hội viên), lớp hôm nay.
- `SOL/Features/Coach`: lịch dạy 14 ngày, điểm danh + chấm tiến bộ.
- `SOL/Features/Manager`: báo cáo doanh thu (biểu đồ), duyệt/từ chối yêu cầu huỷ gói, lớp hôm nay.
- Role ADMIN dùng bộ tab Manager; phân quyền thật vẫn do backend kiểm tra.

## Chưa làm (so với web)

Google OAuth, chat hỗ trợ/AI và realtime Supabase (chat trực tiếp dùng thăm dò), giỏ hàng và đặt mua (cửa hàng chỉ xem), PT 1:1, KYC, nâng cấp gói, quản trị người dùng/danh mục, Explore 3D.
Thanh toán VNPay mở trong Safari View Controller và app đối chiếu trạng thái giao dịch sau khi đóng.
