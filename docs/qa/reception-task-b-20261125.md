# Receptionist — Task B

Nạp Ví SÖL tại quầy chỉ nhận tiền mặt; hiển thị phương thức cố định, giữ giao dịch lịch sử khác phương thức.

Base: main 9d1dc369. Branch độc lập, không push/merge/deploy, không đổi schema/production data.
Manual localhost: đăng nhập Receptionist; kiểm tra luồng tương ứng theo yêu cầu A–E, cả VI/EN và viewport 1366px/390px.
Kiểm tra tự động: xem bảng bàn giao cuối. Full frontend suite có lỗi nền MemberCoachBookingView.test.tsx:311 (tái hiện trên main); người dùng cho phép commit khi test liên quan PASS và ghi rõ full suite FAIL. Không sửa test nền.
Review: reviewer độc lập chỉ đọc diff; không còn Important/Critical sau sửa.

## Truy vết code

| File:dòng | Hàm/logic | Endpoint |
|---|---|---|
| `apps/api/src/main/java/com/swp391/scms/wallet/WalletService.java:203` | `if (paymentMethod != null` | POST /wallet/members/{memberId}/topup |
| `apps/web/src/features/reception/StaffReceptionPage.tsx:1457` | `counter-topup-cash` | UI nạp ví |

## Manual localhost

1. Mở nạp ví: chỉ dòng Tiền mặt tại quầy, không dropdown.
2. Nạp hợp lệ, kiểm tra số dư/hóa đơn; thử lại cùng clientRequestId không cộng lần hai.
3. Gọi API bằng pos/bank_transfer: 400 COUNTER_TOPUP_CASH_ONLY; Member online và giao dịch lịch sử giữ nguyên.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.
