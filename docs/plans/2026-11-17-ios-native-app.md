# iOS Native App (Capacitor shell) Implementation Plan

> Nhánh: `feature/ios-native-app`. Jira key: **chưa có — cần PO tạo ticket trước khi mở PR** (native mobile nằm ngoài phạm vi MVP theo `AGENTS.md` nếu ticket không nêu rõ).

**Goal:** Có app iOS chạy trên Simulator (và iPhone thật qua Xcode) hiển thị đúng portal SÖL, dùng chung dữ liệu với web trên VPS `https://scms.bluesymphony.site`.

**Architecture:** App là shell Capacitor (WKWebView) load **từ xa** domain VPS (`server.url`). Không đóng gói `dist`, không có backend/database riêng: web, API, database đều là bản đang chạy trên VPS, nên dữ liệu đồng bộ tức thời và mỗi lần VPS deploy web mới, app nhận giao diện mới khi mở lại mà không cần build lại. Web nhận biết đang chạy trong app qua User-Agent (`appendUserAgent: 'SOLiOSApp'`), không thêm `@capacitor/core` vào bundle web.

**Tech Stack:** Capacitor 8.6.x (`@capacitor/cli`, `@capacitor/core`, `@capacitor/ios` — devDependency trong `apps/web`), Swift Package Manager (máy chưa có CocoaPods), Xcode 27.2 + iOS 27.2 Simulator (iPhone 18 Pro).

## Môi trường đã kiểm tra (2026-11-17)

| Mục | Trạng thái |
|---|---|
| Xcode | 27.2 (27B52), runtime iOS 27.2, có iPhone 18 Pro / 18 Pro Max / 17e / Air |
| Node | 24.21 |
| CocoaPods | không có → dùng SPM (kiểm tra lại khi `cap add ios`; nếu CLI đòi Pods thì cài bằng Homebrew) |
| Auth web | Bearer token trong `localStorage`, không dựa cookie → không vướng giới hạn cookie WKWebView |
| Realtime | `supabase-js` với URL tuyệt đối do server cấp → chạy được trong WebView |
| VPS | Nginx phục vụ web và proxy `/api/` cùng domain, HTTPS → không cần sửa CORS, không cần ngoại lệ ATS |

## Global Constraints

- Không đổi backend, schema, OpenAPI ở Milestone 1–2. Milestone 3 (Google) mới đụng backend, khi đó cập nhật OpenAPI + i18n vi/en.
- Không đổi thiết kế: đọc `DESIGN.md` trước mọi thay đổi UI; chỉ ẩn phần không dùng được trong app (nút cài PWA, nút Google nếu chưa làm M3).
- Không thêm payment gateway thật, push notification, Android, App Store/TestFlight signing — ngoài phạm vi.
- `npm run lint`, `npm test`, `npm run build` trong `apps/web` phải xanh; thư mục `ios/` không được lọt vào lint/test/Docker image.
- Commit không kèm trailer Co-Authored-By Claude.

## Milestone 1 — Shell chạy trên Simulator (không sửa code web)

Files: `apps/web/package.json`, `package-lock.json`, `apps/web/capacitor.config.ts`, `apps/web/ios/**` (sinh tự động), `.gitignore`, `apps/web/.dockerignore`, `apps/web/eslint.config.js`.

- [x] Cài devDependency: `@capacitor/cli`, `@capacitor/core`, `@capacitor/ios` (cùng 8.6.x, ghim version).
- [x] Tạo `capacitor.config.ts`:
  ```ts
  import type { CapacitorConfig } from '@capacitor/cli';
  const config: CapacitorConfig = {
    appId: 'scms.bluesymphony.site',
    appName: 'SÖL',
    webDir: 'dist',
    appendUserAgent: 'SOLiOSApp',
    server: {
      // CAP_SERVER_URL=http://localhost:5173 để dev với Vite; mặc định VPS.
      url: process.env.CAP_SERVER_URL ?? 'https://scms.bluesymphony.site',
      allowNavigation: ['scms.bluesymphony.site', 'sandbox.vnpayment.vn'],
    },
    ios: { contentInset: 'never' },
  };
  export default config;
  ```
  `allowNavigation` giữ trang thanh toán VNPay trong app; host khác (Google…) Capacitor mở ra Safari.
