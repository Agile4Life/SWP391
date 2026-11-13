# Nghiệp vụ gói tập và điểm danh

Tài liệu tổng hợp quy tắc nghiệp vụ **đang được cài đặt trong code** (`apps/api`) cho hai mảng: gói tập (membership) và điểm danh (check-in cổng + điểm danh buổi học + buổi 1:1). Khi code đổi, cập nhật tài liệu này cùng PR.

Nguồn đối chiếu: `membership/service/*`, `facilities/PackageBenefits.java`, `attendance/service/*`, `coaching/service/PtAttendanceService.java`. Tài liệu gốc `docs/PROJECT_MASTER_GUIDE.md` mô tả bản đầu; nếu khác với file này thì code và file này là chuẩn.

---

## 1. Gói tập

### 1.1 Danh mục gói (`membership_packages`)

| Trường | Ý nghĩa |
|---|---|
| `name`, `description` | Tên và mô tả hiển thị |
| `price` | Giá niêm yết hiện tại (có thể đổi bất cứ lúc nào) |
| `duration_days` | Số ngày hiệu lực |
| `class_credit_limit` | Hạn mức số buổi/khóa học |
| `tier` | `SILVER`, `GOLD`, `PLATINUM`; nếu trống, suy ra từ tên gói |
| `status` | `active` hoặc `inactive`; **chỉ gói `active` mới mua được** |

Chỉ Quản lý cấu hình danh mục gói.

### 1.2 Quyền lợi theo hạng (nguồn duy nhất: `PackageBenefits`)

Mọi quyền lợi suy ra từ **hạng gói + thời hạn**, không kiểm tra theo tên gói rải rác trong code.

**Chu kỳ quyền lợi** = 30 ngày tính từ `start_date` của subscription. Buổi PT, lượt đặt sân và các quyền lợi "theo tháng" reset theo chu kỳ này.

| Quyền lợi | Silver | Gold | Platinum | Trải nghiệm (≤ 3 ngày) |
|---|---|---|---|---|
| Khóa nhóm miễn phí (mỗi chu kỳ) | 1 | 2 | 4 | 0 |
| Buổi PT 1:1 miễn phí / chu kỳ | 0 | 3 | 6 | 1 |
| Lượt đặt sân gồm trong gói / chu kỳ | 1 | 2 | 3 | 0 |
| Đặt sân trước tối đa (ngày) | 7 | 14 | 30 | 3 |
| Lượt đặt sân chưa diễn ra cùng lúc (đã trả hoặc chưa) | 3 | 5 | 8 | 1 |
| Lượt đặt sân chưa thanh toán cùng lúc | 1 | 2 | 3 | 1 |
| Giảm giá PT thêm, phí khóa, sản phẩm shop | 0% | 10% | 20% | 0% |
| Phòng VIP | không | không | có | không |
| Đánh giá chuyên sâu (Body Fat, Muscle Mass) | không | không | có | không |
| Đánh giá định kỳ hằng tháng | chỉ lần đầu | có | có | như Gold |
| Xem giáo án HLV soạn | không | có | có | như Gold |

**Quy định đặt sân** (nguồn duy nhất `PackageBenefits.courtAdvanceDays/courtMaxUpcoming/courtMaxUnpaidHolds`, backend kiểm tra, màn Đặt sân hiển thị qua `GET /court-bookings/quota`):
- Lượt nằm trong quyền lợi gói (`package_quota`) miễn phí; lượt thêm tính phí theo giờ, thanh toán VNPay hoặc tiền mặt tại quầy.
- Vượt giới hạn đặt trước → `COURT_BOOKING_TOO_FAR` (400); vượt số lượt chưa diễn ra → `COURT_BOOKING_UPCOMING_LIMIT` (409); vượt số lượt chưa thanh toán → `COURT_BOOKING_UNPAID_LIMIT` (409). Đặt định kỳ bỏ qua từng ngày vượt giới hạn và ghi lý do vào `skipped`.
- Chống giữ chỗ không thanh toán: lượt VNPay chưa trả tự hủy sau thời gian chờ của cổng (15 phút + 1); lượt tiền mặt chưa thu tự hủy **2 giờ trước giờ bắt đầu** (`app.courts.cash-release-lead-minutes`), nhưng được giữ tối thiểu **30 phút** kể từ lúc đặt (`app.courts.cash-min-hold-minutes`). Job chạy mỗi phút (`CourtBookingExpiryScheduler`).
- Hủy: hội viên hủy trước giờ bắt đầu ít nhất 2 giờ; lễ tân/quản lý hủy mọi lượt chưa bắt đầu.

