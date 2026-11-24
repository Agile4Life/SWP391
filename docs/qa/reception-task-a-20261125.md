# Receptionist — Task A

KYC tại POS: hiện trạng thái từ API, chỉ hiện số giấy tờ đã che; mua mới dùng cùng điều kiện KYC với Member. Không thêm quyền sửa giấy tờ.

Base: main 9d1dc369. Branch độc lập, không push/merge/deploy, không đổi schema/production data.
Manual localhost: đăng nhập Receptionist; kiểm tra luồng tương ứng theo yêu cầu A–E, cả VI/EN và viewport 1366px/390px.
Kiểm tra tự động: xem bảng bàn giao cuối. Full frontend suite có lỗi nền MemberCoachBookingView.test.tsx:311 (tái hiện trên main); người dùng cho phép commit khi test liên quan PASS và ghi rõ full suite FAIL. Không sửa test nền.
Review: reviewer độc lập chỉ đọc diff; không còn Important/Critical sau sửa.

## Truy vết code

| File:dòng | Hàm/logic | Endpoint |
|---|---|---|
| `apps/api/src/main/java/com/swp391/scms/membership/service/MembershipKycEligibility.java:10` | `requireVerified` | POST /memberships/subscriptions + payment flows |
| `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java:455` | `public PaymentDto processPayment` | POST /payments/process |
| `apps/api/src/main/java/com/swp391/scms/reception/MemberLookupService.java:34` | `public List<MemberLookupDto> search` | GET /members/lookup |
| `apps/web/src/features/reception/StaffReceptionPage.tsx:594` | `const handlePayment` | POST /payments/process |

## Manual localhost

1. Đăng nhập Receptionist; tra cứu hội viên chưa KYC, chọn mua mới: bị chặn, không có giao dịch.
2. Member nộp KYC, quầy duyệt ở /staff/kyc; quay lại/focus POS rồi tra cứu: trạng thái đã xác thực và số che đúng.
3. Thử hộ chiếu, PENDING/REJECTED, trial đã duyệt, đơn cancelled; kiểm tra mua/gia hạn/nâng cấp và hóa đơn.
4. Gọi POS bằng packageId, hoặc tạo/xác nhận payment cũ khi chưa KYC: 400, không phát sinh QR/invoice.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.

Bổ sung cuối: PendingSubscriptionDto.previousSubscriptionId phân biệt mua mới với gia hạn/nâng cấp; POS kiểm tra KYC cả đơn mua mới đang chờ. Test hồi quy RED 1 FAIL trước sửa → GREEN 120/120 test trực tiếp. Không dùng lịch sử đơn để suy đoán quan hệ.
