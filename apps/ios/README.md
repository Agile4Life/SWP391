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
- `SOL/Features/Auth`: đăng nhập, đăng ký + OTP, quên mật khẩu, đăng nhập Google (`ASWebAuthenticationSession` + PKCE, redirect cố định `solapp://login`; cần backend có tham số `client=ios`, xem `docs/api-contracts/openapi-sprint1.yaml`).
- `SOL/Features/Member`: tổng quan, lớp học (đăng ký miễn phí theo gói hoặc thanh toán ví/VNPay/tiền mặt), thẻ QR động, check-in, gói tập (đăng ký/gia hạn/nâng cấp/thanh toán), ví, thanh toán + hoá đơn PDF, tiến độ + giáo án, thông báo, hồ sơ, KYC (ảnh thu nhỏ ≤1600px), PT 1:1, hỗ trợ (phiếu), trợ lý AI.
- `SOL/Features/Shop`: danh mục, chi tiết, giỏ hàng (lưu cục bộ), báo giá, đặt hàng nhận tại quầy/giao tận nơi (địa chỉ + tỉnh/phường), thanh toán ví/VNPay, đơn hàng; nhân viên xử lý đơn (thu tiền, chuẩn bị, giao, hoàn tất, huỷ).
- `SOL/Features/Chat` (tin nhắn trực tiếp, thăm dò 4 giây), `Courts` (xem giờ trống, đặt/huỷ sân), `Explore` (Explore 3D bằng SceneKit từ đa giác tầng/khu vực của scene web, có trạng thái phòng thật; `CenterScene.swift` sinh từ `solCenter.scene.ts`).
- `SOL/Features/Staff`: lễ tân (thu tiền mặt, huỷ yêu cầu, duyệt bảo lưu, tra cứu hội viên), check-in quầy (quét QR hội viên), lớp hôm nay, hộp thư hỗ trợ (trả lời, đổi trạng thái, chuyển cấp lên quản lý), đơn sản phẩm.
- `SOL/Features/Coach`: lịch dạy 14 ngày, điểm danh + chấm tiến bộ.
- `SOL/Features/Manager` + `Admin`: báo cáo doanh thu (biểu đồ), duyệt/từ chối yêu cầu huỷ gói; người dùng (khoá/mở/xoá/tạo), tài khoản nhân viên, gói tập (tạo/sửa/ngưng bán), phòng & môn tập, thiết bị, nhật ký hệ thống (Admin).
- Role ADMIN dùng bộ tab Manager; phân quyền thật vẫn do backend kiểm tra.

## Giới hạn so với web

- Explore 3D là bản mô hình khối rút gọn (không walk-through, không diễn viên động, không hiệu ứng hậu kỳ).
- Chat trực tiếp/hỗ trợ dùng Supabase Realtime qua WebSocket (`Core/Realtime.swift`, giao thức Phoenix như `chatRealtime.ts`), rơi về thăm dò 4 giây khi realtime tắt hoặc lỗi; chưa có realtime cho trạng thái gói tập.
- Quản trị: có phân quyền vai trò, phân công huấn luyện viên (chuyển/xoá, chưa gán mới), sản phẩm (sửa, tồn kho, ảnh, tạo mới không kèm thành phần dinh dưỡng), xuất CSV doanh thu; chưa có quản lý danh mục sản phẩm, PDF.
- VNPay mở trong Safari View Controller; app đối chiếu trạng thái giao dịch sau khi đóng.
- Đăng nhập Google chỉ hoạt động khi VPS đã deploy backend mới (tham số `client=ios`).
- Chưa kiểm với tài khoản thật: chỉ kiểm bằng dữ liệu mẫu (Debug) và API công khai.