- Gói 3 tháng nhận số khóa miễn phí **gấp ba** gói 1 tháng (`credits = base × số chu kỳ`).
- Gói trải nghiệm được coi là hạng Gold khi hiển thị dịch vụ.
- Gói trải nghiệm nhận diện qua tên (có "TRẢI NGHIỆM"/"TRIAL") hoặc `duration_days` ≤ 3.

### 1.3 Vòng đời subscription (`membership_subscriptions.status`)

```
pending_payment ──(thanh toán thành công)──▶ active ──(hết end_date)──▶ expired
       │                                      │  ▲
       └──(hủy / thất bại)──▶ cancelled       │  └──(hết bảo lưu)──┐
                                              └──(bảo lưu bắt đầu)─▶ frozen
                              active ──(duyệt hủy gói)──▶ cancelled
```

Trạng thái hợp lệ: `pending_payment`, `active`, `frozen`, `expired`, `cancelled`.

Thông tin kèm theo mỗi subscription:
- `start_date`, `end_date` (cả hai tính trọn ngày; `end_date = start_date + duration_days − 1`).
- `qr_code` duy nhất, sinh khi kích hoạt, dùng cho check-in.
- `previous_subscription_id`: chuỗi gia hạn/nâng cấp.
- `quoted_price`, `upgrade_charge`, `credit_applied`: **giá chốt** lúc tạo yêu cầu (xem 1.7).

### 1.4 Mua gói mới

Hội viên tạo yêu cầu → subscription ở `pending_payment`, bắt đầu **hôm nay**. Bị từ chối (409/400) khi:

1. Gói đã `inactive`.
2. Hội viên đang có gói `frozen` (`MEMBERSHIP_FROZEN_EXISTS`).
3. Hội viên đã có gói `active` còn hạn (`MEMBERSHIP_ALREADY_ACTIVE`).
4. Hội viên đã có một yêu cầu `pending_payment` (`MEMBERSHIP_PENDING_EXISTS`).
5. Chưa xác minh danh tính (KYC) và đây là gói đầu tiên (`MEMBERSHIP_KYC_REQUIRED`). Đã được duyệt gói trải nghiệm (hoặc đã có gói trước đó) thì được bỏ qua.

Hội viên (chủ sở hữu), Lễ tân hoặc Quản lý được hủy yêu cầu `pending_payment` khi chưa thanh toán; nếu còn giao dịch chưa đối soát thì từ chối (`MEMBERSHIP_CANCEL_PAYMENT_UNSETTLED`).

### 1.5 Gia hạn

- Tạo subscription mới ở `pending_payment`, liên kết `previous_subscription_id`.
- Gói cũ **còn hạn**: `start_date` mới = `end_date` cũ + 1 ngày (không mất ngày đã mua).
- Gói cũ **đã hết hạn**: bắt đầu từ hôm nay.
- Không gia hạn khi gói đang chờ bảo lưu, đã có yêu cầu gia hạn chờ thanh toán, hoặc đã có gia hạn tương lai đã trả tiền.
- Lễ tân có thể gia hạn thay hội viên.

### 1.6 Nâng cấp

- Chỉ nâng cấp gói đang `active` và lên gói **cao hơn**. Ngoại lệ: gói trải nghiệm được nâng lên bất kỳ gói trả phí nào.
- Không nâng cấp khi đang có yêu cầu bảo lưu chờ duyệt hoặc đang có subscription chờ thanh toán.
- Gói mới bắt đầu **từ hôm nay**; phần giá trị chưa dùng của gói cũ được quy đổi:
  - `credit` = giá trị thực trả cho kỳ hiện tại × số ngày còn lại / tổng số ngày, **làm tròn xuống nghìn đồng**. Ngày hôm nay vẫn tính là chưa dùng.
  - `upgrade_charge = giá gói mới − credit`. Nếu ≤ 0 thì từ chối (`MEMBERSHIP_UPGRADE_CREDIT_EXCEEDS`).
- Giá trị tính từ **tiền hội viên thực trả** (payment `success` trừ phần đã hoàn, cộng credit từ kỳ trước), không bao giờ từ giá niêm yết hiện tại.

