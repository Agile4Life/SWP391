package com.swp391.scms.notifications;

import com.swp391.scms.notifications.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** Truy cập bảng notifications. */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    
    /**
     * Tìm các bản ghi có userId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    
    /** Đếm số bản ghi có userId = tham số và isRead là false (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByUserIdAndIsReadFalse(Long userId);
    
    /** Tìm các bản ghi có id = tham số và userId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Notification> findByIdAndUserId(Long id, Long userId);
    
    /** Đánh dấu mọi thông báo chưa đọc của người dùng là đã đọc; trả số dòng đã cập nhật. */
    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.user.id = :userId AND n.isRead = false")
    int markAllAsReadByUserId(Long userId);

    @Query("""
            select (count(n) > 0) from Notification n
            where n.user.id = :userId
              and n.type = :type
              and n.relatedEntityType = :relatedEntityType
              and n.relatedEntityId = :relatedEntityId
            """)
    /** Đã có thông báo cùng người nhận, loại và bản ghi liên quan chưa (dùng để không gửi trùng nhắc nhở). */
    boolean existsNotification(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("type") String type,
            @org.springframework.data.repository.query.Param("relatedEntityType") String relatedEntityType,
            @org.springframework.data.repository.query.Param("relatedEntityId") Long relatedEntityId);
}

