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
- Cần CatalogSeeder chạy trước (gói, bộ môn, phòng). Gói GOLD/SILVER/PLATINUM(+3 THÁNG) phải tồn tại.
- Muốn seed lại: xóa các user `*@demo.sol.vn` (và dữ liệu liên quan) rồi khởi động lại.

## Tài khoản (mật khẩu chung: `APP_DEMO_PASSWORD`)

| Vai trò | Email | Ghi chú |
|---|---|---|
| Quản lý | `manager@demo.sol.vn` | |
| Lễ tân | `letan@demo.sol.vn` | nhận thanh toán, check-in thủ công |
| HLV Gym | `hung@demo.sol.vn` | Strength Foundation, PT 1:1 |
| HLV Yoga | `mai@demo.sol.vn` | Morning Flow Yoga |
| HLV Boxing | `long@demo.sol.vn` | Boxing Cardio Rounds |
| HLV Bơi | `thao@demo.sol.vn` | Aqua Technique |
| Admin | theo `APP_BOOTSTRAP_ADMIN_EMAIL` | không do seeder tạo |

## Hội viên và kịch bản

| Email | Gói / trạng thái | Câu chuyện để demo |
|---|---|---|
| `an@` | PLATINUM 3 THÁNG, active | Gia hạn từ Gold cũ; lịch sử 35 ngày check-in, lớp, PT, chỉ số 4 tháng |
| `binh@` | GOLD, active | Yoga + bơi, PT với HLV Yoga |
| `chi@` | SILVER, active | Hội viên mới 5 ngày |
| `dung@` | GOLD, **hết hạn** | Check-in bị từ chối (DENIED) |
| `em@` | SILVER, **bảo lưu** | Đang trong thời gian bảo lưu đã duyệt |
| `phuc@` | GOLD, **chờ thanh toán** | KYC chờ duyệt |
| `giang@` | GOLD, active | Gia hạn từ Silver đã hết hạn; Boxing + Yoga |
| `hieu@` | PLATINUM, **sắp hết hạn (3 ngày)** | Nhắc gia hạn |
| `khoa@` | SILVER, **đã hủy** | |
| `lan@` | chưa có gói | Mới đăng ký, KYC chờ duyệt |

(Tất cả email có hậu tố `@demo.sol.vn`.)

Dữ liệu đi kèm: thanh toán + hóa đơn cho mỗi gói đã trả (cash/pos/bank_transfer/online_wallet), 4 lớp với buổi 4 tuần trước (completed, có điểm danh present/late/absent) và 2 tuần tới (scheduled, đã đặt chỗ), check-in cổng, đặt PT quá khứ (completed) và sắp tới (confirmed), chỉ số cơ thể theo tháng.

## Ghi chú kỹ thuật

Trigger DB chỉ cho phép dòng `booked`/`GRANTED` mới nếu hội viên đang có gói active hôm nay, nên bản ghi quá khứ dùng trạng thái cuối (`completed`, `DENIED`) và chỉ gắn cho hội viên đang active.
