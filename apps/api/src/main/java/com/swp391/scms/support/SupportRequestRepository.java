package com.swp391.scms.support;

import com.swp391.scms.support.entity.SupportRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupportRequestRepository extends JpaRepository<SupportRequest, Long> {
    
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from SupportRequest r where r.id = :id")
    java.util.Optional<SupportRequest> findByIdForUpdate(@Param("id") Long id);

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    Page<SupportRequest> findByMemberUserIdOrderByCreatedAtDesc(Long memberId, Pageable pageable);

    /** Lấy mọi bản ghi, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên hàm). */
    Page<SupportRequest> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /**
     * Tìm các bản ghi có status = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Page<SupportRequest> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    /**
     * Tìm các bản ghi có escalatedAt đã có giá trị, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    Page<SupportRequest> findByEscalatedAtIsNotNullOrderByCreatedAtDesc(Pageable pageable);
    /**
     * Tìm các bản ghi có status = tham số và escalatedAt đã có giá trị, sắp xếp theo createdAt giảm dần (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    Page<SupportRequest> findByStatusAndEscalatedAtIsNotNullOrderByCreatedAtDesc(String status, Pageable pageable);
    /** Managers only ever work the requests a receptionist has escalated. */
    default Page<SupportRequest> findEscalatedByStatus(String status, Pageable pageable) {
        if (status == null || status.isBlank()) {
            return findByEscalatedAtIsNotNullOrderByCreatedAtDesc(pageable);
        }
        return findByStatusAndEscalatedAtIsNotNullOrderByCreatedAtDesc(status, pageable);
    }
    default Page<SupportRequest> findAllByStatus(@Param("status") String status, Pageable pageable) {
        if (status == null || status.isBlank()) {
            return findAllByOrderByCreatedAtDesc(pageable);
        }
        return findByStatusOrderByCreatedAtDesc(status, pageable);
    }

    /**
     * Tìm các bản ghi có status = tham số và resolvedAt trước tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    java.util.List<com.swp391.scms.support.entity.SupportRequest> findByStatusAndResolvedAtBefore(String status, java.time.LocalDateTime cutoff);
}
