package com.swp391.scms.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;

/**
 * Khung phản hồi chung cho mọi API: success, status (mã HTTP), message (đã dịch theo Accept-Language), data (dữ
 * liệu trả về), code (mã lỗi máy đọc được) và details (chi tiết lỗi, ví dụ lỗi từng trường).
 *
 * Standard API Response Wrapper for all SCMS endpoints.
 * Provides unified structure for both success and error payloads.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    private int status;
    private String message;
    private T data;
    private String code;
    private Object details;
    private LocalDateTime timestamp;

    /** Constructor rỗng cho Jackson khi đọc JSON; timestamp được gán bằng thời điểm tạo. */
    public ApiResponse() {
        this.timestamp = LocalDateTime.now();
    }

    /** Tạo phản hồi đầy đủ các trường; timestamp là thời điểm tạo đối tượng. */
    public ApiResponse(boolean success, int status, String message, T data, String code, Object details) {
        this.success = success;
        this.status = status;
        this.message = message;
        this.data = data;
        this.code = code;
        this.details = details;
        this.timestamp = LocalDateTime.now();
    }

    // --- Success Factory Methods ---

    /** Phản hồi thành công HTTP 200 kèm thông báo và dữ liệu. */
    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, 200, message, data, null, null);
    }

    /** Phản hồi tạo mới thành công HTTP 201 kèm thông báo và dữ liệu vừa tạo. */
    public static <T> ApiResponse<T> created(String message, T data) {
        return new ApiResponse<>(true, 201, message, data, null, null);
    }

    // --- Error Factory Methods ---

    /** Phản hồi lỗi với mã HTTP, mã lỗi (code) và thông báo; không có details. */
    public static <T> ApiResponse<T> error(int status, String code, String message) {
        return new ApiResponse<>(false, status, message, null, code, null);
    }

    /** Phản hồi lỗi kèm details (ví dụ map tên trường -> lỗi khi validate form). */
    public static <T> ApiResponse<T> error(int status, String code, String message, Object details) {
        return new ApiResponse<>(false, status, message, null, code, details);
    }

    // --- Getters and Setters ---

    /** Cho biết success (trường boolean). */
    public boolean isSuccess() {
        return success;
    }

    /** Gán giá trị mới cho trường success. */
    public void setSuccess(boolean success) {
        this.success = success;
    }

    /** Lấy giá trị trường status. */
    public int getStatus() {
        return status;
    }

    /** Gán giá trị mới cho trường status. */
    public void setStatus(int status) {
        this.status = status;
    }

    /** Lấy giá trị trường message. */
    public String getMessage() {
        return message;
    }

    /** Gán giá trị mới cho trường message. */
    public void setMessage(String message) {
        this.message = message;
    }

    /** Lấy giá trị trường data. */
    public T getData() {
        return data;
    }

    /** Gán giá trị mới cho trường data. */
    public void setData(T data) {
        this.data = data;
    }

    /** Lấy giá trị trường code. */
    public String getCode() {
        return code;
    }

    /** Gán giá trị mới cho trường code. */
    public void setCode(String code) {
        this.code = code;
    }

    /** Lấy giá trị trường details. */
    public Object getDetails() {
        return details;
    }

    /** Gán giá trị mới cho trường details. */
    public void setDetails(Object details) {
        this.details = details;
    }

    /** Lấy giá trị trường timestamp. */
    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    /** Gán giá trị mới cho trường timestamp. */
    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
