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
     * Same as {@link #generate} but asks the provider to answer with a JSON object only,
     * for callers that parse the reply (workout plans). Clients without such a mode just generate.
     */
    default String generateJson(String systemPrompt, String userMessage) {
        return generate(systemPrompt, userMessage);
    }
}
