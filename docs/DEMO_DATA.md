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
- Cần CatalogSeeder chạy trước (gói, bộ môn, phòng). Gói SILVER/GOLD/PLATINUM × 3, 6, 9, 12 THÁNG phải tồn tại (xem mục *Danh mục gói*).
- Muốn seed lại: xóa các user `*@demo.sol.vn` (và dữ liệu liên quan) rồi khởi động lại.

## Danh mục gói (CatalogSeeder)

Gói 1 tháng đã ngừng bán (tự chuyển `inactive` nếu còn trong DB cũ). Gói trả phí gồm hai nhóm, đều có ba hạng:

| Nhóm | Thời hạn | Silver | Gold | Platinum |
|---|---|---|---|---|
| Ngắn hạn | 3 tháng (90 ngày) | 549.000 | 799.000 | 1.599.000 |
| Dài hạn | 6 tháng (180 ngày) | 990.000 | 1.440.000 | 2.890.000 |
| Dài hạn | 9 tháng (270 ngày) | 1.390.000 | 2.040.000 | 4.090.000 |
| Dài hạn | 12 tháng (360 ngày) | 1.750.000 | 2.550.000 | 5.120.000 |

Cộng gói **Trải nghiệm 3 ngày** (miễn phí). Dài hạn rẻ hơn khoảng 10% / 15% / 20% (6 / 9 / 12 tháng) so với đơn giá tháng của gói 3 tháng. Khóa nhóm miễn phí = số khóa/tháng của hạng × số tháng; bảo lưu tối đa 7 / 15 / 30 ngày (Silver / Gold / Platinum).

## Khóa học và phòng

Hầu hết khóa học ở phòng **tiêu chuẩn** (Phòng Gym Tiêu chuẩn, Boxing Studio, Zen Garden Studio, Oasis Lap Pool) để mọi hạng gói đặt được. Chỉ **Powerlifting Technique** ở Phòng Gym VIP làm khóa đặc quyền Platinum.

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
| `an@` | PLATINUM 12 THÁNG, active | Gia hạn từ Gold 3 tháng cũ; lịch sử 35 ngày check-in, lớp, PT, chỉ số 4 tháng |
| `binh@` | GOLD 6 THÁNG, active | Yoga + bơi, PT với HLV Yoga |
| `chi@` | SILVER 3 THÁNG, active | Hội viên mới 5 ngày |
| `dung@` | GOLD 3 THÁNG, **hết hạn** | Check-in bị từ chối (DENIED) |
| `em@` | SILVER 6 THÁNG, **bảo lưu** | Đang trong thời gian bảo lưu đã duyệt |
| `phuc@` | GOLD 3 THÁNG, **chờ thanh toán** | KYC chờ duyệt |
| `giang@` | GOLD 9 THÁNG, active | Gia hạn từ Silver 3 tháng đã hết hạn; Boxing + Yoga |
| `hieu@` | PLATINUM 3 THÁNG, **sắp hết hạn (3 ngày)** | Nhắc gia hạn |
| `khoa@` | SILVER 3 THÁNG, **đã hủy** | |
| `lan@` | chưa có gói | Mới đăng ký, KYC chờ duyệt |

(Tất cả email có hậu tố `@demo.sol.vn`.)

Dữ liệu đi kèm: thanh toán + hóa đơn cho mỗi gói đã trả (cash/pos/bank_transfer/online_wallet), 4 lớp với buổi 4 tuần trước (completed, có điểm danh present/late/absent) và 2 tuần tới (scheduled); hội viên đăng ký **trọn khóa** (`class_enrollments`), không có đặt từng buổi, check-in cổng, đặt PT quá khứ (completed) và sắp tới (confirmed), chỉ số cơ thể theo tháng.

## Thời khóa biểu dày hơn (`DemoClassSeeder`)

Cùng cờ `APP_DEMO_SEED_ENABLED=true`, nhưng chạy **độc lập** với `DemoDataSeeder` nên bổ sung được cho DB đã seed trước đó (chỉ cần khởi động lại API).

- Thêm 26 khóa học định kỳ do quản lý tạo: Gym, Yoga, Boxing, Bơi lội. Gồm khóa đang chạy (3 tuần trước → 5 tuần tới, buổi quá khứ `completed`), khóa sắp khai giảng (`scheduled`) và khóa đã kết thúc (lớp `archived`). Có lớp miễn phí và lớp có phí.
- Idempotent theo **tên lớp**: lớp đã tồn tại thì bỏ qua, không sửa. Không tạo hội viên hay ghi danh.
- HLV lấy từ HLV `active` theo chuyên môn, phòng theo tên (bỏ qua phòng không `available`, ví dụ Ring Arena đang bảo trì). Mỗi khóa chỉ được đặt vào khung giờ trống của HLV và phòng (trigger DB không cho trùng); nếu giờ ưa thích bận thì dịch ±1–4 giờ trong 06:00–22:00, không xếp được thì bỏ qua và ghi cảnh báo trong log.
- Muốn nạp lại: xóa các lớp này (và buổi học của chúng) rồi khởi động lại API.

## Ghi chú kỹ thuật

Trigger DB chỉ cho phép dòng `booked`/`GRANTED` mới nếu hội viên đang có gói active hôm nay, nên bản ghi quá khứ dùng trạng thái cuối (`completed`, `DENIED`) và chỉ gắn cho hội viên đang active.
