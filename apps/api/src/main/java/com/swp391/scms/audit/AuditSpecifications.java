package com.swp391.scms.audit;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Dựng điều kiện truy vấn động cho audit log.
 *
 * Specification động để truy vấn nhật ký audit với các bộ lọc tùy chọn (SCRUM-109).
 */
public final class AuditSpecifications {

    private static final char LIKE_ESCAPE = '\\';

    /** Lớp tiện ích static, không cho tạo đối tượng. */
    private AuditSpecifications() {}

    /** Escape ký tự đại diện SQL LIKE (\\, %, _) để bộ lọc khớp theo nghĩa đen. */
    static String escapeLike(String value) {
        return value.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /**
     * Điều kiện lọc (cận trên đóng {@code <= to}): đúng người thực hiện; loại bản ghi khớp hoặc chứa từ khóa (bỏ
     * qua nếu ALL); hành động chứa từ khóa; thời điểm trong khoảng. Điều kiện nào trống thì bỏ qua.
     */
    public static Specification<AuditLog> filter(
            Long userId,
            String entityType,
            String action,
            LocalDateTime from,
            LocalDateTime to
    ) {
        return filter(userId, entityType, action, from, to, false);
    }

    /**
     * Điều kiện lọc với tùy chọn cận trên mở ({@code < to}) khi {@code toExclusive = true}.
     */
    public static Specification<AuditLog> filter(
            Long userId,
            String entityType,
            String action,
            LocalDateTime from,
            LocalDateTime to,
            boolean toExclusive
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }

            if (entityType != null && !entityType.isBlank() && !"ALL".equalsIgnoreCase(entityType.trim())) {
                String normalized = entityType.trim().toLowerCase(Locale.ROOT);
                String escapedPattern = "%" + escapeLike(normalized) + "%";
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("entityType")), normalized),
                        cb.like(cb.lower(root.get("entityType")), escapedPattern, LIKE_ESCAPE)
                ));
            }

            if (action != null && !action.isBlank() && !"ALL".equalsIgnoreCase(action.trim())) {
                String normalized = action.trim().toLowerCase(Locale.ROOT);
                String escapedPattern = "%" + escapeLike(normalized) + "%";
                predicates.add(cb.like(cb.lower(root.get("action")), escapedPattern, LIKE_ESCAPE));
            }

            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }

            if (to != null) {
                if (toExclusive) {
                    predicates.add(cb.lessThan(root.get("createdAt"), to));
                } else {
                    predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}