- [x] `npm run build && npx cap add ios && npx cap sync ios` (cần `dist` tồn tại dù load từ xa).
- [x] Repo hygiene: (`apps/web/ios/.gitignore` do Capacitor sinh đã ignore `App/App/public`, `capacitor.config.json`, `config.xml`, `xcuserdata`, `DerivedData`, `App/Pods`, `App/build` → không thêm vào `.gitignore` gốc.)
  - `.gitignore`: `apps/web/ios/App/App/public/`, `apps/web/ios/App/App/capacitor.config.json`, `apps/web/ios/App/App/config.xml`, `apps/web/ios/**/xcuserdata/`, `apps/web/ios/DerivedData/`, `apps/web/ios/App/Pods/`.
  - `apps/web/.dockerignore`: thêm `ios/`.
  - `eslint.config.js` ignores: thêm `'ios'`.
- [x] Mở `npx cap open ios` → chọn iPhone 18 Pro → Run. Hoặc `xcodebuild` + công cụ Simulator để chụp màn hình.
- [x] Icon/splash: dùng `public/icons/icon-512.png` làm AppIcon 1024 (scale lên từ `logo.svg` nếu cần nét), splash nền charcoal theo token hiện hành.

**Done M1:** app mở trên Simulator, đăng nhập bằng tài khoản/mật khẩu, vào portal Member, đổi theme sáng/tối, đăng xuất — có ảnh chụp Simulator. Safe area: `index.html` đã có `viewport-fit=cover` và CSS đã dùng `safe-area-inset` (20 chỗ) → kiểm tra notch/thanh đáy không che nút.

**Kết quả M1 (2026-11-17):** `cap add ios` dùng SPM, không cần CocoaPods. Build headless + chạy trên iPhone 18 Pro (iOS 27.2) OK, landing/login tải từ VPS. Phát hiện header công khai (`.fit-header`) nằm dưới Dynamic Island và không bấm được → thêm `border-top: env(safe-area-inset-top)` trong `fitness-public.css` (trình duyệt thường có inset 0 nên không đổi giao diện web). Chưa kiểm đăng nhập/portal/theme/đăng xuất: chưa có tài khoản test được phép dùng trên VPS. Kiểm code mới trước khi VPS deploy: `E2E_API_URL=https://scms.bluesymphony.site npm run dev` + `CAP_SERVER_URL=http://localhost:5173 npx cap sync ios`, nhớ `npx cap sync ios` lại không biến môi trường trước khi build bản thật.

## Milestone 2 — Điều chỉnh web khi chạy trong app

Files: `apps/web/src/shared/lib/nativeApp.ts` (mới, 1 hàm), `src/main.tsx`, `src/features/portal/PortalShell.tsx`, `src/features/auth/LuxuryLoginForm.tsx`, test tương ứng, `apps/web/ios/App/App/Info.plist`.

- [x] `nativeApp.ts`: `export const isNativeApp = () => navigator.userAgent.includes('SOLiOSApp');` + 1 test.
- [x] Service worker: `main.tsx` không gọi `registerPwa()` khi `isNativeApp()` (tránh cache bản cũ trong WKWebView); test trong `registerPwa.test.ts`. Thực hiện: chặn ngay trong `registerPwa()` (guard `isNativeApp()`) thay vì `main.tsx` để test được; `main.tsx` giữ nguyên.
- [x] Ẩn `<PwaStatus mode="install" />` ở `PortalShell.tsx:735` khi trong app (hướng dẫn "Thêm vào màn hình chính" vô nghĩa); giữ `mode="status"` (báo offline vẫn có ích) nếu không phụ thuộc SW, ngược lại ẩn luôn. Thực hiện: giữ `mode="status"` (báo offline không cần SW; nhánh "bản mới" tự không xuất hiện vì không có SW).
- [x] Google: khi `isNativeApp()` và chưa xong M3, ẩn nút "Đăng nhập Google" (Google chặn OAuth trong WebView nhúng — `disallowed_useragent`). Không cần message mới.
- [x] Camera QR: thêm `NSCameraUsageDescription` (vi: "SÖL dùng camera để quét mã QR check-in tại cổng."). `getUserMedia` trong WKWebView cần HTTPS — VPS đã có. **Simulator không có camera → chỉ kiểm được trên iPhone thật.**
- [ ] Link ngoài (`target="_blank"`, `mailto:`, `tel:`): xác nhận Capacitor mở ra Safari/app hệ thống, không kẹt WebView.

