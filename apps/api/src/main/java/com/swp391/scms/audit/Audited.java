package com.swp391.scms.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Đánh dấu một phương thức service mà lần thực thi thành công phải được ghi vào audit_logs.
 * {@code entity} phải là một trong các loại thực thể được ràng buộc CHECK của bảng audit_logs cho phép.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    /** Mã hành động ghi vào log, ví dụ USER_CREATE. */
    String action();
    /** Loại bản ghi (tên bảng), ví dụ users. */
    String entity();
}