# Dark accent: bạc (silver) thay salmon — 12/11/2026

Kế hoạch gốc: [docs/plans/2026-11-12-dark-volt-led-theme.md](../../plans/2026-11-12-dark-volt-led-theme.md). Kế hoạch chọn **Volt** (`#c8fa3c`); khi xem thử, người dùng thấy Volt quá chói và chọn **bạc** cho Dark. Toàn bộ cơ chế (token, ghi đè riêng Dark, LED) giữ nguyên, chỉ đổi giá trị token. Tên thư mục và `dark-volt.css` giữ từ lần thử đầu.

## Bảng màu

| Token | Dark (mới) | Dark (trước) | Light (không đổi) |
| --- | --- | --- | --- |
| `--sol-accent` | `#c8cdd6` | `#ce9180` | `#ce9180` |
| `--sol-accent-hover` | `#e6e9ef` | `#e1aa98` | `#e1aa98` |
| `--sol-accent-text` | `#e2e6ec` | `#e8b5a4` | `#a35b49` |
| `--sol-accent-deep` | `#9aa1ad` | `#b97a69` | `#b97a69` |
| `--sol-on-accent` | `#202020` | `#202020` | `#ffffff` |
| `--sol-accent-rgb` | `200 205 214` | `206 145 128` | `206 145 128` |

LED (chỉ Dark): `--sol-led-edge` (alpha .6), `--sol-led-glow` (alpha .22), `--sol-led-bloom` (viền 1px + hai lớp bloom).

## Tương phản đo trên trình duyệt (Dark, 1440px, `getComputedStyle` + nền hiệu dụng, WCAG)

| Thành phần | Chữ | Nền | Tỉ lệ |
| --- | --- | --- | --- |
| Nút chính `.btn-primary` | `#202020` | `#c8cdd6` | 10,2 |
| Mục sidebar đang chọn | `#202020` | `#c8cdd6` | 10,2 |
| Logo “S” | `#292929` | `#c8cdd6` | 9,1 |
| Link nhấn `.member-text-link` | `#e2e6ec` | `#292929` | 11,6 |
| Tab đang chọn | `#e2e6ec` | `#343536` | 9,8 |
| Tab không chọn (tham chiếu) | `#cbc7c3` | `#202020` | 9,7 |
| Kicker landing | `#c8cdd6` | `#292929` | 9,1 |
| Số thứ tự bộ môn | `#c8cdd6` | `#202020` | 10,2 |
| Nút đăng nhập | chữ than | `#c8cdd6` | 9,9 |
| Link trong form đăng nhập | `#c8cdd6` | `#2b2b2b` | 8,9 |
| Badge thành công (đứng cạnh điểm nhấn) | `#86efac` | `#283f30` | 8,1 |

Tất cả ≥ 4,5. Màu thành công `#86efac` vẫn phân biệt rõ với bạc (xanh lá so với xám lạnh) nên **không đổi** `--portal-success`.

## Ảnh trước / sau

`before/` (mã gốc) và `after/` (nhánh này): `light|dark` × `d1440|m390` × màn hình, tên dạng `dark-d1440-member-dashboard.png`. Trang landing 1440px được cắt thành `-p1/-p2/-p3`. Trạng thái mở: `state-chat`, `state-avatar-menu`, `state-notifications`, `state-datepicker`, `state-timepicker`, `state-select`, `state-modal`, `state-nav-hover`, `state-tabs`, `state-focus` (bàn phím), `state-explore2d`. `capture.mjs` chụp lại (cần web ở :5173, API ở :8080 có dữ liệu demo; `reducedMotion` bật để ảnh ổn định).

Cặp tiêu biểu: `dark-d1440-landing-p1`, `dark-d1440-member-dashboard`, `dark-d1440-member-classes`, `dark-d1440-state-chat`, `dark-d1440-state-nav-hover`, `dark-m390-member-dashboard`, `dark-d1440-state-explore2d`.

## Light không đổi

Ảnh chụp không so được pixel-bằng-pixel: QR động, kính WebGL của chat và cảnh 3D thay đổi mỗi lần chụp (hai lần chụp liên tiếp cùng mã đã khác nhau ở ~80 ảnh). Vì vậy kiểm chứng bằng **computed style**: với từng trang, mọi phần tử trong `body` được so `color`, `background-color`, `background-image`, các `border-*-color`, `box-shadow`, `outline-color`, `fill`, `stroke`, `filter`… giữa mã gốc (worktree tại commit baseline) và nhánh này, ở cả Light và Dark.

- Giai đoạn 1 (chỉ đổi hex → token): 93/98 trang khớp hoàn toàn ở cả hai theme; 5 trang còn lại chỉ khác số phần tử do tải dữ liệu/chat không đều, không có khác biệt màu ở các phần tử so được.
- Cuối nhánh, Light: 38/49 trang khớp. 11 trang lệch đều không do màu: (a) `badge-primary` đổi cách ghi `rgba(235,114,91,.2)` thành `color-mix` cùng giá trị (chuỗi khác, giá trị bằng nhau); (b) khác DOM do commit khác trên cùng nhánh (lưới lịch bỏ vạch nhấn, chat ghim SÖL AI) và trạng thái chat/kính tải không đều.

## Đã cố ý giữ salmon / màu riêng

- Favicon, icon PWA, `public/icons/*.svg`.
- Thẻ hội viên xuất ảnh (`MemberCardPage.tsx`) và viền thẻ hiển thị trên `/member/card`.
- Logo Google, nhãn dinh dưỡng `NutritionFacts`.
- Màu trạng thái: nguy hiểm, cảnh báo/hổ phách, thông tin, thành công, sao, huy chương, trạng thái thiết bị 3D, huy hiệu cam ở đơn quầy.
- Minh họa landing (icon người tập với màu da, tạ) và avatar mặc định của chat.
- Tham quan 3D: màu vật liệu cảnh (viền sàn, tường nhấn, trang phục diễn viên, vạch sân, hồ bơi, đèn). Phần giao diện (highlight chọn, hotspot, HUD, sơ đồ 2D, tour) đã theo bạc.
- Toàn bộ Light.

## Kiểm tra khác

- Reduced motion: ảnh chụp ở chế độ `reduce`; vệt sáng chạy của `button-glow.css` chỉ nằm trong `prefers-reduced-motion: no-preference`, LED còn lại là tĩnh.
- Focus bàn phím: `state-focus` cho thấy viền sáng ở mục sidebar; mọi quy tắc focus-visible cũ giữ nguyên.
- Mobile 390px: đủ bộ ảnh `m390-*`.
- `npm run lint`, `npx tsc -b`, `npm test` trong `apps/web`: qua (161 file, 1213 test). `scripts/verify-public-ui.cjs` qua phần landing (kể cả màu thanh cuộn); `scripts/verify-ux-consistency.cjs` qua toàn bộ kiểm tra bố cục và màu nút của 13 route, rồi dừng ở bước “thiếu API fixture” (do endpoint mới của phiên khác); `scripts/verify-shop-ui.cjs` dừng ở form địa chỉ vì script vẫn dùng `<select>` native, không liên quan đến màu. Hai script đầu cần `PUBLIC_UI_URL=http://localhost:5173`.
