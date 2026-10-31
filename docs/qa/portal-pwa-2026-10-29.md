# Kiểm chứng Portal PWA & Quét QR Check-in trên Mobile — 29/10/2026

Mở rộng SCRUM-75 (An), SCRUM-83 (Khoa), SCRUM-87 (Thịnh): triển khai Portal PWA cho Android/iOS đi thẳng `/portal` theo từng vai trò, thanh điều hướng mobile một tay, và luồng hội viên dùng camera điện thoại quét mã QR cổng hiển thị tại màn hình web lễ tân.

## 1. Phạm vi triển khai

- **PWA & Điểm vào Portal (`apps/web/public/manifest.webmanifest`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/vercel.json`, `apps/web/src/features/pwa/*`):**
  - `id: "/portal"`, `start_url: "/portal"`, `scope: "/"`, `display: "standalone"`, bộ icon `192x192`, `512x512`, `maskable` và `apple-touch-icon.png` đồng bộ nhận diện SÖL charcoal–salmon.
  - Service Worker chỉ kích hoạt ở bản build production, cache giao diện tĩnh có phiên bản, điều hướng dùng network-first kèm fallback `/index.html` khi ngoại tuyến.
  - Tuyệt đối không cache `/api/*`, request có `Authorization`, hoặc các thao tác ghi; không đưa check-in vào hàng chờ offline.
  - `PwaStatus` hỗ trợ nút cài đặt trên Android (`beforeinstallprompt`), hộp thoại hướng dẫn "Thêm vào MH chính" cho Safari iOS / Chrome Android, trạng thái ngoại tuyến và nút chủ động cập nhật phiên bản mới.
- **QR Cổng & Camera Check-in (`GateQrService`, `CenterCheckinController`, `CenterCheckinService`, `QrCameraScanner`, `MemberCheckInPage`, `GateQrPanel`, `docs/api-contracts/openapi-pwa-checkin.yaml`):**
  - `GET /api/v1/check-in/gate-qr?gate=A1|A2|B1`: chỉ `RECEPTIONIST`, `CENTER_MANAGER`, `ADMIN`; ký HMAC-SHA256 tách domain (`SOL:GATE:1:`), TTL 60 giây, `Cache-Control: no-store`. `GateQrPanel` tự làm mới trước khi hết hạn, ẩn ngay mã hết hạn hoặc khi đổi cổng.
  - `POST /api/v1/check-in/self`: chỉ `MEMBER`; định danh hội viên lấy trực tiếp từ `AuthenticatedPrincipal` (bỏ qua mọi `memberId` từ client), kiểm tra chữ ký/TTL mã cổng, trạng thái tài khoản (`active`, `deleted_at IS NULL`), gói tập đang hiệu lực, khóa `findByUserIdForUpdate`, anti-passback và ghi nhận lịch sử ra vào. Giữ nguyên luồng lễ tân quét thẻ hội viên (`POST /api/v1/check-in/scan`) và schema hiện hành.
  - Bổ sung đầy đủ khóa đa ngôn ngữ vào cả `messages.properties`, `messages_vi.properties` và `messages_en.properties`.
  - `QrCameraScanner` chỉ mở camera sau thao tác người dùng, ưu tiên camera sau (`environment`), `playsInline` + `muted` cho iOS, lazy-load bộ giải mã `qr-scanner` (hỗ trợ trình duyệt không có `BarcodeDetector`), tạo phần tử `<video>` độc lập cho từng lượt quét để bấm "Quét lại" liên tiếp không bị tác vụ dọn luồng cũ cắt nhầm, và tự giải phóng camera khi quét xong, ẩn ứng dụng hoặc rời trang.
- **UI/UX Mobile theo Role (`PortalShell.tsx`, `portalNavigation.ts`, `portal-shell.css`, `Modal.tsx`, `liquid-glass.css`):**
  - Từ `767px` trở xuống hiển thị thanh điều hướng đáy gồm 3 tác vụ chính theo vai trò (`MEMBER`: Tổng quan / Lịch học / Quét QR; `STAFF`: Lễ tân / Lớp học / Check-in; `COACH`: Lịch dạy / Điểm danh / Giáo án; `MANAGER`: Lễ tân / Báo cáo / Tài khoản) cùng nút `Thêm` mở toàn bộ màn hình được phép, cài đặt PWA, hồ sơ và đăng xuất.
  - Giữ nguyên sidebar icon, bố cục dashboard 4 cột và bảng màu charcoal–salmon (sáng/tối) trên desktop.
  - Đảm bảo `viewport-fit=cover`, safe-area trên/dưới, vùng chạm tối thiểu `44×44px`, cỡ chữ ô nhập liệu `16px` chống tự phóng to trên iOS (kể cả ô tìm kiếm màn hình và AI Chatbot), hộp thoại `<dialog>` lồng nhau đóng đúng tầng bằng phím `Escape` và trả lại focus.

## 2. Kết quả kiểm chứng tự động

- **Frontend Unit & Component Tests (`npm --prefix apps/web run test`):** `63` test files / `370` tests **PASS** (bao gồm lifecycle PWA, loại trừ cache `/api`, bottom nav theo 4 role, nested `Modal` Escape/focus, `GateQrPanel` hết hạn, `QrCameraScanner` quét & bấm "Quét lại" liên tiếp, `MemberCheckInPage`).
- **Frontend Lint & Production Build (`npm --prefix apps/web run lint`, `npm --prefix apps/web run build`):** ESLint `--max-warnings=0` **PASS**; TypeScript + Vite build **PASS** (sinh `dist/sw.js` và worker giải mã QR).
- **Backend Unit & WebMvc Tests (`apps/api/mvnw.cmd test`):** `678` tests run, `0` failures, `0` errors, `20` skipped — **BUILD SUCCESS** (bao gồm `GateQrServiceTest`, `CenterCheckinAccessTest`, `CenterCheckinServiceTest`, `DatabasePolicyTest`, `DatabaseProfilesTest`).
- **Chính sách cấu hình Database (`scripts/test-database-config.ps1`):** `10` cases **PASS**.
- **Kiểm chứng Trình duyệt Production Preview (`scripts/verify-portal-pwa.cjs`):** **PASS** với `0` lỗi runtime:
  - Mở `/portal` cho cả 4 role (`MEMBER`, `RECEPTIONIST`, `COACH`, `CENTER_MANAGER`) và khách chưa đăng nhập (`/login`).
  - Responsive không tràn ngang, kích thước vùng chạm `>= 44px`, input `>= 16px` tại `375px`, `390px`, `430px` (mobile) và `844px`, `1440px`, `1920px`, `2560px` (desktop, giữ nguyên lưới 4 cột), cả hai chế độ sáng/tối.
  - Màn hình lễ tân `/staff/check-in` hiển thị mã QR cổng rõ nét trên cả desktop và mobile.
  - Màn hình hội viên `/member/check-in` đọc ảnh QR thực qua luồng camera giả lập khi đã xóa `window.BarcodeDetector` (kiểm chứng fallback JS cho iOS Safari), gửi đúng 1 request `POST /api/v1/check-in/self`, tắt camera sau khi quét, và bấm **"Quét lại"** quét thành công lượt thứ 2 kèm giải phóng camera.
  - Manifest hợp lệ (`start_url: "/portal"`, `display: "standalone"`), Service Worker kích hoạt, tải lại khi offline vẫn mở được app shell kèm thông báo ngoại tuyến và Cache Storage không chứa bất kỳ URL `/api/*` nào.
  - Ảnh chụp kiểm chứng lưu tại `docs/qa/portal-pwa/`.

## 3. Giới hạn kiểm chứng & Bước kiểm tra trên thiết bị thật

- **Supabase PostgreSQL thật:** 20 bài kiểm thử tích hợp DB thật trong Maven được skip do môi trường chạy test cục bộ không gắn biến `SCMS_POSTGRES_TEST_*` (tính năng này không thay đổi JPA Entity, schema hay SQL trigger).
- **Thiết bị Android / iOS vật lý:** Kiểm chứng camera và cài đặt PWA ở trên chạy trên Chromium mô phỏng luồng `MediaStream` và Service Worker production. Trước khi vận hành thực tế tại quầy, cần kiểm tra nhanh trên điện thoại Android (Chrome) và iPhone (Safari iOS qua HTTPS):
  1. Cài đặt PWA ra màn hình chính, mở biểu tượng SÖL và xác nhận vào thẳng `/portal` (chuyển đúng màn hình theo role).
  2. Cấp quyền camera sau trên `/member/check-in` và quét trực tiếp mã QR cổng đang hiển thị trên màn hình lễ tân `/staff/check-in`.

