package com.swp391.scms.chat;

import com.swp391.scms.chat.controller.ChatController;
import com.swp391.scms.chat.service.ChatService;
import com.swp391.scms.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ChatControllerTest {
    ChatService service = mock(ChatService.class);
    MockMvc mvc;
    @BeforeEach void setup() { mvc = MockMvcBuilders.standaloneSetup(new ChatController(service))
            .setControllerAdvice(new GlobalExceptionHandler()).build(); }

    @Test void invalidMessageBodyNeverReachesService() throws Exception {
        for (String body : new String[]{"{}", "{\"message\":\"Hello\",\"clientMessageId\":\"bad\"}",
                "{\"message\":\"   \",\"clientMessageId\":\"d35a049d-5400-47a2-aec3-43348af7925e\"}"}) {
            mvc.perform(post("/api/v1/chat/conversations/7/messages").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }

    @Test void invalidContactNeverReachesService() throws Exception {
        mvc.perform(post("/api/v1/chat/conversations").contentType(MediaType.APPLICATION_JSON).content("{\"contactId\":0}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
