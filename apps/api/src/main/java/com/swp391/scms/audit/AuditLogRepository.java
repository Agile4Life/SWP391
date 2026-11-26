package com.swp391.scms.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Repository;

/** Truy cập bảng audit_logs; hỗ trợ truy vấn động có điều kiện (Specification) và phân trang. */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long>, JpaSpecificationExecutor<AuditLog> {

    /** Nạp sẵn liên kết user để tránh truy vấn N+1 khi ánh xạ AuditLogDto theo trang. */
    @Override
    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findAll(@Nullable Specification<AuditLog> spec, Pageable pageable);
}
