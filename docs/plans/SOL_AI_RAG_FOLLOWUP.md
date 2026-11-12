# Sol AI / RAG — việc còn lại cho agent tiếp theo

Tài liệu bàn giao. Đọc `AGENTS.md` và `docs/rules/backend-architecture.md` trước khi làm; với phần giao diện đọc thêm `DESIGN.md`.

## Bối cảnh

Module AI nằm ở `apps/api/src/main/java/com/swp391/scms/ai/`. Có hai luồng:

| Luồng | Điểm vào | Dịch vụ | Client gọi model |
|---|---|---|---|
| Chat Sol AI | `AiChatController` (`/api/v1/ai/chat/...`) | `AiChatService` + `AiRagContextService` | `AiChatProvider` (không bao giờ trả nội dung giả) |
| Gợi ý giáo án | `AiRecommendationController` (`POST /api/v1/ai/generate-workout-plan`) | `AiRecommendationService` | `AiClient` (`GeminiRestClient`, `OpenAiRestClient`, `MockAiClient`) |

"RAG" ở đây là đưa dữ liệu thật từ database vào prompt, không dùng vector. Giữ nguyên hướng này: dữ liệu chỉ vài chục dòng, **không thêm pgvector, embedding hay bảng mới cho việc truy xuất**.

### Đã làm xong (đang ở working tree, chưa commit)

- `AiRagContextService`: chọn buổi học theo câu hỏi khi lịch tuần vượt 15 buổi (bộ môn, tên lớp, HLV, ngày được hỏi, buổi hội viên đã đặt); ghi thời điểm hiện tại và thứ trong tuần; sửa "Thứ 8" thành "Chủ nhật"; cache hội viên giới hạn 500 mục.
- `AiChatService`: system prompt mới (chỉ dùng số liệu trong khối dữ liệu), ghép câu hỏi trước với câu hiện tại để truy xuất, bỏ hàm `generateContextualReply` không dùng.
- `AiRecommendationService`: system prompt có cấu trúc JSON và quy ước `dayOfWeek` (1 = Thứ Hai … 7 = Chủ nhật); prompt gửi thêm số tuần, diễn biến cân nặng, giáo án đang áp dụng, thiết bị đang hoạt động; `parseItems` đọc từng item và đưa giá trị về khoảng hợp lệ.
- `DemoDataSeeder.java`: bỏ dòng `gymClass.setRepeatType("weekly")` vì `GymClass` không còn trường này và `main` không biên dịch được.
- Test: `AiRagContextServiceTest`, `AiRecommendationControllerTest` có thêm ca mới; 51 test `Ai*Test` qua.

Chưa làm: chạy toàn bộ bộ test, thử với provider thật.

### Chạy test

Máy này không có JDK. Chạy qua Docker từ `apps/api`:

```bash
docker run --rm -v "$PWD":/app -v "$HOME/.m2":/root/.m2 -v /app/target -w /app maven:3.9-eclipse-temurin-21 mvn -o test -Dtest='Ai*Test' -Dsurefire.failIfNoSpecifiedTests=false
```

Bỏ `-Dtest=...` để chạy toàn bộ. Bỏ `-o` nếu thiếu dependency trong `~/.m2`.

## Việc cần làm

Làm theo thứ tự. Mỗi việc là một commit riêng. Không thêm trailer `Co-Authored-By` của Claude vào commit.

### 1. Báo rõ khi giáo án là bản dự phòng

**Vấn đề.** Khi provider lỗi hoặc trả về thứ không đọc được, `AiRecommendationService.parseOrBuildStructuredItems` trả 3 bài mẫu cố định (Goblet Squat, Incline Dumbbell Press, Romanian Deadlift). Response vẫn ghi `modelName` của model thật, nên HLV tưởng đó là giáo án do AI tạo. `GeminiRestClient` và `OpenAiRestClient` còn nuốt mọi exception và trả một payload `{"status":"success","content":"... generated response for: ..."}`.

**Cần làm.**
- Thêm trường boolean vào `AiWorkoutPlanResponse` (gợi ý tên `fallback`), bằng `true` khi danh sách bài không đến từ model. Lưu cùng vào JSON `recommendedContent` của `AiRecommendationLog` để `getMemberRecommendations` đọc lại đúng; không thêm cột mới.
- Cập nhật OpenAPI trong `docs/api-contracts/` cùng commit.
- Giao diện `apps/web/src/features/coaching/CoachTrainingPlanPage.tsx`: khi `fallback` là `true`, hiện thông báo rằng AI tạm thời không phản hồi và đây là giáo án mẫu để HLV tự chỉnh. Chuỗi mới phải đi qua `t(...)` và có bản tiếng Anh.

