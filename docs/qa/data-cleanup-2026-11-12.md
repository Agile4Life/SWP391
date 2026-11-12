# Báo cáo dọn dữ liệu lỗi và seed lại — 2026-11-12

Phạm vi: DB PostgreSQL cục bộ của VPS (`agile4life`, container 1Panel). Không đổi code, schema, compose hay profile.

## 1. Backup

`~/scms-backups/agile4life-before-cleanup-20261112.sql.gz` (pg_dump trước khi xóa, 62 bảng). Khôi phục nếu cần:

```bash
zcat ~/scms-backups/agile4life-before-cleanup-20261112.sql.gz | docker exec -i -e PGPASSWORD=... 1Panel-postgresql-SFES psql -U agile4life -d agile4life
```

## 2. Dữ liệu lỗi đã phát hiện

| # | Vấn đề | Số lượng | Nguyên nhân (nợ kỹ thuật) |
|---|---|---|---|
| 1 | User đã soft-delete nhưng vẫn kéo theo sub/payment/check-in/notification | 12 user (14 sub, 12 payment, 8 check-in, 27 notification) | Soft-delete không dọn dữ liệu phụ thuộc |
| 2 | Tài khoản kiểm thử rác: `e2e_member_*`, `coach.swt.*` (tên "HLV Test Updated SWT" nhưng gán vai trò **Lễ tân**) | 3 + 7 | Test E2E/SWT không tự dọn |
| 3 | Hội viên `inactive` chưa kích hoạt (đăng ký thử, `abc@gmail.com`…) | 8 | Đăng ký/OTP dở dang |
| 4 | User **HLV nhưng có thêm hồ sơ `members`** (id 14 và 18) | 2 | Đổi vai trò mà không dọn hồ sơ cũ |
| 5 | Lớp test: `lopa` ×2, `tai`, `bơi`, `test1`, `test2`, `bơi test1`, `bơi 2`, `LỚP YOGA FREE` (bản trùng, không ai đăng ký) | 9 | Tạo thử khi QA |
| 6 | Gói `test 1` | 1 | QA |
| 7 | Subscription active **trùng hệt kỳ** (cùng gói, cùng start/end) | 7+ | Bấm mua/gia hạn lặp |
| 8 | Sub `active` đã quá `end_date` | 2 | Job hết hạn không chạy kịp |
| 9 | Sub `pending_payment` treo > 1 ngày | 2 | Không có job hủy |
| 10 | Payment `pending` treo > 1 ngày (VNPay bỏ dở) | 5 | Không có job hủy |
| 11 | Buổi lớp `scheduled` đã qua ngày (21), booking `booked` của các buổi đó, PT `confirmed` đã qua (10) | 21 / 16 / 10 | Không có job chốt trạng thái |

## 3. Đã làm

1. Xóa **37 user rác** (mục 1, 2, 3 và toàn bộ `*@demo.sol.vn` cũ để seed lại) cùng mọi dữ liệu phụ thuộc, theo thứ tự khóa ngoại. Cột "người thao tác" (`received_by`, `recorded_by`, `cancelled_by`…) được đặt NULL thay vì xóa bản ghi của người khác.
2. Xóa 9 lớp test, gói `test 1`, và hồ sơ `members` thừa của user 14, 18.
3. Sửa trạng thái: hủy sub active trùng kỳ, `expired` cho sub quá hạn, `cancelled` cho sub pending treo, `failed` cho payment pending treo, `completed` cho PT/buổi lớp/booking đã qua.
4. Bật seeder (`APP_DEMO_SEED_ENABLED=true` đã có sẵn trong `.env`), khởi động lại API → `DemoDataSeeder` nạp lại: 1 quản lý, 1 lễ tân, 4 HLV, 10 hội viên. Ngày tháng tính theo hôm nay (2026-11-12).

**Giữ nguyên:** `admin/manager/receptionist/coach@scms.local`, hội viên thật (gmail của thành viên nhóm), danh mục (gói, bộ môn, phòng, thiết bị, sản phẩm, quyền), lớp của HLV thật.

