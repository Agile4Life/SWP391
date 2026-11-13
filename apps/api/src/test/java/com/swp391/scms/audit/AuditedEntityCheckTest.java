package com.swp391.scms.audit;

import org.hibernate.annotations.Check;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Every audited entity type must be allowed by the audit_logs CHECK, or the audited write rolls back. */
class AuditedEntityCheckTest {

    @Test
    void everyAuditedEntityIsAllowedByTheAuditCheck() throws Exception {
        String constraint = AuditLog.class.getAnnotation(Check.class).constraints();
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Service.class));
        scanner.addIncludeFilter(new AnnotationTypeFilter(org.springframework.stereotype.Component.class));
        var missing = new TreeSet<String>();
        int audited = 0;
        for (var bean : scanner.findCandidateComponents("com.swp391.scms")) {
            for (Method method : Class.forName(bean.getBeanClassName()).getDeclaredMethods()) {
                Audited annotation = method.getAnnotation(Audited.class);
                if (annotation == null) continue;
                audited++;
                if (!constraint.contains("'" + annotation.entity() + "'")) missing.add(annotation.entity());
            }
        }
        assertTrue(audited > 0, "No @Audited methods found; the scan is broken");
        assertTrue(missing.isEmpty(), "Add these entity types to AuditLog @Check (and the schema upgrade): " + missing);
    }
}
