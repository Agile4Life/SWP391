# Hướng dẫn agent trên VPS: kiểm chứng bằng dữ liệu thật (PostgreSQL)

Đối tượng: agent chạy trên VPS, có quyền vào PostgreSQL của hệ thống. Bộ e2e Playwright (`apps/web/e2e`) chỉ chạy trên Postgres tạm trong Docker
của máy dev, nên **chưa từng thấy dữ liệu thật**. Tài liệu này nói rõ cần kiểm chứng gì trên dữ liệu thật, bằng truy vấn nào, và phần nào
chưa ai kiểm chứng được.

## 0. Quy tắc an toàn (đọc trước)

1. **Chỉ đọc trước.** Mọi bước dưới đây là `SELECT`. Không `UPDATE/DELETE/INSERT` trên DB đang chạy thật nếu chưa có bản sao lưu và chưa được người phụ trách đồng ý.
2. Muốn thử thao tác ghi: dùng `BEGIN; ...; ROLLBACK;`, hoặc khôi phục bản sao lưu sang một database khác (`pg_dump` → `createdb scms_verify` → `psql`), rồi trỏ một API riêng vào đó. Không thử ghi trên DB thật.
3. Không in, không ghi log, không commit mật khẩu, JWT secret, `SPRING_DATASOURCE_*`, token VNPay/Google/AI. Không đổi `password_hash`.
4. Không dùng tài khoản thật của hội viên để đăng nhập. Cần thao tác qua UI/API thì tạo tài khoản kiểm thử riêng có tiền tố `e2e-` rồi xóa/khóa sau khi xong (qua giao diện admin, không xóa thẳng trong DB).
5. Mã nguồn và profile không đổi để "đưa về Supabase" hay thêm profile `local` (xem `docs/DOCKER_COMPOSE.md`). Chỉ báo cáo, không sửa cấu hình triển khai.
6. Báo cáo cuối: nêu rõ mục nào **đã xác nhận bằng số liệu**, mục nào **chưa xác nhận**. Không suy diễn từ code rồi ghi là đã kiểm chứng.

## 1. Trước khi bắt đầu

- Xác định commit đang chạy trên VPS (`docker compose images`, hoặc `git log -1` ở thư mục deploy). Các sửa dưới đây chỉ có hiệu lực nếu VPS đã deploy **cả API và web** từ các commit sau (kiểm tra bằng `git log --oneline` trong repo):
  - `3fb3cf2f` sửa `GET /classes/my-quota` (500) và `/auth/me` (`username: null`).
  - `8ccfd07f` sửa nghiệp vụ khóa học (ví, hạn giữ chỗ, hoàn học phí), validate SĐT, đơn nghỉ phép, key i18n.
  - Commit "fix(scheduling): block overlapping class, court and coach bookings" (`MemberScheduleGuard`) chặn hội viên giữ lớp, sân và HLV 1:1 chồng giờ. Nếu không thấy commit này trong `git log` của VPS thì bản sửa chưa được deploy.
- Kiểm tra API sống: `GET /api/v1/health`.
- Múi giờ: DB lưu `LocalDateTime` theo `Asia/Ho_Chi_Minh` (cấu hình Hibernate). Khi so với `now()` trong SQL, dùng `now() AT TIME ZONE 'Asia/Ho_Chi_Minh'`.

## 2. Các kiểm chứng bằng SQL (chỉ đọc)

Tên bảng/cột lấy từ schema Hibernate đang chạy. Nếu một câu lệnh báo thiếu cột, chạy `\d <bảng>` rồi chỉnh lại — không đoán.

### 2.1. Dữ liệu cũ vi phạm quy tắc "không trùng lịch" (lớp + sân + HLV 1:1)

Quy tắc mới: một hội viên không được giữ lớp học, đặt sân và lịch HLV 1:1 chồng giờ nhau. Dữ liệu tạo **trước** khi deploy bản sửa vẫn có thể vi phạm; bản sửa không tự dọn dữ liệu cũ.

