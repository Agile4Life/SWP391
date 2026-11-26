# QA giao diện lịch sử Receptionist

## Phạm vi

- `/staff/reception-history`: hai tab sử dụng `PortalSectionTabs` giống KYC. `?tab=membership` mặc định; `?tab=wallet` mở nạp ví. Query thiếu/sai hiển thị gói tập; query khác giữ nguyên. Back/Forward hoạt động.
- Cả hai bảng giữ mounted, chỉ ẩn panel không chọn: không tải lại dữ liệu hoặc mất state bộ lọc khi chuyển tab. API và hàm search/sort/filter/refresh không đổi.
- Mục sidebar Lịch sử chỉ dành cho STAFF, icon history, tooltip/active đúng; menu mobile truy cập được. Bỏ tab lịch sử trùng trong Quầy lễ tân, giữ route và link cũ.
- Chỉ sửa UI/frontend và tài liệu thiết kế; không sửa Java, schema, quyền truy cập hoặc dữ liệu giao dịch.

## Kết quả

| Viewport | Light | Dark | Bố cục |
|---|---|---|---|
| 1440px | PASS | PASS | Một hàng bộ lọc, sidebar thu gọn/mở rộng |
| 1366px | PASS | PASS | Một hàng bộ lọc, sidebar thu gọn/mở rộng |
| 1280px | PASS | PASS | Một hàng bộ lọc, sidebar thu gọn/mở rộng |
| 768px | PASS | PASS | Grid xuống hàng, bảng cuộn trong card |
| 390px | PASS | PASS | Bộ lọc xếp dọc, menu mobile, bảng cuộn trong card |

- Không horizontal overflow toàn trang, nhãn dropdown không bị cắt. Kiểm tra hai tab, deep link hợp lệ/không hợp lệ, Back/Forward, giữ từ khóa và không thêm lượt tải API khi đổi tab.
- Thao tác thật trên dropdown sort, trạng thái, loại, thời gian và refresh cho cả hai bảng được kiểm tra ở VI/Light/1440px. Test component hiện có kiểm tra dữ liệu, error/empty, filter và retry.
- Full frontend: 1.455 tests / 158 files PASS. Nhóm history/navigation/mobile: 56 tests PASS. Typecheck, lint, build, `git diff --check` PASS.
- Đọc ảnh trực tiếp ở desktop 1280px, mobile Light/Dark. Ảnh được sinh tại `apps/web/node_modules/.cache/reception-history-qa/`, không commit artifact build.

## Chạy lại

1. `cd apps/web` rồi `npm run dev -- --host 127.0.0.1 --port 5182 --strictPort`.
2. Từ root: `node scripts/qa/verify-reception-history-layout.cjs` (Edge headless). Có thể đặt `HISTORY_QA_URL` để đổi localhost port.
3. Script dùng fixture API và session chỉ trong context trình duyệt QA. Không chuyển request đến backend thật, không ghi giao dịch vào localStorage, không thay cơ chế dữ liệu của ứng dụng.

Chưa UAT với dữ liệu backend thật; không xác nhận kết quả giao dịch thực tế từ fixture. Cần kiểm tra lại trên môi trường dev/test của nhóm sau khi tích hợp. Không push, merge hoặc deploy trong task này.
