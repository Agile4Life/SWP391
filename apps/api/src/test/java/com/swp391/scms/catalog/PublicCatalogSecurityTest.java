package com.swp391.scms.catalog;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.security.*;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PublicCatalogController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class PublicCatalogSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean PublicCatalogService service;
    @MockitoBean JwtService jwt;
    @MockitoBean UserRepository users;
    @MockitoBean MessageService messages;

    @Test
    void anonymousCanReadCatalogWithNoCacheButCannotWriteOrReadPrivateData() throws Exception {
        when(service.getCatalog()).thenReturn(new PublicCatalogService.CatalogDto(List.of(), List.of(), List.of()));
        when(messages.getMessage("catalog.public.loaded")).thenReturn("Public catalog loaded.");
        mvc.perform(get("/api/v1/public/catalog")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.packages").isArray())
                .andExpect(jsonPath("$.data.coaches").isArray())
                .andExpect(jsonPath("$.data.sessions").isArray());
        mvc.perform(post("/api/v1/public/catalog")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/classes/sessions")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/packages")).andExpect(status().isUnauthorized());
        verify(service, times(1)).getCatalog();
    }
}
