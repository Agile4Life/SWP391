# Nghiệp vụ SÖL Fitness — các luồng chính đang chạy trên web

> Cập nhật: 19/11/2026, theo code nhánh `fix/business-rules-audit`.
> `docs/PROJECT_MASTER_GUIDE.md` là thiết kế gốc. Tài liệu này mô tả **những gì hệ thống đang làm thật**: màn hình, API, quy tắc và state machine. Phần nào khác thiết kế gốc được ghi ở mục 12.
> Múi giờ nghiệp vụ là `Asia/Ho_Chi_Minh` cho mọi mốc "hôm nay", "trước giờ học" và job định kỳ.

## Mục lục
1. [Vai trò và phân quyền](#1-vai-trò-và-phân-quyền)
2. [Flow 1 — Tài khoản, gói tập, dùng thử, bảo lưu, hủy gói](#2-flow-1--tài-khoản-gói-tập-dùng-thử-bảo-lưu-hủy-gói)
3. [Flow 2 — Lớp học, khóa học, đặt buổi, điểm danh](#3-flow-2--lớp-học-khóa-học-đặt-buổi-điểm-danh)
4. [Flow 3 — Thanh toán, Ví, hóa đơn, hoàn tiền, báo cáo](#4-flow-3--thanh-toán-ví-hóa-đơn-hoàn-tiền-báo-cáo)
5. [Flow 4 — Quản trị và cấu hình](#5-flow-4--quản-trị-và-cấu-hình)
6. [Flow 5 — HLV: PT 1:1, giáo án, đánh giá, AI](#6-flow-5--hlv-pt-11-giáo-án-đánh-giá-ai)
7. [Flow 6 — Trợ lý AI, thông báo, chat, hỗ trợ](#7-flow-6--trợ-lý-ai-thông-báo-chat-hỗ-trợ)
8. [Luồng mở rộng — Check-in trung tâm](#8-luồng-mở-rộng--check-in-trung-tâm)
9. [Luồng mở rộng — Đặt sân](#9-luồng-mở-rộng--đặt-sân)
10. [Luồng mở rộng — Cửa hàng thực phẩm bổ sung](#10-luồng-mở-rộng--cửa-hàng-thực-phẩm-bổ-sung)
11. [Job định kỳ và ràng buộc database](#11-job-định-kỳ-và-ràng-buộc-database)
12. [Khác biệt so với thiết kế gốc](#12-khác-biệt-so-với-thiết-kế-gốc)

---

## 1. Vai trò và phân quyền

| Vai trò | Mã role | Khu vực web chính |
|---|---|---|
| Khách vãng lai | — | `/`, `/swimming`, `/tennis`, `/boxing`, `/badminton`, `/yoga`, `/sports/:id`, `/trainers`, `/products`, `/login`, `/register` |
| Hội viên | `MEMBER` | `/member/*`, `/messages`, `/checkout` |
| Huấn luyện viên | `COACH` | `/coach/*`, `/staff/attendance`, `/staff/coach-classes`, `/staff/requests` |
| Lễ tân | `RECEPTIONIST` (`STAFF`) | `/staff/reception`, `/staff/check-in`, `/staff/check-out`, `/staff/kyc`, `/staff/holds`, `/staff/courts`, `/staff/orders`, `/staff/classes`, `/staff/pt-attendance` |
| Quản lý trung tâm | `CENTER_MANAGER` (`MANAGER`) | `/manager/*`, `/staff/classes`, `/staff/orders`, `/staff/pt-attendance` |
| Quản trị hệ thống | `ADMIN` | `/admin/users`, `/admin/audit-logs`, `/admin/payments` |

- Frontend chặn route bằng `RoleGuard`. Backend vẫn tự kiểm tra role qua `SecurityConfig` và `@PreAuthorize`. Ẩn menu không phải là phân quyền.
- JWT chỉ được chấp nhận khi user còn `active` và `deleted_at IS NULL`. Khóa tài khoản thì token cũ mất hiệu lực ngay ở request kế tiếp.
- Mọi thông báo và lỗi của API đi qua i18n (`Accept-Language`, mặc định `vi`).

---

## 2. Flow 1 — Tài khoản, gói tập, dùng thử, bảo lưu, hủy gói

### 2.1 Đăng ký và đăng nhập
**Màn hình:** `/register`, `/login`, OTP. **API:** `/api/v1/auth`.

1. Đăng ký bằng email và mật khẩu, hoặc bằng Google. Tài khoản mới ở trạng thái `inactive` (chờ xác thực).
2. Nhập OTP gửi qua email đúng thì tài khoản chuyển sang `active` và được đăng nhập.
3. Chỉ `MEMBER`, `COACH`, `RECEPTIONIST` được đăng nhập bằng Google/OTP. Quản lý và Admin dùng mật khẩu.
4. Tài khoản `locked` hoặc đã xóa mềm không đăng nhập được bằng bất kỳ cách nào.
5. **Quy tắc mật khẩu** (đăng ký, quên mật khẩu, đổi mật khẩu, quản lý tạo tài khoản): 8–50 ký tự, có ít nhất 1 chữ cái và 1 chữ số, không khoảng trắng (`PasswordPolicy.REGEX` = `^(?=.*[A-Za-z])(?=.*\d)\S{8,50}$`, frontend dùng chung `PASSWORD_REGEX`). Đăng nhập vẫn nhận mật khẩu cũ không đạt quy tắc này.

**State `users.status`:** `inactive` (chờ OTP) → `active` ⇄ `locked` (Quản lý/Admin khóa, mở). Xóa mềm đặt `deleted_at`; user đã xóa không hiện trong danh sách mặc định.

### 2.2 Mua gói, gia hạn, nâng cấp
**Màn hình:** `/member/packages`, `/member/packages/checkout`, `/member/card`; lễ tân ở `/staff/reception`. **API:** `/api/v1/packages`, `/api/v1/memberships/subscriptions`, `/api/v1/payments`, `/api/v1/payments/vnpay`.

- **Hạng gói:** SILVER, GOLD, PLATINUM, gói 1 tháng hoặc dài hạn (3 tháng). Quyền lợi tính theo chu kỳ 30 ngày từ ngày bắt đầu (`PackageBenefits`):

| Quyền lợi mỗi chu kỳ | Silver | Gold | Platinum | Dùng thử |
|---|---|---|---|---|
| Khóa học nhóm miễn phí (gói 1 tháng; gói 3 tháng ×3) | 1 | 2 | 4 | 0 |
| Buổi PT 1:1 miễn phí | 0 | 3 | 6 | 1 |
| Lượt đặt sân kèm gói | 1 | 2 | 3 | 0 |
| Đặt sân trước tối đa | 7 ngày | 14 ngày | 30 ngày | 3 ngày |
| Giảm giá PT thêm, học phí, cửa hàng | — | 10% | 20% | — |
| Phòng Gym VIP | — | — | Có | — |
| Bảo lưu tối đa (gói dài hạn / gói 1 tháng) | 7 / 0 | 15 / 0 | 30 / 7 ngày | 0 |

- **Mua mới:** tạo `membership_subscriptions` ở `pending_payment`. Thanh toán thành công (VNPay, Ví, hoặc lễ tân xác nhận tiền mặt/POS) thì gói chuyển sang `active`, phát hành hóa đơn, cấp thẻ QR.
- **Gia hạn:** tạo kỳ mới liên kết `previous_subscription_id`. Kỳ cũ còn hạn thì kỳ mới bắt đầu ngay sau ngày hết hạn cũ, không mất ngày.
- **Nâng cấp:** giá trị còn lại của kỳ cũ (tính theo **tiền đã trả thật**, không theo giá niêm yết hiện tại, làm tròn xuống nghìn đồng) được trừ vào giá gói mới. Kỳ cũ chuyển `expired` ở ngày nâng cấp. Hoàn tiền toàn bộ kỳ nâng cấp thì kỳ cũ được khôi phục.
- **Hủy đơn chưa trả:** hội viên hoặc lễ tân hủy kỳ `pending_payment`.

**State `membership_subscriptions.status`:** `pending_payment` → `active` → `frozen` (đang bảo lưu) → `active`; `pending_payment`/`active` → `cancelled`; nâng cấp làm kỳ cũ `expired`. Hết hạn được xác định theo `end_date < hôm nay`; kỳ quá hạn không tự đổi chữ `active` thành `expired`, nhưng mọi kiểm tra quyền đều dựa vào ngày.

### 2.3 Dùng thử 3 ngày
**Màn hình:** `/member/dashboard` (gửi yêu cầu), `/staff/kyc` (lễ tân duyệt). **API:** `/api/v1/memberships/trial`, `/api/v1/members/kyc`.

1. Hội viên gửi CCCD hoặc hộ chiếu (số giấy tờ, quốc tịch, ảnh hai mặt).
2. Lễ tân duyệt thì cấp gói dùng thử 3 ngày hưởng quyền lợi Gold (trừ Platinum). Từ chối thì ghi lý do.
3. Mỗi tài khoản chỉ được dùng thử một lần. Số giấy tờ được lưu dạng băm.

### 2.4 Bảo lưu gói
**Màn hình:** `/member/hold`, `/staff/holds`. **API:** `/api/v1/memberships/subscriptions/{id}/hold` (+ `/approve`, `/reject`, `/withdraw`, `/policy`), `/holds`, `/holds/pending`.

- Điều kiện: gói cho phép bảo lưu và chưa dùng lượt bảo lưu duy nhất. Gửi trước ngày bắt đầu ít nhất **24 giờ**. Thời lượng từ **3 ngày** tới mức tối đa của gói. Giấy tờ (ví dụ giấy tờ y tế) không bắt buộc; nếu đính kèm thì tối đa 5 tệp, mỗi tệp 5 MB.
- Lễ tân duyệt hoặc từ chối. Hội viên rút yêu cầu khi chưa duyệt; lễ tân rút giúp khi chưa tới ngày bắt đầu.
- Khi duyệt (hoàn/mất được quyết định ngay lúc duyệt):
  - **PT 1:1 và đặt sân** có ngày nằm trong khoảng bảo lưu bị hủy. PT đặt bằng lượt gói được trả lại lượt; PT trả tiền mặt/chuyển khoản và đặt sân **không** tự hoàn tiền. Lịch ngoài khoảng bảo lưu giữ nguyên.
  - **Khóa học** còn buổi chưa diễn ra trong khoảng bảo lưu bị **hủy đăng ký** (không giữ chỗ). Duyệt trước ngày khóa bắt đầu **≥ 3 ngày**: khóa miễn phí được trả lượt, khóa có phí được hoàn 100% vào Ví. Muộn hơn hoặc khóa đã bắt đầu: mất lượt (vẫn tính vào chu kỳ) hoặc mất học phí. Học phí đang chờ thanh toán thì payment chuyển `failed`.
  - Hội viên nhận thông báo cho từng khóa (hoàn lượt / mất lượt / hoàn phí / mất phí). Lịch đã hủy không tự khôi phục kể cả khi rút bảo lưu chưa bắt đầu.
- Tới ngày bắt đầu, gói chuyển `frozen`. Hết hạn bảo lưu (hoặc chạm trần **90 ngày**), gói tự `active` lại và được cộng bù số ngày đã giữ. Ngày bảo lưu không bị tính vào chu kỳ quyền lợi.

### 2.5 Hủy gói và hoàn tiền
**Màn hình:** `/member/packages` (yêu cầu), `/staff/reception` (lễ tân trình), `/manager/cancellations` (duyệt). **API:** `/api/v1/memberships/cancellations`.

1. Hội viên hoặc lễ tân gửi yêu cầu kèm lý do. Hệ thống gợi ý số hoàn bằng phần chưa dùng của **số tiền đã trả** cho kỳ đó.
2. Chỉ Quản lý duyệt. Quản lý được sửa số hoàn nhưng **không vượt số đã trả** cho kỳ (tiền mặt + phần quy đổi từ gói trước).
3. Duyệt thì: gói và các kỳ chờ/bảo lưu liên quan chuyển `cancelled`, các lịch không còn được gói bao phủ bị hủy, tiền hoàn vào **Ví**, và **payment của kỳ được ghi `refundedAmount`** (hoàn đủ thì `refunded`). Nhờ vậy doanh thu giảm đúng và không thể hoàn lần nữa qua màn hoàn tiền thủ công.
4. Chỉ hủy được khi đây là quyền lợi duy nhất còn hiệu lực của hội viên.

---

## 3. Flow 2 — Lớp học, khóa học, đặt buổi, điểm danh

### 3.1 Quản lý lớp và lịch
**Màn hình:** `/staff/classes` (Lễ tân/Quản lý), `/coach/classes`. **API:** `/api/v1/classes`, `/api/v1/classes/sessions`.

- Lớp gồm bộ môn, HLV, phòng, sức chứa, trình độ. Tạo buổi đơn lẻ hoặc theo các thứ trong tuần.
- Không xếp được khi HLV hoặc phòng trùng giờ, HLV có đơn nghỉ đã duyệt hôm đó, hoặc phòng đã có người đặt sân. Lớp phòng VIP chỉ cho hội viên Platinum.
- **Đơn nghỉ trùng ngày:** HLV/lễ tân gửi đơn nghỉ trùng ít nhất một ngày với đơn nghỉ đang chờ duyệt hoặc đã duyệt của chính mình thì server trả `409 LEAVE_OVERLAP`; màn hình hỏi "Vẫn gửi đơn" và chỉ gửi khi người dùng xác nhận (`confirmOverlap: true`).
- Đổi HLV/phòng thì kiểm tra trùng lịch với mọi buổi sắp tới. Không giảm sức chứa xuống dưới số chỗ đang giữ.
- **Hủy một buổi:** hủy các booking của buổi, gửi thông báo `schedule_change`.
- **Ngừng lớp** (xóa lớp có dữ liệu, hoặc đổi trạng thái sang `cancelled`/`archived`): hủy các buổi **chưa diễn ra**, hủy booking và đăng ký khóa học, **hoàn học phí đã thu vào Ví**, đóng học phí chưa trả, báo hội viên. Lớp chưa có dữ liệu thì xóa hẳn.

### 3.2 Đặt từng buổi
**Màn hình:** `/member/classes`. **API:** `POST /api/v1/classes/sessions/{id}/bookings`, `POST /api/v1/classes/session-bookings/bulk`, `POST /api/v1/classes/session-bookings/cancel`, `DELETE /api/v1/classes/session-bookings/{id}`, `GET /api/v1/classes/session-bookings/my`.

1. Hội viên xem lịch tuần, HLV, phòng, số chỗ còn.
2. Điều kiện đặt: buổi `scheduled` và chưa bắt đầu; lớp đang hoạt động; có **một kỳ gói `active` bao phủ cả hôm nay lẫn ngày học**; còn chỗ (chỗ theo buổi + đăng ký cả lớp ≤ sức chứa); không trùng giờ với buổi lớp khác hoặc PT 1:1 của chính mình; phòng VIP cần Platinum.
3. "Đặt nhiều buổi": tối đa **62 buổi** một lượt. Buổi đầy hoặc trùng giờ được bỏ qua và báo lại.
4. Hủy: hội viên hoặc nhân viên hủy được tới **trước giờ bắt đầu**. Chỗ được giải phóng ngay.

**State `session_bookings.status`:** `booked` → `cancelled` (hủy, buổi bị hủy, gói bảo lưu/hủy/hết hạn) hoặc `completed` (tự động, 7 ngày sau buổi học).

### 3.3 Khóa học (đăng ký cả lớp)
**API:** `POST /api/v1/classes/sessions/{id}/enroll`, `GET /api/v1/classes/enrollments/my`, `DELETE /api/v1/classes/enrollments/{id}`.

- Khóa học phải kết thúc trong thời hạn gói (được nối các kỳ đã trả liền mạch). Mỗi chu kỳ có số khóa miễn phí theo hạng gói; vượt thì đóng học phí (giảm 10%/20% cho Gold/Platinum).
- Học phí online giữ chỗ **15 phút**; quá hạn chưa trả thì tự giải phóng.
- **Quy tắc vắng:** vắng quá **50%** số buổi của một khóa thì bị chặn đăng ký khóa mới trong **30 ngày**. Đi muộn tính là có mặt. (Bảo lưu hủy hẳn khóa nên không phát sinh buổi vắng trong kỳ bảo lưu.)
- Bảo lưu làm hủy khóa: duyệt trước ngày khóa bắt đầu ≥ 3 ngày thì được trả lại lượt/hoàn phí, muộn hơn hoặc khóa đã chạy thì mất (chi tiết ở mục 2.4).

**State `class_enrollments.status`:** `booked` → `cancelled`, hoặc `completed` khi mọi buổi không bị hủy của lớp đã qua 7 ngày.

### 3.4 Điểm danh
**Màn hình:** `/staff/attendance`, `/staff/attendance/:sessionId` (HLV). **API:** `/api/v1/attendance`.

- HLV điểm danh khi buổi đã bắt đầu, chỉ cho hội viên có chỗ trong buổi: `present`, `late`, `absent`, `excused`.
- **Điểm danh khóa học do HLV của lớp thực hiện; quét cổng không tự điểm danh.** Màn điểm danh hiện tag "Đã check-in HH:mm" cho hội viên có lượt vào cổng phủ buổi học (vào trong 3 giờ trước giờ học và còn trong trung tâm lúc buổi bắt đầu). HLV đánh vắng hội viên có tag thì phải xác nhận lại trên màn hình.
- Job 30 phút một lần đánh `absent` cho buổi đã kết thúc mà chưa điểm danh, xét lùi 7 ngày. Hội viên có lượt vào cổng phủ buổi thì job bỏ qua, để HLV tự điểm danh.
- PT 1:1 cũng không tự ghi nhận đến khi quét cổng (mục 6.1).
- HLV nhập điểm tiến bộ (1–100) và nhận xét. Dữ liệu này hiện ở `/member/progress`.
- **Sửa điểm danh:** HLV của lớp, lễ tân hoặc quản lý sửa được từ lúc buổi bắt đầu tới **7 ngày sau buổi học**; quá hạn thì không đổi được trạng thái (lỗi `ATTENDANCE_EDIT_WINDOW_CLOSED`) nhưng vẫn sửa được điểm/nhận xét. Mỗi lần lưu ghi audit log `CLASS_ATTENDANCE_RECORD` (trạng thái từng hội viên trước/sau, người sửa là user của audit). Sửa xong tính lại quy tắc vắng 50%.
- Lịch sử điểm danh/đánh giá trên màn HLV đọc từ server (`GET /attendance/sessions/history`, 31 ngày gần nhất), không lưu trên trình duyệt.

**State `class_sessions.status`:** `scheduled` → `cancelled`, hoặc `completed` (tự động, 7 ngày sau ngày học, để vẫn sửa điểm danh muộn được).

---

## 4. Flow 3 — Thanh toán, Ví, hóa đơn, hoàn tiền, báo cáo

### 4.1 Phương thức thanh toán
| Phương thức | Ai thực hiện | Ghi chú |
|---|---|---|
| VNPay | Hội viên | Kiểm chữ ký và số tiền ở IPN. Giao dịch quá hạn được đóng sau 15 phút ân hạn. IPN thành công đến muộn cho đơn đã hủy thì tiền vào Ví. |
| Ví SÖL | Hội viên | Trừ ngay, khóa dòng ví, chống trừ trùng theo mã tham chiếu. |
| Tiền mặt / POS / chuyển khoản | Lễ tân xác nhận | `PATCH /payments/{id}/status` chỉ đi `pending → success/failed`, `failed → pending`. |

**State `payments.status`:** `pending` → `success` / `failed`; `failed` → `pending`; `success` → `refunded` (hoàn đủ). Hoàn một phần thì vẫn `success` và ghi `refundedAmount`. Doanh thu luôn tính `netAmount = amount − refundedAmount`.

### 4.2 Ví
**Màn hình:** ví trong `/member/dashboard`; lễ tân nạp ở `/staff/reception`. **API:** `/api/v1/wallet`.

- Nạp qua VNPay hoặc tại quầy, mỗi lần 10.000 đ – 100.000.000 đ.
- Mọi khoản hoàn (hủy gói, khóa học, sân, PT, đơn hàng) đều vào Ví. Mỗi khoản có mã tham chiếu riêng (`CANCEL_REQ_`, `COURSE_REFUND_`, `COURT_REFUND_`, `COACH_REFUND_`, `ORDER_REFUND_`) nên không hoàn trùng.

### 4.3 Hoàn tiền thủ công
**Màn hình:** `/manager/reports` / chi tiết giao dịch. **API:** `POST /api/v1/payments/{id}/refund` (chỉ Quản lý).

- Chỉ hoàn payment `success`, không vượt phần còn lại. Payment VNPay đã thành công không hoàn được ở đây.
- Payment được khóa dòng khi hoàn để hai yêu cầu đồng thời không cùng hoàn.
- Hoàn đủ gói tập: hủy gói, hủy các lịch không còn quyền, khôi phục kỳ cũ nếu là kỳ nâng cấp. Hoàn đủ học phí khóa học: hủy đăng ký.
- **Payment đặt sân, PT 1:1, đơn hàng không được hoàn đủ ở đây.** Phải hủy lịch/đơn để vừa hoàn tiền vừa giải phóng chỗ/tồn kho. Hoàn một phần (bồi thường) vẫn được; khi hủy sau đó hệ thống chỉ hoàn phần còn lại.

### 4.4 Hóa đơn và báo cáo
- Payment thành công tự phát hành hóa đơn. Hội viên xem và tải ở `/member/invoices`.
- `/manager/reports`: doanh thu theo ngày, theo gói, giao dịch gần đây, tỷ lệ gia hạn, tỷ lệ lấp đầy lớp, bản chụp báo cáo (`report_snapshots`).
- `/admin/payments`: đối soát VNPay, tối đa 92 ngày mỗi lần xem.

---

## 5. Flow 4 — Quản trị và cấu hình

| Chức năng | Màn hình | Ai |
|---|---|---|
| Người dùng: khóa/mở, đổi vai trò, xóa mềm | `/manager/users`, `/admin/users` | Quản lý, Admin |
| Tài khoản nhân viên (HLV, lễ tân) | `/manager/staff-accounts` | Quản lý |
| Danh mục: bộ môn, phòng, gói tập | `/manager/catalogs` | Quản lý |
| Thiết bị phòng tập | `/manager/equipment` | Quản lý; nhân viên đổi trạng thái |
| Xem và điều chuyển HLV phụ trách (không phân công mới) | `/manager/coach-assignments` | Quản lý |
| Đánh giá HLV | `/manager/coach-reviews` | Quản lý |
| Yêu cầu nội bộ: nghỉ phép, đổi ca, đổi lịch, khác | `/staff/requests` (gửi), `/manager/requests` (duyệt) | Nhân viên, Quản lý |
| Sản phẩm, danh mục cửa hàng | `/manager/products` | Quản lý |
| Nhật ký kiểm toán | `/admin/audit-logs` | Admin |

- Không khóa được Admin/Quản lý hoạt động cuối cùng.
- Hội viên còn gói hoặc lịch sắp tới, HLV còn lớp hoặc PT sắp tới thì không đổi vai trò/xóa được cho tới khi xử lý xong.
- Đơn nghỉ phép đã duyệt chặn xếp lớp cho HLV vào ngày đó.
- Các thao tác thay đổi dữ liệu quan trọng được ghi `audit_logs` qua `@Audited`.

---

## 6. Flow 5 — HLV: PT 1:1, giáo án, đánh giá, AI

### 6.1 Đặt PT 1:1
**Màn hình:** `/member/explore`, `/member/dashboard`; HLV ở `/coach/pt-attendance`; lễ tân ở `/staff/pt-attendance`. **API:** `/api/v1/coach-bookings`.

- Đặt trước ít nhất **2 giờ**. Cần gói `active` bao phủ cả hôm nay và ngày tập.
- Mỗi chu kỳ có số buổi miễn phí theo hạng gói; buổi thêm trả theo giờ (giảm theo hạng gói). Tối đa **2 buổi chưa trả** sắp tới.
- Không trùng giờ với lịch khác của HLV hoặc hội viên. HLV không có quá **3 giờ PT liên tiếp** trong cửa sổ 4 giờ (phải nghỉ).
- Hủy trước giờ bắt đầu: lượt miễn phí được trả lại, tiền đã trả vào Ví.
- Ghi nhận đến: HLV/lễ tân/quản lý đánh dấu tay từ giờ bắt đầu; **quét cổng không tự ghi nhận**. Màn `/coach/pt-attendance`, `/staff/pt-attendance` hiện tag "Đã check-in HH:mm" khi hội viên có lượt vào cổng phủ buổi (vào trong 3 giờ trước giờ tập, còn trong trung tâm lúc bắt đầu). Gỡ đánh dấu có mặt của người có tag phải xác nhận lại.

**State `coach_bookings.status`:** `confirmed` → `cancelled`, hoặc `completed` (tự động, 3 ngày sau buổi tập).

### 6.2 Giáo án và AI
**Màn hình:** `/coach/training-plans`, `/coach/saved-plans`, `/coach/health-metrics`; hội viên ở `/member/progress`, `/member/streak`. **API:** `/api/v1/coaching/*`, `/api/v1/ai`.

1. HLV xem hồ sơ sức khỏe và chỉ số của học viên được phân công. **Giáo án riêng chỉ soạn cho hội viên đã đăng ký ít nhất một buổi PT 1:1 (chưa hủy) với chính HLV đó và đang có gói Gold/Platinum còn hạn** (gói dùng thử tính như Gold); Silver hoặc chỉ học lớp nhóm thì bị từ chối (`PT_SESSION_REQUIRED`, `PLAN_TIER_REQUIRED`). Quản lý không còn thao tác "phân công học viên mới" thủ công.
2. HLV tự soạn hoặc bấm "Yêu cầu AI hỗ trợ". AI trả danh sách bài tập, sets, reps, nghỉ (tối đa 40 mục) và ghi `ai_recommendation_logs`.
3. HLV chỉnh rồi áp dụng: giáo án `active`, log AI đánh dấu `is_applied` và gắn vào giáo án.
4. Mỗi cặp hội viên–HLV chỉ có một giáo án `active`. Giáo án cũ chuyển `superseded` và có thể áp dụng lại. **Điều chuyển HLV (`/manager/coach-assignments`):** chuyển buổi PT 1:1 sang HLV mới thì toàn bộ giáo án (active, draft, lịch sử) của hội viên với HLV cũ chuyển theo để HLV mới sửa tiếp; HLV cũ mất quyền sửa, xóa, áp dụng lại. Nếu HLV mới đã có giáo án active cho hội viên thì giáo án kế thừa vào lịch sử.
5. Hội viên đánh dấu bài đã tập theo ngày. Chuỗi ngày tập hiện ở `/member/streak`. Hội viên Silver không xem được giáo án.

**State `training_plans.status`:** `draft` → `active` → `superseded` / `cancelled`, hoặc `completed` (tự động khi qua `end_date`).

### 6.3 Đánh giá HLV
Hội viên đánh giá HLV sau một buổi đã kết thúc **và được ghi nhận có mặt** (khóa học: HLV điểm danh `present`/`late`; PT 1:1: đã đánh dấu có mặt). Quét cổng không tính. Mỗi buổi đánh giá một lần. Quản lý xem tổng hợp theo tháng ở `/manager/coach-reviews`.

**Bảng xếp hạng và thưởng tháng** (`CoachLeaderboardService`):
- Tự tính lại tháng của đánh giá mỗi khi có đánh giá mới (quản lý vẫn bấm tổng hợp lại được). Giữ trạng thái và huy hiệu/thưởng quản lý đã sửa tay.
- Xếp hạng: HLV có **≥ 3 đánh giá** trong tháng đứng trước; trong nhóm, theo điểm trung bình, rồi số đánh giá, rồi số buổi dạy.
- Thưởng Top 1/2/3: **2.000.000 / 1.000.000 / 500.000 đ**, chỉ khi có ≥ 3 đánh giá và điểm trung bình **≥ 4.0 sao**; không đạt thì huy hiệu "HLV Năng Động", thưởng 0.

---

## 7. Flow 6 — Trợ lý AI, thông báo, chat, hỗ trợ

### 7.1 Trợ lý AI
**Màn hình:** tab AI trong `/messages`. **API:** `/api/v1/ai/chat`.
- Hội viên và nhân viên đều có phiên chat riêng. AI trả lời dựa trên kiến thức trung tâm và dữ liệu của chính người hỏi (lịch, giáo án). Có giới hạn tần suất. Lịch sử lưu ở `ai_chat_sessions` / `ai_chat_messages`.

### 7.2 Thông báo
**Màn hình:** `/member/notifications`. **API:** `/api/v1/notifications`.
| Loại | Khi nào |
|---|---|
| `schedule_change` | Buổi/lớp bị hủy hoặc đổi giờ, đổi HLV |
| `package_expiry` | Gói còn ≤ 7 ngày (8:00 hằng ngày) |
| `class_reminder` | Buổi học bắt đầu trong 2 giờ tới (30 phút quét một lần) |
| `payment` | Thanh toán, hoàn tiền, Ví |
| `support_reply` | Có phản hồi phiếu hỗ trợ |
| `system` | Còn lại |

`schedule_change`, `package_expiry`, `payment`, `password_changed` còn được gửi qua email.

### 7.3 Chat trực tiếp
`/messages`: hội viên chat với HLV phụ trách; nhân viên chat với nhau. Cập nhật thời gian thực qua Supabase Realtime.

### 7.4 Hỗ trợ và khiếu nại
**Màn hình:** tab Hỗ trợ trong `/messages` (hội viên, lễ tân), `/manager/support`. **API:** `/api/v1/support/requests`.

1. Hội viên tạo phiếu theo loại (gói tập, lớp học, thanh toán, …). Lễ tân nhận thông báo.
2. Lễ tân trả lời ngay trong phiếu. Trả lời phiếu `open` thì phiếu tự sang `in_progress`.
3. Lễ tân không xử lý được thì **chuyển cấp** kèm lý do. Từ đó chỉ Quản lý xử lý, lễ tân chỉ xem.
4. Lễ tân/Quản lý đánh dấu `resolved`. Hội viên bấm **"Xác nhận đã giải quyết"** để đóng, hoặc phiếu **tự đóng sau 72 giờ**.
5. Hội viên **"Rút yêu cầu"** khi phiếu còn `open`.

**State `support_requests.status`:**
- Nhân viên: `open → in_progress`, `in_progress → open` (cần thêm thông tin), `in_progress → resolved`, `resolved → in_progress` (mở lại), `resolved → closed`.
- Hội viên: `open → closed` (rút), `resolved → closed` (xác nhận).
- Hệ thống: `resolved → closed` sau 72 giờ. Phiếu `closed` không sửa và không nhắn thêm được.

---

## 8. Luồng mở rộng — Check-in trung tâm
**Màn hình:** `/member/card`, `/member/check-in` (QR), `/staff/check-in`, `/staff/check-out`, `/staff/reception-history`. **API:** `/api/v1/check-in`.

1. Hội viên mở thẻ, ứng dụng sinh **QR động có chữ ký, đổi mỗi 60 giây**. QR tĩnh bị từ chối.
2. Cổng/lễ tân quét. Được vào (`GRANTED`) khi tài khoản `active`, gói `active` và đang trong thời hạn. Mọi lượt quét, kể cả bị từ chối (`DENIED` kèm lý do), đều được lưu.
3. **Chống quay vòng:** đang ở trong chưa check-out thì lượt vào thứ hai bị từ chối. Lượt quá 8 giờ tự đóng; 3:00 sáng hằng ngày đóng các lượt chưa check-out.
4. Check-out bằng quét cổng hoặc lễ tân.

---

## 9. Luồng mở rộng — Đặt sân
**Màn hình:** `/member/courts`, `/staff/courts`. **API:** `GET /api/v1/courts`, `GET /api/v1/courts/{roomId}/availability`, `POST /api/v1/court-bookings`, `GET /api/v1/court-bookings/my|quota`, `PATCH /api/v1/court-bookings/{id}/cancel|confirm-payment`.

- Đặt sân cầu lông, tennis theo khung giờ, trong giờ mở cửa, không đặt quá khứ.
- Giới hạn theo hạng gói: số ngày đặt trước, số lượt kèm gói mỗi chu kỳ, tổng số lượt sắp tới, số chỗ giữ chưa trả (bảng ở 2.2).
- Trả qua VNPay (giữ chỗ theo thời hạn cổng) hoặc tại quầy (lễ tân xác nhận). Chỗ chưa trả bị nhả trước giờ chơi.
- Sân không trùng giờ với lớp học dùng cùng phòng.
- Hủy trong thời hạn cho phép: tiền đã trả (phần chưa hoàn) vào Ví.

**State `court_bookings`:** `booked` → `cancelled` / quá hạn nhả chỗ; `payment_status`: `pending` → `paid` → `refunded`.

---

## 10. Luồng mở rộng — Cửa hàng thực phẩm bổ sung
**Màn hình:** `/products`, `/products/:slug`, `/checkout`, `/member/products`, `/member/orders`, `/staff/orders`, `/manager/products`. **API:** `/api/v1/public/catalog`, `/api/v1/shop/*`, `/api/v1/staff/product-orders`.

1. Khách xem danh mục, bảng dinh dưỡng, giá mỗi khẩu phần, thêm giỏ (lưu trình duyệt).
2. Thanh toán cần đăng nhập `MEMBER`, **không cần gói tập**. Tối đa 30 dòng, 20 sản phẩm mỗi dòng, tổng 100 triệu đồng. Tối đa 5 địa chỉ (Tỉnh/Thành → Phường/Xã).
3. Tồn kho trừ ngay khi tạo đơn (khóa bi quan theo thứ tự biến thể, `CHECK stock >= 0`). Giữ hàng **15 phút** với đơn online, **24 giờ** với đơn trả tại quầy; quá hạn tự hủy và hoàn kho.
4. Nhân viên xử lý: `paid → processing → shipping → completed` hoặc `processing → ready_for_pickup → completed`. Đơn trả tại quầy đã thu tiền được hoàn tất ngay.
5. Hủy đơn đã trả: hoàn **phần chưa hoàn** vào Ví, hoàn tồn kho.

**State `product_orders.status`:** `pending_payment`, `paid`, `processing`, `shipping`, `ready_for_pickup`, `completed`, `cancelled`.

---

## 11. Job định kỳ và ràng buộc database

### 11.1 Job định kỳ
| Job | Lịch | Việc làm |
|---|---|---|
| `MembershipLifecycleScheduler` | 00:15 hằng ngày | Bắt đầu/kết thúc bảo lưu, hủy lịch không còn gói bao phủ |
| `SessionCompletionScheduler` | 00:30 hằng ngày | Buổi học, booking theo buổi, khóa học đã qua 7 ngày → `completed` |
| `CoachingCompletionScheduler` | 00:35 hằng ngày | PT 1:1 đã qua 3 ngày, giáo án hết hạn → `completed` |
| `CourseAttendanceService` | 30 phút | Đánh vắng buổi đã kết thúc, áp quy tắc 50% |
| `CenterCheckinService` | 03:00 hằng ngày | Đóng lượt check-in treo |
| `SupportRequestService` | Hằng giờ | Đóng phiếu `resolved` quá 72 giờ |
| `NotificationScheduler` | 8:00 và 30 phút | Nhắc gia hạn gói, nhắc giờ học |
| Hết hạn giữ chỗ | 1–5 phút | Học phí chưa trả, đơn hàng, đặt sân, giao dịch VNPay |

### 11.2 Ràng buộc trong database
Định nghĩa trong `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql`, cài sau Hibernate. Lỗi được dịch ra HTTP 409/403 kèm i18n ở `GlobalExceptionHandler`.

| Ràng buộc | Chặn |
|---|---|
| `trg_enrollments_check_capacity` | Đăng ký cả lớp vượt sức chứa (tính cả buổi đông nhất của booking theo buổi) |
| `trg_session_bookings_check_capacity` | Booking theo buổi + đăng ký cả lớp vượt sức chứa |
| `trg_sessions_check_conflict` | HLV hoặc phòng trùng giờ (chỉ xét buổi `scheduled`) |
| `trg_enrollments_check_membership` | Đăng ký/đặt buổi/PT khi không có gói hợp lệ. Đặt buổi cần một kỳ phủ cả hôm nay và ngày học |
| `trg_checkins_check_membership` | Check-in `GRANTED` khi gói không hợp lệ |
| `trg_member_schedule_conflict` | Hội viên học hai buổi lớp trùng giờ |
| `trg_pt_schedule_*` | PT trùng lớp/PT khác, HLV quá 3 giờ PT liền. Thao tác hủy/hoàn thành không lấy khóa lịch chung |
| `trg_court_bookings_*` | Sân trùng giờ, sai giờ mở cửa, quá khứ, vượt quyền gói |
| `uq_session_booking_active`, `uq_enrollment_active` | Một hội viên giữ hai chỗ `booked` cùng buổi/lớp |

---

## 12. Khác biệt so với thiết kế gốc
| Thiết kế gốc (`PROJECT_MASTER_GUIDE.md`) | Đang chạy |
|---|---|
| `users`: `[Đang đăng ký]`, `inactive` = tạm ngưng | `inactive` dùng cho tài khoản chờ OTP; Quản lý chỉ đặt `active`/`locked` |
| Gói tự chuyển `expired` khi hết hạn | Hết hạn xác định theo `end_date`; `expired` chỉ dùng cho kỳ bị thay khi nâng cấp. Có thêm `frozen` (bảo lưu) |
| Giáo án: `draft/active/completed/cancelled` | Có thêm `superseded` (giáo án cũ khi áp dụng giáo án mới) |
| Hủy lớp "trước giờ học quy định" | Hủy được tới giờ bắt đầu |
| Hỗ trợ: nhân viên không mở lại phiếu đã giải quyết | Nhân viên được `resolved → in_progress` khi hội viên còn vấn đề |
| Xuất Excel/PDF báo cáo | Chỉ có hóa đơn PDF của hội viên; báo cáo xem trên web và lưu snapshot JSON |
| Push/SMS | Thông báo trong ứng dụng và email; chưa có SMS |
| Không có | Đặt sân, PT 1:1, Ví, cửa hàng, dùng thử có duyệt giấy tờ, chat trực tiếp, chuyển cấp khiếu nại |
