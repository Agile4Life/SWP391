# Kế hoạch: giao diện tối “Volt LED” cho landing và portal

Ngày lập: 12/11/2026 · Người yêu cầu: chủ dự án · Người thực hiện: coding agent khác (tài liệu này tự đủ để bắt đầu).

## 1. Mục tiêu

Làm giao diện **tối** ấn tượng hơn bằng cách thay màu nhấn salmon `#ce9180` (chỉ ở Dark) bằng một màu phát sáng tốt với hiệu ứng LED/glow, áp dụng đồng bộ cho **landing/auth** và **portal** (kể cả shop, chat, Tham quan 3D).

Xong nghĩa là:

- Ở Dark, không còn điểm nhấn salmon nào trên landing, auth và portal (trừ các ngoại lệ ở mục 4).
- Ở Light, **không có pixel nào thay đổi** so với trước.
- LED/glow rõ nét hơn nhưng vẫn có chủ đích: điều hướng đang chọn, hành động chính, thẻ nổi bật.
- `npm run lint`, `npx tsc -b`, `npm test` (trong `apps/web`) đều qua; `DESIGN.md` được cập nhật.

## 2. Quyết định màu: Volt

Chọn **Volt** (vàng chanh điện) thay salmon ở Dark. Lý do:

- **Phát sáng tốt nhất trên nền than**: salmon có độ bão hòa thấp nên glow bị đục; Volt bão hòa cao, sáng, đúng chất LED phòng tập.
- **Không trùng màu trạng thái**: cam/đỏ sẽ lẫn với nút nguy hiểm, vàng hổ phách lẫn với cảnh báo và sao đánh giá, xanh dương lẫn với thông tin. Volt nằm tách khỏi cả bốn.
- **Tương phản cao**: đã tính theo WCAG, xem bảng dưới.

| Token mới | Giá trị Dark | Tương phản trên `#202020` / `#292929` / `#303030` | Dùng cho |
| --- | --- | --- | --- |
| `--sol-accent` | `#c8fa3c` | 13,3 / 11,9 / 10,8 | Nền nút chính, mục đang chọn, viền nhấn |
| `--sol-accent-hover` | `#dcff7a` | 14,5 / 12,9 / 11,7 | Hover của nền nhấn |
| `--sol-accent-text` | `#d6f871` | 13,6 / 12,1 / 11,0 | Chữ/link nhấn trên nền than |
| `--sol-accent-deep` | `#9fd41a` | 9,2 / 8,3 / 7,5 | Đầu tối của gradient, trạng thái nhấn giữ |
| `--sol-on-accent` | `#202020` | 13,3 (chữ than trên Volt) | Chữ/icon trên nền nhấn |
| `--sol-accent-rgb` | `200 250 60` | — | Tạo alpha: `rgb(var(--sol-accent-rgb) / .4)` |

Light giữ nguyên toàn bộ: nền nhấn `#ce9180`, hover `#e1aa98`, chữ nhấn `#a35b49`, chữ trên nền nhấn như hiện tại.

Điểm cần agent kiểm tra bằng mắt: màu thành công ở Dark là `#86efac` (xanh bạc hà). Nếu badge “thành công” đứng cạnh điểm nhấn Volt mà khó phân biệt, đổi `--portal-success` (chỉ Dark) sang `#5eead4` và ghi lại trong `DESIGN.md`. Không đổi nếu đã phân biệt rõ.

## 3. Hiện trạng cần biết

- **Dark là CSS gốc, Light là lớp ghi đè** (`:root[data-theme='light']` trong `apps/web/src/shared/ui/theme.css`, mặc định của người dùng là Light). Vì vậy sửa thẳng hex ở CSS gốc sẽ rò sang Light ở mọi chỗ Light không ghi đè.
- Token hiện có:
  - Landing: `--fit-salmon` tại `.fit-site` (`features/landing/fitness-public.css:15`), `--fit-led-edge`, `--fit-led-glow` (dòng ~955).
  - Portal: `--portal-salmon`, `--portal-hover`, `--portal-tint`, `--portal-on-accent` tại `.portal-backdrop` (`features/portal/portal-shell.css:~280`); `--portal-led-edge`, `--portal-led-glow`, `--portal-accent-text` (`~2339`).
  - 3D: `--explore-accent*` (`features/explore3d/explore3d.css:47-50`) và palette JS `accentSalmon` trong `features/explore3d/renderers/materials.ts:58` (Dark) / `:108` (Light).
  - Glow chạy quanh nút: `shared/ui/button-glow.css`, lấy màu từ `--portal-salmon` hoặc `--fit-salmon`.
