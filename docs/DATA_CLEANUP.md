# Dọn dữ liệu sau khi thu gọn phạm vi chỉ còn Gym

Hướng dẫn xóa dữ liệu của các tính năng đã ngừng (PR #144–#158): lớp học nhóm, đặt sân, cửa hàng, thiết bị, đánh giá/xếp hạng HLV, đánh giá buổi tập, tiến độ tập, bộ môn khác Gym và các phòng không dùng.

Từ PR #158, API `GET /api/v1/rooms` và `GET /api/v1/disciplines` **trả toàn bộ dữ liệu, không còn lọc cứng theo tên**. Phòng, bộ môn cũ (Yoga, Bơi lội, Phòng Gym VIP, sân…) sẽ hiện lại ở trang Danh mục và Explore 3D cho tới khi chạy hướng dẫn này.

> **Đây là thao tác xóa vĩnh viễn.** Chỉ chạy trên một database tại một thời điểm, sau khi sao lưu, và thử trước trên database dev/test. Không sửa schema: bảng, cột và trigger vẫn do Hibernate và `PostgreSqlTriggerProvider` quản lý (`AGENTS.md`). Đây là script DML chạy tay, không phải migration.

## 0. Chuẩn bị

1. **Dừng ghi dữ liệu**: tắt API (hoặc bật bảo trì) để không có request nào chen vào giữa chừng.
2. **Sao lưu** (Supabase: *Database → Backups*, hoặc `pg_dump`):

   ```bash
   pg_dump "$SCMS_DB_URL" --format=custom --no-owner --file="scms-before-cleanup-$(date +%Y%m%d-%H%M).dump"
   ```

3. Mở kết nối bằng tài khoản có quyền ghi mọi bảng (`postgres` trên Supabase SQL Editor hoặc `psql`). RLS không chặn tài khoản này.

## 1. Xem trước số dòng sẽ bị ảnh hưởng

Chạy riêng, chỉ đọc:

```sql
SELECT 'classes' AS bang, count(*) FROM classes
UNION ALL SELECT 'class_sessions', count(*) FROM class_sessions
UNION ALL SELECT 'class_enrollments', count(*) FROM class_enrollments
UNION ALL SELECT 'session_bookings', count(*) FROM session_bookings
UNION ALL SELECT 'session_attendance', count(*) FROM session_attendance
UNION ALL SELECT 'session_evaluations', count(*) FROM session_evaluations
UNION ALL SELECT 'coach_reviews', count(*) FROM coach_reviews
UNION ALL SELECT 'coach_monthly_reviews', count(*) FROM coach_monthly_reviews
UNION ALL SELECT 'court_bookings', count(*) FROM court_bookings
UNION ALL SELECT 'equipment', count(*) FROM equipment
UNION ALL SELECT 'product_orders', count(*) FROM product_orders
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'training_item_completions', count(*) FROM training_item_completions
UNION ALL SELECT 'member_favorite_disciplines', count(*) FROM member_favorite_disciplines
UNION ALL SELECT 'disciplines', count(*) FROM disciplines
UNION ALL SELECT 'rooms', count(*) FROM rooms;

-- Danh mục hiện có, để chọn bộ môn/phòng giữ lại ở bước 3
SELECT id, name FROM disciplines ORDER BY name;
SELECT id, name, tier, status, discipline_id FROM rooms ORDER BY name;

-- Chuyên môn và giới thiệu HLV hiện có (kiểm tra các dòng còn nhắc bộ môn ngoài Gym)
SELECT u.email, c.specialization, c.bio
FROM coaches c
JOIN users u ON u.id = c.user_id
ORDER BY u.email;
```

## 2. Xử lý tiền còn treo **trước** khi xóa (bắt buộc)

Xóa dòng bằng SQL **không hoàn tiền**. Các lịch/đơn đã trả tiền mà chưa dùng phải được hủy qua app để logic hiện có hoàn tiền vào Ví và giữ đúng doanh thu.

```sql
-- Đơn cửa hàng đã trả hoặc đang xử lý mà chưa hoàn tất
SELECT id, code, member_id, status, total FROM product_orders
WHERE status NOT IN ('completed', 'cancelled') ORDER BY created_at;

-- Lượt sân sắp tới còn hiệu lực
SELECT id, member_id, room_id, booking_date, start_time, payment_status FROM court_bookings
WHERE status = 'booked' AND booking_date >= CURRENT_DATE ORDER BY booking_date;

-- Đăng ký khóa học còn hiệu lực
SELECT e.id, e.member_id, e.class_id, c.name FROM class_enrollments e JOIN classes c ON c.id = e.class_id
WHERE e.status = 'booked';
```

Nếu các truy vấn trên **có dòng**:

1. Bật tạm cờ của tính năng tương ứng trong `.env` (Docker Compose nạp qua `env_file`; Render/VPS đặt biến môi trường tương tự) rồi khởi động API: `APP_SHOP_ENABLED=true` (`app.shop.enabled`), `APP_LEGACY_COURTSENABLED=true` (`app.legacy.courts-enabled`), `APP_LEGACY_CLASSESENABLED=true` (`app.legacy.classes-enabled`). Spring bỏ dấu `-` khi map tên biến môi trường.
2. Dùng API cũ (Swagger) với tài khoản lễ tân hoặc quản lý:
   - Đơn hàng: `POST /api/v1/staff/product-orders/{id}/cancel` (hoàn phần đã trả vào Ví, trả tồn kho).
   - Lượt sân: `PATCH /api/v1/court-bookings/{id}/cancel` (hoàn tiền vào Ví).
   - Khóa học: ngừng lớp bằng `DELETE /api/v1/classes/{id}` (hủy buổi chưa diễn ra, hủy đăng ký, hoàn học phí vào Ví).
3. Chạy lại các truy vấn ở trên cho tới khi rỗng. Tắt lại cờ và khởi động lại API.

> Nếu trung tâm quyết định **không hoàn tiền** (ví dụ đã hoàn tay ngoài hệ thống), ghi lại danh sách trên trước khi qua bước 3; bước 3 không đụng tới `payments` và `invoices` đã thành công nên doanh thu cũ vẫn giữ nguyên.

## 3. Script dọn dữ liệu

Sửa hai danh sách **giữ lại** ở đầu script (theo kết quả bước 1), rồi chạy cả khối. Script dừng và rollback toàn bộ nếu có lỗi. Đọc phần `NOTICE`/kết quả, nếu đúng mới `COMMIT`; nếu không, `ROLLBACK`.

```sql
BEGIN;

-- 3.0 Danh mục giữ lại (sửa cho đúng dữ liệu của bạn)
CREATE TEMP TABLE keep_disciplines ON COMMIT DROP AS
  SELECT id FROM disciplines WHERE name IN ('Gym');
CREATE TEMP TABLE keep_rooms ON COMMIT DROP AS
  SELECT id FROM rooms WHERE name IN ('Phòng Gym Tiêu chuẩn');

DO $$ BEGIN
  IF (SELECT count(*) FROM keep_disciplines) = 0 OR (SELECT count(*) FROM keep_rooms) = 0 THEN
    RAISE EXCEPTION 'Danh sách giữ lại đang rỗng, kiểm tra lại tên ở bước 3.0';
  END IF;
END $$;

-- 3.1 Đánh giá HLV, đánh giá buổi tập, tổng kết tháng, tiến độ bài tập
DELETE FROM coach_reviews;
DELETE FROM session_evaluations;
DELETE FROM coach_monthly_reviews;
DELETE FROM training_item_completions;
DELETE FROM member_favorite_disciplines;

-- 3.2 Thanh toán gắn với lớp, sân, đơn hàng: phiếu còn chờ chuyển 'failed',
--     rồi bỏ liên kết để xóa được dòng gốc. Payment/hóa đơn đã thành công được giữ (doanh thu cũ).
UPDATE payments SET status = 'failed'
WHERE status = 'pending'
  AND (class_enrollment_id IS NOT NULL OR court_booking_id IS NOT NULL OR product_order_id IS NOT NULL);
UPDATE payments SET class_enrollment_id = NULL WHERE class_enrollment_id IS NOT NULL;
UPDATE payments SET court_booking_id = NULL WHERE court_booking_id IS NOT NULL;
UPDATE payments SET product_order_id = NULL WHERE product_order_id IS NOT NULL;

-- 3.3 Lớp học nhóm
DELETE FROM session_attendance;
DELETE FROM session_bookings;
DELETE FROM class_enrollments;
DELETE FROM class_sessions;
UPDATE training_plans SET class_id = NULL WHERE class_id IS NOT NULL;
DELETE FROM classes;

-- 3.4 Đặt sân và thiết bị
DELETE FROM court_bookings;
DELETE FROM equipment;

-- 3.5 Cửa hàng
DELETE FROM product_order_items;
DELETE FROM product_stock_movements;
DELETE FROM product_orders;
DELETE FROM member_addresses;
DELETE FROM product_goals;
DELETE FROM product_images;
DELETE FROM product_nutrients;
DELETE FROM product_variants;
DELETE FROM products;
DELETE FROM product_categories;

-- 3.6 Buổi PT 1:1 gắn bộ môn sẽ xóa: chuyển sang bộ môn Gym giữ lại.
--     Buổi đã xong/đã hủy không qua kiểm tra lịch; buổi còn hiệu lực đi qua trigger PT,
--     dòng nào bị trigger từ chối được bỏ qua và báo NOTICE để xử lý tay.
UPDATE coach_bookings SET discipline_id = (SELECT min(id) FROM keep_disciplines)
WHERE discipline_id NOT IN (SELECT id FROM keep_disciplines) AND status <> 'confirmed';
DO $$
DECLARE b RECORD;
BEGIN
  FOR b IN SELECT id FROM coach_bookings
           WHERE discipline_id NOT IN (SELECT id FROM keep_disciplines) AND status = 'confirmed' LOOP
    BEGIN
      UPDATE coach_bookings SET discipline_id = (SELECT min(id) FROM keep_disciplines) WHERE id = b.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'coach_booking % chưa chuyển bộ môn: %', b.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3.7 Phòng và bộ môn không giữ lại
UPDATE rooms SET discipline_id = NULL, open_time = NULL, close_time = NULL
WHERE id IN (SELECT id FROM keep_rooms) AND discipline_id IS NOT NULL
  AND discipline_id NOT IN (SELECT id FROM keep_disciplines);
DELETE FROM rooms WHERE id NOT IN (SELECT id FROM keep_rooms);
DELETE FROM disciplines WHERE id NOT IN (SELECT id FROM keep_disciplines);

-- 3.8 Thông báo trỏ tới dữ liệu vừa xóa (link cũ đã được frontend chuyển hướng, xóa cho gọn)
DELETE FROM notifications
WHERE related_entity_type IN ('class_session', 'class_enrollment', 'session_booking', 'court_booking', 'product_order', 'coach_review');

-- 3.9 Tùy chọn: chuẩn hóa chuyên môn / giới thiệu HLV demo cũ còn nhắc bộ môn ngoài Gym
--     (chỉ chạy sau khi đối chiếu kết quả truy vấn bước 1 để không ghi đè dữ liệu Manager đã chỉnh)
UPDATE coaches c
SET specialization = v.specialization,
    bio = COALESCE(v.bio, c.bio)
FROM (VALUES
  ('hung@demo.sol.vn', 'Gym - Sức mạnh', '8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.'),
  ('mai@demo.sol.vn',  'Gym - Phục hồi', 'Huấn luyện viên Gym tập trung sức khỏe và phục hồi.'),
  ('long@demo.sol.vn', 'Gym - Thể lực',  'Huấn luyện viên Gym tập trung sức mạnh và thể lực.'),
  ('thao@demo.sol.vn', 'Gym - Sức bền',  'Huấn luyện viên Gym tập trung kỹ thuật và sức bền.'),
  ('coach@scms.local', 'Gym & Strength', NULL)
) AS v(email, specialization, bio)
JOIN users u ON lower(u.email) = v.email
WHERE c.user_id = u.id;

-- Kiểm tra trước khi chốt
SELECT 'disciplines' AS bang, count(*) FROM disciplines
UNION ALL SELECT 'rooms', count(*) FROM rooms
UNION ALL SELECT 'classes', count(*) FROM classes
UNION ALL SELECT 'court_bookings', count(*) FROM court_bookings
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'coach_bookings ngoài Gym', count(*) FROM coach_bookings
       WHERE discipline_id IS NOT NULL AND discipline_id NOT IN (SELECT id FROM disciplines);

-- Đúng thì: COMMIT;   Sai thì: ROLLBACK;
```

Nếu bước 3.7 báo lỗi khóa ngoại khi xóa `disciplines`, nghĩa là còn buổi PT ở trạng thái `confirmed` chưa chuyển được (xem các dòng `NOTICE` của bước 3.6). Hủy hoặc dời các buổi đó trong app rồi chạy lại.

## 4. Tùy chọn: số đo cơ thể (`member_progress_logs`)

Tính năng chỉ số cơ thể đã ngừng, nhưng bảng này **vẫn được đọc** để lấy chiều cao, cân nặng, BMI cho thẻ học viên của HLV và trợ lý AI soạn giáo án (`CurrentCoachMembers`, `AiRecommendationService`). Xóa thì các thông tin đó hiện "—". Chỉ chạy khi trung tâm đồng ý:

```sql
BEGIN;
DELETE FROM member_progress_logs;
COMMIT;
```

## 5. Sau khi dọn

1. Khởi động lại API. `CatalogSeeder` chỉ tạo bộ môn "Gym" và "Phòng Gym Tiêu chuẩn" khi chưa có, nên không tạo lại dữ liệu đã xóa.
2. Không bật `APP_DEMO_SEED_ENABLED` cùng `APP_LEGACY_CLASSESENABLED`, nếu không `DemoClassSeeder` sẽ tạo lại lớp mẫu.
3. Kiểm tra nhanh trên web:
   - `/manager/catalogs`: chỉ còn bộ môn và phòng đã giữ; tạo hoặc đổi tên phòng vẫn hiện trong danh sách.
   - `/member/classes?tab=pt`: đặt được PT 1:1.
   - `/manager/reports`: doanh thu cũ không đổi.
4. Giữ file sao lưu ở bước 0 tới khi chắc chắn không cần khôi phục.

## Khôi phục khi cần

```bash
pg_restore --clean --if-exists --no-owner --dbname="$SCMS_DB_URL" scms-before-cleanup-YYYYMMDD-HHMM.dump
```
