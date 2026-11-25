# Kiểm tra trên VPS: checklist Member/PT ngày 23/11/2026

Tài liệu này dành cho agent chạy trên VPS. Môi trường: `docker compose` (`compose.yml`, service `api` và `web`) và PostgreSQL cục bộ (container 1Panel), cấu hình trong `.env`. **Không** đổi code, profile hay compose để chuyển sang Supabase (xem `docs/DOCKER_COMPOSE.md`).

Nhánh cần kiểm tra là `fix/member-checklist-gaps`. Nhánh này chứa PR #160 (`fix/coaching-ignore-legacy-classes`), commit giữ lượt PT Gold khi nâng Platinum (`fix/coaching-upgrade-pt-quota`) và các phần sửa thêm.

## Quy tắc an toàn

- Chỉ chạy `SELECT` ở bước kiểm tra. Mọi `UPDATE`/`DELETE` ở mục 6 phải **backup trước và hỏi người dùng** rồi mới chạy.
- Không in mật khẩu, JWT hay nội dung `.env` vào báo cáo.
- Tài khoản test: lấy từ seed/fixture của dự án (`app.demo.*`) hoặc hỏi người dùng. Không tự tạo tài khoản thật.

## 0. Triển khai nhánh

```bash
cd <thư mục repo trên VPS>
git fetch origin
git switch fix/member-checklist-gaps   # hoặc: git switch -c fix/member-checklist-gaps origin/fix/member-checklist-gaps
docker compose up -d --build api web
docker compose logs -f api | grep -m1 -E "Started .*Application|APPLICATION FAILED"
```

Hibernate (`ddl-auto: update`) sẽ thêm cột `coach_bookings.subscription_id`. Kiểm tra lại (thay `<pg>` bằng tên container Postgres, `<db>`/`<user>` lấy từ `.env`):

```bash
docker exec -it <pg> psql -U <user> -d <db> -c "\d coach_bookings" | grep subscription_id
```

Dùng chung cho các bước bên dưới:

```bash
API=http://localhost:<cổng api>/api/v1
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"<member>","password":"<mật khẩu test>"}' | jq -r '.data.token')
AUTH="Authorization: Bearer $TOKEN"
```

## 1. Trang Giao dịch & Hóa đơn không tải được (chưa rõ nguyên nhân)

Trong code `MemberInvoicesPage` → `GET /payments/my` và `GET /invoices/my/by-payment/{id}` không thấy lỗi. Commit Hikari keepalive (`52c0fd26`, `3fefa5df`) là để chữa kết nối Supabase bị rớt, **không chắc** đúng với Postgres cục bộ. Cần tìm nguyên nhân thật:

1. Đăng nhập web bằng một member có giao dịch, mở trang Giao dịch & Hóa đơn, bấm vào một giao dịch.
2. Gọi trực tiếp:
   ```bash
   curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' -H "$AUTH" $API/payments/my
   curl -s -H "$AUTH" $API/payments/my | jq '.data | length'
   curl -s -o /dev/null -w '%{http_code}\n' -H "$AUTH" $API/invoices/my/by-payment/<paymentId>
   ```
3. Xem log ngay sau khi tải trang:
   ```bash
   docker compose logs --since 5m api | grep -iE "exception|error|payments/my|invoices" | tail -50
   docker compose logs --since 5m web | grep -E " (4|5)[0-9]{2} " | tail -20
   ```
4. Nếu lỗi do kết nối (`Connection is not available`, `I/O error`, `This connection has been closed`), so cấu hình `hikari` trong `application-supabase.yml` với timeout của Postgres cục bộ.
5. Nếu là lỗi khác (LazyInitialization, 500 do dữ liệu, 401/403, 413 ở nginx), ghi lại stack trace (bỏ dữ liệu cá nhân) và payment id gây lỗi.

**Báo cáo:** mã HTTP, thời gian phản hồi, đoạn log lỗi, nguyên nhân gốc. Chỉ sửa nếu nguyên nhân đã rõ.

## 2. Cập nhật thông tin cá nhân

Đã sửa: frontend không gửi `avatarUrl`, `frontImageUrl`, `backImageUrl` (data URL vài MB) trong `PUT /profile` nữa; ảnh đại diện và CCCD đã có endpoint riêng. Trước đó đã có `@DynamicUpdate` cho User/Member (`450f990a`).

1. Đăng nhập web bằng một member **đã gửi CCCD** (có ảnh mặt trước/sau), mở Hồ sơ, sửa họ tên/địa chỉ/mục tiêu, bấm Lưu → phải báo thành công, tải lại trang thì dữ liệu vẫn còn, ảnh đại diện và trạng thái CCCD không đổi.
2. Lặp lại với một member chưa gửi CCCD và một tài khoản HLV (sửa chuyên môn/bio).
3. Nếu lỗi: `docker compose logs --since 5m api | grep -iE "profile|exception" | tail -40` và tab Network (mã HTTP, kích thước request).

## 3. Quota PT 1:1 (PR #160 + giữ lượt Gold khi nâng Platinum)

