package com.swp391.scms.ai.dto;

import java.time.LocalDateTime;

/**
 * Phiên chat AI trả cho client: hội viên, chủ đề, thời điểm bắt đầu và kết thúc.
 *
 * DTO phản hồi biểu diễn một phiên chat AI.
 */
public record AiChatSessionDto(
        Long id,
        Long memberId,
        String topic,
        LocalDateTime startedAt,
        LocalDateTime endedAt
) {
}
