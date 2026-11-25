# Receptionist — Task D

Receptionist nhận toast cho yêu cầu mới sau mốc đăng nhập; chuông dùng notification server và trạng thái đọc riêng việc xử lý. Giữ route nghiệp vụ hiện có.

Base: main 9d1dc369. Branch độc lập, không push/merge/deploy, không đổi schema/production data.
Manual localhost: đăng nhập Receptionist; kiểm tra luồng tương ứng theo yêu cầu A–E, cả VI/EN và viewport 1366px/390px.
Kiểm tra tự động: xem bảng bàn giao cuối. Full frontend suite có lỗi nền MemberCoachBookingView.test.tsx:311 (tái hiện trên main); người dùng cho phép commit khi test liên quan PASS và ghi rõ full suite FAIL. Không sửa test nền.
Review: reviewer độc lập chỉ đọc diff; không còn Important/Critical sau sửa.

## Truy vết code

| File:dòng | Hàm/logic | Endpoint |
|---|---|---|
| `apps/api/src/main/java/com/swp391/scms/notifications/NotificationService.java:70` | `public void notifyReceptionists` | Event yêu cầu KYC/trial/hold/payment |
| `apps/web/src/features/reception/useReceptionAlerts.ts:7` | `export function useReceptionAlerts` | GET /notifications |
| `apps/web/src/features/member/notificationsApi.ts:78` | `export function notificationDestination` | Điều hướng chuông hiện có |

## Manual localhost

1. Đăng nhập Receptionist: thông báo cũ ở chuông, không spam toast.
2. Member gửi KYC, trial, bảo lưu, yêu cầu gói hoặc support: notification lưu thật; polling nhận toast và badge mới.
3. Click chuông tới /staff/kyc, /staff/holds, /staff/reception hoặc /messages?tab=support; đánh dấu đọc không duyệt yêu cầu.
4. Focus/refresh lặp không toast trùng; Manager/Member không chạy polling Receptionist.

## Lệnh kiểm tra

`node node_modules/typescript/bin/tsc -b`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`. Java dùng Maven 3.9.16 đã có trong wrapper cache với `-Dmaven.repo.local=<user>/.m2/repository` do wrapper Windows không khởi động được trong harness. Unit tests không kết nối DB; chưa kiểm thử Supabase integration.