```sql
-- Sân trùng lớp (đăng ký cả khóa hoặc đặt từng buổi)
WITH member_class AS (
  SELECT e.member_id, s.session_date d, s.start_time st, s.end_time et, c.name label
  FROM class_enrollments e
  JOIN classes c ON c.id = e.class_id
  JOIN class_sessions s ON s.class_id = c.id AND s.status <> 'cancelled'
  WHERE e.status = 'booked'
  UNION ALL
  SELECT b.member_id, s.session_date, s.start_time, s.end_time, c.name
  FROM session_bookings b
  JOIN class_sessions s ON s.id = b.session_id AND s.status <> 'cancelled'
  JOIN classes c ON c.id = s.class_id
  WHERE b.status = 'booked'
)
SELECT mc.member_id, mc.label AS lop, cb.booking_date, cb.start_time AS san_bat_dau, mc.st AS lop_bat_dau
FROM member_class mc
JOIN court_bookings cb ON cb.member_id = mc.member_id AND cb.status = 'booked'
 AND cb.booking_date = mc.d AND cb.start_time < mc.et AND cb.end_time > mc.st
ORDER BY cb.booking_date;

-- HLV 1:1 trùng lớp
WITH member_class AS (
  SELECT e.member_id, s.session_date d, s.start_time st, s.end_time et, c.name label
  FROM class_enrollments e JOIN classes c ON c.id = e.class_id
  JOIN class_sessions s ON s.class_id = c.id AND s.status <> 'cancelled' WHERE e.status = 'booked'
  UNION ALL
  SELECT b.member_id, s.session_date, s.start_time, s.end_time, c.name
  FROM session_bookings b JOIN class_sessions s ON s.id = b.session_id AND s.status <> 'cancelled'
  JOIN classes c ON c.id = s.class_id WHERE b.status = 'booked'
)
SELECT mc.member_id, mc.label AS lop, pt.booking_date, pt.start_time AS pt_bat_dau
FROM member_class mc
JOIN coach_bookings pt ON pt.member_id = mc.member_id AND pt.status = 'confirmed'
 AND pt.booking_date = mc.d AND pt.start_time < mc.et AND pt.end_time > mc.st;

-- Sân trùng HLV 1:1
SELECT cb.member_id, cb.booking_date, cb.start_time AS san, pt.start_time AS pt
FROM court_bookings cb
JOIN coach_bookings pt ON pt.member_id = cb.member_id AND pt.status = 'confirmed'
 AND pt.booking_date = cb.booking_date AND pt.start_time < cb.end_time AND pt.end_time > cb.start_time
WHERE cb.status = 'booked';
```

Kết quả mong đợi: danh sách có thể không rỗng với dữ liệu cũ. Chỉ **báo cáo số lượng và vài ví dụ đã ẩn danh** (id, ngày, giờ). Không tự hủy lịch của hội viên.

### 2.2. Chỗ khóa học bị giữ khi chưa thanh toán ("giữ chỗ ảo")

Bản sửa thêm scheduler mỗi phút nhả chỗ: khoản trực tuyến (ví/VNPay) quá 15 phút, khoản tiền mặt khi khóa học bắt đầu.

```sql
SELECT p.id AS payment_id, p.member_id, p.method, p.amount, p.created_at,
       e.id AS enrollment_id, e.status AS enrollment_status, c.name, c.start_date
FROM payments p
JOIN class_enrollments e ON e.id = p.class_enrollment_id
JOIN classes c ON c.id = e.class_id
WHERE p.status = 'pending' AND e.status = 'booked'
ORDER BY p.created_at;
```

Kiểm chứng: sau khi API bản mới chạy ≥ 2 phút, các dòng `method <> 'cash'` quá 15 phút và các dòng `cash` có `start_date <= hôm nay` phải biến mất (enrollment `cancelled`, payment `failed`). Nếu còn: xem log API (`Released N unpaid course enrollment(s)` hoặc cảnh báo `Could not release...`).
Lưu ý: khoản VNPay mà cổng có thể còn xác nhận cần được đối soát — scheduler hiện **không** hỏi cổng VNPay cho khoản học phí (xem mục 4).

### 2.3. Hoàn học phí khi hủy khóa đã trả tiền

```sql
SELECT p.id, p.member_id, p.status, p.amount, p.refunded_amount, e.status AS enrollment_status, e.cancelled_at
FROM payments p JOIN class_enrollments e ON e.id = p.class_enrollment_id
WHERE e.status = 'cancelled' AND p.status IN ('success', 'refunded');

SELECT wt.* FROM wallet_transactions wt WHERE wt.reference_id LIKE 'COURSE_REFUND_%' ORDER BY wt.created_at DESC LIMIT 50;
```

