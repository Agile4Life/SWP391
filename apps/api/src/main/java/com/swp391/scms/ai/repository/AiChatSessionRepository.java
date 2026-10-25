package com.swp391.scms.ai.repository;

import com.swp391.scms.ai.entity.AiChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for {@link AiChatSession}.
 */
@Repository
public interface AiChatSessionRepository extends JpaRepository<AiChatSession, Long> {

    List<AiChatSession> findByMemberUserIdOrderByStartedAtDesc(Long memberId);
}
