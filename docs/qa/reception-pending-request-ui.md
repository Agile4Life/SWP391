# QA giao diện Cần xử lý Receptionist

## Phạm vi

- Branch xuất phát từ `origin/main` tại `7ddb2871`, không lấy commit PR #205 hoặc PR đang mở.
- Năm nhóm đã có trong `StaffReceptionPage`: gói tập, khóa học chờ học phí, PT chưa thanh toán, đơn trải nghiệm, bảo lưu. Chỉ đổi JSX/CSS, không khôi phục nghiệp vụ hoặc thêm API.
- Header loại/mã yêu cầu và hội viên; thông tin label–value hai cột; Email/SĐT thành hàng riêng khi nguồn dữ liệu hiện tại có trường tương ứng; nút ở cuối thẻ căn phải. Không bổ sung trường giả cho DTO thiếu thông tin liên hệ/mã hội viên.
- Giữ tên gói, tiền, thời hạn, trạng thái, lý do bảo lưu, số giấy tờ, quốc tịch, ngày nộp và thông tin đồng bộ tên hiện có.
- Popup trải nghiệm giữ dữ liệu, ảnh contain, phóng to, approve/reject và xác nhận/lý do; tên/mã hội viên dưới tiêu đề. Bỏ toàn bộ khung “Lưu ý nghiệp vụ”.
- Đối chiếu TypeScript AST với HEAD gốc: mọi event handler, disabled/busy, thuộc tính validation và role không đổi. Không sửa API, backend, schema, thanh toán hoặc phân quyền.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Test trang Receptionist | 54 PASS; có kiểm tra đủ năm nhóm, dữ liệu, zoom hai ảnh, từ chối và lý do |
| Full frontend | 1.451 tests / 158 files PASS (`--maxWorkers=2`) |
| Typecheck | `tsc -b` PASS |
| Lint | `eslint . --max-warnings=0` PASS |
| Build | `npm.cmd run build` PASS |
| Diff | `git diff --check` PASS |
| Browser VI Light/Dark | 1440, 1366, 1280, 768, 390px PASS |
| Browser EN Light | 1280, 390px PASS |

Browser QA kiểm tra cả năm loại, CCCD và hộ chiếu, email dài, hai cột/hàng liên hệ ở desktop, một cột mobile, thứ tự header–thông tin–actions, căn phải, không chồng nút/overflow, mở/đóng popup và phóng to cả hai ảnh. Đã xem ảnh desktop Light và mobile Dark trực tiếp. Ảnh nằm trong `apps/web/node_modules/.cache/reception-pending-ui/`, không commit ảnh hoặc build output.

Lần full suite đầu chạy nhiều worker có một assertion CSS nowrap cũ và một test 3D timeout. Assertion đã được cập nhật theo UI responsive (giữ kiểm tra nút hoạt động); test 3D chạy lại PASS. Full suite cuối dùng hai worker PASS, không sửa mã 3D hoặc tăng timeout. Suite hiện có vẫn phát cảnh báo Three.js/React act ở các test ngoài phạm vi; không có test thất bại trong lần cuối.

## Chạy lại và giới hạn

1. Tại `apps/web`: `npm.cmd run dev -- --host 127.0.0.1 --port 5183 --strictPort`.
2. Từ root: `node scripts/qa/verify-reception-pending-ui.cjs` (Edge headless). Có thể đặt `PENDING_QA_URL` để đổi URL localhost.
3. Browser QA chặn API trong context kiểm thử và không gọi backend/ghi giao dịch thật. Không có mock hoặc dữ liệu giao dịch localStorage được thêm vào ứng dụng.

Chưa UAT với backend thật. Cần đối chiếu dữ liệu năm loại yêu cầu, ảnh giấy tờ được bảo vệ và thao tác duyệt/từ chối/thu tiền trên môi trường dev/test được cấp quyền. Test tự động không xác nhận giao dịch thực tế hoặc thay thế UAT. Không push, tạo PR, merge, deploy hoặc thay đổi database trong task này.
