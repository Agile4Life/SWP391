# Portal PWA Implementation Plan

> **For agentic workers:** Use subagent-driven-development. Người dùng yêu cầu ba sub-agent; root tích hợp và kiểm chứng chung.

**Goal:** Portal cài được trên Android/iOS, đi thẳng đúng role, có camera quét QR cổng và UI mobile dùng thuận tiện.

**Architecture:** Tái sử dụng portal/auth/check-in hiện có. Tách PWA, QR/check-in và mobile shell để ba agent sửa các tập file riêng; root nối route, cập nhật DESIGN và chạy kiểm chứng tổng hợp.

**Tech Stack:** React/TypeScript/Vite, Java 21/Spring Boot 3, Supabase PostgreSQL, qrcode hiện có và decoder camera tương thích iOS.

**Spec:** [Thiết kế](../specs/2026-10-29-portal-pwa-design.md).

## Global Constraints

- Giữ desktop rail icon, dashboard và charcoal–salmon/light-dark.
- API check-in không được cache hoặc queue offline; chỉ báo thành công từ server.
- Backend kiểm tra role, principal, subscription active và ngày hiệu lực; giữ trigger và anti-passback.
- Không thay schema/DDL; message mới cập nhật cả ba bộ i18n và OpenAPI cùng code.

## Review Focus

1. iOS không có BarcodeDetector: decoder JS vẫn quét được.
2. Camera permission trả về sau unmount: stream phải được dừng.
3. QR cổng hết hạn/API lỗi/đổi cổng: mã cũ phải biến mất.
4. Offline mở portal: shell hiện được, API không giả thành công và không rò cache cá nhân.
5. Thanh đáy/bàn phím/dialog/chatbot: nội dung và nút hành động vẫn chạm được.

## Task 1 — PWA (agent pwa)

Files: `apps/web/index.html`, `src/main.tsx`, `vite.config.ts`, `vercel.json`, `public/manifest.webmanifest`, `public/icons/*`, `src/features/pwa/*`.

Interface sản xuất: `PwaStatus` component, được mobile agent mount trong PortalShell. Agent này sở hữu package.json/lock nếu PWA cần thay; decoder dependency do agent QR cài sau khi báo để tránh ghi đè.

- [ ] Viết/chạy kiểm tra lifecycle install/offline/update, worker bỏ qua API/Authorization/POST trước implementation logic.
- [ ] Tạo manifest/icon, build worker theo assets Vite; đăng ký production-only; worker versioned và update chủ động.
- [ ] Implement UI cài Android/hướng dẫn iOS/offline/update bằng token hiện hành.
- [ ] Chạy focused tests và build, báo diff cùng giới hạn kiểm chứng.

## Task 2 — QR cổng và camera (agent qr_checkin)

Files: `apps/api/src/main/java/com/swp391/scms/attendance/**` và tests; `i18n/messages*.properties`; `docs/api-contracts/openapi-pwa-checkin.yaml`; `apps/web/src/features/checkin/*`; `features/member/MemberCheckInPage.tsx`, `memberCheckinApi.ts`; `features/reception/GateQrPanel.tsx`, `StaffCheckInPage.tsx`, `checkinApi.ts` và tests. Không sửa router/portal shell.

Interface sản xuất: `MemberCheckInPage` tại `/member/check-in`; QR GET `/check-in/gate-qr`, POST `/check-in/self`; frontend `GateQrPanel` mount trong StaffCheckInPage.

- [ ] Test đỏ GateQrService: valid/tampered/expired/future/wrong-prefix/unknown-gate.
- [ ] Implement ký HMAC/TTL, DTO, service/controller và OpenAPI; message keys cả ba locale.
- [ ] Test phân quyền/principal/subscription/anti-passback, dùng chung nghiệp vụ staff/self với khóa hiện có.
- [ ] Test đỏ camera duplicate/lifecycle và panel expiry; implement scanner lazy-loaded tương thích Safari, page Member và panel staff.
- [ ] Chạy focused backend/frontend tests; báo tình trạng Maven và decoder dependency.

## Task 3 — Mobile portal UX (agent mobile_ux)

Files: `apps/web/src/features/portal/PortalShell.tsx`, `portalNavigation.ts`, `portal-shell.css`; `shared/ui/portal.css`; `shared/liquid-glass/liquid-glass.css`; tests mobile navigation. Không sửa route/API/PWA files.

Interface tiêu thụ: `PwaStatus` từ `features/pwa/PwaStatus`; route `/member/check-in` do root nối. Dùng PORTAL_NAV để lọc role và PortalIcon hiện có.

- [ ] Test đỏ role-specific bottom navigation, active/menu/logout và route QR.
- [ ] Implement bottom bar <=767px, menu đầy đủ, giảm chật topbar; giữ desktop rail.
- [ ] CSS safe area, clearance, input16px, hit area >=44px, dialog/bảng/chatbot; không đổi desktop card order.
- [ ] Chạy focused tests/lint và báo vùng CSS ảnh hưởng.

## Task 4 — Integration và verification (root)

Files: `src/app/router.tsx`, `DESIGN.md`, `scripts/verify-portal-pwa.cjs`, `docs/qa/portal-pwa-2026-10-29.md`.

- [ ] Nối MemberCheckInPage dưới Member-only guard; xác nhận bottom nav đúng role và PwaStatus mount.
- [ ] Cập nhật DESIGN theo quyết định mobile/PWA mới.
- [ ] Review logic bảo mật check-in, lifecycle camera, worker cache/update và CSS desktop.
- [ ] Chạy `npm --prefix apps/web run test`, `run lint`, `run build`; `apps/api/mvnw.cmd test`; `scripts/test-database-config.ps1`.
- [ ] Production preview và script browser mock API kiểm bốn role, kích thước mobile/desktop, manifest/SW/offline/cache exclusion, QR panel/camera states.
- [ ] Ghi báo cáo rõ automated/manual/Supabase thật; cập nhật graphify nếu công cụ hoạt động; kiểm tra Git diff chỉ đúng phạm vi. Không tự publish hoặc push.

## Execution ledger

- Khảo sát cả ba phần hoàn tất; baseline working tree sạch trên main.
- Thiết kế và cách chia ba agent được người dùng chấp thuận trong chat.
- Root chịu trách nhiệm review chéo và tích hợp, tránh các agent ghi chung shell/router/package.