- **Hex salmon viết cứng** (`ce9180`, `e1aa98`, `e8b5a4`, `rgb(206,145,128)`) còn ở khoảng 48 file. Nhiều nhất: `fitness-public.css` (43), `datepicker.css` (24), `portal-shell.css` (16), `theme.css` (15), `explore3d.css` (15), `timepicker.css` (12), `chat-widget.css` (12), `chat.css` (9), `liquid-glass.css` (7), `shop-public.css` (5), cùng một số TSX (`CoachClassesPage`, `ManagerInternalRequestsPage`, `FitnessLanding`, `MemberCardPage`…) và file 3D. Lấy danh sách đầy đủ bằng lệnh ở mục 7.
- Ảnh cơ bắp phát sáng ở hero (`.fit-muscle-lit-image`, `fitness-public.css:113`) dùng `sepia + hue-rotate(-10deg)` chỉnh riêng cho tông salmon.
- Test ràng buộc màu: `features/explore3d/__tests__/architecture.test.ts:270` (`dark.accentSalmon === '#ce9180'`). Script `scripts/verify-ux-consistency.cjs` và `scripts/verify-public-ui.cjs` có nhắc salmon, cần đọc trước khi chạy.

## 4. Ràng buộc và ngoại lệ

Bắt buộc theo `AGENTS.md` và `DESIGN.md`:

- Chỉ đổi **màu và ánh sáng**. Không đổi bố cục, cỡ chữ, khoảng cách, thứ tự nội dung, dashboard bốn cột, hành vi sidebar, câu chữ.
- Không thêm thư viện. Không thêm vòng lặp JavaScript cho hiệu ứng; dùng CSS.
- `prefers-reduced-motion`: LED tĩnh, không chạy vệt sáng, focus vẫn rõ.
- Không dùng `text-shadow` làm nhòe chữ; không gradient neon nhiều màu; không nhấp nháy; không glow trên mọi card.
- Chữ trên nền nhấn dùng token on-accent, không dùng `#fff`.

Giữ nguyên màu salmon/riêng, **không** đổi sang Volt:

- Favicon, icon PWA, `public/icons/*.svg` (biểu tượng thương hiệu đã duyệt).
- Thẻ hội viên xuất ảnh (`MemberCardPage.tsx`), logo Google, nhãn dinh dưỡng `NutritionFacts`.
- Toàn bộ giao diện Light.
- Màu trạng thái (nguy hiểm, cảnh báo, thông tin, sao, huy chương).

Logo tròn chữ “S” trong sidebar/landing ở Dark **đi theo màu nhấn mới** (Volt) để không lệch tông với LED xung quanh.

## 5. Các giai đoạn

Mỗi giai đoạn là một commit riêng, làm đúng thứ tự. Không gộp giai đoạn 1 với giai đoạn 2.

### Giai đoạn 0 — Ảnh chuẩn trước khi sửa

1. Chạy web (`preview_start` tên `web`) và đăng nhập tài khoản demo trong `docs/DEMO_ACCOUNTS.md`.
2. Chụp ở **cả Light và Dark**, desktop 1440px và mobile 390px, các màn: `/`, `/login`, `/register`, `/products`, một trang bộ môn (`/swimming`), `/member/dashboard`, `/member/packages`, `/member/classes`, `/member/courts`, `/member/card`, `/member/orders`, `/member/explore`, `/staff/reception`, `/coach/classes`, `/manager/reports`, cùng trạng thái mở của: chat widget, menu avatar, bảng thông báo, DatePicker, TimePicker, Select, một Modal.
3. Lưu vào `docs/qa/dark-volt-2026-11-12/before/`.

### Giai đoạn 1 — Gom về token, không đổi hình ảnh

Mục tiêu: mọi chỗ dùng màu nhấn đọc từ một bộ token; kết quả hiển thị **giống hệt** trước ở cả hai theme.

1. Khai báo bộ token `--sol-accent*` (bảng mục 2) tại `:root` trong `apps/web/src/shared/ui/theme.css`, **giá trị Dark tạm thời vẫn là salmon** (`#ce9180`, `#e1aa98`, `#e8b5a4`, deep `#b97a69`, rgb `206 145 128`). Khai báo giá trị Light trong `:root[data-theme='light']` đúng bằng màu Light hiện tại.
2. Trỏ token cũ về token mới: `--fit-salmon`, `--portal-salmon`, `--portal-hover`, `--portal-tint`, `--portal-accent-text`, `--portal-on-accent`, `--explore-accent*`. Giữ tên token cũ để không phải sửa hàng trăm chỗ dùng.
3. Thay hex viết cứng bằng token, theo từng file trong danh sách mục 3. Quy tắc quy đổi:
   - `#ce9180` → `var(--sol-accent)`; `#e1aa98` → `var(--sol-accent-hover)`; `#e8b5a4` → `var(--sol-accent-text)`.
   - Hex có alpha (`#ce918066`…) và `rgba(206,145,128,a)` → `rgb(var(--sol-accent-rgb) / a)` với `a` quy đổi đúng (ví dụ `66` = `.4`, `1f` = `.12`, `80` = `.5`).
   - Trong TSX: dùng `var(--sol-accent)` trong `style`, hoặc chuyển sang class.
