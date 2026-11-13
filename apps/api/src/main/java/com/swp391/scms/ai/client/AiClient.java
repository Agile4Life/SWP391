package com.swp391.scms.ai.client;

public interface AiClient {

    String getProviderName();

    String getModelName();

    String generate(String systemPrompt, String userMessage);

    /**
     * Same as {@link #generate} but asks the provider to answer with a JSON object only,
     * for callers that parse the reply (workout plans). Clients without such a mode just generate.
     */
    default String generateJson(String systemPrompt, String userMessage) {
        return generate(systemPrompt, userMessage);
    }
}