**Xong khi.**
- Test: model trả JSON hợp lệ có item → `fallback` là `false`; model trả chuỗi rỗng, JSON hỏng hoặc `items` rỗng → `fallback` là `true`.
- Test giao diện cho thông báo ở `CoachTrainingPlanPage.test.tsx`.
- Ca `shouldGenerateStructuredWorkoutPlanAndLog` hiện có vẫn qua (nó dùng `MockAiClient`, tức là đi nhánh dự phòng).

### 2. Nới giới hạn đầu ra của chat và bật JSON mode cho giáo án

**Vấn đề.** `AiChatProvider.callGeminiModel` đặt `maxOutputTokens` là 350; câu trả lời liệt kê lịch bằng tiếng Việt có thể bị cắt giữa chừng. `GeminiRestClient.generate` không yêu cầu JSON nên phụ thuộc vào việc gỡ code fence.

**Cần làm.**
- Nâng `maxOutputTokens` của chat lên khoảng 600 và áp cùng giới hạn cho nhánh OpenAI/Groq (`max_tokens`). Kiểm tra `AiChatProviderTest` xem có assert thân request không rồi cập nhật.
- Với giáo án: thêm `responseMimeType: application/json` vào `generationConfig` của Gemini và `response_format: {"type":"json_object"}` cho OpenAI/Groq. `AiClient.generate` cũng được `generateRecommendation` dùng cho văn bản tự do, nên phải có cách chỉ bật JSON cho luồng giáo án (ví dụ thêm một phương thức mặc định `generateJson` trên `AiClient`), không bật cho mọi lời gọi.

**Xong khi.** Test của client xác nhận thân request có các trường trên chỉ ở luồng JSON; `AiClientTest` và `AiChatProviderTest` qua.

### 3. Chat cho HLV, quản lý, lễ tân

**Vấn đề (mới đọc code, chưa chạy thử — hãy tái hiện trước).** `AiChatController` cho phép `MEMBER`, `COACH`, `CENTER_MANAGER`, `RECEPTIONIST`, nhưng `AiChatSession` bắt buộc gắn với `Member`. `AiChatService.sendQuickMessage` gọi `createSession` với `memberId = currentUserId`, và `resolveTargetMember` tra `memberRepository.findById`, nên tài khoản nhân viên nhiều khả năng nhận 404.

**Cần làm.**
- Viết test tái hiện cho một tài khoản `COACH` gửi tin nhắn nhanh.
- Nếu đúng là lỗi: hỏi người dùng muốn hướng nào trước khi sửa — (a) chỉ cho `MEMBER` dùng chat và ẩn widget với vai trò khác, hay (b) cho nhân viên chat với ngữ cảnh chỉ gồm catalog, không có hồ sơ hội viên. Hướng (b) đòi `AiChatSession.member` cho phép null, tức là đổi entity.
- Không tự chọn hướng (b) khi chưa được xác nhận.

### 4. Nội dung quy định để trả lời khách

**Vấn đề.** `AiRagContextService.appendPolicyContext` chỉ có 4 dòng viết cứng trong code. Sol AI không có dữ liệu về giờ mở cửa, quy định bảo lưu, đặt sân, ví, shop, hủy gói.

**Cần làm.**
- Chuyển nội dung ra một file tài nguyên (gợi ý `apps/api/src/main/resources/ai/sol-knowledge.md`), nạp một lần lúc khởi động, để nhóm sửa nội dung mà không đụng code Java.
- Chỉ đưa vào những quy định xác minh được từ `docs/PROJECT_MASTER_GUIDE.md` hoặc từ chính code nghiệp vụ. **Không tự đặt ra giờ mở cửa, mức phí, số ngày bảo lưu.** Mục nào không có nguồn thì liệt kê lại cho người dùng để họ cung cấp.
- Khi file dài hơn khoảng 40 dòng, chia theo đề mục và chỉ đưa vào prompt những mục khớp câu hỏi, dùng lại `normalize` và cách so từ đã có trong `AiRagContextService`.

**Xong khi.** Test xác nhận nội dung file xuất hiện trong ngữ cảnh; 4 dòng cũ vẫn còn (chuyển sang file); danh sách mục thiếu nguồn được báo lại.

## Ràng buộc

- Giữ ba pha hiện có ở cả hai dịch vụ: đọc trong transaction ngắn, gọi model ngoài transaction, ghi trong transaction ngắn. Có test kiểm tra điều này.
- Không trả entity ra API; dùng DTO.
- Thông báo backend mới phải có key ở cả `i18n/messages_vi.properties` và `i18n/messages_en.properties`.
- Không ghi prompt, API key hay phản hồi thô của provider vào log hoặc thông báo lỗi.
- Không thêm provider AI mới, không đổi database, không thêm migration DDL.
- Hội viên không được thấy dữ liệu của hội viên khác qua ngữ cảnh chat; mọi truy vấn hồ sơ phải lọc theo hội viên của phiên.
