package com.swp391.scms.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.swp391.scms.ai.dto.AiChatMessageCreateDto;
import com.swp391.scms.ai.dto.AiChatMessageDto;
import com.swp391.scms.ai.dto.AiChatReplyDto;
import com.swp391.scms.ai.dto.AiChatSessionCreateDto;
import com.swp391.scms.ai.dto.AiChatSessionDto;
import com.swp391.scms.ai.service.AiChatService;
import com.swp391.scms.common.GlobalExceptionHandler;
import com.swp391.scms.common.i18n.MessageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AiChatControllerTest {

    @Mock
    private AiChatService aiChatService;

    @Mock
    private MessageService messageService;

    private MockMvc mockMvc;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        lenient().when(messageService.getMessage(any())).thenAnswer(inv -> inv.getArgument(0));
        AiChatController controller = new AiChatController(aiChatService, messageService);
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler(messageService))
                .build();
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    }

    @Test
    void createSession_Returns201() throws Exception {
        AiChatSessionDto dto = new AiChatSessionDto(
                500L, 100L, "Tư vấn tập Gym", LocalDateTime.now(), null
        );
        when(aiChatService.createSession(any(), any(), any())).thenReturn(dto);

        mockMvc.perform(post("/api/v1/ai/chat/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AiChatSessionCreateDto(100L, "Tư vấn tập Gym"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(500))
                .andExpect(jsonPath("$.data.topic").value("Tư vấn tập Gym"));
    }

    @Test
    void sendMessage_Returns201WithAiReply() throws Exception {
        AiChatMessageDto memberMsg = new AiChatMessageDto(1L, 500L, "member", "Lịch tập Yoga?", LocalDateTime.now());
        AiChatMessageDto aiMsg = new AiChatMessageDto(2L, 500L, "ai", "Trợ lý SCMS: Bạn có thể tra cứu lịch lớp Yoga...", LocalDateTime.now());
        AiChatReplyDto reply = new AiChatReplyDto(500L, memberMsg, aiMsg, aiMsg.message());

        when(aiChatService.sendMessage(eq(500L), any(AiChatMessageCreateDto.class), any(), any())).thenReturn(reply);

        mockMvc.perform(post("/api/v1/ai/chat/sessions/500/messages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AiChatMessageCreateDto("Lịch tập Yoga?"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").value(500))
                .andExpect(jsonPath("$.data.memberMessage.sender").value("member"))
                .andExpect(jsonPath("$.data.aiMessage.sender").value("ai"));
    }

    @Test
    void getSessionHistory_Returns200() throws Exception {
        AiChatMessageDto m1 = new AiChatMessageDto(1L, 500L, "member", "Xin chào", LocalDateTime.now());
        AiChatMessageDto m2 = new AiChatMessageDto(2L, 500L, "ai", "Chào bạn!", LocalDateTime.now());
        when(aiChatService.getSessionHistory(eq(500L), any(), any())).thenReturn(List.of(m1, m2));

        mockMvc.perform(get("/api/v1/ai/chat/sessions/500/history"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].sender").value("member"))
                .andExpect(jsonPath("$.data[1].sender").value("ai"));
    }
}
