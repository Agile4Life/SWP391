package com.swp391.scms.ai.repository;

import com.swp391.scms.ai.entity.AiChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Truy cập bảng ai_chat_messages (tin nhắn trong phiên chat AI).
 *
 * Repository cho {@link AiChatMessage}.
 */
@Repository
public interface AiChatMessageRepository extends JpaRepository<AiChatMessage, Long> {

    /**
     * Tìm các bản ghi có sessionId = tham số, sắp xếp theo createdAt tăng dần, id tăng dần (Spring Data tự sinh
     * truy vấn từ tên hàm).
     */
    List<AiChatMessage> findBySessionIdOrderByCreatedAtAscIdAsc(Long sessionId);

    /**
     * Các tin nhắn của chính tài khoản (không phải của AI) được gửi sau {@code since}, cũ nhất trước; dùng
     * cho giới hạn tần suất. Bao gồm các phiên của tài khoản với tư cách hội viên và nhân viên quầy. Phía đặt
     * câu hỏi được lưu với người gửi 'member'.
     */
    @Query("select m.createdAt from AiChatMessage m join m.session s left join s.member mem left join s.staffUser staff "
            + "where (mem.userId = :userId or staff.id = :userId) "
            + "and m.sender = 'member' and m.createdAt > :since order by m.createdAt asc")
    /**
     * Thời điểm các tin do chính người dùng gửi (không tính tin của AI) sau mốc since, cũ nhất trước; gồm cả
     * phiên hội viên và phiên quầy. Dùng để giới hạn tần suất.
     */
    List<LocalDateTime> memberMessageTimesSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);
}
