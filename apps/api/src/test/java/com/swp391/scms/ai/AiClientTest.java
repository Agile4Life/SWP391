package com.swp391.scms.ai;

import com.swp391.scms.ai.client.AiClient;
import com.swp391.scms.ai.client.AiClientConfig;
import com.swp391.scms.ai.client.GeminiRestClient;
import com.swp391.scms.ai.client.MockAiClient;
import com.swp391.scms.ai.client.OpenAiRestClient;
import com.swp391.scms.ai.entity.AiRecommendationLog;
import com.swp391.scms.ai.repository.AiRecommendationLogRepository;
import com.swp391.scms.ai.service.AiRecommendationService;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

@ExtendWith(MockitoExtension.class)
class AiClientTest {

    @Mock
    private AiRecommendationLogRepository recommendationLogRepository;

    @Mock
    private MemberRepository memberRepository;

    @Test
    @DisplayName("MockAiClient should return valid model name and non-empty response")
    void testMockAiClient() {
        AiClient client = new MockAiClient("mock-test-model");
        assertEquals("mock", client.getProviderName());
        assertEquals("mock-test-model", client.getModelName());

        String response = client.generate("system", "user input");
        assertNotNull(response);
        assertTrue(response.contains("Gợi ý"));
    }

    @Test
    @DisplayName("AiClientConfig should fallback to MockAiClient when apiKey is empty")
    void testAiClientConfigFallback() {
        AiClientConfig config = new AiClientConfig();
        ReflectionTestUtils.setField(config, "provider", "openai");
        ReflectionTestUtils.setField(config, "apiKey", "");
        ReflectionTestUtils.setField(config, "model", "gpt-4o-mini");

        AiClient client = config.aiClient();
        assertNotNull(client);
        assertEquals("mock", client.getProviderName());
    }

    @Test
    @DisplayName("OpenAiRestClient should call OpenAI chat completions endpoint and strip markdown fences")
    void testOpenAiRestClientHttpCall() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://api.openai.com/v1");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.openai.com/v1/chat/completions"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-openai-key"))
                .andRespond(withSuccess(
                        "{\"choices\":[{\"message\":{\"content\":\"```json\\n{\\\"goal\\\":\\\"Hypertrophy\\\",\\\"analysis\\\":\\\"OK\\\",\\\"items\\\":[]}\\n```\"}}]}",
                        MediaType.APPLICATION_JSON));

        OpenAiRestClient client = new OpenAiRestClient("test-openai-key", "gpt-4o-mini", builder.build());
        String result = client.generate("system prompt", "user prompt");

        assertEquals("{\"goal\":\"Hypertrophy\",\"analysis\":\"OK\",\"items\":[]}", result);
        server.verify();
    }

    @Test
    @DisplayName("GeminiRestClient should call Gemini generateContent endpoint and extract candidate text")
    void testGeminiRestClientHttpCall() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://generativelanguage.googleapis.com/v1beta");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-gemini-key"))
                .andRespond(withSuccess(
                        "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{\\\"goal\\\":\\\"Mobility\\\",\\\"analysis\\\":\\\"Good\\\",\\\"items\\\":[]}\"}]}}]}",
                        MediaType.APPLICATION_JSON));

        GeminiRestClient client = new GeminiRestClient("test-gemini-key", "gemini-1.5-flash", builder.build());
        String result = client.generate("system prompt", "user prompt");

        assertEquals("{\"goal\":\"Mobility\",\"analysis\":\"Good\",\"items\":[]}", result);
        server.verify();
    }

    @Test
    @DisplayName("AiRecommendationService should generate recommendation and save log")
    void testAiRecommendationService() {
        AiClient client = new MockAiClient();
        AiRecommendationService service = new AiRecommendationService(client, recommendationLogRepository, memberRepository);

        Member member = new Member();
        member.setUserId(1L);
        member.setMembershipCode("MBR-001");

        when(memberRepository.findById(1L)).thenReturn(Optional.of(member));
        when(recommendationLogRepository.save(any(AiRecommendationLog.class))).thenAnswer(i -> i.getArgument(0));

        String result = service.generateRecommendation(1L, "Hội viên muốn tăng cơ giảm mỡ");
        assertNotNull(result);
        verify(recommendationLogRepository).save(any(AiRecommendationLog.class));
    }
}
