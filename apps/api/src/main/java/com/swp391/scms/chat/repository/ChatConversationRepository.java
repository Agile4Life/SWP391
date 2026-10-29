package com.swp391.scms.chat.repository;

import com.swp391.scms.chat.entity.ChatConversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {
    Optional<ChatConversation> findByMemberIdAndStaffId(Long memberId, Long staffId);

    @Query(value = "select c from ChatConversation c join fetch c.member m join fetch m.role join fetch c.staff s join fetch s.role where m.id = :userId or s.id = :userId order by c.lastActivityAt desc, c.id desc",
            countQuery = "select count(c) from ChatConversation c where c.member.id = :userId or c.staff.id = :userId")
    Page<ChatConversation> forUser(@Param("userId") Long userId, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ChatConversation c where c.id = :id")
    Optional<ChatConversation> lockById(@Param("id") Long id);
}
