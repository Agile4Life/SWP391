package com.swp391.scms.common;

import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.swp391.scms.common.i18n.MessageService;
import java.util.HashMap;
import java.util.Map;

/**
 * Bộ xử lý lỗi toàn cục: bắt mọi exception ném ra từ controller/service và chuyển thành ApiResponse với mã HTTP
 * và thông báo đã dịch (vi/en), để client luôn nhận cùng một định dạng lỗi và không lộ chi tiết nội bộ.
 *
 * Bộ xử lý ngoại lệ tập trung cho mọi REST controller. Ánh xạ lỗi ứng dụng và database thành phản hồi API
 * chuẩn, hỗ trợ đa ngôn ngữ i18n.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final MessageService messageService;

    /** Constructor dùng trong unit test khi không có MessageService: thông báo trả về là chuỗi mặc định. */
    public GlobalExceptionHandler() {
        this.messageService = null;
    }

    /**
     * Constructor Spring dùng khi chạy thật: nhận MessageService để dịch mã thông báo theo ngôn ngữ của
     * request.
     */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public GlobalExceptionHandler(MessageService messageService) {
        this.messageService = messageService;
    }

    /**
     * Dịch mã thông báo sang ngôn ngữ của request. Tham số nào là mã tài nguyên ("resource.xxx") hoặc vai trò
     * ("role.xxx") cũng được dịch trước khi ghép vào câu. Không có MessageService thì trả về defaultMessage.
     */
    private String resolveMessage(String code, String defaultMessage, Object... args) {
        if (messageService != null) {
            Object[] resolvedArgs = args;
            if (args != null && args.length > 0) {
                resolvedArgs = new Object[args.length];
                for (int i = 0; i < args.length; i++) {
                    if (args[i] instanceof String strArg && (strArg.startsWith("resource.") || strArg.startsWith("role."))) {
                        resolvedArgs[i] = messageService.getMessageOrDefault(strArg, strArg);
                    } else {
                        resolvedArgs[i] = args[i];
                    }
                }
            }
            return messageService.getMessageOrDefault(code, defaultMessage, resolvedArgs);
        }
        return defaultMessage;
    }

    /**
     * Xử lý lỗi nghiệp vụ tự định nghĩa (AppException và các lớp con): dùng mã HTTP, mã lỗi và message key mà
     * service đã chọn.
     *
     * Xử lý các ngoại lệ nghiệp vụ tùy chỉnh của ứng dụng.
     */
    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiResponse<Object>> handleAppException(AppException ex) {
        log.warn("Application exception [{}]: {}", ex.getErrorCode(), ex.getMessage());
        String message = ex.getMessageKey() != null
                ? resolveMessage(ex.getMessageKey(), ex.getMessage(), ex.getMessageArgs() != null ? ex.getMessageArgs() : new Object[0])
                : ex.getMessage();
        ApiResponse<Object> response = ApiResponse.error(
                ex.getStatus().value(),
                ex.getErrorCode(),
                message,
                ex.getDetails()
        );
        return ResponseEntity.status(ex.getStatus()).body(response);
    }

    /**
     * Không tìm thấy tài nguyên (HTTP 404): dịch tên tài nguyên và mã định danh vào thông báo.
     *
     * Xử lý riêng ResourceNotFoundException.
     */
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleResourceNotFound(ResourceNotFoundException ex) {
        String message = ex.getMessageKey() != null
                ? resolveMessage(ex.getMessageKey(), ex.getMessage(), ex.getMessageArgs() != null ? ex.getMessageArgs() : new Object[0])
                : ex.getMessage();
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.NOT_FOUND.value(),
                ex.getErrorCode(),
                message
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    /**
     * Lỗi validate @Valid ở request body (HTTP 400): gom lỗi từng trường thành details để form hiển thị ngay
     * dưới ô nhập.
     *
     * Xử lý lỗi bean validation (@Valid trên request body).
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(err -> {
            String defaultMsg = err.getDefaultMessage();
            if (defaultMsg != null && defaultMsg.startsWith("{") && defaultMsg.endsWith("}")) {
                String key = defaultMsg.substring(1, defaultMsg.length() - 1);
                defaultMsg = resolveMessage(key, defaultMsg);
            }
            errors.put(err.getField(), defaultMsg);
        });

        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "VALIDATION_ERROR",
                resolveMessage("error.validation", "error.validation"),
                errors
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Lỗi validate tham số đường dẫn/query (@Validated, HTTP 400): gom theo tên tham số.
     *
     * Xử lý lỗi vi phạm ràng buộc trên tham số truy vấn hoặc entity.
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getConstraintViolations().forEach(cv ->
                errors.put(cv.getPropertyPath().toString(), cv.getMessage())
        );

        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "CONSTRAINT_VIOLATION",
                resolveMessage("error.constraint_violation", "error.constraint_violation"),
                errors
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Người dùng đã đăng nhập nhưng không đủ quyền (HTTP 403).
     *
     * Xử lý Spring Security từ chối truy cập (HTTP 403).
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.FORBIDDEN.value(),
                "FORBIDDEN",
                resolveMessage("error.forbidden", "error.forbidden")
        );
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    /**
     * Chưa đăng nhập hoặc token không hợp lệ (HTTP 401).
     *
     * Xử lý Spring Security xác thực thất bại (HTTP 401).
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<Object>> handleAuthentication(AuthenticationException ex) {
        log.warn("Authentication failure: {}", ex.getMessage());
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.UNAUTHORIZED.value(),
                "UNAUTHORIZED",
                resolveMessage("error.unauthorized", "error.unauthorized")
        );
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    /**
     * IllegalArgumentException/IllegalStateException lọt ra từ code: trả HTTP 400 và dùng nguyên nội dung
     * exception làm thông báo (nội dung này không được dịch, nên code nghiệp vụ nên ném AppException thay thế).
     *
     * Xử lý đối số không hợp lệ và trạng thái không hợp lệ.
     */
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<ApiResponse<Object>> handleIllegalArgument(RuntimeException ex) {
        log.warn("Illegal argument / state: {}", ex.getMessage());
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "BAD_REQUEST",
                ex.getMessage()
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Lỗi ràng buộc dữ liệu từ PostgreSQL (trigger, unique, foreign key, check). Đọc tên trigger/ràng buộc
     * trong thông báo gốc của database để đổi thành mã lỗi và câu thông báo dễ hiểu: trùng lịch, quá sức chứa,
     * gói hết hạn, trùng email/SĐT... Đây là cách giữ nguyên trigger bắt buộc mà vẫn trả lỗi HTTP thân thiện.
     *
     * Xử lý lỗi toàn vẹn dữ liệu và vi phạm trigger PostgreSQL. Các bất biến từ AGENTS.md &
     * PROJECT_MASTER_GUIDE.md:
     * - trg_enrollments_check_capacity (vượt quá sức chứa)
     * - trg_sessions_check_conflict (trùng lịch HLV / phòng tập)
     * - trg_member_schedule_conflict (một hội viên trùng giờ giữa hai lớp)
     * - trg_enrollments_check_membership & trg_checkins_check_membership (gói hội viên còn hiệu lực)
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleDataIntegrity(DataIntegrityViolationException ex) {
        String rootMsg = ex.getRootCause() != null ? ex.getRootCause().getMessage() : ex.getMessage();
        String normalizedRootMsg = rootMsg == null ? "" : rootMsg.toLowerCase(java.util.Locale.ROOT);
        log.error("Data integrity violation from {}", ex.getMostSpecificCause().getClass().getSimpleName());

        if (rootMsg != null) {
            // Nhóm trigger đặt sân (tính năng cũ): mỗi trigger ứng với một mã lỗi và mã HTTP riêng.
            String courtCode = null;
            String courtKey = null;
            HttpStatus courtStatus = HttpStatus.CONFLICT;
            if (normalizedRootMsg.contains("trg_court_bookings_check_conflict") || normalizedRootMsg.contains("court_booking_slot_taken")) {
                courtCode = "COURT_BOOKING_SLOT_TAKEN";
                courtKey = "slot_taken";
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_membership") || normalizedRootMsg.contains("court_booking_membership_invalid")) {
                courtCode = "COURT_BOOKING_MEMBERSHIP_INVALID";
                courtKey = "membership_invalid";
                courtStatus = HttpStatus.FORBIDDEN;
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_limit") || normalizedRootMsg.contains("court_booking_limit_reached")) {
                courtCode = "COURT_BOOKING_LIMIT_REACHED";
                courtKey = "limit_reached";
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_court") || normalizedRootMsg.contains("court_booking_court_unavailable")) {
                courtCode = "COURT_BOOKING_COURT_UNAVAILABLE";
                courtKey = "court_unavailable";
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_past") || normalizedRootMsg.contains("court_booking_past_slot")) {
                courtCode = "COURT_BOOKING_PAST_SLOT";
                courtKey = "past_slot";
                courtStatus = HttpStatus.BAD_REQUEST;
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_horizon") || normalizedRootMsg.contains("court_booking_too_far")) {
                courtCode = "COURT_BOOKING_TOO_FAR";
                courtKey = "too_far";
                courtStatus = HttpStatus.BAD_REQUEST;
            } else if (normalizedRootMsg.contains("trg_court_bookings_check_slot") || normalizedRootMsg.contains("court_booking_invalid_slot")) {
                courtCode = "COURT_BOOKING_INVALID_SLOT";
                courtKey = "invalid_slot";
                courtStatus = HttpStatus.BAD_REQUEST;
            }
            if (courtCode != null) {
                String key = "error.courts." + courtKey;
                return ResponseEntity.status(courtStatus).body(
                        ApiResponse.error(courtStatus.value(), courtCode, resolveMessage(key, key)));
            }
            // Trigger của buổi PT 1:1: HLV cần nghỉ giữa hai buổi, hoặc lịch đang được cập nhật đồng thời.
            if (normalizedRootMsg.contains("trg_coach_bookings_rest_required")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "COACH_REST_REQUIRED",
                                resolveMessage("error.coach_booking.rest_required", "error.coach_booking.rest_required")));
            }
            if (normalizedRootMsg.contains("trg_pt_schedule_busy")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "SCHEDULE_UPDATE_IN_PROGRESS",
                                resolveMessage("error.scheduling.update_in_progress", "error.scheduling.update_in_progress"))
                );
            }
            if (normalizedRootMsg.contains("trg_enrollments_check_capacity")
                    || normalizedRootMsg.contains("trg_session_bookings_check_capacity")
                    || normalizedRootMsg.contains("buổi học đã đầy chỗ (vượt quá capacity cho phép).")
                    || normalizedRootMsg.contains("lớp học đã đầy chỗ (vượt quá capacity cho phép).")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "CLASS_CAPACITY_EXCEEDED",
                                resolveMessage("error.scheduling.class_full", "invariant.capacity_exceeded"))
                );
            }
            if (normalizedRootMsg.contains("trg_member_schedule_conflict")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "SCHEDULING_MEMBER_TIME_OVERLAP",
                                resolveMessage("error.scheduling.member_class_overlap", "error.scheduling.member_class_overlap"))
                );
            }
            if (normalizedRootMsg.contains("trg_sessions_check_conflict")
                    || normalizedRootMsg.contains("coach_schedule_conflict")
                    || normalizedRootMsg.contains("member_schedule_conflict")
                    || normalizedRootMsg.contains("huấn luyện viên hoặc phòng tập đã có lịch trùng khung giờ này.")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "SCHEDULE_CONFLICT",
                                resolveMessage("error.scheduling.session_conflict", "invariant.schedule_conflict"))
                );
            }
            if (normalizedRootMsg.contains("trg_enrollments_check_membership") || normalizedRootMsg.contains("trg_checkins_check_membership")
                    || normalizedRootMsg.contains("học viên không có gói thành viên còn hiệu lực để đăng ký lớp.")
                    || normalizedRootMsg.contains("học viên không có gói thành viên còn hiệu lực để check-in.")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
                        ApiResponse.error(HttpStatus.FORBIDDEN.value(), "MEMBERSHIP_INACTIVE_OR_EXPIRED",
                                resolveMessage("error.scheduling.membership_expired_or_inactive", "invariant.membership_inactive_or_expired"))
                );
            }
            if (normalizedRootMsg.contains("ck_product_variants_stock_nonneg")
                    || normalizedRootMsg.contains("ck_product_variants_values")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "PRODUCT_OUT_OF_STOCK",
                                resolveMessage("error.shop.product_out_of_stock", "error.shop.product_out_of_stock"))
                );
            }
            if (normalizedRootMsg.contains("uq_users_phone")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "PHONE_EXISTS",
                                resolveMessage("users.phone_exists", "users.phone_exists"))
                );
            }
            if (normalizedRootMsg.contains("users_email_key") || normalizedRootMsg.contains("uq_users_email")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "EMAIL_EXISTS",
                                resolveMessage("users.email_exists", "users.email_exists"))
                );
            }
            // Ràng buộc unique/khóa ngoại chung: trả về mã trùng dữ liệu hoặc vi phạm khóa ngoại.
            if (normalizedRootMsg.contains("duplicate") || normalizedRootMsg.contains("unique constraint") || normalizedRootMsg.contains("uq_")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "DUPLICATE_RESOURCE",
                                resolveMessage("invariant.duplicate_resource", "invariant.duplicate_resource"))
                );
            }
            if (normalizedRootMsg.contains("foreign key") || normalizedRootMsg.contains("fk_")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(
                        ApiResponse.error(HttpStatus.CONFLICT.value(), "FOREIGN_KEY_VIOLATION",
                                resolveMessage("invariant.foreign_key_violation", "invariant.foreign_key_violation"))
                );
            }
        }

        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.CONFLICT.value(),
                "DATA_INTEGRITY_VIOLATION",
                resolveMessage("invariant.data_integrity", "invariant.data_integrity")
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * Body JSON sai cú pháp hoặc sai kiểu dữ liệu (HTTP 400).
     *
     * Xử lý payload JSON sai định dạng.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleMalformedJson(HttpMessageNotReadableException ex) {
        log.warn("Malformed JSON request: {}", ex.getMessage());
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "MALFORMED_JSON_REQUEST",
                resolveMessage("error.malformed_json", "error.malformed_json")
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Xử lý tham số request thiếu hoặc sai kiểu.
     */
    @ExceptionHandler({org.springframework.web.bind.MissingServletRequestParameterException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    /** Tham số đường dẫn/query sai kiểu hoặc thiếu (HTTP 400). */
    public ResponseEntity<ApiResponse<Object>> handleBadParameter(Exception ex) {
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.BAD_REQUEST.value(),
                "INVALID_REQUEST_PARAMETER",
                resolveMessage("error.invalid_parameter", "error.invalid_parameter")
        );
        return ResponseEntity.badRequest().body(response);
    }

    /**
     * Gọi sai phương thức HTTP cho một endpoint (HTTP 405).
     *
     * Xử lý phương thức HTTP không được hỗ trợ.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.METHOD_NOT_ALLOWED.value(),
                "METHOD_NOT_ALLOWED",
                resolveMessage("error.method_not_allowed", "error.method_not_allowed", ex.getMethod())
        );
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(response);
    }

    /**
     * Đường dẫn không tồn tại (HTTP 404).
     *
     * Xử lý route API không tồn tại.
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Object>> handleNoResourceFound(NoResourceFoundException ex) {
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.NOT_FOUND.value(),
                "ENDPOINT_NOT_FOUND",
                resolveMessage("error.endpoint_not_found", "error.endpoint_not_found", ex.getResourcePath())
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    /**
     * Client đóng kết nối trước khi phản hồi xong (thường gặp với SSE/realtime): chỉ ghi log debug, không trả
     * gì vì kết nối đã đóng.
     *
     * Phương án dự phòng cho mọi ngoại lệ chưa được xử lý (HTTP 500).
     */
    @ExceptionHandler(org.springframework.web.context.request.async.AsyncRequestNotUsableException.class)
    public void handleAsyncRequestNotUsable(org.springframework.web.context.request.async.AsyncRequestNotUsableException ex) {
        log.debug("Client closed connection before response completed: {}", ex.getMessage());
    }

    /**
     * Khóa dòng không được cấp trong {@code lock_timeout} (một thao tác khác trên cùng bản ghi vẫn đang chạy)
     * hoặc database chọn transaction này làm nạn nhân deadlock. Chưa lưu gì; người dùng có thể thử lại.
     */
    @ExceptionHandler({org.springframework.dao.PessimisticLockingFailureException.class,
            jakarta.persistence.PessimisticLockException.class,
            jakarta.persistence.LockTimeoutException.class})
    /**
     * Không lấy được khóa dòng (row lock) trong thời gian chờ hoặc bị chọn làm nạn nhân deadlock: chưa có gì
     * được lưu, trả HTTP 409 để người dùng thử lại.
     */
    public ResponseEntity<ApiResponse<Object>> handleLockBusy(Exception ex) {
        log.warn("Row lock not acquired ({})", ex.getClass().getSimpleName());
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.CONFLICT.value(),
                "RESOURCE_BUSY",
                resolveMessage("error.resource_busy", "error.resource_busy")
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    /**
     * Lưới an toàn cuối cùng cho mọi lỗi chưa được xử lý: ghi log đầy đủ ở server, client chỉ nhận HTTP 500 với
     * thông báo chung.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGeneral(Exception ex) {
        log.error("Unhandled server error: ", ex);
        ApiResponse<Object> response = ApiResponse.error(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "INTERNAL_SERVER_ERROR",
                resolveMessage("error.internal", "error.internal")
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
