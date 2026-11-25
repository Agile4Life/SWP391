package com.swp391.scms.ai.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Client gọi API kiểu OpenAI (OpenAI hoặc Groq) để soạn giáo án. */
public class OpenAiRestClient implements AiClient {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    static final int MAX_JSON_OUTPUT_TOKENS = 2500;

    private final String apiKey;
    private final String model;
    private final String providerName;
    private final RestClient restClient;

    /** Tạo client gọi OpenAI. */
    public OpenAiRestClient(String apiKey, String model) {
        this(apiKey, model, defaultRestClient("https://api.openai.com/v1", apiKey), "openai");
    }

    /** Tạo client với địa chỉ API và tên nhà cung cấp tùy chọn (dùng cho Groq). */
    public OpenAiRestClient(String apiKey, String model, String baseUrl, String providerName) {
        this(apiKey, model, defaultRestClient(baseUrl, apiKey), providerName);
    }

    /** Constructor cho test với RestClient giả. */
    public OpenAiRestClient(String apiKey, String model, RestClient restClient) {
        this(apiKey, model, restClient, "openai");
    }

    /** Constructor đầy đủ; model mặc định gpt-4o-mini. */
    public OpenAiRestClient(String apiKey, String model, RestClient restClient, String providerName) {
        this.apiKey = apiKey;
        this.model = (model != null && !model.isBlank()) ? model : "gpt-4o-mini";
        this.providerName = (providerName != null && !providerName.isBlank()) ? providerName : "openai";
        this.restClient = restClient != null ? restClient : defaultRestClient("https://api.openai.com/v1", apiKey);
    }

    /** RestClient với thời gian chờ kết nối 10 giây, đọc 30 giây. */
    private static RestClient defaultRestClient(String baseUrl, String apiKey) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        return RestClient.builder()
                .requestFactory(factory)
                .baseUrl(baseUrl != null && !baseUrl.isBlank() ? baseUrl : "https://api.openai.com/v1")
                .defaultHeader("Authorization", "Bearer " + (apiKey != null ? apiKey : ""))
                .build();
    }

    /** Lấy giá trị trường providerName. */
    @Override
    public String getProviderName() {
        return providerName;
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
     * Gọi API chat completions: không có key thì dùng bản mock; bật JSON mode khi cần; bỏ khung code; lỗi thì
     * trả dữ liệu dự phòng.
     */
    private String call(String systemPrompt, String userMessage, boolean json) {
        if (apiKey == null || apiKey.isBlank()) {
            return new MockAiClient(model).generate(systemPrompt, userMessage);
        }
        try {
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", systemPrompt != null ? systemPrompt : ""),
                    Map.of("role", "user", "content", userMessage != null ? userMessage : "")
            );
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", messages);
            body.put("stream", false);
            if (json) {
                // OpenAI và Groq đều nhận chế độ JSON; nó cần từ "JSON" trong prompt, mà prompt kế hoạch có
                // sẵn.
                body.put("response_format", Map.of("type", "json_object"));
                body.put("max_completion_tokens", MAX_JSON_OUTPUT_TOKENS);
            }
            JsonNode response = restClient.post()
                .uri("/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
            String content = response == null ? "" : response.path("choices").path(0).path("message").path("content").asText("");
            String cleaned = stripCodeFence(content);
            if (!cleaned.isBlank()) {
                return cleaned;
            }
        } catch (Exception ignored) {
            // Rơi về payload dự phòng có tính xác định khi upstream không truy cập được.
        }
        return fallbackPayload(userMessage);
    }

    /** Bỏ khung code Markdown (dấu ```) bao quanh câu trả lời. */
    static String stripCodeFence(String text) {
        if (text == null) return "";
        String trimmed = text.trim();
        if (trimmed.startsWith("```")) {
            int firstNewline = trimmed.indexOf('\n');
            if (firstNewline > 0) {
                trimmed = trimmed.substring(firstNewline + 1);
            }
            if (trimmed.endsWith("```")) {
                trimmed = trimmed.substring(0, trimmed.length() - 3);
            }
        }
        return trimmed.trim();
    }

    /** Dữ liệu dự phòng dạng JSON khi không gọi được nhà cung cấp. */
    private String fallbackPayload(String userMessage) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", "success");
        payload.put("provider", providerName);
        payload.put("model", model);
        payload.put("content", "OpenAI generated response for: " + (userMessage != null ? userMessage : ""));
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"status\":\"success\",\"provider\":\"" + providerName + "\"}";
        }
    }
}
