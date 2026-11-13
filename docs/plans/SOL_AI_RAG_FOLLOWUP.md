# Sol AI / RAG — việc còn lại cho agent tiếp theo

Tài liệu bàn giao. Đọc `AGENTS.md` và `docs/rules/backend-architecture.md` trước khi làm; với phần giao diện đọc thêm `DESIGN.md`.

## Bối cảnh

Module AI nằm ở `apps/api/src/main/java/com/swp391/scms/ai/`. Có hai luồng:

| Luồng | Điểm vào | Dịch vụ | Client gọi model |
|---|---|---|---|
| Chat Sol AI | `AiChatController` (`/api/v1/ai/chat/...`) | `AiChatService` + `AiRagContextService` | `AiChatProvider` (không bao giờ trả nội dung giả) |
| Gợi ý giáo án | `AiRecommendationController` (`POST /api/v1/ai/generate-workout-plan`) | `AiRecommendationService` | `AiClient` (`GeminiRestClient`, `OpenAiRestClient`, `MockAiClient`) |

"RAG" ở đây là đưa dữ liệu thật từ database vào prompt, không dùng vector. Giữ nguyên hướng này: dữ liệu chỉ vài chục dòng, **không thêm pgvector, embedding hay bảng mới cho việc truy xuất**.

### Đã làm xong

Commit `6002bdda` ("RAG"):
- `AiRagContextService`: chọn buổi học theo câu hỏi khi lịch tuần vượt 15 buổi; ghi thời điểm hiện tại và thứ trong tuần; sửa "Thứ 8" thành "Chủ nhật"; cache hội viên giới hạn 500 mục.
- `AiChatService`: system prompt mới (chỉ dùng số liệu trong khối dữ liệu), ghép câu hỏi trước với câu hiện tại để truy xuất.
- `AiRecommendationService`: prompt giáo án có cấu trúc JSON, quy ước `dayOfWeek`, số tuần, diễn biến cân nặng, giáo án đang áp dụng, thiết bị; `parseItems` đọc từng item.
- `DemoDataSeeder.java`: bỏ `setRepeatType` khiến `main` không biên dịch.

Đợt sau (chưa commit):
- Giới hạn đầu ra chat 600 token (`AiChatProvider.MAX_OUTPUT_TOKENS`, cả Gemini lẫn OpenAI/Groq qua `max_completion_tokens`).
- `AiClient.generateJson`: JSON mode (`responseMimeType` cho Gemini, `response_format` cho OpenAI/Groq), chỉ luồng giáo án dùng.
- `AiKnowledgeBase` + `src/main/resources/ai/sol-knowledge.md`: quy định trung tâm tách ra file, số liệu là placeholder lấy từ code/cấu hình, mục "Quyền lợi theo hạng gói" sinh từ `PackageBenefits`; chỉ gửi mục khớp câu hỏi.
- 58 test `Ai*Test` qua.

Chưa làm: thử với provider thật.

### Chạy test

Máy này không có JDK. Chạy qua Docker từ **gốc repo** (một số test đọc `db/` và `.agents/` ở gốc, nên phải mount cả repo):

```bash
docker run --rm -v "$PWD":/repo -v "$HOME/.m2":/root/.m2 -v /repo/apps/api/target -w /repo/apps/api maven:3.9-eclipse-temurin-21 mvn -o test -Dtest='Ai*Test' -Dsurefire.failIfNoSpecifiedTests=false
```

Bỏ `-Dtest=...` để chạy toàn bộ (1414 test; 38 test PostgreSQL tích hợp bị bỏ qua khi không có DB). Bỏ `-o` nếu thiếu dependency trong `~/.m2`.

## Việc cần làm

Làm theo thứ tự. Mỗi việc là một commit riêng. Không thêm trailer `Co-Authored-By` của Claude vào commit.

### 1. ~~Báo rõ khi giáo án là bản dự phòng~~ — KHÔNG LÀM

Người dùng quyết định không hiện cảnh báo này cho HLV. Đừng thêm lại.

### 2. ~~Nới giới hạn đầu ra và JSON mode~~ — ĐÃ XONG

### 3. ~~Chat cho HLV, quản lý, lễ tân~~ — ĐÃ XONG (chưa commit)

Quyết định của người dùng: **lễ tân hỏi được Sol AI, HLV chỉ dùng gợi ý giáo án**.
- `AiChatController`: chỉ `MEMBER`, `RECEPTIONIST`, `CENTER_MANAGER`; `COACH` nhận 403. `AiChatService` cũng tự chặn vai trò khác.
- Phiên của lễ tân/quản lý: `AiChatSession.member` để trống, `staffUser` (cột `staff_user_id`) là chủ phiên. `postgresql-triggers.sql` bỏ NOT NULL của `ai_chat_sessions.member_id` trên DB cũ. Phía người hỏi vẫn lưu `sender = 'member'` vì ràng buộc `ck_chat_sender`.
- Ngữ cảnh lễ tân: catalog + file tri thức, không có hồ sơ hội viên; prompt riêng `STAFF_SYSTEM_PROMPT`.
- Mỗi phiên chỉ chủ phiên đọc được (trước đây mọi tài khoản không phải hội viên đọc được phiên của người khác).
- Giới hạn tần suất đếm cả phiên của nhân viên.
- Frontend: `ChatPage` ẩn mục SÖL AI với HLV; lời giới thiệu và placeholder riêng cho lễ tân.
- OpenAPI: `docs/api-contracts/openapi-sprint3-ai-chat.yaml` bản 1.1.0.

Chưa kiểm chứng trên PostgreSQL thật: câu JPQL mới của `AiChatMessageRepository.memberMessageTimesSince` và bước `DROP NOT NULL` (test tích hợp PostgreSQL bị bỏ qua khi không có DB).

### 4. ~~Nội dung quy định~~ — ĐÃ XONG, còn chờ nội dung từ trung tâm

Sửa nội dung ở `apps/api/src/main/resources/ai/sol-knowledge.md` (hướng dẫn cú pháp ở đầu file). Mọi con số trong file là `{{placeholder}}`; thêm placeholder mới thì khai báo trong `AiKnowledgeBase.values`. Placeholder sai tên làm ứng dụng không khởi động được (có chủ đích).

Quy định chưa có nguồn, cần trung tâm cung cấp trước khi thêm vào file:
- Giờ mở cửa trung tâm (giờ sân 06:00–22:00 chỉ có trong dữ liệu seed `CourtSeeder`, không phải quy định).
- Chính sách hủy đặt sân, có hoàn tiền không.
- Số điện thoại, email liên hệ.
- Gửi xe, tủ đồ, khăn, nội quy phòng tập.

Tài liệu nghiệp vụ lệch với code ở thời gian giữ đơn shop (tài liệu: 15 phút / 24 giờ; code mặc định: 30 phút / 48 giờ). File tri thức theo code.

## Ràng buộc

- Giữ ba pha hiện có ở cả hai dịch vụ: đọc trong transaction ngắn, gọi model ngoài transaction, ghi trong transaction ngắn. Có test kiểm tra điều này.
- Không trả entity ra API; dùng DTO.
- Thông báo backend mới phải có key ở cả `i18n/messages_vi.properties` và `i18n/messages_en.properties`.
- Không ghi prompt, API key hay phản hồi thô của provider vào log hoặc thông báo lỗi.
- Không thêm provider AI mới, không đổi database, không thêm migration DDL.
- Hội viên không được thấy dữ liệu của hội viên khác qua ngữ cảnh chat; mọi truy vấn hồ sơ phải lọc theo hội viên của phiên.
