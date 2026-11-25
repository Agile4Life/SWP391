package com.swp391.scms.ai.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Đăng ký AiClient đang dùng theo cấu hình (OpenAI, Groq, Gemini); không có API key thì tự dùng MockAiClient.
 *
 * Cấu hình Spring đăng ký {@link AiClient} đang dùng. Tự động quay về {@link MockAiClient} khi không có API
 * key hoặc chọn mock.
 */
@Configuration
public class AiClientConfig {

    @Value("${scms.ai.provider:mock}")
    private String provider;

    @Value("${scms.ai.api-key:}")
    private String apiKey;

    @Value("${scms.ai.model:}")
    private String model;

    /**
     * Chọn AiClient: đọc cấu hình (thiếu thì đọc .env), có key thì tạo client tương ứng, không thì dùng bản
     * mock.
     */
    @Bean
    public AiClient aiClient() {
        String effectiveProvider = provider;
        String effectiveApiKey = apiKey;
        String effectiveModel = model;
        if ((effectiveApiKey == null || effectiveApiKey.isBlank())
                && (effectiveProvider == null || effectiveProvider.isBlank() || "mock".equalsIgnoreCase(effectiveProvider))) {
            var dotEnv = AiChatProvider.readDefaultDotEnv();
            effectiveProvider = dotEnv.getOrDefault("SCMS_AI_PROVIDER", effectiveProvider);
            effectiveApiKey = dotEnv.getOrDefault("SCMS_AI_API_KEY", effectiveApiKey);
            effectiveModel = dotEnv.getOrDefault("SCMS_AI_MODEL", effectiveModel);
        }
        if ("openai".equalsIgnoreCase(effectiveProvider) && effectiveApiKey != null && !effectiveApiKey.isBlank()) {
            return new OpenAiRestClient(effectiveApiKey, effectiveModel);
        } else if ("groq".equalsIgnoreCase(effectiveProvider) && effectiveApiKey != null && !effectiveApiKey.isBlank()) {
            String groqModel = (effectiveModel != null && !effectiveModel.isBlank()) ? effectiveModel : "llama-3.3-70b-versatile";
            return new OpenAiRestClient(effectiveApiKey, groqModel, "https://api.groq.com/openai/v1", "groq");
        } else if ("gemini".equalsIgnoreCase(effectiveProvider) && effectiveApiKey != null && !effectiveApiKey.isBlank()) {
            return new GeminiRestClient(effectiveApiKey, effectiveModel);
        }
        return new MockAiClient(effectiveModel);
    }
}
