# Bàn giao: Trang đối soát thanh toán cho Admin

> Dành cho coding agent tiếp nhận. Đọc trước: `AGENTS.md`, `docs/rules/backend-architecture.md`, `DESIGN.md`, `docs/PROJECT_MASTER_GUIDE.md`.
> Ngày lập: 13/11/2026. Trạng thái: **đã triển khai** (13/11/2026, xem mục 8). Jira: chưa có ticket — đề xuất tạo `SCRUM-136` (xác nhận với nhóm trước khi mở PR, ghi key vào mô tả PR).
> Làm trên nhánh/worktree riêng (ví dụ `feat/admin-payment-reconciliation`). Thư mục chính hay có phiên khác sửa song song; không commit file mình không sửa.

## 1. Bối cảnh và mục tiêu

Commit `bb497794` (fix/payment-resilience) làm hệ thống **tự xử lý** các sự cố thanh toán:

- VNPay xác nhận thành công **muộn** cho một lượt thanh toán mà khoản đó đã được trả cách khác (tiền mặt, Ví, lượt VNPay mới) hoặc đã đóng → tự cộng tiền vào Ví hội viên (`WalletService.creditLateGatewayPayment`, `wallet_transactions.reference_type = 'VNPAY_LATE_REFUND'`, `reference_id = '<vnp_TxnRef>:LATE_REFUND'`).
- Đơn shop đã hủy mà VNPay báo thành công muộn → hoàn vào Ví (`reference_type = 'ORDER_REFUND'`, `reference_id = 'ORDER_LATE_REFUND_<vnp_TxnRef>'`, xem `ProductOrderRefunds.refundLatePayment`).
- IPN lỗi tạm thời (lock timeout, lỗi DB, ví không khả dụng) → trả `99` để VNPay gửi lại; chỉ có **log server** (`VnpayIpnHandler`, `VnpayPaymentService`).
- Lượt VNPay bị bỏ dở → `VnpayExpiryScheduler` đóng sau `expires_at + 15 phút`.

Admin hiện **không nhìn thấy** những việc này. Mục tiêu: một trang **chỉ đọc** cho Admin để
1. biết có bao nhiêu tiền đã được hoàn tự động, cho ai, vì sao;
2. phát hiện giao dịch treo / IPN lỗi lặp lại / dấu hiệu job không chạy;
3. xem dòng thời gian đầy đủ của một khoản thanh toán khi hội viên khiếu nại.

## 2. Phạm vi

Trong phạm vi:
- Ghi lại kết quả mỗi lần nhận IPN / verify-return (bảng mới, code-first).
- API đọc cho Admin: tổng quan, danh sách lượt VNPay, danh sách hoàn tiền tự động, danh sách sự kiện IPN, dòng thời gian một khoản thanh toán.
- Trang `/admin/payments` trong portal Admin.

Ngoài phạm vi (không tự thêm):
- Không có nút "đánh dấu thành công", "hoàn tiền tay", sửa số dư — mọi thay đổi tiền vẫn chỉ đi qua luồng hiện có.
- Không gọi API truy vấn/hoàn tiền của VNPay (QueryDR/Refund) — ngoài MVP theo `AGENTS.md`.
- Không export PDF/Excel.
- Giám sát nạp ví tại quầy theo lễ tân là ticket riêng (đề xuất sau).

## 3. Quyết định mặc định (đổi nếu người dùng nói khác)

| # | Câu hỏi | Mặc định |
|---|---|---|
| D1 | Ai xem được | Chỉ `ADMIN` (`@PreAuthorize("hasRole('ADMIN')")`). Manager đã có trang Doanh thu riêng. |
| D2 | Khoảng thời gian mặc định | 7 ngày gần nhất, tối đa 92 ngày một lần lọc. |
| D3 | Lưu sự kiện IPN bao lâu | Không tự xóa trong ticket này. |
| D4 | Lưu gì từ IPN | Chỉ trường không nhạy cảm: `vnp_TxnRef`, `vnp_ResponseCode`, `vnp_TransactionStatus`, `vnp_TransactionNo`, `vnp_Amount`, mã đã trả lời, nguồn. **Không** lưu `vnp_SecureHash`, query string thô, IP khách. |
| D5 | Ngưỡng "treo" | Lượt `pending` có `expires_at + 15 phút < now` (cùng định nghĩa `VnpayPaymentGuard.isStale`). Còn tồn tại ⇒ scheduler không chạy. |

## 4. Backend

