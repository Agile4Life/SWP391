package com.swp391.scms.ai.repository;

import com.swp391.scms.ai.entity.AiChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for {@link AiChatMessage}.
 */
@Repository
public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Long> {

    List<AiChatMessage> findBySessionIdOrderByCreatedAtAscIdAsc(Long sessionId);

    /** When the member's own messages (not the AI's) were sent after {@code since}, oldest first; feeds the rate limit. */
    @Query("select m.createdAt from AiChatMessage m where m.session.member.userId = :memberId "
            + "and m.sender = 'member' and m.createdAt > :since order by m.createdAt asc")
    List<LocalDateTime> memberMessageTimesSince(@Param("memberId") Long memberId, @Param("since") LocalDateTime since);
}
