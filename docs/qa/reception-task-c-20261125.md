# Receptionist — Task C

Hai bảng lịch sử tại quầy có tìm kiếm độc lập, Hôm nay/7/30/90 ngày/Tất cả thời gian, sắp xếp hai chiều; giữ bộ lọc loại và phương thức lịch sử.

Base: main 9d1dc369. Branch độc lập, không push/merge/deploy, không đổi schema/production data.
Manual localhost: đăng nhập Receptionist; kiểm tra luồng tương ứng theo yêu cầu A–E, cả VI/EN và viewport 1366px/390px.
Kiểm tra tự động: xem bảng bàn giao cuối. Full frontend suite có lỗi nền MemberCoachBookingView.test.tsx:311 (tái hiện trên main); người dùng cho phép commit khi test liên quan PASS và ghi rõ full suite FAIL. Không sửa test nền.
Review: reviewer độc lập chỉ đọc diff; không còn Important/Critical sau sửa.

## Truy vết code

| File:dòng | Hàm/logic | Endpoint |
|---|---|---|
| `apps/api/src/main/java/com/swp391/scms/membership/service/MembershipRequestHistoryService.java:47` | `public List<RequestHistoryDto> history` | GET /memberships/subscriptions/requests/history?days=0 |
| `apps/api/src/main/java/com/swp391/scms/wallet/CounterTopupService.java:145` | `public List<TopupHistoryDto> history` | GET /wallet/counter-topups?days=0 |
| `apps/web/src/features/reception/MembershipRequestHistory.tsx:59` | `const visible` | Tìm/lọc/sắp xếp toàn mảng |
| `apps/web/src/features/reception/WalletTopupHistory.tsx:46` | `const visible` | Tìm/lọc/sắp xếp độc lập |

## Manual localhost

1. Mở /staff/reception-history; mỗi bảng chọn Tất cả thời gian.
2. Tìm tên có/không dấu, mã hội viên, mã yêu cầu/payment; đổi sort hai chiều.
3. Đổi bộ lọc một bảng không tác động bảng kia; thử Hôm nay/7/30/90 ngày; giao dịch POS/chuyển khoản cũ vẫn tìm được.
4. Tắt API rồi refresh: hiện lỗi, thử lại lấy dữ liệu thật.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.
