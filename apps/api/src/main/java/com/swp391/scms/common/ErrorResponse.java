package com.swp391.scms.common;

/**
 * Phản hồi lỗi dạng ApiResponse luôn có success=false và data=null.
 *
 * Lớp phản hồi lỗi chuẩn, kế thừa ApiResponse để tương thích ngược.
 */
public class ErrorResponse extends ApiResponse<Object> {

    /** Tạo phản hồi lỗi có details (ví dụ danh sách lỗi validate). */
    public ErrorResponse(int status, String code, String message, Object details) {
        super(false, status, message, null, code, details);
    }

    /** Tạo phản hồi lỗi không có details. */
    public ErrorResponse(int status, String code, String message) {
        super(false, status, message, null, code, null);
    }
}