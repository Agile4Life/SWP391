package com.swp391.scms.ai.client;

import java.util.Map;
import java.util.function.Supplier;
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

    /** Nguồn đọc .env mặc định; có thể thay trong unit test để không phụ thuộc file .env trên máy. */
    private Supplier<Map<String, String>> dotEnvSupplier = AiChatProvider::readDefaultDotEnv;

    /**
     * Chọn AiClient: đọc cấu hình (thiếu trường nào đọc trường đó từ .env độc lập với provider), có key thì
     * tạo client tương ứng, không thì dùng bản mock.
     */
    @Bean
    public AiClient aiClient() {
        String effectiveProvider = provider;
        String effectiveApiKey = apiKey;
        String effectiveModel = model;
        boolean needProvider = effectiveProvider == null || effectiveProvider.isBlank()
                || "mock".equalsIgnoreCase(effectiveProvider.trim());
        boolean needApiKey = effectiveApiKey == null || effectiveApiKey.isBlank();
        boolean needModel = effectiveModel == null || effectiveModel.isBlank();
        if (needProvider || needApiKey || needModel) {
            Map<String, String> dotEnv = dotEnvSupplier != null ? dotEnvSupplier.get() : Map.of();
            if (dotEnv != null) {
                if (needProvider) {
                    effectiveProvider = dotEnv.getOrDefault("SCMS_AI_PROVIDER", effectiveProvider);
                }
                if (needApiKey) {
                    effectiveApiKey = dotEnv.getOrDefault("SCMS_AI_API_KEY", effectiveApiKey);
                }
                if (needModel) {
                    effectiveModel = dotEnv.getOrDefault("SCMS_AI_MODEL", effectiveModel);
                }
            }
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
