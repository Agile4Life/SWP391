package com.swp391.scms.audit;

import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic specifications for querying audit logs with optional filters (SCRUM-109).
 */
public final class AuditSpecifications {

    private AuditSpecifications() {}

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

            if (entityType != null && !entityType.isBlank()) {
                String normalized = entityType.trim().toLowerCase();
                predicates.add(cb.or(
                        cb.equal(cb.lower(root.get("entityType")), normalized),
                        cb.like(cb.lower(root.get("entityType")), "%" + normalized + "%")
                ));
            }

            if (action != null && !action.isBlank()) {
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