## 4. Kết quả kiểm tra sau dọn

| Kiểm tra | Trước | Sau |
|---|---|---|
| User soft-delete còn tồn tại | 12 | 0 |
| Lệch vai trò ↔ hồ sơ | 1 (+1 phát hiện sau) | 0 |
| Sub active quá hạn | 2 | 0 |
| Sub active trùng kỳ | 7+ | 0 |
| Buổi lớp scheduled đã qua | 21 | 0 |
| PT confirmed đã qua | 10 | 0 |
| Notification mồ côi | — | 0 |

Tổng sau dọn: 40 user, 16 lớp, 100 buổi, 69 sub, 81 payment, 48 hóa đơn, 103 check-in, 55 PT, 57 chỉ số cơ thể.

## 5. Seed mới — tài khoản demo

Mật khẩu chung: `Demo@12345` (mặc định của `APP_DEMO_PASSWORD`; `.env` không đặt giá trị khác).

| Vai trò | Email | Ghi chú |
|---|---|---|
| Quản lý | `manager@demo.sol.vn` | |
| Lễ tân | `letan@demo.sol.vn` | |
| HLV Gym | `hung@demo.sol.vn` | Strength Foundation |
| HLV Yoga | `mai@demo.sol.vn` | Morning Flow Yoga |
| HLV Boxing | `long@demo.sol.vn` | Boxing Cardio Rounds |
| HLV Bơi | `thao@demo.sol.vn` | Aqua Technique |

| Hội viên | Gói / trạng thái | Kịch bản |
|---|---|---|
| `an@` | PLATINUM 3 THÁNG, active (đến 31/12) | Gia hạn từ Gold đã hết hạn; lịch sử check-in, lớp, PT, chỉ số |
| `binh@` | GOLD, active (đến 29/11) | Yoga + bơi |
| `chi@` | SILVER, active (đến 06/12) | Hội viên mới |
| `dung@` | GOLD, **hết hạn** | Check-in bị từ chối |
| `em@` | SILVER, **bảo lưu** | |
| `phuc@` | GOLD, **chờ thanh toán** | KYC chờ duyệt |
| `giang@` | GOLD, active (đến 21/11) | Gia hạn từ Silver; Boxing + Yoga |
| `hieu@` | PLATINUM, **sắp hết hạn (15/11)** | Nhắc gia hạn |
| `khoa@` | SILVER, **đã hủy** | |
| `lan@` | chưa có gói | KYC chờ duyệt |

(Tất cả có hậu tố `@demo.sol.vn`.)

## 6. Việc nên làm tiếp (chưa làm, cần quyết định)

- **Tắt seeder:** đặt `APP_DEMO_SEED_ENABLED=false` trong `.env` rồi khởi động lại API (hiện vẫn `true`; seeder idempotent nên không gây hại, nhưng nên tắt theo `docs/DEMO_DATA.md`).
- **Nguyên nhân gốc chưa sửa trong code** — dữ liệu rác sẽ quay lại nếu không xử lý:
  - Thêm job định kỳ: hủy `pending_payment`/payment `pending` quá hạn; chốt buổi lớp và PT đã qua; hết hạn sub.
  - Chặn mua/gia hạn trùng kỳ (idempotency) ở `MembershipSubscriptionService`.
  - Khi đổi vai trò user, dọn hồ sơ `members`/`coaches` cũ.
  - Test E2E/SWT cần tự xóa tài khoản và lớp tạo ra (hoặc dùng prefix + job dọn).
- Hội viên thật còn nhiều sub xếp hàng tương lai (ví dụ `doannguyentanan01@gmail.com` xếp tới 05/2027, `mindcareforyouth@gmail.com` tới 2028). Đây là cơ chế gia hạn nối tiếp nên mình giữ nguyên, nhưng đáng xem lại nếu muốn demo gọn.
- Bốn lớp `LỚP YOGA FREE`, `Gym cơ bản`, `Tăng cơ đùi`, `Lớp boxing` mình giữ vì có đăng ký thật hoặc tên hợp lệ; xóa tay nếu bạn thấy là test.
