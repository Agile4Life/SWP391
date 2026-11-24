package com.swp391.scms.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.ApiResponse;
import com.swp391.scms.common.i18n.MessageService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Trả lỗi 403 dạng JSON (ApiResponse) khi người dùng đã đăng nhập nhưng không đủ quyền, thay cho trang lỗi mặc
 * định của Spring Security.
 */
@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {
    private final ObjectMapper objectMapper;
    private final MessageService messageService;

    /** Nhận ObjectMapper để ghi JSON và MessageService để dịch thông báo. */
    public JsonAccessDeniedHandler(ObjectMapper objectMapper, MessageService messageService) {
        this.objectMapper = objectMapper;
        this.messageService = messageService;
    }

    /** Ghi phản hồi HTTP 403 với mã FORBIDDEN và thông báo đã dịch. */
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException exception)
            throws IOException, ServletException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        String message = messageService != null ? messageService.getMessage("error.forbidden") : "error.forbidden";
        objectMapper.writeValue(response.getOutputStream(),
                ApiResponse.error(403, "FORBIDDEN", message));
    }
}
