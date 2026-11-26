package com.swp391.scms.audit;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ghi bản ghi kiểm toán trong một giao dịch độc lập ({@link Propagation#REQUIRES_NEW}) để lỗi ghi log không
 * bao giờ làm hỏng giao dịch nghiệp vụ chính.
 */
@Component
public class AuditLogWriter {

    private final AuditLogRepository repository;

    /** Khởi tạo writer với AuditLogRepository. */
    public AuditLogWriter(AuditLogRepository repository) {
        this.repository = repository;
    }

    /** Lưu bản ghi audit trong giao dịch mới độc lập. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void save(AuditLog entry) {
        repository.save(entry);
    }
}
