# Chat trực tiếp Member – Receptionist/Coach

Ngày: 29/10/2026. Người dùng đã duyệt chat riêng 1–1 và yêu cầu triển khai, commit theo từng phần. Mở rộng phạm vi giao tiếp của SCRUM-106 (backend owner Tài), SCRUM-128 (Member UI owner Thịnh); đây là yêu cầu bổ sung, không thay đổi AC của phiếu hỗ trợ.

## Hành vi

- Member tìm Receptionist/Coach đang active, chưa xóa để mở hội thoại. Mỗi cặp Member–nhân viên chỉ có một hội thoại, kể cả khi mở đồng thời.
- Receptionist/Coach xem và trả lời những hội thoại mình tham gia. Center Manager và các role khác không được đọc chat riêng.
- Chỉ hai người tham gia được đọc lịch sử/gửi tin. Không yêu cầu subscription active cho chat; ràng buộc subscription vẫn áp dụng booking/check-in.
- Tài khoản ngừng hoạt động/xóa mềm không xuất hiện trong danh bạ, không được gửi tin. Người tham gia còn active vẫn đọc được lịch sử của mình, người nhận không còn khả dụng được hiển thị rõ và không thể nhận tin mới.
- Tin nhắn text thuần, trim, 1–2000 ký tự. Client sinh UUID cho mỗi lần gửi; retry cùng UUID không tạo bản sao. Lịch sử dùng ID cursor, mới nhất 50 tin, tải thêm tin cũ; bắt kịp tin mới sau reconnect.
- Trang `/messages` cho MEMBER/STAFF/COACH, giữ portal sidebar icon và token Light/Dark charcoal–salmon. Có loading, empty, forbidden, error, retry, trạng thái kết nối; giữ bản nháp khi gửi lỗi; không tự cuộn xuống nếu đang đọc tin cũ.

## Dữ liệu và bảo mật

`ChatConversation` và `ChatMessage` nằm trong feature `chat`, liên kết `User` bằng JPA. Hibernate `ddl-auto: update` tạo bảng, unique constraint và index. Không viết migration DDL và không sửa SQL lịch sử.

Tất cả đọc/ghi qua Spring Boot với JWT hiện tại. Service transaction kiểm tra role, thành viên hội thoại và trạng thái account. Directory query phân trang, chỉ trả ID/tên/role, không lộ email, số điện thoại hoặc hồ sơ sức khỏe. API dùng DTO/validation/ApiResponse và đủ ba bundle i18n.

## Supabase Realtime

Dùng Broadcast riêng theo user `scms:chat:<userId>`, payload rỗng, event `changed`. Trigger sau insert tin nhắn gửi invalidation cho cả hai bên trong cùng transaction; rollback không phát tin. Trigger qua `PostgreSqlTriggerProvider`, cùng file trigger hiện hành. Không đưa nội dung chat vào broadcast, không mở quyền Data API cho bảng ứng dụng.

Backend cấp JWT Supabase riêng thời hạn 5 phút, chỉ có claim nhận kênh của chính user, ký HS256 bằng `SUPABASE_CHAT_JWT_SECRET` server-only (project legacy JWT secret vẫn được Supabase tin cậy; không phải APP_JWT_SECRET hoặc publishable key). Frontend dùng publishable key, `setAuth` rồi `private: true`, gia hạn token trước hạn. Chính sách SELECT giới hạn đúng claim/topic; restrictive policies ngăn policy rộng khác mở đọc/ghi kênh chat. Browser không được phát event chat. Policy chỉ cài trong application schema public, không sửa hệ thống Supabase trong test schema biệt lập.

Thiếu cấu hình thì API chat vẫn dùng được; UI ghi rõ realtime chưa cấu hình, có nút làm mới và catch-up khi focus/online. Không hiển thị giả trạng thái online. Reconnect đăng ký lại, refresh lịch sử/inbox, loại trùng theo ID, hủy channel/timer/listener khi unmount. Không polling định kỳ lịch sử.

## Phương án đã cân nhắc

1. **Chọn:** Spring Boot giữ dữ liệu/phân quyền, Supabase Broadcast chỉ invalidation: hợp JWT và RLS hiện tại, nội dung tin luôn được API kiểm tra.
2. Browser đọc/ghi trực tiếp Postgres Changes: phải mở Data API và thay mô hình auth; tăng phạm vi nên không chọn.
3. Chat trong support ticket: đã được người dùng loại trừ khi chọn chat riêng 1–1.

## Kiểm chứng

Unit/controller/security tests: cặp role hợp lệ, người ngoài, manager, khóa/xóa user, nhắn rỗng/dài, phân trang cursor, retry UUID, không tạo trùng hội thoại. PostgreSQL integration trên schema biệt lập nếu có `SCMS_POSTGRES_TEST_*`: Hibernate tạo schema, unique/FK, transaction/concurrency và RLS; không dùng database thay thế. Realtime token/policy kiểm chứng theo khả năng cấu hình dev/test, ghi rõ mọi skip. Frontend tests cho nhận event, reconnect, chuyển hội thoại khi request cũ chưa xong, lỗi gửi/retry, pagination, cleanup và responsive. Chạy Maven suite, database policy PowerShell, frontend suite/build/lint, browser smoke trước hoàn tất.

## Phạm vi

Không AI provider, file đính kèm, nhóm chat, read receipt, typing/presence hoặc payment gateway. Không push/merge/deploy tự động. Commit lần lượt: tài liệu/API; backend; realtime; UI và kiểm chứng.

Tài liệu Supabase: https://supabase.com/docs/guides/realtime/authorization ; https://supabase.com/docs/guides/realtime/broadcast ; https://supabase.com/docs/guides/auth/jwts .
