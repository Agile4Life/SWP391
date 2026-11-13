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

    /**
     * When the account's own messages (not the AI's) were sent after {@code since}, oldest first; feeds the rate limit.
     * Covers the account's sessions as a member and as front-desk staff. The asking side is stored as sender 'member'.
     */
    @Query("select m.createdAt from AiChatMessage m join m.session s left join s.member mem left join s.staffUser staff "
            + "where (mem.userId = :userId or staff.id = :userId) "
            + "and m.sender = 'member' and m.createdAt > :since order by m.createdAt asc")
    List<LocalDateTime> memberMessageTimesSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
