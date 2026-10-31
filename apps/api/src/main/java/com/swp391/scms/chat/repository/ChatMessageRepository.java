package com.swp391.scms.chat.repository;

import com.swp391.scms.chat.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    Optional<ChatMessage> findByConversationIdAndSenderIdAndClientMessageId(Long conversationId, Long senderId, UUID clientMessageId);

    @Query("select m from ChatMessage m where m.conversation.id = :id and (:before is null or m.id < :before) order by m.id desc")
    List<ChatMessage> older(@Param("id") Long id, @Param("before") Long before, Pageable page);

    @Query("select m from ChatMessage m where m.conversation.id = :id and m.id > :after order by m.id asc")
    List<ChatMessage> newer(@Param("id") Long id, @Param("after") Long after, Pageable page);
}
