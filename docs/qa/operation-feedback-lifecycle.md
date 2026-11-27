# QA vòng đời phản hồi thao tác

## Lỗi xác minh và phạm vi sửa

- Toast được chèn vào `dialog[open]` nên mất khi modal đóng hoặc unmount ngay sau API success. Test đỏ tái hiện cả hai trường hợp. Sửa shared toast để chuyển cùng node, giữ timer đang chạy và dọn observer trước dismiss/thay thế; không tạo modal/toast mới hoặc chủ động đổi focus.
- Từ chối trial tại Receptionist gọi `notify` loại `info`, chỉ ghi chuông. Chỉ lời gọi này đổi sang `success` sau khi API thành công, giữ `record: true`. Test API pending/error không phát success; success có một toast và một record.
- Browser QA xác minh toast inline ở đầu portal bị cụm topbar nổi che trên desktop/tablet. Test hình học thất bại trước sửa. CSS scoped vào toast trực tiếp trong portal: căn gutter và chừa hàng 54px của topbar cộng khoảng cách; không chuyển sang top-right, không đổi toast trong modal/public.

## Các luồng giữ nguyên

| Role | Source được đối chiếu | Quyết định |
|---|---|---|
| Member | MemberHoldPage, MemberProfilePage, MemberCardPage, VnpayReturnPage | Giữ success sau API, lỗi/validation tại form và phản hồi thanh toán hiện có |
| Receptionist | StaffReceptionPage, KycReviewPage, HoldManagementPage, StaffInternalRequestsPage | Chỉ sửa feedback trial reject và lifecycle shared; giữ API/handler/validation/confirmation, payment và chuông |
| Manager | ManagerInternalRequestsPage, StaffAccountsPage, ManagerCatalogsPage | Giữ inline feedback và hộp thoại kết quả riêng của Danh mục vận hành; không đổi review hoặc validation |
| Coach | CoachTrainingPlanPage, CoachAttendancePage, PtAttendancePage | Giữ trạng thái thành công/lỗi theo API và lỗi tại form; kiểm tra hồi quy shared toast |
| Admin | AdminAuditLogsPage, AdminPaymentReconciliationPage | Giữ lỗi tải dữ liệu/Retry/cảnh báo đối soát tại chỗ; không phát thêm toast |

Không sửa `portalNotices.ts`, logic info/silent/record/key/read-unread, notification server hoặc API contract. Không đổi toàn bộ inline feedback hay thông báo đang đúng.

## Kiểm chứng

- Nhóm liên quan: 95 tests PASS (toast lifecycle, portalNotices, Receptionist, đơn từ Staff/Manager, bảo lưu Member và PortalShell cleanup).
- Full Frontend: 1510 tests / 162 files PASS. Typecheck (`tsc -b`), lint, build và diff check PASS.
- Toast tests kiểm tra cùng node qua close/unmount, fallback main/body và modal còn mở, chạy lặp/thay toast không resurrect, deadline 3200ms, timer pause/resume, error persistent, nút đóng/Escape, ngôn ngữ và focus.
- Browser QA: 20 cấu hình = 5 role × (1440px Light VI, 768px Dark VI, 390px Light EN, 390px Dark VI). Kiểm tra modal unmount, cùng node, không trùng, không lấy focus, keyboard dismiss, inline layout, wrap, không chồng topbar và chuông không bị xóa khi đóng toast.
- Riêng Receptionist/1440px: thao tác trial reject trên form thật với API fixture thất bại rồi thành công; kiểm tra form error, modal đóng, đúng một success/record và auto-dismiss không mất record.

## Chạy lại Browser QA

1. `npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5184 --strictPort`
2. `node scripts/qa/verify-operation-feedback-lifecycle.cjs` (Edge headless; đổi URL qua `FEEDBACK_QA_URL`).
3. Ảnh nằm trong `apps/web/node_modules/.cache/operation-feedback-qa/`, không commit artifact.

Fixture chỉ nằm trong script QA localhost và context trình duyệt. Modal tổng quát của bốn role còn lại là fixture kiểm tra shared component, không phải nghiệm thu mọi thao tác thật của từng role. Chưa UAT Backend thật; cần kiểm tra các luồng tạo/duyệt/cập nhật và trial reject trên môi trường dev/test. Không truy cập DB hoặc thay dữ liệu production.
