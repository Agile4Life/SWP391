# Receptionist — Task E

Dropdown gia hạn tại quầy: lựa chọn không hợp lệ vẫn disabled; giải thích dùng màu chữ phụ rõ, opacity 1 và xuống dòng trong menu, không đổi rule gia hạn.

Base: main 9d1dc369. Branch độc lập, không push/merge/deploy, không đổi schema/production data.
Manual localhost: đăng nhập Receptionist; kiểm tra luồng tương ứng theo yêu cầu A–E, cả VI/EN và viewport 1366px/390px.
Kiểm tra tự động: xem bảng bàn giao cuối. Full frontend suite có lỗi nền MemberCoachBookingView.test.tsx:311 (tái hiện trên main); người dùng cho phép commit khi test liên quan PASS và ghi rõ full suite FAIL. Không sửa test nền.
Review: reviewer độc lập chỉ đọc diff; không còn Important/Critical sau sửa.

## Truy vết code

| File:dòng | Hàm/logic | Endpoint |
|---|---|---|
| `apps/web/src/features/reception/staff-reception.css:25` | `.reception-checkout .ui-select__option.is-disabled` | CSS, không đổi API/rule gia hạn |

## Manual localhost

1. Tra cứu hội viên có kỳ đã thay bằng gói mới; mở dropdown ở 1366px và 390px.
2. Giải thích đọc được và xuống dòng, không tràn; kỳ không hợp lệ vẫn disabled.
3. Chuột/bàn phím không chọn được kỳ khóa; chọn kỳ hợp lệ vẫn gia hạn theo rule cũ.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.

Visual QA component thật: Edge headless, Light/Dark tại 1366px và 390px. Mục khóa aria-disabled=true, opacity=1; label scrollWidth=clientWidth (không tràn). Fixture chỉ kiểm tra component, không thay hoặc che API. Full suite chạy lại với --testTimeout=15000: 1100 PASS, 1 FAIL nền ngày.
