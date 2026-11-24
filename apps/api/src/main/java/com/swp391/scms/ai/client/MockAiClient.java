package com.swp391.scms.ai.client;

/**
 * Deterministic fallback mock AI client for test environments and offline operations.
 */
public class MockAiClient implements AiClient {

    private final String model;

    public MockAiClient() {
        this("mock-ai-engine-v1");
    }

    public MockAiClient(String model) {
        this.model = (model != null && !model.isBlank()) ? model : "mock-ai-engine-v1";
    }

    @Override
    public String getProviderName() {
        return "mock";
    }

    /** Lấy giá trị trường modelName. */
    @Override
    public String getModelName() {
        return model;
    }

    @Override
    public String generate(String systemPrompt, String userMessage) {
        return "{\"status\": \"success\", \"provider\": \"mock\", \"model\": \"" + model + "\", \"content\": \"Gợi ý giáo án luyện tập cá nhân hóa dựa trên dữ liệu sức khỏe của hội viên.\"}";
    }
}
