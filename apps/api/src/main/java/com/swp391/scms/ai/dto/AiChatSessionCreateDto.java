package com.swp391.scms.ai.dto;

import jakarta.validation.constraints.Size;

/**
 * Dữ liệu tạo phiên chat: hội viên (phải là chính người gọi) và chủ đề.
 *
 * Payload yêu cầu tạo phiên chat AI mới.
 */
public record AiChatSessionCreateDto(
        Long memberId,

        @Size(max = 150, message = "{validation.ai.chat.topic.size}")
        String topic
) {
}
