# Task 3 — Hộp thư hỗ trợ Receptionist

Ngày kiểm tra: 25/11/2026. Phạm vi nghiệp vụ: SCRUM-68 / SCRUM-106 / SCRUM-128, theo yêu cầu Task 3 của Thịnh.

Mã nguồn và kiểm thử offline đã triển khai. **Chưa nghiệm thu trên PostgreSQL thật hoặc môi trường triển khai.** Không khởi động API kết nối database chung, áp dụng schema, push, tạo PR, merge hoặc deploy trong task này.

## Git và phạm vi

- Branch `feat/thinh-reception-chat-unread`, tạo từ main sạch `0d906c02`.
- Task 1 `7ba2faf8` và Task 2 `1ffd40db` nằm trên branch riêng, không đưa vào Task 3.
- Lúc bắt đầu, main GitHub khớp local; PR #181 đang mở. Đã đọc danh sách file PR: không sửa Chat/Support. Không checkout hoặc ghi đè branch PR. Các file dùng chung DESIGN/i18n chỉ bổ sung nội dung Task 3.
- Không đổi tạo phiếu, gửi/trả lời, chuyển cấp, phân quyền hiện có, KYC, thanh toán, ví, bảo lưu hoặc AI. Chat trực tiếp giữ cơ chế read/unread hiện có vì dùng mô hình riêng.

## Luồng mã nguồn và API

Các đường dẫn dưới đây tính từ root repository; số dòng tại thời điểm hoàn tất task.

| File | Hàm / dòng | Endpoint / vai trò |
|---|---|---|
| `apps/web/src/features/chat/StaffSupportChat.tsx` | `loadList`, 67 | GET `/api/v1/support/requests?page&size&status&unreadOnly` |
| cùng file | `loadDetail`, 91 | GET `/{id}` và GET `/{id}/messages`; sau thành công mới POST `/{id}/read` |
| cùng file | `close`, 167; `changeQuery`, 173 | Quay về hộp thư và giữ bộ lọc, nháp, cuộn; không có endpoint điều hướng |
| `apps/web/src/features/member/memberSupportApi.ts` | `getSupportInbox`, 63; `markSupportRead`, 67 | Giữ API hộp thư, thêm boolean unreadOnly và body `{lastMessageId}` |
| `apps/web/src/features/chat/SupportChatParts.tsx` | `SupportHeader`, 15 | Nút ArrowLeft + “Quay lại hộp thư”, không gọi history/back hoặc reload |
| `apps/web/src/features/chat/ChatPage.tsx` | `ChatWorkspace`, 238 | Truyền trạng thái hiển thị widget cho hỗ trợ lễ tân, tránh đọc khi widget ẩn |
| `apps/api/src/main/java/com/swp391/scms/support/SupportRequestController.java` | `getAllRequests`, 104; `markRead`, 59 | GET hộp thư / POST `/{id}/read`; endpoint read chỉ RECEPTIONIST |
| `apps/api/src/main/java/com/swp391/scms/support/SupportInboxService.java` | `inbox`, 48; `markRead`, 75 | Kiểm tra actor active/chưa xóa, quyền phiếu; tính unread, tiến cursor |
| `apps/api/src/main/java/com/swp391/scms/support/SupportRequestRepository.java` | `findReceptionistInbox`, 24 | Lọc trạng thái + unread và sắp xếp tại DB trước phân trang |
| `apps/api/src/main/java/com/swp391/scms/support/SupportRequestMessageRepository.java` | `countIncomingAfter`, 20 | Chỉ đếm tin do hội viên của phiếu gửi sau cursor |
| `apps/api/src/main/java/com/swp391/scms/support/entity/SupportRequestRead.java` | `advanceTo` | Lưu cursor riêng từng người; không thể kéo lùi |

Hợp đồng đầy đủ: [openapi-support-inbox-read.yaml](../api-contracts/openapi-support-inbox-read.yaml).

## Read/unread thực tế

