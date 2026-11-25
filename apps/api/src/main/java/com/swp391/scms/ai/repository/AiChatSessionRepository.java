package com.swp391.scms.ai.repository;

import com.swp391.scms.ai.entity.AiChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Truy cập bảng ai_chat_sessions (phiên chat AI).
 *
 * Repository cho {@link AiChatSession}.
 */
@Repository
public interface AiChatSessionRepository extends JpaRepository<AiChatSession, Long> {

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo startedAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<AiChatSession> findByMemberUserIdOrderByStartedAtDesc(Long memberId);

    /**
     * Tìm các bản ghi có staffUserId = tham số, sắp xếp theo startedAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<AiChatSession> findByStaffUserIdOrderByStartedAtDesc(Long staffUserId);
}