Câu truy vấn mới `CoachBookingRepository.countSubscriptionQuotaUsage` dùng `left join cb.subscription`. Unit test chỉ mock repository, nên **phải chạy thật trên Postgres**.

| Kịch bản | Mong đợi (`GET $API/coach-bookings/quota-status`) |
|---|---|
| Member Trial dùng 1 buổi PT miễn phí, rồi mua Gold | Gold: `usedThisMonth=0`, `remainingQuota=3` |
| Member Gold dùng 1 buổi, nâng lên Platinum trong cùng ngày | Platinum: `usedThisMonth=1`, `remainingQuota=5` |
| Member Gold có booking cũ (`subscription_id` null) trước khi deploy | Booking cũ tạo sau `created_at` của gói hiện tại vẫn được tính |
| Booking PT đã hủy trước 2h | Không tính, lượt được hoàn |

Đối chiếu bằng SQL (chỉ đọc):

```sql
SELECT cb.id, cb.member_id, cb.subscription_id, cb.payment_method, cb.status, cb.quota_forfeited,
       cb.booking_date, cb.created_at
FROM coach_bookings cb
WHERE cb.member_id = <memberId> AND cb.payment_method = 'package_quota'
ORDER BY cb.created_at DESC LIMIT 20;

SELECT id, status, start_date, end_date, previous_subscription_id, upgrade_charge, created_at
FROM membership_subscriptions WHERE member_id = <memberId> ORDER BY created_at DESC;
```

Nếu tên cột khác thì xem `\d coach_bookings` và `\d membership_subscriptions`.

## 4. ClassSession cũ không còn chặn lịch PT

Khi `app.legacy.classes-enabled` tắt (mặc định), lớp nhóm cũ không được chặn slot PT.

```sql
SELECT c.coach_id, cs.session_date, cs.start_time, cs.end_time
FROM class_sessions cs JOIN classes c ON c.id = cs.class_id
WHERE cs.session_date >= current_date AND cs.status = 'scheduled' LIMIT 10;
```

Lấy một dòng ra (nếu không có dòng nào thì ghi "không có dữ liệu để kiểm tra"), rồi gọi `GET $API/coach-bookings/available-slots?coachId=<coach_id>&date=<session_date>`. Slot trùng giờ lớp cũ phải **còn trống**, và đặt được (nếu HLV không có booking PT nào khác giờ đó). Nếu tên bảng/cột khác thì xem entity `ClassSession`.

## 5. Kiểm tra nhanh các mục đã merge

- **Chống treo đặt lịch không thanh toán:** đặt PT trả tiền mặt/chuyển khoản mà không thanh toán, chờ khoảng 6 phút (giữ chỗ 5 phút + scheduler chạy mỗi 60 giây) → booking phải tự chuyển `cancelled`, slot trống lại.
- **Hủy PT:** hủy khi còn hơn 2h trước giờ bắt đầu → được hoàn lượt. Hủy khi còn dưới 2h → mất lượt (`quota_forfeited = true`).
- **CCCD khi bấm gói Trial:** member đã gửi CCCD thủ công ở Hồ sơ, bấm nhận gói Trial → không bị bắt nhập lại CCCD.
- **Gói tập:** trang Gói tập hiển thị đúng gói 3 tháng và 6 tháng. Sửa giá gói ở màn Manager, restart `api`, giá đã sửa vẫn giữ nguyên.
- **Đặt PT 1:1:** không còn chip lọc bộ môn. "Xem tất cả" lịch PT sắp theo ngày tăng dần và lọc được theo ngày. Dòng phí ghi "Gold giảm 10% / Platinum giảm 20%".

## 6. Thông tin HLV: bỏ các bộ môn khác (dữ liệu, cần người dùng duyệt)

Code và demo seed đã chỉ còn Gym. HLV cũ trong DB có thể vẫn ghi chuyên môn/bio Yoga, Boxing, Bơi… Bước xem trước (chỉ đọc):

```sql
SELECT c.user_id, u.full_name, c.specialization, left(c.bio, 120) AS bio, c.certification
FROM coaches c JOIN users u ON u.id = c.user_id
WHERE u.deleted_at IS NULL
  AND (c.specialization ~* '(yoga|pilates|boxing|kickfit|muay|võ|bơi|swim|cầu lông|badminton|tennis|pickleball)'
       OR c.bio ~* '(yoga|pilates|boxing|kickfit|muay|võ|bơi|swim|cầu lông|badminton|tennis|pickleball)');
```

Gửi danh sách này cho người dùng, đề xuất chuyên môn/bio Gym mới cho từng HLV, **chờ đồng ý** rồi mới làm. Backup bảng (`CREATE TABLE coaches_backup_20261123 AS TABLE coaches;`) và chạy `UPDATE` trong một transaction. Nếu cần dọn cả phòng/bộ môn cũ thì làm theo `docs/DATA_CLEANUP.md`.

## Báo cáo gửi lại

Với từng mục 1–6: ✅/❌, bằng chứng (mã HTTP, kết quả SQL rút gọn, log), commit đã sửa thêm (nếu có). Không dán dữ liệu cá nhân của member.
