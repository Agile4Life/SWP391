# Nghiệp vụ SÖL Fitness — các luồng chính đang chạy trên web

> Quản lý có thể thêm, sửa và xóa phòng chưa được sử dụng. Hạng phòng không hiển thị trong danh mục quản lý; quyền truy cập VIP hiện có vẫn giữ. Phòng mẫu không tự tạo lại sau khi xóa.

> Cập nhật: 25/11/2026 (phạm vi 3 bộ môn `Gym`/`Boxing`/`Yoga` với các phòng mẫu ban đầu, cho phép **nhiều lớp `active` mỗi bộ môn không trùng ngày & slot** (`409 SCHEDULING_DISCIPLINE_CONFLICT`), **wizard tạo khóa học 4 bước** kèm API tiền kiểm tra chỉ đọc `POST /api/v1/classes/recurring/availability`, **hệ thống lịch 5 Slot cố định `07:00 – 20:30`** cho cả lớp nhóm và PT 1:1, gỡ bỏ giới hạn bắt buộc nghỉ liên tiếp của HLV, dọn dữ liệu lệch slot qua `LegacyScheduleSlotResetRunner`, gỡ bỏ hoàn toàn tính năng đặt sân & các bộ môn ngoài phạm vi, ẩn 3D khỏi sidebar hội viên, lịch Quản lý 3 tab độc lập & chuẩn hóa sidebar 5 vai trò).
> **Phạm vi hiện tại:** Trung tâm **3 bộ môn đang hoạt động** (`Gym` chính, `Boxing`, `Yoga`) với các phòng mẫu ban đầu (`Phòng Gym Tiêu chuẩn`, `Phòng Gym VIP`, `Zen Garden Studio`, `Ring Arena 01`), gói tập/bảo lưu, **lớp học nhóm dạng khóa định kỳ & điểm danh lớp nhóm** (`app.legacy.classes-enabled=true`, cho phép nhiều lớp `active`/bộ môn miễn không trùng ngày & slot cùng bộ môn, sức chứa lớp `<=` sức chứa phòng, học phí không âm, wizard tạo khóa 4 bước kèm tiền kiểm tra khả dụng) và **PT 1:1** vận hành đồng nhất theo **5 Slot cố định (`07:00 – 20:30`)** (chống trùng lịch hai chiều lớp nhóm ↔ PT 1:1; PT 1:1 giữ `200.000đ / slot` hoặc 1 lượt gói PT, đặt trước tối thiểu 2 giờ, không còn giới hạn bắt buộc nghỉ liên tiếp của HLV), giáo án, check-in QR, VNPay, ví/hóa đơn, chat, SÖL AI, hỗ trợ và vận hành, Landing 3 bộ môn + trang bộ môn (`/boxing`, `/yoga`, `/sports/:sportId`). **Đã gỡ bỏ hoàn toàn** tính năng đặt sân (module, API, trigger, hợp đồng OpenAPI, UI/route) và các bộ môn ngoài 3 bộ môn trên; **ẩn 3D** khỏi sidebar hội viên (`/member/explore` → `/member/dashboard`, mã `features/explore3d/**` ngủ đông). Cửa hàng (`app.shop.enabled`), quản lý thiết bị, đánh giá/xếp hạng HLV/buổi tập (`app.coaching.*`), chỉ số cơ thể, tiến độ/lịch sử tập và streak (`app.health.metrics.enabled`) vẫn **tắt qua cờ legacy** (mục 9, 10 chỉ còn ghi chú).
> Dọn dữ liệu cũ của các tính năng đã ngừng: [`DATA_CLEANUP.md`](DATA_CLEANUP.md).
> `docs/PROJECT_MASTER_GUIDE.md` là thiết kế gốc. Tài liệu này mô tả **những gì hệ thống đang làm thật**: màn hình, API, quy tắc và state machine. Phần nào khác thiết kế gốc được ghi ở mục 12.
> Múi giờ nghiệp vụ là `Asia/Ho_Chi_Minh` cho mọi mốc "hôm nay", "trước giờ học" và job định kỳ.