Package: `com.swp391.scms.finance` (đúng package-by-feature hiện có: `entity`, `repository`, `service`, `controller`, `dto`). Tuân thủ DTO, không trả entity, message qua `MessageService`, lỗi qua `GlobalExceptionHandler`.

### 4.1 Ghi sự kiện IPN

Entity mới `VnpayIpnEvent` → bảng `vnpay_ipn_events` (Hibernate `ddl-auto: update` tạo bảng; **không** viết migration/DDL tay):

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | bigint identity | |
| `reference` | varchar(32), null được | `vnp_TxnRef` (có thể rỗng/không hợp lệ khi request rác) |
| `source` | varchar(10) | `IPN` hoặc `RETURN` |
| `gateway_response_code` | varchar(2) | `vnp_ResponseCode` |
| `gateway_transaction_status` | varchar(2) | `vnp_TransactionStatus` |
| `gateway_transaction_no` | varchar(20) | `vnp_TransactionNo` |
| `amount` | numeric(12,2) | `vnp_Amount / 100`, null nếu không parse được |
| `rsp_code` | varchar(2) | mã hệ thống trả lại VNPay (`00`, `01`, `02`, `04`, `97`, `99`) |
| `received_at` | timestamp | giờ `Asia/Ho_Chi_Minh` qua `Clock` |

Index: `(reference, received_at)`, `(rsp_code, received_at)`.

Nơi ghi: `VnpayIpnHandler.handle(...)` — sau khi có `code`, gọi `VnpayIpnEventRecorder.record(source, params, code)`.
- `record` dùng `@Transactional(propagation = REQUIRES_NEW)` vì handler chạy **ngoài** transaction thanh toán và trường hợp `99` đã rollback.
- Bọc try/catch: ghi log thất bại **không bao giờ** được đổi mã trả lời IPN hay ném lỗi ra ngoài.
- `VnpayController.verifyReturn` gọi `ipn.process(params)` → cần truyền `source = RETURN`. Thêm overload `process(params, source)` / `handle(params, source)`; giữ chữ ký cũ (mặc định `IPN`) để test cũ không vỡ.

### 4.2 Truy vấn (repository + service `PaymentReconciliationService`, `@Transactional(readOnly = true)`)

Dùng JPQL/Specification; không native SQL trừ khi cần, và nếu có thì chỉ PostgreSQL.

1. **Tổng quan** trong `[from, to)`:
   - `staleAttempts`: số lượt `pending` quá ngưỡng D5 (không lọc theo ngày — luôn là hiện trạng).
   - `pendingAttempts`: số lượt `pending` chưa quá ngưỡng.
   - `lateRefunds`: số lượng + tổng tiền giao dịch ví có `reference_type = 'VNPAY_LATE_REFUND'` **hoặc** `reference_id LIKE 'ORDER_LATE_REFUND_%'`.
   - `ipnRetryable`: số sự kiện `rsp_code = '99'`; `ipnRejected`: `rsp_code in ('97','04','01')`.
   - `multiAttemptPayments`: số khoản thanh toán có ≥ 2 lượt VNPay.
   - `anomalies`: (a) lượt `success` mà payment không `success`/`refunded`; (b) payment `success` với `method = 'online_wallet'` nhưng không có lượt VNPay `success` **và** không có giao dịch ví `reference_id = 'WALLET_PAY_<paymentId>'`. Hai trường hợp này lý thuyết không được xảy ra; > 0 là lỗi cần điều tra.
2. **Danh sách lượt VNPay** (phân trang, lọc `status`, `stale=true`, `from/to` theo `created_at`, tìm theo `reference` hoặc email/SĐT hội viên). Cột: reference, paymentId, hội viên (tên, email), số tiền, trạng thái lượt, trạng thái payment, đối tượng (gói / PT / sân / đơn hàng / khóa học / nạp ví — suy ra từ các cột `*_id` của `Payment`, cùng logic `VnpayPaymentService.isWalletTopup`), `created_at`, `expires_at`, `gateway_transaction_no`, số lượt của payment đó.
3. **Danh sách hoàn tiền tự động** (phân trang, from/to). Cột: thời điểm, hội viên, số tiền, loại (`VNPAY_LATE_REFUND` / đơn hủy), reference VNPay (tách từ `reference_id`), paymentId (tìm qua `vnpay_transactions.reference`), trạng thái payment.
4. **Sự kiện IPN** (phân trang, lọc `rspCode`, `source`, `reference`, from/to).
5. **Dòng thời gian một payment** `paymentId`: thông tin payment + mọi lượt VNPay + mọi sự kiện IPN của các reference đó + giao dịch ví liên quan (`WALLET_PAY_<id>`, `<ref>:TOPUP`, `<ref>:DEBIT`, `<ref>:LATE_REFUND`, `ORDER_LATE_REFUND_<ref>`) + hóa đơn (nếu có), sắp xếp theo thời gian.