### 1.7 Giá chốt

Số tiền phải thu là giá **lúc tạo yêu cầu** (`upgrade_charge` hoặc `quoted_price`). Quản lý đổi giá gói sau đó không làm đổi số tiền hội viên đã được báo. Chỉ yêu cầu cũ chưa có giá chốt mới rơi về giá gói hiện tại (`payableAmount()`).

### 1.8 Bảo lưu (hold)

**Điều kiện được bảo lưu** (theo `PackageBenefits.holdMaxDays`):

| Gói | Bảo lưu tối đa |
|---|---|
| Silver / Gold 1 tháng | Không được |
| Platinum 1 tháng | 7 ngày |
| Dài hạn (≥ 60 ngày): Silver / Gold / Platinum | 7 / 15 / 30 ngày |
| Trải nghiệm | Không được |

**Quy tắc yêu cầu:**
- Mỗi gói chỉ được bảo lưu **một lần** (`hold_used`, đặt khi duyệt, không xóa).
- Nộp trước ngày bắt đầu ít nhất **24 giờ**; kéo dài từ **3 ngày** đến hạn mức của gói; nằm trong thời hạn gói.
- Bắt buộc đính kèm giấy tờ y tế: tối đa 5 tệp, mỗi tệp tối đa 5 MB.
- Hội viên được rút yêu cầu khi chưa được quyết định.

**Xử lý:** Lễ tân duyệt hoặc từ chối. Khi duyệt:
- Các lịch lớp/buổi đã đặt trong khoảng bảo lưu bị hủy ngay, chỗ được giải phóng.
- Các buổi khóa học trong khoảng đó được đánh dấu `excused` để **không tính là vắng** (xem 2.5).
- Job hằng ngày (00:15) đóng băng gói sang `frozen` vào ngày đầu của kỳ bảo lưu và tự khôi phục vào ngày sau ngày cuối. Hết bảo lưu thì `end_date` được cộng thêm đúng số ngày đã bảo lưu (tối đa 90 ngày, `MAX_HOLD_DAYS`).
- Hội viên cũng có thể chủ động `resume` sớm.

### 1.9 Hủy gói và hoàn tiền

- Hội viên gửi yêu cầu hủy gói đang hiệu lực; Lễ tân/Quản lý duyệt hoặc từ chối.
- Tiền hoàn **gợi ý** = phần chưa dùng của số tiền hội viên thực trả cho kỳ đó (gồm phần credit mang từ gói nâng cấp), không theo giá niêm yết hiện tại. Quản lý được ghi đè số tiền.
- Hoàn tiền vào ví hội viên; số tiền 0 thì gửi thông báo "duyệt hủy, không hoàn".

### 1.10 Gói trải nghiệm

- Thời hạn **3 ngày** (`TRIAL_DAYS`), mỗi hội viên có một yêu cầu trải nghiệm.
- Cần xác minh danh tính (CCCD được băm bằng `CccdHasher`, không lưu bản rõ); Lễ tân duyệt hoặc từ chối.
- Được duyệt thì coi như đã KYC để mua gói tiếp theo.

### 1.11 Việc chạy nền

| Việc | Lịch | Hành vi |
|---|---|---|
| `MembershipLifecycleScheduler.runDaily` | 00:15 hằng ngày (`app.membership.lifecycle.cron`) | Bắt đầu bảo lưu đến hạn, kết thúc bảo lưu hết hạn, giải phóng lịch lớp/1:1/sân đặt cho ngày **không còn gói active nào bao phủ** |
| Cảnh báo sắp hết hạn | Trước 7 ngày | Gửi thông báo `package_expiry` |

Mỗi mục chạy transaction riêng; một mục lỗi chỉ ghi log, các mục còn lại vẫn chạy.

---

## 2. Điểm danh

Có ba lớp, từ cổng trung tâm đến từng buổi.

### 2.1 Check-in cổng trung tâm (`center_checkins`)

**Hai cách vào:**

1. **Nhân viên quét QR của hội viên** (`scan`): chỉ `RECEPTIONIST`, `CENTER_MANAGER`, `ADMIN`; Member nhận 403.
   - QR **động** `DYN:{userId}:{subscriptionId}:{timestamp}:{HMAC-SHA256}`, sống **60 giây**, lệch đồng hồ cho phép 15 giây; hoặc QR tĩnh tra theo `qr_code`.
