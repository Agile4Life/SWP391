# Tài khoản demo

Mật khẩu chung: `Demo@12345` (mặc định; nếu đã đặt `APP_DEMO_PASSWORD` thì dùng giá trị đó).

Các tài khoản chỉ có sau khi bật `APP_DEMO_SEED_ENABLED=true` và khởi động API. Cách bật và ghi chú kỹ thuật: [DEMO_DATA.md](DEMO_DATA.md).

## Nhân sự

| Vai trò | Họ tên | Email | Dùng để demo |
|---|---|---|---|
| Quản lý trung tâm | Nguyễn Hoàng Quản Lý | `manager@demo.sol.vn` | Danh mục, báo cáo, duyệt |
| Lễ tân / Thu ngân | Trần Bảo Ngọc | `letan@demo.sol.vn` | Thanh toán, check-in thủ công, KYC, bảo lưu |
| Huấn luyện viên Gym | Trịnh Quang Hùng | `hung@demo.sol.vn` | Lớp Strength Foundation, PT 1:1, chỉ số hội viên |
| Huấn luyện viên Yoga | Lý Thanh Mai | `mai@demo.sol.vn` | Lớp Morning Flow Yoga |
| Huấn luyện viên Boxing | Phan Thành Long | `long@demo.sol.vn` | Lớp Boxing Cardio Rounds |
| Huấn luyện viên Bơi lội | Vũ Phương Thảo | `thao@demo.sol.vn` | Lớp Aqua Technique |
| Admin | — | theo `APP_BOOTSTRAP_ADMIN_EMAIL` | Seeder không tạo |

## Hội viên

| Họ tên | Email | Gói | Trạng thái | Kịch bản |
|---|---|---|---|---|
| Nguyễn Minh An | `an@demo.sol.vn` | Platinum 3 tháng | Đang hoạt động | Gia hạn từ Gold cũ; lịch sử check-in, lớp, PT, chỉ số 4 tháng |
| Trần Thu Bình | `binh@demo.sol.vn` | Gold | Đang hoạt động | Yoga + bơi, PT với HLV Yoga |
| Lê Khánh Chi | `chi@demo.sol.vn` | Silver | Đang hoạt động | Hội viên mới 5 ngày |
| Phạm Quốc Dũng | `dung@demo.sol.vn` | Gold | Hết hạn | Check-in bị từ chối |
| Võ Ngọc Em | `em@demo.sol.vn` | Silver | Bảo lưu | Bảo lưu đã duyệt, đang trong thời gian bảo lưu |
| Đặng Hoàng Phúc | `phuc@demo.sol.vn` | Gold | Chờ thanh toán | KYC chờ duyệt |
| Bùi Hương Giang | `giang@demo.sol.vn` | Gold | Đang hoạt động | Gia hạn từ Silver; Boxing + Yoga |
| Ngô Trung Hiếu | `hieu@demo.sol.vn` | Platinum | Sắp hết hạn (3 ngày) | Nhắc gia hạn |
| Đỗ Anh Khoa | `khoa@demo.sol.vn` | Silver | Đã hủy | Gói bị hủy |
| Hồ Mỹ Lan | `lan@demo.sol.vn` | — | Chưa có gói | Mới đăng ký, KYC chờ duyệt |

## Gợi ý luồng demo

1. **Hội viên đầy đủ nhất:** đăng nhập `an@` để xem gói, hóa đơn, lịch lớp, PT, tiến độ.
2. **Các trạng thái gói:** so sánh `dung@` (hết hạn), `em@` (bảo lưu), `phuc@` (chờ thanh toán), `hieu@` (sắp hết hạn).
3. **Lễ tân:** `letan@` xử lý KYC của `phuc@`/`lan@`, xem check-in bị từ chối của `dung@`.
4. **Huấn luyện viên:** `hung@` xem lớp, điểm danh và chỉ số của `an@`, `hieu@`.
5. **Quản lý:** `manager@` xem báo cáo doanh thu và điểm danh.