Giới hạn: `size` 1–100, `page ≥ 0`, khoảng ngày ≤ D2; vượt → 400 với message key mới.

### 4.3 Controller

`AdminPaymentReconciliationController`, `@RequestMapping("/api/v1/admin/payments/reconciliation")`, `@PreAuthorize("hasRole('ADMIN')")` ở cấp class:

| Method | Path | Trả về |
|---|---|---|
| GET | `/summary?from&to` | `ReconciliationSummaryDto` |
| GET | `/attempts?status&stale&q&from&to&page&size` | `Page<VnpayAttemptRowDto>` |
| GET | `/late-refunds?from&to&page&size` | `Page<LateRefundRowDto>` |
| GET | `/ipn-events?rspCode&source&reference&from&to&page&size` | `Page<IpnEventRowDto>` |
| GET | `/payments/{paymentId}/timeline` | `PaymentTimelineDto` (404 nếu không có) |

`from`/`to` là `LocalDate` (ISO), `to` tính hết ngày. Bọc trong `ApiResponse.ok(message, data)`.

### 4.4 i18n

Thêm vào **cả ba** file `i18n/messages.properties`, `messages_vi.properties`, `messages_en.properties` (ví dụ): `finance.reconciliation.summary`, `finance.reconciliation.attempts`, `finance.reconciliation.late_refunds`, `finance.reconciliation.ipn_events`, `finance.reconciliation.timeline`, `error.reconciliation.range_too_long`. Kiểm tra không thêm trùng key (lỗi từng gặp: một key bị nối hai lần).

### 4.5 OpenAPI

Tạo `docs/api-contracts/openapi-admin-reconciliation.yaml` mô tả 5 endpoint, schema DTO, mã 400/403/404. Cập nhật `docs/api-contracts/README.md` nếu file đó liệt kê các contract.

## 5. Frontend

Theo `AGENTS.md` mục frontend và `DESIGN.md` (portal: Light charcoal–salmon, Dark charcoal–bạc, token `--sol-accent*`, không viết hex mới).

- `apps/web/src/features/admin/reconciliationApi.ts` — hàm gọi `apiFetch` cho 5 endpoint, kiểu dữ liệu tương ứng DTO (theo mẫu `auditApi.ts`).
- `apps/web/src/features/admin/AdminPaymentReconciliationPage.tsx` (+ css riêng nếu cần, theo mẫu `admin-audit-logs.css`):
  - Hàng thẻ tổng quan (6 số ở 4.2.1). `staleAttempts > 0` và `anomalies > 0` hiển thị cảnh báo rõ ("Job đóng giao dịch treo có thể không chạy", "Có bất thường cần kiểm tra").
  - Tab: **Lượt VNPay** · **Hoàn tiền tự động** · **Sự kiện IPN**. Bộ lọc ngày (mặc định 7 ngày), lọc trạng thái, ô tìm kiếm, phân trang.
  - Bấm một dòng → `Modal` dòng thời gian của payment (4.2.5).
  - Có đủ loading (`LoadingSkeleton`), empty và error state (nút thử lại) cho thẻ tổng quan, từng tab và modal.
  - Song ngữ vi/en theo cách `AdminAuditLogsPage` đang dùng (`useStaffI18n`/`staffMessage`); số tiền định dạng VNĐ như các trang khác.
- Route: thêm `{ path: '/admin/payments', lazy: ... AdminPaymentReconciliationPage }` vào nhóm `RoleGuard allowedRoles={['ADMIN']}` trong `apps/web/src/app/router.tsx`.
- Menu: thêm `{ to: '/admin/payments', label: 'Đối soát thanh toán', icon: 'receipt', roles: ['ADMIN'] }` trong `apps/web/src/features/portal/portalNavigation.ts` (giữ sidebar icon, không thêm nhãn thường trực). Bổ sung bản dịch nhãn nếu menu có cơ chế dịch.

## 6. Kiểm thử