## Mục lục
1. [Vai trò và phân quyền](#1-vai-trò-và-phân-quyền)
2. [Flow 1 — Tài khoản, gói tập, dùng thử, bảo lưu, hủy gói](#2-flow-1--tài-khoản-gói-tập-dùng-thử-bảo-lưu-hủy-gói)
3. [Flow 2 — Lớp học nhóm định kỳ](#3-flow-2--lớp-học-nhóm-định-kỳ)
4. [Flow 3 — Thanh toán, Ví, hóa đơn, hoàn tiền, báo cáo](#4-flow-3--thanh-toán-ví-hóa-đơn-hoàn-tiền-báo-cáo)
5. [Flow 4 — Quản trị và cấu hình](#5-flow-4--quản-trị-và-cấu-hình)
6. [Flow 5 — HLV: PT 1:1, giáo án, AI](#6-flow-5--hlv-pt-11-giáo-án-ai)
7. [Flow 6 — Trợ lý AI, thông báo, chat, hỗ trợ](#7-flow-6--trợ-lý-ai-thông-báo-chat-hỗ-trợ)
8. [Luồng mở rộng — Check-in trung tâm](#8-luồng-mở-rộng--check-in-trung-tâm)
9. [Đặt sân (đã gỡ bỏ hoàn toàn)](#9-đặt-sân-đã-gỡ-bỏ-hoàn-toàn)
10. [Cửa hàng thực phẩm bổ sung (đã ngừng)](#10-cửa-hàng-thực-phẩm-bổ-sung-đã-ngừng)
11. [Job định kỳ và ràng buộc database](#11-job-định-kỳ-và-ràng-buộc-database)
12. [Khác biệt so với thiết kế gốc](#12-khác-biệt-so-với-thiết-kế-gốc)

---

## 1. Vai trò và phân quyền

| Vai trò | Mã role | Khu vực web chính |
|---|---|---|
| Khách vãng lai | — | `/`, `/boxing`, `/yoga`, `/sports/:sportId` (`boxing`/`yoga`), `/trainers`, `/trainers/:id`, `/login`, `/register` |
| Hội viên | `MEMBER` | `/member/*`, `/messages` |
| Huấn luyện viên | `COACH` | `/coach/pt-attendance` (trang chủ), `/coach/attendance` (+ `/:sessionId`), `/coach/classes` (lớp nhóm + PT 1:1), `/coach/training-plans`, `/coach/saved-plans`, `/staff/requests` |
| Lễ tân | `RECEPTIONIST` (`STAFF`) | `/staff/reception`, `/staff/check-in`, `/staff/check-out`, `/staff/reception-history`, `/staff/kyc`, `/staff/holds`, `/staff/requests` |
| Quản lý trung tâm | `CENTER_MANAGER` (`MANAGER`) | `/manager/reports`, `/manager/classes`, `/manager/catalogs`, `/manager/coach-assignments`, `/manager/staff-accounts`, `/manager/requests`, `/messages` (chỉ Hỗ trợ & Khiếu nại, SÖL AI) |
| Quản trị hệ thống | `ADMIN` | `/admin/users`, `/admin/audit-logs`, `/admin/payments`, `/member/notifications` |

- URL của màn đã bỏ/ẩn (`/member/explore` → `/member/dashboard`; `/staff/orders`, `/staff/pt-attendance`, `/manager/products`, `/manager/equipment`, `/manager/coach-reviews`, `/coach/health-metrics`, trang sản phẩm công khai và route của các bộ môn đã gỡ) chuyển hướng về màn còn giữ; `/staff/classes` chuyển hướng theo vai trò (`MANAGER` → `/manager/classes`, `STAFF` → `/staff/reception`); `/staff/attendance*` chuyển hướng sang `/coach/attendance*`. Sidebar hội viên không còn lối vào 3D. Xem `DESIGN.md`.
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
6. **Đổi hoặc đặt lại mật khẩu thu hồi mọi token cũ** (`users.password_changed_at`; JWT phát hành trước mốc này bị từ chối). Đổi mật khẩu trả token mới cho phiên hiện tại nên người dùng không bị đăng xuất.

**State `users.status`:** `inactive` (chờ OTP) → `active` ⇄ `locked` (Quản lý/Admin khóa, mở). Xóa mềm đặt `deleted_at`; user đã xóa không hiện trong danh sách mặc định.

### 2.2 Mua gói, gia hạn, nâng cấp
**Màn hình:** `/member/packages`, `/member/packages/checkout`, `/member/card`; lễ tân ở `/staff/reception`. **API:** `/api/v1/packages`, `/api/v1/memberships/subscriptions`, `/api/v1/payments`, `/api/v1/payments/vnpay`.

- **Hạng gói:** SILVER, GOLD, PLATINUM. Gói bán được dài **90–365 ngày** (3–12 tháng); gói duy nhất ngắn hơn là gói dùng thử 3 ngày (`PackageService.MIN_TERM_DAYS/MAX_TERM_DAYS`). Gói dưới 90 ngày (gói 1 tháng cũ) không tạo hoặc sửa được nữa, hội viên đang dùng vẫn giữ quyền lợi. Landing và `/member/packages` chỉ hiện gói ≥ 90 ngày (lọc ở frontend; API mua gói không tự chặn gói ngắn còn `active`, nên Quản lý cần tắt các gói đó), chia "Gói 3 tháng" (90–179 ngày) và "Đồng hành dài hạn" (≥ 180 ngày). Quản lý tự bật/tắt gói; khởi động API không còn tự tắt gói 6/12 tháng.
- Quyền lợi tính theo chu kỳ 30 ngày từ ngày bắt đầu (`PackageBenefits`):

| Quyền lợi | Silver | Gold | Platinum | Dùng thử |
|---|---|---|---|---|
| Buổi PT 1:1 miễn phí mỗi chu kỳ | 0 | 3 | 6 | 1 |
| Giảm giá buổi PT thêm | — | 10% | 20% | — |
| Bảo lưu tối đa (gói ≥ 60 ngày / gói 1 tháng cũ) | 7 / 0 | 15 / 0 | 30 / 7 ngày | 0 |

> Quyền lợi khóa học nhóm (`classCreditLimit` và giảm giá học phí khóa học theo hạng gói) đang được áp dụng qua `GET /api/v1/classes/my-quota` (xem mục 3). Các trường quyền lợi của tính năng đã tắt cờ (như giảm giá cửa hàng) không hiển thị và không dùng trong luồng hiện hành.

- **Mua mới:** tạo `membership_subscriptions` ở `pending_payment`. Thanh toán thành công (VNPay, Ví, hoặc lễ tân xác nhận tiền mặt/POS) thì gói chuyển sang `active`, phát hành hóa đơn, cấp thẻ QR.
- **Gia hạn:** tạo kỳ mới liên kết `previous_subscription_id`. Kỳ cũ còn hạn thì kỳ mới bắt đầu ngay sau ngày hết hạn cũ, không mất ngày.
- **Nâng cấp:** giá trị còn lại của kỳ cũ (tính theo **tiền đã trả thật**, không theo giá niêm yết hiện tại, làm tròn xuống nghìn đồng) được trừ vào giá gói mới. Kỳ cũ chuyển `expired` ở ngày nâng cấp. Hoàn tiền toàn bộ kỳ nâng cấp thì kỳ cũ được khôi phục.
- **Hủy đơn chưa trả:** hội viên hoặc lễ tân hủy kỳ `pending_payment`.

**State `membership_subscriptions.status`:** `pending_payment` → `active` → `frozen` (đang bảo lưu) → `active`; `pending_payment`/`active` → `cancelled`; nâng cấp làm kỳ cũ `expired`. Hết hạn được xác định theo `end_date < hôm nay`; kỳ quá hạn không tự đổi chữ `active` thành `expired`, nhưng mọi kiểm tra quyền đều dựa vào ngày.

### 2.3 Dùng thử 3 ngày
**Màn hình:** `/member/dashboard` (gửi yêu cầu), `/staff/kyc` (lễ tân duyệt). **API:** `/api/v1/memberships/trial`, `/api/v1/members/kyc`.

1. Hội viên gửi CCCD hoặc hộ chiếu (số giấy tờ, quốc tịch, ảnh hai mặt). Ảnh phải là ảnh tải lên JPEG/PNG/WebP, tối đa 2 MB, không nhận link ngoài (áp dụng cả KYC).
2. Lễ tân duyệt thì cấp gói dùng thử 3 ngày hưởng quyền lợi Gold (trừ Platinum). Từ chối thì ghi lý do; từ chối giải phóng số giấy tờ (dùng lại được), đơn đã từ chối phải gửi lại mới được duyệt.
3. Mỗi tài khoản chỉ được dùng thử một lần. Số giấy tờ lưu dạng băm HMAC kèm 4 số cuối. Trong lúc đơn chờ duyệt, số đầy đủ được lưu mã hóa AES-GCM để lễ tân đối chiếu; duyệt hoặc từ chối thì xóa bản mã hóa, màn hình chỉ còn số che.

### 2.4 Bảo lưu gói
**Màn hình:** `/member/hold`, `/staff/holds`. **API:** `/api/v1/memberships/subscriptions/{id}/hold` (+ `/approve`, `/reject`, `/withdraw`, `/policy`), `/holds`, `/holds/pending`.

- Điều kiện: gói cho phép bảo lưu và chưa dùng lượt bảo lưu duy nhất. Gửi trước ngày bắt đầu ít nhất **24 giờ**. Thời lượng từ **3 ngày** tới mức tối đa của gói. Giấy tờ (ví dụ giấy tờ y tế) không bắt buộc; nếu đính kèm thì tối đa 5 tệp, mỗi tệp 5 MB.
- Lễ tân duyệt hoặc từ chối. **Từ chối bắt buộc nhập lý do** (tối đa 500 ký tự); lý do được gửi trong thông báo và hiện ở `/member/hold`, bị xóa khi hội viên gửi yêu cầu mới. Hội viên rút yêu cầu khi chưa duyệt; lễ tân rút giúp khi chưa tới ngày bắt đầu.
- **Ngày bảo lưu đã duyệt bị khóa đặt lịch:** không đặt được PT 1:1 vào ngày nằm trong khoảng bảo lưu (kể cả bảo lưu chưa bắt đầu). Lỗi riêng `MEMBERSHIP_ON_HOLD` thay cho lỗi "không có gói".
- Khi duyệt (hoàn/mất được quyết định ngay lúc duyệt):
  - **PT 1:1** có ngày nằm trong khoảng bảo lưu bị hủy. Duyệt trước ngày tập **≥ 3 ngày**: lượt gói được trả lại, tiền đã trả (phần chưa hoàn) vào Ví và payment chuyển `refunded`. Muộn hơn: mất lượt (đánh dấu `quota_forfeited`, vẫn tính vào hạn mức chu kỳ) hoặc mất tiền. Payment còn `pending` chuyển `failed`.
  - Hội viên nhận thông báo riêng cho từng lịch (trả lượt / hoàn tiền / không tính phí / mất). Lịch ngoài khoảng bảo lưu giữ nguyên; lịch đã hủy không tự khôi phục kể cả khi rút bảo lưu chưa bắt đầu.
  - Đối với khóa học nhóm định kỳ đã ghi danh, hệ thống xử lý hủy/hoàn theo quy tắc khóa học tương ứng (nhánh đặt sân đã gỡ bỏ hoàn toàn cùng module đặt sân).
- Tới ngày bắt đầu, gói chuyển `frozen`. Hết hạn bảo lưu (hoặc chạm trần **90 ngày**), gói tự `active` lại và được cộng bù số ngày đã giữ. Ngày bảo lưu không bị tính vào chu kỳ quyền lợi.

### 2.5 Hủy gói và hoàn tiền
**Màn hình:** `/member/packages` (yêu cầu), `/staff/reception` (lễ tân trình), `/manager/cancellations` (duyệt). **API:** `/api/v1/memberships/cancellations`.

1. Hội viên hoặc lễ tân gửi yêu cầu kèm lý do. Hệ thống gợi ý số hoàn bằng phần chưa dùng của **số tiền đã trả** cho kỳ đó.
2. Chỉ Quản lý duyệt. Quản lý được sửa số hoàn nhưng **không vượt số đã trả** cho kỳ (tiền mặt + phần quy đổi từ gói trước).
3. Duyệt thì: chỉ kỳ gói được yêu cầu chuyển `cancelled`, các lịch không còn được gói bao phủ bị hủy, tiền hoàn vào **Ví**, và **payment của kỳ được ghi `refundedAmount`** (hoàn đủ thì `refunded`). Các kỳ khác được giữ nguyên. Nhờ vậy doanh thu giảm đúng và không thể hoàn lần nữa qua màn hoàn tiền thủ công.
4. Chỉ hủy được khi đây là quyền lợi duy nhất còn hiệu lực của hội viên.

---

## 3. Flow 2 — Lớp học nhóm định kỳ (3 bộ môn, đa lớp/môn không trùng slot, 5 Slot cố định)

Từ 25/11/2026 trung tâm vận hành **3 bộ môn đang hoạt động** (`Gym` chính, `Boxing`, `Yoga`) với **4 phòng** (`Phòng Gym Tiêu chuẩn`, `Phòng Gym VIP`, `Zen Garden Studio`, `Ring Arena 01`) và **lớp học nhóm dạng khóa định kỳ** (`app.legacy.classes-enabled=true`), giữ nguyên `SingleSessionPolicy` (chặn đặt buổi lẻ một lần, không có UI `+ Thêm buổi` rời), cho phép mỗi bộ môn mở **nhiều lớp `active`** miễn không có hai lớp cùng bộ môn trùng ngày và cùng slot (`409 SCHEDULING_DISCIPLINE_CONFLICT`), và chuẩn hóa toàn bộ lịch lớp nhóm lẫn PT 1:1 theo **5 Slot cố định (`07:00 – 20:30`, nghỉ 15 phút giữa hai slot kế tiếp)**:

| Mã Slot | Nhãn hiển thị | Giờ bắt đầu | Giờ kết thúc | Thời lượng |
|---|---|---|---|---|
| `SLOT_1` | `Slot 1` | `07:00` | `09:30` | 2 giờ 30 phút |
| `SLOT_2` | `Slot 2` | `09:45` | `12:15` | 2 giờ 30 phút |
| `SLOT_3` | `Slot 3` | `12:30` | `15:00` | 2 giờ 30 phút |
| `SLOT_4` | `Slot 4` | `15:15` | `17:45` | 2 giờ 30 phút |
| `SLOT_5` | `Slot 5` | `18:00` | `20:30` | 2 giờ 30 phút |

- **Ràng buộc 5 Slot chuẩn, đa lớp không trùng bộ môn & dữ liệu ở Backend/DB:** mọi thao tác tạo khóa học, cập nhật lịch khóa hay đổi lịch buổi (`ClassService`) bắt buộc truyền `(startTime, endTime)` khớp chính xác 1 trong 5 `ScheduleSlot`; khung giờ ngoài 5 slot trả `400 SCHEDULING_INVALID_SLOT` và bị trigger PostgreSQL `scms_is_valid_schedule_slot` / `trg_schedule_invalid_slot` chặn lại ở tầng CSDL. Không cho phép hai lớp đang hoạt động cùng bộ môn trùng ngày & slot (`409 SCHEDULING_DISCIPLINE_CONFLICT`, kiểm tra đồng thời ở `ClassService` và trigger `trg_sessions_check_discipline_conflict` bên trong `scms_check_session_conflict`). Sức chứa lớp học không được vượt quá sức chứa phòng (`400 SCHEDULING_CAPACITY_EXCEEDS_ROOM`) và học phí khóa học không được âm (`400 SCHEDULING_INVALID_PRICE`). Đồng thời vẫn chặn trùng phòng (`409 SCHEDULING_ROOM_CONFLICT`), trùng lịch lớp nhóm của HLV (`409 SCHEDULING_COACH_CONFLICT`), trùng buổi PT 1:1 `confirmed` của HLV (`409 SCHEDULING_COACH_PT_CONFLICT`), kỳ nghỉ phép đã duyệt của HLV (`409 COACH_ON_LEAVE`), trùng lịch học viên (`409 SCHEDULING_MEMBER_TIME_OVERLAP`) và giới hạn mỗi HLV dạy tối đa 3 khóa đồng thời (`409 SCHEDULING_COACH_MAX_COURSES` khi tạo khóa, đổi HLV hoặc kích hoạt lại lớp; HLV nhận lại được khóa mới khi khóa đó bắt đầu sau ngày kết thúc của một khóa đang dạy). Dữ liệu lịch cũ lệch slot được `LegacyScheduleSlotResetRunner` (chạy 1 lần, idempotent khi khởi động trước seeder) dọn sạch và để `DemoClassSeeder` / `DemoDataSeeder` tạo lại dữ liệu mới chuẩn 5 slot; `RetiredCatalogCleanupRunner` không còn vô hiệu hóa các lớp `active` cùng bộ môn khi khởi động lại (vẫn dọn bộ môn/phòng/lớp mẫu đã ngừng và đồng bộ chuyên môn HLV mẫu).
- **Quản lý (`/manager/classes`, chỉ `CENTER_MANAGER` / `MANAGER`):**
  - Tiền kiểm tra lịch định kỳ chỉ đọc qua `POST /api/v1/classes/recurring/availability` (trả về `validSchedule`, `sessionCount`, `firstSessionDate`, `lastSessionDate`, khả dụng toàn bộ 5 Slot chuẩn cho bộ môn, danh sách phòng kèm trần sức chứa và danh sách HLV đã đối chiếu lớp nhóm, PT 1:1 và nghỉ phép đã duyệt).
  - Tạo, sửa khóa học định kỳ (`POST /api/v1/classes/recurring`, `PUT /api/v1/classes/{id}`), đổi lịch buổi (`PUT /api/v1/classes/{id}/sessions/{sessionId}`), hủy buổi kèm lý do (`POST /api/v1/classes/sessions/{id}/cancel`). Không có nút `+ Thêm buổi` rời trên UI và `SingleSessionPolicy` vẫn chặn tạo buổi lẻ.
  - **Wizard tạo khóa học 4 bước (`CreateClassOrSessionModal`):** `1. Thông tin khóa học` → `2. Lịch học & Slot` → `3. Phòng & HLV` → `4. Xác nhận`, gọi trực tiếp `POST /api/v1/classes/recurring/availability` để cảnh báo/chặn sớm mọi xung đột slot, phòng, sức chứa và HLV trước khi lưu. Nút header `+ Tạo lớp học` luôn khả dụng khi trung tâm có bộ môn.
  - Giao diện gồm đúng **3 tab độc lập không lặp control**: `Lịch theo bộ môn` (3 chip bộ môn `Gym`, `Boxing`, `Yoga`, danh sách toàn bộ lớp `active` của bộ môn đang chọn kèm nút sửa từng lớp và nút `+ Tạo khóa mới` → lịch tuần 5 hàng `Slot 1`–`Slot 5` không bị chồng thẻ vì tối đa 1 lớp/slot cho mỗi bộ môn), `Lịch tổng cả tuần` (gộp cả 3 bộ môn trên lưới 5 hàng Slot, gom ≥ 3 lớp trùng slot vào nút `+N lớp`), và `Danh sách lớp` (bảng quản lý). Bấm bất kỳ ô buổi nhỏ nào mở `ClassSessionDetailModal`. Form tạo khóa học 4 bước, sửa lớp và dời lịch buổi dùng **bộ chọn 5 Slot cố định** thay cho `TimePicker` tự do; bấm ô trống ở hàng `Slot N` trên lịch tự điền sẵn `Slot N`.
- **Chuẩn hiển thị lịch tuần toàn portal (`WeeklyTimetable` & `MemberCalendar`):**
  - Cột trục trái hiển thị đúng **5 hàng cố định `Slot 1`–`Slot 5`** kèm khung giờ cụ thể ngay bên dưới (`07:00 – 09:30`, v.v.), bỏ hẳn dải giờ liên tục và công tắc `08:00–20:00 / Cả ngày`.
  - Thẻ sự kiện dùng **viền mảnh bo tròn đều 4 cạnh** (bỏ hoàn toàn viền dày bên trái `border-left: 4px`) và **hiển thị rõ tên HLV ngay phía dưới** (ở lịch HLV hiển thị học viên hoặc phòng tùy loại buổi).
- **Ràng buộc chống trùng lịch hai chiều PT 1:1 ↔ Lớp nhóm:**
  - Khi Hội viên đặt PT 1:1 hoặc Quản lý điều chuyển HLV PT (`CoachBookingService`, `CoachAssignmentService`, trigger `scms_guard_pt_schedule`), hệ thống chặn nếu HLV đã có buổi lớp nhóm trùng slot.
  - Ngược lại, khi Quản lý tạo khóa học, thêm buổi, cập nhật lịch khóa hoặc đổi lịch buổi (`ClassService.ensureNoSessionConflict`), hệ thống kiểm tra `CoachBookingRepository` và trả `409 SCHEDULING_COACH_PT_CONFLICT` nếu HLV đã có buổi PT 1:1 `confirmed` trùng slot.
- **Hội viên (`/member/classes`):**
  - 3 tab: `Lịch của tôi` (`MemberCalendar` 5 hàng Slot gộp buổi lớp đã ghi danh + PT 1:1), `Đăng ký lớp học` (ghi danh theo suất gói `POST /api/v1/classes/{id}/enroll` hoặc thanh toán học phí khóa học `POST /api/v1/classes/{id}/checkout` qua Ví/VNPay/Tiền mặt tại quầy, hủy ghi danh trước ngày khai giảng), và `Đặt lịch HLV 1:1` (bộ chọn 5 thẻ Slot cố định).
  - Gói tập vẫn hiển thị và áp dụng quyền lợi số khóa học / giảm giá học phí khóa học từ `GET /api/v1/classes/my-quota`.
- **HLV (`/coach/classes`, `/coach/attendance`, `/coach/attendance/:sessionId`):**
  - Xem thời khóa biểu 5 hàng Slot gộp lớp nhóm + PT 1:1; điểm danh Có mặt/Vắng mặt và xem lịch sử 31 ngày qua `/api/v1/attendance/sessions/**` (không khôi phục tab đánh giá buổi tập vì `app.coaching.evaluations.enabled=false`).
- **Thông báo & lịch công khai:** ghi danh/checkout/hủy ghi danh (`class_enrollment`), đổi lịch buổi học (`schedule_change` gửi cả học viên đã đặt và HLV phụ trách), hủy buổi học (gửi học viên không trùng lặp và gửi HLV phụ trách nếu Quản lý hủy). `GET /api/v1/public/catalog` trả các buổi lớp nhóm sắp tới trong 7 ngày tới theo 5 Slot cố định cho Landing, trang bộ môn (`/boxing`, `/yoga`, `/sports/:sportId`) và trang HLV công khai.

---

## 4. Flow 3 — Thanh toán, Ví, hóa đơn, hoàn tiền, báo cáo

### 4.1 Phương thức thanh toán
| Phương thức | Ai thực hiện | Ghi chú |
|---|---|---|
| VNPay | Hội viên | Kiểm chữ ký và số tiền ở IPN. Giao dịch quá hạn được đóng sau 15 phút ân hạn. IPN thành công đến muộn cho đơn đã hủy thì tiền vào Ví. |
| Ví SÖL | Hội viên | Trừ ngay, khóa dòng ví, chống trừ trùng theo mã tham chiếu. |
| Tiền mặt / POS / chuyển khoản | Lễ tân xác nhận | `PATCH /payments/{id}/status` chỉ đi `pending → success/failed`, `failed → pending`, và chỉ cho payment gói tập. Payment PT 1:1 và nạp Ví bị từ chối (`PAYMENT_STATUS_USE_TARGET_FLOW`): lễ tân thu tiền PT ở `/staff/reception` để đồng thời đánh dấu buổi đã trả, nạp Ví ở màn ví. |

**State `payments.status`:** `pending` → `success` / `failed`; `failed` → `pending`; `success` → `refunded` (hoàn đủ). Hoàn một phần thì vẫn `success` và ghi `refundedAmount`. Doanh thu luôn tính `netAmount = amount − refundedAmount`.

### 4.2 Ví
**Màn hình:** ví trong `/member/dashboard`; lễ tân nạp ở `/staff/reception`. **API:** `/api/v1/wallet`.

- Nạp qua VNPay hoặc tại quầy, mỗi lần 10.000 đ – 100.000.000 đ.
- Mọi khoản hoàn (hủy gói, hủy khóa học nhóm, PT 1:1) đều vào Ví. Mỗi khoản có mã tham chiếu riêng (`CANCEL_REQ_`, `COURSE_REFUND_`, `COACH_REFUND_`; `ORDER_REFUND_` và mã hoàn cũ khác chỉ còn ở dữ liệu lịch sử) nên không hoàn trùng.

### 4.3 Hoàn tiền thủ công
**Màn hình:** `/manager/reports` / chi tiết giao dịch. **API:** `POST /api/v1/payments/{id}/refund` (chỉ Quản lý).

- Chỉ hoàn payment `success`, không vượt phần còn lại. Payment VNPay đã thành công không hoàn được ở đây.
- Payment được khóa dòng khi hoàn để hai yêu cầu đồng thời không cùng hoàn.
- Hoàn đủ gói tập: hủy gói, hủy các lịch không còn quyền, khôi phục kỳ cũ nếu là kỳ nâng cấp.
- **Payment PT 1:1 không được hoàn đủ ở đây.** Phải hủy buổi để vừa hoàn tiền vừa giải phóng lịch HLV. Hoàn một phần (bồi thường) vẫn được; khi hủy sau đó hệ thống chỉ hoàn phần còn lại.

### 4.4 Hóa đơn và báo cáo
- Payment thành công tự phát hành hóa đơn. Hội viên xem và tải ở `/member/invoices`.
- `/manager/reports`: doanh thu theo ngày, theo gói, giao dịch gần đây, tỷ lệ gia hạn, bản chụp báo cáo (`report_snapshots`). Báo cáo tỷ lệ lấp đầy lớp (`/admin/audit-logs`) tổng hợp dữ liệu các lớp học nhóm.
- `/admin/payments`: đối soát VNPay, tối đa 92 ngày mỗi lần xem.

---

## 5. Flow 4 — Quản trị và cấu hình

| Chức năng | Màn hình | Ai |
|---|---|---|
| Người dùng: khóa/mở, đổi vai trò, xóa mềm | `/manager/users`, `/admin/users` | Quản lý, Admin |
| Tài khoản nhân viên (HLV, lễ tân) | `/manager/staff-accounts` | Quản lý |
| Danh mục: bộ môn, phòng, gói tập | `/manager/catalogs` | Quản lý. Vận hành 3 bộ môn (`Gym`, `Boxing`, `Yoga`) và 4 phòng (`Phòng Gym Tiêu chuẩn`, `Phòng Gym VIP`, `Zen Garden Studio`, `Ring Arena 01`). API trả toàn bộ bộ môn và phòng trong DB, không lọc cứng theo tên; frontend cũng không lọc. Dữ liệu cũ ngoài phạm vi được dọn theo [`DATA_CLEANUP.md`](DATA_CLEANUP.md) |
| Xem và điều chuyển HLV phụ trách (không phân công mới), sắp xếp theo tên/số học viên/trạng thái (`sortBy`, `sortDir`) | `/manager/coach-assignments` | Quản lý |
| Yêu cầu nội bộ: nghỉ phép, đổi ca, đổi lịch, khác | `/staff/requests` (gửi), `/manager/requests` (duyệt) | Nhân viên, Quản lý |
| Nhật ký kiểm toán | `/admin/audit-logs` | Admin |

- Không khóa được Admin/Quản lý hoạt động cuối cùng.
- Hội viên còn gói hoặc lịch sắp tới, HLV còn lớp hoặc PT sắp tới thì không đổi vai trò/xóa được cho tới khi xử lý xong.
- **Khóa tài khoản:** HLV còn lớp hoặc PT sắp tới thì không khóa được (phải bàn giao trước, như khi xóa). Khóa hội viên thì khóa học và PT đã trả vẫn giữ (booking theo buổi cũ, nếu còn, bị hủy).
- Đơn nghỉ phép đã duyệt chặn xếp lớp cho HLV vào ngày đó.
- Các thao tác thay đổi dữ liệu quan trọng được ghi `audit_logs` qua `@Audited`.

---

## 6. Flow 5 — HLV: PT 1:1, giáo án, AI

### 6.1 Đặt PT 1:1
**Màn hình:** `/member/classes` (lịch của tôi 5 hàng Slot, `?tab=pt` để đặt/hủy/thanh toán trên 5 thẻ Slot cố định), `/member/dashboard`; HLV ở `/coach/classes` (lịch tuần 5 hàng Slot) và `/coach/pt-attendance`; lễ tân thu tiền buổi chưa trả ở `/staff/reception`. **API:** `/api/v1/coach-bookings`.

- **5 Slot cố định (`07:00 – 20:30`):** PT 1:1 dùng chung 5 slot chuẩn với lớp học nhóm (`Slot 1` `07:00 – 09:30`, `Slot 2` `09:45 – 12:15`, `Slot 3` `12:30 – 15:00`, `Slot 4` `15:15 – 17:45`, `Slot 5` `18:00 – 20:30`). `GET /api/v1/coach-bookings/available-slots` trả đúng 5 phần tử kèm `slotNumber` (`1..5`), trạng thái trống và lý do bận (`coach_on_leave`, `too_soon`, `coach_busy`, `member_busy`). Gửi khung giờ ngoài 5 slot trả `400 INVALID_COACH_BOOKING_SLOT` (đồng thời được trigger `scms_is_valid_schedule_slot` / `trg_schedule_invalid_slot` bảo vệ ở DB).
- **Đặt trước & điều kiện gói:** đặt trước giờ bắt đầu slot tối thiểu **2 giờ**. Cần gói `active` bao phủ cả hôm nay và ngày tập; ngày tập nằm trong khoảng bảo lưu đã duyệt thì bị chặn (`MEMBERSHIP_ON_HOLD`).
- **Đơn giá & hạn mức:** mỗi chu kỳ có số slot miễn phí theo hạng gói; slot đặt thêm tính giá **`200.000đ / slot`** (giảm theo hạng gói Gold 10%, Platinum 20%). Tối đa **2 buổi chưa trả** sắp tới.
- **Chống trùng lịch & gỡ bỏ giới hạn nghỉ liên tiếp:** không trùng slot với lớp học nhóm hoặc PT 1:1 khác của HLV hay hội viên (bảo vệ hai chiều PT 1:1 ↔ lớp nhóm). **Đã gỡ bỏ hoàn toàn giới hạn bắt buộc HLV nghỉ liên tiếp giữa các slot PT** (`requiresCoachRest` / `coach_rest` / `trg_coach_bookings_rest_required`) do mỗi ngày chỉ có 5 slot cố định và giữa mọi slot đều có 15 phút nghỉ.
- Hủy trước giờ bắt đầu: lượt miễn phí được trả lại, tiền đã trả vào Ví.
- Ghi nhận đến: HLV đánh dấu tay từ giờ bắt đầu (API vẫn cho lễ tân/quản lý); **quét cổng không tự ghi nhận**. Màn `/coach/pt-attendance` hiện tag "Đã check-in HH:mm" khi hội viên có lượt vào cổng phủ buổi (vào trong 3 giờ trước giờ tập, còn trong trung tâm lúc bắt đầu). Gỡ đánh dấu có mặt của người có tag phải xác nhận lại.

**State `coach_bookings.status`:** `confirmed` → `cancelled`, hoặc `completed` (tự động, 3 ngày sau buổi tập).

### 6.2 Giáo án và AI
**Màn hình:** `/coach/training-plans`, `/coach/saved-plans`; hội viên ở `/member/progress` (trang "Giáo án"). **API:** `/api/v1/coaching/training-plans`, `/api/v1/ai`.

1. HLV xem hồ sơ học viên được phân công (trình độ, mục tiêu, ghi chú sức khỏe, chiều cao/cân nặng/BMI có sẵn). **Giáo án riêng chỉ soạn cho hội viên đã đăng ký ít nhất một buổi PT 1:1 (chưa hủy) với chính HLV đó và đang có gói Gold/Platinum còn hạn** (gói dùng thử tính như Gold); Silver thì bị từ chối (`PT_SESSION_REQUIRED`, `PLAN_TIER_REQUIRED`). Quản lý không còn thao tác "phân công học viên mới" thủ công.
2. HLV tự soạn hoặc bấm "Yêu cầu AI hỗ trợ". AI trả danh sách bài tập, sets, reps, nghỉ (tối đa 40 mục) và ghi `ai_recommendation_logs`. Trợ lý không còn tải lịch sử số đo.
3. HLV chỉnh rồi áp dụng: giáo án `active`, log AI đánh dấu `is_applied` và gắn vào giáo án.
4. Mỗi cặp hội viên–HLV chỉ có một giáo án `active`. Giáo án cũ chuyển `superseded` và có thể áp dụng lại. **Điều chuyển HLV (`/manager/coach-assignments`):** chuyển buổi PT 1:1 sang HLV mới thì toàn bộ giáo án (active, draft, lịch sử) của hội viên với HLV cũ chuyển theo để HLV mới sửa tiếp; HLV cũ mất quyền sửa, xóa, áp dụng lại. Nếu HLV mới đã có giáo án active cho hội viên thì giáo án kế thừa vào lịch sử.
5. Hội viên chỉ **xem** giáo án đang áp dụng theo ngày ở `/member/progress`; không còn đánh dấu bài đã tập, lịch sử tập hay chuỗi ngày tập. Hội viên Silver không xem được giáo án.

**State `training_plans.status`:** `draft` → `active` → `superseded` / `cancelled`, hoặc `completed` (tự động khi qua `end_date`).

### 6.3 Đánh giá và xếp hạng HLV (đã ngừng)
- Bảng xếp hạng HLV (`/api/v1/coaching/leaderboard`) đã xóa hẳn (23/11/2026).
- Đánh giá HLV của hội viên, đánh giá buổi tập và tổng kết/thưởng tháng cũng đã ngừng. `CoachReviewController`, `SessionEvaluationController` chỉ nạp khi bật `app.coaching.reviews.enabled` / `app.coaching.evaluations.enabled` (mặc định tắt); endpoint `monthly-reviews` đã xóa hẳn. Bảng `coach_reviews`, `coach_monthly_reviews` còn giữ dữ liệu cũ.

---

## 7. Flow 6 — Trợ lý AI, thông báo, chat, hỗ trợ

### 7.1 Trợ lý AI
**Màn hình:** tab AI trong `/messages`. **API:** `/api/v1/ai/chat`.
- Hội viên và nhân viên đều có phiên chat riêng. AI trả lời dựa trên kiến thức trung tâm (`ai/sol-knowledge.md`, mô tả 3 bộ môn `Gym`, `Boxing`, `Yoga`, 4 phòng tập, khung lịch 5 Slot cố định `07:00 – 20:30`, lớp học nhóm định kỳ, PT 1:1, gói tập, bảo lưu, ví, check-in) và dữ liệu của chính người hỏi (lịch lớp/PT, giáo án). Có giới hạn tần suất. Lịch sử lưu ở `ai_chat_sessions` / `ai_chat_messages`.

### 7.2 Thông báo
**Màn hình:** `/member/notifications`. **API:** `/api/v1/notifications`.
| Loại | Khi nào |
|---|---|
| `schedule_change` | Lịch lớp bị đổi giờ/hủy, hoặc lịch PT bị hủy/đổi HLV |
| `booking` | Đăng ký/giữ chỗ hoặc hủy ghi danh khóa học nhóm |
| `package_expiry` | Gói còn ≤ 7 ngày (8:00 hằng ngày) |
| `class_reminder` | Buổi lớp sắp bắt đầu (nhắc tự động 30 phút/lần) |
| `payment` | Thanh toán, hoàn tiền, Ví |
| `support_reply` | Có phản hồi phiếu hỗ trợ |
| `system` | Còn lại |

`schedule_change`, `package_expiry`, `payment`, `password_changed` còn được gửi qua email.

### 7.3 Chat trực tiếp
`/messages`: hội viên chat với HLV phụ trách; nhân viên chat với nhau. Cập nhật thời gian thực qua Supabase Realtime. Quản lý không có chat trực tiếp (API chat không mở cho quản lý); ở `/messages` quản lý chỉ có tab Hỗ trợ & Khiếu nại và SÖL AI.

### 7.4 Hỗ trợ và khiếu nại
**Màn hình:** tab "Hỗ trợ & Khiếu nại" trong `/messages` cho hội viên, lễ tân và quản lý. `/manager/support` chỉ còn chuyển hướng tới `/messages?tab=support`; thông báo phiếu hỗ trợ của quản lý cũng mở tab này. **API:** `/api/v1/support/requests`.

1. Hội viên tạo phiếu theo loại (gói tập, lớp học, thanh toán, …). Lễ tân nhận thông báo.
2. Lễ tân trả lời ngay trong phiếu. Trả lời phiếu `open` thì phiếu tự sang `in_progress`.
3. Lễ tân không xử lý được thì **chuyển cấp** kèm lý do. Từ đó chỉ Quản lý xử lý (trả lời, đổi trạng thái ngay trong khung Tin nhắn; quản lý không có nút chuyển cấp), lễ tân chỉ xem.
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
3. **Chống quay vòng:** lượt `GRANTED` chưa có giờ ra chặn lượt vào thứ hai. Khi đủ 8 giờ (`checkInTime <= now - 8 giờ`), scheduler kiểm tra mỗi phút theo giờ Việt Nam và lần check-in tiếp theo tự đóng phiên: `checkOutTime = checkInTime + 8 giờ`, ghi chú `SYSTEM_AUTO_CHECKOUT`. Khóa và kiểm tra lại trước khi ghi, không ghi đè phiên đã đóng; lần chạy sau xử lý cả phiên tồn đọng sau restart/gián đoạn.
4. Hội viên chỉ cần check-in, không bắt buộc check-out thủ công. UI/endpoint quét cổng hoặc lễ tân được giữ trong giai đoạn Backend này. Giờ kết thúc tự động là mốc theo quy tắc, không chứng minh giờ rời thực tế; không sửa lịch sử đã lưu.
5. Chuỗi ngày tập (streak) đã gỡ: không còn `GET /check-in/streak` hay trang `/member/streak`.

---

## 9. Đặt sân (đã gỡ bỏ hoàn toàn)
Tính năng đặt sân tự do theo giờ đã được **gỡ bỏ hoàn toàn** khỏi codebase (25/11/2026): xóa trọn module `com.swp391.scms.courts.*`, toàn bộ endpoint `/api/v1/courts/**` và `/api/v1/court-bookings/**`, trigger đặt sân, hợp đồng OpenAPI đặt sân cùng toàn bộ UI, route và nhãn đặt sân ở frontend.

---

## 10. Cửa hàng thực phẩm bổ sung (đã ngừng)
Từ 22/11/2026 (PR #146, #155) không còn cửa hàng. Mọi controller của module `shop`, `ProductSeeder` và `ProductOrderExpiryScheduler` chỉ nạp khi bật `app.shop.enabled=true` (mặc định tắt). Màn sản phẩm, giỏ hàng, checkout, đơn hàng của hội viên, lễ tân và quản lý đã gỡ; link cũ về landing hoặc `/member/invoices`. Bảng `products`, `product_orders` còn dữ liệu cũ.

> **Chưa quyết:** đơn đã thanh toán nhưng chưa nhận, hoặc đơn chưa thanh toán, tạo trước khi tắt cửa hàng không còn màn hình nào xử lý và không còn job tự hủy.

---

## 11. Job định kỳ và ràng buộc database

### 11.1 Job định kỳ
| Job | Lịch | Việc làm |
|---|---|---|
| `MembershipLifecycleScheduler` | 00:15 hằng ngày | Bắt đầu/kết thúc bảo lưu, hủy lịch không còn gói bao phủ |
| `SessionCompletionScheduler` | 00:30 hằng ngày | Đóng các buổi lớp nhóm đã kết thúc (đang bật cùng `app.legacy.classes-enabled=true`) |
| `CoachingCompletionScheduler` | 00:35 hằng ngày | PT 1:1 đã qua 3 ngày, giáo án hết hạn → `completed` |
| `CourseAttendanceService` | 30 phút | Tự đánh vắng buổi lớp nhóm đã kết thúc nếu chưa điểm danh |
| `CenterCheckinService` | Mỗi phút, Asia/Ho_Chi_Minh | Đóng phiên GRANTED còn mở đã đủ 8 giờ, lưu giờ vào +8 giờ |
| `SupportRequestService` | Hằng giờ | Đóng phiếu `resolved` quá 72 giờ |
| `NotificationScheduler` | 8:00 và 30 phút | Nhắc gia hạn gói và nhắc buổi lớp sắp bắt đầu |
| `VnpayExpiryScheduler` | 1–5 phút | Đóng giao dịch VNPay quá hạn |
| `CourseEnrollmentExpiryScheduler` | 1–5 phút | Hủy giữ chỗ học phí khóa học chưa thanh toán quá hạn (đơn hàng cửa hàng vẫn tắt: `ProductOrderExpiryScheduler`; scheduler đặt sân đã gỡ bỏ hoàn toàn) |
| `LegacyScheduleSlotResetRunner` | Khi khởi động (`@Order(195)`, idempotent) | Kiểm tra dữ liệu lịch lệch ngoài 5 slot chuẩn (`classes`, `class_sessions`, `coach_bookings`); nếu phát hiện dữ liệu cũ thì tháo khóa ngoại an toàn, xóa sạch dữ liệu lịch cũ một lần rồi để `DemoClassSeeder`/`DemoDataSeeder` tạo lại dữ liệu mới chuẩn 5 slot (no-op ở các lần khởi động sau) |
| `RetiredCatalogCleanupRunner` | Khi khởi động | Dọn bộ môn, phòng tập, lớp mẫu đã ngừng và đồng bộ chuyên môn HLV mẫu; **không còn** vô hiệu hóa trùng lặp các lớp `active` cùng bộ môn để bảo toàn nhiều lớp `active` mỗi bộ môn qua các lần khởi động lại |

### 11.2 Ràng buộc trong database
Định nghĩa trong `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql`, cài sau Hibernate. Lỗi được dịch ra HTTP `400`/`403`/`409` kèm i18n ở `GlobalExceptionHandler`. Các trigger lớp học nhóm, PT 1:1 và kiểm tra 5 slot cố định đang hoạt động bắt buộc (theo `AGENTS.md`); trigger đặt sân và nhánh bắt buộc HLV nghỉ liên tiếp (`trg_coach_bookings_rest_required`) đã được gỡ bỏ hoàn toàn.

| Ràng buộc | Chặn |
|---|---|
| `scms_is_valid_schedule_slot` / `trg_schedule_invalid_slot` | Bắt buộc `(start_time, end_time)` của cả `class_sessions` (`status <> 'cancelled'`) và `coach_bookings` (`status = 'confirmed'`) khớp đúng 1 trong 5 slot cố định (`07:00–09:30`, `09:45–12:15`, `12:30–15:00`, `15:15–17:45`, `18:00–20:30`), map ra HTTP `400 SCHEDULING_INVALID_SLOT` |
| `trg_enrollments_check_capacity` | Đăng ký cả lớp vượt sức chứa (tính cả buổi đông nhất của booking theo buổi) |
| `trg_session_bookings_check_capacity` | Booking theo buổi + đăng ký cả lớp vượt sức chứa |
| `trg_sessions_check_conflict` & `trg_sessions_check_discipline_conflict` (`scms_check_session_conflict`) | Khung giờ lệch ngoài 5 slot chuẩn (`scms_is_valid_schedule_slot` → `400 SCHEDULING_INVALID_SLOT`), HLV hoặc phòng trùng giờ (chỉ xét buổi không bị hủy), và trùng ngày & slot giữa hai lớp đang hoạt động cùng bộ môn (`trg_sessions_check_discipline_conflict` → `409 SCHEDULING_DISCIPLINE_CONFLICT`) |
| `trg_enrollments_check_membership` | Đăng ký/đặt buổi/PT khi không có gói hợp lệ. Đặt buổi cần một kỳ phủ cả hôm nay và ngày học |
| `trg_checkins_check_membership` | Check-in `GRANTED` khi gói không hợp lệ |
| `trg_member_schedule_conflict` | Hội viên học hai buổi lớp trùng giờ |
| `scms_guard_pt_schedule` (`trg_pt_schedule_*`) | PT 1:1 trùng lớp nhóm/PT khác của HLV hoặc hội viên và khung giờ lệch ngoài 5 slot chuẩn (`scms_is_valid_schedule_slot`). Đã gỡ bỏ hoàn toàn nhánh bắt buộc HLV nghỉ liên tiếp (`trg_coach_bookings_rest_required`). Thao tác hủy/hoàn thành không lấy khóa lịch chung |
| `uq_session_booking_active`, `uq_enrollment_active` | Một hội viên giữ hai chỗ `booked` cùng buổi/lớp |

---

## 12. Khác biệt so với thiết kế gốc
| Thiết kế gốc (`PROJECT_MASTER_GUIDE.md`) | Đang chạy |
|---|---|
| `users`: `[Đang đăng ký]`, `inactive` = tạm ngưng | `inactive` dùng cho tài khoản chờ OTP; Quản lý chỉ đặt `active`/`locked` |
| Gói tự chuyển `expired` khi hết hạn | Hết hạn xác định theo `end_date`; `expired` chỉ dùng cho kỳ bị thay khi nâng cấp. Có thêm `frozen` (bảo lưu) |
| Giáo án: `draft/active/completed/cancelled` | Có thêm `superseded` (giáo án cũ khi áp dụng giáo án mới) |
| Hủy lớp "trước giờ học quy định" | Hủy được tới giờ bắt đầu |
| Lớp học nhóm, đặt chỗ, điểm danh lớp | Đang vận hành khóa học định kỳ & điểm danh lớp nhóm cho 3 bộ môn (`Gym`, `Boxing`, `Yoga`; hỗ trợ nhiều lớp `active`/môn không trùng ngày & slot cùng bộ môn, wizard tạo lớp 4 bước kèm tiền kiểm tra khả dụng) cùng PT 1:1 theo **5 Slot cố định (`07:00 – 20:30`)** từ 25/11/2026 (`SingleSessionPolicy` vẫn tắt đặt buổi lẻ) |
| Đánh giá và xếp hạng HLV, theo dõi tiến độ/chỉ số cơ thể, thiết bị | Đã ngừng từ 22–23/11/2026 |
| Hỗ trợ: nhân viên không mở lại phiếu đã giải quyết | Nhân viên được `resolved → in_progress` khi hội viên còn vấn đề |
| Xuất Excel/PDF báo cáo | Chỉ có hóa đơn PDF của hội viên; báo cáo xem trên web và lưu snapshot JSON |
| Push/SMS | Thông báo trong ứng dụng và email; chưa có SMS |
| Không có | PT 1:1, Ví, dùng thử có duyệt giấy tờ, bảo lưu gói, chat trực tiếp, chuyển cấp khiếu nại (quản lý xử lý trong `/messages`). Tính năng đặt sân đã gỡ bỏ hoàn toàn; cửa hàng hiện tắt qua cờ legacy |
