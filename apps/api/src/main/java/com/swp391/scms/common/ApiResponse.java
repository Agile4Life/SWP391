package com.swp391.scms.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;

/**
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

    public ApiResponse() {
        this.timestamp = LocalDateTime.now();
    }

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

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, 200, message, data, null, null);
    }

    public static <T> ApiResponse<T> created(String message, T data) {
        return new ApiResponse<>(true, 201, message, data, null, null);
    }

    // --- Error Factory Methods ---

    public static <T> ApiResponse<T> error(int status, String code, String message) {
        return new ApiResponse<>(false, status, message, null, code, null);
    }

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