2. **Hội viên tự quét QR của cổng** (`selfScan`): QR cổng `SOL:GATE:1:...` cũng sống 60 giây, dùng chữ ký riêng, tách biệt với QR hội viên. Hội viên cần có gói `active` có hiệu lực hôm nay.

**Điều kiện cho phép vào (`GRANTED`)** — kiểm tra theo thứ tự, vi phạm thì ghi `DENIED` kèm lý do:

| # | Điều kiện | Mã lý do |
|---|---|---|
| 1 | QR hợp lệ và chưa hết hạn | `qr_invalid` / `qr_expired` / `gate_qr_*` |
| 2 | Tìm thấy hội viên | `member_not_found` |
| 3 | Tài khoản `active`, chưa xóa mềm (`deleted_at` rỗng) | `member_inactive` |
| 4 | Subscription `active` và đã đến `start_date` | `subscription_not_active` |
| 5 | Chưa quá `end_date` | `subscription_expired` |
| 6 | Không đang ở trong phòng tập chưa check-out (anti-passback) | `already_checked_in` |

- **Mọi lượt quét** (cả `GRANTED` và `DENIED`) đều ghi một bản ghi với giờ máy chủ để đối soát.
- Khóa hàng hội viên khi kiểm tra để hai thiết bị quét cùng lúc không qua được anti-passback.
- Gói `frozen`, `pending_payment`, `cancelled`, `expired` đều bị từ chối.

### 2.2 Check-out

- Nhân viên check-out một lượt vào; hội viên tự check-out bằng cách quét QR cổng.
- Không check-out bản ghi `DENIED` hoặc bản ghi đã có giờ ra.
- **Tự đóng phiên treo:** lượt `GRANTED` chưa check-out quá **8 giờ** bị đóng tự động với ghi chú `SYSTEM_AUTO_CHECKOUT` (giờ ra = giờ vào + 4 giờ, hoặc hiện tại nếu sớm hơn). Chạy lúc hội viên quét lại và bằng job 03:00 hằng ngày.

### 2.3 Lịch sử và chuỗi ngày tập

- Nhân viên xem toàn bộ lượt ra vào; hội viên chỉ xem của mình. Mặc định hôm nay, khoảng tra cứu tối đa 31 ngày.
- Chuỗi ngày tập (streak) của hội viên tính từ các ngày có lượt `GRANTED`: chuỗi hiện tại, chuỗi dài nhất, và lịch 12 tuần gần nhất.

### 2.4 Điểm danh buổi học (`session_attendance`)

Trạng thái: `present`, `late`, `absent`, `excused`. Mỗi cặp (buổi, hội viên) **chỉ một dòng**.

**Danh sách lớp** gồm hội viên đăng ký cả khóa và hội viên đặt riêng buổi đó (`booked`).

**HLV hoặc nhân viên điểm danh hàng loạt:**
- HLV chỉ điểm danh buổi của lớp mình phụ trách; nhân viên/quản lý điểm danh thay và ghi theo HLV của lớp.
- Không điểm danh buổi đã hủy, cũng không điểm danh buổi **chưa bắt đầu**.
- Chỉ điểm danh hội viên đang có chỗ ở lớp (hoặc đã hoàn thành).
- `present`/`late` lưu giờ có mặt; trạng thái khác xóa giờ có mặt.
- Có thể gửi kèm đánh giá tiến độ cho học viên; công bố thì hội viên nhận thông báo.

**Tự động khi quét cổng:** khi hội viên vào trung tâm, hệ thống đánh dấu các buổi **hôm nay** của khóa họ đã đặt nếu giờ quét nằm trong khoảng từ **30 phút trước giờ bắt đầu** đến giờ kết thúc:
- quét muộn hơn **15 phút** sau giờ bắt đầu → `late`;
- còn lại → `present`.
- Buổi HLV đã ghi tay thì không bị ghi đè. Ghi chú tự động: `auto: gate scan`.

### 2.5 Vắng mặt và quy tắc 50%

Job quét mỗi **30 phút**, nhìn lại 7 ngày:

1. Buổi đã kết thúc, hội viên có chỗ nhưng chưa có dòng điểm danh nào:
   - Có lượt vào trung tâm bắt đầu trong **3 giờ trước** buổi và vẫn ở lại qua buổi → `present` (`auto: visit covered the session`).
   - Ngược lại → `absent` (`auto: not attended`).
   - Hội viên đăng ký sau ngày của buổi đó thì không bị tính vắng.