Kỳ vọng với khóa hủy **sau** khi deploy: payment `refunded`, `refunded_amount = amount`, có một dòng `COURSE_REFUND_<id>` trong `wallet_transactions`. Khóa hủy **trước** khi deploy sẽ không có phiếu hoàn: đó là dữ liệu cũ, liệt kê ra để người phụ trách quyết định có hoàn bù không (không tự hoàn).

### 2.4. Hạn mức lượt khóa học (lỗi `my-quota` 500)

```sql
SELECT s.member_id, p.name, p.class_credit_limit, s.start_date, s.end_date,
       (SELECT count(*) FROM class_enrollments e JOIN classes c ON c.id = e.class_id
         WHERE e.member_id = s.member_id AND e.status = 'booked'
           AND c.start_date BETWEEN s.start_date AND s.end_date) AS da_dung
FROM membership_subscriptions s JOIN membership_packages p ON p.id = s.package_id
WHERE s.status = 'active' AND now()::date BETWEEN s.start_date AND s.end_date;
```

Đối chiếu: với vài hội viên mẫu (dùng tài khoản kiểm thử, không dùng tài khoản thật), `GET /api/v1/classes/my-quota` phải trả 200 và `remainingCredits = class_credit_limit - da_dung`. Lệch số → ghi lại cặp (gói, số liệu DB, số liệu API). Lưu ý cột `class_credit_limit` và cách tính "kỳ" (`PackageBenefits.cycleAnchor`) là của backend; chênh nhỏ giữa truy vấn đơn giản này và API là bình thường với gói nhiều tháng — hãy xem mã nguồn trước khi kết luận là lỗi.

### 2.5. Dữ liệu cũ vi phạm validate mới

```sql
-- SĐT sai định dạng (regex giống backend: ^(0|\+84)(3|5|7|8|9)[0-9]{8}$)
SELECT id, phone FROM users
WHERE deleted_at IS NULL AND phone IS NOT NULL AND btrim(phone) <> ''
  AND phone !~ '^(0|\+84)(3|5|7|8|9)[0-9]{8}$';

-- Tài khoản chỉ có email (không có username): trước bản sửa /auth/me, những tài khoản này bị web đăng xuất ngay
SELECT id, email, status FROM users WHERE deleted_at IS NULL AND (username IS NULL OR btrim(username) = '');

-- Đơn nghỉ phép không có ngày kết thúc
SELECT id, user_id, start_date, end_date, status FROM staff_internal_requests
WHERE request_type = 'LEAVE' AND (start_date IS NULL OR end_date IS NULL);
```

Hệ quả cần ghi nhận: hội viên có SĐT sai sẽ **không lưu được hồ sơ** cho tới khi sửa SĐT (API trả 400). Báo số lượng, không sửa hàng loạt.

### 2.6. Dữ liệu điểm danh của HLV (xem thêm mục 3)

```sql
SELECT sa.session_id, s.session_date, c.name, sa.status, count(*) AS so_hoc_vien
FROM session_attendance sa
JOIN class_sessions s ON s.id = sa.session_id
JOIN classes c ON c.id = s.class_id
GROUP BY 1,2,3,4 ORDER BY s.session_date DESC LIMIT 100;
```

## 3. Lịch sử điểm danh của HLV — đọc kỹ

- Trang `/staff/attendance` có hai tab "Lịch sử điểm danh (n)" và "Lịch sử đánh giá (n)". Số `n` và nội dung **được lưu trong `localStorage` của trình duyệt** (`CoachAttendancePage.tsx`, khóa `STORAGE_KEY_HISTORY` / `STORAGE_KEY_EVAL_HISTORY`), **không đọc từ database**.
- Hệ quả: đổi trình duyệt/máy, xóa dữ liệu trình duyệt hoặc dùng chế độ ẩn danh sẽ thấy `(0)` dù điểm danh đã lưu thành công ở server (`session_attendance`). Trong e2e, ta thấy bộ đếm là 0 sau khi lưu — đây là lý do hợp lý nhất, nhưng **chưa được xác nhận bằng cách quan sát localStorage** trong cùng phiên.
- Cần kiểm chứng trên VPS:
  1. Điểm danh thật được ghi vào `session_attendance` (truy vấn 2.6) với đúng `member_id`, `status` (`present/absent/...`), `recorded_by` là user HLV.
  2. Tab lịch sử chỉ phản ánh dữ liệu của chính trình duyệt đó. Không dùng nó làm bằng chứng "điểm danh đã mất".
  3. Đừng kết luận có lỗi mất dữ liệu nếu `session_attendance` đầy đủ nhưng tab lịch sử trống.
