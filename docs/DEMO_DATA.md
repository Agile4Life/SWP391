# Dữ liệu demo cho hội đồng

`DemoDataSeeder` (`apps/api/.../demo/`) nạp tài khoản và dữ liệu quá khứ/hiện tại để demo. Mặc định **tắt**.

## Bật

Trong `.env` của môi trường demo:

```
APP_DEMO_SEED_ENABLED=true
APP_DEMO_PASSWORD=Demo@12345   # đổi nếu cần
```

Khởi động lại API một lần. Seeder idempotent (bỏ qua nếu `manager@demo.sol.vn` đã tồn tại). Sau khi seed xong nên đặt lại `APP_DEMO_SEED_ENABLED=false`.

- Chỉ bật trên DB demo/dev, **không** bật trên DB thật.
- Ngày tháng tính theo ngày chạy seed (múi giờ Asia/Ho_Chi_Minh): seed **1–2 ngày trước buổi demo** để "sắp hết hạn", "buổi sắp tới" còn đúng.
- Cần CatalogSeeder chạy trước (gói, bộ môn Gym, Phòng Gym Tiêu chuẩn). Gói GOLD/SILVER/PLATINUM(+3 THÁNG) phải tồn tại.
- Muốn seed lại: xóa các user `*@demo.sol.vn` (và dữ liệu liên quan) rồi khởi động lại.

## Tài khoản (mật khẩu chung: `APP_DEMO_PASSWORD`)

| Vai trò | Email | Ghi chú |
|---|---|---|
| Quản lý | `manager@demo.sol.vn` | |
| Lễ tân | `letan@demo.sol.vn` | nhận thanh toán, check-in thủ công |
| HLV Gym – Sức mạnh | `hung@demo.sol.vn` | PT 1:1 với `an@`, `hieu@` |
| HLV Gym – Phục hồi | `mai@demo.sol.vn` | PT 1:1 với `binh@`, `chi@` |
| HLV Gym – Thể lực | `long@demo.sol.vn` | PT 1:1 với `giang@` |
| HLV Gym – Sức bền | `thao@demo.sol.vn` | Chưa có lịch PT |
| Admin | theo `APP_BOOTSTRAP_ADMIN_EMAIL` | không do seeder tạo |

## Hội viên và kịch bản

| Email | Gói / trạng thái | Câu chuyện để demo |
|---|---|---|
| `an@` | PLATINUM 3 THÁNG, active | Gia hạn từ Gold cũ; lịch sử check-in và PT 1:1 với `hung@` |
| `binh@` | GOLD, active | Giảm cân, PT 1:1 với `mai@` |
| `chi@` | SILVER, active | Hội viên mới 5 ngày |
| `dung@` | GOLD, **hết hạn** | Check-in bị từ chối (DENIED) |
| `em@` | SILVER, **bảo lưu** | Đang trong thời gian bảo lưu đã duyệt |
| `phuc@` | GOLD, **chờ thanh toán** | KYC chờ duyệt |
| `giang@` | GOLD, active | Gia hạn từ Silver đã hết hạn; PT 1:1 với `long@` |
| `hieu@` | PLATINUM, **sắp hết hạn (3 ngày)** | Nhắc gia hạn |
| `khoa@` | SILVER, **đã hủy** | |
| `lan@` | chưa có gói | Mới đăng ký, KYC chờ duyệt |

(Tất cả email có hậu tố `@demo.sol.vn`.)

Dữ liệu đi kèm: thanh toán + hóa đơn cho mỗi gói đã trả (cash/pos/bank_transfer/online_wallet), check-in cổng, buổi PT 1:1 quá khứ (completed) và sắp tới (confirmed). Seeder vẫn ghi số đo theo tháng (`health_metrics`) cho `an@`, `binh@`, `giang@`, `hieu@` nhưng tính năng chỉ số cơ thể đã ngừng nên không màn hình nào hiển thị. Không còn lớp học nhóm.

## Lớp học nhóm (`DemoClassSeeder`) — đã tắt

Lớp học nhóm đã ngừng (22/11/2026), nên `DemoClassSeeder` chỉ chạy khi bật **cả** `APP_DEMO_SEED_ENABLED=true` và `app.legacy.classes-enabled=true`. Mặc định nó không tạo khóa học nào.

## Ghi chú kỹ thuật

Trigger DB chỉ cho phép dòng `booked`/`GRANTED` mới nếu hội viên đang có gói active hôm nay, nên bản ghi quá khứ dùng trạng thái cuối (`completed`, `DENIED`) và chỉ gắn cho hội viên đang active.