2. Trong khoảng bảo lưu đã duyệt → `excused`, không tính vắng.
3. **Quy tắc 50%:** vắng **hơn một nửa** số buổi chưa hủy của khóa (`vắng × 2 > tổng`) thì bị **khóa đăng ký khóa mới 30 ngày** (`course_enroll_blocked_until`) và nhận thông báo hệ thống. Đi muộn tính là có mặt.

### 2.6 Buổi PT 1:1

- Quét cổng từ **30 phút trước** giờ bắt đầu đến giờ kết thúc → đánh dấu `attended_at` cho buổi 1:1 chưa ghi nhận trong ngày.
- Job quét lúc phút 5 và 35 mỗi giờ, nhìn lại 3 ngày: buổi đã kết thúc mà chưa có mặt, nếu hội viên vào trung tâm trong 3 giờ trước và ở lại qua buổi → ghi nhận có mặt.
- Buổi đã kết thúc không có mặt là **no-show**: vẫn trừ vào hạn mức, **không có buổi bù** (xem 1.2 cho hạn mức/chu kỳ).
- Huấn luyện viên, lễ tân và quản lý có thể đánh dấu tay đã tham dự trên màn hình điểm danh 1:1.
- Đánh dấu tay chỉ từ giờ bắt đầu trở đi; code hiện tại cho phép sửa buổi đã kết thúc. Bỏ đánh dấu xóa `attended_at`, đặt `attendance_locked=true`, giữ nguyên trạng thái booking và lịch sử cổng; đánh dấu tay lại sẽ mở khóa. DTO trả `attendanceLocked` để phân biệt đã bỏ ghi nhận với chưa ghi nhận.
- Bộ lọc điểm danh dùng Asia/Ho_Chi_Minh: Đã có mặt có `attendedAt`; Không có mặt là buổi đã kết thúc không có `attendedAt` (kết quả suy ra, không ghi ABSENT); Sắp diễn ra là buổi chưa bắt đầu không có `attendedAt`. Buổi đang diễn ra chưa có dấu có mặt chỉ nằm trong Tất cả, có nhãn riêng. Buổi đã hủy không nằm trong danh sách/số lượng.
- Cập nhật 13/11/2026 sau khi Leader duyệt: Entity và migration tường minh `AuditEntityTypeSchemaUpgrade` cho phép `coach_bookings`; migration chạy qua PostgreSQL provider, giữ nguyên predicate CHECK cũ và mọi log lịch sử. Đã kiểm thử transaction/migration trên PostgreSQL isolated; chưa áp dụng database chung. Trigger vẫn kiểm tra gói active với booking `confirmed` lịch sử; xem `docs/qa/2026-11-13-pt-attendance-audit-migration.md` trước khi triển khai.

### 2.7 Lỗi quét không làm hỏng check-in

Việc đánh dấu buổi khóa học và buổi 1:1 chạy sau khi lượt `GRANTED` đã lưu. Nếu bước đó lỗi, hệ thống chỉ ghi log cảnh báo và **không hủy** lượt vào cổng.

---

## 3. Bất biến cần giữ

- Chỉ hội viên có subscription `active` và còn hạn mới vào cổng hoặc đặt lịch.
- Trigger CSDL kiểm tra gói còn hạn, sĩ số và trùng lịch là bắt buộc; lỗi SQL phải được ánh xạ thành lỗi HTTP dễ hiểu.
- `users.deleted_at IS NOT NULL` không được vào cổng.
- Backend luôn tự kiểm tra role; ẩn menu ở frontend không phải là phân quyền.
- Thông báo/mã lỗi mới phải có đủ key trong `messages_vi.properties` và `messages_en.properties`.
- Tiền hoàn và credit nâng cấp luôn tính từ tiền thực trả, không từ giá niêm yết hiện tại.

## 4. Chưa xác minh trong lần viết này

Các điểm dưới đây lấy từ tài liệu gốc hoặc comment, chưa đọc hết code tương ứng; kiểm tra trước khi dựa vào:
- Bước chuyển `pending_payment → active` và thời điểm sinh `qr_code` (nằm ở module thanh toán/tài chính).
- Job gửi thông báo `package_expiry` trước 7 ngày.
- Quy tắc từ chối yêu cầu hủy gói và giới hạn ghi đè số tiền hoàn.
