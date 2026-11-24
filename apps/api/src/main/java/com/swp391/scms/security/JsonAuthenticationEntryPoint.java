package com.swp391.scms.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Trả lỗi 401 dạng JSON (ApiResponse) khi request cần đăng nhập mà không có token hoặc token không hợp lệ. */
@Component
public class JsonAuthenticationEntryPoint implements AuthenticationEntryPoint {
    private final ObjectMapper objectMapper;
    private final MessageService messageService;

    /** Nhận ObjectMapper để ghi JSON và MessageService để dịch thông báo. */
    public JsonAuthenticationEntryPoint(ObjectMapper objectMapper, MessageService messageService) {
        this.objectMapper = objectMapper;
        this.messageService = messageService;
    }

    /** Ghi phản hồi HTTP 401 với mã UNAUTHORIZED và thông báo đã dịch. */
    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException exception)
            throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String message = messageService != null ? messageService.getMessage("error.unauthorized") : "error.unauthorized";
        objectMapper.writeValue(response.getOutputStream(),
                ApiResponse.error(401, "UNAUTHORIZED", message));
    }
}
