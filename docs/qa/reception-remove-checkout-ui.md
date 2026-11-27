# Bỏ UI Check-out Receptionist

- Branch: `refactor/thinh-remove-reception-checkout`, tạo từ `origin/main` tại `bac1a3e2b4400ecffde741d2e241333398fc5b28`.
- Thay đổi Frontend độc lập với Draft PR #232; không lấy commit Backend Auto Check-out.
- Chỉ triển khai sau khi Backend Auto Check-out 8 giờ được merge/deploy và xác minh scheduler trên VPS. Task này không push, tạo PR hoặc deploy.

## File → component/hàm → dòng

Các đường dẫn Frontend bên dưới tính từ `apps/web/`.

| File | Component/hàm và thay đổi |
|---|---|
| `src/app/router.tsx:173` | Route `/staff/check-out` giữ trong RoleGuard STAFF/RECEPTIONIST, dùng Navigate replace về `/staff/check-in` |
| `src/features/portal/portalNavigation.ts:62` | PORTAL_NAV chỉ còn hai tab Quầy lễ tân và Check-in; sidebar/mobile/search dùng chung config |
| `src/features/portal/PortalShell.tsx:651` | Bỏ ngoại lệ ChatWidget của màn đã ngừng |
| `src/features/member/notificationsApi.ts:124` | safeNotificationPath chuyển actionPath Check-out cũ về Check-in cho STAFF/RECEPTIONIST |
| `src/features/reception/StaffCheckInPage.tsx:30` | Bỏ mode out, state và handler Check-out; giữ scanner, QR Check-in và nhật ký 10 lượt gần nhất |
| `src/features/reception/GateQrPanel.tsx:12` | Bỏ purpose out và hướng dẫn/alt text Check-out; giữ nguyên tải QR, refresh, hết hạn, error/loading |
| `src/features/reception/checkinApi.ts:46` | Bỏ wrapper checkout không còn caller; giữ scan, gateQr, getHistory và CheckinDto.checkOutTime |
| `src/features/reception/StaffCheckOutPage.tsx` | Xóa file wrapper không còn sử dụng |
| `src/features/reception/staff-check-in.css:1` | Xóa CSS cột nút Ra về đã bỏ |
| `src/features/portal/portal-shell.css:251` | Xóa override CSS cột nút Ra về đã bỏ |
| `src/features/operations/staffSourceCatalog.ts:495` | Xóa các chuỗi VI/EN riêng cho UI Check-out Receptionist đã ngừng; không sửa bản dịch Member |
| `src/app/router.staffCheckout.test.tsx:5` | Test redirect có replace và giữ RoleGuard |
| `src/features/portal/PortalShell.mobile.test.tsx:67` | Test hai tab và menu đầy đủ không có Check-out |
| `src/features/portal/portalNavigation.test.ts:98` | Cập nhật tập route Receptionist |
| `src/features/member/receptionNotifications.test.tsx:30` | Click notification cũ đến Check-in và giữ mark-read |
| `src/features/reception/StaffCheckInPage.test.tsx:39` | Bỏ test thao tác đã xóa, giữ scanner/camera, API/error, VI/EN và kiểm tra không có nút Ra về |
| `src/features/reception/GateQrPanel.test.tsx:49` | QR chỉ còn hướng dẫn và alt text Check-in |
| `src/features/reception/checkinApi.test.ts:45` | Bỏ test wrapper đã xóa, giữ kiểm tra lịch sử đầy đủ |
| `e2e/specs/07-checkin.spec.ts:64` | Cập nhật riêng ca Receptionist từ thao tác Check-out sang redirect và không có nút Ra về |
| `DESIGN.md:3` | Ghi quyết định hai tab và dependency triển khai Backend #232 |

## Giữ nguyên và kiểm tra

- Test liên quan: **116 PASS / 9 files**. Full Frontend: **1541 PASS / 165 files** (`--maxWorkers=2 --testTimeout=30000`).
- Typecheck (`tsc -b`), lint (`eslint . --max-warnings=0`), Vite build và `git diff --check`: **PASS**.
- Regression test route mới đã FAIL trước thay đổi (route còn lazy-load màn Check-out) và PASS sau redirect.
- Không thay đổi `apps/api`, schema, endpoint Backend, dữ liệu ra/vào hoặc source Member Check-in.
- Giờ vào và giờ ra từ Backend vẫn hiển thị trong nhật ký. Không giả lập Auto Check-out ở Frontend.
- Đã tìm toàn source: route Check-out Receptionist chỉ còn trong redirect, mapping notification legacy và test; không còn caller checkout, mode out, component StaffCheckOutPage hoặc CSS checkin-actions.
- Test liên quan bao gồm Member Check-in, camera Receptionist, ngăn double-scan, lỗi API/network, lịch sử, VI/EN, navigation/mobile, notification click và guard route.
- Browser visual QA desktop/tablet/mobile Light/Dark và E2E/UAT Backend thật chưa chạy trong phiên này. Spec E2E được cập nhật nhưng không kết nối môi trường shared để chạy.