Backend (JUnit + Mockito, theo mẫu `VnpayPaymentServiceTest`, `AuditControllerTest`):
- `VnpayIpnHandler`: ghi sự kiện với đúng `rsp_code` cho `00`, `02`, `97`, `99`; recorder ném lỗi ⇒ mã trả lời **không đổi**; `verifyReturn` ghi `source = RETURN`.
- Recorder không lưu `vnp_SecureHash`.
- `PaymentReconciliationService`: tổng quan đếm đúng; phát hiện hai loại anomaly; giới hạn page/size/khoảng ngày.
- Controller: Member/Coach/Receptionist/Manager nhận 403; Admin nhận 200; timeline payment không tồn tại → 404.
- Test truy vấn trên PostgreSQL thật chỉ chạy khi có biến môi trường test DB như các test Postgres hiện có; ghi rõ trong PR nếu bị bỏ qua.

Frontend (Vitest, theo mẫu `AdminAuditLogsPage.test.tsx`):
- Hiển thị loading → dữ liệu; empty; error + thử lại.
- Cảnh báo khi `staleAttempts`/`anomalies` > 0.
- Đổi tab/bộ lọc gọi API đúng tham số; mở modal timeline.
- Route `/admin/payments` chỉ cho `ADMIN`.

Chạy trước khi mở PR:
- `cd apps/web && npx vitest run && npx tsc -b && npx eslint <file đã sửa>`
- Backend: `cd apps/api && ./mvnw test` (máy không có JDK thì dùng `docker run --rm -v "$PWD":/repo -v "$HOME/.m2":/root/.m2 -w /repo/apps/api maven:3.9.9-eclipse-temurin-21 mvn -q -B test` từ gốc repo — phải mount cả repo vì `DatabasePolicyTest` đọc `../../db`).

## 7. Thứ tự làm và tiêu chí hoàn thành

1. Entity + recorder + sửa `VnpayIpnHandler`/`VnpayController` + test. → IPN mới đều có dòng trong `vnpay_ipn_events`.
2. Repository/service/DTO tổng quan + 4 danh sách + timeline + test.
3. Controller + i18n + OpenAPI + test bảo mật.
4. Frontend API + trang + route + menu + test.
5. Chạy toàn bộ test/lint, cập nhật bảng mục 2 trong `docs/plans/README.md` trỏ tới file này, mở PR kèm Jira key.

Hoàn thành khi:
- Admin mở `/admin/payments` thấy tổng quan, ba tab và dòng thời gian, với dữ liệu thật từ API.
- Mọi lần hệ thống tự hoàn tiền do VNPay xác nhận muộn đều tra được: ai, bao nhiêu, reference nào, payment nào.
- Không vai trò nào khác ngoài Admin gọi được API (kiểm tra ở backend, không chỉ ẩn menu).
- Không có thao tác nào trên trang thay đổi tiền hay trạng thái thanh toán.
- Test backend và frontend xanh; i18n đủ vi/en; OpenAPI cập nhật.

## 8. Ghi chú triển khai (13/11/2026)

- Mặc định D1–D5 giữ nguyên. Lượt treo, lượt đang chờ và bất thường là hiện trạng (không lọc theo ngày); các số còn lại lọc theo `[from, to]`. Khi lọc `stale=true` danh sách lượt bỏ qua khoảng ngày.
- Anomaly (b) chỉ tính khoản tự thanh toán trực tuyến (`received_by IS NULL`): khoản do lễ tân ghi nhận với `method = 'online_wallet'` (kể cả dữ liệu demo) là hợp lệ, không phải bất thường.
- Bảng `vnpay_ipn_events` do Hibernate tạo; recorder chạy `REQUIRES_NEW`, handler bắt mọi lỗi của recorder nên mã trả lời VNPay không đổi. Chỉ lưu các trường ở D4.
- Mã lỗi 400: `RECONCILIATION_RANGE_INVALID`, `RECONCILIATION_RANGE_TOO_LONG`, `RECONCILIATION_PAGE_INVALID`, `RECONCILIATION_FILTER_INVALID`; 404 `PAYMENT_NOT_FOUND`.
- `PaymentReconciliationPostgreSqlTest` chạy truy vấn trên PostgreSQL thật khi có `SCMS_POSTGRES_TEST_URL` (đã chạy với PostgreSQL 16 cục bộ có TLS). Test này mock `CatalogSeeder` vì seeder hiện tạo gói 30 ngày mà `PackageService` từ chối trên schema mới — lỗi có sẵn, cần ticket riêng.