- Nguồn sự thật là database, không phải localStorage. Mỗi `(support_request_id, user_id)` có một cursor `last_message_id` riêng. Lễ tân A đọc không làm mất unread của B.
- Chưa có receipt: yêu cầu ban đầu được tính là một mục chưa đọc. Cộng các tin do hội viên của phiếu gửi có ID lớn hơn cursor. Mọi tin nhân viên gửi đều bị loại khỏi số tin đến chưa đọc.
- Cursor 0 xác nhận yêu cầu ban đầu; cursor dương phải thuộc đúng phiếu. Dùng khóa ghi của phiếu giống luồng gửi tin, unique theo phiếu/người và `max(old, cursor)` để chống ghi đè bởi request cũ.
- Frontend chỉ xác nhận sau khi cả chi tiết và lịch sử tải thành công, đúng phiếu đang mở, khung đang hiện và tab không ẩn. Không POST read khi chỉ tải danh sách hoặc gặp 403/lỗi tải lịch sử.
- Chỉ gửi ID cao nhất trong lịch sử vừa tải. Tin đến sau snapshot vẫn chưa đọc. Không tự gán unread về 0; đọc lại số thật từ server sau xác nhận.
- Gộp request chi tiết khi realtime/fallback polling/focus tới liên tiếp; bỏ kết quả cũ khi đổi phiếu. Có test quay lại rồi mở cùng phiếu trong lúc request cũ còn chạy.
- Đọc không thay status, assignedTo, escalation, không gửi tin hoặc tạo notification. Đóng phiếu không tự tạo receipt.

## Sắp xếp, lọc và quay lại

- DB sắp theo thời gian tin cuối giảm dần, fallback ngày tạo phiếu; bằng thời gian thì ID phiếu giảm dần. Tin cuối lấy theo `createdAt DESC, id DESC`.
- Lọc Tất cả/Chưa đọc độc lập với trạng thái; cả hai áp dụng trước phân trang và tổng số trang. Không chỉ lọc 20 bản ghi hiện có ở frontend.
- Nút quay lại chỉ xóa lựa chọn chi tiết, giữ danh sách, bộ lọc/trang, nháp theo phiếu và vị trí cuộn hiện có. Cập nhật lại danh sách nền để lấy unread/status thật.
- Trong bộ lọc Chưa đọc, phiếu vừa đọc có thể rời danh sách; vẫn xuất hiện khi chọn Tất cả. Không xóa phiếu/tin nhắn.
- Nút dùng button và SVG của `SupportHeader`, hiển thị cả desktop/mobile; nhãn tiếng Việt/Anh, vùng bấm 44px. Mobile chừa chiều cao cho hàng nút quay lại. Màu dùng token Light salmon/Dark bạc hiện hành.

## Schema cần Backend/leader review

- **Có bổ sung schema JPA:** bảng mới `support_request_reads`, ID identity; FK phiếu (cascade khi xóa phiếu), FK user, `last_message_id >= 0`, unique `(support_request_id, user_id)`.
- Không thêm/sửa DDL migration, không đổi bảng dữ liệu nghiệp vụ cũ, không backfill trạng thái giả. Bảng mới rỗng khiến tất cả phiếu cũ chưa có receipt hiện chưa đọc cho từng lễ tân; cần leader chấp nhận hành vi ban đầu này.
- Cấu hình hiện tại mặc định `ddl-auto:update`; đây là hành vi cần audit, **không phải phương án triển khai production**. Bảng phải được provision bằng một thay đổi schema có kiểm soát đã duyệt trước khi triển khai ứng dụng. Production cần chế độ validate do Backend/ops phê duyệt; chỉ đổi `.env` chưa đủ vì `compose.yml` đang ghim `update`. Không sửa cấu hình production trong task này.
- Khi bảng chưa tồn tại: `update` có thể tạo bảng nếu JDBC role đủ quyền, nhưng chưa được kiểm chứng bằng DB thật; `validate` sẽ không khởi động được; `none` cũng không đủ vì RLS initializer yêu cầu bảng đã tồn tại. **Chưa áp dụng trên Supabase chung/production.** Xem [đề xuất schema và gate triển khai](../api-contracts/support-inbox-schema-review.md).
- RLS initializer hiện có tự lấy bảng từ JPA metamodel nên bao gồm entity mới; không thêm Data API policy mở bảng đọc.
- `SupportInboxPostgreSqlTest` đã viết theo harness Supabase test và schema UUID riêng. Trong phiên này bị skip do không có `SCMS_POSTGRES_TEST_URL`; chưa xác nhận kết quả truy vấn, khóa đồng thời hoặc nâng cấp schema bằng DB thật.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Test frontend liên quan cuối cùng | PASS 47 test / 4 file |
| Full frontend `npm.cmd test -- --maxWorkers=2` | PASS 1.178 test / 152 file |
| `npx.cmd tsc -b` | PASS |
| `npm.cmd run lint` | PASS, không warning ESLint |
| `npm.cmd run build` | PASS; cảnh báo chunk lớn hiện có của Vite |
| Full backend `mvnw.cmd --offline test` | BUILD SUCCESS; 1.616 test được liệt kê, 0 failure/error, 47 skipped |
| Backend focused sau chỉnh fixture cuối | PASS; 18 test được liệt kê, 0 failure/error, 1 skipped (DB thật) |
| `RepositoryQueryValidationTest` | PASS, Hibernate phân tích query/derived/count không kết nối DB |
| `DatabasePolicyTest`, `DatabaseProfilesTest` | PASS trong backend suite |
| `scripts/test-database-config.ps1` | PASS 10 case |
| `git diff --check` | PASS |
| Browser mock localhost, Edge | PASS Light/Dark × 1440/390px, không tràn ngang; read cursor, badge, bộ lọc, quay lại, nháp, composer thao tác được |

