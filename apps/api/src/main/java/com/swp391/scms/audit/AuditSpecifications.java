package com.swp391.scms.audit;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Dựng điều kiện truy vấn động cho audit log.
 *
 * Specification động để truy vấn nhật ký audit với các bộ lọc tùy chọn (SCRUM-109).
 */
public final class AuditSpecifications {

    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private AuditSpecifications() {}

    /**
     * Điều kiện lọc: đúng người thực hiện; loại bản ghi khớp hoặc chứa từ khóa (bỏ qua nếu ALL); hành động chứa
     * từ khóa; thời điểm trong khoảng. Điều kiện nào trống thì bỏ qua.
     */
    public static Specification<AuditLog> filter(
            Long userId,
            String entityType,
            String action,
            LocalDateTime from,
            LocalDateTime to
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }

            if (entityType != null && !entityType.isBlank() && !"ALL".equalsIgnoreCase(entityType.trim())) {
                String normalized = entityType.trim().toLowerCase();
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("entityType")), normalized),
                        cb.like(cb.lower(root.get("entityType")), "%" + normalized + "%")
                ));
            }

            if (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action.trim())) {
                String normalized = "%" + action.trim().toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("action")), normalized));
            }

            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }

            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}

