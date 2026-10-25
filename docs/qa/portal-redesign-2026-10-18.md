# Portal SÖL: thiết kế và kiểm chứng UI

> **Phạm vi tài liệu:** hồ sơ ngày 18/10/2026; tiếp tục tham khảo cho portal. Landing/login đã được làm lại ngày 22/10/2026 và tuân theo [DESIGN.md](../../DESIGN.md). Không dùng ảnh hoặc bảng màu công khai cũ trong hồ sơ này để thay thế theme charcoal–salmon hiện hành.

Ngày: 18/10/2026. Nhánh: `feat/portal-board-redesign`.

## Yêu cầu và phân tích

Làm lại portal theo cấu trúc ảnh tham chiếu: thanh điều hướng gọn bên trái,
khung làm việc bo tròn, các thẻ nội dung theo cột. Theo yêu cầu bổ sung,
giữ bảng màu phù hợp trang chính SÖL: kem, vàng cát, nâu espresso và trắng ấm.

Portal dùng chung một layout cho hội viên, lễ tân, huấn luyện viên và quản lý.
Các trang đã có API, trạng thái tải dữ liệu và phân quyền riêng. Vì vậy thay
khung giao diện và hệ thống hiển thị chung, giữ các biểu mẫu và bảng phục vụ
nghiệp vụ; dùng board cho trang tổng quan hội viên. Không biến dữ liệu gói tập,
lớp học hoặc thẻ hội viên thành các thẻ công việc có thể kéo thả đổi trạng thái.

Đối chiếu backlog: trang tổng quan thuộc **SCRUM-85**, owner **Thịnh**;
các luồng liên quan là **SCRUM-86**, **SCRUM-87**, **SCRUM-88**. Đây là thay đổi
giao diện theo yêu cầu trực tiếp, không phải bổ sung nghiệp vụ cho các ticket đó.

## Thiết kế theo từng phần

| Phần | Cách triển khai | Điểm kiểm soát UX |
| --- | --- | --- |
| Khung portal | Rail trắng, workspace nền kem, thẻ bo tròn | Giữ đầy đủ đường dẫn cho từng vai trò |
| Điều hướng | Icon có accessible name và tooltip; menu đầy đủ trên mobile | Điều khiển được bằng bàn phím, có skip link |
| Tìm kiếm | Tìm các màn hình được phép truy cập, hỗ trợ tiếng Việt không dấu | Có kết quả trống; đóng dialog khi chuyển trang; focus về nội dung |
| Tổng quan hội viên | Bốn cột: gói tập, lịch tập, thẻ/thanh toán, sức khỏe | Chuyển thành hai hoặc một cột; API gói tập và lịch tập giữ trạng thái độc lập |
| Nhận diện | Ảnh có sẵn của SÖL, màu kem/vàng cát/nâu | Nút chính nền nâu đậm; vàng đậm cho chữ nhỏ và focus |
| Trang nghiệp vụ | Đồng bộ bảng, form, tabs, chip, modal, KPI | Bảng cuộn trong vùng riêng; nút/form không bị ép chật trên mobile |
| Chuyển động | Fade/translate nhẹ khi vào trang; phản hồi hover/nhấn | Tắt animation/transition khi bật reduced motion |

Không thay đổi backend, OpenAPI, schema, xác thực hoặc API nghiệp vụ.
Không thêm thư viện chạy trong ứng dụng.

## Kiểm chứng

Lệnh chạy trong `apps/web`:

```text
npm run test -- --maxWorkers=1 --reporter=dot
npm run build
npm run lint
```

Kết quả sau sửa lỗi đăng nhập: **21 file test, 115 test đạt**; TypeScript/Vite build đạt; ESLint đạt.
Test được chạy với một worker để tránh thiếu bộ nhớ khi môi trường tạo nhiều
process đồng thời. Build còn cảnh báo chunk JavaScript lớn hơn 500 kB.

Kiểm tra Chromium headless với API fixture cục bộ, không dùng tài khoản thật:

| Nhóm | Màn hình | Kích thước đã kiểm tra |
| --- | --- | --- |
| Hội viên | Tổng quan, gói tập, lịch học, thẻ, hồ sơ | 375, 768, 1024, 1440 px |
| Lễ tân | POS, check-in, quản lý lớp | 375, 768, 1024, 1440 px |
| Huấn luyện viên | Điểm danh | 375, 768, 1024, 1440 px |
| Quản lý | Tài khoản, danh mục, báo cáo | 375, 768, 1024, 1440 px |

