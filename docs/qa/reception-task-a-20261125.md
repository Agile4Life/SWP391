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
| `apps/api/src/main/java/com/swp391/scms/finance/service/PaymentService.java:474` | `public PaymentDto processPayment` | POST /payments/process |
| `apps/api/src/main/java/com/swp391/scms/reception/MemberLookupService.java:41` | `public List<MemberLookupDto> search` | GET /members/lookup |
| `apps/web/src/features/reception/StaffReceptionPage.tsx:594` | `const handlePayment` | POST /payments/process |

## Manual localhost

1. Đăng nhập Receptionist; tra cứu hội viên chưa KYC, chọn mua mới: bị chặn, không có giao dịch.
2. Member nộp KYC, quầy duyệt ở /staff/kyc; quay lại/focus POS rồi tra cứu: trạng thái đã xác thực và số che đúng.
3. Thử hộ chiếu, PENDING/REJECTED, trial đã duyệt, đơn cancelled; kiểm tra mua/gia hạn/nâng cấp và hóa đơn.
4. Gọi POS bằng packageId, hoặc tạo/xác nhận payment cũ khi chưa KYC: 400, không phát sinh QR/invoice.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.

Bổ sung cuối: PendingSubscriptionDto.previousSubscriptionId phân biệt mua mới với gia hạn/nâng cấp; POS kiểm tra KYC cả đơn mua mới đang chờ. Test hồi quy RED 1 FAIL trước sửa → GREEN 120/120 test trực tiếp. Không dùng lịch sử đơn để suy đoán quan hệ.


Review regression: historic approved trials retain their actual PENDING/REJECTED KYC status. Member catalog/checkout use trial status; POS uses server-confirmed lookup approvedTrial. No subscription-history inference, schema change, backfill, or extra identity fields. Regression RED: 6 cases failed; GREEN: 126/126 directly related frontend tests. Ordinary pending KYC remains blocked. Java verification is recorded in the final handoff.

## Bổ sung sau review trước PR

- Trial đã duyệt trong dữ liệu cũ có thể còn KYC PENDING/REJECTED. Lookup trả boolean approvedTrial từ server; Member dùng API trạng thái trial. Không dùng lịch sử subscription làm bằng chứng và không sửa dữ liệu cũ.
- MemberCheckoutPage tách trạng thái KYC thật khỏi điều kiện thanh toán: ngoại lệ trial hoặc kỳ gia hạn/nâng cấp không biến nhãn KYC thành đã xác thực.
- PaymentService.java:74 / requireNewPackageKyc: làm mới hội viên trước khi kiểm tra; :84 / requireSubscriptionPaymentKyc dùng chung cho POS và ví/VNPay.
- VnpayPaymentService.java:228 / resolveTargetPayment: kiểm tra trước ghi dữ liệu khi checkout/ví, nhưng vẫn cho hủy lượt đang chờ với kiểm tra chủ sở hữu cũ. Endpoint POST /api/v1/payments/vnpay/checkout, POST /api/v1/wallet/pay, POST /api/v1/payments/vnpay/cancel.
- VnpayPaymentService.java:387 / ipn: nếu KYC đổi trong khi cổng xử lý, callback hợp lệ hoàn tiền vào ví qua cơ chế sẵn có, đúng một lần theo reference. Khoản mua vẫn chờ, không phát sinh kích hoạt/invoice. Endpoint GET /api/v1/payments/vnpay/ipn. Validation chỉ đọc được cấu hình noRollbackFor để lỗi KYC được bắt không đánh dấu rollback toàn bộ giao dịch hoàn ví.
- Regression mới có RED trước sửa, GREEN sau sửa; test callback lặp, chưa có ví, hủy khi chưa KYC và approved trial/linked period. Kết quả cuối ghi tại mô tả PR. Cần Phong review và kiểm thử sandbox end-to-end trên môi trường dev/test; không bật gateway thật.
