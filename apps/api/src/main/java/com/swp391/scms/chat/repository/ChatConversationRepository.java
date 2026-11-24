package com.swp391.scms.chat.repository;

import com.swp391.scms.chat.entity.ChatConversation;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

/** Truy cập bảng chat_conversations (mỗi cặp hội viên - nhân viên một hội thoại). */
public interface ChatConversationRepository extends JpaRepository<ChatConversation, Long> {
    /** Tìm các bản ghi có memberId = tham số và staffId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<ChatConversation> findByMemberIdAndStaffId(Long memberId, Long staffId);

    @Query(value = "select c from ChatConversation c join fetch c.member m join fetch m.role join fetch c.staff s join fetch s.role where m.id = :userId or s.id = :userId order by c.lastActivityAt desc, c.id desc",
            countQuery = "select count(c) from ChatConversation c where c.member.id = :userId or c.staff.id = :userId")
    /** Các hội thoại mà người dùng tham gia (là hội viên hoặc nhân viên), có phân trang. */
    Page<ChatConversation> forUser(@Param("userId") Long userId, Pageable page);

    /** Lấy hội thoại và khóa dòng để ghi. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ChatConversation c where c.id = :id")
    Optional<ChatConversation> lockById(@Param("id") Long id);
}