4. Với mỗi quy tắc Light đang viết cứng `#ce9180` trong `theme.css`: giữ nguyên giá trị (có thể đổi sang token Light), không để nó nhận giá trị Dark.
5. Không đụng các file ngoại lệ ở mục 4.

Nghiệm thu: lệnh grep ở mục 7 chỉ còn trả về file ngoại lệ, khai báo token và palette 3D; ảnh chụp lại trùng với ảnh `before/` ở cả hai theme; lint, typecheck, test qua.

### Giai đoạn 2 — Đổi màu nhấn Dark sang Volt

1. Đổi giá trị Dark của bộ `--sol-accent*` sang bảng mục 2. Light không đổi.
2. Rà từng màn trong danh sách giai đoạn 0 ở Dark và sửa các chỗ màu mới làm lộ vấn đề:
   - Chữ trắng/kem đặt trên nền nhấn (phải thành `--sol-on-accent`).
   - Nền tint ấm viết cứng đi kèm salmon (ví dụ `#221c1ad9`, `#f8eae4` chỉ thuộc Light thì giữ) → ở Dark đổi sang tint trung tính hoặc `rgb(var(--sol-accent-rgb) / .08)`.
   - Vùng nền nhấn diện tích lớn bị chói: giảm bằng cách dùng viền + tint thay cho nền đặc. Nền Volt đặc chỉ dành cho nút chính, mục điều hướng đang chọn, ngày đang chọn trong lịch, badge đếm.
3. Hero landing: chỉnh lại bộ lọc `.fit-muscle-lit-image` cho vùng cơ phát sáng theo Volt (bắt đầu thử `hue-rotate(40deg)` và tăng `saturate`, chỉnh bằng mắt), cùng `stopColor` gradient trong `FitnessLanding.tsx:696` và các ring/pointer SVG.
4. Scrollbar thumb (đã ẩn) và `::selection` nếu có: đồng bộ token.

Nghiệm thu: Dark không còn salmon ngoài ngoại lệ; Light trùng ảnh `before/`; không có chữ nào dưới 4,5:1.

### Giai đoạn 3 — Nâng LED và glow ở Dark

Chỉ áp dụng trong `:root:not([data-theme='light'])`. Thêm token:

```css
--sol-led-edge:  rgb(var(--sol-accent-rgb) / .6);
--sol-led-glow:  rgb(var(--sol-accent-rgb) / .22);
--sol-led-bloom: 0 0 0 1px rgb(var(--sol-accent-rgb) / .35), 0 0 18px rgb(var(--sol-accent-rgb) / .28), 0 0 48px -8px rgb(var(--sol-accent-rgb) / .22);
```

Trỏ `--fit-led-*` và `--portal-led-*` về các token này, rồi áp dụng:

| Vị trí | Hiệu ứng |
| --- | --- |
| Nút chính (portal, auth, CTA landing) | Viền sáng trong 1px + bloom ngoài; hover tăng bloom; giữ vệt sáng chạy 7,2 giây của `button-glow.css`, đổi tông sang Volt |
| Mục sidebar đang chọn, tab đang chọn, mục đang chọn ở thanh mobile | Nền Volt + bloom ngắn; tab dùng vạch LED 2px ở đáy |
| Sidebar khi mở rộng | Một nét LED 1px dọc mép phải, mờ dần hai đầu |
| Thẻ nổi bật (`.portal-card--feature`, `.fit-plan-featured`, thẻ hội viên trên dashboard) | Viền LED + ánh hắt sát mép; các card thường vẫn phẳng |
| Ô nhập đang focus, Select/DatePicker/TimePicker đang mở | Viền Volt + vòng glow 3px alpha thấp |
| Landing: gạch chân menu, thanh tiến độ cuộn, vòng mũi tên tròn, số thứ tự bộ môn | Nét LED mảnh có bloom |
| Hero landing | Một quầng sáng Volt lớn, rất mờ, sau vận động viên (radial-gradient tĩnh, không animation) |
| Chat widget, hotspot và HUD của Tham quan 3D | Đồng bộ màu viền/nhấn, không thêm glow mới |