Không skip/xóa/làm yếu test để ép PASS. Log backend nằm tại `apps/api/target/task3-backend-test.log` và `task3-support-test.log` (build artifacts, không commit). Knowledge graph không cập nhật được vì không có graphify CLI/Python trong môi trường; source và repository semantic tests là căn cứ kiểm tra.

## Cách chạy kiểm tra giao diện localhost

1. Trong `apps/web`, chạy `npm.cmd run dev -- --host 127.0.0.1`.
2. Từ root, chạy `node scripts/qa/verify-reception-support-unread.cjs`. Script dùng Playwright/Edge sẵn có, mock toàn bộ `/api/v1/` trên localhost, không kết nối dữ liệu thật. Ảnh chụp `scms-chat-{theme}-{width}-{inbox|detail}.png` nằm trong thư mục TEMP của Windows.
3. Nếu cần kiểm tra dữ liệu thật, chỉ dùng API đã được review schema trên môi trường dev/test được phép. Script mock không thay thế nghiệm thu DB thật.

## Manual test bằng Member và Receptionist

1. Member tạo phiếu và gửi thêm một tin. Receptionist mở `/messages?tab=support`: thấy tên, mã/tiêu đề, tin cuối, giờ, status, badge và chữ đậm. Phiếu cũ có tin mới phải đứng trên phiếu mới hơn nhưng không có hoạt động gần đây.
2. Chọn Chưa đọc rồi từng status. Xác nhận số trang và danh sách đúng tổ hợp lọc, không phải chỉ lọc dữ liệu một trang.
3. Mở phiếu, đợi tin cuối tải xong; Network có POST `/{id}/read` với ID đã tải, không PATCH status. Quay lại: bộ lọc còn nguyên; chọn Tất cả để thấy phiếu đã bỏ badge.
4. Reload và mở lại: trạng thái đọc vẫn đúng. Member nhắn tiếp: unread xuất hiện lại. Receptionist trả lời không tự tăng unread của mình. Luồng trả lời hiện có có thể chuyển open thành in_progress; **đọc/mở phiếu thì không**.
5. Hai Receptionist dùng hai phiên trình duyệt: A đọc, B chưa đọc vẫn có badge. Member/Coach/Manager gọi endpoint read phải 403; Manager chỉ thấy phiếu đã chuyển lên như trước.
6. Thử mở rồi quay lại ngay khi mạng chậm, mở lại cùng phiếu; không treo loading, không ghi nhận response cũ là đã đọc. Tin tới trong lúc đang tải chỉ được xác nhận khi nó nằm trong snapshot đã tải.
7. Thử lỗi GET lịch sử và lỗi POST read: không mất unread; có lỗi/thử lại. Chuyển tab/ẩn widget không tự đánh dấu tin chưa tải hoặc không hiện.
8. Nhập nháp rồi quay lại/mở lại; nháp còn, tin đã gửi vẫn nằm trong lịch sử. Kiểm tra Light/Dark và mobile, bấm quay lại không về dashboard, không dùng history.back và không reload trang.

Chỉ kết luận nghiệm thu end-to-end sau khi test PostgreSQL biệt lập và các bước manual bằng tài khoản thật trên dev/test đã PASS.
