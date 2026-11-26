package com.swp391.scms.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Client gọi Google Gemini để soạn giáo án. */
public class GeminiRestClient implements AiClient {

    private static final Logger log = LoggerFactory.getLogger(GeminiRestClient.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    static final int MAX_JSON_OUTPUT_TOKENS = 2500;

    private final String apiKey;
    private final String model;
    private final RestClient restClient;

    /** Tạo client với RestClient mặc định. */
    public GeminiRestClient(String apiKey, String model) {
        this(apiKey, model, defaultRestClient());
    }

    /** Tạo client; model mặc định gemini-3-flash-preview. */
    public GeminiRestClient(String apiKey, String model, RestClient restClient) {
        this.apiKey = apiKey;
        this.model = (model != null && !model.isBlank()) ? model : "gemini-3-flash-preview";
        this.restClient = restClient != null ? restClient : defaultRestClient();
    }

    /** RestClient với thời gian chờ kết nối 10 giây, đọc 30 giây. */
    private static RestClient defaultRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    /** Tên nhà cung cấp: gemini. */
    @Override
    public String getProviderName() {
        return "gemini";
    }

    /** Lấy giá trị trường modelName. */
    @Override
    public String getModelName() {
        return model;
    }

    /** Sinh câu trả lời văn bản. */
    @Override
    public String generate(String systemPrompt, String userMessage) {
        return call(systemPrompt, userMessage, false);
    }

    /** Sinh câu trả lời dạng JSON. */
    @Override
    public String generateJson(String systemPrompt, String userMessage) {
        return call(systemPrompt, userMessage, true);
    }

    /**
     * Gọi Gemini: không có key thì dùng bản mock; bật JSON mode khi cần, bỏ phần suy nghĩ của model, bỏ khung
     * code; lỗi thì trả dữ liệu dự phòng.
     */
    private String call(String systemPrompt, String userMessage, boolean json) {
        if (apiKey == null || apiKey.isBlank()) {
            return new MockAiClient(model).generate(systemPrompt, userMessage);
        }
        try {
            Map<String, Object> generationConfig = new LinkedHashMap<>();
            generationConfig.put("temperature", 0.4);
            if (!model.contains("lite")) {
                generationConfig.put("thinkingConfig", Map.of("thinkingBudget", 0));
            }
            if (json) {
                generationConfig.put("responseMimeType", "application/json");
                generationConfig.put("maxOutputTokens", MAX_JSON_OUTPUT_TOKENS);
            }
            Map<String, Object> body = Map.of("generationConfig", generationConfig,
                    "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt != null ? systemPrompt : ""))),
                    "contents", List.of(Map.of(
                            "role", "user",
                            "parts", List.of(Map.of("text", userMessage != null ? userMessage : ""))
                    ))
            );
            JsonNode response = restClient.post()
                    .uri("/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            StringBuilder text = new StringBuilder();
            if (response != null) {
                response.path("candidates").path(0).path("content").path("parts")
                        .forEach(part -> {
                            if (!part.path("thought").asBoolean(false)) {
                                text.append(part.path("text").asText(""));
                            }
                        });
            }
            String cleaned = OpenAiRestClient.stripCodeFence(text.toString());
            if (!cleaned.isBlank()) {
                return cleaned;
            }
        } catch (RestClientResponseException ex) {
            log.warn("AI provider 'gemini' (model '{}') returned HTTP {}", model, ex.getStatusCode().value());
        } catch (Exception ex) {
            // Không ghi API key, body hay prompt/PII vào log.
            log.warn("AI provider 'gemini' (model '{}') call failed: {}", model, ex.getClass().getSimpleName());
        }
        return fallbackPayload(userMessage);
    }

    /** Dữ liệu dự phòng dạng JSON khi không gọi được Gemini. */
    private String fallbackPayload(String userMessage) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", "success");
        payload.put("provider", "gemini");
        payload.put("model", model);
        payload.put("content", "Gemini generated response for: " + (userMessage != null ? userMessage : ""));
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"status\":\"success\",\"provider\":\"gemini\"}";
        }
    }
}