Giới hạn: tối đa ba lớp `box-shadow` mỗi phần tử; không animation mới lặp vô hạn ngoài vệt sáng nút đã có; không `filter: blur` trên vùng lớn; kiểm tra không tụt khung hình khi cuộn landing.

### Giai đoạn 4 — Tham quan 3D

1. Trong `renderers/materials.ts`, đổi palette **Dark** `accentSalmon` → `#c8fa3c`, `accentSalmonHover` → `#dcff7a`; Light giữ nguyên. Có thể giữ tên khóa `accentSalmon` để giảm diff.
2. Rà các hex salmon viết cứng trong `explore3d/` (`liveActorsConfig.ts`, `FloorPlan2D.tsx`, `solCenter.scene.ts`, `Courts.tsx`, `Hotspots.tsx`, `Pool.tsx`…): chỗ nào là **màu nhấn giao diện** (hotspot, highlight chọn, HUD) thì theo palette theme; chỗ nào là **màu vật liệu của cảnh** (sàn sân, đồ vật) thì giữ.
3. Cập nhật `architecture.test.ts:270` theo giá trị Dark mới.

### Giai đoạn 5 — Kiểm chứng và tài liệu

1. Chụp lại toàn bộ danh sách giai đoạn 0 vào `docs/qa/dark-volt-2026-11-12/after/`, viết `README.md` trong thư mục đó: bảng màu, tỷ lệ tương phản đo trên trình duyệt, ảnh trước/sau, các chỗ đã cố ý giữ salmon.
2. Kiểm tra: reduced motion, focus bàn phím trên nút/tab/sidebar, chuyển Light ↔ Dark nhiều lần không sót màu, mobile 390px.
3. Chạy `npm run lint`, `npx tsc -b`, `npm test` trong `apps/web`; chạy `scripts/verify-public-ui.cjs` và `scripts/verify-ux-consistency.cjs` sau khi cập nhật các giá trị màu chúng kiểm tra.
4. Cập nhật `DESIGN.md` (thêm mục mới ở đầu, ghi rõ ghi đè “neon chỉ dùng màu salmon” ngày 05/11/2026): bảng token, phạm vi LED, ngoại lệ giữ salmon, quy tắc “màu mới phải đi qua `--sol-accent*`, không viết hex”. Sửa dòng trong `AGENTS.md` mô tả “charcoal–salmon” thành “Light: charcoal–salmon; Dark: charcoal–Volt”.

### Giai đoạn 6 (tùy chọn, hỏi chủ dự án trước) — Hiệu ứng khi đổi theme

Chủ dự án từng nêu ý muốn có animation khi đổi sáng ↔ tối. Nếu được đồng ý: trong `ThemeProvider.toggle` (`shared/ui/ThemeToggle.tsx`) bọc việc đổi theme bằng `document.startViewTransition`, cho theme mới lan ra theo hình tròn (`clip-path: circle()`) từ tâm nút bấm trong khoảng 450ms. Trình duyệt không hỗ trợ hoặc reduced motion thì đổi tức thì như hiện tại. Lưu ý `styles.css` đã có quy tắc `::view-transition-old/new(root)` cho chuyển trang, cần tách tên để không xung đột.

## 6. Rủi ro

- **Rò màu sang Light**: rủi ro lớn nhất, do Light kế thừa CSS gốc. Giai đoạn 1 tách riêng và so ảnh chính là để chặn việc này.
- **Volt chói trên diện tích lớn**: xử lý bằng quy tắc “nền đặc chỉ cho phần tử nhỏ” ở giai đoạn 2.
- **Ảnh landing tông ấm**: ảnh studio/HLV có ánh ấm; nếu Volt lệch tông rõ ở một khối ảnh, giảm điểm nhấn tại khối đó thay vì chỉnh ảnh.
- **Liquid Glass của chat** chụp lại trang bằng html2canvas và tự đổi `color()/oklch` sang rgba: sau khi dùng `rgb(var(...) / a)` cần mở chat ở cả hai theme để chắc bản chụp không lỗi màu.
- **Working tree dùng chung**: repo này thường có phiên khác sửa song song. Chỉ stage đúng file của mình, không dùng `git add -A`.

## 7. Lệnh hữu ích

Liệt kê chỗ còn viết cứng màu salmon (chạy trong `apps/web`):

```bash
grep -rIn -i -E "ce9180|e1aa98|e8b5a4|206, ?145, ?128|206 145 128" src public index.html
```

Kiểm tra tự động:

```bash
npm run lint && npx tsc -b && npm test
```

## 8. Ngoài phạm vi

Không đổi giao diện Light, bố cục, nội dung, backend, email, biểu tượng thương hiệu, hay màu trạng thái (trừ điều chỉnh `--portal-success` có điều kiện ở mục 2).
