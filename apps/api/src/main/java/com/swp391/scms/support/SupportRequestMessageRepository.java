package com.swp391.scms.support;

import com.swp391.scms.support.entity.SupportRequestMessage;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập bảng support_request_messages (tin nhắn trong phiếu hỗ trợ). */
@Repository
public interface SupportRequestMessageRepository extends JpaRepository<SupportRequestMessage, Long> {

    boolean existsByIdAndSupportRequestId(Long id, Long requestId);
    java.util.Optional<SupportRequestMessage> findFirstBySupportRequestIdOrderByCreatedAtDescIdDesc(Long requestId);
    @org.springframework.data.jpa.repository.Query("""
        select count(m) from SupportRequestMessage m where m.supportRequest.id = :requestId
        and m.sender.id = m.supportRequest.member.userId and m.id > :cursor
        """)
    long countIncomingAfter(@org.springframework.data.repository.query.Param("requestId") Long requestId,
            @org.springframework.data.repository.query.Param("cursor") long cursor);
    /**
     * Tìm các bản ghi có supportRequestId = tham số và senderId = tham số và clientMessageId = tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    java.util.Optional<SupportRequestMessage> findBySupportRequestIdAndSenderIdAndClientMessageId(Long requestId, Long senderId, java.util.UUID clientMessageId);

    /**
     * Tìm các bản ghi có supportRequestId = tham số, sắp xếp theo createdAt tăng dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    @EntityGraph(attributePaths = {"sender", "sender.role"})
    List<SupportRequestMessage> findBySupportRequestIdOrderByCreatedAtAsc(Long supportRequestId);
}

