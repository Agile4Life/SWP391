# Báo Cáo Kiểm Toán Toàn Diện Hệ Thống SÖL Fitness (SCMS)

- **Ngày lập báo cáo:** `2026-11-26` (Asia/Ho_Chi_Minh, UTC+7)
- **Nhánh & Commit kiểm toán:** `main` @ `84aa8964199165e64d36b9845faf04803ebf33bf` (sau PR #187, #188, #189 — hệ thống 5 Slot cố định, đa lớp/bộ môn & wizard tạo lớp 4 bước)
- **Phương pháp:** Huy động **20 sub-agent chuyên biệt chạy song song** đọc kiểm từng dòng mã nguồn 100% kho mã hoạt động (`apps/web`, `apps/api`, PostgreSQL triggers, i18n bundles, AI Knowledge Base, 24 file OpenAPI, Docker/Nginx/YAML), đối soát hợp đồng API FE↔BE tự động, chạy toàn bộ bộ unit/component test + lint + typecheck + build production, và chạy kiểm thử **E2E trên trình duyệt Chromium thực (`playwright-core`)** trên đầy đủ 5 vai trò × Desktop/Mobile × Light/Dark × VI/EN.
- **Trạng thái kho mã:** Chỉ đọc & kiểm toán — không chỉnh sửa mã nguồn ứng dụng (`git status` sạch, chỉ thêm duy nhất tệp báo cáo này).

---

## 1. Tổng Quan Điều Hành (Executive Summary)

### 1.1. Phạm vi đã kiểm toán (100% mã nguồn đang hoạt động)

| Hạng mục | Số lượng đã kiểm tra | Ghi chú |
|---|---:|---|
| **Frontend mã nguồn hoạt động (`apps/web/src`)** | **243 file** | 201 file `.ts`/`.tsx` + 42 file `.css` (9 sub-agent `FE-1` → `FE-8`). `features/explore3d/**` (86 file) đang ẩn/ngủ đông, 0 byte trong production bundle. |
| **Backend Java chính (`apps/api/src/main/java`)** | **489 file** | Toàn bộ 17 package nghiệp vụ & hạ tầng (8 sub-agent `BE-1A` → `BE-7`). |
| **CSDL, Trigger, i18n, AI KB & Hạ tầng** | **13 file cốt lõi** | `postgresql-triggers.sql` (837 dòng, 21 trigger + RLS), 3 bundle `messages*.properties` (1.105 key/file), `sol-knowledge.md`, `application*.yml`, `compose.yml`, 2 `Dockerfile`, `nginx.conf`. |
| **Hợp đồng OpenAPI (`docs/api-contracts/*.yaml`)** | **24 file** | Đối soát 1:1 với toàn bộ 334 endpoint Spring MVC. |
| **Kiểm thử tự động & QA Scripts** | **382 file** | 153 file Vitest FE (1.173 test), 205 file Maven BE (1.561 test), 24 script `scripts/qa/*`, cộng thêm bộ Playwright Chromium E2E mới chạy thực tế (`E2E-2`). |

### 1.2. Bảng điểm tổng hợp lỗi theo mức độ nghiêm trọng (sau đối soát chéo & loại trùng)

> **Lưu ý về khử trùng lặp:** 20 sub-agent báo cáo tổng cộng **372 phát hiện thô** (`20 P0`, `134 P1`, `158 P2`, `60 P3`). Sau khi đối soát chéo FE ↔ BE ↔ DB Trigger ↔ Playwright E2E và gộp các phát hiện cùng nguyên nhân gốc (mỗi mục đều ghi rõ mã nguồn gốc `[Nguồn: ...]`), toàn hệ thống còn lại **các lỗi độc lập đã xác minh 100% trên mã nguồn** như bảng sau (số liệu được kiểm đếm khớp chính xác với danh mục bên dưới):

| Mức độ | Tổng số lỗi độc lập | Phân bố chính | Đánh giá rủi ro phát hành |
|---|---:|---|---|
| **P0 — Critical (Chặn phát hành)** | **16** | Tài chính/Ví/VNPay (5), Lịch học & Wizard/Trigger (6), Bảo mật Auth/OAuth/OTP/Session (3), Giao dịch Audit/CI Postgres (2) | **KHÔNG ĐẠT** — Cần khắc phục ngay trước khi vận hành chính thức |
| **P1 — High (Nghiêm trọng)** | **125** | Frontend (`65`), Backend & DB (`57`), Kiểm thử/CI (`3`) | Gây sai lệch dữ liệu, vượt quyền, mất thông báo, lỗi đối soát hoặc hỏng luồng nghiệp vụ quan trọng |
| **P2 — Medium (Trung bình)** | **143** | Frontend (`80`), Backend/DB/OpenAPI (`60`), Test/QA (`3`) | Lệch timezone, hiệu năng N+1, lỗi tương phản Dark/Light, song ngữ VI/EN, trôi hợp đồng OpenAPI |
| **P3 — Low (Thấp & Nợ kỹ thuật)** | **56** | Frontend (`32`), Backend/i18n (`22`), Build/Test hygiene (`2`) | Code chết, CSS/i18n dư thừa, cảnh báo biên dịch/test, hoàn thiện chi tiết UX |
| **TỔNG CỘNG** | **340** | Bao phủ 100% hệ thống (`dups = 0`) | — |

### 1.3. Điểm mạnh đã xác minh hoạt động tốt
- **Toàn bộ 222/222 lời gọi API từ Frontend** khớp 100% với endpoint đang bật trên Backend (0 gọi nhầm tính năng tắt cờ như Shop/Equipment/Health Metrics/Reviews/Courts).
- **Hệ thống 5 Slot cố định (`07:00 – 19:30`)** đồng nhất hoàn toàn giữa `ScheduleSlot.java`, `postgresql-triggers.sql`, và `slots.ts`; đã gỡ sạch quy tắc nghỉ liên tiếp HLV (`coach_rest`) và tính năng đặt sân (`courts`).
- **Kiểm tra chữ ký VNPay HMAC-SHA512 (`MessageDigest.isEqual`)**, so sánh số tiền bằng `BigDecimal`, chống replay IPN qua `gateway_transaction_no UNIQUE`, khóa bi quan `FOR UPDATE` trên ví hiện hữu, QR động 60s (`SOL:GATE:` & `DYN:`), và cô lập hoàn toàn 7 controller Shop khi `app.shop.enabled=false` đều đạt chuẩn cao.
- **0 lỗi ESLint**, **0 lỗi TypeScript**, **0 lỗi `vite build`** (317 ms), **1.173/1.173 Vitest pass**, **1.523/1.523 Maven unit/MockMvc test pass**, **0 rò rỉ `@Entity` trực tiếp**, **0 lỗ hổng XSS `dangerouslySetInnerHTML`**, **0 màu Volt `#c8fa3c` sót lại**, **0 tràn ngang trên Desktop `1440×900` và Mobile `390×844`**.

---

## 2. Kết Quả Kiểm Thử Tự Động, Đối Soát Tĩnh & Playwright Chromium E2E

### 2.1. Bộ kiểm thử tự động & Build (`E2E-3` & `E2E-1`)

| Hạng mục | Lệnh chạy | Kết quả | Chi tiết đo đạc |
|---|---|---|---|
| Frontend Unit/Component | `npm test` (`vitest run` v5.0.3) | **PASS** | **153/153 file**, **1.173/1.173 test pass**, 0 fail, 0 skip (18,73s). Còn 2 cảnh báo duplicate React key (`ManagerCoachAssignmentsPage.tsx:460`, `publicCatalog.test.tsx:186`) & 6 file cảnh báo `act(...)`. |
| Frontend ESLint | `npm run lint` (`eslint . --max-warnings=0`) | **PASS** | 0 lỗi, 0 cảnh báo. |
| Frontend TypeScript | `tsc -p tsconfig.app.json --noEmit` & `tsconfig.node.json` | **PASS** | 0 lỗi *(lưu ý: `tsc --noEmit` gốc chỉ kiểm 0 file vì `tsconfig.json` dùng `"files": []` + references)*. |
| Frontend Production Build | `npm run build` (`tsc -b && vite build` v8.3.5) | **PASS** | 428 module trong 317 ms, 0 cảnh báo. `explore3d`/`three-vendor` tree-shake còn **0 B**. Chunk >200 kB: `react-vendor` (218,75 kB / gz 68,27 kB), `dist-*.js` chứa `@supabase/supabase-js` chưa đặt tên chunk (214,38 kB / gz 55,16 kB), `html2canvas` lazy (199,40 kB). |
| Backend Maven Test Suite | `./mvnw test` | **PASS (CÓ 38 SKIP)** | **1.561 test**: **1.523 pass**, 0 fail, 0 error, **38 skipped** (203 lớp Surefire, 37,1s). `DatabasePolicyTest` (3/3) & `DatabaseProfilesTest` (8/8) đều pass. 3 cảnh báo MapStruct unmapped (`UserMapper.java:14`, `PaymentMapper.java:42,54`), 20 cảnh báo `@MockBean` deprecated. |
| Database Config Script | `scripts/test-database-config.ps1` | **CHƯA CHẠY LOCAL** | Máy macOS không cài `pwsh`; script chạy trong CI `.github/workflows/pipeline.yml:87-90`. |
| Đối soát API FE ↔ BE | Quét tĩnh AST (`E2E-1`) | **PASS** | **222/222** lời gọi FE khớp **334** endpoint BE; 24 lời gọi có điều kiện đều trỏ vào `app.legacy.classes-enabled=true`; 0 lời gọi vào endpoint tắt cờ. |
| Đối soát Route & Link FE | Quét tĩnh 44 route `router.tsx` (`E2E-1`) | **PASS** | 29 trang hoạt động, 14 redirect, 1 wildcard `*`; 0 link chết, 0 trang mồ côi. |

### 2.2. Kết quả kiểm thử trình duyệt Chromium thực tế (`E2E-2` — `playwright-core`)

Chạy trực tiếp bản build `apps/web/dist` qua `vite preview --host 127.0.0.1 --port 4179` trên Chromium headless thực:

| Nhóm kiểm thử | Tổ hợp đã chạy | Kết quả | Phát hiện thực tế trên trình duyệt |
|---|---|---|---|
| **Trang công khai & Auth** (`/`, `/boxing`, `/yoga`, `/login`, `/register`, `/forgot-password`) | **48 lượt** (`1440×900` & `390×844` × Light & Dark × VI & EN) | **40/40 PASS** (+ `/forgot-password` → `/` đúng thiết kế inline trong `/login`) | 0 `console.error`, 0 `pageerror`, 0 tràn ngang, 0 ảnh vỡ, 0 tên môn đã gỡ (`Bơi lội`, `Tennis`, `Cầu lông`, `Đặt sân`). |
| **Chuyển hướng Route cũ / đã gỡ** | **18 kịch bản** trên các role | **13 PASS / 5 LỖI** | `/member/explore`→`/member/dashboard`, `/tennis|/swimming|/badminton|/courts`→`/`, `/staff/classes`, `/manager/products|equipment|coach-reviews`, `/coach/health-metrics` đều **PASS**. **LỖI:** `/sports/tennis|swimming|badminton` giữ nguyên URL và render trang Boxing (**P1**); `/member/orders` & `/member/streak` đẩy hội viên ra trang công khai `/` thay vì `/member/dashboard` (**P2**). |
| **Manager Portal & Wizard 4 bước** (`/manager/classes`, `/reports`, `/catalogs`, `/staff-accounts`, `/coach-assignments`, `/requests`) | Desktop Dark/Light + Mobile Dark + Tương tác Wizard | **FAIL P0 ở Bước 3→4** | 3 tab độc lập, 5 hàng `Slot 1`–`Slot 5`, `borderLeftWidth === "1px"`, `.mcal__event-coach` hiển thị rõ, 0 nút `+ Thêm buổi`, nút `+ Tạo lớp học` mở khi cả 3 môn đã có lớp, Bước 1–3 kiểm tra conflict phòng/HLV/sức chứa **PASS**. **LỖI P0-01:** Bấm "Tiếp tục" ở Bước 3 tự động gửi `POST /api/v1/classes/recurring` ngay lập tức & bỏ qua Bước 4 Xác nhận! |
| **Member Portal** (`/member/dashboard`, `/packages`, `/classes` [2 tab], `/progress`, `/card`, `/invoices`, `/profile`, `/hold`, `/notifications`, Chat Widget) | Desktop Dark/Light + Mobile Dark + Tương tác | **PASS (kèm 1 lỗi copy)** | Sidebar đúng 6 mục (0 mục 3D/Shop/Orders/Streak/Courts), `MemberCalendar` 5 slot + không viền trái 4px + hiện tên HLV, PT 1:1 5 slot + 0 `coach_rest`, Chat Widget mở SÖL AI sạch 0 lỗi. **LỖI P1/P2:** Tab PT 1:1 vẫn hiện `"200.000 đ / giờ"` thay vì `"/ slot"`. |
| **Coach Portal** (`/coach/pt-attendance`, `/attendance`, `/classes`, `/training-plans`, `/saved-plans`, `/staff/requests`) | Desktop Dark/Light + Mobile Dark | **PASS hiển thị** | Lưới 5 slot hiển thị chuẩn, 0 tab đánh giá/chỉ số cơ thể *(lỗi `P0-06` truyền chuỗi username làm `Long coachId` trên `/coach/classes` chỉ bộc lộ trước backend thực vì mock E2E không ép kiểu `Long`)*. |
| **Receptionist / Staff Portal** (`/staff/reception`, `/check-in`, `/check-out`, `/reception-history`, `/kyc`, `/holds`, `/requests`) | Desktop Dark/Light + Mobile Dark + VI/EN | **PASS** | Sidebar đúng 3 mục; nhãn KYC chuẩn song ngữ (`CCCD`/`Hộ chiếu` trong VI; `Identity card`/`Passport` trong EN, 0 rò rỉ enum/citizen ID). |
| **Admin Portal** (`/admin/users`, `/audit-logs`, `/payments`) | Desktop Dark/Light + Mobile Dark + VI/EN | **PASS (kèm P3)** | 0 tên bảng SQL thô lộ ra giao diện; còn tùy chọn lọc Shop đã tắt (`products`, `product_orders`) trong dropdown Audit Logs. |
| **Đo tương phản WCAG & Responsive** | `/manager/classes` Light & Dark, toàn bộ route | **PASS (trên trang mẫu)** | 0 font `< 12px`, 0 tràn ngang, đổi Light (`rgb(245,245,243)`) ↔ Dark (`rgb(32,32,32)`) 0 lỗi. Tương phản `/manager/classes`: Light H1 `14,93`, Primary Btn `6,20`, Active Tab `4,64`, Event `5,87`; Dark H1 `15,48`, Primary Btn `10,21`, Event `8,66` *(các lỗi tương phản cục bộ ở Chat, Landing arrow, Auth link & Portal danger hover đã được phát hiện trong kiểm toán CSS chi tiết)*. |

---

## 3. Lộ Trình Khắc Phục Ưu Tiên (Remediation Roadmap)

1. **Wave 0 — Khẩn cấp (Chặn mất tiền, chiếm đoạt tài khoản & xóa dữ liệu — làm ngay trong 24–48 giờ):**
   - Sửa toàn bộ **16 lỗi `P0-Critical`**, ưu tiên theo thứ tự tác động:
     1. Bảo mật & Tài chính: `P0-08` (Google OAuth Pre-Account Hijacking), `P0-09` (OTP Purpose Confusion & `/google/send-otp`), `P0-04` (`WALLET_TOPUP` tự trừ ví & `PaymentService` validation), `P0-10` (Hold làm sai lệch công thức nâng cấp/hoàn tiền), `P0-11` (`VnpayExpiryScheduler` race nhân đôi tiền ví), `P0-12` (`expireUnpaidBookings` race hủy PT đã thanh toán).
     2. Chức năng cốt lõi hỏng hoàn toàn: `P0-01` (Wizard Bước 3 tự submit bỏ qua Bước 4), `P0-02` (Đăng ký khóa học bằng Ví SÖL không trừ tiền & tự hủy sau 15 phút), `P0-03` (Lễ tân thiếu UI/API thu tiền mặt khóa học), `P0-05` (Xung đột enum `GymClass.status` crash DB), `P0-06` (`/coach/classes` truyền username làm `Long coachId`), `P0-07` (ChatWidget rò rỉ tin nhắn/Realtime khi đổi tài khoản).
     3. An toàn dữ liệu & Giao dịch hệ thống: `P0-14` (`LegacyScheduleSlotResetRunner` nguy cơ xóa sạch bảng lịch), `P0-13` (`SessionCompletionScheduler` lỗi `TransactionRequiredException`), `P0-15` (`AuditAspect` làm hỏng transaction PostgreSQL `25P02`), `P0-16` (Kích hoạt & sửa 38 bài test PostgreSQL trong CI).
2. **Wave 1 — Ưu tiên cao (Sprint tiếp theo — toàn bộ lỗi `P1-High`):**
   - Khóa toàn bộ lỗ hổng phân quyền & race condition: `SecurityConfig` matcher ordering (`/trial/requests/**` bị khóa 403, `HEAD /auth/me` 500), `POST /profile/kyc` thiếu `MEMBER`, `UserService` xóa nhầm gói đang hoạt động khi đổi role/xóa user, `AiRecommendationService` fail-open, `TrainingPlanService` IDOR, `VnpayGateway` open redirect, `CoachBookingService` lỗ hổng nhân đôi quota PT khi nâng cấp từ Trial/Gold, `trg_pt_schedule_booking` chặn điểm danh PT quá khứ, và toàn bộ lỗi KYC/Check-in/Attendance/AI KB/i18n `{0}`.
3. **Wave 2 — Ổn định vận hành, hiệu năng & chuẩn `DESIGN.md` (`P2-Medium`):**
   - Chuẩn hóa đồng bộ múi giờ `Asia/Ho_Chi_Minh` (Frontend `centerNowParts()`, Backend `Clock` & `@Scheduled(zone = "Asia/Ho_Chi_Minh")`, PostgreSQL `AT TIME ZONE`), khử toàn bộ N+1 query (`MemberLookupService`, `RevenueReportService`, `ClassService`, `CurrentCoachMembers`, `ChatService`), sửa toàn bộ lỗi tương phản WCAG Light/Dark và rò rỉ mã màu salmon trong Dark mode, đồng bộ 24 hợp đồng OpenAPI, và thay thế các script `scripts/qa/*` cũ bằng bộ Playwright E2E chuẩn 25/11/2026.
4. **Wave 3 — Dọn dẹp nợ kỹ thuật (`P3-Low`):**
   - Xóa code chết (`RoomDayTimetable.tsx`, CSS/dictionary Shop/Evaluations/3D cũ), chuẩn hóa `tabular-nums`, sửa 20 `@MockBean` deprecated và 3 cảnh báo MapStruct, đặt tên chunk `supabase-vendor`.

---

## 4. Danh Sách Lỗi `P0-Critical` (16 Lỗi Độc Lập — Chi Tiết Đầy Đủ)

### `P0-01` — Wizard tạo khóa học 4 bước: Bấm "Tiếp tục" ở Bước 3 tự động submit `POST /api/v1/classes/recurring` ngay lập tức & bỏ qua Bước 4 Xác nhận trên trình duyệt Chromium thực
- **Nguồn phát hiện:** `[E2E-2 #1]` *(Đã kiểm chứng trực tiếp trên mã nguồn & tái hiện 100% trên Chromium)*
- **Phân hệ:** Frontend — Manager Scheduling Wizard
- **Vị trí:** `apps/web/src/features/classes/components/ClassFormModals.tsx:1096-1115`
- **Bằng chứng mã nguồn & thực nghiệm Chromium:**
  ```tsx
  {step < 4 ? (
    <button type="button" className="btn-primary" data-testid="wizard-next-btn" onClick={handleNext}>
      {t('Tiếp tục', 'Next')}
    </button>
  ) : (
    <button type="submit" className="btn-primary" data-testid="wizard-submit-btn" disabled={busy}>
      {busy ? t('Đang lưu...', 'Saving...') : t('Tạo khóa học', 'Create course')}
    </button>
  )}
  ```
  Hai nút `<button>` nằm tại cùng vị trí phần tử con bên trong `<form onSubmit={handleFormSubmit}>` nhưng **không có prop `key` phân biệt**. Khi `onClick={handleNext}` gọi `setStep(4)` đồng bộ trong lúc xử lý sự kiện click, React tái sử dụng chính phần tử DOM `<button>` cũ và đổi thuộc tính `type` từ `"button"` sang `"submit"` **trước khi hành vi kích hoạt mặc định (default activation) của Chromium chạy**, khiến Blink kích hoạt luôn sự kiện `submit` của `<form>` trên chính cú click Bước 3 đó. Kết quả đo thực tế trên Chromium: `postsBeforeClickingStep3Next: 0` → click `wizard-next-btn` ở Bước 3 (không hề bấm `wizard-submit-btn`) → `postsAfterClickingStep3Next: 1`, `step4StillVisible: false`, modal tự đóng ngay lập tức. *(Vitest/happy-dom không mô phỏng đúng vòng đời click-activation của Blink nên bỏ lọt hoàn toàn lỗi này.)*
- **Tác động:** Quản lý **không bao giờ** xem được màn hình Xác nhận (Bước 4), không thể bấm "Quay lại" từ Bước 4 để chỉnh sửa, và vô tình tạo khóa học/lịch học thật trong CSDL chỉ bằng cú click "Tiếp tục" ở Bước 3.
- **Hướng khắc phục:** Gắn `key="wizard-next"` cho nút "Tiếp tục" và `key="wizard-submit"` cho nút "Tạo khóa học", đồng thời có thể đổi nút Bước 4 sang `type="button"` gọi trực tiếp `onClick={() => void handleCreate()}` (và chặn `e.preventDefault()` trong `onSubmit` nếu `step !== 4`).

---

### `P0-02` — Đăng ký khóa học nhóm bằng Ví SÖL (`online_wallet`) không bao giờ trừ tiền ví, báo thành công giả rồi tự động hủy sau 15 phút (kèm báo thành công giả khi VNPay URL null)
- **Nguồn phát hiện:** `[FE5-01 + BE2-01]`
- **Phân hệ:** Full-Stack — Group Class Billing & Wallet
- **Vị trí:**
  - Backend: `apps/api/src/main/java/com/swp391/scms/scheduling/service/EnrollmentService.java:870-955, 1025-1063`
  - Frontend: `apps/web/src/features/member/components/MemberGroupClassesView.tsx:67, 190, 194-223`
- **Bằng chứng mã nguồn:**
  - `MemberGroupClassesView.tsx:67, 190` đặt phương thức mặc định là `payMethod = 'online_wallet'`.
  - Backend `EnrollmentService.checkoutCourse` (`L871-905`) chỉ kiểm tra số dư ví (`balance >= price`), sau đó tạo `ClassEnrollment(status="booked")` và `Payment(method="online_wallet", status="pending")`. Từ `L907-930`, hàm chỉ xử lý nhánh `if ("vnpay".equals(normalizedMethod))`, **hoàn toàn không gọi** `vnpayPaymentService.payWithWallet(...)` hay `wallets.debitForPayment(...)`, trả về `paymentStatus = "pending"`, `expiresAt = now + 15 phút`.
  - Frontend `handlePaidCheckout()` (`L199-213`) chỉ kiểm tra `if (payMethod === 'vnpay' && res.paymentUrl)` rồi mặc định hiện toast xanh `"Đăng ký khóa ... thành công!"` mà không gọi `POST /api/v1/wallet/pay` và không bắn sự kiện `wallet-updated`.
  - Tương tự, nếu `payMethod === 'vnpay'` nhưng backend tạo URL lỗi (catch tại `EnrollmentService.java:924-929`, trả `paymentUrl: null`), Frontend cũng rơi vào nhánh thông báo thành công giả.
- **Tác động:** Mọi hội viên chọn phương thức thanh toán mặc định (Ví SÖL) khi đăng ký khóa học trả phí đều bị trừ `0đ`, không có hóa đơn, thấy trạng thái `"Đã đăng ký"`, rồi **15 phút sau `CourseEnrollmentExpiryScheduler` tự động đánh dấu `Payment` thành `failed` và hủy mất suất học**.
- **Hướng khắc phục:** Trong `EnrollmentService.checkoutCourse`, khi `"online_wallet".equals(normalizedMethod)` và `price > 0`, gọi ngay `vnpayPaymentService.payWithWallet(principal, new CheckoutRequest(null, null, savedPayment.getId()))` trong cùng giao dịch để khóa ví, trừ tiền idempotent (`WALLET_PAY_<id>`), chuyển thanh toán sang `success`, tự xuất hóa đơn và trả `expiresAt = null`. Ở Frontend, bắn `wallet-updated` sau khi thanh toán ví và báo lỗi/điều hướng sang `/member/invoices` nếu `payMethod === 'vnpay' && !res.paymentUrl`.

---

### `P0-03` — Quầy lễ tân hoàn toàn không có giao diện và API thu tiền mặt học phí khóa học nhóm (`classEnrollmentId`)
- **Nguồn phát hiện:** `[FE7-01]`
- **Phân hệ:** Frontend — Reception Desk (`StaffReceptionPage`)
- **Vị trí:**
  - `apps/web/src/features/reception/StaffReceptionPage.tsx:54-77, 293-301, 754-760`
  - `apps/web/src/features/reception/receptionApi.ts:170-177, 327-344`
  - Tham chiếu nghiệp vụ: `MemberGroupClassesView.tsx:199, 505-509`, `EnrollmentService.java:881-905`
- **Bằng chứng mã nguồn:**
  - Hội viên được phép chọn `"Tiền mặt tại quầy lễ tân"` khi đăng ký khóa học nhóm (`MemberGroupClassesView.tsx:505-509`), backend tạo `Payment(classEnrollmentId, method="cash", status="pending")`.
  - Tuy nhiên `StaffReceptionPage.tsx` chỉ tải đúng 4 hàng đợi: `plan` (gói tập), `pt` (buổi PT 1:1), `trial` (trải nghiệm 3 ngày), `hold` (bảo lưu). Toàn bộ `receptionApi.ts` và toàn bộ `apps/web/src/features/**` không có bất kỳ lời gọi nào liệt kê khoản thu `classEnrollmentId` đang chờ hoặc gửi `classEnrollmentId` / `PATCH /payments/{id}/status` để xác nhận thu tiền mặt khóa học.
- **Tác động:** Toàn bộ lượt đăng ký khóa học nhóm chọn thanh toán tiền mặt tại quầy rơi vào ngõ cụt — lễ tân không thể nhìn thấy hay xác nhận thu tiền, dẫn đến mọi suất giữ chỗ đều bị tự động hủy khi tới ngày khai giảng.
- **Hướng khắc phục:** Bổ sung endpoint/truy vấn danh sách học phí khóa học chờ thu tiền mặt (hoặc hiển thị theo `GET /api/v1/payments/member/{memberId}` trên màn tra cứu hội viên), thêm tab/mục hàng đợi `"Khóa học"` trên `StaffReceptionPage.tsx` kèm xác nhận qua `useConfirm()`, gọi thanh toán `classEnrollmentId` và xuất `PaymentInvoice`.

---

### `P0-04` — Thanh toán `WALLET_TOPUP` bằng chính Ví SÖL làm mất trắng tiền ví; `PaymentService` không kiểm tra giá/trùng lặp `classEnrollmentId` và cho phép gộp đồng thời nhiều đối tượng thanh toán
- **Nguồn phát hiện:** `[FE4-01 + BE4-03]`
- **Phân hệ:** Full-Stack — Finance, VNPay & SÖL Wallet
- **Vị trí:**
  - Frontend: `apps/web/src/features/member/MemberInvoicesPage.tsx:74, 129-137`, `apps/web/src/features/payments/VnpayPayButton.tsx:88-113, 138-146`
  - Backend: `apps/api/src/main/java/com/swp391/scms/finance/service/VnpayPaymentService.java:149-181, 225-241`, `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java:161-282, 469-642`, `PaymentRepository.java:92`
- **Bằng chứng mã nguồn:**
  1. **Tự trừ ví cho giao dịch nạp ví:** `MemberInvoicesPage.tsx:74, 136` hiển thị `<VnpayPayButton>` (gồm cả nút **"Thanh toán bằng Ví SÖL"**) trên mọi giao dịch `pending` bao gồm `serviceType === 'WALLET_TOPUP'`. Ở backend, `VnpayPaymentService.payWithWallet()` (`L149-181`) không hề chặn `isWalletTopup(payment)`. Khi lượt VNPay đã quá `expiresAt + SETTLEMENT_GRACE` (trước khi scheduler 5 phút chạy), `payWithWallet` đánh dấu lượt VNPay thành `failed` mà không gọi `closeOrphanWalletTopup`, **trừ tiền từ ví của hội viên** và chuyển `Payment(WALLET_TOPUP)` sang `success` mà **không hề cộng tiền vào ví**.
  2. **Không kiểm tra số tiền & cho phép tạo trùng nhiều `Payment` cho cùng `classEnrollmentId`:** `PaymentService.validateMemberPaymentTarget` (`L208-215`), `createPayment` (`L222-282`) và `processPayment` (`L601-611`) không đối chiếu `dto.getAmount()` với học phí khóa học và không kiểm tra đã tồn tại `Payment` nào cho `classEnrollmentId` chưa. Bất kỳ `MEMBER` nào cũng có thể gọi `POST /api/v1/payments` với `amount: 1`, `method: "online_wallet"`, `classEnrollmentId: E1` nhiều lần. Tạo bản ghi thứ 2 lập tức làm vỡ mọi lệnh gọi `Optional<Payment> PaymentRepository.findByClassEnrollmentId(id)` (tại `EnrollmentService:370, 500, 581, 983`, `VnpayPaymentGuard:59`, `PaymentService:257, 493`) bằng lỗi HTTP 500 `IncorrectResultSizeDataAccessException`.
  3. **Thiếu ràng buộc loại trừ lẫn nhau (XOR):** `validateMemberPaymentTarget` (`L190`) chỉ chặn khi cả `subscriptionId` và `classEnrollmentId` đều `null`, không chặn khi gửi **cả hai cùng lúc** → 1 khoản thu giá bằng gói tập nhưng gắn liên kết cả khóa học.
- **Tác động:** Mất tiền trực tiếp của hội viên trên Ví SÖL; hội viên có thể trả `1đ` lấy hóa đơn hợp lệ hoặc tự gây crash HTTP 500 toàn bộ luồng hủy/hoàn tiền/kiểm tra khóa học.
- **Hướng khắc phục:** Chặn tuyệt đối `if (isWalletTopup(payment)) throw unavailable();` trong `VnpayPaymentService.payWithWallet` và truyền `allowWallet={payment.serviceType !== 'WALLET_TOPUP'}` vào `VnpayPayButton`. Bắt buộc kiểm tra XOR đúng 1 đối tượng đích trong `PaymentService.createPayment`/`processPayment`, kiểm tra khớp giá khóa học (sau giảm giá theo hạng), từ chối tạo trùng `Payment` và bổ sung partial unique index trên `payments(class_enrollment_id) WHERE status IN ('pending','success')`.

---

### `P0-05` — Xung đột enum `status` của `GymClass` làm crash ràng buộc PostgreSQL `ck_classes_status` và khóa không thể sửa lớp `'inactive'`
- **Nguồn phát hiện:** `[FE3-01 + BE2-03 + BE7-01]`
- **Phân hệ:** Full-Stack & Database — Class Management
- **Vị trí:**
  - Entity/DB: `apps/api/src/main/java/com/swp391/scms/scheduling/entity/GymClass.java:22`
  - Backend DTO/Service: `apps/api/src/main/java/com/swp391/scms/scheduling/dto/SchedulingRequests.java:141`, `ClassService.java:427-440, 592`
  - Frontend: `apps/web/src/features/classes/components/ClassFormModals.tsx:1141, 1273-1277`, `classesApi.ts:37`, `ClassListTable.tsx:100, 165`
- **Bằng chứng mã nguồn:**
  - `GymClass.java:22`: `@Check(name = "ck_classes_status", constraints = "status IN ('active','inactive','archived')")` và `ClassService.deleteClass()` (`L592`) đặt `status = "inactive"`.
  - Ngược lại, `UpdateClassRequest.status` (`SchedulingRequests.java:141`) kiểm tra `@Pattern(regexp = "active|cancelled|archived")`, `ClassService.updateClass()` (`L428-436`) kiểm tra `closing` với `"cancelled"`/`"archived"` rồi ghi thẳng `request.status()` qua `saveAndFlush`, và `EditClassModal` (`ClassFormModals.tsx:1273-1277`) chỉ cho chọn `active`, `archived`, `cancelled` (thiếu `inactive`).
- **Tác động:** (1) Quản lý chọn **"Đã hủy" (`cancelled`)** khi sửa lớp sẽ vượt qua `@Valid`, chạy `closeClass(...)`, rồi **luôn nổ lỗi CHECK constraint `ck_classes_status` trên PostgreSQL (HTTP 409/500)** và rollback toàn bộ. (2) Mở "Sửa" trên bất kỳ lớp nào đã xóa mềm (`status = 'inactive'`) hiển thị dropdown trắng và bấm Lưu bị HTTP 400 `VALIDATION_ERROR`.
- **Hướng khắc phục:** Thống nhất toàn bộ 3 tầng theo tập `active | inactive | archived`: sửa regex `UpdateClassRequest` & key `validation.scheduling.class_status.pattern` thành `active|inactive|archived`; trong `ClassService.updateClass` kích hoạt `closeClass(...)` khi chuyển từ `active` sang `inactive` hoặc `archived`; thay `<option value="cancelled">` bằng `<option value="inactive">` trong `EditClassModal` và phân biệt badge `archived` vs `inactive` ở `ClassListTable`.

---

### `P0-06` — Trang `/coach/classes` truyền chuỗi `username` làm tham số số `Long coachId`, khiến toàn bộ lớp nhóm của HLV bị HTTP 400 và nuốt lỗi im lặng
- **Nguồn phát hiện:** `[FE6-01]`
- **Phân hệ:** Frontend — Coach Schedule
- **Vị trí:**
  - `apps/web/src/features/coaching/CoachClassesPage.tsx:51, 136-150`
  - `apps/web/src/features/coaching/coachingApi.ts:47-58`
  - Tham chiếu: `apps/web/src/shared/api/client.ts:259`, `apps/api/src/main/java/com/swp391/scms/scheduling/ClassController.java:147-155`
- **Bằng chứng mã nguồn:**
  - `client.ts:259` lưu chuỗi `username` vào `UserSession.id` (`{ id: username, ... }`).
  - `CoachClassesPage.tsx:136-141` gọi `coachingApi.getCoachSchedule(currentUser?.id)` → gửi `GET /api/v1/classes/sessions?coachId=coach_gym`.
  - Backend `ClassController.listSessions` (`L151`) nhận `@RequestParam(required = false) Long coachId` → Spring MVC ném `MethodArgumentTypeMismatchException` (**HTTP 400**).
  - `CoachClassesPage.tsx:136, 146-150` dùng `Promise.allSettled` và chỉ hiện `error` khi `ptResult` thất bại, **nuốt hoàn toàn lỗi của `classResult`** và đặt `classSessions = []`.
- **Tác động:** Trên môi trường thực với backend Spring Boot, trang `/coach/classes` **không bao giờ hiển thị bất kỳ buổi lớp học nhóm nào** của HLV và cũng không báo bất kỳ thông báo lỗi nào.
- **Hướng khắc phục:** Bỏ tham số `coachId` khi gọi `coachingApi.getCoachSchedule()` (backend `ClassController.listSessions` đã tự động lọc theo `principal.id()` với vai trò `COACH`), đồng thời báo lỗi rõ ràng nếu `classResult.status === 'rejected'`.

---

### `P0-07` — Rò rỉ tin nhắn, bản nháp, lịch sử AI/Hỗ trợ xuyên người dùng & giữ nguyên kết nối Supabase Realtime cũ sau khi đăng xuất hoặc đổi tài khoản
- **Nguồn phát hiện:** `[FE8-01]`
- **Phân hệ:** Frontend — Security / Session Isolation (Chat Widget & Chat Page)
- **Vị trí:**
  - `apps/web/src/features/chat/ChatWidget.tsx:3, 26-32, 42-61`
  - `apps/web/src/features/chat/ChatPage.tsx:3, 50-62`
  - `apps/web/src/features/landing/components/PublicLayout.tsx:48, 166`
- **Bằng chứng mã nguồn:**
  - Cả `ChatWidget.tsx:27`, `ChatPage.tsx:52`, và `PublicLayout.tsx:48` đều đọc `getCurrentUser()` không phản ứng (thay vì `useCurrentUser()`) và mount `<SignedInChatWidget />`, `<ManagerChatWidget />`, `<ChatWorkspace />` **không có `key` định danh phiên** (`sessionIdentityKey(user)`).
  - Trong khi `PortalShell.tsx:78` remount nội dung portal theo `sessionIdentityKey`, các trang công khai (`/`, `/boxing`, `/yoga`, `/sports/:sportId`, `/trainers*`) dùng `PublicLayout` không hề remount `ChatWidget`.
- **Tác động:** (1) Khi User A đăng xuất ở tab khác trong lúc mở trang công khai, WebSocket Supabase Realtime + vòng lặp polling 4s vẫn chạy và toàn bộ tin nhắn riêng, bản nháp, lịch sử SÖL AI, phiếu hỗ trợ, huy hiệu chưa đọc của User A vẫn hiển thị nguyên vẹn. (2) Khi đổi từ User A sang User B trên máy dùng chung, React giữ nguyên instance của `SignedInChatWidget`/`useChatConversation`, tiếp tục đăng ký topic Supabase Realtime của **User A** và hiển thị dữ liệu cache của **User A** cho **User B**.
- **Hướng khắc phục:** Dùng `useCurrentUser()` trong `ChatWidget.tsx`, `ChatPage.tsx`, và `PublicLayout.tsx`; gắn `key={sessionIdentityKey(user)}` cho `<SignedInChatWidget>`, `<ManagerChatWidget>`, `<ChatShell>`, và `<ChatWorkspace>`.

---

### `P0-08` — Chiếm đoạt toàn bộ tài khoản (Pre-Account Hijacking) qua tự động liên kết Google OAuth vào tài khoản `inactive` chưa xác thực
- **Nguồn phát hiện:** `[BE1A-01]`
- **Phân hệ:** Backend — Security / OAuth Account Takeover
- **Vị trí:** `apps/api/src/main/java/com/swp391/scms/auth/AuthService.java:174-203, 332-397, 494-534`
- **Bằng chứng mã nguồn:**
  - Trong `resolveOrCreateGoogleUser` (`L509-533`), khi tìm thấy bản ghi `byEmail` chưa gắn `googleSub` với email `@gmail.com` (hoặc có `hostedDomain`), `ensureGoogleOtpAccountAllowed(user)` (`L669-670`) cho phép tài khoản `MEMBER` đang ở trạng thái `status = "inactive"`.
  - Dòng `521` gắn `user.setGoogleSub(googleSub)` và lưu lại **mà không xóa hay thay đổi `passwordHash` và `username`** đã đăng ký trước đó.
  - Chuỗi khai thác: (1) Kẻ tấn công gọi `POST /api/v1/auth/register` với `email: "victim@gmail.com"`, `username: "attacker_alias"`, `password: "AttackerPass123"` → tạo bản ghi `inactive`. (2) Nạn nhân đăng nhập bằng Google → hệ thống liên kết `googleSub` của nạn nhân vào bản ghi của kẻ tấn công và gửi OTP kích hoạt về `victim@gmail.com`. (3) Nạn nhân nhập OTP → tài khoản kích hoạt `active`. (4) Kẻ tấn công gọi `POST /api/v1/auth/login` với `username: "attacker_alias"` và `password: "AttackerPass123"` → nhận JWT hợp lệ truy cập toàn bộ tài khoản, ví, KYC và dữ liệu của nạn nhân.
- **Tác động:** Chiếm đoạt hoàn toàn tài khoản (Full Account Takeover) của bất kỳ người dùng Gmail/Workspace nào đăng ký mới bằng Google.
- **Hướng khắc phục:** Khi liên kết danh tính Google đã xác thực (`emailVerified == true`) với bản ghi `status = "inactive"` (chưa từng xác thực email), xem mật khẩu & username cũ là không đáng tin: ghi đè `passwordHash` bằng bí mật ngẫu nhiên mới không thể đoán (`UUID.randomUUID()`), sinh lại `username` mới sạch sẽ, hoặc xóa bỏ bản ghi `inactive` cũ trước khi tạo tài khoản Google mới.

---

### `P0-09` — Nhầm lẫn mục đích OTP xuyên luồng (OTP Purpose Confusion) & bỏ qua Google OAuth / xả rác bảng `users` không cần xác thực qua `/google/send-otp`
- **Nguồn phát hiện:** `[BE1A-02]`
- **Phân hệ:** Backend — Security / Broken Authentication
- **Vị trí:**
  - `apps/api/src/main/java/com/swp391/scms/auth/entity/OtpChallenge.java:18-64`
  - `apps/api/src/main/java/com/swp391/scms/auth/OtpService.java:43-94`
  - `apps/api/src/main/java/com/swp391/scms/auth/AuthController.java:153-168, 235-244`
  - `apps/api/src/main/java/com/swp391/scms/auth/AuthService.java:207-211, 224-281, 305-321, 374-397`
- **Bằng chứng mã nguồn:**
  1. **Không cô lập mục đích (`purpose`) OTP:** `OtpChallenge` chỉ lưu `(target, code_hash, expires_at, failed_attempts, created_at)`. Cả 4 luồng sinh OTP (`/send-otp`, `/password/send-otp`, `/google/send-otp`, Google OAuth callback) cùng ghi đè 1 dòng theo `target` và gửi cùng 1 mẫu email. Do đó, OTP dùng để kích hoạt/đăng nhập có thể đem nộp vào `POST /api/v1/auth/password/reset` để **đổi mật khẩu bất kỳ tài khoản nào (kể cả `ADMIN`/`CENTER_MANAGER`)**, và ngược lại OTP đặt lại mật khẩu có thể nộp vào `POST /api/v1/auth/google/verify-otp` để lấy thẳng JWT.
  2. **`/google/send-otp` + `/google/verify-otp` hoàn toàn bỏ qua xác thực Google & cho phép tạo tài khoản hàng loạt không cần đăng nhập:** `requestGoogleOtp(rawEmail)` (`L305-321`) và `verifyGoogleOtp(rawEmail, otpCode)` (`L374-397`) không hề kiểm tra Google token hay `googleSub != null`. Mọi request chưa xác thực gửi email bất kỳ tới `/google/send-otp` đều ghi thẳng bản ghi `User` + `Member` mới vào CSDL (gây xả rác CSDL & chặn nạn nhân đăng ký thật bằng `409 EMAIL_EXISTS`), hoặc gửi OTP đăng nhập không cần mật khẩu cho cả `COACH`/`RECEPTIONIST` chưa từng liên kết Google.
- **Tác động:** Lạm dụng OTP xuyên luồng, đăng nhập không mật khẩu ngoài dự kiến cho nhân sự, xả rác bảng `users`/`members` và từ chối dịch vụ đăng ký.
- **Hướng khắc phục:** Bổ sung cột `purpose` (`ACCOUNT_ACTIVATION`, `PASSWORD_RESET`, `GOOGLE_ACTIVATION`) với khóa duy nhất `(target, purpose)` và nội dung email riêng biệt cho từng mục đích. Gỡ bỏ endpoint không xác thực `POST /api/v1/auth/google/send-otp` (hoặc yêu cầu Google credential/challenge đã xác minh trước khi tạo user/gửi OTP) và bắt buộc `googleSub != null` trong `verifyGoogleOtp`.

---

### `P0-10` — Cộng sớm ngày bảo lưu vào `endDate` tạo lỗ hổng trục lợi tín dụng nâng cấp / hoàn tiền hủy gói (+15,6%) trước ngày bảo lưu VÀ gây thiệt hại nặng (-32,8%) sau khi hết bảo lưu
- **Nguồn phát hiện:** `[BE4-01]`
- **Phân hệ:** Backend — Financial Math / Membership Proration Exploit
- **Vị trí:**
  - `apps/api/src/main/java/com/swp391/scms/membership/service/MembershipSubscriptionService.java:438-445, 473-481, 1156-1165`
  - `apps/api/src/main/java/com/swp391/scms/membership/service/SubscriptionValueCalculator.java:105-127`
  - `apps/api/src/main/java/com/swp391/scms/membership/service/MembershipCancellationService.java:102, 161, 168-172, 254, 428-431`
  - `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java:913-922`
- **Bằng chứng mã nguồn:**
  - `approveHold` (`L1156-1160`) cộng ngay `+heldDays` vào `subscription.endDate` ngay khi duyệt, trong khi vẫn giữ `status = "active"` và `holdStatus = "APPROVED"` nếu `holdStart > today`.
  - Cả `upgrade()` (`L438`) lẫn luồng hủy gói `MembershipCancellationService` (`L102, 161, 254`) chỉ chặn `holdStatus = "PENDING"`, **không chặn `holdStatus = "APPROVED"`**.
  - `SubscriptionValueCalculator.totalDays()` và `remainingDays()` (`L112-127`) tính khoảng cách lịch thuần túy `DAYS.between(startDate, endDate) + 1` và `DAYS.between(today, endDate) + 1` mà **không trừ đi số ngày bảo lưu không cung cấp dịch vụ**.
- **Tác động tài chính cụ thể:**
  1. **Trục lợi trước khi bảo lưu bắt đầu:** Gói Platinum 60 ngày giá `6.000.000đ`, dùng 28 ngày còn đúng `32/60 = 3.200.000đ`. Hội viên xin duyệt bảo lưu 30 ngày (`Ngày 30..59`) → `endDate` kéo tới `Ngày 90`. Gọi nâng cấp hoặc hủy gói vào `Ngày 29` → hệ thống tính `(32+30)/(60+30) = 62/90 × 6.000.000đ = 4.133.000đ` — **trục lợi khống +933.000đ (+15,6%)**; khi nâng cấp xong `PaymentService.activateSubscription:915` xóa `holdStatus = null` nhưng giữ nguyên `creditApplied` bị thổi phồng.
  2. **Thiệt hại hội viên sau khi hết bảo lưu:** Hội viên bảo lưu 30 ngày từ `Ngày 2..31`, tập lại `Ngày 32` còn `59/60` ngày thực tập → hệ thống vẫn chia mẫu số `90` (`59/90 = 65,5%` thay vì `59/60 = 98,3%`), **ăn bớt 32,8% giá trị thực** khi hội viên nâng cấp hoặc hủy gói!
- **Hướng khắc phục:** Loại trừ số ngày bảo lưu đã cộng/đã dùng khỏi cả `totalDays()` lẫn `remainingDays()` trong `SubscriptionValueCalculator` (lưu `heldDaysCreditedCount` hoặc trừ giao đoạn `[holdStartDate, holdEndDate]`), đồng thời chặn `upgrade()` và yêu cầu hủy gói khi đang có `holdStatus = "APPROVED"` (yêu cầu rút bảo lưu trước để hoàn nguyên `endDate`).

---

### `P0-11` — Race condition không khóa giữa `VnpayExpiryScheduler` / `VnpayPaymentGuard.expireStale` và `VnpayPaymentService.ipn` cho phép cộng miễn phí 100% giá trị vào ví (nhân đôi tiền)
- **Nguồn phát hiện:** `[BE4-02]`
- **Phân hệ:** Backend — Concurrency / VNPay Financial Integrity
- **Vị trí:**
  - `apps/api/src/main/java/com/swp391/scms/finance/service/VnpayExpiryScheduler.java:30-38`
  - `apps/api/src/main/java/com/swp391/scms/finance/service/VnpayPaymentGuard.java:73-95`
  - `apps/api/src/main/java/com/swp391/scms/finance/entity/VnpayTransaction.java:14-58` (không có `@Version`)
  - `apps/api/src/main/java/com/swp391/scms/finance/service/VnpayPaymentService.java:383, 416-418, 482-500`
- **Bằng chứng mã nguồn:**
  - `VnpayExpiryScheduler.closeAbandonedAttempts()` chạy 1 transaction duy nhất gọi `guard.expireStale(paymentId)` **không khóa `Member`, `Payment` hay `VnpayTransaction`**. `VnpayTransaction` không có `@Version` và không có `@DynamicUpdate` nên Hibernate phát lệnh `UPDATE` ghi đè toàn bộ cột.
  - Nếu `expireStale` đọc `t(status="pending", gatewayTransactionNo=null)` ngay trước khi `VnpayPaymentService.ipn()` commit `t(status="success", gatewayTransactionNo="12345")` và kích hoạt gói/dịch vụ (`p.status="success"`), ngay sau đó `expireStale` **ghi đè ngược `t.status = "failed"` và xóa sạch `gatewayTransactionNo = NULL`**.
- **Tác động:** Ở lần VNPay gửi lại IPN hoặc hội viên bấm `/verify-return`, `ipn()` thấy `p.status == "success"`, `t.status == "failed"`, `t.gatewayTransactionNo == null` nên rẽ vào `refundPaymentSettledElsewhere` (`L482-500`) và gọi **`walletService.creditLateGatewayPayment(...)`** — **cộng miễn phí toàn bộ số tiền đơn hàng vào Ví SÖL trong khi hội viên vẫn đang hưởng gói tập/dịch vụ đã kích hoạt!**
- **Hướng khắc phục:** Thay đọc-sửa-lưu trong `expireStale` bằng câu lệnh `UPDATE` có điều kiện nguyên tử (`WHERE reference = :ref AND status = 'pending' AND gateway_transaction_no IS NULL AND expires_at < :cutoff`) hoặc khóa `Member` (`findByUserIdForUpdate`) trước khi đọc; thêm `@Version` cho `VnpayTransaction` & `Payment`; xử lý từng `paymentId` trong transaction riêng biệt.

---

### `P0-12` — Race condition / Lost Update trong `CoachBookingService.expireUnpaidBookings()` có thể tự hủy lịch PT 1:1 đã thanh toán mà không hoàn tiền (+ giữ chỗ chỉ 5 phút cho thanh toán tại quầy)
- **Nguồn phát hiện:** `[BE3-01]`
- **Phân hệ:** Backend — Concurrency / PT 1:1 Financial Integrity
- **Vị trí:**
  - `apps/api/src/main/java/com/swp391/scms/coaching/service/CoachBookingService.java:49-51, 790-828`
  - `apps/api/src/main/java/com/swp391/scms/coaching/repository/CoachBookingRepository.java:229-244`
- **Bằng chứng mã nguồn:**
  - Trong khi `confirmHourlyPayment()` (`L847`), `cancelBooking()` (`L713`), và `VnpayPaymentService` (`L253, 541`) khóa bi quan bằng `findByIdForUpdate(bookingId)`, hàm `expireUnpaidBookings()` (`L796-816`) nạp thực thể không khóa qua `findUnpaidStale(...)` và gọi `coachBookingRepository.save(booking)` trực tiếp mà **không khóa hàng, không refresh, không kiểm tra lại `paymentStatus`**.
  - Nếu `VnpayPaymentService.payWithWallet()` (không tạo `VnpayTransaction`, nên `vnpayGuard.coach` không chặn) hoặc `confirmHourlyPayment()` commit vào khoảng giữa `findUnpaidStale` và `save(booking)`, Hibernate ghi đè ảnh chụp cũ (`status = 'cancelled', payment_status = 'pending'`), trong khi `Payment` vẫn `success` và tiền ví đã bị trừ không hoàn lại.
  - Ngoài ra, `UNPAID_HOLD_MINUTES = 5` và `UNPAID_MIN_HOLD_MINUTES = 5` (`L49, 51`) làm nhánh 60 phút trong `findUnpaidStale` thành mã chết và tự động hủy mọi lịch PT thanh toán quầy chỉ sau 5 phút.
- **Tác động:** Hội viên bị trừ tiền ví/thu tiền quầy nhưng buổi PT vẫn bị hệ thống tự hủy và không được hoàn tiền; giao dịch quầy chỉ có 5 phút tồn tại.
- **Hướng khắc phục:** Chỉ truy vấn danh sách ID ứng viên, duyệt từng ID trong transaction riêng, khóa `findByIdForUpdate(id)`, kiểm tra lại `status == 'confirmed' && paymentStatus == 'pending'` và `vnpayGuard.coach(id)` trong khi giữ khóa trước khi hủy; rà soát lại `UNPAID_HOLD_MINUTES` thực tế.

---

### `P0-13` — `SessionCompletionScheduler.sweep()` tự gọi nội bộ `@Transactional completeHeld()` qua `this` — job hoàn tất lớp đêm nào cũng thất bại với `TransactionRequiredException`
- **Nguồn phát hiện:** `[BE2-02]`
- **Phân hệ:** Backend — Spring AOP / Scheduling Lifecycle
- **Vị trí:** `apps/api/src/main/java/com/swp391/scms/scheduling/service/SessionCompletionScheduler.java:50-75` *(tham chiếu `ClassSessionRepository:179-188`, `ClassEnrollmentRepository:140-152`, `SessionBookingRepository:149-156`)*
- **Bằng chứng mã nguồn:**
  - `sweep()` (`@Scheduled`, `L50`) **không có `@Transactional`** và gọi thẳng `this.completeHeld()` (`L53`).
  - `@Transactional` chỉ đặt trên `completeHeld()` (`L66`), trong khi cả 3 hàm `@Modifying` repository (`completeHeldBefore`, `completeFinishedBefore`) đều không có `@Transactional`.
  - Do tự gọi qua `this`, Spring AOP proxy bị bỏ qua hoàn toàn → cả 3 lệnh JPQL `UPDATE` ném `jakarta.persistence.TransactionRequiredException`, bị `catch` ở `L55-57` nuốt thành `log.warn`.
- **Tác động:** Toàn bộ buổi học, lượt đặt buổi và đăng ký khóa học đã kết thúc trên production **không bao giờ** tự chuyển sang trạng thái `completed`, tích tụ mãi ở trạng thái `scheduled`/`booked`.
- **Hướng khắc phục:** Chuyển `@Transactional` lên `sweep()` (hoặc tách scheduler gọi qua bean collaborator có Spring proxy / `TransactionTemplate`).

---

### `P0-14` — `LegacyScheduleSlotResetRunner` xóa sạch toàn bộ dữ liệu lịch học & PT khi khởi động nếu có bất kỳ lớp `classes` nào có `start_time`/`end_time` NULL hoặc bản ghi lịch sử lệch 5 slot
- **Nguồn phát hiện:** `[BE2-04]`
- **Phân hệ:** Backend — Startup Runner / Catastrophic Data Loss Risk
- **Vị trí:** `apps/api/src/main/java/com/swp391/scms/facilities/LegacyScheduleSlotResetRunner.java:31-55, 66-115`
- **Bằng chứng mã nguồn:**
  - `L31-44` quét toàn bộ `classes`, `class_sessions`, và `coach_bookings` (mọi trạng thái bao gồm `inactive`, `archived`, `cancelled`, `completed`) xem có dòng nào `start_time IS NULL OR end_time IS NULL` hoặc lệch 5 slot không, mà **không có cờ/bảng đánh dấu đã chạy 1 lần**.
  - Cột `GymClass.startTime`/`endTime` cho phép `NULL` (`GymClass.java:69-73`) và `ClassService.createClass` (`L197-207`) để `NULL`. Ngoài ra, các trigger CSDL chỉ kiểm tra 5 slot cho dòng `scheduled`/`confirmed`, không kiểm tra dòng `cancelled`/`completed`.
  - Chỉ cần **1 dòng** khớp điều kiện ở bất kỳ lần restart nào trong tương lai, `L77-96` sẽ cắt đứt liên kết `payments.class_enrollment_id`, `payments.coach_booking_id`, `training_plans.class_id` và chạy `DELETE FROM` xóa trắng 8 bảng: `session_attendance`, `session_evaluations`, `coach_reviews`, `session_bookings`, `class_enrollments`, `class_sessions`, `classes`, `coach_bookings`.
- **Tác động:** Nguy cơ **xóa trắng toàn bộ dữ liệu vận hành lịch học, điểm danh và PT production** chỉ vì một bản ghi lịch sử hoặc một lớp tạo bằng đường dẫn legacy có giờ NULL khi khởi động lại server.
- **Hướng khắc phục:** Lưu dấu mốc migration một lần duy nhất (sentinel row/flag trong CSDL hoặc tắt hẳn runner sau khi hoàn tất cutover), và không bao giờ chạy `DELETE` toàn bảng khi chỉ gặp `classes.start_time IS NULL`.

---

### `P0-15` — `AuditAspect` chạy trong cùng transaction nghiệp vụ, lấy khóa `PESSIMISTIC_WRITE` trước kiểm tra quyền & nuốt `RuntimeException` → PostgreSQL `25P02` hủy transaction & biến `409 RESOURCE_BUSY` thành HTTP `500`
- **Nguồn phát hiện:** `[BE5-01]`
- **Phân hệ:** Backend — Transactions / Concurrency / Audit Infrastructure
- **Vị trí:**
  - `apps/api/src/main/java/com/swp391/scms/audit/AuditAspect.java:34, 60-72, 85-103, 112-199`
  - `apps/api/src/main/java/com/swp391/scms/config/TransactionConfig.java:18, 27-33`
- **Bằng chứng mã nguồn:**
  - `TransactionConfig` cấu hình `@EnableTransactionManagement(order = LOWEST_PRECEDENCE - 1)` bao ngoài `AuditAspect` (`@Order(LOWEST_PRECEDENCE)`).
  - `AuditAspect.snapshot()` gọi `entityManager.find(..., LockModeType.PESSIMISTIC_WRITE)` **trước `joinPoint.proceed()`** và bọc trong `try/catch (RuntimeException)` trả `null`. Tương tự, `record()` bọc `repository.save(entry)` trong `try/catch (RuntimeException)` với giả định lỗi audit không làm hỏng nghiệp vụ.
- **Tác động:**
  1. Trên PostgreSQL thật, mọi lỗi SQL/constraint từ `repository.save(entry)` (`GenerationType.IDENTITY` chạy `INSERT` ngay) đều đưa kết nối vào trạng thái `SQLSTATE 25P02` (transaction aborted) và đánh dấu transaction Spring `rollbackOnly=true`. Việc nuốt lỗi khiến bước commit nổ `UnexpectedRollbackException` (**HTTP 500**) và rollback luôn nghiệp vụ đã chạy xong.
  2. Khi xảy ra tranh chấp hàng (lock timeout 10s `55P03`), `snapshot()` nuốt `LockTimeoutException`/`PessimisticLockException`, để PostgreSQL ở trạng thái `25P02` → `joinPoint.proceed()` nổ lỗi SQL chung (**HTTP 500**) thay vì `GlobalExceptionHandler` trả đúng **HTTP 409 `RESOURCE_BUSY`**.
  3. Lấy khóa ghi `PESSIMISTIC_WRITE` **trước** khi service kiểm tra quyền sở hữu/vai trò, cho phép người gọi trái phép khóa bản ghi và đảo lộn thứ tự khóa gây deadlock.
- **Hướng khắc phục:** Bỏ `LockModeType.PESSIMISTIC_WRITE` khỏi `AuditAspect.snapshot()` (chỉ đọc nhẹ); ghi nhật ký audit trong helper `@Transactional(propagation = Propagation.REQUIRES_NEW)` chạy ở `TransactionSynchronization.afterCommit()` (hoặc nếu bắt buộc atomic thì không nuốt `RuntimeException`).

---

### `P0-16` — Toàn bộ 38 bài PostgreSQL Integration Test không bao giờ chạy trên CI, khiến 3/7 suite Postgres bị hỏng âm thầm và 0 test Postgres kiểm tra các trigger mới
- **Nguồn phát hiện:** `[E2E-3 #1 + E2E-1 P1-1]`
- **Phân hệ:** CI/CD & Database Verification
- **Vị trí:**
  - `.github/workflows/pipeline.yml:69-94`
  - `apps/api/src/test/java/com/swp391/scms/config/PostgreSqlDatabaseIntegrationTest.java:37, 65-66, 249-256, 291-295, 478-496`
  - `apps/api/src/test/java/com/swp391/scms/config/OperationsConcurrencyPostgreSqlTest.java:57, 351-356`
  - `apps/api/src/test/java/com/swp391/scms/config/PtAttendanceIsolatedPostgreSqlTest.java:45, 130, 154-163`
- **Bằng chứng:**
  - CI chỉ chạy `./mvnw test` mà không cấp `SCMS_POSTGRES_TEST_URL`, `SUPABASE_PUBLISHABLE_KEY`, hay `-Dscms.pt.isolated.port` → toàn bộ 38 bài test PostgreSQL thật (7 lớp) luôn ở trạng thái `Skipped`.
  - Hệ quả trực tiếp: 3/7 suite đã hỏng âm thầm trước mã nguồn hiện tại:
    1. `PostgreSqlDatabaseIntegrationTest`: `L291` khẳng định có đúng `5` trigger (thực tế có **21**); `L65-66, 478-496` dùng cấu hình cũ `app.bootstrap.manager.*` + login `"admin"` (401/403); `L249-256` chèn 2 lớp cùng bộ môn ngày hôm nay nên kích hoạt `trg_sessions_check_discipline_conflict` che khuất bài test trigger PT↔Group!
    2. `OperationsConcurrencyPostgreSqlTest`: `L351` chèn buổi học `10:00–11:00` (vi phạm 5 slot `trg_schedule_invalid_slot`).
    3. `PtAttendanceIsolatedPostgreSqlTest`: `L154` mâu thuẫn với mặc định `PostgreSqlTriggerProvider(true)` và `L130` chèn lịch PT `09:00–10:00` (vi phạm 5 slot), làm hỏng 5/7 bài test.
  - Kể cả trong 38 bài đang skip cũng có **0 bài test Postgres** cho các trigger trọng yếu mới: `trg_sessions_check_discipline_conflict`, `scms_guard_member_class_overlap`, `trg_pt_schedule_class`, `trg_session_bookings_check_capacity/membership`, và RLS trên `realtime.messages`.
- **Tác động:** Toàn bộ lớp bảo vệ cuối cùng ở tầng CSDL PostgreSQL (21 trigger, khóa đồng thời, RLS, nâng cấp schema) hoàn toàn không được CI kiểm chứng trước khi deploy VPS.
- **Hướng khắc phục:** Khởi chạy service container `postgres:16` trong GitHub Actions CI để chạy đủ 38 bài test tích hợp (kèm sửa 3 suite hỏng trên), và viết bổ sung test PostgreSQL thật cho `trg_sessions_check_discipline_conflict`, `scms_guard_member_class_overlap`, `trg_pt_schedule_class`, và Realtime RLS.

---

## 5. Danh Sách Lỗi `P1-High` (Nghiêm Trọng — Chi Tiết Đầy Đủ Theo Phân Hệ)

### 5.1. Frontend `P1-High` (65 lỗi độc lập)

#### A. App Router, Auth, Landing & PWA (`FE-1`, `E2E-2`)

- **`P1-FE-01` `[FE1-01 + E2E-2 #2]` — URL môn thể thao đã gỡ `/sports/swimming`, `/sports/tennis`, `/sports/badminton`, `/sports/courts` âm thầm render trang Boxing thay vì chuyển hướng về `/`**
  - **Vị trí:** `apps/web/src/app/router.tsx:12`, `apps/web/src/features/landing/SportPage.tsx:14-17`, `PublicLayout.tsx:53-54, 61-71`
  - **Nguyên nhân & Bằng chứng:** `SportPage.tsx:16` dùng `sportIdFromPath(...) ?? 'boxing'`. Kiểm thử Chromium thực (`E2E-2`) xác nhận điều hướng tới `/sports/tennis|swimming|badminton` giữ nguyên URL cũ trên thanh địa chỉ và render `<h1>Phòng Tập Boxing...</h1>`, trong khi `PublicLayout` không sáng tab `Bộ môn` và dùng `<title>` chung.
  - **Khắc phục:** Nếu `!resolved` (ngoài `boxing`/`yoga`), trả về `<Navigate to="/" replace />`.

- **`P1-FE-02` `[FE1-02]` — Trang `/login?expired=1` phá hủy form ngay ở phím gõ đầu tiên khi đã có phiên cũ & bỏ qua sự kiện đăng xuất/đổi tài khoản từ tab khác**
  - **Vị trí:** `apps/web/src/features/auth/LuxuryLoginForm.tsx:50, 85-88, 453, 580-583, 614-617`
  - **Nguyên nhân:** `useState(() => getCurrentUser())` chụp tĩnh không lắng nghe `useCurrentUser()`; dòng `582, 616` gọi `if (isExpired) setIsExpired(false)` ngay ký tự đầu tiên nhập vào, khiến điều kiện `if (currentUser && !isExpired)` (`L453`) lập tức ẩn form và nhảy sang màn `"Bạn đã đăng nhập"`.
  - **Khắc phục:** Dùng `useCurrentUser()`, và chỉ hiển thị trạng thái đã đăng nhập khi thực sự không phải phiên vừa hết hạn (hoặc xóa phiên cũ ngay khi `?expired=1`).

- **`P1-FE-03` `[FE1-03]` — Tham số URL trên `/login` cho phép giả mạo thông báo/lỗi tùy ý & tự điền `debug_otp` ngay trên bản Production**
  - **Vị trí:** `apps/web/src/features/auth/LuxuryLoginForm.tsx:216-244, 822-847`
  - **Nguyên nhân:** `?google_oauth=error&error=<text>` in thẳng `params.get('error')` vào `<div role="alert">`; `?google_oauth=callback&email=...&message=...&debug_otp=000000` đọc thẳng chuỗi query, bật hộp `"Chế độ Test"` và điền `otpCode` kể cả khi `!import.meta.env.DEV`.
  - **Khắc phục:** Dùng danh sách mã lỗi đóng (`error_code`) thay vì chuỗi tự do trên URL; chỉ cho phép `debug_otp` khi `import.meta.env.DEV` (và không nhận từ query string).

- **`P1-FE-04` `[FE1-04]` — Trang Landing quảng cáo sai sự thật rằng "chưa có gói vẫn đặt được PT 1:1"**
  - **Vị trí:** `apps/web/src/features/landing/components/FitnessLanding.tsx:830-831`
  - **Nguyên nhân:** Ghi `"Tạo tài khoản miễn phí để đặt PT và chọn gói"`, trái ngược với bất biến `AGENTS.md` và `CoachBookingService.java:433-434` (luôn chặn bằng `400 MEMBERSHIP_INACTIVE_OR_EXPIRED`).
  - **Khắc phục:** Sửa câu chữ nêu rõ tài khoản miễn phí để khám phá portal, xem lịch/HLV và chọn gói (đặt lịch PT/lớp yêu cầu có gói đang hoạt động).

- **`P1-FE-05` `[FE1-05]` — Lỗi tương phản WCAG (`1,60:1`) ở Dark mode trên nút mũi tên `.fit-round-arrow` và `.fit-review-arrow`**
  - **Vị trí:** `apps/web/src/features/landing/fitness-public.css:87, 106` (đối chiếu `theme.css:142`, `dark-volt.css`)
  - **Nguyên nhân:** Đặt `color: #fff; background: var(--fit-salmon)`. Ở Dark mode `--fit-salmon` là bạc `#c8cdd6`, chữ/icon `#fff` trên `#c8cdd6` chỉ đạt `1,60:1` (vi phạm WCAG AA và `DESIGN.md:70`).
  - **Khắc phục:** Đổi thành `color: var(--sol-on-accent)` (`#202020` ở cả Light & Dark).

#### B. Shared API Client, i18n & Shared UI Kit / Portal Shell (`FE-2A`, `FE-2B`)

- **`P1-FE-06` `[FE2A-01]` — `apiFetch` nuốt `AbortError`/`TimeoutError` thành lỗi mất mạng và trả `null` im lặng khi timeout giữa lúc đọc JSON body**
  - **Vị trí:** `apps/web/src/shared/api/client.ts:142-154, 162-193`
  - **Nguyên nhân:** Khi caller tự truyền `init.signal` (như `aiChatApi.ts` truyền `AbortSignal.timeout`), `timedOut` luôn là `false`, nên `TimeoutError` bị catch đổi thành lỗi mất mạng chung (`code = undefined`); ngoài ra nếu timeout xảy ra sau khi nhận HTTP 200 header khi đang `await res.json()`, `.catch(() => null)` trả `null as T` im lặng thay vì báo lỗi timeout.
  - **Khắc phục:** Phân biệt `DOMException` `TimeoutError` (ném `ApiError(..., 'TIMEOUT')`) và `AbortError` từ caller (ném lại nguyên gốc); chỉ cho phép body rỗng khi HTTP 204 hoặc `Content-Length: 0`.

- **`P1-FE-07` `[FE2A-02]` — Race condition 401 đồng thời & race khi đăng xuất gán nhầm lỗi `SESSION_REPLACED` (và có thể đăng xuất nhầm trên request ẩn danh)**
  - **Vị trí:** `apps/web/src/shared/api/client.ts:86-91, 179-182, 209-211, 235-237`
  - **Nguyên nhân:** Khi N request cùng nhận 401 trên token `T1`, request #1 gọi `clearAuthSession()` (xóa token thành `null`) rồi chuyển hướng `/login?expired=1`; các request #2..N về sau thấy `localStorage.getItem(TOKEN) !== T1` nên ném sai `SESSION_REPLACED` (`"Phiên đăng nhập đã thay đổi"`). Tương tự khi người dùng tự bấm Đăng xuất lúc request đang chạy, hoặc khi request truyền `headers: { Authorization: '' }` vẫn kiểm tra `token` từ `localStorage`.
  - **Khắc phục:** Chỉ ném `SESSION_REPLACED` khi `current !== null && current !== sentToken`; thêm biến chống kích hoạt trùng `redirectingForToken`; chỉ áp dụng xử lý 401 khi request thực sự gắn `Authorization: Bearer`.

- **`P1-FE-08` `[FE2A-03]` — Toàn bộ 6 gói tập 3 tháng & 6 tháng đang bán (seeded) hoàn toàn không có bản dịch tiếng Anh**
  - **Vị trí:** `apps/web/src/shared/lib/membershipPresentation.ts:22-78` (đối chiếu `CatalogSeeder.java:86-160`)
  - **Nguyên nhân:** `SEEDED_PACKAGE_LINE_EN` không chứa hơn 20 dòng mô tả mới của 6 gói `SILVER/GOLD/PLATINUM 3 THÁNG & 6 THÁNG` đang seed từ `CatalogSeeder.java`, trong khi vẫn giữ các dòng cũ của Shop/chỉ số cơ thể đã tắt (`L45, 50, 53, 61, 65`).
  - **Khắc phục:** Cập nhật đầy đủ bảng ánh xạ EN cho tất cả dòng mô tả của 6 gói đang bán và xóa các dòng Shop/chỉ số cơ thể cũ.

- **`P1-FE-09` `[FE2B-01]` — `Toast` bị chôn phía sau lớp nền mờ (`::backdrop`) của `<dialog>` (`Modal`)**
  - **Vị trí:** `apps/web/src/shared/ui/toast.ts:28, 78-80`, `apps/web/src/styles.css:437-451`, `Modal.tsx:24`
  - **Nguyên nhân:** `toast.ts` mở `<dialog>` bằng `el.show()` (dùng `z-index: 9999`), còn `Modal` dùng `dialog.showModal()` đưa lên Top Layer của trình duyệt — mọi `z-index` đều nằm dưới Top Layer `::backdrop`, khiến toast hiện lúc mở Modal bị mờ và không bấm đóng được.
  - **Khắc phục:** Dùng Popover API (`el.setAttribute('popover', 'manual'); el.showPopover();`) với fallback `el.show()` để toast nổi trên Top Layer phía trên Modal mà không cướp focus.

- **`P1-FE-10` `[FE2B-02]` — `DatePicker` & `TimePicker` khi vừa `disabled` vừa `required` chặn submit form, tự mở popover bị khóa & lộ input ẩn không nhãn với screen reader**
  - **Vị trí:** `apps/web/src/shared/ui/DatePicker.tsx:318-331`, `TimePicker.tsx:145-158`, `portal-shell.css:2328-2333`
  - **Nguyên nhân:** Thẻ `<input tabIndex={-1} required>` ẩn không truyền `disabled={disabled}` hay `aria-hidden="true"`, lại khớp bộ chọn `input:not(...)` trên mobile (`min-height: 44px` đè `height: 0`).
  - **Khắc phục:** Truyền `disabled={disabled}` & `aria-hidden="true"`, kiểm tra `if (!disabled) setIsOpen(true)` trong `onInvalid`, và loại trừ `[aria-hidden='true']` khỏi rule `min-height: 44px`.

- **`P1-FE-11` `[FE2B-03]` — Lỗi tương phản WCAG ở Light mode do màu hex dark-mode cứng trong `portal-shell.css`**
  - **Vị trí:** `apps/web/src/features/portal/portal-shell.css:84-93, 192-199, 2460-2464` (đối chiếu `theme.css:70, 85-91`)
  - **Nguyên nhân:** `.btn-danger:hover` (`L90-93`) và `.ldp-action-btn.btn-clear` (`L192-199`) dùng cứng `#fca5a5` (tương phản `~1,5–1,9:1` trên nền trắng); `.portal-avatar-lang-btn.active` (`L2460-2464`) đặt `#191919` trên `--portal-salmon` (`#a35b49` ở Light → `3,48:1` dưới chuẩn 4,5:1).
  - **Khắc phục:** Dùng `var(--portal-danger)` / `color-mix(...)` cho nút nguy hiểm & Clear; đặt `.portal-avatar-lang-btn.active` dùng `background: var(--sol-accent); color: #202020;` trong `theme.css`.

- **`P1-FE-12` `[FE2B-04]` — Modal nạp ví trong `PortalShell` thiếu `busy={topupBusy}`, im lặng khi thiếu `paymentUrl` và giả số dư `0 ₫` khi `/wallet/my` lỗi**
  - **Vị trí:** `apps/web/src/features/portal/PortalShell.tsx:117-142, 211-227, 608-632, 694-695`
  - **Nguyên nhân:** `<Modal>` dòng 609 không truyền `busy={topupBusy}` (cho đóng giữa lúc gọi VNPay); nếu `checkout?.paymentUrl` rỗng thì tắt loading im lặng không báo lỗi; `.catch(() => {})` ở `L221-223` nuốt lỗi `/wallet/my` và hiện `0 ₫`.
  - **Khắc phục:** Truyền `busy={topupBusy}`, hiện lỗi nếu thiếu `paymentUrl`, thêm state `walletError` kèm nút Thử lại thay vì hiện giả `0 ₫`.

- **`P1-FE-13` `[FE2B-05]` — Reset thanh cuộn `.portal-v2 *` trong `portal-shell.css` xóa mất thanh cuộn ngang 6px trên `.portal-table-wrapper` và hộp dữ liệu**
  - **Vị trí:** `apps/web/src/features/portal/portal-shell.css:10-19, 32-38` vs `apps/web/src/styles.css:97-115`
  - **Nguyên nhân:** `portal-shell.css` nạp sau `styles.css` (qua lazy `AppLayout`) có cùng độ đặc hiệu `(0,1,0)` nên `.portal-v2 * { scrollbar-width: none }` đè mất quy tắc thanh cuộn mảnh của `DESIGN.md:51`.
  - **Khắc phục:** Loại trừ `.portal-table-wrapper, .portal-dialog__body, .notification-panel__scroll, .tt__scroll, .mcal__scroll` khỏi reset trong `portal-shell.css`.

- **`P1-FE-14` `[FE2B-06]` — Lỗi tương phản Dark mode trong `portal.css` do token không tồn tại `--color-success`/`--color-danger` & màu `.days-left--*` chỉ hợp nền sáng**
  - **Vị trí:** `apps/web/src/shared/ui/portal.css:1879-1882, 1911-1913, 1922`
  - **Nguyên nhân:** `--color-success` và `--color-danger` không hề được định nghĩa ở đâu, nên rơi về `#2f855a` / `#c53030` (`2,5–3,1:1` trên nền Dark `#292929`); `.days-left--ok|warn|danger` dùng cứng `#2f8f5b`/`#9a6f00`/`#c0392b` ngoài `.pass-card`.
  - **Khắc phục:** Chuyển sang `var(--portal-success)`, `var(--portal-warning)`, `var(--portal-danger)`.

#### C. Manager Portal, Lịch Học & Wizard (`FE-3`, `FE-7`)

- **`P1-FE-15` `[FE3-02]` — Wizard Bước 2 có cửa sổ race với `availability` cũ khi đổi lịch & Bước 3 không làm mới trạng thái sau lỗi `409 Conflict` ở Bước 4**
  - **Vị trí:** `apps/web/src/features/classes/components/ClassFormModals.tsx:220-281, 323-356, 658-675, 697, 726-729`
  - **Nguyên nhân:** Đổi ngày/thứ/slot không xóa ngay `availability` (chỉ đổi `checkingAvailability` sau commit trong `useEffect`), và `availability` không gắn chữ ký đầu vào; khi Bước 4 nhận `409` do xung đột đồng thời rồi bấm Quay lại Bước 3, `useEffect` (`if (step !== 2) return`) không gọi lại API, để phòng/HLV trùng vẫn hiển thị xanh "Trống".
  - **Khắc phục:** Lưu `availabilityKey` theo bộ tham số, coi `availability` chưa hợp lệ khi lệch key, và tự gọi lại kiểm tra phòng/HLV (hoặc thêm nút kiểm tra lại) khi quay từ Bước 4 lỗi `409` về Bước 3.

- **`P1-FE-16` `[FE3-03]` — `resolveWizardRooms` & `resolveWizardCoaches` coi danh sách rỗng từ server là "tất cả phòng/HLV đều trống"**
  - **Vị trí:** `apps/web/src/features/classes/components/classWizardValidation.ts:188-223`
  - **Nguyên nhân:** Kiểm tra `availability.rooms.length > 0` / `coaches.length > 0`; khi server trả về rỗng (mọi phòng bảo trì hoặc mọi HLV ngừng hoạt động), hàm rơi về danh sách `fallback` với `available: true`.
  - **Khắc phục:** Trả trực tiếp mảng từ server bất cứ khi nào `availability !== null && availability.validSchedule` và hiển thị cảnh báo không có phòng/HLV khả dụng.

- **`P1-FE-17` `[FE3-04]` — `EditClassModal` bị hỏng khi phòng hiện tại chuyển `maintenance`/`closed` hoặc HLV bị khóa/ngừng hoạt động**
  - **Vị trí:** `apps/web/src/features/classes/ManagerClassesPage.tsx:73-74`, `ClassFormModals.tsx:1137-1138, 1146-1149, 1219-1229`
  - **Nguyên nhân:** Trang chỉ nạp phòng `available` và HLV `active`, nên `selectedRoom` thành `undefined` (vô hiệu hóa kiểm tra `capacity <= room.capacity`), dropdown trắng tên và kể cả việc lưu trữ lớp cũng bị server từ chối.
  - **Khắc phục:** Chèn option hiện tại (gắn nhãn đang bảo trì/ngừng hoạt động) nếu vắng trong danh sách đang mở và nhắc chọn lại phòng/HLV khi giữ trạng thái `active`.

- **`P1-FE-18` `[FE3-05]` — Lệch múi giờ trong `schedule/**` & `classes/**`: `todayISO()` và `now.getHours()` dùng giờ máy cục bộ thay vì `Asia/Ho_Chi_Minh`**
  - **Vị trí:** `apps/web/src/features/schedule/timetable.ts:182-184, 205-207`, `WeeklyTimetable.tsx:132-134`, `ManagerClassesPage.tsx:56, 171, 178`, `ClassFormModals.tsx:133`
  - **Nguyên nhân:** Dùng `date.getFullYear()/getMonth()/getDate()/getHours()` cục bộ thay vì `centerNowParts()` (UTC+7), làm lệch cột "Hôm nay", vạch giờ hiện tại, trạng thái `is-past` và `startDate` mặc định đối với trình duyệt ngoài UTC+7.
  - **Khắc phục:** Lấy ngày/giờ từ `centerNowParts(now)` trong `shared/lib/centerTime.ts`.

- **`P1-FE-19` `[FE3-06]` — Bộ chọn `[data-accent='true']` trong `calendar.css` ghi đè `.mcal__event--full`, xóa mất sự phân biệt `Còn chỗ` vs `Đã đầy`**
  - **Vị trí:** `apps/web/src/features/schedule/calendar.css:148-149, 222-230`, `ManagerClassesPage.tsx:184-186, 201`, `WeeklyTimetable.tsx:379-391`
  - **Nguyên nhân:** Rule `[data-accent='true']:not(.mcal__event--cancelled):not(.mcal__event--past)` có độ đặc hiệu cao hơn `(0,4,0)` và đặt sau `.mcal__event--full`, trong khi mọi sự kiện của Manager đều có `data-accent="true"`.
  - **Khắc phục:** Thêm `:not(.mcal__event--full)` hoặc tạo style cảnh báo rõ cho `.mcal__event[data-accent='true'].mcal__event--full` kèm badge số chỗ khi đầy.

- **`P1-FE-20` `[FE3-07]` — `ManagerCoachAssignmentsPage` ẩn tên lớp/bộ môn (`detail`) của dòng `CLASS` & `PT_1_1` và thiếu pill/KPI học viên lớp nhóm dù cộng vào tổng**
  - **Vị trí:** `apps/web/src/features/manager/ManagerCoachAssignmentsPage.tsx:127-141, 242-255, 353-361, 397, 483, 658`
  - **Nguyên nhân:** Chỉ hiển thị `detail` khi `assignmentType === 'TRAINING_PLAN'` (`L397, 483, 658`), làm mọi hàng `CLASS` hiển thị `—`; header thẻ HLV chỉ có pill `tổng học viên`, `PT 1:1`, `Giáo án` (thiếu `Lớp nhóm`) khiến tổng không khớp (`5 tổng | 0 PT | 0 Giáo án`).
  - **Khắc phục:** Hiển thị `detail` cho cả `CLASS` và `PT_1_1`; bổ sung pill & KPI `Lớp nhóm` từ `classStudentsCount` / `stats.totalClassStudents`.

- **`P1-FE-21` `[FE3-08]` — `StaffAccountsPage` cho nhập mật khẩu `minLength={6}`, không kiểm tra `PasswordPolicy` và không trim tên toàn khoảng trắng**
  - **Vị trí:** `apps/web/src/features/manager/StaffAccountsPage.tsx:110-125, 153, 204-206`
  - **Nguyên nhân:** Backend yêu cầu `8–50` ký tự gồm chữ + số, không khoảng trắng (`PasswordPolicy.REGEX`), nhưng form chỉ kiểm `minLength={6}` và không dùng `isValidPassword` từ `authValidation.ts`.
  - **Khắc phục:** Tái sử dụng `isValidPassword`, `PASSWORD_RULE_ERROR`, `PASSWORD_RULE_HINT`, đặt `minLength={8}` và kiểm tra `fullName.trim().length >= 2`.

- **`P1-FE-22` `[FE3-09 + FE7-09]` — `UserManagerPage` (`/admin/users`): khóa nhầm nút Lock/Delete trên `CENTER_MANAGER` thay vì `ADMIN`/chính mình, tab Thùng rác không làm mới sau cleanup, nuốt lỗi thùng rác, không xóa được SĐT & race khi click nhanh**
  - **Vị trí:** `apps/web/src/features/manager/UserManagerPage.tsx:133, 175-200, 252-267, 380-385, 399-420, 631-655, 1251`, `userApi.ts:158-162, 180-184`
  - **Nguyên nhân:** (1) Vô hiệu hóa nút Khóa/Xóa với `CENTER_MANAGER` trong khi backend `UserService:360,402` bảo vệ `ADMIN` hoạt động cuối cùng; (2) `handleRunCleanup` không tải lại `getDeletedUsers()`, còn `L133` `.catch(() => [])` nuốt lỗi thùng rác; (3) `phone: ... || undefined` khiến Admin không thể xóa SĐT cũ; (4) `toggleLockUser`/`toggleRolePermission` chạy GET-rồi-mutate không có khóa in-flight dễ đảo ngược trạng thái khi click đúp; (5) modal cleanup nói sai quy tắc miễn trừ (`UserService` chỉ dọn `MEMBER`).
  - **Khắc phục:** Bảo vệ tài khoản `ADMIN` đang đăng nhập / Admin cuối thay vì `CENTER_MANAGER`; tải lại `getDeletedUsers()` sau cleanup và hiện lỗi thùng rác; gửi `phone: ''` khi xóa SĐT; gửi trạng thái đích rõ ràng kèm khóa in-flight từng dòng.

#### D. Member Core, Thanh Toán, Ví, Lịch Tập & Check-in (`FE-4`, `FE-5`, `E2E-1`, `E2E-2`)

- **`P1-FE-23` `[FE4-02]` — `MemberCheckoutPage` mặc định chọn `packages[0]` (gói Trải nghiệm 3 ngày `0đ` hoặc gói cũ/ngừng bán) khi mở không có `?packageId=`**
  - **Vị trí:** `apps/web/src/features/member/MemberCheckoutPage.tsx:34-37, 115-126` *(gọi từ `MemberPackagesPage.tsx:904`, `MemberProfilePage.tsx:448`)*
  - **Nguyên nhân:** `GET /api/v1/packages` sắp theo giá tăng dần nên `packages[0]` là gói Trial `0đ`; trang không lọc `status === 'active' && !isTrialPackage(p) && durationDays >= MIN_TERM_DAYS`.
  - **Khắc phục:** Lọc đúng danh sách gói bán được khi chọn mặc định hoặc kiểm tra `?packageId=` (chỉ cho phép gói cũ khi đi kèm `subscriptionId` hợp lệ).

- **`P1-FE-24` `[FE4-03]` — `MemberCheckoutPage` hiển thị giá niêm yết đầy đủ thay vì `upgradeCharge`/`quotedPrice` khi mở bằng `?packageId=` mà không có `?subscriptionId=`**
  - **Vị trí:** `apps/web/src/features/member/MemberCheckoutPage.tsx:97-113, 144, 240-244`
  - **Nguyên nhân:** Dù dòng `97` đã tìm thấy gói `pending_payment` tương ứng và `preparePaymentTarget` dùng lại `pending.id`, biến `quotedAmount` chỉ được gán bên trong `if (subscriptionId)` → hiển thị sai số tiền so với khoản thực trừ.
  - **Khắc phục:** Gán `quotedAmount` từ `target.upgradeCharge ?? target.quotedPrice` bất cứ khi nào tìm thấy `target`.

- **`P1-FE-25` `[FE4-04]` — `VnpayReturnPage` gửi lại `POST /verify-return` & bắn trùng toast khi đổi ngôn ngữ VI↔EN, và lặp `POST /verify-return` mỗi 2,5 giây thay vì poll `GET`**
  - **Vị trí:** `apps/web/src/features/payments/VnpayReturnPage.tsx:35-64`
  - **Nguyên nhân:** Đưa hàm `t` (tạo mới mỗi khi đổi ngôn ngữ) vào mảng phụ thuộc `useEffect`; đồng thời vòng poll 12 lần vẫn giữ `hasSignedCallback === true` nên gọi lặp `POST /verify-return` tối đa 12 lần tạo bản ghi IPN thừa.
  - **Khắc phục:** Gỡ `t` khỏi `useEffect` deps; dùng cờ `verified` để gọi `verifyVnpayReturn` đúng 1 lần rồi chuyển sang `getVnpayStatus(reference)` cho các nhịp poll tiếp theo.

- **`P1-FE-26` `[FE4-05]` — `VnpayPayButton` trừ tiền Ví SÖL chỉ bằng 1 cú click không có hộp thoại xác nhận `useConfirm()`**
  - **Vị trí:** `apps/web/src/features/payments/VnpayPayButton.tsx:88-113, 138-146`
  - **Nguyên nhân:** Bấm `"Thanh toán bằng Ví SÖL"` gọi thẳng `prepare()` và `POST /api/v1/wallet/pay` không xác nhận, vi phạm `DESIGN.md:54`.
  - **Khắc phục:** Bọc `handlePayWithWallet` bằng `useConfirm()` hiển thị rõ số tiền sẽ trừ.

- **`P1-FE-27` `[FE4-06]` — `MemberProfilePage` kiểm tra trạng thái xác minh KYC lệch với Backend & `MemberCheckoutPage`**
  - **Vị trí:** `apps/web/src/features/member/MemberProfilePage.tsx:380-387`
  - **Nguyên nhân:** Dùng `Boolean(profile.identityVerified) || profile.kycStatus === 'APPROVED'`, nên nếu `identityVerified === true` nhưng `kycStatus === 'PENDING'|'REJECTED'`, trang hồ sơ báo xanh "Đã xác minh" và ẩn nút gửi lại trong khi backend chặn mua gói.
  - **Khắc phục:** Đồng bộ biểu thức kiểm tra với `MembershipKycEligibility.java:13-14`.

- **`P1-FE-28` `[FE4-07]` — `MemberPackagesPage.isKycRequiredError` không nhận diện mã `MEMBERSHIP_KYC_PENDING` ở chế độ tiếng Việt**
  - **Vị trí:** `apps/web/src/features/member/MemberPackagesPage.tsx:85-90, 651-656`
  - **Nguyên nhân:** Chỉ kiểm `code === 'MEMBERSHIP_KYC_REQUIRED'` và regex không khớp câu tiếng Việt `"Hồ sơ định danh của bạn đang chờ lễ tân duyệt..."`, làm mất đường dẫn sang `/member/packages/checkout`.
  - **Khắc phục:** Bổ sung `code === 'MEMBERSHIP_KYC_PENDING'` vào dòng `88`.

- **`P1-FE-29` `[FE4-08 + FE5-04]` — `MemberCardPage` nuốt lỗi tải QR động thành skeleton vô hạn & tiếp tục hiện mã QR đã hết hạn (>60 giây) khi mất mạng/ẩn tab**
  - **Vị trí:** `apps/web/src/features/member/MemberCardPage.tsx:55-96, 139-170`
  - **Nguyên nhân:** `fetchDynamic()` có `catch {}` rỗng (lỗi lần đầu bị treo skeleton mãi mãi không có nút Thử lại); bỏ qua `res.expiresInSeconds`, không tự ẩn QR khi quá 60s và không gọi làm mới ngay khi quay lại tab (`visibilitychange`/`focus`), vi phạm `DESIGN.md:217`.
  - **Khắc phục:** Theo dõi mốc `expiresAt`, hiện thông báo lỗi + nút Thử lại khi gọi API thất bại, xóa/che ảnh QR ngay khi hết hạn 60s, tạm dừng poll khi tab ẩn và tải mới lập tức khi quay lại tab.

- **`P1-FE-30` `[FE4-09]` — `vnpaySession.ts` xóa `ACTIVE_VNPAY_KEY` khỏi `localStorage` TRƯỚC khi kiểm tra token hoặc chờ API hủy thành công**
  - **Vị trí:** `apps/web/src/features/payments/vnpaySession.ts:52-73`
  - **Nguyên nhân:** Dòng `57` gọi `localStorage.removeItem` trước dòng `61` (`!hasToken`) và trước khi `cancelVnpayTransaction` hoàn thành → lỗi mạng tạm thời làm mất mã giao dịch, khóa thanh toán 30 phút (`409 VNPAY_AWAITING_CONFIRMATION`).
  - **Khắc phục:** Kiểm tra `if (!stored || !hasToken) return` trước và chỉ xóa key sau khi `cancelVnpayTransaction` thành công (hoặc trả 400/404/409).

- **`P1-FE-31` `[FE5-02]` — Đăng ký khóa học bằng lượt miễn phí gọi `checkoutCourse(cls.id, 'cash')` thay vì `enrollCourse(cls.id)` → race điều kiện biến thành nợ tiền mặt im lặng**
  - **Vị trí:** `apps/web/src/features/member/components/MemberGroupClassesView.tsx:156-187`
  - **Nguyên nhân:** Khi `hasFreeCredit` đúng, dòng `172` gọi `checkoutCourse(cls.id, 'cash')`. Nếu lượt miễn phí cuối vừa bị tiêu ở tab khác, backend `checkoutCourse` âm thầm tạo khoản nợ tiền mặt `pending` trong khi UI báo đăng ký miễn phí thành công.
  - **Khắc phục:** Gọi `enrollCourse(cls.id)` (`POST /classes/{id}/enroll`) cho đăng ký dùng lượt miễn phí để backend trả `403 SCHEDULING_COURSE_QUOTA_EXCEEDED` nếu hết lượt.

- **`P1-FE-32` `[FE5-03]` — `QrCameraScanner` giữ closure `onScan` cũ khiến đổi chế độ `Check-in` ↔ `Check-out` lúc camera đang mở gọi nhầm endpoint**
  - **Vị trí:** `apps/web/src/features/checkin/QrCameraScanner.tsx:22, 78-83`, `MemberCheckInPage.tsx:61-75, 100-104`
  - **Nguyên nhân:** `new Decoder` chụp tĩnh prop `onScan` tại thời điểm `start()`. Hội viên mở camera rồi bấm sang tab `Check-out` vẫn gửi `POST /check-in/self` thay vì `/self/checkout`, dính lỗi anti-passback.
  - **Khắc phục:** Lưu `onScan` trong `useRef` cập nhật theo mỗi render và gọi `onScanRef.current(data.trim())`.

- **`P1-FE-33` `[FE5-05]` — `MemberCalendar` nuốt im lặng lỗi tải lịch lớp học nhóm**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCalendar.tsx:256-268`
  - **Nguyên nhân:** Chỉ xử lý `ptFailed && classFailed` và `ptFailed`, thiếu nhánh `else if (classFailed)` (ngoài ra chuỗi `'Không thể tải lịch PT 1:1 của bạn.'` chưa có trong từ điển EN). Khi API lớp nhóm lỗi, toàn bộ lớp nhóm biến mất im lặng không hiện cảnh báo.
  - **Khắc phục:** Bổ sung nhánh `else if (classFailed)` kèm nút Thử lại và dịch đầy đủ 2 câu lỗi sang EN.

- **`P1-FE-34` `[FE5-06]` — Thẻ & chip lịch PT 1:1 trên `MemberCalendar` hiện sai màu nền giống lớp nhóm thay vì `--mcal-pt`**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCalendar.css:2-5`, `apps/web/src/features/schedule/calendar.css:130, 175`, `dark-volt.css:11-13, 36-38`
  - **Nguyên nhân:** `MemberCalendar.css:4` chỉ đặt `border: 1px solid #2f7d5b` cho `.mcal__event--pt, .mcal__chip--pt` mà **quên đặt `background: var(--mcal-pt)`**, nên kế thừa `background: var(--mcal-class)` (hồng cá hồi ở Light, bạc ở Dark), mâu thuẫn với chấm chú giải xanh lá và `DESIGN.md:399`.
  - **Khắc phục:** Bổ sung `background: var(--mcal-pt)` cho `.mcal__event--pt` và `.mcal__chip--pt` (trừ `.is-past`/`.is-cancelled`).

- **`P1-FE-35` `[FE5-07]` — Banner "Tiếp theo" (`Next Up`) trên `MemberCalendar` sai lệch khi chuyển tuần/tháng hoặc khi buổi kế tiếp là lớp nhóm ở tuần sau**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCalendar.tsx:173-188, 256, 274-279`
  - **Nguyên nhân:** PT tải toàn bộ mọi ngày còn lớp nhóm chỉ tải trong cửa sổ `[from, to]` đang xem → xem tuần này vào Chủ nhật có thể bỏ sót lớp nhóm Thứ 2 tuần sau, hoặc chuyển sang tuần quá khứ làm đổi/mất banner `Next Up`.
  - **Khắc phục:** Tách truy vấn `Next Up` độc lập (rolling `[today, addDays(today, 30)]` hoặc lấy buổi kế tiếp từ `getMyEnrollments()`).

- **`P1-FE-36` `[FE5-08]` — `MemberGroupClassesView` nuốt lỗi `getMyEnrollments()` & `getMyQuota()`, và hiển thị sai thông điệp cho hội viên chưa có gói tập**
  - **Vị trí:** `apps/web/src/features/member/components/MemberGroupClassesView.tsx:74-81, 136-137, 273-309`
  - **Nguyên nhân:** `.catch(() => [])` / `.catch(() => null)` khiến lỗi tải quyền lợi làm hội viên Gold/Platinum mất lượt miễn phí và mất giảm giá, còn lớp đã đăng ký lại hiện nút "Đăng ký". Khi chưa có gói (`quota.tier === null`), dòng `286-293` vẫn báo *"vẫn có thể đăng ký thêm có phí"* dù backend sẽ chặn bằng `MEMBERSHIP_INACTIVE_OR_EXPIRED`.
  - **Khắc phục:** Hiện trạng thái lỗi + nút Thử lại và khóa đăng ký khi tải enrollments/quota thất bại; tách nhánh `!quota.tier` thông báo cần kích hoạt gói tập.

- **`P1-FE-37` `[FE5-09]` — Lỗi lệch 1 ngày (off-by-one) trên `MemberGroupClassesView` khóa đăng ký ngay trong ngày khai giảng**
  - **Vị trí:** `apps/web/src/features/member/components/MemberGroupClassesView.tsx:367, 386-388, 427, 445` (đối chiếu `EnrollmentService.java:751, 822, 969`)
  - **Nguyên nhân:** Dùng chung `started = cls.startDate <= today` cho cả hủy và đăng ký, trong khi backend cho phép đăng ký trong ngày khai giảng (`startDate.isBefore(today)`).
  - **Khắc phục:** Tách `registrationClosed = startDate < today` (đăng ký) với `cannotCancel = startDate <= today` (hủy).

- **`P1-FE-38` `[FE5-10]` — Thẻ khóa học trên `MemberGroupClassesView` vẫn giữ viền trái dày `borderLeft: 4px solid`**
  - **Vị trí:** `apps/web/src/features/member/components/MemberGroupClassesView.tsx:373-378`
  - **Nguyên nhân:** Vi phạm quy chuẩn mới 25/11/2026 trong `DESIGN.md:3, 12, 73, 203` yêu cầu bỏ thanh viền trái `4px` trên thẻ lịch/khóa học.
  - **Khắc phục:** Bỏ `borderLeft: 4px`, dùng chấm màu `.class-discipline-dot` cạnh tên bộ môn.

- **`P1-FE-39` `[FE5-11 + E2E-1 P2-1]` — `MemberCoachBookingView` dùng `<input type="date">` native với `fontSize: 13`, vi phạm `DESIGN.md:106` & quy tắc 16px iOS**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCoachBookingView.tsx:970-983`
  - **Nguyên nhân:** Bộ lọc ngày lịch PT vẫn dùng thẻ native `<input type="date" style={{ fontSize: 13 }}>`, kích hoạt auto-zoom trên iOS Safari và vùng chạm ~30px (<44px).
  - **Khắc phục:** Thay bằng `shared/ui/DatePicker`.

- **`P1-FE-40` `[FE5-12]` — `MemberCoachBookingView` hiện nút "Hủy lịch hẹn" & nhãn "Sắp diễn ra" cho buổi PT đang diễn ra, bỏ qua refresh khi `selectedCoachId === null` và quên gọi `onBookingSuccess?.()`**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCoachBookingView.tsx:386-427, 1082-1096, 1148-1156`
  - **Nguyên nhân:** Hiện nút Hủy theo `!hasEnded` trong khi backend `CoachBookingService:728` chặn mọi yêu cầu hủy khi `startTime <= now` (`400 COACH_BOOKING_CANCEL_TOO_LATE`); ngoài ra lệnh tải lại `myBookings` & `quotaStatus` sau hủy bị lồng trong `if (selectedCoachId)`.
  - **Khắc phục:** Tính `hasStarted` theo `centerNowParts()`, hiển thị `"Đang diễn ra"` & ẩn nút Hủy sau giờ bắt đầu; luôn làm mới `myBookings`, `quotaStatus` và gọi `onBookingSuccess?.()` bất kể `selectedCoachId`.

- **`P1-FE-41` `[FE5-13 + E2E-2 #4]` — `MemberCoachBookingView` vẫn hiển thị đơn vị cũ `"200.000 đ / giờ"`, hardcode chuỗi tiền thay vì `formatPrice`, và ẩn mức giảm 10%–20% của Gold/Platinum trong modal xác nhận**
  - **Vị trí:** `apps/web/src/features/member/components/MemberCoachBookingView.tsx:39, 42, 508, 516, 521, 551, 1303, 1411-1415, 1479`, `memberLabels.ts:59-60, 78, 83-85, 91, 147-149`
  - **Nguyên nhân:** Chín vị trí vẫn ghi `"/ giờ"` (xác nhận trực tiếp trên Chromium `E2E-2`) thay vì `"/ slot"` (trong khi mỗi slot kéo dài 1,5h–2,5h và cùng modal dòng 1303 ghi `"/ buổi"`); modal xác nhận luôn hiện `200.000 ₫` mà chưa tính chiết khấu 10% (Gold) / 20% (Platinum).
  - **Khắc phục:** Chuẩn hóa toàn bộ sang `"/ slot"`, dùng `formatPrice(...)`, và hiển thị đúng giá sau chiết khấu hạng thành viên.

#### E. Coach Portal, Điểm Danh & Giáo Án (`FE-6`)

- **`P1-FE-42` `[FE6-02]` — `CoachClassesPage` nuốt lỗi cục bộ khi 1 trong 2 nguồn lịch (PT 1:1 hoặc Lớp nhóm) tải thất bại**
  - **Vị trí:** `apps/web/src/features/coaching/CoachClassesPage.tsx:136-150`
  - **Nguyên nhân:** Chỉ báo lỗi khi cả 2 cùng fail hoặc PT fail kèm `classList.length === 0`; mọi lỗi một phía khác đều im lặng khiến HLV dễ bỏ sót buổi dạy.
  - **Khắc phục:** Hiển thị cảnh báo rõ ràng (kèm nút Thử lại) bất cứ khi nào 1 trong 2 lời gọi bị reject.

- **`P1-FE-43` `[FE6-03]` — `normalizeRoster` trong `CoachAttendancePage` âm thầm biến trạng thái `'late'`/`'excused'` thành `'absent'`**
  - **Vị trí:** `apps/web/src/features/coaching/CoachAttendancePage.tsx:25-30, 40-42, 199, 286` (đối chiếu `SessionAttendanceService.java:394, 466-471`)
  - **Nguyên nhân:** Dòng `28` ép mọi trạng thái khác `'present'` về `'absent'`. Mở và lưu lại buổi có học viên `'late'` (đi muộn, được tính có mặt ở backend) sẽ ghi đè thành vắng mặt và có thể kích hoạt khóa đăng ký do vắng >50%.
  - **Khắc phục:** Quy đổi `'late'` → `'present'` (hoặc giữ nguyên trạng thái lịch sử nếu HLV không thay đổi).

- **`P1-FE-44` `[FE6-04]` — Race trên state `loading` dùng chung & cơ chế reload quá gắt theo `focus`/`visibilitychange` phá mất tuần đang xem và danh sách điểm danh đang chỉnh**
  - **Vị trí:** `apps/web/src/features/coaching/CoachAttendancePage.tsx:100, 129-184, 187-216, 548-553`
  - **Nguyên nhân:** `fetchSessions` và `fetchStudents` cùng ghi chung 1 biến `loading`; mỗi lần chuyển tab trình duyệt rồi quay lại đều bắn `focus` + `visibilitychange` → thay toàn bộ danh sách đang điểm danh bằng `<LoadingSkeleton />`, khóa nút Lưu và kéo `weekStart` nhảy ngược về tuần mặc định (`L155`).
  - **Khắc phục:** Tách `sessionsLoading` và `rosterLoading`; chỉ khởi tạo `weekStart` 1 lần qua ref; không thay danh sách bằng skeleton khi refresh nền lúc đang điểm danh.

- **`P1-FE-45` `[FE6-05]` — Thiếu khóa giao diện điểm danh cho buổi đã hủy, chưa bắt đầu hoặc quá hạn 7 ngày trên `/coach/attendance/:sessionId`**
  - **Vị trí:** `apps/web/src/features/coaching/CoachAttendancePage.tsx:462-630`, `CoachClassesPage.tsx:314-331`
  - **Nguyên nhân:** Backend chặn lưu điểm danh nếu buổi `cancelled`, chưa đến giờ bắt đầu (`ATTENDANCE_SESSION_NOT_STARTED`) hoặc quá 7 ngày (`ATTENDANCE_EDIT_WINDOW_CLOSED`), nhưng trang điểm danh vẫn mở toàn bộ radio + nút Lưu, và `CoachClassesPage:328` vẫn hiện link `"Điểm danh buổi này"` cho buổi đã hủy.
  - **Khắc phục:** Kiểm tra `isCancelled`, `notStarted`, `isExpired (>7 ngày)` bằng `centerTime`, hiện banner giải thích, vô hiệu hóa radio/nút Lưu và ẩn link điểm danh với buổi đã hủy.

- **`P1-FE-46` `[FE6-06]` — `PtAttendancePage` thiếu tab lọc `IN_PROGRESS`, làm lệch tổng số đếm và ẩn các buổi PT đang diễn ra ngay lúc này**
  - **Vị trí:** `apps/web/src/features/coaching/PtAttendancePage.tsx:16, 31-36, 107-121, 177-182`
  - **Nguyên nhân:** `FILTERS` chỉ có `['ALL', 'ATTENDED', 'MISSED', 'UPCOMING']`, bỏ sót `IN_PROGRESS` → tổng 3 tab con không bằng `ALL` và HLV không lọc được các buổi đang dạy để điểm danh.
  - **Khắc phục:** Thêm tab `'IN_PROGRESS'` (`Đang diễn ra`) vào `FILTERS`.

- **`P1-FE-47` `[FE6-07]` — `PtAttendancePage` có cửa sổ race khi đang mở hộp thoại xác nhận và xóa trắng danh sách (`setRows([])`) khi refresh lỗi**
  - **Vị trí:** `apps/web/src/features/coaching/PtAttendancePage.tsx:61-101, 126-156`
  - **Nguyên nhân:** `busy.current` chỉ bật *sau* khi `await confirm(...)` trả về → sự kiện `focus` trong lúc mở modal sẽ gọi `load()` làm thay đổi danh sách phía dưới; ngoài ra `catch` trong `load()` gọi `setRows([])` khiến một lỗi mạng nhẹ xóa sạch danh sách đang hiển thị.
  - **Khắc phục:** Bật `busy.current = true` trong `try/finally` bao trọn `await confirm(...)`, kiểm tra lại ngày hiện tại sau confirm, và giữ nguyên `rows` khi lỗi refresh cùng khoảng ngày.

- **`P1-FE-48` `[FE6-08]` — Chỉ số cơ thể đã tắt (`heightCm`, `weightKg`, `bmi`) vẫn hiển thị trong modal Trợ lý AI soạn giáo án (vi phạm `DESIGN.md:43`)**
  - **Vị trí:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx:2, 1054-1074`, `coachHealthUtils.ts:1-6`, `aiApi.ts:69-71`
  - **Nguyên nhân:** Khối `.ai-member-preview` vẫn hiển thị `Chiều cao / Cân nặng` và `Chỉ số BMI` từ phản hồi `/coaching/members`, vi phạm trực tiếp `DESIGN.md:43`.
  - **Khắc phục:** Gỡ bỏ hoàn toàn các ô chiều cao/cân nặng/BMI khỏi `.ai-member-preview`, chỉ giữ mục tiêu & trình độ tập luyện (`fitnessGoal`, `fitnessLevel`).

- **`P1-FE-49` `[FE6-09]` — `CoachTrainingPlanPage.handleSavePlan` nuốt chi tiết lỗi server & banner gói Silver mâu thuẫn với phân quyền backend**
  - **Vị trí:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx:457-483, 720-738, 1076-1094` (đối chiếu `TrainingPlanService.java:93, 490-504`)
  - **Nguyên nhân:** Dòng `734, 1090` khẳng định HLV vẫn lưu được giáo án cho học viên gói Silver, nhưng backend ném `403 PLAN_TIER_REQUIRED` / `PT_SESSION_REQUIRED`, và `catch {}` dòng `478` bỏ qua toàn bộ `err` nên chỉ báo lỗi chung chung.
  - **Khắc phục:** Hiển thị đúng thông báo từ `staffError(err, ...)` và đồng bộ quy tắc chặn/banner với `TrainingPlanService` theo vai trò `COACH` vs `MANAGER`.

- **`P1-FE-50` `[FE6-10]` — So khớp ID HLV bị `NaN` (`Number(currentUser?.id)`) khi kiểm tra ghi đè AI & thiếu xác nhận ghi đè khi lưu giáo án thủ công**
  - **Vị trí:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx:346-377, 444-483`
  - **Nguyên nhân:** `currentUser.id` là chuỗi username nên `Number(currentUser?.id)` luôn là `NaN` → `Number.isNaN(planCoachId)` luôn `true`, cảnh báo nhầm giáo án của HLV khác; trong khi lưu thủ công `handleSavePlan` lại âm thầm ghi đè giáo án active của chính HLV mà không hỏi xác nhận.
  - **Khắc phục:** Lấy `profile.userId` dạng số từ `getProfile()` để so khớp `plan.coachId`, và bổ sung xác nhận ghi đè trước khi kích hoạt giáo án thủ công.

- **`P1-FE-51` `[FE6-11]` — Bỏ qua kiểm tra hợp lệ bài tập & ngày rỗng trong `CoachTrainingPlanPage` và nới lỏng kiểm tra khi sửa ở `SavedTrainingPlans`**
  - **Vị trí:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx:229-252, 425-429, 444-454, 774-840`, `SavedTrainingPlans.tsx:60-65`
  - **Nguyên nhân:** `handleAddExercise` không gọi `validateExercise` (lọt số âm, tên >150 ký tự, `step={15}` chặn thời gian nghỉ hợp lệ như 20s/40s); `handleSavePlan` bỏ qua khi `startDate`/`endDate` rỗng; `SavedTrainingPlans:64` gọi `validateExercise(item)` với `required = false` cho phép xóa trắng cả lịch tập lẫn số hiệp/phút.
  - **Khắc phục:** Gọi `validateExercise(..., true)` ở cả 3 nơi, thêm `maxLength={150}`, đổi `step={1}` và bắt buộc `startDate`/`endDate` không rỗng.

- **`P1-FE-52` `[FE6-12]` — Tự động điền sẵn 2 bài tập mẫu cứng bằng tiếng Việt vào mọi giáo án mới**
  - **Vị trí:** `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx:89, 132-153`
  - **Nguyên nhân:** `planGoal` mặc định `'Tăng cường sức mạnh và cải thiện tư thế'` và `exercises` điền sẵn `Assisted Pull-up` + `Incline Dumbbell Press` vào Thứ 2 — nếu HLV chỉ thêm bài các ngày khác mà quên xóa, bài mẫu vai/lưng sẽ bị giao nhầm cho học viên chấn thương (và lộ tiếng Việt trong chế độ EN).
  - **Khắc phục:** Khởi tạo `exercises = []`, `planGoal = ''` (chỉ thêm nút "Dùng mẫu khởi đầu" nếu cần).

- **`P1-FE-53` `[FE6-13]` — Tab "Học viên phụ trách" (`CoachClassesPage` Tab 2) bỏ sót học viên PT 1:1 thuần, thiếu nút Thử lại, crash khi trường null và gán nhầm trình độ `Nâng cao`**
  - **Vị trí:** `apps/web/src/features/coaching/coachingApi.ts:87-93`, `CoachClassesPage.tsx:80-115, 474-504`
  - **Nguyên nhân:** `getAllAssignedStudents` chỉ duyệt buổi lớp nhóm (N+1 call, bỏ sót học viên chỉ đặt PT 1:1); không có nút Thử lại khi lỗi; gọi `.toLowerCase()`/`.charAt(0)` trực tiếp trên trường có thể null; mặc định `fitnessLevel` trống thành `'Nâng cao'`.
  - **Khắc phục:** Dùng `/coaching/members` (hoặc gộp PT + lớp nhóm bằng `Promise.allSettled`), thêm nút Thử lại, kiểm tra null an toàn và hiển thị `'—'` khi chưa có trình độ.

- **`P1-FE-54` `[FE6-14]` — Lệch múi giờ & lỗi DST cục bộ trong phép cộng ngày/giờ ở `PtAttendancePage`, `coachTimetable`, `CoachClassesPage`, `CoachAttendancePage`**
  - **Vị trí:** `PtAttendancePage.tsx:19-23, 46-48`, `coachTimetable.ts:31-35`, `CoachClassesPage.tsx:27-42, 57, 275`, `CoachAttendancePage.tsx:109, 152`
  - **Nguyên nhân:** `PtAttendancePage.addDays` parse ISO theo midnight cục bộ + `getTimezoneOffset()` (lệch khi đổi giờ DST và gọi lại mỗi render thay vì lazy initializer); `hasEnded`/`weekStart`/`today` dùng đồng hồ máy thay vì `centerNowParts()`.
  - **Khắc phục:** Dùng phép tính UTC thuần (`Date.UTC`) trong `addDays` (bọc `useState(() => ...)`), và chuẩn hóa mọi đồng hồ sang `centerNowParts()`.

#### F. Lễ Tân, Vận Hành & Quản Trị (`FE-7`)

- **`P1-FE-55` `[FE7-02]` — Lỗi khi xử lý duyệt/từ chối bị xóa trắng ngay lập tức bởi `await load()` trong `HoldManagementPage` & `KycReviewPage`**
  - **Vị trí:** `apps/web/src/features/reception/HoldManagementPage.tsx:37-40, 71-74, 88-91`, `KycReviewPage.tsx:30-31, 77-80`
  - **Nguyên nhân:** Khối `catch` gọi `setError(...)` rồi lập tức gọi `await load()`, mà đầu hàm `load()` lại chạy `setError(null)` → thông báo lỗi 409/400/500 biến mất ngay lập tức không kịp hiện.
  - **Khắc phục:** Truyền cờ `preserveError` (hoặc hiện lỗi thao tác qua `notify(..., 'error')` tách biệt với lỗi tải trang).

- **`P1-FE-56` `[FE7-03]` — Thiếu hộp thoại xác nhận (`useConfirm`) cho 5 thao tác tài chính/phê duyệt không thể đảo ngược ở Lễ tân & Bảo lưu**
  - **Vị trí:** `HoldManagementPage.tsx:61-94, 150, 183`, `StaffReceptionPage.tsx:459-495, 592-671, 952, 960, 1071, 1423`
  - **Nguyên nhân:** Duyệt bảo lưu (hủy lịch của hội viên), rút bảo lưu, xác nhận thu tiền mặt/chuyển khoản PT 1:1, duyệt trải nghiệm 3 ngày (ghi đè tên tài khoản), và thu tiền gói tập/gia hạn đều chạy ngay chỉ với 1 cú click — vi phạm `DESIGN.md:54`.
  - **Khắc phục:** Bọc tất cả bằng `useConfirm()` nêu rõ tên hội viên, tác động và số tiền qua `formatPrice(...)`.

- **`P1-FE-57` `[FE7-04]` — Bảng Nhật ký kiểm toán (`AdminAuditLogsPage`) bị cắt cụt và không cuộn ngang được trên màn hình hẹp/di động**
  - **Vị trí:** `apps/web/src/features/admin/AdminAuditLogsPage.tsx:546, 559-612`
  - **Nguyên nhân:** `<table className="portal-table audit-table">` (`min-width: 640px`) đặt trực tiếp trong `.portal-card--flush` (`overflow: hidden`) mà thiếu thẻ bọc `.portal-table-wrapper`, làm cột `Bản ghi ID` và nút `Xem thay đổi` biến mất trên màn hình `<700px`.
  - **Khắc phục:** Bọc bảng trong `<div className="portal-table-wrapper">`.

- **`P1-FE-58` `[FE7-05]` — Ô tìm kiếm người thực hiện trên `AdminAuditLogsPage` chỉ lọc trong 8 dòng của trang hiện tại & bỏ sót bộ lọc khoảng ngày mà API đã hỗ trợ**
  - **Vị trí:** `apps/web/src/features/admin/AdminAuditLogsPage.tsx:38, 57-62, 116-124, 616-619`, `auditApi.ts:20-28, 58-67`
  - **Nguyên nhân:** `filteredLogs` chỉ lọc mảng 8 dòng đã phân trang từ server trong khi footer vẫn hiện tổng `totalElements` của server; đồng thời `from`/`to` đã có trong API nhưng không có `DatePicker` trên UI.
  - **Khắc phục:** Thêm bộ lọc `DatePicker` `from`/`to`, hỗ trợ lọc người thực hiện phía server (hoặc chọn `user_id`) thay vì lọc cục bộ trên trang 8 dòng.

- **`P1-FE-59` `[FE7-06]` — Chọn yêu cầu gói chờ thanh toán trên `StaffReceptionPage` hiển thị sai trạng thái KYC thành "Chưa xác thực" và trống số CCCD**
  - **Vị trí:** `apps/web/src/features/reception/StaffReceptionPage.tsx:413-428, 1230-1239`
  - **Nguyên nhân:** `handleSelectPendingItem` khởi tạo `selectedMember` với `citizenId: null` và bỏ trống `identityVerified`/`kycStatus`, lại không gọi `refreshSelectedMember()`.
  - **Khắc phục:** Gọi tra cứu đầy đủ hội viên ngay khi chọn mục hàng đợi (có khóa chống stale) hoặc bổ sung trường KYC vào DTO `PendingSubscriptionItem`.

- **`P1-FE-60` `[FE7-07]` — Polling nền `loadUnpaidPt` trên `StaffReceptionPage` không bao giờ xóa `ptError` cũ, che khuất vĩnh viễn danh sách PT vừa phục hồi**
  - **Vị trí:** `apps/web/src/features/reception/StaffReceptionPage.tsx:260-276, 907-915`
  - **Nguyên nhân:** `setPtError('')` chỉ nằm trong `if (!silent)`. Sau 1 lần lỗi mạng, các lần poll nền 6 giây sau thành công và cập nhật số lượng trên chip, nhưng UI vẫn bị chặn bởi `ptError ? <error> : ...`.
  - **Khắc phục:** Gọi `setPtError('')` trong khối `try` sau khi fetch thành công (đồng nhất với 3 hàng đợi còn lại).

- **`P1-FE-61` `[FE7-08]` — `HoldManagementPage` có race condition khi chuyển tab lọc & thiếu cảnh báo hủy khóa học nhóm khi duyệt bảo lưu**
  - **Vị trí:** `apps/web/src/features/reception/HoldManagementPage.tsx:37-50, 186-188`
  - **Nguyên nhân:** `load()` thiếu cờ hủy request khi chuyển nhanh `PENDING → APPROVED → REJECTED`; dòng `187` chỉ cảnh báo hủy buổi PT 1:1 trong khi backend `approveHold` (`L1181-1198`) hủy cả khóa học nhóm (và có thể mất phí/lượt nếu duyệt <3 ngày trước khai giảng).
  - **Khắc phục:** Thêm `requestId` / `AbortController` khi chuyển tab và cập nhật cảnh báo nêu rõ cả khóa học nhóm lẫn PT 1:1.

#### G. Chat Trực Tiếp, Hỗ Trợ & SÖL AI Widget (`FE-8`, `E2E-1`)

- **`P1-FE-62` `[FE8-02]` — Bấm phím `Escape` trong `<Modal>` chuyển tiếp phiếu hỗ trợ bên trong `ChatWidget` làm ẩn panel nhưng để lại `<dialog>` mở bị mắc kẹt (khóa inert toàn trang)**
  - **Vị trí:** `apps/web/src/features/chat/ChatWidget.tsx:96-109`, `StaffSupportChat.tsx:256-264`, `chat-widget.css:163-167`, `Modal.tsx:42-62`
  - **Nguyên nhân:** Listener `document.keydown` của `ChatWidget` chạy trước sự kiện `cancel` gốc của `<dialog>`, gọi `event.preventDefault()` và ẩn widget (`visibility: hidden; pointer-events: none`) trong khi `<dialog open>` vẫn ở Top Layer — làm toàn bộ trang web không bấm được cho tới khi tải lại.
  - **Khắc phục:** Bỏ qua phím `Escape` trong `ChatWidget` khi phát hiện có `document.querySelector('dialog[open]')`.

- **`P1-FE-63` `[FE8-03 + E2E-1 P2-2]` — Lỗi tương phản WCAG nghiêm trọng ở cả Dark & Light mode và rò rỉ màu salmon cứng sang Dark mode trong stylesheet Chat/Support**
  - **Vị trí:** `apps/web/src/features/chat/chat.css:11, 39-40, 76, 82, 89, 94, 105, 110, 163-164, 168, 174`, `chat-widget.css:323, 406, 641, 778, 788-794, 814, 828, 832`, `support-chat.css:21`
  - **Nguyên nhân:** (1) `.direct-chat__unread` dùng chữ `#fff` trên `--sol-accent` (Dark bạc `1,60:1`, Light salmon `2,58:1`); (2) Trên `/messages` Light mode: `.direct-chat__notice` (`#f5f5f5`, `1,15:1`), `.direct-chat__more` (`#f5f5f5`, `1,05:1`), `.direct-chat__link` (`2,58:1`), `.direct-chat__error` (`#ff6b6b`, `2,87:1`), reaction/emoji bar vẫn tối đen; (3) Nút Send/FAB hover & active gán cứng `#e0aa9b` / `#bb7f6f` khiến nút bạc ở Dark mode nhấp nháy sang màu cá hồi; (4) `.support-chat` pill `resolved` dùng `var(--portal-success, #86efac)` không tồn tại ngoài `.portal-backdrop`, nên trên trang công khai Light hiện xanh mint `1,54:1` trên nền kính trắng; (5) Bong bóng tin gửi ở widget Light dùng `#fff` + `text-shadow` và hex `#a35b49` vi phạm `DESIGN.md:70, 72`.
  - **Khắc phục:** Dùng `color: #202020` cho unread badge & Light sent bubble (bỏ `text-shadow`), thay mọi hex salmon bằng `--sol-accent-hover`/`--sol-accent-deep`/`--sol-accent-text`, bổ sung đầy đủ override `:root[data-theme='light']` cho `chat.css` và biến `--support-success` theo theme.

- **`P1-FE-64` `[FE8-04]` — Huy hiệu tin chưa đọc và trạng thái chưa đọc bị kẹt mãi khi quay lại tab trình duyệt**
  - **Vị trí:** `apps/web/src/features/chat/ChatThread.tsx:43-49`
  - **Nguyên nhân:** Khi tin nhắn đến qua Realtime lúc tab đang ẩn (`visibilityState === 'hidden'`), `useEffect` thoát sớm. Khi người dùng quay lại tab, không có dependency nào thay đổi nên `markConversationRead` không bao giờ được gọi.
  - **Khắc phục:** Lắng nghe `visibilitychange`/`focus` (hoặc state `visible`) để gọi `markConversationRead` ngay khi tab trở lại nền trước.

- **`P1-FE-65` `[FE8-05]` — Race condition bất đồng bộ & nhiễm trạng thái chéo giữa các phiếu hỗ trợ trong `MemberSupportChat` và `StaffSupportChat`**
  - **Vị trí:** `apps/web/src/features/chat/MemberSupportChat.tsx:65-70, 141-187`, `StaffSupportChat.tsx:149-161, 252-263`
  - **Nguyên nhân:** `closeTicket` và `send` không kiểm tra `selection.current === id` sau khi `await` → đổi sang Phiếu B lúc đang đóng/gửi Phiếu A làm ghi đè tiêu đề/lỗi của Phiếu A lên Phiếu B; `selectTicket` không xóa `closeError` và dùng `error.message` thô thay vì `supportError(error)`; `StaffSupportChat` dùng chung 1 biến `actionError` cho cả chuyển trạng thái, modal chuyển tiếp và `ChatComposer` (khiến nút Gửi bị kẹt chữ `"Thử lại"` sau khi hủy modal).
  - **Khắc phục:** Kiểm tra `selection.current === targetId` trước mọi lệnh `setState` sau `await`; dùng `supportError()` nhất quán; tách riêng `sendError` khỏi lỗi chuyển trạng thái/chuyển tiếp.

---

### 5.2. Backend, CSDL & OpenAPI `P1-High` (57 lỗi độc lập)

#### A. Security, Auth, Config & Hạ tầng Docker/Nginx (`BE-1A`, `BE-3`, `BE-4`)

- **`P1-BE-01` `[BE1A-03]` — Từ chối dịch vụ (DoS) vĩnh viễn đăng nhập mật khẩu đối với bất kỳ tài khoản nào (kể cả `ADMIN`) bằng `username` trùng `email` nạn nhân**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/auth/RegisterRequest.java:13`, `AuthService.java:175-186`, `UserRepository.java:58-59`, `User.java:34-35`
  - **Nguyên nhân:** `RegisterRequest.username` không giới hạn `max` (DB là `VARCHAR(50)`) và không cấm ký tự `@`. `AuthService.register()` không kiểm tra `username` trùng `email` đã có. Vì `UserRepository.findActiveByIdentifier` truy vấn `lower(username) = :id OR lower(email) = :id` trả về `Optional<User>` (kể cả bản ghi `inactive`), kẻ tấn công chỉ cần đăng ký `username: "admin@scms.vn"` với email rác → mọi lần đăng nhập của Admin sau đó khớp 2 dòng và nổ HTTP 500 `IncorrectResultSizeDataAccessException`.
  - **Khắc phục:** Gắn `@Size(min = 3, max = 50)` + `@Pattern(regexp = "^[a-zA-Z0-9._-]{3,50}$")` (cấm `@`); trong `AuthService.login()` tách rõ nhánh có `@` tìm theo email, không có `@` tìm theo username.

- **`P1-BE-02` `[BE1A-04]` — Tự khóa chết HikariCP (`maximum-pool-size: 5`) do `LockTimeoutJpaTransactionManager` kết hợp `OtpService.verifyOtp(REQUIRES_NEW)`**
  - **Vị trí:** `LockTimeoutJpaTransactionManager.java:38-48`, `OtpService.java:69-70`, `AuthService.java:206-210, 247-256, 373-382`, `application-supabase.yml:7-10`
  - **Nguyên nhân:** `LockTimeoutJpaTransactionManager.doBegin()` mượn ngay 1 kết nối JDBC ngay đầu mọi `@Transactional` để chạy `SET LOCAL lock_timeout`. `AuthService.verifyOtp`, `resetPasswordWithOtp`, `verifyGoogleOtp` đều `@Transactional` (giữ kết nối #1) rồi gọi `otpService.verifyOtp` chạy `REQUIRES_NEW` (đòi thêm kết nối #2). Với pool mặc định 5 kết nối, chỉ cần **5 request xác thực OTP đồng thời** sẽ treo toàn bộ API trong 30 giây rồi nổ HTTP 500 `SQLTransientConnectionException`.
  - **Khắc phục:** Gọi `otpService.verifyOtp(...)` bên ngoài transaction (trả kết nối trước) rồi mới mở transaction riêng để cập nhật `User`; đồng thời cân nhắc nâng `DB_POOL_MAX_SIZE` và bật `leak-detection-threshold`.

- **`P1-BE-03` `[BE1A-05 + BE4-21 + BE3-11]` — Lỗi thứ tự matcher trong `SecurityConfig` & xung đột với `@PreAuthorize` (khóa chết 403 endpoint `/trial/requests/**`, `HEAD /auth/me` nổ 500 NPE, vỡ route alias lớp học & lệch quyền `ADMIN`/`COACH`/`STAFF`)**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/security/SecurityConfig.java:71-72, 92-94, 119, 164-165, 167, 178-179, 187-189, 213` (đối chiếu `AuthController`, `ReceptionTrialController`, `EnrollmentController`, `CenterCheckinController`, `AiChatController`, `MembershipCancellationController`, `Discipline/Room/PackageController`)
  - **Nguyên nhân:** (1) `L167` (`/api/v1/memberships/trial/** -> hasRole("MEMBER")`) chắn trước `ReceptionTrialController` (`/api/v1/memberships/trial/requests/**`, chỉ cho Manager/Receptionist/Admin) → **mọi vai trò đều dính 403**; (2) `L71` chỉ khớp `HttpMethod.GET` cho `/api/v1/auth/me` nên `HEAD /api/v1/auth/me` lọt xuống `L72 permitAll()` và nổ 500 `NullPointerException`; (3) `L178-179` dùng single-segment `*` khiến alias `/api/v1/classes/classes/{id}/enroll|checkout` bị 403 với `MEMBER`; (4) `L92-94` chặn `ADMIN` trên `/check-in/scan`, `/*/checkout`, `/history` (mâu thuẫn `CenterCheckinController`), `L119` mở `COACH` trên `/ai/chat/**` (mâu thuẫn `AiChatController`), `L164-165` mở `STAFF` trên `/cancellations/**`, `L213` mở `MANAGER` trên `/disciplines|/rooms|/packages`.
  - **Khắc phục:** Đưa `/api/v1/memberships/trial/requests/**` lên trước `L167`; đổi `L71` thành khớp mọi HTTP method + thêm `@PreAuthorize("isAuthenticated()")` cho `AuthController.me` và liệt kê tường minh các route auth công khai thay cho `/api/v1/auth/**`; đồng bộ chính xác danh sách role giữa `SecurityConfig` và `@PreAuthorize`.

- **`P1-BE-04` `[BE1A-06]` — Nginx `client_max_body_size 10m` mâu thuẫn giới hạn upload `32MB` của Spring Boot cho hồ sơ bảo lưu**
  - **Vị trí:** `apps/web/nginx.conf:12` vs `apps/api/src/main/resources/application.yml:27-29`
  - **Nguyên nhân:** Spring Boot cho phép tối đa 5 tệp × 5 MB (`max-request-size: 32MB`), nhưng Nginx chặn mọi request >10 MB bằng HTTP `413` trước khi tới API.
  - **Khắc phục:** Nâng `client_max_body_size` lên `35m;` trong `apps/web/nginx.conf` (hoặc cấu hình riêng cho endpoint bảo lưu).

- **`P1-BE-05` `[BE1A-07]` — Thiếu cooldown/quota gửi OTP theo từng email đích & thiếu khóa chống race tạo OTP (lỗ hổng bom email & reset giới hạn thử sai)**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/auth/OtpService.java:43-53`, `RateLimitingFilter.java:32, 80, 124-126`
  - **Nguyên nhân:** `generateOtp` xóa dòng cũ và tạo OTP mới (`failedAttempts = 0`) không giới hạn khoảng nghỉ (ví dụ 60 giây) và không khóa `findByTargetForUpdate` → kẻ tấn công có thể xả 60 email/phút/IP (cạn quota Resend/SMTP), reset liên tục giới hạn 3 lần nhập sai, hoặc gây lỗi trùng khóa duy nhất khi gửi song song.
  - **Khắc phục:** Khóa `findByTargetForUpdate` trong `generateOtp`, bắt buộc cooldown tối thiểu 60 giây trả `429`, giới hạn số lần gửi/giờ theo đích, và đặt rate limit IP chặt riêng cho nhóm endpoint gửi OTP.

- **`P1-BE-06` `[BE1A-08]` — `DatabaseTriggerInitializer` & `PostgreSqlDataSecurityInitializer` chạy SAU khi Tomcat mở cổng 8080 và `/api/v1/health` đã báo `UP`**
  - **Vị trí:** `DatabaseTriggerInitializer.java:27-28, 50-67`, `PostgreSqlDataSecurityInitializer.java:25-27, 43-88`, `HealthController.java:16-19`, `compose.yml:26-31, 45-48`
  - **Nguyên nhân:** Cả hai implement `ApplicationRunner` (chạy *sau* khi Tomcat đã mở cổng lắng nghe), còn `/api/v1/health` luôn trả `200 UP` cứng → khi khởi động lạnh trên VPS/Supabase, traffic thực có thể lọt vào trước khi trigger bất biến & RLS được cài xong.
  - **Khắc phục:** Chạy 2 initializer ở `SmartInitializingSingleton` / `SmartLifecycle` trước khi web server bind port, và chỉ trả `200 UP` từ `/api/v1/health` sau khi `ApplicationReadyEvent` hoàn tất + DB sẵn sàng.

#### B. Người Dùng, Hồ Sơ, KYC & Hạ Tầng Chung (`BE-1B`)

- **`P1-BE-07` `[BE1B-01]` — Xóa mềm hoặc đổi vai trò hội viên quay lại mua gói mới sẽ ÂM THẦM HỦY TOÀN BỘ gói trả phí đang hoạt động (không hoàn tiền)**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/users/UserService.java:421-435`
  - **Nguyên nhân:** Kiểm tra `cancellationRequestRepository.existsByMemberUserIdAndStatus(id, "APPROVED")` theo **hội viên** thay vì theo từng **subscription**. Bất kỳ hội viên nào từng có 1 đơn hủy gói trong lịch sử rồi sau đó mua gói mới, khi bị Admin gọi xóa/đổi role sẽ bị hủy sạch mọi gói `active`/`frozen`/`pending_payment` hiện tại, vượt qua luôn chốt chặn `USER_HAS_OPEN_COMMITMENTS`.
  - **Khắc phục:** Chỉ hủy gói `rem` khi `existsBySubscriptionIdAndStatus(rem.getId(), "APPROVED")` là `true`.

- **`P1-BE-08` `[BE1B-02]` — Thiếu phân quyền `MEMBER` trên `POST /api/v1/profile/kyc` cho phép nhân sự tự tạo bản ghi hội viên rác & Lễ tân tự duyệt KYC cho chính mình**
  - **Vị trí:** `ProfileController.java:91-95`, `ProfileService.java:342-350`, `MemberKycReviewService.java:75-86`, `SecurityConfig.java:73-80`
  - **Nguyên nhân:** Endpoint không có `@PreAuthorize("hasRole('MEMBER')")`, service không kiểm tra role và tự tạo mới thực thể `Member` (`MEM-<userId>`) + ghi đè `fullName`, còn `MemberKycReviewService.approve` không chặn `reviewer.id().equals(memberId)`.
  - **Khắc phục:** Gắn `@PreAuthorize("hasRole('MEMBER')")` + rule trong `SecurityConfig`, kiểm tra role `MEMBER` trong `ProfileService.submitMemberKyc`, và chặn tự duyệt/từ chối chính mình trong `MemberKycReviewService`.

- **`P1-BE-09` `[BE1B-03]` — Hỏng máy trạng thái KYC, lỗ hổng TOCTOU đánh tráo hồ sơ khi duyệt & thiếu kiểm tra trùng CCCD/Hộ chiếu giữa các tài khoản**
  - **Vị trí:** `ProfileService.java:342-427`, `MemberKycReviewService.java:75-120`, `Member.java:46-86`
  - **Nguyên nhân:** (1) `submitMemberKyc` không chặn trạng thái `APPROVED` hoặc `PENDING` → hội viên đã duyệt vẫn nộp đè làm tụt `identityVerified = false`, hoặc **đánh tráo CCCD/họ tên/ảnh đúng tích tắc trước khi lễ tân bấm Duyệt (TOCTOU)**; (2) `MemberKycReviewService` không khóa `findByUserIdForUpdate` (race giữa 2 lễ tân duyệt/từ chối); (3) Không có cột `citizen_id_hash` duy nhất nên nhiều tài khoản dùng trùng 1 số CCCD/Hộ chiếu; (4) Đổi từ `CCCD` sang `PASSPORT` vẫn giữ ảnh mặt sau `backImageUrl` cũ.
  - **Khắc phục:** Chặn `submitMemberKyc` bằng `409` khi đã `APPROVED` hoặc `PENDING`; khóa `findByUserIdForUpdate` ở cả nộp và duyệt/từ chối; thêm cột HMAC `citizen_id_hash` chống trùng giữa các tài khoản; xóa `backImageUrl = null` khi đổi sang `PASSPORT`.

- **`P1-BE-10` `[BE1B-04]` — Lỗ hổng vượt qua kiểm tra ảnh Avatar (chấp nhận tệp không phải ảnh & URL ngoài) và nguy cơ DoS tràn bộ nhớ JVM OOM (bom giải nén PNG / Base64 không giới hạn)**
  - **Vị trí:** `ProfileService.java:217-277`, `ImageDataUrlValidator.java:36-48`, `MemberKycRequest.java:19-21`
  - **Nguyên nhân:** (1) `validateAvatarUrl` không kiểm tra magic bytes, nếu `ImageIO.read` trả `null` (HTML/SVG/text) hoặc ném lỗi thì `catch (Exception ignored)` **vẫn cho qua**; (2) `ImageIO.read` giải nén toàn bộ điểm ảnh vào heap *trước* khi kiểm tra `4096×4096` (1 file PNG ~50 KB kích thước 30.000×30.000 đánh sập JVM bằng `OutOfMemoryError`); (3) Chấp nhận `http://`, `https://`, `//evil.com/...` gây SSRF phía trình duyệt nhân sự/khách; (4) `MemberKycRequest` thiếu `@Size` và `ImageDataUrlValidator` gọi `Base64.decode` trước khi kiểm tra độ dài chuỗi.
  - **Khắc phục:** Dùng `ImageDataUrlValidator` kiểm tra magic bytes cho avatar, đọc kích thước qua `ImageReader.getWidth(0)/getHeight(0)` không giải nén pixel, chặn URL ngoài/protocol-relative, kiểm tra `base64Part.length()` *trước* khi decode và gắn `@Size(max = 2800000)` cho `MemberKycRequest`.

- **`P1-BE-11` `[BE1B-05]` — Rò rỉ tài khoản đã xóa mềm, bị khóa hoặc đã đổi vai trò qua `CoachRepository`, `MemberRepository`, `MemberKycReviewService` và `UserRepository`**
  - **Vị trí:** `CoachRepository.java:13-31`, `UserService.java:329-347`, `MemberRepository.java:19, 26-27, 33-35`, `MemberKycReviewService.java:61-66, 112-120`, `UserRepository.java:90-91`
  - **Nguyên nhân:** (1) Đổi vai trò `COACH` sang role khác không hạ `coaches.employment_status` và `CoachRepository.findPublicCoaches()`/`findActiveWithUser()` không lọc `upper(u.role.code) = 'COACH'` → cựu HLV vẫn công khai & đặt được lịch; (2) `MemberRepository.findByUserIdForUpdate`, `findByMembershipCode`, `findByKycStatusOrderByKycSubmittedAtAsc` và `MemberKycReviewService.pending()` không lọc `deletedAt is null`; (3) `UserRepository.findActiveStaffUsers()` thiếu `u.status = 'active'` nên nhân sự bị khóa vẫn nhận thông báo nội bộ.
  - **Khắc phục:** Bổ sung điều kiện role `'COACH'`, hạ `employmentStatus` khi đổi role, lọc `deletedAt is null` trên các query `MemberRepository`/`MemberKycReviewService`, và thêm `u.status = 'active'` vào `findActiveStaffUsers()`.

- **`P1-BE-12` `[BE1B-06]` — `GlobalExceptionHandler` làm lộ thông điệp nội bộ `IllegalStateException`, ánh xạ trượt ràng buộc duy nhất `email`/`username` của Hibernate 6, và trả HTTP 500 cho các lỗi 4xx chuẩn**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/common/GlobalExceptionHandler.java:199-208, 222-320, 419-428`, `User.java:15, 31`
  - **Nguyên nhân:** (1) `handleIllegalArgument` gom `IllegalStateException` thành HTTP 400 và trả thẳng `ex.getMessage()` (lộ lỗi nội bộ crypto/VNPay/QR chưa dịch); (2) `User.email` không đặt tên ràng buộc nên Hibernate 6 sinh tên hash `uk6dot...` không khớp `users_email_key` → mất mã `EMAIL_EXISTS`, và `uq_users_username` chưa được map sang `USERNAME_EXISTS`; (3) Thiếu handler cho `MaxUploadSizeExceededException`/`MultipartException` (413/400), `PropertyReferenceException` (400), `HttpMediaTypeNotSupportedException` (415), `HttpMediaTypeNotAcceptableException` (406), `HandlerMethodValidationException` (400), `ResponseStatusException` → tất cả nổ HTTP 500.
  - **Khắc phục:** Tách `IllegalStateException` về 500 và trả thông báo i18n cho `IllegalArgumentException`; đặt tên tường minh `uq_users_email` và map `uq_users_username`; bổ sung đầy đủ handler chuẩn 4xx.

#### C. Lịch Học, Cơ Sở Vật Chất, Danh Mục & Seeders (`BE-2`, `BE-7`)

- **`P1-BE-13` `[BE2-05]` — `EnrollmentService.checkoutCourse` bỏ qua kiểm tra quyền phòng VIP Platinum**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/scheduling/service/EnrollmentService.java:811-860` (so sánh `L758`)
  - **Nguyên nhân:** `checkoutCourse` không gọi `SessionEligibility.ensurePlatinumRoomAccess(...)`. Hội viên Silver/Gold khi hết lượt miễn phí vẫn đăng ký trả phí được vào lớp học tại `Phòng Gym VIP` (`tier = PLATINUM`).
  - **Khắc phục:** Gọi `ensurePlatinumRoomAccess` cho toàn bộ giai đoạn `[startDate, endDate]` trong cả `enrollCourse` và `checkoutCourse`.

- **`P1-BE-14` `[BE2-06]` — `EnrollmentService.getMemberCourseQuota` không đếm bản ghi `completed`, cho phép học miễn phí vô hạn theo chuỗi**
  - **Vị trí:** `EnrollmentService.java:692-700`, `ClassEnrollmentRepository.java:104-121`
  - **Nguyên nhân:** Chỉ đếm `status = 'booked'` (và `cancelled` có `creditForfeited = true`), bỏ sót `status = 'completed'`. Khi khóa học kết thúc và chuyển `completed`, lượt miễn phí tự động hồi lại trong cùng chu kỳ gói 3/6/12 tháng.
  - **Khắc phục:** Đếm cả `status IN ('booked', 'completed')` cộng các bản ghi hủy mất lượt.

- **`P1-BE-15` `[BE2-07]` — `DELETE /api/v1/classes/enrollments/{id}` (`EnrollmentService.cancel`) không hoàn tiền học phí đã thanh toán `success`**
  - **Vị trí:** `EnrollmentService.java:324-388` (so sánh `L962-1014`)
  - **Nguyên nhân:** Khác với `cancelCourseEnrollment`, hàm `cancel` chỉ chuyển payment `pending` → `failed` và hoàn toàn bỏ qua payment `success`, không hoàn vào Ví SÖL và không ghi `cancelledBy`.
  - **Khắc phục:** Dùng chung hàm hoàn tiền khóa học (`refundCoursePayment`) và ghi nhận `cancelledBy` ở cả hai endpoint hủy.

- **`P1-BE-16` `[BE2-08]` — `createRecurringClass` và `checkRecurringAvailability` kiểm tra giờ quá khứ theo `request.startDate()` thay vì ngày buổi đầu tiên `firstDate`**
  - **Vị trí:** `ClassService.java:277, 873, 909`
  - **Nguyên nhân:** Nếu hôm nay là Thứ 2 10:00 và quản lý mở khóa học Thứ 3/Thứ 5 ca `Slot 1 (07:00–09:30)` với `startDate = Thứ 2`, buổi đầu tiên thực tế là Thứ 3 07:00 (tương lai) nhưng cả wizard lẫn API tạo lớp đều báo sai `400 SCHEDULING_PAST_SESSION`.
  - **Khắc phục:** Sinh `sessionDates` trước rồi kiểm tra tương lai trên `sessionDates.get(0)`.

- **`P1-BE-17` `[BE2-09]` — Chặn sai hội viên gia hạn nối tiếp khi đăng ký khóa học, đồng thời bỏ lọt bảo lưu giữa khóa & hết hạn Platinum sau ngày khai giảng**
  - **Vị trí:** `EnrollmentService.java:756-758, 827-829`, `SessionEligibility.java:65-142`, `MembershipSubscriptionRepository.java:138-152`
  - **Nguyên nhân:** `ensureMembershipCoversSession` đòi hỏi **1 dòng** gói duy nhất phủ cả `today` và `startDate` → hội viên đã gia hạn nối tiếp (gói cũ kết thúc 31/3, gói mới 1/4–30/6) bị chặn đăng ký khóa mở ngày 5/4; ngược lại, hệ thống không kiểm tra bảo lưu đã duyệt hoặc hạng Platinum trên các ngày sau `startDate` trong `[startDate+1..endDate]`.
  - **Khắc phục:** Kiểm tra `hasActiveMembership(today)` + chuỗi bao phủ liên tục `coverageEnd >= endDate`; chặn nếu có bảo lưu đã duyệt trùng bất kỳ buổi học nào; kiểm tra quyền phòng Platinum xuyên suốt toàn bộ các buổi của khóa.

- **`P1-BE-18` `[BE2-10]` — `rescheduleSession` và `cancelSession` cho phép chỉnh sửa/hủy buổi học đã `completed` (và vượt qua mọi trigger xung đột DB)**
  - **Vị trí:** `ClassService.java:763-829` (`L774`), `ClassSessionService.java:85-103` (`L89`)
  - **Nguyên nhân:** Chỉ chặn `status == 'cancelled'`, bỏ lọt `'completed'`. Dời một buổi `completed` sang ngày tương lai giữ nguyên `status = 'completed'`, khiến cả 3 trigger DB (`NEW.status <> 'scheduled'`) bỏ qua hoàn toàn; hủy buổi `completed` làm sai lịch sử điểm danh và gửi thông báo hủy hàng loạt.
  - **Khắc phục:** Yêu cầu nghiêm ngặt `"scheduled".equalsIgnoreCase(session.getStatus())` ở cả hai hàm.

- **`P1-BE-19` `[BE2-11 + BE7-05]` — Thiếu trigger DB khi cập nhật `classes` (`coach_id/room_id/discipline_id/status`), `trg_pt_schedule_class` chạy thừa & kiểm tra cả buổi quá khứ, và `ClassService` không kiểm tra HLV bị xóa mềm**
  - **Vị trí:** `ClassService.java:155-163, 234-242, 363-371, 442-452`, `postgresql-triggers.sql:152-155, 712-719, 740-742`
  - **Nguyên nhân:** (1) `ClassService.updateClass` chỉ cập nhật `s.setUpdatedAt(...)` trên `class_sessions`, phụ thuộc vào việc Hibernate không dùng `@DynamicUpdate` (nếu dùng JPQL/SQL trực tiếp hoặc bật `@DynamicUpdate` thì `trg_sessions_check_conflict` không kích hoạt); (2) `trg_pt_schedule_class` không có `WHEN (OLD.coach_id IS DISTINCT FROM NEW.coach_id)` nên chạy trên mọi lệnh sửa tên/mô tả lớp, lấy khóa toàn cục `391133` và quét luôn cả buổi quá khứ chưa chuyển `completed`; (3) `ClassService` chỉ kiểm tra `coach.employmentStatus`, không kiểm tra `coach.user.deletedAt == null && status == 'active'`.
  - **Khắc phục:** Bổ sung trigger `AFTER UPDATE OF coach_id, room_id, discipline_id, status ON classes`, thêm `WHEN (OLD.coach_id IS DISTINCT FROM NEW.coach_id)` + lọc `session_date >= today` trong `trg_pt_schedule_class`, và kiểm tra `user.deletedAt`/`status` trong `ClassService`.

- **`P1-BE-20` `[BE2-12]` — `enrollCourse` & `checkoutCourse` bỏ sót `busiestSession` / trùng `SessionBooking` và không `saveAndFlush` trước khi gọi VNPay**
  - **Vị trí:** `EnrollmentService.java:760-789, 831-931`
  - **Nguyên nhân:** Bỏ qua `+ busiestSession(classId)` khi đếm sức chứa và dùng `save()` thay vì `saveAndFlush()`, khiến trigger CSDL (`trg_enrollments_check_capacity`, `trg_pt_schedule_enrollment`) chỉ phát nổ sau khi `vnpayPaymentService.checkout(...)` đã chạy.
  - **Khắc phục:** Cộng `busiestSession`, kiểm tra trùng `sessionBookings`, và gọi `enrollments.saveAndFlush(enrollment)` trước bước thanh toán/VNPay.

- **`P1-BE-21` `[BE2-13]` — `DemoDataSeeder.reseedDemoPtBookings` có thể đánh sập quá trình khởi động do xung đột với `class_sessions` đang có**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/demo/DemoDataSeeder.java:157-164, 466-534`
  - **Nguyên nhân:** Khi `coach_bookings` rỗng nhưng DB đã có lớp nhóm chiếm `SLOT_2`/`SLOT_3`/`SLOT_4` của các HLV demo, `reseedDemoPtBookings` chèn thẳng lịch PT không kiểm tra trùng → trigger `trg_pt_schedule_booking` làm crash startup.
  - **Khắc phục:** Kiểm tra không trùng `class_sessions` trước khi chèn từng lịch PT demo.

#### D. Huấn Luyện, Điểm Danh & Sức Khỏe (`BE-3`, `BE-4`)

- **`P1-BE-22` `[BE3-02]` — Lỗ hổng trục lợi nhân đôi lượt PT miễn phí (lên tới 2× quota, 1.200.000đ) khi nâng cấp từ Trial → Trả phí hoặc Gold → Platinum**
  - **Vị trí:** `CoachBookingService.java:258-317, 448-481`, `PackageBenefits.java:134-142, 175-191`
  - **Nguyên nhân:** `countQuotaUsageForSubscription()` dừng truy ngược chuỗi tại gói Trial, nhưng `PackageBenefits.cycleAnchor()` **không dừng tại gói Trial**. Hội viên dùng Trial 3 ngày (1/11) rồi mua Platinum 30 ngày (3/11–2/12) có `cycleAnchor = 1/11`: Chu kỳ 1 (1/11–30/11) nhận **6 buổi PT**, sang 1/12–2/12 (vẫn thuộc gói 30 ngày đó) rơi vào Chu kỳ 2 nên `usedQuota` reset về 0 và nhận thêm **6 buổi PT nữa (tổng 12 buổi thay vì 6!)**. Hiện tượng reset tương tự xảy ra khi nâng cấp giữa kỳ Gold → Platinum; đồng thời `activeSubs.get(0)` lấy phần tử không sắp thứ tự.
  - **Khắc phục:** Dừng `PackageBenefits.cycleAnchor()` trước gói Trial, giới hạn tổng số chu kỳ/quota khớp thời hạn đã mua của gói nâng cấp, và sắp xếp `activeSubs` ổn định theo thứ tự ưu tiên rõ ràng.

- **`P1-BE-23` `[BE3-03]` — `CourseAttendanceService.sweep()` tự gọi `this.markMissedSessions()` bỏ qua `@Transactional` (nguy cơ `LazyInitializationException` & ghi phi nguyên tử)**
  - **Vị trí:** `CourseAttendanceService.java:73-123, 158-180`, `ClassSessionRepository.java:81-86`, `GymClass.java:37-39`
  - **Nguyên nhân:** `sweep()` không có `@Transactional`, gọi `this.markMissedSessions()` bỏ qua Spring proxy; với `open-in-view: false`, `findNotCancelledBetween` không `join fetch c.coach` nên truy cập `gymClass.getCoach()` ngoài transaction có thể ném `LazyInitializationException` (bị nuốt ở `L79`), làm hỏng cơ chế đánh dấu vắng tự động và khóa đăng ký khi vắng >50%.
  - **Khắc phục:** Tách scheduler ngoài gọi qua Spring bean proxy và bổ sung `join fetch c.coach`.

- **`P1-BE-24` `[BE3-04]` — `SessionAttendanceService.getSessionAttendanceRoster()` loại bỏ bản ghi `"completed"`, xóa trắng danh sách điểm danh của các buổi cũ (>7 ngày) trong lịch sử 31 ngày**
  - **Vị trí:** `SessionAttendanceService.java:120-135, 145-237` (so sánh `L249-305, 337-352`)
  - **Nguyên nhân:** `rosterFor()` chỉ lấy enrollment/booking trạng thái `"booked"`, bỏ qua `"completed"` — nên sau khi khóa hoàn tất (>7 ngày), mở xem lại buổi học từ lịch sử 31 ngày trả về `totalBooked: 0, members: []`.
  - **Khắc phục:** Đưa `"completed"` vào `rosterFor()` (đồng bộ với `recordBatchAttendance`) và hợp nhất mọi học viên đã có bản ghi `session_attendance`.

- **`P1-BE-25` `[BE3-05 + BE4-11]` — Check-in cổng, Dynamic QR, chiết khấu hạng & trigger CSDL không chặn gói có bảo lưu đã duyệt trong ngày bắt đầu bảo lưu — nghiêm trọng hơn do `MembershipLifecycleScheduler` thiếu `zone = "Asia/Ho_Chi_Minh"`**
  - **Vị trí:** `CenterCheckinService.java:143-150, 251-262`, `MembershipLifecycleScheduler.java:42`, `MembershipSubscriptionService.java:1162-1165, 1281-1289, 1380-1393`, `MemberDiscountService.java:34-42`, `postgresql-triggers.sql:278-305`
  - **Nguyên nhân:** `MembershipLifecycleScheduler` đặt `@Scheduled(cron = "0 15 0 * * ?")` **thiếu `zone = "Asia/Ho_Chi_Minh"`**, nên trên container Docker UTC chạy lúc **07:15 sáng giờ Việt Nam**. Từ 00:00–07:15 sáng ngày `holdStartDate` (hoặc cả ngày nếu cron lỡ nhịp), gói vẫn ở `status = 'active'` dù đã được cộng thêm ngày kéo dài, và cả `CenterCheckinService`, `generateDynamicQr()`, `MemberDiscountService` lẫn trigger `scms_require_active_membership_for_checkin()` đều không kiểm tra `!sub.isHeldOn(today)` → hội viên vừa hưởng ngày cộng thêm vừa vào tập/hưởng giảm giá. Ngược lại, ngày hết bảo lưu bị khóa cửa tới tận 07:15 sáng.
  - **Khắc phục:** Thêm `zone = "Asia/Ho_Chi_Minh"` vào `MembershipLifecycleScheduler`; bổ sung kiểm tra `!sub.isHeldOn(today)` / loại trừ ngày bảo lưu đã duyệt tại tất cả 5 điểm trên (kể cả trigger PostgreSQL).

- **`P1-BE-26` `[BE3-06]` — `TrainingPlanService.getPlanById()` làm lộ giáo án `draft`/`cancelled` cho hội viên & lỗ hổng IDOR cho phép cựu HLV lớp nhóm đọc vĩnh viễn giáo án riêng của HLV khác**
  - **Vị trí:** `TrainingPlanService.java:330-372`, `CoachMemberAccess.java:37-44`
  - **Nguyên nhân:** `getPlanById()` không kiểm tra `plan.getStatus()` cho `MEMBER` (khác với `getMyActivePlans()`), cho phép hội viên đọc giáo án nháp/đã hủy theo ID. Với `COACH`, `CoachMemberAccess` cấp quyền dựa trên bất kỳ lịch sử lớp nhóm/PT cũ nào (kể cả đã `completed`), nên 1 HLV từng dạy hội viên trong 1 buổi lớp nhóm cũ đọc được toàn bộ giáo án 1:1 riêng tư (kể cả nháp) của HLV khác.
  - **Khắc phục:** Giới hạn `MEMBER` chỉ xem được giáo án `"active"` (hoặc hoàn thành hợp lệ); với `COACH`, bắt buộc là chủ giáo án (`plan.coach.userId == currentUserId`) hoặc có quan hệ đang hoạt động qua `CurrentCoachMembers.requireCoachOf(...)`.

- **`P1-BE-27` `[BE3-07]` — Endpoint điểm danh lớp nhóm đang bật vượt qua cờ tắt `app.coaching.evaluations.enabled` và cho phép sửa ghi chú điểm danh đã khóa (>7 ngày)**
  - **Vị trí:** `SessionAttendanceService.java:64-65, 158-168, 276-279, 354-364, 384-436, 452`
  - **Nguyên nhân:** `SessionAttendanceService` inject vô điều kiện `SessionEvaluationRepository` → gửi `publishEvaluations=true` kèm `progressScore` lên `POST /attendance/sessions/{id}/batch` vẫn lưu bảng `session_evaluations` và bắn thông báo đánh giá dù cờ tính năng đang tắt; dòng `452` trả lại `item.progressScore()` dù không lưu; dòng `390-415` vẫn ghi đè `notes`/`recordedBy` khi `statusLocked == true`.
  - **Khắc phục:** Chặn đọc/ghi đánh giá & thông báo bằng `@Value("${app.coaching.evaluations.enabled:false}")`; không ghi đè bất kỳ trường nào khi `statusLocked == true`.

#### E. Thành Viên, Tài Chính, VNPay & Ví SÖL (`BE-4`)

- **`P1-BE-28` `[BE4-04]` — Lỗ hổng Open Redirect & rò rỉ tham số VNPay đã ký HMAC qua header `Origin`/`Referer` không tin cậy trong `VnpayGateway.resolveReturnUrl`**
  - **Vị trí:** `VnpayController.java:38-41`, `WalletController.java:119-125`, `VnpayGateway.java:86-101`
  - **Nguyên nhân:** `resolveReturnUrl` chấp nhận **bất kỳ** host HTTPS nào (`"https".equalsIgnoreCase(scheme)`) lấy từ header `Origin`/`Referer` mà không đối chiếu danh sách cho phép, sau đó ký vào `vnp_ReturnUrl` bằng bí mật HMAC-SHA512 của server → kẻ tấn công tạo được link VNPay hợp lệ chuyển hướng nạn nhân cùng toàn bộ tham số `vnp_TxnRef`/`vnp_TransactionNo`/`vnp_SecureHash` về domain phishing.
  - **Khắc phục:** Chỉ cho phép origin nằm trong danh sách cấu hình hợp lệ (`app.cors.allowed-origins` / `config.returnUrl()`), mọi host khác quay về `config.returnUrl()`.

- **`P1-BE-29` `[BE4-05]` — Hủy gói đã nâng cấp ghi thiếu tiền hoàn trên giao dịch cũ & `PaymentService.refundPayment` cho phép hoàn tiền gói cũ đã bị thay thế (Rủi ro hoàn tiền 2 lần / sai lệch doanh thu)**
  - **Vị trí:** `MembershipCancellationService.java:280-287, 452-474`, `PaymentService.java:650-750`, `SubscriptionValueCalculator.java:52-72`
  - **Nguyên nhân:** (1) Khi hủy gói nâng cấp `S2` (hoàn `2.900.000đ` gồm `2.000.000đ` của `P2` + `900.000đ` tín dụng chuyển từ `S1`/`P1`), `recordRefundOnPayments` chỉ trừ trên `P2`, bỏ sót `900.000đ` trên `P1` (`P1` vẫn nguyên `status="success", refundedAmount=null`); (2) `PaymentService.refundPayment` không khóa `Member` và không kiểm tra `S1` đã có gói nâng cấp `S2` thay thế hay chưa → gọi hoàn `P1` trả đủ tiền cho hội viên trong khi `S2` vẫn `active` (và sau đó hủy `S2` lại được hoàn phần tín dụng từ `P1` lần thứ 2!).
  - **Khắc phục:** Duyệt ngược chuỗi `previousSubscription` trong `recordRefundOnPayments` để ghi nhận đủ phần hoàn từ tín dụng chuyển tiếp; trong `PaymentService.refundPayment`, khóa `Member` và chặn hoàn tiền mọi gói đã có gói nâng cấp kế tiếp đang `active`/`pending_payment`.

- **`P1-BE-30` `[BE4-06]` — `EntitlementRevocationService.revokeUncoveredBookings` hủy buổi PT 1:1 đã thanh toán & đang chờ thanh toán mà không hoàn tiền hoặc đóng khoản thu**
  - **Vị trí:** `EntitlementRevocationService.java:65-96`, `MembershipCancellationService.java:266-267, 389-408`, `PaymentService.java:763-789`
  - **Nguyên nhân:** Khác với `releaseBookingsBetween()` (`L141` gọi `settleCoachPayments()`), `revokeUncoveredBookings()` chỉ đổi `booking.status = "cancelled"` mà bỏ qua `payments.findAllByCoachBookingId(...)` → buổi PT đã trả `200.000đ` bị hủy mất tiền không hoàn vào ví, còn payment `pending` VNPay nếu IPN về sau sẽ rơi vào vòng lặp `ConflictException → RspCode=99` không hoàn tiền.
  - **Khắc phục:** Gọi xử lý hoàn tiền (`creditCoachBookingRefund` với khóa `COACH_REFUND_<id>`) cho payment `success` và chuyển `pending` → `failed` trong `revokeUncoveredBookings()`.

- **`P1-BE-31` `[BE4-07]` — Tạo trùng 2 khoản thu `pending` cho gói có biên lai tiền mặt & `ConflictException` không được bắt trong `VnpayPaymentService.ipn` làm tiền khách bị kẹt vĩnh viễn (`RspCode = 99`)**
  - **Vị trí:** `VnpayPaymentService.java:230-241, 275-289, 392-419, 482-500, 545-553`, `PaymentService.java:404, 431-439`
  - **Nguyên nhân:** (1) `findOrCreate` bỏ qua khoản tiền mặt `P1` có `receiptImage` và tạo thêm khoản `P2` cho cùng `subscriptionId`; khi lễ tân xác nhận `P1` (chỉ kiểm `vnpayGuard.payment(P1)` thay vì `vnpayGuard.subscription`), gói kích hoạt trong lúc VNPay `P2` đang mở → IPN `P2` về nổ `ConflictException("PAYMENT_SUBSCRIPTION_NOT_PENDING")`; (2) `resolveTargetPayment` không kiểm tra khóa học `classEnrollmentId` đã hủy chưa; (3) `ipn()` chỉ catch `BadRequestException` KYC (`L405`), mọi `ConflictException` khi ngân hàng đã thu tiền (`00/00`) đều rollback & trả `RspCode = 99` vĩnh viễn mà không hoàn tiền vào ví.
  - **Khắc phục:** Chặn tạo payment thứ 2 khi đã có bất kỳ payment `pending` nào; khóa bằng `vnpayGuard.subscription(...)`; kiểm tra `classEnrollmentId` trước tạo link; trong `ipn()` bắt `ConflictException` trên giao dịch đã thu tiền `00/00` để đánh dấu `gatewayTransactionNo`, chuyển `p.status = "failed"`/`"refunded"`, gọi `creditLateGatewayPayment` hoàn ví và trả `"00"`.

- **`P1-BE-32` `[BE4-08]` — `PaymentService.refundPayment` không cộng lại tiền vào ví khi hoàn giao dịch `online_wallet`, cho phép hoàn `WALLET_TOPUP:COUNTER` mà không trừ ví, và cho phép hoàn một phần trên PT/Shop**
  - **Vị trí:** `PaymentService.java:649-700`, `VnpayPaymentGuard.java:64-67`, `CounterTopupService.java:100-115`
  - **Nguyên nhân:** `PaymentService` không inject `WalletService`: (1) Hoàn một khoản nạp ví tại quầy (`WALLET_TOPUP:COUNTER`) trừ doanh thu báo cáo nhưng không trừ lại số dư ví; (2) Hoàn gói tập/khóa học đã trả bằng Ví SÖL hủy dịch vụ nhưng không cộng lại tiền vào ví; (3) `L675` chỉ chặn `fullRefund` trên PT/Shop, cho phép hoàn một phần (`199.999đ / 200.000đ`) mà buổi PT vẫn giữ trạng thái `confirmed`.
  - **Khắc phục:** Chặn `refundPayment` với `WALLET_TOPUP*` (hoặc trừ ví nguyên tử); hoàn tiền vào Ví SÖL cho giao dịch `online_wallet`; chặn luôn hoàn một phần trên PT booking / Shop order.

- **`P1-BE-33` `[BE4-09]` — Nạp ví tại quầy chấp nhận `userId` không phải Hội viên (HLV/Lễ tân/Quản lý/Admin), cộng tiền vào ví ngoài sổ sách không có `Payment` hay `Invoice`**
  - **Vị trí:** `WalletController.java:141-170`, `WalletService.java:82-90, 195-280`, `CounterTopupService.java:100-114`
  - **Nguyên nhân:** `WalletService.creditByReceptionist` chỉ kiểm `userRepository.findByIdAndDeletedAtIsNull(userId)` (mọi vai trò), sau đó `CounterTopupService.record` kiểm `members.findById(memberId).orElse(null)` và im lặng `return;` khi null → nạp tới 100 triệu VND không để lại bất kỳ bản ghi `Payment`, `Invoice` hay dấu vết nào trong lịch sử nạp quầy.
  - **Khắc phục:** Bắt buộc `memberRepository.existsById(memberId)` (và active/chưa xóa) trong cả `creditByReceptionist` và `GET /wallet/members/{memberId}`.

- **`P1-BE-34` `[BE4-10]` — `MemberTrialService`: vượt chặn trùng hộ chiếu bằng chữ hoa/thường, thiếu khóa khi duyệt/từ chối, không kiểm tra lại gói trả phí và ghi đè KYC bằng 4 số thô**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/membership/service/MemberTrialService.java:125-134, 182, 241-247, 344-419, 427-460`
  - **Nguyên nhân:** (1) Hash hộ chiếu không `.toUpperCase(Locale.ROOT)` → `"AB123456"`, `"Ab123456"`, `"ab123456"` tạo nhiều hash khác nhau, lách `uq_trial_cccd_hash` để nhận vô hạn gói thử 3 ngày + PT miễn phí; (2) `approveTrialInternal`/`rejectTrial` không khóa `FOR UPDATE` → 2 lễ tân bấm cùng lúc tạo 2 gói Trial `active` song song; (3) Không kiểm tra hội viên đã mua gói trả phí trong lúc chờ duyệt hay chưa; (4) `L368` ghi 4 số cuối thô vào `member.citizenId` mà không mask qua `KycCrypto` và không cập nhật `citizenIdEncrypted`.
  - **Khắc phục:** Chuẩn hóa `toUpperCase(Locale.ROOT)` trước khi hash/mã hóa; khóa `PESSIMISTIC_WRITE` trên `Member` & `MemberTrialRedemption`; kiểm tra `!subscriptions.existsByMemberUserId(...)` khi duyệt; ghi `citizenId` đã mask + `citizenIdEncrypted` qua `KycCrypto`.

#### F. Lễ Tân, Vận Hành, Báo Cáo & Kiểm Toán (`BE-5`, `BE-3`)

- **`P1-BE-35` `[BE5-02 + BE3-08]` — `AuditAspect` có nguy cơ ghi thẳng JWT Bearer token sống vào `audit_logs` (`PASSWORD_CHANGE`), lộ PII & ảnh base64 trên điểm danh PT (với `oldValue = null`), và bỏ sót `refundedAmount` khi hoàn tiền**
  - **Vị trí:** `AuditAspect.java:61-72, 86-99, 110-199`, `ProfileService.java:83-112`, `CoachBookingService.java:616-680`
  - **Nguyên nhân:** (1) `PASSWORD_CHANGE` trả `AuthTokenResponse` (chứa JWT 24h) nhưng thiếu trong danh sách loại trừ `valueToTree(result)` (`L83-87`); (2) `markAttended`/`unmarkAttended` đặt `bookingId` ở `args[1]` và `"coach_bookings"` không có trong `snapshot()` → `oldValue` luôn là `null`, còn `newValue` dump toàn bộ `CoachBookingDto` (gồm `memberEmail`, `memberPhone`, `membershipCode`, `coachAvatarUrl` base64); (3) `snapshot("payments")` thiếu trường `refundedAmount` nên mọi lần hoàn tiền một phần ghi diff trống không thấy số tiền đã hoàn.
  - **Khắc phục:** Loại trừ `PASSWORD_CHANGE` & mọi thực thể kiểu `AuthTokenResponse` (tốt nhất thay fallback `valueToTree` bằng allowlist sanitizer); thêm case `coach_bookings` (đọc `args[1]`, chỉ lưu trường phi-PII), `members`, và thêm `refundedAmount` vào `snapshot("payments")`.

- **`P1-BE-36` `[BE5-03]` — `AuditAspect` ghi `entityId = NULL` cho mọi lần duyệt/từ chối KYC & ghi sai `entityId` + ảnh chụp buổi học ngẫu nhiên trên `SESSION_CREATE`**
  - **Vị trí:** `AuditAspect.java:63-69, 205-213`, `MemberKycReviewService.java:74-109`, `ClassService.java:687-695`
  - **Nguyên nhân:** `AuditAspect` giả định `args[0]` là ID thực thể. Với `MemberKycReviewService.approve(principal, memberId)`/`reject(...)` (`void`), `args[0]` là `AuthenticatedPrincipal` nên mọi bản ghi `MEMBER_KYC_APPROVE/REJECT` có `entity_id = NULL, old_value = NULL, new_value = NULL`. Với `ClassService.createSession(classId, req)`, `args[0]` là `classId` nên `snapshot("class_sessions", classId)` truy vấn nhầm một `ClassSession` có PK trùng số `classId` và ghi sai `entityId = classId`.
  - **Khắc phục:** Bổ sung `int idArgIndex() default 0` (hoặc `-1` với thao tác tạo mới) trong `@Audited`, tự bỏ qua tham số `AuthenticatedPrincipal`, và không chụp `oldValue` trên các hành động `*_CREATE`.

- **`P1-BE-37` `[BE5-04]` — `RevenueReportService.generateSnapshot()` cho phép giả mạo `generatedById` và lưu JSON tùy ý không giới hạn kích thước làm báo cáo đối soát chính thức**
  - **Vị trí:** `RevenueReportService.java:300-328`, `ReportSnapshotCreateDto.java:25-31`
  - **Nguyên nhân:** Dòng `312` ưu tiên `dto.getGeneratedById()` từ client thay vì `currentUserId` từ JWT; dòng `322` lưu thẳng `dto.getData()` không giới hạn dung lượng và không tính toán phía server.
  - **Khắc phục:** Luôn lấy `generatedBy` từ `currentUserId` đã xác thực; tính dữ liệu snapshot trực tiếp phía server (hoặc tối thiểu giới hạn `@Size` chặt).

- **`P1-BE-38` `[BE5-05]` — Cắt cụt 1 giây cuối ngày (`end.atTime(23, 59, 59)`) làm rớt thanh toán trong `getDailyRevenue()` & `getRevenueByPackage()`**
  - **Vị trí:** `RevenueReportService.java:144-145, 176-177` (so sánh `L130-131`)
  - **Nguyên nhân:** PostgreSQL lưu micro giây → mọi giao dịch thanh toán trong khoảng `23:59:59.000001 – 23:59:59.999999` ngày cuối bị rớt khỏi biểu đồ doanh thu ngày & gói tập nhưng vẫn xuất hiện trong `getRecentTransactions()`, gây lệch số liệu đối soát.
  - **Khắc phục:** Dùng khoảng nửa mở `p.paidAt >= :start AND p.paidAt < :endExclusive` với `end.plusDays(1).atStartOfDay()`.

- **`P1-BE-39` `[BE5-06]` — Bão truy vấn `2N+1`, nạp toàn bộ ảnh biên lai base64 2MB vào heap & lỗ hổng OOM DoS bằng khoảng ngày không giới hạn trong `RevenueReportService`**
  - **Vị trí:** `RevenueReportService.java:100-108, 139-166, 173-218, 332-336`, `PaymentRepository.java:112-113`, `Payment.java:110-111`
  - **Nguyên nhân:** (1) Gửi `?startDate=0001-01-01&endDate=9999-12-31` tạo vòng lặp `while` cấp phát 3,65 triệu `DailyRevenueDto` gây sập JVM OOM; (2) Nạp toàn bộ entity `Payment` kèm cột non-lazy `receipt_image` (TEXT tới 2MB/dòng) thay vì `GROUP BY` bằng SQL; (3) `getRevenueByPackage()` gọi `subscriptionRepository.findById()` + lazy `MembershipPackage` trong vòng lặp (`2N+1`); (4) `getSnapshots()` không phân trang.
  - **Khắc phục:** Giới hạn tối đa khoảng tra cứu (ví dụ 366 ngày); viết truy vấn SQL/JPQL `GROUP BY` tổng hợp trực tiếp trong DB; phân trang `getSnapshots()`.

- **`P1-BE-40` `[BE5-07]` — Sai công thức tính hiệu suất & tỷ lệ chuyên cần lớp học trong `SessionAttendanceReportRepository` & `RevenueReportService.getClassUtilization()`**
  - **Vị trí:** `SessionAttendanceReportRepository.java:32-96`, `RevenueReportService.java:226-294`
  - **Nguyên nhân:** (1) Subquery `enrolledCount` lọc `ClassEnrollment` theo ngày tạo `enrolledAt` nằm trong `[start, end]` → lớp đăng ký từ tháng trước nhưng học tháng này trả `rawEnrolled = 0` (hiển thị sai 0% hoặc `Math.max(0, presentCount)` tạo tỷ lệ chuyên cần giả 100%); (2) `presentCount` dùng `COUNT(DISTINCT member)` nên đi học 1/12 buổi vẫn tính 100% và không lọc `s.status <> 'cancelled'` / `deletedAt is null`; (3) Subquery tương quan quét `O(classes × members)`.
  - **Khắc phục:** Đếm học viên đang ghi danh của các lớp có buổi không bị hủy trong `[start, end]` (loại user xóa mềm) và tính tỷ lệ chuyên cần trên tổng số lượt `(buổi × học viên)`.

- **`P1-BE-41` `[BE5-08]` — Duyệt đơn nghỉ phép (`LEAVE`) của HLV âm thầm cho phép chồng chéo với lớp nhóm & lịch PT 1:1 đã đặt (+ TOCTOU race)**
  - **Vị trí:** `StaffInternalRequestService.java:207-258, 297-318`, `ClassSessionRepository.java:168-176`
  - **Nguyên nhân:** `reviewRequest()` lưu `APPROVED` trước rồi mới chạy `reportLeaveImpact()` gửi 1 thông báo thụ động không có `actionPath`; chỉ khóa dòng request (không khóa HLV) tạo TOCTOU race với đặt lịch PT/tạo lớp song song; `countScheduledForCoachBetween` không lọc `gymClass.status = 'active'`.
  - **Khắc phục:** Khóa mức HLV khi duyệt nghỉ phép và khi tạo lịch/đặt PT; chặn duyệt với `409 COACH_LEAVE_HAS_CONFLICTS` trừ khi quản lý xác nhận rõ ràng (hoặc trả số buổi xung đột trong response + gắn `actionPath` điều hướng tới `/manager/coach-assignments`); thêm `gymClass.status = 'active'`.

- **`P1-BE-42` `[BE5-09]` — Duyệt/từ chối đơn nội bộ của nhân sự đã bị xóa mềm luôn lỗi HTTP 404 và rollback (kẹt vĩnh viễn ở `PENDING`)**
  - **Vị trí:** `StaffInternalRequestService.java:79-80, 224-225, 241-255`, `NotificationService.java:190-193`
  - **Nguyên nhân:** `reviewRequest()` gọi không bọc try/catch `notificationService.send(saved.getUser().getId(), ...)`, mà `NotificationService.send` ném `ResourceNotFoundException` nếu user đã xóa mềm → rollback toàn bộ transaction; ngoài ra `createRequest`/`reviewRequest` dùng `findById` thay vì `findByIdAndDeletedAtIsNull`.
  - **Khắc phục:** Chỉ gửi thông báo khi `saved.getUser().getDeletedAt() == null` và bọc bắt `ResourceNotFoundException`; kiểm tra actor bằng `findByIdAndDeletedAtIsNull`.

- **`P1-BE-43` `[BE5-10]` — `AuditService.parseDateTime()` làm rơi múi giờ offset (lệch 7 tiếng) và bị tràn ngày do PostgreSQL làm tròn `LocalTime.MAX` sang `00:00` ngày hôm sau**
  - **Vị trí:** `AuditService.java:101-114`, `AuditSpecifications.java:55-57`
  - **Nguyên nhân:** `OffsetDateTime.parse("...Z").toLocalDateTime()` vứt bỏ múi giờ `Z` thay vì chuyển sang `CenterTime.ZONE` (+7h); `LocalTime.MAX` (`23:59:59.999999999`) vượt độ phân giải micro giây của PostgreSQL bị làm tròn lên `00:00:00` ngày kế tiếp.
  - **Khắc phục:** Chuyển offset bằng `.atZoneSameInstant(CenterTime.ZONE).toLocalDateTime()` và dùng cận trên mở `< date.plusDays(1).atStartOfDay()`.

- **`P1-BE-44` `[BE5-11]` — Bão truy vấn N+1 (tới 21 truy vấn SQL/lần tìm kiếm) trong `MemberLookupService.search()`**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/reception/MemberLookupService.java:50-58`
  - **Nguyên nhân:** Gọi `trials.findByMemberUserId(m.getUserId())` cho từng kết quả trong tối đa 20 hội viên trả về, làm nghẽn HikariCP pool 5 kết nối trên endpoint tìm kiếm tần suất cao tại quầy.
  - **Khắc phục:** Nạp hàng loạt bằng `findMemberUserIdsWithStatus(memberIds, "APPROVED")` (còn đúng 2 truy vấn).

#### G. SÖL AI, Chat, Hỗ Trợ & Thông Báo (`BE-6`, `BE-7`)

- **`P1-BE-45` `[BE6-01 + BE7-08]` — Cơ sở tri thức SÖL AI (`sol-knowledge.md`), system prompt và RAG vẫn nói sai "mỗi bộ môn chỉ mở 1 lớp đang hoạt động", bỏ sót 4 phòng, lịch 7 ngày live, luật bảo lưu khóa học và đầy đủ quyền lợi hạng**
  - **Vị trí:** `apps/api/src/main/resources/ai/sol-knowledge.md:14, 15, 20, 51-52`, `AiChatService.java:41, 45, 64`, `AiRagContextService.java:185-219`, `AiKnowledgeBase.java:162-182`
  - **Nguyên nhân:** (1) `sol-knowledge.md:14, 20` và `AiChatService.SYSTEM_PROMPT:41` vẫn ghi *"mỗi bộ môn chỉ mở một lớp định kỳ đang hoạt động tại một thời điểm"*; (2) Không liệt kê 4 phòng hoạt động; (3) `AiRagContextService` không đưa `catalog.sessions()` (lịch 7 ngày tới kèm chỗ trống) vào RAG dù prompt yêu cầu trích đúng ngày giờ & chỗ trống; (4) `AiKnowledgeBase.tierBenefits()` thiếu lượt khóa học miễn phí (1/2/4), giảm giá khóa học, quyền phòng VIP Platinum và giới hạn xem giáo án Silver; (5) `sol-knowledge.md:15` thiếu mục `'Tin nhắn'` và `L51-52` thiếu quy định hủy/hoàn khóa học khi bảo lưu.
  - **Khắc phục:** Cập nhật đồng bộ `sol-knowledge.md`, `AiChatService`, `AiRagContextService` (bổ sung `catalog.sessions()` + 4 phòng) và `AiKnowledgeBase.tierBenefits()` từ `PackageBenefits`.

- **`P1-BE-46` `[BE6-02]` — Trợ lý AI tạo giáo án (`AiRecommendationService`) vẫn truy vấn bảng chỉ số cơ thể đã tắt `member_progress_logs` 2 lần mỗi request**
  - **Vị trí:** `AiRecommendationService.java:21-22, 52, 54, 75, 106, 221-227, 235-238, 423-438, 612, 619-641`, `AiRecommendationController.java:51`
  - **Nguyên nhân:** Bỏ qua cờ `app.health.metrics.enabled=false`, chạy `progressLogRepository.findByMemberUserIdOrderByRecordedAtDesc(memberId)` **2 lần** (`readLatestMetrics` + `appendWeightTrend`) và nhồi chiều cao/cân nặng/BMI/xu hướng cân cũ + prompt thiết bị đã tắt vào bối cảnh AI.
  - **Khắc phục:** Cô lập sau `@Value("${app.health.metrics.enabled:false}")` (hoặc gỡ bỏ), chỉ dùng `fitnessGoal`, `fitnessLevel`, `healthNotes` và giáo án hiện tại.

- **`P1-BE-47` `[BE6-03]` — Phân quyền fail-open & lỗ hổng áp dụng trùng nhiều lần trong `AiRecommendationService`**
  - **Vị trí:** `AiRecommendationService.java:202-219, 319-325, 374-375`
  - **Nguyên nhân:** (1) Trong `generateWorkoutPlan`, nếu tài khoản `COACH` không có dòng trong bảng `coaches` (`callerCoach == null`), nhánh `if (callerCoach != null)` bị bỏ qua (fail-open), vượt qua `requireCoachOf` cho bất kỳ hội viên nào và giả mạo được `request.coachId`; (2) Trong `applyRecommendation`, nếu Manager tạo gợi ý không chỉ định `coachId` (`logCoachId == null`), bất kỳ HLV nào cũng chiếm quyền áp dụng được; ngoài ra không kiểm tra `log.isApplied()` nên gọi lặp tạo nhiều giáo án trùng.
  - **Khắc phục:** Fail-closed (`403`) khi `!isManagerCaller && callerCoach == null`; trong `applyRecommendation` yêu cầu `logCoachId != null && currentUserId.equals(logCoachId)` đối với `COACH` và trả `409` nếu `log.isApplied() == true`.

- **`P1-BE-48` `[BE6-04]` — Hội viên bị khóa vĩnh viễn không thể trả lời phiếu hỗ trợ của chính mình nếu nhân viên phụ trách đã bị xóa mềm**
  - **Vị trí:** `SupportRequestService.java:375-383, 566-569`, `NotificationService.java:190-194`
  - **Nguyên nhân:** `sendMessage()` gọi `notificationService.send(request.getAssignedTo().getId(), ...)` không kiểm tra `deletedAt == null` và không try/catch → ném `ResourceNotFoundException` (HTTP 404) và rollback luôn tin nhắn của hội viên.
  - **Khắc phục:** Kiểm tra `assignedTo` còn active & chưa xóa mềm; nếu không, gửi về `notifyStaff(...)` theo trạng thái escalate và bọc `try/catch (RuntimeException)`.

- **`P1-BE-49` `[BE6-05]` — Một tài khoản xóa mềm duy nhất làm sập & rollback toàn bộ lô gửi nhắc nhở của `NotificationScheduler` (và chặn hủy/dời lớp, chuyển HLV)**
  - **Vị trí:** `NotificationScheduler.java:99-169, 176-276`, `NotificationService.java:190-194`, `ClassService.java:508, 532, 1303, 1307`, `ClassSessionService.java:120, 140, 155`, `CoachAssignmentService.java:252, 289`
  - **Nguyên nhân:** Toàn bộ vòng lặp thông báo chạy trong 1 `@Transactional`; gặp 1 user có `deletedAt != null`, `NotificationService.send` ném `ResourceNotFoundException` hủy toàn bộ batch nhắc hạn gói/nhắc lịch 30 phút hoặc chặn thao tác hủy lớp/chuyển HLV.
  - **Khắc phục:** Lọc `u.deletedAt is null` trong truy vấn scheduler và bọc `try/catch (ResourceNotFoundException)` theo từng người nhận.

- **`P1-BE-50` `[BE6-06]` — Hội viên phản hồi vào phiếu hỗ trợ `resolved` không tự mở lại phiếu; job `closeStaleResolved()` vẫn tự đóng sau 72 giờ**
  - **Vị trí:** `apps/api/src/main/java/com/swp391/scms/support/SupportRequestService.java:161-173, 323-348`
  - **Nguyên nhân:** `sendMessage` cho phép hội viên nhắn thêm khi ticket đang `resolved`, nhưng chỉ nhánh `if (staff)` mới đổi trạng thái, còn `closeStaleResolved()` đóng mọi ticket quá 72h tính từ `resolvedAt` ban đầu mà không kiểm tra tin nhắn mới của hội viên.
  - **Khắc phục:** Tự động chuyển `resolved → in_progress` và xóa `resolvedAt = null` khi hội viên gửi tin nhắn mới.

- **`P1-BE-51` `[BE6-07]` — Liên kết CTA chết (`/member`), liên kết email sai vai trò cho HLV & còn sót `actionPath` Shop/Đánh giá đã tắt**
  - **Vị trí:** `SolEmailTemplateRenderer.java:74-92`, `NotificationService.java:174-183, 207-214`, `VnpayPaymentService.java:473, 506`, `WalletService.java:438`, `shop/service/ProductOrder*.java`
  - **Nguyên nhân:** `SolEmailTemplateRenderer` mặc định trả `"/member"` (không tồn tại trong `router.tsx` → đá về Landing `/`); `schedule_change` luôn gắn `"/member/classes"` kể cả khi gửi email cho **COACH** (bị `RoleGuard` chặn); `NotificationService` truyền raw `type="order"` khiến `resolveCta` trượt `case "payment"`; nhiều caller vẫn phát `actionPath` cũ `/member/orders*`, `/staff/orders`, `/member/progress#coach-evaluations`.
  - **Khắc phục:** Đổi default CTA thành `"/portal"`, truyền `actionPath`/vai trò vào `NotificationPayload` để email HLV trỏ `/coach/classes`, chuẩn hóa `"order"`/`"wallet"` → `"payment"`, thay `/member/orders*` bằng `/member/invoices` và gỡ `#coach-evaluations`.

#### H. PostgreSQL Triggers, Cô Lập Shop, i18n & Hợp Đồng OpenAPI (`BE-7`, `BE-3`)

- **`P1-BE-52` `[BE7-02]` — Trigger `trg_pt_schedule_booking` kiểm tra lại gói tập `active` và giữ khóa toàn cục trên MỌI cột update của `coach_bookings`, làm gãy điểm danh PT quá khứ & xác nhận thanh toán**
  - **Vị trí:** `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:631-664, 728-730`, `CoachBookingService.java:642-646, 678-682, 862-863`
  - **Nguyên nhân:** Trigger khai báo `BEFORE INSERT OR UPDATE ON coach_bookings` (không giới hạn cột `OF`) và không bỏ qua khi lịch không đổi. Khi lễ tân/quản lý sửa điểm danh PT quá khứ (`attended_at`, `attendance_locked`) hoặc xác nhận thu tiền (`payment_status`), trigger vẫn chạy kiểm tra gói `active` phủ cả `today` lẫn `booking_date` → lỗi `403 MEMBERSHIP_INACTIVE_OR_EXPIRED` nếu gói đã hết hạn/gia hạn mới, hoặc lỗi `409 SCHEDULE_UPDATE_IN_PROGRESS`.
  - **Khắc phục:** Giới hạn `BEFORE INSERT OR UPDATE OF member_id, coach_id, booking_date, start_time, end_time, status` và thoát sớm trong `scms_guard_pt_schedule` khi các trường lịch & `status='confirmed'` không thay đổi.

- **`P1-BE-53` `[BE7-03]` — Trigger `trg_session_bookings_check_membership` bỏ sót cột `session_id` trong mệnh đề `UPDATE OF`**
  - **Vị trí:** `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:250-254, 271-274`
  - **Nguyên nhân:** Thân hàm kiểm tra `OLD.session_id = NEW.session_id` nhưng dòng `273` chỉ khai báo `UPDATE OF member_id, status` → cập nhật `session_id` sang buổi vượt hạn gói sẽ vượt qua trigger.
  - **Khắc phục:** Đổi thành `BEFORE INSERT OR UPDATE OF session_id, member_id, status ON session_bookings`.

- **`P1-BE-54` `[BE7-04]` — Lệch múi giờ 7 tiếng (`TIMESTAMP WITHOUT TIME ZONE` vs `CURRENT_TIMESTAMP` UTC) trong trigger dọn VNPay lúc khởi động & `users.updated_at`**
  - **Vị trí:** `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:9, 483`, `VnpayTransaction.java:24`
  - **Nguyên nhân:** `expires_at` lưu giờ VN (`UTC+7`, không timezone), còn dòng `483` so `expires_at < CURRENT_TIMESTAMP` (UTC trên Supabase) khiến giao dịch VNPay hết hạn trông như còn 7 tiếng nữa mới hết hạn (chậm dọn tới 7 tiếng); dòng `9` ghi `users.updated_at` theo UTC lệch 7 tiếng so với Java.
  - **Khắc phục:** Dùng `(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')` ở cả dòng `9` và `483`.

- **`P1-BE-55` `[BE7-06]` — Rò rỉ thanh toán VNPay & Ví SÖL cho đơn hàng Shop khi `app.shop.enabled=false` do bean `ProductOrderPayments` không bị khóa cờ**
  - **Vị trí:** `shop/service/ProductOrderPayments.java:24`, `VnpayPaymentService.java:45, 226, 257-270, 583`
  - **Nguyên nhân:** `ProductOrderPayments` thiếu `@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")` nên vẫn được inject vào `VnpayPaymentService`. Hội viên vẫn gọi được `POST /payments/vnpay/checkout` hoặc `POST /wallet/pay` kèm `{"productOrderId": ...}` để trừ ví/tạo link VNPay và bắn thông báo link chết `/member/orders/{id}` dù Shop đã tắt.
  - **Khắc phục:** Gắn `@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")` lên `ProductOrderPayments` (hoặc kiểm cờ `app.shop.enabled` trong `VnpayPaymentService`).

- **`P1-BE-56` `[BE7-07 + BE3-09]` — 3 luồng truyền sai/thiếu tham số i18n khiến chuỗi `{0}`/`{1}`/`{2}`/`{3}` thô hiển thị và lưu thẳng xuống CSDL**
  - **Vị trí:** `CoachBookingService.java:411-415`, `MembershipSubscriptionService.java:1178`, `EnrollmentService.java:412, 475`, `ProductOrderPayments.java:123` (đối chiếu `messages_{vi,en}.properties`)
  - **Nguyên nhân:** (1) Trùng PT ↔ lớp nhóm tại `CoachBookingService:413` truyền `null` cho key `error.coach_booking.member_busy` (in thẳng `"lịch hẹn 1:1 khác ({0} - {1})"` thay vì dùng key `error.coach_booking.member_class_conflict`); (2) `MembershipSubscriptionService:1178` & `EnrollmentService:412, 475` gọi `scheduling.enrollment.cancelled_by_hold` với 0 tham số (lưu `cancel_reason = "...: {0}"`); (3) `ProductOrderPayments:123` truyền 1 tham số cho key đòi 4 tham số.
  - **Khắc phục:** Dùng đúng key `error.coach_booking.member_class_conflict` kèm 3 tham số (tên lớp, giờ bắt đầu, giờ kết thúc); truyền `holdReason` (hoặc bỏ `: {0}`) cho lý do hủy bảo lưu; truyền đủ 4 tham số cho thông báo đơn hàng.

- **`P1-BE-57` `[BE7-09]` — Lỗi cú pháp YAML nghiêm trọng trong `openapi-coaching-review-fixes.yaml` & 7 endpoint/method không tồn tại hoặc sai cú pháp trong hợp đồng OpenAPI**
  - **Vị trí:** `docs/api-contracts/openapi-coaching-review-fixes.yaml:40`, `openapi-sprint2.yaml:1494-1535`, `openapi-membership-benefits.yaml:76, 166`
  - **Nguyên nhân:** (1) `openapi-coaching-review-fixes.yaml:40` viết `CoachBookingDto[]` không đặt trong ngoặc kép bên trong flow mapping `{...}` → gây `YAML ParserError`; (2) `openapi-sprint2.yaml:1494-1535` khai báo 5 operation `GET`/`PATCH` không tồn tại trên `/profile/coach`, `/profile/receptionist`, `/users/{id}/receptionist` (thực tế chỉ có `PUT`); (3) `openapi-membership-benefits.yaml` khai báo route không tồn tại `GET /api/v1/coaching/bookings` (`L76`) và khóa path bất hợp lệ chứa `#` `/subscriptions/{id}/hold#approval` (`L166`).
  - **Khắc phục:** Sửa cú pháp YAML dòng `40`, sửa `openapi-sprint2.yaml` về đúng `PUT`, cập nhật `openapi-membership-benefits.yaml` sang `/coach-bookings/{my,attendance}` và gộp nội dung `#approval` vào `/hold/approve`.

---

### 5.3. Hạ Tầng Kiểm Thử, Bảo Mật HTTP & Bộ QA Scripts `P1-High` (3 lỗi độc lập)

- **`P1-E2E-01` `[E2E-3 #2, #3, #4 + E2E-1 P1-1]` — 3/7 bộ PostgreSQL Integration Test đã hỏng sẵn (không pass trên Postgres thật) & lỗi che khuất bài test trigger PT↔Group**
  - **Vị trí:** `PostgreSqlDatabaseIntegrationTest.java:65-66, 191-210, 249-256, 291-295, 478-496`, `OperationsConcurrencyPostgreSqlTest.java:351-356`, `PtAttendanceIsolatedPostgreSqlTest.java:130, 154-163`
  - **Nguyên nhân:** Do bị skip lâu ngày trên CI: (1) `PostgreSqlDatabaseIntegrationTest` kiểm đếm sai 5 vs 21 trigger, dùng config `app.bootstrap.manager.*` lỗi thời, và `L249-256` chèn 2 lớp cùng bộ môn ngày hôm nay nên nổ `trg_sessions_check_discipline_conflict` che khuất kiểm thử trigger PT; (2) `OperationsConcurrencyPostgreSqlTest:351` dùng giờ `10:00–11:00` vi phạm 5 slot; (3) `PtAttendanceIsolatedPostgreSqlTest` mâu thuẫn mặc định `PostgreSqlTriggerProvider(true)` và dùng giờ `09:00–10:00` làm hỏng 5/7 test.
  - **Khắc phục:** Cập nhật toàn bộ fixture sang 5 slot chuẩn (`07:00–09:30` .. `17:00–19:30`), tách bộ môn khác nhau cho test xung đột PT↔Group, cập nhật số lượng 21 trigger & tài khoản `app.bootstrap.admin.*`, và đồng bộ kỳ vọng `PostgreSqlTriggerProvider`.

- **`P1-E2E-02` `[E2E-3 #5]` — 4 Controller tài chính/bảo mật độ rủi ro cao hoàn toàn KHÔNG có bài test HTTP / `SecurityFilterChain`**
  - **Vị trí:** `WalletController.java`, `MemberKycController.java`, `MembershipCancellationController.java`, và phần lõi đặt/hủy/xác nhận thanh toán của `CoachBookingController.java`
  - **Nguyên nhân:** Không có bất kỳ bài MockMvc/Security test nào xác minh ranh giới quyền (`MEMBER` vs `RECEPTIONIST` vs `CENTER_MANAGER` vs `ADMIN`), validation DTO và mã HTTP cho nạp ví/trừ ví, duyệt KYC (lưu ý Javadoc `MemberKycController:15-17` còn ghi nhầm "lễ tân và quản lý" dù `SecurityConfig:122` chỉ cho `RECEPTIONIST`), duyệt hủy hoàn tiền gói tập, và đặt/hủy/thu tiền PT 1:1.
  - **Khắc phục:** Bổ sung bộ `@WebMvcTest` / MockMvc Security test cho cả 4 controller (ưu tiên ngay sau Wave 0).

- **`P1-E2E-03` `[E2E-1 P1-2 + E2E-3 #6, #11]` — 19/24 script `scripts/qa/*` lạc hậu/hỏng theo phạm vi cũ, 0 script E2E cho luồng lõi 25/11/2026 & 0 bài test Postgres cho 5 nhóm trigger mới**
  - **Vị trí:** `scripts/qa/*` (24 file; 7 file hoàn toàn lỗi thời như `verify-court-booking.cjs`, `verify-shop-ui.cjs`, `verify-explore3d.mjs`, `verify-evaluation-notifications.cjs`, `verify-member-schedule.cjs`, `verify-sport-story.cjs`/`verify-sport-stack.cjs` đòi 4 môn thay vì 3; 4 file quét đa trang trỏ vào `/swimming`, `/tennis`, `/member/courts`, `/health-metrics`), `apps/web/e2e/specs/{09-shop,20-explore3d-walkthrough}.spec.ts`
  - **Nguyên nhân:** Chưa có bài E2E tự động nào trong repo kiểm thử Wizard tạo khóa học 4 bước (`POST /classes/recurring/availability`), đa lớp/bộ môn (`409 SCHEDULING_DISCIPLINE_CONFLICT`), lưới 5 Slot thống nhất, đặt PT 1:1 không `coach_rest` hay tách tab điểm danh HLV; đồng thời không có test Postgres nào cho `trg_sessions_check_discipline_conflict`, `scms_guard_member_class_overlap`, `trg_pt_schedule_class`, `trg_session_bookings_*` và Realtime RLS.
  - **Khắc phục:** Lưu trữ/gỡ các script QA cho tính năng đã xóa, chuẩn hóa bộ Playwright E2E bao phủ đủ 5 luồng lõi 25/11/2026 (bao gồm kiểm chứng bước 3→4 của Wizard trên Chromium thực), và bổ sung test Postgres cho 5 nhóm trigger còn thiếu.

---

## 6. Danh Sách Lỗi `P2-Medium` (Trung Bình — Đầy Đủ 100% Phát Hiện Theo Phân Hệ)

### 6.1. Frontend `P2-Medium` (80 lỗi độc lập)

#### A. App Router, Auth, Landing & PWA (`FE-1`, `E2E-2`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-01` | `FE1-06 + E2E-1 P2-2` | `features/landing/fitness-public.css:85, 129, 375, 544, 654` | Rò rỉ màu salmon/đào cứng trong Dark mode: `.fit-benefit-end:hover` đổi thẻ bạc sang `#d89e8e`; `.fit-pill:hover` `#ebdad3`; `.fit-muscle-goal` `#f3c8b9`; `.fit-chat-tags > span` `#f4d3c7`; `.fit-auth .portal-alert` `#efb49c80`/`#ffd2c0`. | Thay bằng `var(--sol-accent-hover)`, `var(--sol-accent-text)` và `rgb(var(--sol-accent-rgb) / ...)` trong `dark-volt.css`. |
| `P2-FE-02` | `FE1-07` | `features/auth/LuxuryLoginForm.tsx:633, 696, 789, 898`, `fitness-public.css:541, 543` | Liên kết chữ auth ở Light mode dùng `--fit-salmon` (`#ce9180` trên `#fff` → tương phản `2,63:1`, trượt WCAG AA 4,5:1). | Dùng `var(--sol-accent-text)` (`#a35b49`) cho `.fit-auth-link` và `.fit-auth-bottom a`. |
| `P2-FE-03` | `FE1-08` | `features/auth/LuxuryLoginForm.tsx:341, 397, 406-412, 703-717, 744-816` | Màn đặt lại mật khẩu (`forgot_reset`) tái dùng state `showPassword` mà không có nút ẩn/hiện (dễ lộ mật khẩu dạng chữ), bấm Quay lại không xóa `resetNewPassword`/`otpCode`/`debugOtpCode`, thiếu `noValidate`/`autoComplete`, và dùng regex email rời thay vì `isValidEmailAddress()`. | Reset `showPassword` và dữ liệu nhạy cảm khi đổi chế độ; thêm nút ẩn/hiện, `noValidate`, `autoComplete` và dùng `isValidEmailAddress()`. |
| `P2-FE-04` | `FE1-09` | `features/auth/LuxuryLoginForm.tsx:468-483, 822-841` | Gán cứng inline style nền sáng `#E8F5E9`/`#1B5E20`/`#2d6a4f` làm hỏng thẩm mỹ & tương phản Dark mode (trong khi class `.fit-otp-notice` tại `fitness-public.css:559` bị bỏ không dùng). | Chuyển sang class CSS theo token `--portal-success` / `.fit-otp-notice`. |
| `P2-FE-05` | `FE1-10` | `FitnessLanding.tsx:18, 211-212, 624, 774`, `SportPage.tsx:43`, `PublicLayout.tsx:70`, `RegisterPage.tsx:179` | Nhiều chuỗi chưa dịch: tiêu đề FAQ `'Frequently Asked' / 'Questions'`, `'PERSONAL TRAINING'`, `'Strength floor'`, `'Free weights'`, `'Boxing Club'`/`'Yoga Studio'` và `document.title` giữ tiếng Anh ở chế độ VI; `placeholder="ban@example.com"` giữ tiếng Việt ở EN. | Bổ sung vào `vietnamesePublicLabels` hoặc bọc toàn bộ bằng `sourceText({ vi, en })`. |
| `P2-FE-06` | `FE1-11` | `RegisterPage.tsx:197`, `LuxuryLoginForm.tsx:845`, `FitnessLanding.tsx:275` | Trộn VI+EN trong cùng 1 chuỗi (`"Mã OTP thử nghiệm (debug): "`, `"Chế độ Test (Không cần mở mail):"`, `"bảo lưu (Freeze)"`), vi phạm quy tắc song ngữ `AGENTS.md`. | Tách thuần tiếng Việt cho bản VI và thuần tiếng Anh cho bản EN. |
| `P2-FE-07` | `FE1-12` | `features/landing/components/FitnessLanding.tsx:691-699, 705` | Widget minh họa "Your First Week" trên Landing vẫn hiển thị 8 mốc giờ cũ (`06:30`, `08:00`, `12:00`, `16:00`, `17:30`, `18:30`, `19:30`) thay vì 5 Slot cố định (`07:00 – 19:30`). | Sinh các chip giờ minh họa từ `SCHEDULE_SLOTS` (`features/schedule/slots.ts`) và đổi mốc `17:30` → `17:00`. |
| `P2-FE-08` | `FE1-13` | `features/landing/components/FitnessLanding.tsx:418, 745, 749, 752-765` | 3 nút chọn mục tiêu `goalType` trong máy tính BMI là nút chết (không làm thay đổi gợi ý hay link nào); dùng sai thuộc tính `min`/`max` trên `<input type="text">` và không báo phạm vi hợp lệ (`100–240 cm`, `30–250 kg`). | Cá nhân hóa kết quả gợi ý theo `goalType` + `bmiValue` (hoặc gỡ control thừa) và bỏ `min`/`max` sai chuẩn trên `type="text"`. |
| `P2-FE-09` | `FE1-14` | `features/pwa/registerPwa.ts:53-59, 83-100` | Khi Tab 1 bấm "Cập nhật" PWA, Tab 2 không xóa `waitingRegistration` trên `controllerchange`, để lại banner cập nhật kẹt vĩnh viễn với nút bấm chết. | Xóa `waitingRegistration = null` và thông báo listeners khi nhận `controllerchange` hoặc trạng thái `activated`/`redundant`. |
| `P2-FE-10` | `FE1-15` | `features/pwa/serviceWorker.ts:33-35` | `cache.match('/index.html')` có thể trả về `undefined` nếu Cache Storage bị trình duyệt dọn, gây `TypeError` trong `event.respondWith` khi offline. | Bổ sung fallback `cached || new Response('Offline', { status: 503, ... })`. |
| `P2-FE-11` | `FE1-16` | `features/landing/hooks/useComponentReveal.ts:123-146`, `SportPage.tsx:86` | Container `[data-reveal]` cao (như bảng lịch 7 ngày) có thể không bao giờ đạt `intersectionRatio >= 0.12` trên mobile, bị kẹt mãi ở `opacity: 0`; đồng thời `prefers-reduced-motion` tắt luôn `sectionObserver` làm mất highlight mục đang cuộn trên nav. | Coi là visible khi `intersectionRect.height >= Math.min(innerHeight * 0.12, 80)` và giữ `sectionObserver` luôn hoạt động. |
| `P2-FE-12` | `FE1-17` | `FitnessLanding.tsx:632-645, 672-684`, `PublicLayout.tsx:25, 46, 96-150`, `fitness-public.css:92` | Khuyết thiếu a11y/bàn phím: `journeySteps` dùng `<li>` không focus được; `.fit-rhythm-tabs` thiếu `role="tabpanel"`/`aria-controls`; menu mobile thiếu đóng khi bấm `Escape`/click ngoài/đổi route và kích thước `40×40px` (<44px); `scrollIntoView({ behavior: 'smooth' })` bỏ qua `prefers-reduced-motion`. | Dùng `<button>` trong journey steps, nối đủ ARIA cho rhythm tabs, đóng menu mobile đúng sự kiện, nâng nút lên `44×44px` và kiểm tra `prefers-reduced-motion` trước khi cuộn mượt. |
| `P2-FE-13` | `E2E-2 #3` | `apps/web/src/app/router.tsx:42-99, 354` | Route hội viên đã gỡ `/member/orders` và `/member/streak` không có `<Navigate>` trong nhóm Member nên đẩy hội viên đã đăng nhập ra trang công khai `/` thay vì `/member/dashboard` (khác với `/member/explore`). | Thêm `<Navigate to="/member/dashboard" replace />` cho `/member/orders*` và `/member/streak` trong nhánh `MEMBER`. |

#### B. Shared API, i18n, Libs & Liquid Glass (`FE-2A`, `E2E-1`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-14` | `FE2A-04` | `shared/api/client.ts:167-173` | Spread `...init.headers` phá vỡ `Headers` / mảng tuple và luôn gửi `Content-Type: application/json` kể cả trên GET/DELETE không body hoặc `Blob`/`URLSearchParams`. | Dùng `new Headers(init.headers)`, chỉ gắn `Content-Type: application/json` khi body là JSON, và xóa `Authorization` rỗng. |
| `P2-FE-15` | `FE2A-05` | `shared/api/client.ts:199-243` | `apiFetchPdf` & `apiFetchBlob` không có timeout/`AbortSignal` và gọi `res.blob()` ngoài `try/catch` (rớt mạng giữa chừng ném `TypeError` thô). | Thêm tham số `signal`, gắn timeout bằng `AbortController` và `return await res.blob()` trong `try/catch`. |
| `P2-FE-16` | `FE2A-06` | `shared/api/client.ts:29-60, 68-79, 270-294`, `useCurrentUser.ts:5-8` | Còn `AUTH_STORAGE_KEY` mà mất `TOKEN_STORAGE_KEY` đẩy portal vào vòng lặp 401 không hồi phục; `parseAuthSession` không kiểm tra hình dạng JSON; nhiều lệnh `localStorage` không bọc `try/catch`. | Xóa session mồ côi khi `!token` trong `syncSessionWithServer()`, xác thực schema trong `parseAuthSession()`, bọc `try/catch` quanh mọi truy cập `localStorage`. |
| `P2-FE-17` | `FE2A-07` | `shared/i18n/language.ts:20-54` | Khi `localStorage` bị chặn (`SecurityError`), `setLanguage('en')` đổi `<html lang="en">` nhưng `getLanguage()` vẫn luôn trả `'vi'`. | Lưu thêm biến `fallbackLanguage` trong bộ nhớ khi `localStorage` ném lỗi. |
| `P2-FE-18` | `FE2A-08` | `shared/i18n/sourceText.ts:70-74` | `noticePair()` chỉ tra `englishPublicLabels` không chuẩn hóa khoảng trắng, bỏ sót `translations.ts` và `vietnamesePublicLabels` → mất bản dịch EN trong `sourceToast`. | Chuẩn hóa `trim().replace(/\s+/g, ' ')` và tra cả 3 bảng từ điển. |
| `P2-FE-19` | `FE2A-09` | `shared/i18n/publicLabels.ts:344, 364, 536-537, 653, 679, 687-688, 701, 733, 741-742, 755`, `translations.ts:292, 294` | Lỗi tiếng Anh thực tế trên Landing: `"What you get benefits with a membership."`, `"WeightLifting"`, `"BUILD YOUR BODY SHAPES"`, rò rỉ thứ tiếng Việt `"T2 · Strength"`/`"CN · Mobility"`, lỗi ngữ pháp `"a identity card"`, và các khóa trộn VI+EN. | Sửa tiêu đề thành câu hoàn chỉnh, sửa `"Weightlifting"`, `"Mon"`/`"Sun"`, `"an identity card"` và làm sạch khóa trộn ngôn ngữ. |
| `P2-FE-20` | `FE2A-10` | `shared/lib/membershipPresentation.ts:134-143` | `getPackageDetails()` gán cứng nhãn `"365 ngày (Tiết kiệm 25%)"` / `"180 ngày"` theo ngưỡng `>= 360` / `>= 170`, bịa số ngày & mức tiết kiệm cho gói thời hạn tùy chỉnh. | Khớp đúng ngày (`=== 365`/`180`/`90`/`30`), nội suy `${pkg.durationDays}` và bỏ tuyên bố `"Tiết kiệm 25%"` cứng. |
| `P2-FE-21` | `FE2A-11` | `shared/lib/centerTime.ts:8, 14-21` | `parseCenterTime` lỗi với offset 2 chữ số từ PostgreSQL (`+07`), lỗi trên Safari với dấu cách (`"2026-11-25 14:30:00"`), và tự cuốn ngày không tồn tại (`2026-02-31` → `03-03`). | Mở rộng regex offset `/(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/`, đổi dấu cách thành `T`, và mở rộng `+07` → `+07:00`. |
| `P2-FE-22` | `FE2A-12 + E2E-1 P2-4` | `shared/lib/disciplines.ts:18-43`, `CatalogSections.tsx:79` | Lọc cứng theo tên bộ môn (`isStandardDiscipline` chỉ cho `gym/boxing/yoga`, giữ alias cũ `kickfit`), trái quy định `AGENTS.md`/`DESIGN.md` và ẩn mất mọi bộ môn mới do Quản lý tạo trên Landing. | Gỡ lọc cứng theo tên ở FE (tin tưởng danh sách active từ backend), đối chiếu theo ID bộ môn và xóa alias `kickfit`. |
| `P2-FE-23` | `FE2A-13` | `shared/lib/purchaseIntent.ts:40-56`, `client.ts:74-79` | `scms_purchase_return` trong `sessionStorage` không bị xóa khi đăng xuất hoặc khi Staff đăng nhập, khiến Hội viên đăng nhập sau đó bị chuyển hướng nhầm tới gói tập cũ. | Gọi `clearPurchaseIntent()` trong `clearAuthSession()` và ngay sau khi tiêu thụ/bỏ qua ở `authDestination()`. |
| `P2-FE-24` | `FE2A-14` | `shared/lib/imageUpload.ts:60-74` | Tệp 0-byte hoặc ảnh hỏng `<= 300KB` vượt qua `decode()` trả về data URL rỗng; ảnh `0×0` trả `"data:,"` không báo lỗi. | Chặn ngay khi `file.size <= 0` hoặc `width <= 0 || height <= 0` và xác thực payload ảnh. |
| `P2-FE-25` | `FE2A-15` | `shared/lib/upgradeQuote.ts:22, 28-39` | Thiếu `Number.isFinite` (`typeof NaN === 'number'`), trả `totalDays` âm khi `endDate < startDate` (lệch backend trả `0`) và ra `NaN` với chuỗi ISO có giờ. | Kiểm tra `Number.isFinite`, định dạng `YYYY-MM-DD`, và kẹp `totalDays = Math.max(0, ...)`. |
| `P2-FE-26` | `FE2A-16` | `shared/liquid-glass/LiquidGlassContainer.tsx:8-47`, `liquid-glass.css:2-15` | Bỏ qua hoàn toàn props `tintOpacity`, `blurRadius`, `active` (tạo 2 lớp `backdrop-filter` lồng nhau thừa GPU trên `ChatWidget`). | Gỡ `<LiquidGlassContainer>` thừa khỏi `ChatWidget` hoặc nối biến CSS động và tắt `backdrop-filter` khi `:not(.is-active)`. |

#### C. Shared UI Kit & Portal Shell (`FE-2B`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-27` | `FE2B-07` | `shared/ui/ActionMenu.tsx:14-44`, `action-menu.css:4-13` | Phím `Escape` đóng cả `ActionMenu` lẫn `Modal` cha; bỏ qua vị trí ngang `placement.h` (cứng `right: 0`); gắn 2 listener `document` vĩnh viễn cho mỗi dòng bảng kể cả khi đóng; thiếu `44px` trên tablet coarse pointer. | Gọi `preventDefault()`/`stopPropagation()` khi Escape, hỗ trợ `--left`, chỉ gắn listener khi mở, thêm `@media (pointer: coarse)` 44px. |
| `P2-FE-28` | `FE2B-08` | `shared/ui/DatePicker.tsx:61-65, 153-180, 256-280, 349-457` | Không trả focus về trigger sau khi chọn/xóa; thiếu phím mũi tên; nút `"Hôm nay"` và mũi tên đổi tháng không `disabled` ngoài `[min, max]` (bấm không có phản ứng); `value` rỗng mở ở tháng bị khóa toàn bộ. | Trả focus về trigger, vô hiệu hóa Today & nút đổi tháng ngoài `[min, max]`, kẹp tháng khởi tạo trong `[min, max]` và thêm điều hướng bàn phím. |
| `P2-FE-29` | `FE2B-09` | `shared/ui/TimePicker.tsx:50-58, 85-101, 160-217`, `timepicker.css:79-92` | Không trả focus về trigger; 84 nút thiếu `aria-pressed`; `setTimeout` không cleanup; `value === ""` tô sáng giả `08:00`; dùng `position: absolute` nên bị cắt trong `<dialog>`. | Trả focus, thêm `aria-pressed`, cleanup timer, tách trạng thái rỗng với `08:00`, đổi sang `position: fixed` chống cắt. |
| `P2-FE-30` | `FE2B-10` | `shared/ui/Select.tsx:165-169, 196-208, 241, 258-302` | Luôn gắn `aria-controls={listId}` khi list chưa mount; crash `TypeError` nếu mảng `options` rút ngắn lúc đang mở; click option bị khóa làm blur trigger khiến `Escape` thoát lên `Modal`; `<select>` ẩn thiếu `onInvalid`. | Gắn `aria-controls={mounted ? listId : undefined}`, kiểm tra biên `options[active]`, chặn mousedown trên `<li>` và nối `onInvalid` focus trigger. |
| `P2-FE-31` | `FE2B-11` | `shared/ui/Modal.tsx:22-32, 42-54`, `PortalShell.tsx:740` | Focus trap bỏ sót `<summary>`/`[contenteditable]` và không chặn `Shift+Tab` khi focus ở chính `<dialog>`; deps `[returnFocusRef]` làm đóng-mở lại dialog khi prop đổi; đóng mobile menu từ topbar trả focus nhầm về bottom nav. | Mở rộng selector focusable, xử lý `activeElement === dialog`, giữ `returnFocusRef` trong ref và tự lưu `document.activeElement` trước khi mở. |
| `P2-FE-32` | `FE2B-12` | `shared/ui/toast.ts:72-89`, `styles.css:509-527` | Toast lỗi (`type === 'error'`) vẫn tự tắt sau 5,5s (vi phạm `DESIGN.md:52`), không dừng đếm khi `focusin`, nút đóng `32×32px` (<44px trên mobile). | Bỏ auto-dismiss với `error`, dừng timer khi `focusin`/`focusout`, tăng nút đóng lên `44×44px` trên mobile/coarse. |
| `P2-FE-33` | `FE2B-13` | `features/portal/PortalShell.tsx:450-582`, `portal-shell.css:2444-2453` | `<div role="menu">` chứa `<LanguageSetting>` sai chuẩn ARIA; dòng `527` định dạng số dư ví bằng `toLocaleString() + ' đ'` thay vì `formatPrice` (`DESIGN.md:60`); hardcode bóng tối đậm inline trong Light mode; các nút ví/đăng xuất/ngôn ngữ <44px trên mobile. | Chuyển sang disclosure popover hoặc tách `LanguageSetting` khỏi `role="menu"`, dùng `formatPrice(walletBalance)`, dùng token shadow và đặt `min-height: 44px` trên mobile. |
| `P2-FE-34` | `FE2B-14` | `features/portal/PortalShell.tsx:146-149, 361-368, 607` | Click ra ngoài popover thông báo vẫn kéo focus về nút chuông topbar; điều hướng Back/Forward không đóng các dialog `'wallet'`/`'search'`/`'menu'`. | Truyền `restoreFocus = false` khi click ngoài và đóng mọi shell dialog khi `location.pathname` thay đổi. |
| `P2-FE-35` | `FE2B-15` | `features/portal/portal-shell.css:1914-1928`, `portalNavigation.ts:62-67` | Nhóm 4 tab của `STAFF` (`Quầy lễ tân`) ép 4 cột bằng nhau trên mobile `<= 360px` khiến chữ `"Transaction"` tràn ngang. | Dùng lưới 2 cột (hoặc thanh cuộn ngang flex) cho nhóm 4 tab trên mobile với `min-width: 0`. |
| `P2-FE-36` | `FE2B-16` | `features/portal/usePortalMotion.ts:17-23, 53-62, 136-147` | `EXCLUDED` bỏ sót `.loading-skeleton` và `[role="dialog"]`; `PART_ATOMIC` bỏ sót wrapper `DatePicker`/`TimePicker`/`FilePicker`; `MutationObserver` gọi đồng bộ `getComputedStyle` gây forced reflow. | Bổ sung đầy đủ selector loại trừ/atomic và gom `markParts` theo `requestAnimationFrame`. |

#### D. Manager Portal, Lịch Học & Báo Cáo (`FE-3`, `FE-7`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-37` | `FE3-10` | `features/schedule/RoomDayTimetable.tsx:1-335`, `calendar.css:326-366`, `timetable.ts:4-12, 249-315, 354-426` | Mã chết lịch theo giờ cũ `06:00–22:00` (`RoomDayTimetable.tsx`, `.rcal__*`, 8 hàm hourly trong `timetable.ts`) chỉ còn được gọi trong test, dễ bị tái sử dụng nhầm gây lỗi `400 SCHEDULING_INVALID_SLOT`. | Xóa `RoomDayTimetable`, CSS `.rcal__*` và các hàm hourly chết. |
| `P2-FE-38` | `FE3-11` | `features/classes/ManagerClassesPage.tsx:178, 329-337, 511-522` | Tab 3 (`Danh sách lớp`) nuốt lỗi làm mới; `isPast` chỉ so `sessionDate < today` (bỏ sót slot đã kết thúc hôm nay); bấm `"Xem lịch"` không nhảy `weekStart` tới tuần khai giảng và cho bấm trên lớp `inactive`/`archived`. | Hiển thị lỗi trên Tab 3, so giờ kết thúc bằng `centerNowParts()`, nhảy `weekStart` tới `mondayOf(cls.startDate)` và ẩn `"Xem lịch"` với lớp ngừng mở. |
| `P2-FE-39` | `FE3-12` | `features/classes/components/ClassSessionDetailModal.tsx:147` | Hiển thị trực tiếp mã enum thô `st.fitnessLevel` (`beginner`/`intermediate`/`advanced`), vi phạm quy tắc `AGENTS.md`. | Ánh xạ qua bộ dịch `Cơ bản`/`Trung cấp`/`Nâng cao`. |
| `P2-FE-40` | `FE3-13` | `features/classes/classesApi.ts:297-326` | Khi `GET /classes/coaches` lỗi, `getActiveCoaches()` gọi fallback sang `GET /users` (chỉ dành cho `ADMIN`) làm che khuất lỗi gốc bằng `403 Forbidden` khó hiểu với Manager. | Gỡ bỏ fallback sang `/users`. |
| `P2-FE-41` | `FE3-14` | `features/manager/manager-coach-assignments.css:49, 70, 95, 153, 182, 184`, `StaffAccountsPage.tsx:229` | Hardcode cam san hô `rgba(255, 122, 89, ...)` lệch màu bạc Dark mode và nền trắng mờ biến mất ở Light mode; `StaffAccountsPage` dùng token không tồn tại `--sol-text-muted`. | Đổi sang `rgb(var(--sol-accent-rgb) / ...)`, `var(--portal-raised)` và `var(--portal-muted)`. |
| `P2-FE-42` | `FE3-15` | `features/manager/ManagerCoachAssignmentsPage.tsx:148, 237, 393, 480, 550-558` | Chọn lại dòng trống `"-- Chọn HLV mới --"` bị ép kiểu `Number("") === 0` làm hỏng `<Select>`; nút Thử lại thiếu class `btn-secondary btn-sm`; nhãn `assignmentTypeLabel` từ backend không đổi khi chuyển VI↔EN. | Ép `e.target.value ? Number(...) : ''`, gắn `btn-secondary btn-sm`, dịch `assignmentType` phía FE hoặc tải lại theo `lang`. |
| `P2-FE-43` | `FE3-16` | `features/manager/ManagerCatalogsPage.tsx:79-95, 106-150, 259-265, 340-354, 569-591, 644, 664` | Phân loại phòng VIP ghi đè `tier === 'STANDARD'` nếu tên chứa `"vip"`; lỗi modal ghi đè vào `error` cấp trang (hiện trùng 2 chỗ); khi tải lỗi vẫn hiện `<table>` rỗng; thiếu kiểm tra trim/maxLength khớp backend (`100`/`150`). | Ưu tiên `r.tier` tường minh; tách `loadError` và `formError`; ẩn bảng khi tải lỗi; bổ sung trim + `maxLength`. |
| `P2-FE-44` | `FE3-17` | `features/manager/ManagerReportsPage.tsx:264, 312, 622, 840`, `reportsApi.ts:129-131, 144, 152` | `t(paymentMethods[tx.method]) ?? tx.method` luôn cho badge rỗng với phương thức lạ vì `t(undefined)` trả `''`; timestamp xuất CSV dùng giờ máy cục bộ; `reportsApi.ts` gán cứng ghi chú duyệt/từ chối bằng tiếng Việt ở EN mode và còn hàm chết `getSnapshots()`. | Kiểm tra `paymentMethods[tx.method] ? t(...) : tx.method`; dùng `formatCenterDateTime` cho CSV; dịch hoặc bỏ ghi chú mặc định cứng. |
| `P2-FE-45` | `FE3-19 + FE7-20` | `ManagerCatalogsPage.tsx:25, 122, 420, 434`, `UserManagerPage.tsx:245, 292, 836, 963, 1252, 1266`, `ManagerCoachAssignmentsPage.tsx:27`, `WeeklyTimetable.tsx:126, 162, 424` | 5 khóa thiếu bản dịch EN (`'9 tháng (270 ngày)'`, quy tắc thời hạn, khôi phục tài khoản, quy tắc mật khẩu), placeholder/default không bọc `t()`, `aria-label` giữ `role.name` tiếng Việt, lỗi ngữ pháp EN dòng `1266`, và 2 chuỗi trộn VI+EN (`gói active`, `bảo lưu tập (frozen)`). | Bổ sung đầy đủ từ điển EN, bọc `t()`, sửa ngữ pháp EN và bỏ từ trộn tiếng Anh trong chuỗi VI. |

#### E. Member Portal, Thanh Toán, Lịch Tập & Check-in (`FE-4`, `FE-5`, `E2E-1`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-46` | `FE4-10 + E2E-1 P3-2` | `MemberPackagesPage.tsx:1484, 1499-1512, 1583, 1610-1670`, `MemberProfilePage.tsx:348-356`, `MemberCheckoutPage.tsx:410, 425` | Dùng `<input type="file" style={{ display: 'none' }}>` (mất focus bàn phím, vi phạm `DESIGN.md:108`), lồng `.portal-card` trong `<Modal>` (`DESIGN.md:53`), nút chọn loại giấy tờ dùng `btn-primary`/`btn-secondary`, và nút xóa ảnh chỉ `22×22px` (<44px). | Thay bằng `shared/ui/FilePicker`, bỏ `.portal-card` lồng nhau, dùng radio/segmented switch và tăng kích thước nút xóa ảnh ≥44px trên touch. |
| `P2-FE-47` | `FE4-11` | `MemberHoldPage.tsx:26-51, 100-104, 148, 159-171, 179, 215, 240-243, 277-281`, `MemberPackagesPage.tsx:1010` | Rút bảo lưu không có `useConfirm()`; thiếu cảnh báo hủy/mất lượt **khóa học nhóm** (chỉ ghi PT 1:1 dù backend hủy cả khóa học); dùng giờ máy cục bộ + cứng `+2` ngày thay vì `centerNowParts()` + `policy.noticeHours`; `window.open` không có fallback chặn popup. | Thêm `useConfirm()`, bổ sung cảnh báo hủy khóa học & mốc 3 ngày, chuyển sang `centerNowParts()` + `policy.noticeHours`, thêm `.form-error`/`aria-invalid` và fallback tải tệp. |
| `P2-FE-48` | `FE4-12` | `MemberInvoicesPage.tsx:27-32, 42-53, 68, 74-75, 90-103, 158, 175` | Mở hóa đơn mới không reset `downloadError` cũ; bộ lọc bảng chỉ lấy `status === 'success'` nên ẩn mất toàn bộ giao dịch `refunded` (dù đã có nhãn/badge); `L74` so sánh `'pending'` phân biệt hoa thường; `<Modal>` thiếu `busy={downloading}`. | Reset `downloadError` khi đổi `selected`, truyền `busy={downloading}`, so sánh chữ thường và hiển thị các dòng `refunded` trong lịch sử. |
| `P2-FE-49` | `FE4-13` | `MemberPackagesPage.tsx:197-276, 1502, 1509, 1561`, `MemberCheckoutPage.tsx:169-226, 371, 380` | Quy tắc KYC mâu thuẫn: regex Hộ chiếu là `6–15` ký tự nhưng thông báo ghi `"6 đến 20"` & `maxLength={20|30}`; regex CCCD cho `9|12` số nhưng lỗi ghi `"đúng 12 chữ số"`; đổi `CCCD → PASSPORT` giữ lại số & ảnh mặt sau; thiếu ref khóa double-submit. | Đồng bộ thông báo & `maxLength` theo `6–15` (Hộ chiếu) và `9 hoặc 12 số` (CCCD); bỏ `backImageUrl` khi chọn `PASSPORT`; thêm ref khóa chống gửi trùng. |
| `P2-FE-50` | `FE4-14` | `MemberCheckoutPage.tsx:220, 307, 478`, `vnpayApi.ts:43`, `VnpayPayButton.tsx:126`, `MemberPackagesPage.tsx:235, 828-1458`, `MemberHoldPage.tsx:91-182`, `coachBookingUtils.ts:5`, `MemberProfilePage.tsx:229`, `notificationLocalizer.ts:78` | 9 chuỗi lỗi/thông báo tiếng Việt lọt sang EN; thiếu khoảng trắng nối JSX tiếng Anh (`"Valid from25/11"`, `"Upgrade: pay299.000 đ"`); lỗi ngữ pháp `"a identity card"`; state lưu chuỗi dịch sẵn không đổi khi chuyển ngôn ngữ; nội suy mã status thô `IN_PROGRESS`/`RESOLVED`. | Bổ sung bản dịch EN, thêm khoảng trắng nối câu, sửa `"an identity card"`, lưu `SourceMessage` vào state và map status phiếu hỗ trợ. |
| `P2-FE-51` | `FE4-15` | `features/member/notificationsApi.ts:52-85` | `safeNotificationPath` cho phép `ADMIN` vào `/messages*` (bị `RoleGuard` chặn) và cho qua đường dẫn đã gỡ `/member/courts`, `/manager/audit-logs` khiến người dùng bấm thông báo cũ bị đá văng ra trang chủ `/`. | Loại `ADMIN` khỏi `/messages*` và dùng allowlist route đang hoạt động theo từng vai trò (ánh xạ đường dẫn cũ về trang thay thế). |
| `P2-FE-52` | `FE4-16` | `features/member/MemberDashboardPage.tsx:34-44, 93-152, 266-328` | Cột 2 (`Lịch tập của tôi`) bỏ sót khóa học nhóm đã khôi phục, không hiện `Slot N`, còn câu chữ cũ `"PT kèm riêng theo giờ"`, kiểm hạn gói bằng `new Date()` cục bộ và thiếu hủy request chống race. | Dùng `centerNowParts().date`, cập nhật nhãn 5 Slot, bổ sung buổi lớp nhóm vào lịch dashboard và thêm khóa chống race khi tải. |
| `P2-FE-53` | `FE4-17` | `features/member/MemberPackagesPage.tsx:71-74, 436, 461-546, 603, 1187, 1201, 1418` | `todayKey()` dùng múi giờ cục bộ thay vì `centerNowParts().date` (lệch `remainingDays`/nâng cấp); `useEffect` gỡ-gắn lại 5 global listener mỗi khi trạng thái tải thay đổi. | Đổi sang `centerNowParts().date` và đọc cờ trạng thái qua ref trong `useEffect`. |
| `P2-FE-54` | `FE5-14` | `features/member/components/MemberCalendar.tsx:139-146, 274` | `useMemo` cho `ptEvents` thiếu dependency `lang` (chuyển VI↔EN không dịch lại tiêu đề PT) và không chuẩn hóa tiền tố `"HLV "` (lộ `"1:1 session with HLV ..."` trong EN). | Thêm `lang` vào deps và chuẩn hóa tên bằng `formatCoachName()`. |
| `P2-FE-55` | `FE5-15` | `MemberCoachBookingView.tsx:116-126, 492, 501, 512, 1077, 1262, 1380, 1683-1684`, `memberLabels.ts:117, 546-547` | Dịch rời mảnh tạo câu EN hỏng (`"...09:30 days 26/11/2026?"`, `"1:1 coaching <name>"`), trộn tên gói VI `'Gói Trải Nghiệm 3 Ngày'` vào câu EN, nhận diện nhầm gói tùy chỉnh 1 buổi/tháng là Trial, fallback `'Fitness & Cardio'` trong VI, và 2 key có khoảng trắng thừa ở `memberLabels.ts` không bao giờ khớp. | Viết câu hoàn chỉnh song ngữ, dịch tên gói qua `localizedPackageName()`, bỏ điều kiện `monthlyQuota === 1` khỏi `isTrial`, và cắt khoảng trắng thừa ở `memberLabels.ts`. |
| `P2-FE-56` | `FE5-16` | `MemberCoachBookingView.tsx:150, 168-193, 282-301, 440-463, 555-570, 887-891, 1595, 1653` | Banner lỗi không có nút Thử lại & nút đóng `✕` thiếu `aria-label`; hiện đồng thời empty state dưới banner lỗi; `.catch(() => null)` trên `getMemberQuotaStatus` biến lỗi mạng thành `"Chưa có gói"`; còn sót dòng cũ `"Nội dung chuyển khoản: PT{id}..."` của VietQR đã gỡ. | Thêm nút Thử lại + `aria-label`, ẩn empty state khi có lỗi, tách trạng thái lỗi quota, và xóa dòng chuyển khoản VietQR cũ. |
| `P2-FE-57` | `FE5-17` | `MemberGroupClassesView.tsx:60-65, 170-185, 196-222, 237-252, 318, 334, 370, 445`, `MemberClassesPage.tsx:32-36` | Chip lọc bộ môn không đồng bộ ngược ra `?discipline=` trên URL; `busyId` đơn lẻ cho phép bấm đăng ký 2 lớp song song làm ghi đè trạng thái khóa; hiện trực tiếp `err.message` thô và toast thiếu `translation`. | Đồng bộ `useSearchParams`, khóa nút khi `busyId !== null` (hoặc dùng `Set<number>`), dùng `localizableError` và `memberNotify`. |
| `P2-FE-58` | `FE5-18` | `MemberCheckInPage.tsx:31, 44-58, 64, 73, 79-86, 93, 117` | Chớp giao diện camera & gọi `loadHistory()` trước khi `useActivePlan()` tải xong; `loadHistory()` không chống race khi đổi bộ lọc `30 ngày`/`Hôm nay`; thông báo ở chế độ `Check-out` vẫn ghi chữ `"check-in"`; nút Thử lại thiếu `type="button"`. | Hiện `<LoadingSkeleton />` khi `plan === 'loading'`, thêm request counter/AbortController cho `loadHistory`, tách câu chữ theo `mode` và thêm `type="button"`. |
| `P2-FE-59` | `FE5-19` | `MemberCoachBookingView.tsx:944-950, 1151-1152, 1319-1498, 1690` | Dùng token không tồn tại `--portal-text-muted`; dùng `btn-secondary` + inline đỏ thay cho `btn-danger btn-sm`; nhóm `<div role="radio">` tùy chỉnh thiếu phím mũi tên `ArrowUp`/`ArrowDown`. | Đổi sang `--portal-muted`, `btn-danger btn-sm`, và dùng radio chuẩn hoặc hỗ trợ phím mũi tên. |

#### F. Coach Portal (`FE-6`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-60` | `FE6-15` | `CoachClassesPage.tsx:132-158, 403-406`, `CoachAttendancePage.tsx:241-244, 283-305, 586-592, 751-757`, `CoachTrainingPlanPage.tsx:278-329, 444-483, 1009`, `SavedTrainingPlans.tsx:57-136` | Modal Hủy PT và modal AI thiếu `busy={...}`; nhiều hàm async (`loadWeeklySessions`, AI generate/restore, `handleSavePlan`, `handleSaveModalAttendance`, `SavedTrainingPlans`) thiếu khóa chống double-click / unmount / đổi học viên giữa chừng; radio điểm danh không khóa khi `saving`. | Truyền `busy` cho mọi modal bất đồng bộ, thêm ref/unmount/request-id guards và gắn `disabled={saving}` lên các radio điểm danh. |
| `P2-FE-61` | `FE6-16` | `CoachAttendancePage.tsx:501-554, 643-646, 728-745`, `PtAttendancePage.tsx:123, 196-204, 235, 246` | Khi `rosterError`/`error` xảy ra vẫn hiện empty state phía dưới & thiếu nút Thử lại; tab Lịch sử thiếu loading skeleton & `role="alert"`; modal sửa điểm danh thiếu badge `gateCheckinAt` & `role="radiogroup"`; `PtAttendancePage` báo sai `invalidRange` khi xóa trắng `to` và không khóa nút lúc `loading`. | Ẩn empty state khi có lỗi, thêm Retry + skeleton lịch sử + badge gate check-in, sửa `invalidRange = Boolean(from && to && from > to)`, và khóa nút PT khi `loading`. |
| `P2-FE-62` | `FE6-17` | `CoachTrainingPlanPage.tsx:325, 493-496, 789, 803, 922, 1031, 1070-1072`, `CoachClassesPage.tsx:185`, `CoachAttendancePage.tsx:288, 552`, `TrainingExerciseFields.tsx:9`, `trainingExercise.ts:26` | Lộ enum thô `fitnessLevel` trong modal AI; trộn VI+EN (`(403 Forbidden)`, `(COACH)`, `(Sets)`, `(Reps)`, `book`, `12 reps`); 4 chuỗi lỗi/thành công thiếu bản dịch EN; nối `...` ngay cả khi `fitnessGoal` rỗng. | Dịch `fitnessLevel`, tách thuần VI/EN, bổ sung 4 khóa vào `staffSourceCatalog.ts` và chỉ cắt chuỗi `...` khi dài >40 ký tự. |
| `P2-FE-63` | `FE6-18` | `CoachClassesPage.tsx:268, 386-387, 423, 533`, `CoachAttendancePage.tsx:367, 698`, `PtAttendancePage.tsx:180, 228-229`, `CoachTrainingPlanPage.tsx:111-117, 676, 713-715, 766`, `coach-*.css` | Token không tồn tại `--sol-text-muted`; tương phản kém ở Light (`--sol-accent` cho chữ, `#1e293b` trên `--portal-salmon`) và Dark (`#16a34a`, `#0284c7`, `#9333ea`, `#ef4444`, `#dc2626`); `<small>` dưới `12px`; bỏ `outline: none` trên textarea AI không có focus ring; chỉ tô đỏ `healthNotes` nếu chứa chữ `"Tránh"`; `max={endDate}` khóa logic tự đẩy ngày kết thúc; thiếu `tabular-nums` & `.portal-tab-count`. | Thay bằng token `--portal-*`/`--sol-accent-text`, chuẩn hóa `btn-danger`/`btn-secondary btn-sm`/`.portal-tab-count`, đảm bảo `>= 12px` + focus ring + `tabular-nums`, tô nổi mọi `healthNotes` khác rỗng và bỏ `max={endDate}` trên Start Date. |
| `P2-FE-64` | `FE6-19` | `features/coaching/coachTimetable.ts:73, 82-101` | Thẻ lớp nhóm trên lịch của HLV luôn lặp lại tên chính HLV đó thay vì hiện số học viên (`bookedCount/capacity`); buổi PT đã qua vẫn luôn gắn `tone: 'mine'` thay vì `past`. | Hiển thị `${seats} học viên` cho `detail` trên lịch HLV và gán `tone: 'past'` cho PT đã kết thúc. |
| `P2-FE-65` | `FE6-20` | `SavedTrainingPlans.tsx:21, 175`, `TrainingExerciseFields.tsx:15`, `TrainingPlanResults.tsx:144` | `iso.split('-')` crash nếu ngày null; giáo án `'completed'` rơi vào badge màu vàng cảnh báo `badge-warning`; input số có thể đẩy `NaN` vào controlled input; `TrainingPlanResults` bỏ sót pill khi chỉ có `sets` hoặc chỉ có `reps`. | Dùng `formatCenterDate`, map `'completed'` sang `badge-info`/`badge-neutral`, kiểm tra `Number.isFinite` và render độc lập `sets`/`reps`. |

#### G. Lễ Tân, Vận Hành, Quản Trị & Chat/Support (`FE-7`, `FE-8`, `FE-3`, `E2E-2`, `E2E-3`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-FE-66` | `FE7-10` | `StaffCheckInPage.tsx:46, 105, 270, 274, 368, 381`, `staffSourceCatalog.ts:366, 561` | Ghép chuỗi dịch vỡ nghĩa trong EN (`"Còn 15 ngày"` → **`"Remaining 15 on"`**); lộ viết tắt tiếng Việt `"HV #12"` trong EN; `executeScan` dùng state `isScanning` thay vì `useRef` nên dễ gửi đúp quét QR. | Dùng câu hoàn chỉnh `t(\`Còn ${days} ngày\`, \`${days} days left\`)`, dịch `HV` → `Member`, và dùng `scanInFlight = useRef(false)`. |
| `P2-FE-67` | `FE7-11` | `StaffReceptionPage.tsx:80, 464, 483, 861, 943, 1139, 1200, 1216, 1337, 1451, 1546`, `receptionApi.ts:339` | Lộ enum thô `CCCD`/`PASSPORT` trong toast EN (`L483`, vi phạm `AGENTS.md`); lộ status thô `ACTIVE`/`INACTIVE` (`L1200`); chuỗi readonly gói & ghi chú mặc định cứng tiếng Việt trong EN; dính chữ `"HLVNguyễn..."` & hiện ISO date thô không có `Slot N` (`L943`); tự bịa mã thẻ giả `MB-2026-001` khi `membershipCode` null. | Dịch enum giấy tờ & trạng thái, bọc `t()` cho chuỗi gói/ghi chú, thêm dấu cách & dùng `formatCenterDate` + `formatSlotLabel`, hiện `"Chưa cấp thẻ"` khi mã null. |
| `P2-FE-68` | `FE7-12` | `StaffReceptionPage.tsx:1654-1692`, `KycReviewPage.tsx:130-139` | Modal duyệt ảnh CCCD/Hộ chiếu Trial cố định ảnh nhỏ `maxHeight: 220` trong lưới cứng `1fr 1fr`, hoàn toàn không phóng to/lightbox được để soi số giấy tờ (và bị bóp nhỏ trên mobile); `KycReviewPage` mở tab mới thay vì lightbox. | Bổ sung lightbox phóng to ảnh dùng chung và lưới responsive `repeat(auto-fit, minmax(220px, 1fr))`. |
| `P2-FE-69` | `FE7-13` | `PaymentInvoice.tsx:24, 47-50`, `payment-invoice.css:2-15, 56` | Tự khởi tạo `Intl.NumberFormat` thay vì dùng `formatPrice` (`DESIGN.md:60`); `.payment-invoice__success` dùng cứng `#166534` (~1,9:1 trên Dark modal); giữ nền kem cũ `#f4f1ed`/`#e3ddd5`/`#57534e`. | Dùng `formatPrice`, thay bằng `--portal-success`, `--portal-raised`, `--portal-border`, `--portal-muted`. |
| `P2-FE-70` | `FE3-18 + FE7-14` | `StaffInternalRequestsPage.tsx:62-67, 105, 108-123, 302, 317, 429, 447, 477-482`, `ManagerInternalRequestsPage.tsx:91, 116-127, 202-239, 246, 284-285, 293, 359-387, 482, 490-506` | Quản lý duyệt đơn nghỉ HLV mù thông tin (không thấy cảnh báo lớp/PT bị trùng & không bắn `member-notifications-changed`); chuỗi lỗi `L105` & ghi chú duyệt `L91` giữ tiếng Việt ở EN; đổi loại đơn vẫn gửi `targetShift` cũ; cho gửi `endDate` không có `startDate`; nút Hủy không khóa khi `submitting`; `min={tomorrowDate}` chặn chọn hôm nay cho đổi ca; hộp metadata hiện rỗng cho đơn `OTHER`; `userFullName.charAt(0)` crash khi rỗng; lặp `"27/11 đến 27/11"`; avatar dùng `--portal-salmon` làm nền; thiếu `htmlFor` & `RefreshButton`. | Hiển thị cảnh báo xung đột lịch HLV khi duyệt, dịch `L105`/`L91`, xóa `targetShift` khi đổi loại, khóa nút Hủy khi submit, ẩn hộp metadata rỗng, guard `userFullName`, thêm `RefreshButton` + `htmlFor` và đổi avatar sang `--sol-accent`. |
| `P2-FE-71` | `FE7-15` | `StaffInternalRequestsPage`, `ManagerInternalRequestsPage`, `HoldManagementPage`, `KycReviewPage`, `StaffCheckInPage`, `UserManagerPage`, `MembershipRequestHistory`, `WalletTopupHistory` | Khi tải lỗi vẫn hiển thị đồng thời cả alert lỗi lẫn khung trống `"Không có..."`; 4 trang thiếu nút `"Thử lại"`; bảng lịch sử thiếu `className="portal-alert"` và báo nhầm `"Chưa có..."` khi tìm kiếm cục bộ ra 0 dòng. | Chỉ hiện empty state khi `!error`, thêm nút Retry trong `.portal-alert`, tách thông điệp 0 kết quả tìm kiếm. |
| `P2-FE-72` | `FE7-16 + FE3-20` | `StaffReceptionPage.tsx:729, 891, 1078, 1301, 1468, 1523, 1601, 1698, 1760-1761`, `HoldManagementPage.tsx:176`, `UserManagerPage.tsx:508-517, 793-860, 1147-1148, 1176, 1237` | Nút nguy hiểm dùng `btn-primary` + inline đỏ (tương phản xấu Dark) hoặc gắn cả `btn-secondary btn-primary`; modal form ghi `"Đóng"` thay `"Hủy"` (`DESIGN.md:58`); `UserManagerPage` đặt CTA chính trong toolbar, thiếu `busy` trên 2 modal Xóa/Cleanup, thiếu `flexWrap` cho `editError`, và tab RBAC thiếu empty state. | Chuẩn hóa `.btn-danger`, nút `"Hủy"`, truyền `busy` cho 2 modal, chuyển CTA lên `PageHeader actions`, thêm `flexWrap: 'wrap'` và empty state RBAC. |
| `P2-FE-73` | `FE7-17` | `HoldManagementPage.tsx:138, 147`, `StaffReceptionPage.tsx:1030, 1662, 1680`, `staff-check-in.css:34-52`, `admin-audit-logs.css:37-50, 142-146`, v.v. | Thẻ `<small>` trần tính ra `11,67px` (<12px, vi phạm `DESIGN.md:50`); badge Hộ chiếu `#2563eb` tối khó đọc trên Dark mode; nhiều mã màu hex cứng rải rác. | Gắn `.meta-label` (12px) cho `<small>`, đổi `#2563eb` sang `var(--portal-info)` và thay hex cứng bằng token `--portal-*`. |
| `P2-FE-74` | `FE7-18 + E2E-2 #5` | `features/admin/AdminAuditLogsPage.tsx:386-433, 505-507, 534-535, 616-637, 770-807` | Diff modal in thẳng enum thô (`CCCD`, `PASSPORT`, `pending_payment` — rò `"CCCD"` sang EN) và nhãn tiếng Anh chưa dịch; dropdown lọc vẫn lộ tùy chọn Shop đã tắt (`products`, `product_orders`, `COMPLETE_ORDER`, `CANCEL_ORDER`, xác nhận trên Chromium `E2E-2`); thanh phân trang vẫn hiện lúc lỗi/đang tải. | Dịch enum & khóa schema trong Diff modal; bỏ tùy chọn Shop khỏi dropdown lọc (vẫn giữ map cho bản ghi lịch sử); ẩn thanh phân trang khi loading/error/0 kết quả. |
| `P2-FE-75` | `FE7-19` | `features/admin/AdminPaymentReconciliationPage.tsx:42-69, 194-200, 219, 537` | Thiếu chặn client >92 ngày (dù ghi chú tối đa 92 ngày); bấm `"Xem lượt treo"` không xóa `search` cũ; chớp empty state 1 frame khi chuyển tab; dùng `.recon-table-scroll` thay vì `.portal-table-wrapper`. | Kiểm tra <=92 ngày trước khi gọi API, xóa `search` khi bấm `"Xem lượt treo"`, coi `!data && !error` là loading, và dùng `.portal-table-wrapper`. |
| `P2-FE-76` | `E2E-3 #10` | `features/manager/ManagerCoachAssignmentsPage.tsx:460` | Khóa dòng bảng `key={table-${assignmentType}-${referenceId}-${memberId}}` bỏ sót `item.coachId` → gây cảnh báo React duplicate key (`ManagerCoachAssignmentsPage.test.tsx:345-346`) và nguy cơ lỗi render khi nhiều HLV chung tham chiếu. | Bổ sung `-${item.coachId}` vào `key`. |
| `P2-FE-77` | `FE8-06` | `features/chat/useDraggableWidget.ts:14-23, 59, 90-105` | Vị trí lưu trong `localStorage` không được kiểm `Number.isFinite` và không kẹp lại theo viewport khi mount → kéo nút chat trên màn hình rộng rồi mở lại trên màn hẹp/mobile khiến nút bay ra ngoài màn hình không bấm được. | Kiểm `Number.isFinite` trong `readStored()` và gọi `clampToViewport` trong `useLayoutEffect` khi mount. |
| `P2-FE-78` | `FE8-07` | `chat-widget.css:388-393`, `support-chat.css:12-14, 28-31`, `chat.css:95, 142, 154` | Nút `.direct-chat__compose-fab` (`40×40px`) và `.support-chat__tool` (`36×36px`, icon `16px`) nhỏ hơn chuẩn chạm `44px`/`20px`; `.direct-chat__input` giữ `14px` ở khoảng `761–1024px` (iPad/tablet bị auto-zoom iOS, vi phạm `DESIGN.md:51`). | Nâng cả 2 nút lên `44×44px` (icon 20px) và mở rộng breakpoint `16px` trong `chat.css` lên `@media (max-width: 1024px), (pointer: coarse)`. |
| `P2-FE-79` | `FE8-08` | `features/chat/ChatComposer.tsx:21, 24, 52-56, 62, 66, 74` | Chèn emoji bỏ qua `maxLength` (`2000`), đẩy chuỗi vượt 2000 ký tự làm nút Gửi bấm im lặng không hoạt động; đóng/mở `disabled` (lúc AI trả lời) làm thanh emoji tự bật lại. | Kiểm tra độ dài `<= maxLength` khi chèn emoji & trong `canSend`; đóng `emojiOpen = false` khi `disabled` bật `true`. |
| `P2-FE-80` | `FE8-09 & FE8-10` | `chatRealtime.ts:48-92`, `MemberSupportChat.tsx:77, 113-138, 235`, `StaffSupportChat.tsx:107-121`, `chat-widget.css:269-271`, `ChatThread.tsx:30-40`, `SupportChatParts.tsx:56-59` | (1) `chatRealtime` lặp vô tận mỗi 30s trên lỗi vĩnh viễn `401/403/404` và banner `reconnecting` bị ẩn khi đang mở thread trong widget; (2) Gửi tin của chính mình khi đang cuộn lên ở `ChatThread` hiện nút `"Có tin nhắn mới"` thay vì tự cuộn xuống; `SupportTranscript` ép cuộn xuống đáy kể cả khi đang đọc tin cũ; nút `"Tải thêm phiếu"` không disable/loading khi append. | Dừng reconnect khi nhận `ApiError` `401/403/404`, đưa banner reconnect ra ngoài `.chat-widget__header-title`, tự cuộn khi `mine === true`, thêm `atBottom` guard cho `SupportTranscript` và state `loadingMore`. |

---

### 6.2. Backend, CSDL Triggers & OpenAPI `P2-Medium` (60 lỗi độc lập)

#### A. Security, Auth, Config, Docker & Nginx (`BE-1A`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-01` | `BE1A-09` | `auth/LoginAttemptService.java:22-35, 50-142`, `AuthService.java:136-165` | `ConcurrentHashMap` không giới hạn kích thước/TTL (rò bộ nhớ OOM khi nhận username ngẫu nhiên); trường mutable trong `AttemptRecord` không `volatile` bị đọc ngoài `compute()` (data race JMM); khóa theo raw `identifier` thay vì `userId` cho phép nhân đôi số lần thử (`username` + `email`). | Dùng Caffeine cache có `maximumSize`/`expireAfterAccess`, biến `AttemptRecord` thành immutable `record`, dùng `remove(key, record)` và khóa theo cả `userId` với backoff lũy tiến. |
| `P2-BE-02` | `BE1A-10` | `compose.yml:22-23`, `application.yml:53-60`, `SecurityConfig.java:72`, `nginx.conf:30-37` | `compose.yml:23` ghi đè mặc định `SWAGGER_ENABLED: ${SWAGGER_ENABLED:-true}` và `SecurityConfig` để `permitAll()`, khiến production VPS tự động phơi bày toàn bộ bản đồ API & Swagger UI ra công cộng. | Đổi mặc định `compose.yml:23` thành `false` và giới hạn `/swagger-ui/**`, `/v3/api-docs/**` cho `ADMIN` khi bật. |
| `P2-BE-03` | `BE1A-11` | `apps/api/src/main/resources/application.yml:79-86` | Tái sử dụng chung 1 khóa `APP_JWT_SECRET` làm fallback cho cả `app.qr.secret` lẫn `app.trial.cccd-pepper` → xoay khóa JWT sẽ phá hỏng kiểm tra chống trùng CCCD trải nghiệm 3 ngày, ngược lại lộ pepper/QR làm giả mạo được JWT Admin. | Tách biến môi trường bắt buộc riêng cho `APP_QR_SECRET` và `APP_TRIAL_CCCD_PEPPER` (không bao giờ fallback về JWT secret cho hash bền vững). |
| `P2-BE-04` | `BE1A-12` | `auth/AuthService.java:145-163, 214-241` | Kênh phụ dò tài khoản (Account Enumeration): `login()` bỏ qua BCrypt (~80ms) khi `user == null` (trả về sau ~2ms); `/password/send-otp` và `/send-otp` trả mã khác nhau `404`/`403`/`200`. | Luôn chạy `passwordEncoder.matches(pwd, DUMMY_BCRYPT_HASH)` khi `user == null`; trả thống nhất `200 OK` cho `/password/send-otp`. |
| `P2-BE-05` | `BE1A-13` | `security/RateLimitingFilter.java:27-28, 57-65, 80, 85, 121-133`, `JwtAuthenticationFilter.java:25-26`, `SecurityConfig.java:217-218` | `endsWith(SCAN_PATH)` + key map theo `uri + ":" + ip` cho phép tạo vô hạn key rác bằng tiền tố đường dẫn; `windowStartMinute` không `final`/`volatile` (JMM race); cả 2 filter vừa `@Component` vừa `addFilterBefore` nên bị đăng ký 2 lần trong Tomcat & Security chain. | Dùng `equals` trên servletPath chuẩn hóa, đặt `final long windowStartMinute`, và tắt servlet auto-registration bằng `FilterRegistrationBean.setEnabled(false)`. |
| `P2-BE-06` | `BE1A-14` | `apps/web/nginx.conf:7-56`, `apps/web/Dockerfile:15-18` | Nginx lộ phiên bản (`server_tokens` chưa tắt), thiếu các header bảo mật (`X-Content-Type-Options`, `X-Frame-Options`/CSP `frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`), và container `web` chạy bằng quyền `root`. | Thêm `server_tokens off;` + security headers đầy đủ (kể cả trong các block `location` có `add_header`), chuyển sang `nginxinc/nginx-unprivileged:1.28-alpine`. |
| `P2-BE-07` | `BE1A-15` | `config/SupabaseConfiguration.java:39-40, 48-55`, `application-supabase.yml:14-16` | Kiểm tra TLS chỉ đọc biến `DB_SSL_MODE`, có thể bị vượt qua nếu đặt thẳng `SPRING_DATASOURCE_HIKARI_DATA_SOURCE_PROPERTIES_SSLMODE=disable`. | Đọc và kiểm chứng trực tiếp property `spring.datasource.hikari.data-source-properties.sslmode`. |
| `P2-BE-08` | `BE1A-16` | `security/SecurityConfig.java:76, 79, 85-95, 107, 110-128, 164-166, 186-189, 208-214` | Dùng không nhất quán alias cũ `MANAGER`/`STAFF` (không có `RoleHierarchy`) ở ~10 matcher nhưng bỏ ở ~30 matcher khác; dòng `107` trùng nguyên văn dòng `76` (`/wallet/members/**`) và dòng `79` trùng dòng `209`. | Chuẩn hóa theo 5 role chính thức (hoặc khai báo `RoleHierarchy`) và xóa matcher trùng lặp. |
| `P2-BE-09` | `BE1A-17` | `auth/ResendOtpDeliveryAdapter.java:35-37, 67-80, 165-168, 240-250`, `UnavailableOtpDeliveryAdapter.java:8-10`, `application.yml:92-93` | `@Primary` vô điều kiện trên `ResendOtpDeliveryAdapter` làm `app.auth.otp.delivery=disabled` vô hiệu; hardcode `webOrigin = "https://scms.bluesymphony.site"` thay vì `${app.cors.web-origin}`; SMTP thiếu kiểm tra chống `\r`/`\n`/`<`/`>`. | Gắn `@ConditionalOnProperty` theo `app.auth.otp.delivery`, inject `${app.cors.web-origin}`, và chặn ký tự CR/LF trong `sendViaStartTlsSmtp`. |

#### B. Người Dùng, Hồ Sơ, KYC & Hạ Tầng Chung (`BE-1B`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-10` | `BE1B-07` | `ProfileController.java:66-70`, `ProfileService.java:132-198, 282-298, 360-382`, `ProfileDto.java:12-53`, `MemberKycRequest.java:10-22`, `MemberKycController.java:25, 53-58`, `MemberKycReviewService.java:94-109`, `Member.java:31-32, 52-53` | `PUT /profile` nhận response DTO `ProfileDto` thay vì `UpdateProfileDto`, trộn lẫn giữ nguyên/ghi đè null; `ProfileDto.fullName` giới hạn `100` ký tự (trái với DB `150` → khóa user tên dài); `healthNotes` (`VARCHAR(255)`) & `nationality` (`100`) thiếu `@Size` nên nổ 409 DB; thiếu regex `emergencyContactPhone`, `@Past` cho `dob`, key i18n cho `@Size`; `submitMemberKyc` ép ngầm `documentType` lạ thành `CCCD`; `RejectRequest` thiếu `@Valid` và cắt 255 ký tự trong DB nhưng gửi nguyên chuỗi dài vào thông báo. | Dùng `UpdateProfileDto` đồng bộ `150` ký tự, bổ sung `@Size`/`@Pattern`/`@Past`/i18n đầy đủ, chặn `documentType` ngoài `{CCCD, PASSPORT}`, thêm `@Valid @NotBlank @Size(max=255)` trên `RejectRequest`. |
| `P2-BE-11` | `BE1B-08` | `UserService.java:316-318`, `UserUpdateDto.java:8-9`, `StaffAccountCreateDto.java:15` | `UserService.updateUser` chấp nhận `fullName: "   "` và ghi đè thành chuỗi rỗng `""`; `StaffAccountCreateDto.phone` thiếu `@Pattern` định dạng SĐT Việt Nam. | Chặn `fullName` toàn khoảng trắng và thêm `@Pattern` SĐT chuẩn cho `StaffAccountCreateDto.phone`. |
| `P2-BE-12` | `BE1B-09` | `users/KycBackfill.java:37-44`, `users/UserService.java:158-168` | `KycBackfill` gọi `members.findAll()` mỗi lần khởi động (nạp toàn bộ ảnh KYC base64 tới 5,6 MB/hội viên vào heap chỉ để bỏ qua các dòng đã mask); `UserService.getAllUsers()` không phân trang (kèm avatar base64) và chạy N+1 truy vấn `existsByMemberUserIdAndStatus(..., "frozen")`. | Truy vấn có điều kiện theo lô trong `KycBackfill`; thay vòng lặp N+1 trong `getAllUsers()` bằng 1 truy vấn batch lấy tập `memberId` đang `frozen`. |
| `P2-BE-13` | `BE1B-10` | `users/ProfileService.java:45-46, 59-68, 86, 92, 398-403` | Fail-open mật mã: nếu `passwordEncoder == null`, bỏ qua kiểm tra mật khẩu cũ và lưu mật khẩu dạng **plaintext**; nếu `kycCrypto == null`, lưu số **CCCD/Hộ chiếu plaintext** thẳng xuống `members.citizen_id`. | Fail-closed (`Objects.requireNonNull` / `IllegalStateException`) và inject bắt buộc `PasswordEncoder` & `KycCrypto`. |
| `P2-BE-14` | `BE1B-11` | `common/i18n/MessageService.java:36-73` | Ngoài luồng HTTP (`@Scheduled`, `@Async`), `LocaleContextHolder.getLocale()` trả về locale hệ điều hành Docker (`en_US`) thay vì mặc định tiếng Việt `I18nConfig.LOCALE_VI`; truyền `code == null` gây `NullPointerException`. | Mặc định về `I18nConfig.LOCALE_VI` khi không có HTTP `LocaleContext` và kiểm tra `code == null`. |
| `P2-BE-15` | `BE1B-12` | `common/GlobalExceptionHandler.java:119-159` | `handleValidation` bỏ sót `getGlobalErrors()` (ràng buộc cấp lớp trả `details: {}`) và ghi đè lỗi trùng trường bằng `HashMap`; `handleConstraintViolation` lộ tên method/arg Java (`getAll.arg0`) và không dịch `{key}`. | Gom cả `getGlobalErrors()` bằng `LinkedHashMap`, trích tên tham số lá và giải mã `{key}` i18n. |

#### C. Lịch Học, Cơ Sở Vật Chất & Seeders (`BE-2`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-16` | `BE2-14` | `ClassSessionRepository.java:42-73`, `ClassService.java:287-306, 853-860, 1030-1060, 1362, 1498-1505` | Khuếch đại truy vấn `O(sessions × toàn bảng)`: `createRecurringClass` nạp toàn bộ bảng `class_sessions` trong mỗi vòng lặp ngày; `searchSessions` chạy `2N+1` truy vấn đếm chỗ; `loadApprovedLeaveDatesByCoach` chạy N+1 theo HLV; không giới hạn độ dài `[startDate, endDate]` (gửi khoảng 100 năm gây DoS CPU/RAM). | Đẩy điều kiện lọc vào JPQL, nạp 1 lần theo khoảng ngày, batch đếm chỗ & lịch nghỉ HLV bằng `IN (...)`, giới hạn tối đa khoảng khóa (ví dụ 365 ngày). |
| `P2-BE-17` | `BE2-15` | `scheduling/service/ClassService.java:283-286, 320` | `createRecurringClass` gọi `DayOfWeek::valueOf` trực tiếp (ném NPE HTTP 500 nếu phần tử null hoặc `IllegalArgumentException` chưa dịch nếu sai tên thứ) và lưu `String.join` chưa loại trùng (dễ tràn `length = 100`). | Tái sử dụng `parseRecurringDays(...)`, ném `400 BadRequestException` i18n và lưu danh sách chuẩn hóa đã khử trùng. |
| `P2-BE-18` | `BE2-16` | `scheduling/service/EnrollmentService.java:861, 891-954` | Khóa học giá `0đ` khi hội viên hết lượt miễn phí không tạo `Payment` (`paymentId = null`) nhưng vẫn trả `paymentStatus = "pending"`. | Đặt `paymentStatus = "success"` khi `price == 0`. |
| `P2-BE-19` | `BE2-17` | `scheduling/service/EnrollmentService.java:668-684` | Endpoint chỉ đọc `GET /classes/my-quota` lấy khóa ghi `PESSIMISTIC_WRITE` (`lockMember`) gây tranh chấp `409 RESOURCE_BUSY` với check-in/thanh toán, và fallback sang gói hết hạn/tương lai nếu không có gói phủ `today`. | Tách helper `@Transactional(readOnly = true)` cho `GET /my-quota` và kiểm tra ngày khác null phủ đúng `today`. |
| `P2-BE-20` | `BE2-18` | `scheduling/service/EnrollmentService.java:424-440, 1025-1063` | `expireUnpaidCourseEnrollments` đọc `ClassEnrollment` không khóa hàng (race với thu tiền đồng thời); `cancelFutureEnrollmentsForMember` hủy ghi danh mà bỏ quên payment `pending` mở lơ lửng. | Dùng `findByIdForUpdate` kiểm tra lại trạng thái sau khóa và chuyển payment `pending` → `failed` trong `cancelFutureEnrollmentsForMember`. |
| `P2-BE-21` | `BE2-19` | `EnrollmentService.java:657-665, 1067-1090, 1137-1148`, `MemberScheduleGuard.java:73-83` | `myEnrollments` chạy `4N+1` truy vấn (1 lấy buổi + 3 `COUNT` tiến độ mỗi khóa); `MemberScheduleGuard.ensureCourseFree` kiểm tra cả buổi quá khứ và chạy `2N` truy vấn lẻ thay vì 2 truy vấn khoảng ngày. | Batch tải tóm tắt buổi & đếm điểm danh theo `classIds`; chỉ kiểm buổi `scheduled` từ `today` trở đi bằng 2 truy vấn khoảng ngày. |
| `P2-BE-22` | `BE2-20` | `scheduling/service/SessionBookingService.java:285-320` | `cancelMany` ghi đè 1 biến `Long notifyUser` trong vòng lặp nên khi nhân viên hủy lô nhiều hội viên chỉ người cuối nhận thông báo (với tổng số buổi của tất cả mọi người), và khóa `gym_class` không sắp thứ tự dễ gây deadlock. | Sắp xếp `(classId, bookingId)` trước khi khóa và gom nhóm gửi thông báo theo từng `memberId`. |
| `P2-BE-23` | `BE2-21` | `facilities/service/RoomService.java:42-46`, `facilities/service/PackageService.java:62-77` | `RoomService.update` cho giảm sức chứa phòng xuống nhỏ hơn sức chứa lớp đang `active`; `PackageService.update` cho đổi `tier` (`PLATINUM → SILVER`) & `classCreditLimit` của gói đã bán, tước quyền lợi trực tiếp của hội viên hiện hữu. | Chặn giảm `room.capacity` dưới max `class.capacity` đang hoạt động; khóa `tier`/`classCreditLimit` trong `PACKAGE_IDENTITY_LOCKED` khi gói đã có người mua. |
| `P2-BE-24` | `BE2-22` | `facilities/RetiredCatalogCleanupRunner.java:183-189` | Vô hiệu hóa lớp đã nghỉ (`status = 'inactive'`) nhưng không hủy các buổi `scheduled` tương lai, khiến trigger `scms_check_session_conflict` vẫn chặn phòng/HLV do buổi ma. | Hủy toàn bộ `class_sessions` tương lai đang `scheduled` của lớp khi chuyển sang `inactive`. |
| `P2-BE-25` | `BE2-23` | `demo/DemoClassSeeder.java:88-104, 197-204`, `demo/DemoDataSeeder.java:80-85, 324-336, 497, 521-522` | Cả 3 lớp demo đều có `startDate = today - 14` (không thể đăng ký thử out-of-the-box) và còn comment/logic cũ "1 lớp/bộ môn"; dữ liệu demo của `chi` (Silver có PT `package_quota`) & `em` (Silver 30 ngày có bảo lưu 14 ngày) trái với `PackageBenefits`. | Seed thêm khóa sắp khai giảng (`fromDay > 0`) chuẩn đa lớp/bộ môn và chỉnh dữ liệu `chi`/`em` khớp `PackageBenefits`. |

#### D. Huấn Luyện & Điểm Danh (`BE-3`, `E2E-1`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-26` | `BE3-10 + E2E-1 P2-3` | `coaching/CoachBookingController.java:22-178`, `SecurityConfig.java:193-204` | Toàn bộ 12 endpoint của `CoachBookingController` không có `@PreAuthorize` (chỉ trông cậy URL matcher); `GET /coach-schedule` cho `CENTER_MANAGER` truy vấn theo `principal.id()` làm `coachId` nên luôn trả `[]`. | Gắn `@PreAuthorize` cho cả 12 endpoint; giới hạn `/coach-schedule` cho `COACH` hoặc nhận thêm `?coachId` cho `CENTER_MANAGER`. |
| `P2-BE-27` | `BE3-12` | `coaching/service/CoachBookingService.java:617-684` | `unmarkAttended()` không kiểm tra giờ bắt đầu (cho phép khóa điểm danh buổi PT tương lai chưa diễn ra); cả `markAttended` và `unmarkAttended` đều thiếu `findByIdForUpdate` và trả `gateCheckinAt = null` làm mất badge check-in trên UI. | Bổ sung kiểm tra `startTime <= now` trong `unmarkAttended()`, khóa `findByIdForUpdate`, và điền `ptAttendance.gateCheckinFor(booking)` vào DTO trả về. |
| `P2-BE-28` | `BE3-13` | `coaching/service/CoachBookingService.java:178-181, 331-336, 491-494` | `createBooking()` và `getAvailableSlots()` không kiểm tra `coach.user.deletedAt == null && status == 'active'`, và chấp nhận `disciplineId` của bộ môn đã ngừng hoạt động. | Kiểm tra tài khoản user của HLV còn `active` + chưa xóa mềm và bộ môn đang `active`. |
| `P2-BE-29` | `BE3-14` | `coaching/service/CoachBookingService.java:712-781` | Khi HLV hoặc Quản lý hủy buổi PT, hệ thống vẫn điền cứng lý do `"Hội viên yêu cầu hủy"` và chỉ gửi thông báo cho HLV — **hội viên hoàn toàn không nhận được thông báo buổi PT bị hủy**. | Gửi thông báo cho hội viên khi `cancelledByStaff == true` (bỏ gửi cho chính HLV thao tác) và dịch lý do hủy mặc định qua `MessageService`. |
| `P2-BE-30` | `BE3-15` | `coaching/service/TrainingPlanService.java:107-128, 146-187, 195-229` | Thiếu khóa & partial unique index `(member_id, coach_id) WHERE status = 'active'` (race tạo 2 giáo án active); `addItem()` cho sửa giáo án đã `superseded`; `activatePlan()` cho kích hoạt nháp đã hết hạn; `createPlan()` cho truyền `aiRecommendationId` của hội viên khác (IDOR đánh dấu `applied=true`). | Khóa `Member` trước khi kích hoạt + thêm partial unique index; chặn `superseded` trong `addItem`; kiểm tra `endDate` trong `activatePlan`; xác minh `recoLog.member == dto.memberId`. |
| `P2-BE-31` | `BE3-16` | `coaching/service/CurrentCoachMembers.java:47-80` | `GET /api/v1/coaching/members` vẫn truy vấn bảng đã tắt `member_progress_logs` và chạy bão `2N+1` truy vấn trên toàn bộ hội viên khi `CENTER_MANAGER` gọi (rất dễ nghẽn Hikari pool 5 kết nối). | Chặn truy vấn `progressLogs` theo cờ `app.health.metrics.enabled` và batch-load gói tập theo `IN (:memberIds)`. |
| `P2-BE-32` | `BE3-17` | `CoachBookingService.java:420-436`, `postgresql-triggers.sql:655-664` | Cả Java và trigger `scms_guard_pt_schedule` đòi hỏi **1 dòng** gói duy nhất phủ cả `today` và `bookingDate` → hội viên gia hạn sớm (gói mới bắt đầu tháng sau) bị chặn đặt lịch PT cho kỳ đã trả tiền trước. | Kiểm tra riêng có gói active không bảo lưu phủ `today` VÀ có gói active không bảo lưu phủ `bookingDate` (đồng bộ cả trigger). |
| `P2-BE-33` | `BE3-18` | `attendance/service/SessionAttendanceService.java:262-267, 372-454, 484-496` | `requireAssignedCoach()` fail-open khi `sessionCoach == null`; `getHistory()` tải toàn bộ buổi học từ trước đến nay của HLV vào bộ nhớ không lọc ngày/không `join fetch`; `recordBatchAttendance()` không chặn trùng `memberId` trong mảng. | Fail-closed khi `sessionCoach == null`; lọc khoảng ngày + `join fetch` trong JPQL; chặn trùng `memberId` bằng HTTP 400. |

#### E. Thành Viên, Tài Chính, VNPay & Ví SÖL (`BE-4`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-34` | `BE4-12` | `membership/service/MembershipSubscriptionService.java:828-836, 1156-1160` | Lỗi lệch 1 ngày (off-by-one) khi kết thúc bảo lưu sớm (`resume()`): duyệt bảo lưu cộng bao hàm (`+1`), nhưng `resume()` trừ không bao hàm (`DAYS.between(today, holdEndDate)`), tặng miễn phí +1 ngày cho mọi lần tập lại sớm. | Trừ `DAYS.between(today, holdEndDate) + 1` khi `!today.isAfter(holdEndDate)`. |
| `P2-BE-35` | `BE4-13` | `membership/service/EntitlementRevocationService.java:103-112` | `coveredByDatedHold` cộng thêm `heldDays` vào `sub.endDate` lần thứ 2 mà không kiểm tra `sub.isHoldDaysCredited()`, và không loại trừ các ngày nằm ngay trong `[holdStartDate, holdEndDate]`. | Kiểm tra `sub.isHoldDaysCredited()` trước khi cộng và loại trừ ngày nằm trong kỳ bảo lưu. |
| `P2-BE-36` | `BE4-14` | `membership/service/MembershipSubscriptionService.java:1033-1061, 1119-1174` | `cancelHoldRequest` / `withdrawHoldForMember` chỉ khóa `MembershipSubscription` (không khóa `Member` như `approveHold`) → race condition cho phép `approveHold` ghi đè thành `APPROVED`/`frozen` lên đơn bảo lưu vừa rút. | Nhất quán khóa `Member` (`findByUserIdForUpdate`) trước, rồi mới khóa `MembershipSubscription` + refresh ở cả 3 hàm. |
| `P2-BE-37` | `BE4-15` | `MembershipLifecycleScheduler.java:42-98`, `MembershipSubscriptionService.java:48, 283-294, 959-968` | Thiếu job chuyển gói quá hạn từ `active` → `expired` → gói hết hạn vẫn ghi `status = "active"` mãi mãi; nếu có đơn bảo lưu `PENDING` bị quá hạn thì lễ tân không còn nhìn thấy, nhưng `renewForOwner()` vẫn chặn gia hạn vĩnh viễn với `409 MEMBERSHIP_HOLD_ALREADY_PENDING`. | Thêm tác vụ `expirePastDueSubscriptions()` trong `MembershipLifecycleScheduler` và tự đóng/từ chối các đơn bảo lưu `PENDING` của kỳ đã hết hạn. |
| `P2-BE-38` | `BE4-16` | `membership/service/MembershipSubscriptionService.java:283-320, 822, 1068-1097` | Cho phép gia hạn khi gói hiện tại đang có `HOLD_APPROVED` tương lai; sau khi gói gia hạn `S2` đã thanh toán, bấm `withdrawHold(S1)` trừ `H` ngày khỏi `S1.endDate` tạo khoảng trống `H` ngày không có gói giữa `S1` và `S2`, đồng thời làm kẹt `resume()`. | Chặn `renewForOwner` khi có `HOLD_APPROVED`, và chặn `withdrawHold` khi đã có `hasPaidFutureRenewal`. |
| `P2-BE-39` | `BE4-17` | `PaymentController.java:54-59, 64-70, 98-106`, `PaymentService.java:259-263, 382-392, 399-462, 495-499` | `processPayment`/`createPayment` nhận `receivedById` từ JSON client (cho phép giả mạo thu ngân hoặc gán member ID); `PATCH /payments/{id}/status` không lấy `@AuthenticationPrincipal` nên luôn để `received_by = NULL`; cho phép nhân viên xác nhận tay khoản `online_wallet` thành `success` mà không đổi `method` sang `cash`; thiếu khóa hàng `Payment` cho thanh toán không phải gói tập. | Luôn gán `receivedBy` từ `@AuthenticationPrincipal`, chặn xác nhận tay `online_wallet` (hoặc ép đổi sang `cash` + `receivedBy`), và khóa `PESSIMISTIC_WRITE` trên `Payment` trong `updatePaymentStatus`. |
| `P2-BE-40` | `BE4-18` | `MembershipSubscriptionService.java:158-205, 230-238, 273-360, 1350-1362`, `MemberTrialService.java:393, 538` | Gói Trải nghiệm `0đ` có thể bị mua/gia hạn qua luồng thường tạo gói ma `pending_payment` `0đ` không thể thanh toán làm bẩn hàng đợi lễ tân; ngoài ra `MemberTrialService` đặt `endDate = today.plusDays(3)` nên tặng **4 ngày bao hàm** thay vì 3 ngày. | Chặn `PackageBenefits.isTrial(pkg)` / `price <= 0` ở luồng mua & gia hạn; sửa `MemberTrialService` thành `today.plusDays(TRIAL_DAYS - 1L)`. |
| `P2-BE-41` | `BE4-19` | `finance/service/PaymentService.java:912-946, 952-958` | Thanh toán trễ một đơn nâng cấp tính theo tỷ lệ có thể thu tiền rồi kích hoạt ngay gói đã hết hạn (`endDate < today`); hoàn tiền một phần trên gói cũ không làm vô hiệu `creditApplied` của đơn nâng cấp `pending_payment` (dễ lặp hoàn tiền). | Chặn kích hoạt nâng cấp nếu `endDate < today`; kiểm tra `creditApplied <= paidValue(previous)` khi kích hoạt (hoặc hủy nâng cấp pending khi hoàn tiền gói cũ). |
| `P2-BE-42` | `BE4-20` | `wallet/WalletService.java:68-90, 133, 225, 307, 366, 497`, `PaymentReconciliationService.java:147-166, 198-256` | Race điều kiện khi 2 request đầu tiên cùng tạo `Wallet` (không khóa được dòng chưa tồn tại → nổ `DataIntegrityViolationException` 500/IPN 99); `WalletService` dùng `LocalDateTime.now()` (UTC trên Docker) lệch 7 tiếng so với `Clock` VN của `Payment`/`VnpayTransaction`/`Reconciliation`. | Tạo ví nguyên tử qua `INSERT ... ON CONFLICT (user_id) DO NOTHING` (hoặc khóa `User` trước); inject `Clock` (`Asia/Ho_Chi_Minh`) vào `WalletService`. |

#### F. Vận Hành, Báo Cáo & Kiểm Toán (`BE-5`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-43` | `BE5-12` | `StaffInternalRequestService.java:87-94, 126-130`, `StaffInternalRequestCreateDto.java:10-26`, `StaffInternalRequest.java:31, 43` | Cho phép tạo đơn nghỉ phép ngày trong quá khứ (ví dụ `2020-01-01`), khoảng nhiều năm, hoặc `endDate` mồ côi khi `startDate == null`; `title` (`200`) và `targetShift` (`100`) thiếu `@Size` gây nổ HTTP 409 DB thay vì 400. | Chặn ngày quá khứ, giới hạn số ngày nghỉ tối đa, chặn `endDate` mồ côi, thêm `@Size` đầy đủ trên DTO. |
| `P2-BE-44` | `BE5-13` | `operations/service/StaffInternalRequestService.java:98-110, 207-235` | `reviewRequest()` không chặn tự duyệt chính đơn của mình (`req.user.id == managerUserId`) và cho phép duyệt chồng nhiều đơn `LEAVE` trùng ngày. | Chặn tự duyệt bằng `403` và kiểm tra trùng đơn `LEAVE` đã `APPROVED` trước khi duyệt. |
| `P2-BE-45` | `BE5-14` | `operations/service/StaffInternalRequestService.java:40, 113-121` | Kiểm tra người thay thế cho phép gán chéo vai trò (`COACH` nhờ `RECEPTIONIST` thay và ngược lại), không kiểm tra người thay có đang nghỉ phép đã duyệt không, và loại sót `STAFF` khỏi `REPLACEMENT_ROLES`. | Bắt buộc người thay cùng nhóm vai trò chức năng và không đang có đơn nghỉ đã duyệt trong khoảng ngày đó. |
| `P2-BE-46` | `BE5-15` | `TransactionReportRepository.java:14-26`, `RevenueReportService.java:144-151, 176-199, 229, 237-240` | `findRecentTransactions` lọc `u.deletedAt is null` còn tổng doanh thu thì không (gây lệch sổ); giao dịch PT 1:1 luôn có `packageName = null` vì chỉ `coalesce(pkg.name, c.name)`; `getClassUtilization` chỉ kiểm `start <= end` khi cả 2 khác null (gửi mỗi `startDate=2100-01-01` bị ngược ngày). | Đồng nhất chính sách user xóa mềm trên báo cáo tài chính; left-join `coachBooking` đặt tên dịch vụ PT 1:1; kiểm `start <= end` sau khi áp giá trị mặc định. |
| `P2-BE-47` | `BE5-16` | `MemberLookupService.java:45-50`, `AuditSpecifications.java:38-49`, `AuditLog.java:16`, `AuditLogRepository.java:9`, `StaffInternalRequestRepository.java:24-41` | Ký tự wildcard SQL `LIKE` (`%`, `_`, `\`) không được escape (gõ `q=%%` hoặc `q=__` ở tra cứu hội viên lách giới hạn 2 ký tự; lọc audit action/entity chứa `_` khớp sai); bảng `audit_logs` thiếu index trên `created_at` và `user_id`; thiếu `@EntityGraph`/`JOIN FETCH` & phân trang trên list đơn nội bộ. | Escape ký tự `LIKE` với `ESCAPE '\\'`, giới hạn độ dài `q`, thêm index `created_at` & `user_id` trên `AuditLog`, và thêm `@EntityGraph`/`JOIN FETCH` + phân trang. |

#### G. AI, Chat, Hỗ Trợ & Thông Báo (`BE-6`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-48` | `BE6-08` | `Notification.java:54-102`, `AuthService:276`, `ProfileService:101`, `CourseAttendanceService:174`, `MemberKycReviewService:136`, `MemberTrialService:321,454`, `MembershipCancellationService`, `WalletService` | Nhiều caller truyền `type`/`relatedEntityType` ngoài tập cho phép của `ck_notifications_*` (`password_changed`, `user`, `member`, `member_trial_redemption`, `cancellation_request`, `wallet`, `order`) bị ép im lặng thành `system`/`null`/`payment` và thiếu `actionPath` (click thông báo KYC/đổi mật khẩu/trial trỏ nhầm về dashboard); `normalize*` so sánh phân biệt hoa thường. | `.toLowerCase(Locale.ROOT)` trong `normalize*`; truyền entity type hợp lệ và `actionPath` tường minh (`/member/profile`, `/member/packages`) tại các caller. |
| `P2-BE-49` | `BE6-09` | `SupportRequestController.java:75-92`, `NotificationController.java:48-53`, `GlobalExceptionHandler.java:419-428` | Truyền `Pageable` trực tiếp từ client cho phép `MEMBER` sort theo trường nội bộ bị che (`?sort=escalationReason,asc` hoặc `assignedTo.passwordHash`), và gửi tên cột không tồn tại gây HTTP 500 `PropertyReferenceException`. | Khởi tạo `PageRequest` cố định `createdAt DESC` & giới hạn `size <= 50` trong controller, đồng thời map `PropertyReferenceException` về HTTP 400. |
| `P2-BE-50` | `BE6-10` | `apps/api/Dockerfile:18-35`, `NotificationScheduler.java:98`, `SupportRequest.java:42, 67`, `SupportRequestMessage.java:36, 53`, `AiRecommendationService.java:340` | Lệch múi giờ 7 tiếng trên container Docker (UTC): `NotificationScheduler` cron `"0 0 8 * * ?"` thiếu `zone = "Asia/Ho_Chi_Minh"` nên chạy lúc **15:00 chiều**; `SupportRequest.createdAt` dùng UTC trong khi `resolvedAt`/`escalatedAt` dùng `CenterTime` (lệch 7 tiếng trên cùng 1 dòng DB!); `AiRecommendationService` dùng `LocalDate.now()` (UTC) gán ngày hôm qua vào sáng sớm 00:00–06:59 VN. | Thêm `zone = "Asia/Ho_Chi_Minh"` cho `@Scheduled`, dùng `CenterTime.ZONE`/`Clock` đồng nhất cho mọi `now()` và thiết lập `TZ=Asia/Ho_Chi_Minh` trong `Dockerfile`. |
| `P2-BE-51` | `BE6-11` | `ai/service/AiRagContextService.java:142-153` | Đọc gói `status = 'active'` mà không kiểm tra `startDate <= today <= endDate` và không nhận diện gói `frozen` (chỉ báo `"Chưa có gói active"` cho hội viên đang bảo lưu). | Lọc gói phủ ngày `today` và bổ sung nhánh kiểm tra gói `frozen` cho ngữ cảnh RAG. |
| `P2-BE-52` | `BE6-12` | `chat/service/ChatService.java:68-84`, `coaching/service/CurrentCoachMembers.java:48-71` | `coachContacts` gọi `coachMembers.list()` chạy `3N+1` truy vấn (bao gồm bảng đã tắt `member_progress_logs`) rồi vứt bỏ kết quả, sau đó cắt phân trang `subList` *trước* khi lọc user inactive làm sai `totalElements` và thiếu phần tử trên trang. | Viết 1 truy vấn JPQL phân trang `searchForCoach(...)` trực tiếp trong `ChatContactRepository`. |
| `P2-BE-53` | `BE6-13` | `chat/service/ChatService.java:147, 154, 157-159, 209-210, 233-235` | `ChatService.send()` không kiểm tra lại quan hệ HLV–Học viên (`requireCoachOf`) trên hội thoại cũ nên HLV đã rời lớp/đổi phân công vẫn nhắn được mãi; `ChatService.open()` khi mở lại hội thoại cũ trả `lastMessage = null, unreadCount = 0`. | Kiểm tra `requireCoachOf` trong `send()` khi có `COACH` (giữ `history()` chỉ đọc) và nạp đủ `lastMessage`/`unreadCount` trong `open()`. |
| `P2-BE-54` | `BE6-14` | `AiChatMessageCreateDto.java:13`, `CreateSupportRequestDto.java:12`, `OpenAiRestClient.java:118`, `GeminiRestClient.java:115`, `AiClientConfig.java:34-40` | `AiChatMessageCreateDto.topic` thiếu `@Size(max = 150)` (nổ 409 DB); `CreateSupportRequestDto.description` không giới hạn kích thước & `subject` không trim; `OpenAiRestClient`/`GeminiRestClient` nuốt mọi lỗi hoàn toàn im lặng không log, trả fallback giả `"status":"success"` lặp lại JSON hồ sơ; `AiClientConfig` bỏ qua API key trong `.env` nếu `provider` được đặt rõ. | Thêm `@Size(max=150)` / `@Size(max=5000)` + trim; ghi log lỗi provider (không lộ key/PII) và đọc API key `.env` độc lập với `provider`. |
| `P2-BE-55` | `BE6-15` | `SupportRequestService.java:217, 257-266`, `NotificationScheduler.java:202, 215-218`, `ClassSessionRepository.java:88-102` | `SupportRequestService.updateStatus` fail-open nếu `assignee.status`/`role` null và thiếu `requireActor`; `NotificationScheduler` gửi nhắc lớp sắp học cho cả buổi `scheduled` sót lại của lớp `inactive`. | Fail-closed trên kiểm tra `assignee` + gọi `requireActor`; kiểm tra `gymClass.status == 'active'` trong `NotificationScheduler`. |

#### H. PostgreSQL Triggers, Cô Lập Shop & Hợp Đồng OpenAPI (`BE-7`, `BE-6`, `E2E-1`)

| Mã | Nguồn | Vị trí (File & Dòng) | Mô tả & Bằng chứng | Hướng khắc phục |
|---|---|---|---|---|
| `P2-BE-56` | `BE7-10` | `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:33-37, 62-65, 105-115, 218, 237-240, 655-664, 786, 794, 826-833` | Nguy cơ deadlock AB-BA tiềm ẩn do thứ tự chữ cái của `AFTER` trigger đảo ngược giữa `class_enrollments` (`classes FOR UPDATE` → `member-schedule`) và `session_bookings` (`member-schedule` → `classes FOR UPDATE`, hiện đang bị che bởi khóa toàn cục `391133`); `scms_guard_pt_schedule` thiếu `FOR SHARE` khi kiểm tra gói tập; khóa advisory trong 2 hàm thiếu tiền tố `current_schema()`. | Thống nhất thứ tự khóa ở cả 2 bảng, thêm `FOR SHARE` cho nhánh kiểm tra gói PT và thêm tiền tố `current_schema() || ':'` cho mọi advisory lock key. |
| `P2-BE-57` | `BE7-11 + BE6-16` | `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:19, 83, 172, 203, 242, 278, 567-576, 631, 747, 772` | 10/13 hàm trigger thiếu `SET search_path FROM CURRENT` (gây cảnh báo Supabase Security Advisor `Function Search Path Mutable`); 2 chính sách RLS `scms_chat_receive_guard`/`send_guard` chỉ áp dụng `TO authenticated` thay vì `TO PUBLIC` như Support (bỏ sót `anon`). | Thêm `SET search_path FROM CURRENT` cho cả 10 hàm và đổi policy chat sang `TO PUBLIC`. |
| `P2-BE-58` | `BE7-12` | `apps/api/src/main/resources/db/triggers/postgresql-triggers.sql:337-359, 487-499` | Khối `DO $$` khởi động vô điều kiện chạy `DROP/ADD CONSTRAINT` (`ACCESS EXCLUSIVE` lock) và `UPDATE` toàn bảng trên `membership_subscriptions`, `training_plans`, `notifications` ở MỌI lần restart mà không kiểm tra `pg_constraint` trước và không có `SET LOCAL lock_timeout`. | Kiểm tra định nghĩa `pg_constraint` trước khi sửa (biến các lần boot sau thành no-op) và đặt `SET LOCAL lock_timeout = '10s'`. |
| `P2-BE-59` | `BE7-13` | `shop/service/GeoService.java:17-47` (+ 13 service/mapper shop khác), `application.yml:113-120` | Dù `app.shop.enabled=false`, 14 bean dịch vụ Shop vẫn khởi tạo (riêng `GeoService` đọc/parse 141 KB JSON vào RAM lúc khởi động và đánh sập app nếu thiếu tệp); `seed-samples` mặc định `true` (nguy cơ tự seed 6 sản phẩm mẫu nếu bật cờ trên production). | Gắn `@ConditionalOnProperty(name = "app.shop.enabled", havingValue = "true")` cho toàn bộ service/mapper Shop (trừ `ProductOrderRefunds` nếu cần IPN cũ) và đặt mặc định `seed-samples: false`. |
| `P2-BE-60` | `BE7-14 + E2E-1 P3-3` | `docs/api-contracts/*.yaml` (24 file, nổi bật `openapi-group-classes-restored.yaml`, `openapi-vnpay.yaml`, `openapi-coaching-review-fixes.yaml`, `openapi-membership-benefits.yaml`, `openapi-admin-reconciliation.yaml`) | Hợp đồng OpenAPI trôi xa so với mã thực tế: (1) `openapi-group-classes-restored.yaml` mô tả sai `PUT /classes/{id}` (nói sai có tái sinh buổi/kiểm slot/giá), sai mã 403 vs 400 của `POST /coach-bookings`, thiếu `requestBody` cho 3 API lõi; (2) Còn nhiều dấu vết `courtBookingId`/`COURT_BOOKING`/`COACH_REST_REQUIRED`/khung 1 giờ cũ; (3) **27 endpoint đang hoạt động chưa xuất hiện trong bất kỳ file YAML nào** (gồm `/coach-bookings/{coaches,my,quota-status,coach-schedule}`, `/wallet/{my,topup/vnpay}`, `/operations/requests{,/my}`, `/users/{deleted,{id}/restore}`, `/memberships/cancellations/staff-request`, `/coaching/training-plans/{id}`, `/health`, v.v.). | Cập nhật `openapi-group-classes-restored.yaml`, xóa tham chiếu `court`/`coach_rest`, gắn nhãn superseded cho các hợp đồng lịch sử, và bổ sung đầy đủ 27 endpoint đang chạy. |

---

### 6.3. Khoảng Trống & Độ Tin Cậy Kiểm Thử `P2-Medium` (3 mục)

- **`P2-E2E-01` `[E2E-3 #7]` — 6 Controller backend đang hoạt động khác chưa có bài test HTTP/Security:** `MemberTrialController`, `StaffInternalRequestController`, `MemberLookupController`, `MembershipRequestHistoryController`, `MembershipRealtimeController`, `HealthController`.
- **`P2-E2E-02` `[E2E-3 #8]` — Màn hình Frontend thiếu hoặc quá mỏng độ bao phủ test:** **0 bài test** cho `StaffRequestHistoryPage.tsx` và `MembershipRequestHistory.tsx`; test quá mỏng (`<= 2` test) trên các màn đa luồng gồm `ManagerCatalogsPage.test.tsx` (0 test cho tab Bộ môn & Phòng), `MemberGroupClassesView.test.tsx` (0 test hủy/thanh toán/lỗi), `CoachAttendancePage.test.tsx`, `PaymentInvoice.test.tsx`.
- **`P2-E2E-03` `[E2E-3 #9 + E2E-1 P3-4]` — Các bài test phụ thuộc giờ/nửa đêm (flaky) không đóng băng `Clock`/Fake Timers:** `CenterTimeTest.java:17-18` (lỗi khi qua mốc đổi giờ `xx:59:59.999`), `TrainingPlanServiceTest.java:485-495`, `ChatRealtimeServiceTest.java:33`, `AiChatServiceTest.java:114-136`, `StaffInternalRequestServiceTest.java:102,305`, `ClassControllerTest.java:100`, `EnrollmentControllerTest.java:92`, `MemberHoldPage.test.tsx:15-19`, `CoachClassesPage.test.tsx:30,279` (lỗi vào tối Chủ nhật sau 19:30), `MemberPackagesPage.test.tsx:998-999`. **Khắc phục:** Dùng `Clock.fixed(...)` ở Java và `vi.useFakeTimers()` ở Vitest.

---

## 7. Danh Sách Lỗi `P3-Low` & Nợ Kỹ Thuật / Dead Code (56 mục độc lập)

### 7.1. Frontend `P3-Low` (32 mục)

| Mã | Nguồn | Vị trí (File & Dòng) | Tóm tắt vấn đề & Hướng xử lý |
|---|---|---|---|
| `P3-FE-01` | `FE1-18` | `LuxuryLoginForm.tsx:152-158, 279-286` | Phân loại lỗi Google OAuth bằng `includes('403')` mong manh, gán sai thông báo khi người dùng tự đóng popup, còn `console.warn` trong production. Dùng `err instanceof ApiError && err.status === 403` và kiểm `error?.type === 'popup_closed'`. |
| `P3-FE-02` | `FE1-19` | `RegisterPage.tsx:100-108, 196` | Nếu đăng ký thành công nhưng `sendOtp` lỗi, fallback báo nhầm `"Đăng ký không thành công."`; Bước 2 thiếu `noValidate`. Tách `try/catch` riêng cho `sendOtp` và thêm `noValidate`. |
| `P3-FE-03` | `FE1-20` | `PublicLayout.tsx:14-19, 100, 141, 160` | Dùng `key={label}` đã dịch khiến đổi VI↔EN remount link nav (mất `.is-active`); footer luôn ghi `"Không gian hội viên"` kể cả cho Staff/Manager/Admin. Đổi sang `key={to}` và đồng bộ `"Vào portal"`. |
| `P3-FE-04` | `FE1-21` | `app/router.tsx:251-265` | `MANAGER` truy cập route cũ `/staff/orders`, `/staff/pt-attendance` bị redirect 2 chặng (`/staff/reception` → `/manager/reports`). Giới hạn lại `allowedRoles` hoặc redirect thẳng theo role. |
| `P3-FE-05` | `FE1-22` | `features/pwa/PwaStatus.tsx:25, 68-73` | Modal cài đặt thủ công trên trình duyệt Desktop hiện hướng dẫn Chrome Android. Bổ sung nhánh phân biệt Android vs Desktop. |
| `P3-FE-06` | `FE1-23 + E2E-1 P3-1` | `styles.css:15, 30, 119, 260, 332`, `portal.css:382, 1446`, `fitness-public.css:142, 425, 477`, `member-checkout.css:28` | Còn token vàng Quiet Luxury cũ (`#8C6D46`, `#C2A684`, `#E3CFB0`), hex `#a35b49` chưa qua biến và `.fit-services-glow` dùng `filter: blur(20px)` vùng rộng (`DESIGN.md:72`). Chuyển hết về `--sol-accent*` và radial gradient mềm. |
| `P3-FE-07` | `FE1-24` | `authApi.ts:102`, `authValidation.ts:48`, `RegisterPage.tsx:36`, `LuxuryLoginForm.tsx:91`, `publicCatalog.ts:5`, `styles.css:140-161`, `fitness-public.css` | Hàm chết `googleLoginWithIdToken`; `registrationSchema.phone` không tái dùng `normalizePhoneNumber`; `setInterval` bị tạo lại mỗi giây theo deps `countdown`; comment cũ ở `publicCatalog.ts:5`; nhiều block CSS chết của section cũ. |
| `P3-FE-08` | `FE2A-17` | `shared/i18n/language.ts:57-76`, `shared/api/client.ts:29-40` | Mỗi component dùng `useI18n`/`useCurrentUser` tự gắn 1 `window.addEventListener('storage')` riêng. Gom về 1 listener duy nhất ở cấp module. |
| `P3-FE-09` | `FE2A-18` | `shared/i18n/language.ts:125-262`, `sourceText.ts:77-83` | Mã chết `useDomLanguageSync` + `MutationObserver` (138 dòng, chứa label Shop/Body-metrics cũ & xung đột `'Hội viên'`) và hàm chết `sourceNotify`. Xóa bỏ để giảm bundle. |
| `P3-FE-10` | `FE2A-19` | `shared/i18n/publicLabels.ts`, `translations.ts` | ~390 khóa từ điển chết của Shop/05 Zones/BMI/Streak, 1 khóa đầu khoảng trắng không khớp (`translations.ts:99`), 2 khóa dính `\r\n` (`publicLabels.ts:655-656`) và 5 khóa xung đột nghĩa giữa 2 file. |
| `P3-FE-11` | `FE2A-20` | `shared/i18n/language.ts:87-89, 288, 294` | Regex kiểm tiếng Việt bắt nhầm chữ `Ö` trong `SÖL`; `vi.replace(key, translated)` dễ bị lỗi với `$&`/`$1`; `toggleLanguage` không bọc `useCallback`. |
| `P3-FE-12` | `FE2A-21` | `client.ts:105`, `centerTime.ts:29, 61-76`, `recurrence.ts:2`, `errorMessage.ts:6`, `imageUpload.ts:31-77`, `purchaseIntent.ts:6`, `routeErrors.ts:2`, `disciplines.ts:14` | `ApiError` bỏ qua `body?.details`; `Intl.DateTimeFormat`/`NumberFormat` không cache; `formatTimeRange(null,null)` ra `"—–—"`; `addDays` nổ `RangeError` với input rỗng; `selectedPackageId` nhận `"1e2"`; `isModuleLoadError` bỏ sót lỗi preload CSS; 2 export chết ở `disciplines.ts`. |
| `P3-FE-13` | `FE2A-22` | `shared/liquid-glass/liquid-glass.css:10, 17-22, 30-35` | Thiếu màu nền đục dự phòng trong `@media (prefers-reduced-transparency: reduce)` và còn class chết `.glass-container-circle` / hook WebGL cũ. |
| `P3-FE-14` | `FE2B-17` | `shared/ui/clickRipple.ts:5-22` | Đổi `prefers-reduced-motion` giữa phiên để lại `<span class="click-ripple">` rác trong DOM; thiếu `aria-hidden` & kiểm tra `aria-disabled`. |
| `P3-FE-15` | `FE2B-18` | `shared/ui/RoleGuard.tsx:10-20` | Nhận `allowedRoles: string[]` không chuẩn hóa alias `RECEPTIONIST`/`CENTER_MANAGER`. Ép kiểu theo `UserSession['role']` hoặc dùng hàm chuẩn hóa chung. |
| `P3-FE-16` | `FE2B-19` | `shared/ui/ConfirmDialog.tsx:19-51` | Unmount không resolve Promise (`false`) và thiếu `role="alertdialog"` + `aria-describedby`. |
| `P3-FE-17` | `FE2B-20` | `dark-volt.css:78`, `popoverPlacement.ts:13-21`, `ThemeToggle.tsx:45-53`, `loading-skeleton.css:10`, `route-state.css:6` | Selector chết `.ui-select__trigger.is-open`; `popoverPlacement` quên kẹp `dialog.left`; click nhanh `ThemeToggle` xóa sớm `data-theme-vt`; selector `:root[data-theme='dark']` lệch `:root:not([data-theme='light'])`. |
| `P3-FE-18` | `FE2B-21` | `PortalShell.tsx:256-278`, `file-picker.css:12-66`, `portal-shell.css:1688`, `theme.css:37-167` | Gọi thừa `GET /wallet/my` cho non-member (Admin/Manager/Staff/Coach); `file-picker.css` thiếu fallback token; `.portal-dialog__close:hover` bị triệt tiêu; lặp `#a35b49` thay cho `var(--sol-accent-text)`. |
| `P3-FE-19` | `FE3-21` | `ClassFormModals.tsx:451-464, 1124, 1300-1413`, `ClassSessionDetailModal.tsx:131` | Thứ tự ưu tiên `disciplineConflict` vs `SCHEDULING_PAST_SESSION` ngược backend; prop thừa `classes` trên `EditClassModal`; `Reschedule`/`CancelSessionModal` thiếu `noValidate`/`min`; chớp `(0)` khi đang tải học viên. |
| `P3-FE-20` | `FE3-22 + E2E-1 P3-3` | `WeeklyTimetable.tsx:1, 437-454`, `timetable.ts:28, 153`, `calendar.css:53, 140`, `classesApi.ts:256` | Phụ đề modal overflow gắn cứng thao tác của Manager dù dùng chung cho Coach; ngữ pháp `"1 sessions"`; còn hằng số cũ `6.25` (100/16) thay vì `20`; `12.5px` lệch thang chữ; wrapper chết `createSession` trong `classesApi.ts`. |
| `P3-FE-21` | `FE3-23` | `ManagerCatalogsPage.tsx:237-257, 615-776`, `UserManagerPage.tsx:445-466, 645`, `ManagerReportsPage.tsx:430-444` | `.portal-tabs` thiếu `role="tablist"`/`role="tab"`/`aria-selected` & `.portal-tab-count`; nút xóa dùng `btn-secondary` thay `btn-danger btn-sm`; nút chọn nhanh ngày báo cáo dùng style inline thay `btn-secondary btn-sm`. |
| `P3-FE-22` | `FE4-18` | `membershipApi.ts:113-136`, `walletApi.ts:28-55`, `VnpayReturnPage.tsx:1`, `member-packages.css:29-92`, `member-board.css:2-66` | Export chết `createPaymentRequest`/`createCashReceiptPayment`; `PortalShell` lặp lại `walletApi`; import rỗng ở `VnpayReturnPage`; padding thừa 98px trên modal kết quả gói; còn `translateY(-3px)` hover lift trái `DESIGN.md:99`. |
| `P3-FE-23` | `FE4-19` | `MemberCheckoutPage.tsx:250-269, 408-426`, `MemberProfilePage.tsx:114-223, 632`, `MemberCardPage.tsx:213`, `VnpayPayButton.tsx:116`, `member-invoices.css:3-13`, `member-checkout.css:93-107` | Dùng `.spinner` thay `LoadingSkeleton`, thiếu Retry & viền khung KYC mờ ở Light mode; thiếu `tabular-nums` trên số tiền hóa đơn/checkout; `handleUnlock` dùng state thay ref; `MemberProfilePage` lưu 2 bước không xử lý lỗi bán phần. |
| `P3-FE-24` | `FE5-20` | `ActiveTrainingPlan.tsx:26, 53`, `MemberCoachBookingView.tsx:878`, `QrCameraScanner.tsx:88`, `MemberCalendar.css:10-22`, `MemberGroupClassesView.tsx:45`, `memberClassesApi.ts:29-140`, `MemberCardPage.tsx:18, 159`, `MemberClassesPage.tsx:43` | Tự format ngày thay vì `formatCenterDate`; gộp mọi lỗi camera làm 1 thông báo; CSS/export chết & JSDoc cũ nhắc `Pilates`; `QuotaDto.tier` thiếu `\| null`; tablist thiếu `aria-controls`/`tabpanel`. |
| `P3-FE-25` | `FE6-21` | `coach-training-plan.css:191-204`, `coach-attendance.css:334-460`, `coach-classes.css:760-905`, `TrainingPlanResults.tsx:6`, `coachingApi.ts:65`, `CoachSavedPlansPage.tsx:13`, `ptSearch.ts:4`, `ptAttendanceApi.ts:11`, `PtAttendancePage.tsx:73` | Hàng trăm dòng CSS chết của tính năng Đánh giá buổi tập cũ & animation vô hạn `.ai-pulse-orb`; lặp tiêu đề `"Giáo án đã lưu"`; regex dấu nguyên gốc Unicode thay vì `\u0300-\u036f`; `Date.now()` có thể trùng ID trong 1ms; chưa có nút "Lưu nháp" trên giao diện soạn giáo án. |
| `P3-FE-26` | `FE7-21` | `StaffReceptionPage`, `StaffCheckInPage`, `HoldManagementPage`, `MembershipRequestHistory`, `WalletTopupHistory`, `GateQrPanel`, `Staff/ManagerInternalRequestsPage`, `AdminAuditLogsPage`, `UserManagerPage` | Thiếu `font-variant-numeric: tabular-nums` trên cột số tiền, bộ đếm ngược QR, ID và mốc thời gian (`DESIGN.md:50`). |
| `P3-FE-27` | `FE7-22` | `StaffCheckInPage.tsx:295`, `UserManagerPage.tsx:445-689`, `ManagerInternalRequestsPage.tsx:187, 490`, `KycReviewPage.tsx:65-68, 146` | Thiếu `role="tablist"`/`tab`/`aria-selected`, thiếu `aria-label`/`htmlFor` trên vài ô lọc, lỗi trống lý do từ chối KYC hiện tận đầu trang thay vì dưới ô nhập và nút Hủy không khóa khi `busyId !== null`. |
| `P3-FE-28` | `FE7-23` | `features/admin/AdminAuditLogsPage.tsx:127-142` | `totalEnrolled` kẹp theo `capacity` lệch với từng dòng hiển thị; hiện tên `"Lớp công suất cao nhất"` kể cả khi mọi lớp đều 0%. |
| `P3-FE-29` | `FE7-24` | `HoldManagementPage`, `StaffReceptionPage`, `StaffCheckInPage`, `GateQrPanel`, `StaffInternalRequestsPage`, `KycReviewPage` | Dùng `.portal-input` thay `.portal-textarea`, dính chữ `"Ra:14:05:00"`, `alt` QR cổng check-out vẫn ghi check-in, gọi `t()` hai lần, thiếu guard/fallback cho `openDocument` và `notify` thiếu `sourceMessage`. |
| `P3-FE-30` | `FE8-11` | `ChatWidget.tsx:19`, `ChatPage.tsx:37-39, 60, 200, 221`, `ChatThread.tsx:104`, `AiChatThread.tsx:130`, `StaffSupportChat.tsx:193, 214, 240` | Chuỗi `"Bấm làm mới..."` sai vì widget không có nút làm mới và tự poll 4s; lỗi số ít/nhiều EN (`"1 days"`, `"1 unread messages"`); trộn Anh-Mỹ `centre`/`center`; Manager thấy chữ `"giúp lễ tân"`; `StaffSupportChat` không dịch tiền tố `[Gói tập]` ở EN. |
| `P3-FE-31` | `FE8-12` | `MemberSupportChat.tsx:250`, `support-chat.css:36`, `ChatContacts.tsx:53`, `chat.css:60, 225`, `chat-widget.css:716-736` | `.support-chat__closed` không có padding bị dính mép; `ChatContacts` thiếu class `.direct-chat__error`; `/messages` dùng `scrollbar-width: thin` lệch `DESIGN.md:125`; còn selector chết `.is-ready:not([data-glass-stale])`. |
| `P3-FE-32` | `FE8-13` | `ChatThread.tsx:22, 54-61, 89-99`, `ChatAvatar.tsx:18`, `ChatWidget.tsx:149` | Thả tim `likedIds` mất khi đổi hội thoại, double-click chọn từ kích hoạt thả tim, icon tim thiếu `aria-hidden`; ảnh avatar thiếu fallback `onError`. |

### 7.2. Backend, Database & i18n `P3-Low` (22 mục)

| Mã | Nguồn | Vị trí (File & Dòng) | Tóm tắt vấn đề & Hướng xử lý |
|---|---|---|---|
| `P3-BE-01` | `BE1A-18` | `JwtService.java:24-48`, `JwtAuthenticationFilter.java:70, 85-89`, `application.yml:81` | JWT 24h thiếu claim `iss`/`aud`/`jti`, chưa kiểm `expirationMs > 0`, chưa có blacklist khi đăng xuất; so sánh `changedAt` nên tự `.truncatedTo(SECONDS)` và dùng `Locale.ROOT`. |
| `P3-BE-02` | `BE1A-19` | `ScmsApplication.java:36-59`, `pom.xml:120-124` | `loadDotEnv()` không bóc dấu ngoặc `'...'`/`"..."` hay tiền tố `export ` (trái `docs/DOCKER_COMPOSE.md:31`) và chồng chéo `spring-dotenv`. |
| `P3-BE-03` | `BE1A-20` | `application.yml:20-22, 72, 108-110`, `AsyncConfig.java:24-33`, `apps/api/Dockerfile:12, 28`, `CenterCheckinSchemaUpgrade.java:60-64`, `GoogleIdTokenVerifierAdapter.java:121-133` | `app.vnpay.payment-url` cứng sandbox không có env placeholder; mật khẩu demo mặc định yếu `Demo@12345`; `notificationTaskExecutor` thiếu graceful shutdown; `Dockerfile` giữ `-XX:TieredStopAtLevel=1` từ Render cũ & chưa cache layer Maven; `CenterCheckinSchemaUpgrade` thiếu `SET LOCAL lock_timeout`; `GoogleIdTokenVerifierAdapter` gửi `access_token` qua query string. |
| `P3-BE-04` | `BE1B-13` | `RoleService.java:45-74`, `Role.java:34` | `Role.permissions` chưa khởi tạo `new HashSet<>()` (dễ NPE trong `getPermissionsByRoleId`); không chặn cấp `USER_MANAGE`/`ROLE_MANAGE` cho `CENTER_MANAGER` hoặc thu hồi hết quyền `ADMIN` (bị `IdentitySeeder` hoàn tác khi restart). |
| `P3-BE-05` | `BE1B-14` | `UpdateProfileDto.java`, `ErrorResponse.java`, `ApiError.java`, `UserService.java:527`, `UserRepository.java:84`, `ProfileService.java:93-434`, `ApiResponse.java:26, 37`, `KycCrypto.java:31` | 3 lớp DTO/Error chết; `cleanupInactiveUsers` dùng denylist thay allowlist `MEMBER`; `findAllByCompactPhoneIn` quên lọc `(` và `)`; `ProfileService` & `ApiResponse` dùng `LocalDateTime.now()` thay `Clock`/`CenterTime.ZONE`; `KycCrypto` chưa từ chối chuỗi secret rỗng. |
| `P3-BE-06` | `BE2-24` | `CatalogRequests.java:50`, `ClassService.java:81, 511, 535`, `EnrollmentService.java:523, 902, 978, 1058`, `MemberFavoriteDisciplineController.java:55, 85` | `PackageRequest.tier` trỏ nhầm key lỗi của `room_tier`; nhiều chuỗi cứng VI/EN trong `ClassService`/`EnrollmentService` không qua `MessageService`; `MemberFavoriteDisciplineController` gọi nhầm `getMessage` thay `getMessageOrDefault`. |
| `P3-BE-07` | `BE2-25` | `ClassService.java:365-381, 1560-1614`, `ClassSessionService.java:85, 133`, `SessionCompletionScheduler.java:50`, `GymClassRepository.java:24-27`, `ClassEnrollmentRepository.java:56`, `PackageBenefits.java:145` | `getSessionStudents` lệch filter `completed` giữa enrollment & session booking; `updateClass` đòi phòng/HLV active ngay cả khi đang lưu trữ lớp; `ClassSessionService.cancelSession` thiếu `@Audited` & `Clock`; cron thiếu `zone`; 2 hàm repo chết/rủi ro; `PackageBenefits.hasDatedHold` bỏ sót bảo lưu sau nâng cấp. |
| `P3-BE-08` | `BE3-19` | `SessionEvaluationService.java:78-122`, `HealthMetricService.java:42-219`, `CoachReviewService.java:120` | Lỗi tiềm ẩn trong các dịch vụ đang tắt cờ mặc định (0 ảnh hưởng hiện tại): thiếu kiểm tra quyền sở hữu khi tạo evaluation, `updateMetric` vượt kiểm tra hạng Platinum, và `CoachReviewService` dùng `LocalDateTime.now()`. |
| `P3-BE-09` | `BE3-20` | `coaching/service/CoachAssignmentService.java:151, 349-357` | `totalCoaches` gán cứng bằng `activeCoaches`; `removeAssignment()` không ghi `AuditLog` và không gửi thông báo cho hội viên. |
| `P3-BE-10` | `BE3-21` | `CoachBookingController.java:39-175`, `CoachBookingService.java:180-714`, `CoachBooking.java:73`, `SessionAttendanceService.java:104` | Gọi nhầm `getMessage(key, fallback)` thay `getMessageOrDefault`; 6 chỗ ném `ResourceNotFoundException("Coach"/"Member"/"CoachBooking")` không dịch sang tiếng Việt; `getAttendance()` chạy N+1 `gateCheckinFor`; `CoachBooking.createdAt` & constructor 5 tham số `SessionAttendanceService` không dùng `CenterTime.ZONE`. |
| `P3-BE-11` | `BE4-22` | `WalletController.java:37-64`, `Wallet.java:21`, `Payment*Dto`, `Invoice*Dto`, `CancellationDtos` | Thiếu `@Digits` giới hạn phần thập phân/nguyên (có thể gây lệch làm tròn Java vs DB hoặc overflow 500); bảng `wallets` thiếu `@Check(balance >= 0)` và `wallet_transactions` thiếu unique index `(wallet_id, reference_id)`. |
| `P3-BE-12` | `BE4-23` | `InvoiceService.java:56-91, 137-190, 229`, `PaymentService.java:792-807`, `VnpayPaymentService.java:177, 420` | `createInvoice` thủ công cho xuất hóa đơn cho payment `pending` và không đối chiếu `subtotal + tax == amount`; `autoIssueInvoiceForPayment` chạy cùng transaction `REQUIRED` nên lỗi DB trùng số hóa đơn `UUID(0,6)` có thể làm hỏng cả transaction cha dù đã `catch`. Đổi sang `REQUIRES_NEW` / `afterCommit`. |
| `P3-BE-13` | `BE4-24` | `membership/service/MembershipCancellationService.java:141-145, 260-262` | Duyệt hủy gói không xóa `holdStatus`/`holdDaysCredited` (gói đã hủy vẫn hiện ở `listHolds("APPROVED")`); `staffRequest` bỏ qua kiểm tra khớp `memberId` khi có `subscriptionId`. |
| `P3-BE-14` | `BE4-25` | `PaymentService.java:243-246`, `VnpayPaymentService.java:277, 409, 494`, `VnpayTransactionRepository.java:70-75` | Biên lai tiền mặt bị từ chối (`failed`) trên gói mới chặn vĩnh viễn hội viên tự thanh toán lại; giao dịch VNPay trễ đã hoàn ví vẫn bị đếm thành cảnh báo bất thường `successAttemptUnpaid`. |
| `P3-BE-15` | `BE4-26` | `MembershipSubscriptionService.java:735-743, 1146-1161`, `MembershipSubscriptionController.java:206-212` | Tệp y tế bảo lưu chỉ kiểm tra header `Content-Type` (không kiểm magic bytes) và trả `ContentDisposition.inline()`; duyệt bảo lưu muộn kẹp `holdStart = today` nhưng không kiểm lại `heldDays >= 3` (tốn mất lượt bảo lưu chỉ cho 1 ngày). |
| `P3-BE-16` | `BE5-17` | `operations/service/StaffInternalRequestService.java:144-148, 207, 313-314` | Nhồi trực tiếp enum `COACH`/`LEAVE`/`SHIFT_EXCHANGE` vào thông báo tiếng Việt, định dạng ngày lẫn `yyyy-MM-dd` với `dd/MM/yyyy`, thiếu `@Audited` cho duyệt/hủy đơn nội bộ. |
| `P3-BE-17` | `BE5-18` | `AuditAspect.java:222`, `AuditService.java:47`, `UserService.java:570` | `currentIp()` chưa cắt tối đa 45 ký tự; `getAuditLogs` không chặn `from > to`; `scheduleInactiveUsersCleanup` ghi log audit trống `entityId/old/new = null`. |
| `P3-BE-18` | `BE5-19` | `reports/service/RevenueReportService.java:58-59, 83-84, 123` | Inject thừa 2 repository không dùng (`gymClassRepository`, `classEnrollmentRepository`) và không làm tròn `renewalRate` (IEEE-754 double lẻ dài). |
| `P3-BE-19` | `BE6-16` | `ChatConversationRepository.java:15`, `ChatMessageRepository.java:41`, `AiChatProvider.java:54` | Đổi vai trò user giữa `MEMBER` và `COACH`/`RECEPTIONIST` để lại `unreadTotal > 0` kẹt mãi không đọc được; `AiChatProvider.readDotEnv` không bóc ngoặc kép/đơn. |
| `P3-BE-20` | `BE6-17` | `AiChatController.java:80, 125`, `AiChatService.java:169, 236`, `SecurityConfig.java:119`, `NotificationScheduler.java:46`, `Notification.java:25`, `NotificationService.java:233`, `SessionCancelledEvent.java` | Endpoint `GET` của AI chat trả sai message key `created`/`sent`; tạo phiên AI chưa giới hạn tần suất / chưa khóa cho staff; `Notification.title` chưa cắt 150 ký tự; mã chết `dispatchMultiChannel` & `SessionCancelledEvent` không có listener. |
| `P3-BE-21` | `BE7-15 + E2E-1 P3-4` | `apps/api/src/main/resources/i18n/messages*.properties` | Key cũ `error.scheduling.discipline_class_exists` còn nói 1 lớp/bộ môn; VI thiếu loại `"Khác"` trong `error.operations.request.invalid_type`; lẫn từ tiếng Anh/enum trong VI (`capacity`, `Username`, `active`, `confirmed`, `KYC`, `đơn hàng`); 8 key EN + 1 key VI chứa nháy đơn `'` chưa escape (an toàn hiện tại do 0 arg nhưng dễ gãy nếu bật `always-use-message-format`). |
| `P3-BE-22` | `BE7-16` | `GlobalExceptionHandler.java:272-278`, `postgresql-triggers.sql:302-305` | `trg_checkins_check_membership` ánh xạ nhầm câu báo lỗi *"trước khi đặt lịch"* thay vì `invariant.membership_inactive_or_expired` và chỉ khai báo `BEFORE INSERT` (chưa chặn `UPDATE`). |

### 7.3. Build, Bundle & Test Hygiene `P3-Low` (2 mục)

- **`P3-E2E-01` `[E2E-3 #12]` — Cảnh báo biên dịch & log test thừa:** 20 chỗ `@MockBean` deprecated (đổi sang `@MockitoBean`), 3 cảnh báo MapStruct unmapped (`UserMapper.java:14`, `PaymentMapper.java:42, 54`), 2 cảnh báo `PostgreSQLDialect` thừa, 1 cảnh báo `PageImpl` serialization; FE còn 1 duplicate fixture key (`publicCatalog.test.tsx:186, 194`), 6 file test cảnh báo `act(...)`, 15 file test `explore3d/__tests__` ngủ đông gây nhiễu stderr `THREE_CJS_DEPRECATED`, và 5 báo cáo Surefire cũ của module `courts` sót trong `target/surefire-reports/` khi chưa chạy `mvnw clean`.
- **`P3-E2E-02` `[E2E-3 #12]` — Đặt tên chunk `@supabase/supabase-js`:** Trong `apps/web/vite.config.ts:37-61`, gói `@supabase/supabase-js` (214,38 kB) đang tách thành chunk vô danh `dist-*.js`; nên gom tường minh thành `supabase-vendor` để dễ theo dõi dung lượng bundle.

---

## 8. Các Hạng Mục Đã Xác Minh Đạt Chuẩn (Verified Clean Checks)

1. **Đối soát hợp đồng API & Route (`E2E-1`, `E2E-2`):** 222/222 lời gọi FE khớp 100% endpoint đang hoạt động trên BE; 0 lời gọi chạm tính năng tắt cờ; 0 link chết; 0 trang mồ côi; sidebar đủ 5 vai trò khớp chuẩn `DESIGN.md` (0 lối vào 3D/Shop/Courts/Equipment/Reviews/Streak/Body-Metrics).
2. **Hệ thống 5 Slot cố định & Bỏ nghỉ liên tiếp HLV (`BE-2`, `BE-3`, `BE-7`, `FE-3`, `FE-5`, `FE-6`, `E2E-2`):** Đúng 5 khung giờ `07:00–09:30`, `09:45–11:15`, `11:30–14:00`, `14:15–16:45`, `17:00–19:30` đồng bộ 100% giữa `ScheduleSlot.java`, `postgresql-triggers.sql`, `slots.ts` và UI; gỡ sạch `coach_rest`/`requiresCoachRest` và `courts`; 0 nút `+ Thêm buổi`; 0 viền trái 4px trên `WeeklyTimetable` & `MemberCalendar`; tên HLV hiển thị rõ dưới tên phòng.
3. **Bảo mật cốt lõi & Mật mã (`BE-1A`, `BE-1B`, `BE-4`, `BE-6`, `FE-1`, `FE-4`, `FE-8`):**
   - `BCryptPasswordEncoder` + `PasswordPolicy` (8–50 ký tự chữ+số, không khoảng trắng) + tự động thu hồi JWT cũ khi đổi/reset mật khẩu (`passwordChangedAt`).
   - `JwtService` (JJWT 0.12.5) kiểm chữ ký HMAC ≥256-bit, chống `alg: none`; `GoogleOAuthRedirectService` có CSRF `state` 256-bit single-use + PKCE S256 + handoff qua `#fragment` + `Cache-Control: no-store`.
   - `VNPay` kiểm HMAC-SHA512 bằng `MessageDigest.isEqual`, đối chiếu số tiền `BigDecimal`, chống replay IPN bằng `gateway_transaction_no UNIQUE` + `lockMember`; khóa bi quan `FOR UPDATE` chống chi tiêu âm/trùng trên ví hiện hữu; bảo vệ chống IDOR triệt để trên hóa đơn/PDF, chat trực tiếp, phiếu hỗ trợ, thông báo và phiên SÖL AI.
   - `GateQrService` (`SOL:GATE:`) và `DynamicQrService` (`DYN:`) dùng HMAC-SHA256 thời hạn 60s tách miền rõ ràng, chống passback & tự checkout sau 8h.
   - `KycCrypto` mã hóa AES-256-GCM với IV 12-byte ngẫu nhiên, không rò rỉ `passwordHash`/`citizenIdEncrypted`/`googleSub` ra DTO; 0 controller trả trực tiếp JPA `@Entity`; 0 XSS (`dangerouslySetInnerHTML`/`eval`) trên toàn bộ Frontend.
   - Chống Open Redirect trên `purchaseIntent.ts`, chống SQL Injection bằng JPA Criteria/parameterized queries, và chỉ dùng duy nhất profile `supabase` + driver PostgreSQL (không có H2/MySQL/SQL Server).
4. **Đa ngôn ngữ & Chuẩn giao diện (`BE-7`, `FE-1`–`FE-8`, `E2E-1`, `E2E-2`):**
   - 3 file `messages*.properties` cân bằng tuyệt đối **1.105/1.105/1.105 key**, 0 key thiếu, 0 key trùng, 0 lệch chỉ số `{0}/{1}`, 0 thuật ngữ cấm (`citizen ID`, `national ID`, `CCCD`) trong bản tiếng Anh backend & các từ điển chuẩn FE.
   - 0 màu Volt `#c8fa3c` sót lại; 0 `transition: all`; 0 tràn ngang trên `1440×900` và `390×844`; 0 lỗi console/page error khi lướt toàn bộ 5 portal trên Chromium thực; PWA Service Worker không cache `/api/*` hay request chứa `Authorization`.

---

## 9. Phụ Lục: Ma Trận Bao Phủ 100% Của 20 Sub-Agent Kiểm Toán

| Sub-Agent | Phạm vi kiểm toán | Số file đã đọc kiểm | Phát hiện thô (`P0 / P1 / P2 / P3`) |
|---|---|---:|---|
| **`FE-1`** | App Router, Auth, Landing, Sport Pages, PWA, Global CSS | 30 | `0 / 5 / 12 / 7` |
| **`FE-2A`** | Shared API Client, i18n Dictionaries, Shared Libs, Liquid Glass | 23 | `0 / 3 / 13 / 6` |
| **`FE-2B`** | Shared UI Kit (`Modal`, `Select`, `Date/Time/FilePicker`, `Toast`, `Theme`) & Portal Shell | 40 | `0 / 6 / 10 / 5` |
| **`FE-3`** | Classes, 4-Step Wizard, Schedule Grid & Manager Portal | 24 | `1 / 8 / 11 / 3` |
| **`FE-4`** | Payments/VNPay, Wallet & Member Core (Dashboard, Packages, Checkout, Card, Invoices, Profile, Hold) | 43 | `1 / 8 / 8 / 2` |
| **`FE-5`** | Member Calendar, Group Classes, PT 1:1 Booking, Training Plans & QR Check-in | 23 | `1 / 12 / 6 / 1` |
| **`FE-6`** | Coach Portal (Classes, Group Attendance, PT Attendance, Training Plans, Saved Plans, AI Plan) | 19 | `1 / 13 / 6 / 1` |
| **`FE-7`** | Reception Desk, Check-in/Out, KYC Review, Hold Management, Operations & Admin Portal | 35 | `1 / 8 / 11 / 4` |
| **`FE-8`** | Direct Chat, Support Tickets, SÖL AI Widget & Realtime Sync | 22 | `1 / 4 / 5 / 3` |
| **`BE-1A`** | Security, Auth, OAuth/OTP, Config, YAML, Docker, Compose & Nginx | 56 | `2 / 6 / 9 / 3` |
| **`BE-1B`** | Users, Roles, Profiles, KYC Crypto/Review & Common Infra (`GlobalExceptionHandler`, `ScheduleSlot`, i18n) | 55 | `0 / 6 / 6 / 2` |
| **`BE-2`** | Scheduling (Classes/Sessions/Enrollments/Bookings), Facilities, Public Catalog & Seeders | 59 | `4 / 9 / 10 / 2` |
| **`BE-3`** | Coaching (PT 1:1, Training Plans, Assignments), Attendance (Gate QR, Group, Course) & Health Gate | 79 | `1 / 7 / 10 / 3` |
| **`BE-4`** | Membership (Subscriptions, Hold, Trial, Cancellation), Finance (Payments, Invoices, VNPay, Reconciliation) & Wallet | 82 | `3 / 7 / 11 / 5` |
| **`BE-5`** | Reception Lookup, Staff Operations Requests, Revenue/Utilization Reports & Audit Logging | 31 | `1 / 10 / 5 / 3` |
| **`BE-6`** | SÖL AI Chat & RAG, Direct Chat, Support Requests & Multi-Channel Notifications | 80 | `0 / 7 / 8 / 2` |
| **`BE-7`** | PostgreSQL Triggers (`postgresql-triggers.sql`), 3 i18n Bundles, `sol-knowledge.md`, Shop Flag Isolation (51 file) & 24 OpenAPI Specs | 87+ | `1 / 8 / 5 / 2` |
| **`E2E-1`** | Đối soát tĩnh 222 FE calls ↔ 334 BE endpoints, 44 Routes, Security/DESIGN.md & 24 QA scripts | Toàn kho | `0 / 2 / 4 / 4` |
| **`E2E-2`** | Kiểm thử trình duyệt Chromium thực (`playwright-core`) — 48 lượt Public/Auth + 18 Redirects + 5 Role Portals + Wizard 4 bước | Build `dist` | `1 / 0 / 3 / 1` |
| **`E2E-3`** | Chạy đầy đủ Vitest (1.173 test), ESLint, TSC, Vite Build, Maven (1.561 test) & Phân tích 38 Postgres skipped tests | 358 file test | `1 / 5 / 5 / 1` |
| **TỔNG CỘNG** | **100% mã nguồn hoạt động + CSDL + Hợp đồng + Test thực thi** | **~1.150+ file** | **Thô: `20 / 134 / 158 / 60` (372) → Khử trùng: `16 / 125 / 143 / 56` (340)** |


---

## 10. Trạng Thái Khắc Phục Toàn Hệ Thống (Remediation Summary — 26/11/2026)

Toàn bộ các đợt sửa lỗi (**Wave 0 → Wave 3**) đã được triển khai trên nhánh `fix/full-system-audit-remediation`, kiểm chứng xanh 100% qua Maven, Vitest, ESLint, TypeScript, Vite production build và kiểm thử trình duyệt Chromium thực (`playwright-core`):

| Đợt | Commit | Quy mô thay đổi | Phạm vi đã khắc phục |
|---|---|---|---|
| **Baseline** | `c0af6a26` | 1 báo cáo kiểm toán | Tổng hợp 340 lỗi khử trùng từ 20 sub-agent (`16 P0 / 125 P1 / 143 P2 / 56 P3`). |
| **Wave 0** | `b93488ea` | 82 file (`+4.560 / -427`) | **16/16 `P0-Critical`** (Wizard Bước 3→4, thanh toán ví khóa học, quầy Lễ tân thu học phí khóa học, chống nạp ví bằng ví, đồng bộ trạng thái lớp `active\|inactive\|archived`, `/coach/classes` bỏ `coachId` string, cô lập phiên Chat/Realtime, OAuth/OTP security & HikariCP deadlock, toán học bảo lưu/nâng cấp, khóa VNPay expiry & PT expiry, `@Transactional` `SessionCompletionScheduler`, thu hẹp `LegacyScheduleSlotResetRunner`, `AuditLogWriter` `afterCommit`, sửa 3 suite Postgres + thêm job `test-api-postgres` vào CI). |
| **Wave 1** | `66245575` | 223 file (`+10.482 / -1.778`) | **Toàn bộ nhóm Backend `P1-High` (`P1-BE-01`..`57`) & `P2-Medium` (`P2-BE-01`..`60`)**, bao gồm `SmartLifecycle` + `/api/v1/health` readiness (`P1-BE-06`), `ResendOtpDeliveryAdapter` (`P2-BE-09`), bảo mật `SecurityConfig`/KYC/Avatar/OAuth/Trial/Wallet/VNPay/Shop flag isolation, 22 trigger PostgreSQL (thêm `trg_classes_check_session_conflict`, `SET search_path`, RLS `TO PUBLIC`), đồng bộ 3 file `messages*.properties` và 24 hợp đồng OpenAPI. |
| **Wave 2** | `9cfb6306` | 256 file (`+14.163 / -4.996`) | **Toàn bộ nhóm Frontend `P1-High` (`P1-FE-01`..`65`), `P2-Medium` (`P2-FE-01`..`80`) & `P3-Low`** trên cả 9 phân hệ (Router/Auth/Landing/PWA, Shared API/i18n/Libs/LiquidGlass, Shared UI/PortalShell/Theme/Toast Top-Layer, Classes/Schedule/Manager + xóa `RoomDayTimetable` chết, Payments/Wallet/Member Core, Check-in/Calendar/Group Classes/PT 1:1 `"/ slot"`, Coach Portal/Attendance/Training Plan không còn BMI/bài mẫu cứng, Reception/Operations/Admin + `DocumentImageLightbox` + `useConfirm`, Chat/Support/Realtime contrast & Escape modal). |
| **Wave 3** | `b85183cd` | 42 file (`+3.451 / -130`) | **Test coverage, độ ổn định & `P3` cuối**: thêm 5 bộ test HTTP/Security MockMvc (+28 test bao phủ 11 controller còn thiếu `P1-E2E-02`/`P2-E2E-01`), chuyển sạch `@MockBean` → `@MockitoBean`, xóa toàn bộ cảnh báo MapStruct & Hibernate Dialect (`P3-E2E-01`), hardening `P3-BE-04/05/11/12/13/16/18/22`, tách chunk `supabase-vendor` (`P3-E2E-02`), thêm +11 test Bộ môn/Phòng cho `ManagerCatalogsPage` (`P2-E2E-02`), đóng băng đồng hồ cho toàn bộ test nhạy nửa đêm BE & FE (`P2-E2E-03`), và tạo + chạy bộ kiểm thử Chromium thực `scripts/qa/e2e_audit_remediation_verify.mjs` (`P1-E2E-03`). |

### Bằng Chứng Kiểm Định Cuối Cùng (Verified Clean)

- **Backend Maven (`cd apps/api && ./mvnw clean test`):** **1.797 test run, 0 fail, 0 error**, 40 skipped (Postgres-conditional tests đã được kích hoạt trong CI `test-api-postgres`) — tăng **+236 test mới** so với mốc kiểm toán ban đầu (`1.561`). **0 cảnh báo MapStruct, 0 cảnh báo `@MockBean`, 0 cảnh báo Hibernate dialect.**
- **Frontend Vitest (`cd apps/web && npm test -- --run`):** **157/157 file test, 1.409/1.409 test pass** — tăng **+236 test mới** so với mốc kiểm toán ban đầu (`1.173`).
- **Frontend Lint, TypeScript & Production Build:**
  - `npm run lint` (`eslint . --max-warnings=0`): **0 lỗi, 0 cảnh báo**.
  - `tsc -p tsconfig.app.json --noEmit` & `tsc -p tsconfig.node.json --noEmit`: **0 lỗi**.
  - `npm run build` (`tsc -b && vite build`): **thành công** (425 module, tách tường minh `dist/assets/supabase-vendor-*.js`).
- **Real Chromium Playwright E2E (`node scripts/qa/e2e_audit_remediation_verify.mjs`):** **8/8 kịch bản PASS** trên `apps/web/dist` (S1 Public/Dark contrast/Retired sports redirect, S2 Login `?expired=1`/anti-reflection, S3 Wizard 4 bước `P0-01`, S4 Member redirects/5-slot PT `"/ slot"`/Wallet checkout, S5 Coach `/coach/classes` + `IN_PROGRESS` + Training Plan sạch, S6 Reception `"Khóa học"` + `useConfirm`, S7 Admin Audit Logs mobile scroll + xóa Shop dropdown, S8 Chat Widget Escape & session isolation) — **0 console error, 0 page error, 0 tràn ngang** ở cả `1440×900` và `390×844` (Light & Dark).
- **Knowledge Graph:** Đã chạy `graphify update .` cập nhật đồng bộ `graphify-out/` (`19.057` node, `63.499` cạnh).
- **Ghi chú vận hành bảo toàn tương thích ngược:** `P2-BE-03` (`APP_QR_SECRET` & `APP_TRIAL_CCCD_PEPPER`) đã được tách tài liệu khuyến nghị cấu hình độc lập trong `compose.env.example` mà giữ fallback tương thích với cấu hình 4 biến tối thiểu trên VPS hiện hữu; các test PostgreSQL sống chạy trên service container `postgres:16` trong job `test-api-postgres` của `.github/workflows/pipeline.yml` (máy macOS chạy audit không cài Docker Engine cục bộ).