Tổng cộng **48 tổ hợp màn hình/kích thước**, thêm 3 trạng thái tổng quan
loading/empty/error. Không ghi nhận JavaScript exception, ảnh hỏng hoặc tràn
ngang ngoài vùng bảng cuộn trong lượt kiểm chứng cuối.

Đã kiểm tra tìm kiếm `lich hoc`, chuyển đến đúng màn hình, đóng dialog và focus
về `main`; menu mobile chỉ chứa màn hình hội viên; Escape đóng menu; reduced
motion tắt animation. Test tự động kiểm tra hủy đăng xuất vẫn giữ phiên đăng nhập.

Các lỗi phát hiện và sửa trước bàn giao:

- Bảng giao dịch báo cáo tràn ở tablet: dùng vùng cuộn riêng có nhãn và keyboard focus.
- Biểu đồ báo cáo bị ép cột: chuyển thành một cột khi không đủ rộng.
- Form thêm chỉ số sức khỏe quá hẹp trên mobile: bố trí lại, bổ sung nhãn từng ô.
- Skip link có thể lộ trên mép viewport: ẩn đúng vị trí, hiện lại khi được focus.
- Link thanh toán dẫn sai trang: chuyển tới màn hình gói tập/thanh toán đang có.

## Ảnh kiểm chứng

Ảnh chỉ chứa dữ liệu mô phỏng:

- [Tổng quan desktop](portal-redesign/member-dashboard-1440.png)
- [Tổng quan mobile](portal-redesign/member-dashboard-375.png)
- [Báo cáo tablet](portal-redesign/manager-reports-768.png)
- [Hồ sơ mobile](portal-redesign/member-profile-375.png)
- [Kết quả kiểm tra trình duyệt](portal-redesign/results.json)

## Giới hạn kiểm chứng

Kiểm tra trình duyệt sử dụng fixture; chưa xác minh giao dịch với backend hoặc
Supabase thật. Các giới hạn sẵn có về đặt chỗ theo buổi, thanh toán và dữ liệu
điểm danh không nằm trong phạm vi thiết kế lại. Trang tổng quan vẫn giữ thông
báo khi backend chưa xác định được buổi học của lượt đặt chỗ, không tự tạo giờ
học hoặc phòng tập thay cho dữ liệu còn thiếu.

## Bổ sung: lỗi sau đăng nhập

Hai vấn đề được xác định từ log và ảnh lỗi:

- Proxy không kết nối được API lúc 22:40:18; API đến 22:40:40 mới sẵn sàng.
  Runner hiện chờ health API trước khi chạy web, dùng lại dịch vụ đang hoạt động
  và chỉ mở trình duyệt sau kiểm tra sẵn sàng. Vite được giữ ở cổng 5173.
- Dashboard crash với `status?.toLowerCase is not a function` khi chưa có gói tập.
  Backend dùng Jackson `NON_NULL`, nên phản hồi thành công không có trường
  `data` thay vì `data: null`. API client cũ trả cả envelope, khiến mã HTTP
  `status: 200` bị đọc như trạng thái subscription. API client đã được sửa để
  trả `null` cho payload bị bỏ trống, đồng thời giữ nguyên dữ liệu `false`, `0`,
  chuỗi rỗng, mảng và phản hồi health không có envelope.

Regression test tái hiện đúng lỗi trước sửa và kiểm chứng dashboard qua API
client thật, bao gồm các hàm lấy gói tập và thẻ hội viên. Kiểm tra runner:
PowerShell syntax hợp lệ, bốn kiểm tra readiness đạt (API, web, từ chối nhận
web là API, timeout khi không có dịch vụ); chạy launcher `-NoBrowser` thành công.

Kiểm tra trực tiếp ngày 18/10/2026: `/api/v1/health` qua web và API trả 200;
đăng nhập bằng tài khoản chẩn đoán không tồn tại trả 401 `INVALID_CREDENTIALS`
qua cả proxy 5173 và API 8080. Điều này xác nhận yêu cầu tới được phần xác thực,
không phải 502; chưa xác minh đăng nhập thành công bằng tài khoản của người dùng.
