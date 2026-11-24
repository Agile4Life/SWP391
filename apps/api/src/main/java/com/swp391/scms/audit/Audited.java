package com.swp391.scms.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Gắn lên hàm service cần ghi audit log khi chạy thành công. entity phải là một loại bản ghi được ràng buộc
 * CHECK của bảng audit_logs cho phép.
 *
 * Marks a service method whose successful execution must be written to audit_logs.
 * {@code entity} must be one of the entity types allowed by the audit_logs check constraint.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /** Mã hành động ghi vào log, ví dụ USER_CREATE. */
    String action();
    /** Loại bản ghi (tên bảng), ví dụ users. */
    String entity();
}