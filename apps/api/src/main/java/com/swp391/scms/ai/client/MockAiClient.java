package com.swp391.scms.ai.client;

/**
 * Client AI giả cho test và khi chạy không có mạng/API key: luôn trả cùng một nội dung.
 *
 * Client AI mock dự phòng có tính xác định cho môi trường test và hoạt động ngoại tuyến.
 */
public class MockAiClient implements AiClient {

    private final String model;

    /** Constructor với tên model mặc định. */
    public MockAiClient() {
        this("mock-ai-engine-v1");
    }

    /** Constructor với tên model tùy chọn. */
    public MockAiClient(String model) {
        this.model = (model != null && !model.isBlank()) ? model : "mock-ai-engine-v1";
    }

    /** Tên nhà cung cấp: mock. */
    @Override
    public String getProviderName() {
        return "mock";
    }

    /** Lấy giá trị trường modelName. */
    @Override
    public String getModelName() {
        return model;
    }

    /** Trả nội dung JSON cố định kèm tên model. */
    @Override
    public String generate(String systemPrompt, String userMessage) {
        return "{\"status\": \"success\", \"provider\": \"mock\", \"model\": \"" + model + "\", \"content\": \"Gợi ý giáo án luyện tập cá nhân hóa dựa trên dữ liệu sức khỏe của hội viên.\"}";
    }
}