**Done M2:** lint/test/build xanh; trên Simulator không còn banner cài PWA, không đăng ký SW (kiểm qua Safari Web Inspector → Develop → Simulator); luồng VNPay sandbox thanh toán và quay về `/member/payments/vnpay/return` ngay trong app.

## Milestone 3 (tuỳ chọn) — Đăng nhập Google trong app

Chỉ làm khi PO yêu cầu. Cần backend.

- [ ] Thêm `@capacitor/browser` (SFSafariViewController) và URL scheme `solapp://` trong `Info.plist`.
- [ ] Web (trong app): mở `getGoogleOAuthAuthorizeUrl()` bằng `Browser.open` thay vì `window.location.assign` (`LuxuryLoginForm.tsx:277`), kèm tham số redirect native.
- [ ] Backend `GoogleOAuthRedirectService`: cho phép redirect cuối về `solapp://login#google_login_code=...` khi request đến từ app (allowlist cứng, không nhận URL tuỳ ý); PKCE verifier vẫn nằm ở WebView nên handoff code bị chặn nếu bị app khác bắt scheme.
- [ ] App lắng nghe `appUrlOpen` → điều hướng WebView tới `/login#google_login_code=...` để `googleRedeemHandoff` chạy như web.
- [ ] Cập nhật OpenAPI `docs/api-contracts/`, i18n vi/en nếu có message mới, test `GoogleOAuthRedirectService`.

## Milestone 4 — App SwiftUI native (`apps/ios`)

Theo yêu cầu "viết lại bằng SwiftUI": app native riêng, gọi thẳng `/api/v1` (không WebView). Chi tiết và phạm vi ở `apps/ios/README.md`. Bản Capacitor ở M1–M2 giữ lại làm phương án dự phòng.

- [x] Project Xcode (iOS 17+, folder đồng bộ), API client, AuthStore (Keychain), theme, i18n vi/en.
- [x] Auth: đăng nhập, đăng ký + OTP, quên mật khẩu.
- [x] Member: tổng quan, lớp học, thẻ QR động, check-in, gói tập + thanh toán, ví, hoá đơn, tiến độ, thông báo, hồ sơ.
- [x] Staff / Coach / Manager: lễ tân, check-in quầy, điểm danh, báo cáo, duyệt huỷ gói.
- [x] Unit test (`SOLTests`) và chế độ demo Debug để kiểm giao diện.
- [ ] Kiểm với tài khoản thật trên VPS (chưa có tài khoản test) — shape JSON hiện lấy từ interface TypeScript của web.
- [x] Bổ sung: Google OAuth (backend `client=ios` + `solapp://login`), chat trực tiếp/hỗ trợ/AI, shop đặt mua, đặt sân, PT 1:1, KYC, nâng cấp gói, quản trị, Explore 3D rút gọn bằng SceneKit.
- [ ] Deploy backend mới lên VPS rồi thử Google sign-in end-to-end; thử thanh toán VNPay và camera QR trên thiết bị thật.

## Chạy trên iPhone thật

Xcode → Signing & Capabilities → Team = Apple ID cá nhân (miễn phí, app hết hạn sau 7 ngày) hoặc tài khoản Apple Developer của nhóm. Dùng để kiểm camera QR và cảm giác chạm thật.

## Review Focus

1. Đăng xuất/401 trong app: `clearAuthSession` xoá token, không còn màn hình portal cũ khi mở lại app.
2. VPS deploy bản mới: app mở lại nhận bản mới (SW đã tắt trong app) — không kẹt asset cũ.
3. Mất mạng: WebView hiện lỗi của trang, không màn trắng vĩnh viễn; cân nhắc `server.errorPath` nếu cần.
4. Bàn phím iOS che input ở form login/chat/thanh toán.
5. `ios/` không làm phình Docker image hay làm eslint/vitest chậm.

## Việc ngoài code

- [ ] PO tạo Jira ticket; ghi key vào đầu file này và mô tả PR.
- [ ] Cập nhật mục "Phạm vi MVP" trong `AGENTS.md`: iOS shell Capacitor được phép theo ticket trên.
- [ ] Thêm dòng vào `docs/plans/README.md`.

## Bỏ qua có chủ đích

Android, push notification, App Store/TestFlight, đóng gói `dist` offline, plugin native khác ngoài Browser (M3).
