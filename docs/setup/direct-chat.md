# Thiết lập chat riêng và Supabase Realtime

Chat là tính năng bổ sung SCRUM-106/SCRUM-128. Member mở `/messages`, tìm lễ tân/HLV và gửi tin. Receptionist/Coach đăng nhập tài khoản của mình để trả lời tại cùng đường dẫn. Manager không được truy cập chat riêng. Dữ liệu phiếu hỗ trợ và chatbot AI độc lập.

## Cấu hình

1. Dùng Supabase PostgreSQL/profile `supabase`, JDBC TLS theo hướng dẫn hiện có. Hibernate tự tạo `chat_conversations` và `chat_messages`; không chạy SQL lịch sử hay thêm migration.
2. Cấu hình server `SUPABASE_URL=https://<project-ref>.supabase.co`, `SUPABASE_PUBLISHABLE_KEY=sb_publishable_...` và `SUPABASE_CHAT_JWT_SECRET` trong môi trường bí mật của API. Khóa thứ ba là **legacy JWT secret HS256 của đúng project, còn được Supabase tin cậy**, không phải API secret key, service-role key hay `APP_JWT_SECRET`. Nếu project đã thu hồi key HS256 hoặc chỉ chấp nhận signing key bất đối xứng, cơ chế ký này chưa dùng được: để trống biến, chat qua HTTP vẫn hoạt động; cần triển khai signer tương ứng với imported signing key trước khi bật Realtime. Không đổi key project hoặc auth hiện tại chỉ để chạy chat.
3. Khởi động API. `PostgreSqlTriggerProvider` cài trigger sau Hibernate. Khi schema là `public`, provider cài ba policy có tên `scms_chat_*` vào `realtime.messages`. JDBC role cần quyền cài policy theo cơ chế Supabase; thiếu quyền phải sửa role cấu hình, không gỡ policy. RLS của bảng ứng dụng vẫn do initializer hiện có bật, không cấp quyền browser đọc bảng.
4. Frontend lấy metadata qua `POST /api/v1/chat/realtime-session` đã xác thực, không cần biến `VITE_` mới. Publishable key công khai được; JWT nhận kênh chỉ ở bộ nhớ, thời hạn 5 phút. Tuyệt đối không đưa signing secret vào bundle hoặc browser storage.
5. Giữ cấu hình public access hiện tại cho tính năng membership Broadcast đang dùng public capability topics. Chat luôn dùng `private: true` khi subscribe và khi trigger phát; public channel trùng tên không nhận private broadcast. Xem [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast) và [Authorization](https://supabase.com/docs/guides/realtime/authorization).

Thiếu cấu hình: giao diện báo realtime chưa cấu hình, vẫn gửi/đọc qua API và có nút làm mới. Lỗi socket: hiển thị mất kết nối, thử nối lại với backoff; mỗi lần subscribe thành công, focus hoặc online đều đọc bù dữ liệu. Không polling lịch sử. Trigger không làm mất tin nhắn đã lưu khi dịch vụ Realtime lỗi.

## Kiểm tra dev/test

- Backend: `cd apps/api; ./mvnw.cmd test`. DB thật: đặt `SCMS_POSTGRES_TEST_URL`, `SCMS_POSTGRES_TEST_USERNAME`, `SCMS_POSTGRES_TEST_PASSWORD` cho **Supabase dev/test** (không tự dùng credentials DB chính). `ChatPostgreSqlTest` tạo schema tên ngẫu nhiên, kiểm tra concurrent open/send, unique/FK/RLS, rồi xóa đúng schema đó; không thay policies toàn cục.
- Frontend: `npm --prefix apps/web test`, `npm --prefix apps/web run build`, `npm --prefix apps/web run lint`.
- Live Realtime: hai browser độc lập, đăng nhập Member và đúng Coach/Receptionist. Gửi hai chiều, tin xuất hiện không bấm làm mới; offline một browser, gửi >50 tin, online lại và kiểm tra tải bù theo cursor, không trùng tin. Mở hội thoại khác trong lúc đang tải, bảo đảm không lẫn lịch sử/bản nháp.
- Kiểm tra BOLA: token Member A không đọc/gửi được conversation của Member B; Coach C không đọc được hội thoại của Coach D; Manager bị 403. Tài khoản khóa/xóa mềm bị 401/403 ở API.
- Kiểm tra channel: JWT session của A join `scms:chat:<B>` với `private:true` phải bị từ chối, join đúng kênh A được; browser gửi Broadcast vào namespace chat bị từ chối. Public channel cùng tên không nhận event private. Policies restrictive phải còn hiệu lực ngay cả nếu có policy SELECT/INSERT permissive rộng khác.
- Kiểm tra rollback: insert message trong transaction chưa commit không phát event; rollback không làm thay đổi lịch sử. Event `changed` có payload `{}`, không text/user profile. Secret/token không xuất hiện trong log, URL ảnh, screenshot hoặc commit.
- Kiểm tra refresh: chờ qua 5 phút, token được cấp lại và tiếp tục nhận tin. Logout đóng kênh; API từ chối key cũ nếu account bị khóa. JWT Realtime đã phát hành có thể nhận **invalidation rỗng** đến khi hết hạn (tối đa 5 phút), nhưng không đọc được nội dung qua API.

## Giới hạn

Không presence, typing, read receipts, ảnh/tệp hoặc AI. Không suy đoán “online” từ subscription socket. Tin nhắn retry cùng UUID và cùng text trả bản gốc; đổi text dùng UUID mới, nếu cố dùng lại UUID cũ với text khác thì HTTP 409. Timestamp UTC ISO-8601, giao diện hiển thị theo locale Việt Nam.
