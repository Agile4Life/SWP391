# Kiểm chứng Chat riêng 1–1 & Supabase Realtime (SCRUM-106 / SCRUM-128)

Ngày kiểm chứng: 29/10/2026
Nhánh: `feat/SCRUM-106-direct-chat-realtime`

## 1. Phạm vi đã triển khai

- **Hợp đồng API & Đặc tả (`7c5d4da`):**
  - `docs/api-contracts/openapi-direct-chat.yaml`, `docs/superpowers/specs/2026-10-29-direct-chat-design.md`, `docs/superpowers/plans/2026-10-29-direct-chat.md`.
- **Backend Persistence, Phân quyền & i18n (`f180bfc`, `397756d`):**
  - JPA Code-First (`ChatConversation`, `ChatMessage`) với unique constraint cặp `(member_user_id, staff_user_id)` và khóa chống gửi trùng `(conversation_id, sender_user_id, client_message_id)`.
  - Khóa bi quan (`PESSIMISTIC_WRITE`) trên dòng `User` của Member khi mở hội thoại và trên `ChatConversation` khi gửi tin để chống race condition đa instance.
  - Kiểm tra quyền 2 lớp (`@PreAuthorize` tại Controller + kiểm tra thành viên hội thoại, trạng thái `active`, `deleted_at IS NULL` và khớp role tại `ChatService`).
  - Đầy đủ message key trên cả 3 bundle: `messages.properties`, `messages_vi.properties`, `messages_en.properties`.
- **Supabase Realtime Private Broadcast (`ff58682`, `397756d`):**
  - `POST /api/v1/chat/realtime-session` trả `Cache-Control: no-store` và cấp JWT HS256 ngắn hạn (5 phút) chỉ có quyền nhận kênh riêng `scms:chat:<userId>`.
  - Trigger `scms_chat_realtime_invalidation` trong `db/triggers/postgresql-triggers.sql` phát tín hiệu rỗng (`{}`) tới cả hai người tham gia sau khi `INSERT` vào `chat_messages`.
  - Cài đặt RLS policy `scms_chat_receive` (permissive SELECT), `scms_chat_receive_guard` (restrictive SELECT) và `scms_chat_send_guard` (restrictive INSERT) trên `realtime.messages` khi ở schema `public`.
- **Giao diện `/messages` cho Member, Receptionist, Coach:**
  - Tích hợp `subscribeChat` (`setAuth` trước khi join kênh `private: true`, giữ token qua `accessToken` callback của SDK khi heartbeat/reconnect, tự gia hạn trước khi hết hạn 60 giây, đồng bộ bù qua `afterId` cursor khi kết nối lại/focus/online).
  - Giao diện danh bạ tìm kiếm Lễ tân/HLV cho Member, danh sách hội thoại phân trang, lịch sử tin nhắn theo cursor (`beforeId`/`afterId`), giữ vị trí cuộn khi đọc tin cũ, giữ bản nháp và UUID khi gửi lỗi để retry an toàn, hiển thị text thuần chống XSS.

## 2. Kết quả kiểm thử tự động

- **Backend (`./mvnw.cmd test`):**
  - **669 tests run, 0 failures, 0 errors, 20 skipped.**
  - Bộ test mới gồm: `ChatServiceTest`, `ChatControllerTest`, `ChatSecurityTest`, `ChatRealtimeServiceTest`, `ChatPostgreSqlTest` (cùng toàn bộ `DatabasePolicyTest` và `DatabaseProfilesTest`).
- **Chính sách cấu hình Database (`./scripts/test-database-config.ps1`):**
  - **PASS** — chỉ dùng Supabase PostgreSQL (`supabase` profile, JDBC TLS), không có H2/SQL Server/MySQL hay migration DDL mới.
- **Frontend (`npm --prefix apps/web test`, `run build`, `run lint`):**
  - **Vitest:** 55 test files passed, **337 tests passed** (trong đó 21 tests tại `src/features/chat/`).
  - **Build (`tsc -b && vite build`):** **PASS** (exit code 0).
  - **Lint (`eslint . --max-warnings=0`):** **PASS** (0 errors, 0 warnings).
- **Browser Smoke Verification (Playwright Headless Chromium trên `http://127.0.0.1:5174/messages`):**
  - **Desktop `1440×900` (Dark & Light theme) — `MEMBER`:** Mở danh bạ, tìm và mở hội thoại với `Coach Linh`, chuyển focus vào tiêu đề hội thoại, hiển thị text thuần với chuỗi `<img src=x onerror=alert(1)>`, tải tin nhắn cũ hơn qua cursor, lỗi gửi giữ nguyên bản nháp và gửi lại với đúng `clientMessageId` UUID ban đầu, hội thoại với nhân sự ngừng hoạt động ở chế độ chỉ đọc. Kiểm tra màu nền shell (`#202020` / `#f5f5f3`), sidebar icon `76px`, và bubble người gửi (`#ce9180` với chữ `#202020` ở cả hai chế độ sáng/tối). **PASS.**
  - **Desktop `1440×900` — `STAFF` (Lễ tân) & `COACH` (HLV):** Mở `/messages`, không hiển thị nút mở danh bạ của hội viên, chọn hội thoại và phản hồi bằng `Ctrl+Enter`. **PASS.**
  - **Desktop `1440×900` — `MANAGER`:** Bị `RoleGuard` chuyển hướng về `/manager/users`, không phát sinh request tới `/api/v1/chat/*`. **PASS.**
  - **Mobile `390×844` — `MEMBER`:** Chuyển đổi giữa danh sách hội thoại và luồng tin nhắn qua nút `← Danh sách`, trả focus về `#chat-inbox-title`, không tràn ngang (`scrollWidth <= clientWidth`). **PASS.**

## 3. Các hạng mục Skipped do cấu hình môi trường

- **`ChatPostgreSqlTest` (2 tests) & bộ test DB thật (`SCMS_POSTGRES_TEST_*`):**
  - Môi trường hiện tại chưa cấu hình `SCMS_POSTGRES_TEST_URL`, `SCMS_POSTGRES_TEST_USERNAME`, `SCMS_POSTGRES_TEST_PASSWORD` cho project Supabase dev/test. Do đó 20 bài tích hợp PostgreSQL thật (bao gồm 2 bài trong `ChatPostgreSqlTest`) ở trạng thái **SKIPPED** theo đúng cơ chế `@EnabledIfEnvironmentVariable`.
- **Kết nối WebSocket Supabase Realtime kênh riêng thực tế (`SUPABASE_CHAT_JWT_SECRET`):**
  - Môi trường hiện có `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY`, nhưng chưa cấu hình biến bí mật `SUPABASE_CHAT_JWT_SECRET` (legacy JWT secret HS256 của project Supabase). Backend trả `enabled: false` tại `/api/v1/chat/realtime-session`, giao diện hiển thị rõ trạng thái `"Cập nhật trực tiếp chưa được cấu hình"` và hoạt động đầy đủ qua HTTP API. Hướng dẫn cấu hình và kiểm thử 2 trình duyệt đã được ghi tại `docs/setup/direct-chat.md`.
