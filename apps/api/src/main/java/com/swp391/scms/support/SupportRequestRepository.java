package com.swp391.scms.support;

import com.swp391.scms.support.entity.SupportRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupportRequestRepository extends JpaRepository<SupportRequest, Long> {
    
    Page<SupportRequest> findByMemberUserIdOrderByCreatedAtDesc(Long memberId, Pageable pageable);

    @Query("SELECT s FROM SupportRequest s WHERE :status IS NULL OR s.status = :status ORDER BY s.createdAt DESC")
    Page<SupportRequest> findAllByStatus(@Param("status") String status, Pageable pageable);
}

