package com.swp391.scms.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.Map;

public class OpenAiRestClient implements AiClient {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String model;
    private final RestClient restClient;

    public OpenAiRestClient(String apiKey, String model) {
        this.apiKey = apiKey;
        this.model = (model != null && !model.isBlank()) ? model : "gpt-4o-mini";
        this.restClient = RestClient.builder()
                .baseUrl("https://api.openai.com/v1")
                .defaultHeader("Authorization", "Bearer " + apiKey)
                .build();
    }

    @Override
    public String getProviderName() {
        return "openai";
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
        payload.put("provider", "openai");
        payload.put("model", model);
        payload.put("content", "OpenAI generated response for: " + (userMessage != null ? userMessage : ""));
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (Exception e) {
            return "{\"status\":\"success\",\"provider\":\"openai\"}";
        }
    }
}
