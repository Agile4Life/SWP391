package com.swp391.scms.ai.client;

/** Cổng (interface) gọi AI để soạn giáo án; có nhiều cài đặt (OpenAI/Groq, Gemini, mock). */
public interface AiClient {

    /** Tên nhà cung cấp. */
    String getProviderName();

    /** Tên model. */
    String getModelName();

    /** Sinh câu trả lời từ system prompt và câu hỏi. */
    String generate(String systemPrompt, String userMessage);

    /**
     * Yêu cầu trả lời đúng dạng JSON (dùng khi cần đọc kết quả như giáo án); client không hỗ trợ thì sinh như
     * thường.
     *
     * Giống {@link #generate} nhưng yêu cầu nhà cung cấp chỉ trả lời bằng một đối tượng JSON, cho các nơi gọi
     * cần phân tích câu trả lời (kế hoạch tập). Client không có chế độ như vậy thì chỉ sinh nội dung.
     */
    default String generateJson(String systemPrompt, String userMessage) {
        return generate(systemPrompt, userMessage);
    }
}
