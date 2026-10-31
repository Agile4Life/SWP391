# Bộ môn theo cuộn — 26/10/2026

Thay stack tại `#multisport` theo mục “Cách hoạt động” của [trang tham chiếu](https://sports-center-management.vercel.app/#features), tương ứng hai ảnh người dùng cung cấp (bước 01 và bước 05). Giữ nội dung bốn bộ môn, CTA, font Plus Jakarta Sans và theme SÖL sáng/tối.

- Desktop: nội dung bên trái, ảnh sticky bên phải; tỷ lệ cột 1:1.15, khoảng cách 72px, rail dọc và bốn vạch chỉ báo.
- Chọn bước tại dải 45–55% chiều cao viewport, dùng pixel cho root margin để hoạt động cả trên màn hình rộng.
- Ảnh thoát trong 500ms (opacity 0, y −30px, scale .98, blur 6px), rồi ảnh mới vào trong 500ms (opacity 0→1, y 40→0px, scale .96→1, blur 8→0px). Rail chuyển trong 600ms. Cuộn nhanh cập nhật đích đến mà không kéo dài cảnh thoát.
- Từ 1024px trở xuống và reduced motion: ảnh nằm dưới nội dung từng bộ môn, không sticky hoặc thu nhỏ chữ. Không có IntersectionObserver vẫn hiển thị toàn bộ ảnh/nội dung. Không chặn wheel, touch hoặc keyboard.
- Ảnh desktop được tải trước để ảnh ẩn có sẵn khi chuyển cảnh; ảnh inline dùng lazy loading.

## Bằng chứng tham chiếu

REA đã chạy Chrome với trang tham chiếu và thu DOM/ảnh. Evidence `ev_f7b966b6c5519bb87d6d003dcb3e24dbdc08a43b92adc07801c5005afdd83533` ghi nhận hình đầu vào từ `translateY(40px) scale(.96)`, opacity 0 và blur 8px đến trạng thái hoàn tất. CSS và JavaScript đã xuất bản của mục `lp-feat-*` xác nhận layout, breakpoint, thời lượng và thứ tự exit-before-enter. REA sử dụng browser tạm và đã đóng browser do công cụ sở hữu; không mở binary session.

## Kiểm chứng

Chạy với Vite tại `http://127.0.0.1:5173`, `NODE_PATH` trỏ đến Playwright đã cài và `CHROME_PATH` trỏ đến Chrome. Các lời gọi API kiểm chứng dùng fixture, không ghi dữ liệu thật.

- `npm --prefix apps/web run build`
- `npm --prefix apps/web run lint`
- `npm --prefix apps/web run test -- src/features/landing` — 9 tests, gồm cuộn nhanh tại 450ms rồi chuyển ngay tại 500ms, cuộn ngược, focus và live reduced motion.
- `node scripts/verify-sport-story.cjs` — 375×667, 390×844, 844×390, 768×650, 1024×600, 1280×600, 1440×900, 1920×900, 2560×1000; cả hai theme. Kiểm tra ảnh sticky, nhả sticky, thứ tự chuyển cảnh thực tế, nội dung/CTA, overflow, native wheel và fallback.
- `node scripts/verify-public-ui.cjs` và `node scripts/verify-public-animation.cjs` — regression cho public layout, điều hướng, form và reveal.
- `node scripts/benchmark-sport-stack.cjs` — tên lệnh được giữ tương thích, đo story mới; kết quả tại [performance.json](performance.json). Khoảng 59–60 rAF/giây trên Chrome headless trong lần đo, không có long task; không suy ra FPS trên thiết bị khác.

Ảnh đối chiếu: [desktop sáng](light-1440x900.png), [desktop tối](dark-1440x900.png), [mobile sáng](light-390x844.png), [mobile tối](dark-390x844.png), [màn hình rộng](light-2560x1000.png).

`SportStack.tsx` và `sport-stack.css` giữ tên file để không đổi import hiện tại; nội dung triển khai đã chuyển hoàn toàn sang story. Lệnh `verify-sport-stack.cjs` chuyển tiếp đến kiểm chứng mới. Quyết định thiết kế được cập nhật trong `DESIGN.md`.

## Điều chỉnh sau đối chiếu

- Rút gọn mỗi môn thành một câu giới thiệu, ba ý tập luyện và CTA; tiêu đề “Các bộ môn”. Ảnh `copy-*` ghi nhận bước chỉnh câu chữ.
- Đo computed styles trực tiếp trên trang gốc tại 390/1440/1920px; dữ liệu trước/sau tại `typography-before.json` và `typography-after.json`. Tám vai trò chữ đã khớp cỡ, độ đậm, line-height và tracking; giữ Plus Jakarta Sans. Ảnh `type-*` ghi nhận bước chỉnh typography.
- Sửa khung `.fit-word` dùng padding .18em/.16em và margin âm tương ứng để không cắt dấu. Kiểm tra glyph bounds tại 390/813/1440/1920px với animation bật và reduced motion, giữ nguyên cỡ chữ. [Ảnh toàn vùng sau sửa](heading-fixed-viewport.png); ảnh crop riêng H2 không bao gồm phần dấu nằm ngoài line box.
- Các ảnh `light-*`/`dark-*` ở trên thuộc lần kiểm chứng bố cục trước hai điều chỉnh câu chữ và typography này.
