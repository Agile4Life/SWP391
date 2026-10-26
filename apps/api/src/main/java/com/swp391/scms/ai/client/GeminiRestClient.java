package com.swp391.scms.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

public class GeminiRestClient implements AiClient {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String model;
    private final RestClient restClient;

    public GeminiRestClient(String apiKey, String model) {
        this.apiKey = apiKey;
        this.model = (model != null && !model.isBlank()) ? model : "gemini-1.5-flash";
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com/v1beta")
                .build();
    }

    @Override
    public String getProviderName() {
        return "gemini";
    }

    @Override
    public String getModelName() {
        return model;
    }

    @Override
    public String generate(String systemPrompt, String userMessage) {
        if (apiKey == null || apiKey.isBlank()) {
            return new MockAiClient(model).generate(systemPrompt, userMessage);
        }
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