- Đề xuất (chưa làm, cần người phụ trách quyết định): đọc lịch sử từ server (API) thay vì `localStorage`.
- Cùng trang: giao diện chọn buổi mặc định theo ngày hiện tại; test e2e phụ thuộc ngày nên đã được rào lại bằng `test.skip` khi buổi không có học viên. Đừng coi "0 học viên" là lỗi nếu buổi là buổi quá khứ hoặc hội viên đã bảo lưu (bảo lưu tự hủy các lịch lớp tương lai).

## 4. Những gì CHƯA được kiểm chứng (đừng ghi là đã xong)

| Hạng mục | Tình trạng | Cách kiểm chứng gợi ý trên VPS |
|---|---|---|
| Test Java (`mvn test`) | Chưa chạy. Các sửa backend chỉ được biên dịch trong Docker và kiểm tra qua e2e | Chạy `mvn test` trên máy có Java 21 hoặc trong container maven; ghi lại test đỏ |
| Scheduler nhả chỗ khóa học | Chỉ đọc code, chưa chờ đủ 15 phút / tới ngày khóa bắt đầu trong e2e | Mục 2.2 sau khi deploy |
| Khoản học phí VNPay thật | Scheduler không hỏi cổng VNPay (khác đặt sân có `vnpayGuard`); có thể hủy chỗ của khoản VNPay đang chờ cổng xác nhận | Đối chiếu `vnpay_transactions` với payment `pending` bị scheduler đánh `failed` |
| Hoàn học phí cho khoản **tiền mặt** | Hiện hoàn về **ví SÖL**, không phải tiền mặt. Chưa có quyết định nghiệp vụ | Hỏi người phụ trách chính sách |
| Hoàn học phí qua VNPay | Chưa kiểm chứng; code hoàn về ví, không gọi cổng | Như trên |
| Trùng lịch khi nhiều request đồng thời (race) | `MemberScheduleGuard` kiểm tra trong giao dịch nhưng chưa có khóa/ràng buộc DB cho quan hệ lớp-sân-HLV; chưa có test đồng thời | Gửi hai request song song bằng tài khoản kiểm thử; DB trigger hiện chỉ bảo vệ capacity/lớp |
| Lớp mới do quản lý thêm buổi/chuyển giờ | Kiểm tra trùng với sân/HLV của hội viên **chưa** áp dụng khi quản lý tạo/sửa buổi (chỉ khi hội viên đăng ký/đặt) | Xem `ClassService.ensureNoMemberOverlap`; đối chiếu bằng truy vấn 2.1 |
| Hội viên hết hạn đặt sân | Server từ chối đúng (không có booking); **chưa xác nhận** giao diện có hiện lỗi rõ cho người dùng hay không | Đăng nhập tài khoản kiểm thử hết hạn, đặt sân, chụp màn hình |
| Hủy bảo lưu không cần lý do | Lễ tân từ chối bảo lưu giờ có hộp xác nhận nhưng vẫn không có ô lý do; hội viên không biết vì sao | Quyết định nghiệp vụ |
| Môi trường VPS: SMTP/OTP thật, Google OAuth, Supabase Realtime, AI provider, VNPay | e2e tắt hoặc dùng debug OTP; chưa chạy với cấu hình thật | Kiểm tra từng chức năng thủ công bằng tài khoản kiểm thử |
| Camera quét QR, PWA, thiết bị di động thật | e2e chỉ giả lập khung 375px, không có camera | Thử trên điện thoại thật qua HTTPS |
| Hiệu năng/tải | Chưa đo | Không thuộc phạm vi tài liệu này |
| Thông báo lỗi native của trình duyệt (form nhân sự, hồ sơ) | Hiển thị tiếng Anh theo ngôn ngữ trình duyệt, không do app dịch | Chấp nhận hoặc thay bằng validate của app |

## 5. Định dạng báo cáo

Trả lại một bảng: mục → kết quả (số liệu cụ thể, ẩn danh) → trạng thái (`Đã xác nhận` / `Không đạt` / `Chưa xác nhận`) → ghi chú.
Với mọi dòng `Không đạt`, đính kèm câu truy vấn đã chạy và 3–5 ví dụ (id, ngày, giờ). Không đính kèm thông tin cá nhân (tên, SĐT, email).
