# Portal PWA và check-in bằng camera

Ngày: 29/10/2026. Người dùng đã duyệt hướng thiết kế trong chat và yêu cầu chia ba sub-agent thực hiện.

## Mục tiêu và phạm vi

Portal của Member, Receptionist, Coach và Center Manager có thể cài lên màn hình chính Android/iOS, mở thẳng `/portal`, chuyển tới trang đúng role sau xác thực. Giao diện mobile ưu tiên thao tác một tay, giữ nhận diện SÖL charcoal–salmon, theme sáng/tối và cuộn native. Desktop giữ rail icon và bố cục dashboard hiện hành.

Mở rộng SCRUM-75 (An), SCRUM-83 (Khoa), SCRUM-87 (Thịnh): Member dùng camera điện thoại quét QR cổng đang hiển thị trên web lễ tân. Giữ luồng staff quét thẻ hội viên hiện có. Không thêm ứng dụng native, thanh toán, push notification hoặc thay database.

## PWA

Manifest có `id` và `start_url` là `/portal`, `scope: /`, `display: standalone`, icon Android 192/512, maskable và apple-touch-icon. Scope phải chứa các tuyến portal và login. Tái sử dụng PortalHome và homePath; phiên hết hạn yêu cầu đăng nhập, không bypass API authorization. Browser thông thường vẫn có landing tại `/`.

Service worker production cache giao diện và asset build có phiên bản, navigation dùng network-first và fallback app shell khi offline. Không cache API, request có Authorization, thao tác ghi hoặc QR. Không đưa check-in vào hàng chờ offline. Bản cập nhật chỉ kích hoạt khi người dùng bấm, tránh ngắt form/camera. UI có cài đặt Android khi browser cho phép, hướng dẫn iOS Thêm vào màn hình chính, trạng thái mất mạng và cập nhật.

## Mobile UX

Ở chiều rộng tối đa 767px dùng thanh đáy gồm ba tác vụ chính và Thêm. Member: Tổng quan/Lịch học/Quét QR; Staff: Lễ tân/Lớp học/Check-in; Coach: Lịch dạy/Điểm danh/Giáo án; Manager: Lễ tân/Báo cáo/Tài khoản. Thêm mở menu đầy đủ theo role, hồ sơ, cài PWA và đăng xuất. Desktop tiếp tục rail icon.

Tôn trọng safe-area trên/dưới, vùng chạm tối thiểu 44px, input mobile 16px, dialog native có giới hạn chiều cao và cuộn. Chừa chỗ thanh đáy cho nội dung, chatbot và nút nổi. Bảng cuộn riêng, không tràn document. Giữ thứ tự card, typography desktop, loading/empty/error/forbidden và reduced motion.

## QR cổng và bảo mật

`GET /api/v1/check-in/gate-qr?gate=A1` chỉ staff/manager/admin, cổng thuộc allowlist. Trả mã cổng ký HMAC, thời điểm hết hạn trong 60 giây và tên cổng. Dùng secret máy chủ có sẵn, phân tách domain chữ ký với QR hội viên. `Cache-Control: no-store`. Panel làm mới trước hết hạn và ẩn mã khi đã hết hạn; đổi cổng không hiển thị mã cũ.

`POST /api/v1/check-in/self` chỉ Member, body `{gateQr}`. Lấy Member từ principal, xác minh chữ ký/định dạng/TTL/thời điểm tương lai và ID cổng; không nhận memberId, subscriptionId hoặc tên cổng tự do từ client. Chọn subscription của chính Member đang active, đã bắt đầu và chưa hết hạn. Tái sử dụng khóa Member, kiểm tra tài khoản active/chưa xóa, anti-passback, ghi nhận kết quả và trigger hiện có. Không nới quyền endpoint staff `/scan`, không thay Entity/schema.

Member có trang `/member/check-in`. Camera chỉ mở sau thao tác người dùng, ưu tiên camera sau, playsInline/muted cho iOS; giải mã có fallback JavaScript vì BarcodeDetector chưa hỗ trợ đồng đều. Chặn callback trùng, dừng camera khi đọc thành công, ẩn app hoặc rời trang. Có hướng dẫn HTTPS, quyền camera, không có camera, offline, retry và kết quả granted/denied từ server. QR cổng ngắn hạn không chứng minh vị trí vật lý và không điều khiển barrier phần cứng.

## Kiểm chứng

Unit tests: PWA lifecycle/cache exclusion; role navigation; chữ ký QR giả/hết hạn/tương lai/sai loại; principal binding và role; subscription invalid/deleted; anti-passback; camera cleanup/duplicate/permission; panel hết hạn.

Chạy frontend test/lint/build, Maven tests và database policy script. Browser production preview: manifest/SW, bốn role tại `/portal`, offline shell và API không nằm trong cache; mobile 375/390/430px, landscape, desktop 768/1440/1920/2560px; theme, menu, dialog/focus, không tràn ngang. Kiểm tra cài đặt và camera bằng thiết bị Android/iOS thật phải được phân biệt với browser mô phỏng. Không tuyên bố đã kiểm chứng phần cứng khi chưa có thiết bị.

## Nguồn nền tảng

- https://webkit.org/blog/13878/ — Home Screen web app và manifest.
- https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API — giới hạn hỗ trợ decoder native.
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia — camera yêu cầu secure context.

