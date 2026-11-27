package com.swp391.scms.common;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.config.I18nConfig;
import org.hibernate.JDBCException;
import org.hibernate.dialect.PostgreSQLDialect;
import org.hibernate.exception.internal.SQLStateConversionDelegate;
import org.hibernate.exception.internal.StandardSQLExceptionConverter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.sql.SQLException;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bộ kiểm thử cho GlobalExceptionHandlerTrigger.
 * SCRUM-80: Lỗi từ trigger PostgreSQL phải giữ nguyên phản hồi HTTP đã bản địa hóa theo ngôn ngữ yêu cầu.
 */
class GlobalExceptionHandlerTriggerTest {

    private static final String DB_CAPACITY_VI = "Lớp học đã đầy chỗ (vượt quá capacity cho phép).";
    private static final String CAPACITY_VI = "Lớp học đã đầy chỗ";
    private static final String CAPACITY_EN = "Class is full";
    private static final String SCHEDULE_VI = "Trùng lịch: Huấn luyện viên hoặc phòng học đã có lịch trong khung giờ này";
    private static final String SCHEDULE_EN = "Schedule conflict: Coach or room is already booked during this time slot";
    private static final String DISCIPLINE_CONFLICT_VI = "Trùng lịch bộ môn: Bộ môn này đã có lớp học khác hoạt động trong cùng khung giờ.";
    private static final String DISCIPLINE_CONFLICT_EN = "Discipline schedule conflict: This discipline already has another active class during this time slot.";
    private static final String MEMBERSHIP_VI = "Bạn chưa đăng ký gói tập, gói tập chưa được kích hoạt hoặc đã hết hạn. Vui lòng đăng ký gói tập trước khi đặt lịch";
    private static final String MEMBERSHIP_EN = "You do not have an active membership package or your subscription has expired. Please register or activate a package before booking";
    private static final String CHECKIN_MEMBERSHIP_VI = "Bạn chưa đăng ký gói tập, gói tập chưa được kích hoạt hoặc đã hết hạn. Vui lòng đăng ký hoặc gia hạn gói tập để tiếp tục.";
    private static final String CHECKIN_MEMBERSHIP_EN = "You do not have an active membership subscription or your subscription has expired. Please register or renew a membership package to continue.";
    private static final String INVALID_SLOT_VI = "Khung giờ không hợp lệ. Vui lòng chọn một trong 5 slot cố định (Slot 1: 07:00–09:30, Slot 2: 09:45–12:15, Slot 3: 12:30–15:00, Slot 4: 15:15–17:45, Slot 5: 18:00–20:30).";
    private static final String INVALID_SLOT_EN = "Invalid time slot. Please choose one of the 5 fixed slots (Slot 1: 07:00–09:30, Slot 2: 09:45–12:15, Slot 3: 12:30–15:00, Slot 4: 15:15–17:45, Slot 5: 18:00–20:30).";

    /** Kiểm thử: trigger sai 5 slot cố định trả 400 Bad Request với mã SCHEDULING_INVALID_SLOT. */
    @Test
    void invalidScheduleSlotTriggerReturnsBadRequest() {
        var response = new GlobalExceptionHandler().handleDataIntegrity(
                new DataIntegrityViolationException("ERROR: trg_schedule_invalid_slot"));
        org.junit.jupiter.api.Assertions.assertEquals(400, response.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("SCHEDULING_INVALID_SLOT", response.getBody().getCode());
    }

    /** Kiểm thử: tranh chấp lịch trả 409 Conflict có thể thử lại. */
    @Test
    void scheduleContentionReturnsRetryableConflict() {
        var response = new GlobalExceptionHandler().handleDataIntegrity(
                new DataIntegrityViolationException("trg_pt_schedule_busy"));
        org.junit.jupiter.api.Assertions.assertEquals(409, response.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("SCHEDULE_UPDATE_IN_PROGRESS", response.getBody().getCode());
    }

    /** Kiểm thử: hội viên trùng lịch trả 409 Conflict. */
    @Test
    void memberScheduleOverlapReturnsConflict() {
        var response = new GlobalExceptionHandler().handleDataIntegrity(
                new DataIntegrityViolationException("ERROR: trg_member_schedule_conflict"));
        org.junit.jupiter.api.Assertions.assertEquals(409, response.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("SCHEDULING_MEMBER_TIME_OVERLAP", response.getBody().getCode());
    }

    /** Kiểm thử P1-BE-12: IllegalStateException rơi về HTTP 500 không lộ nội dung nội bộ; IllegalArgumentException trả 400 thông báo chung đã dịch. */
    @Test
    void illegalStateFallsTo500AndIllegalArgumentDoesNotLeakRawMessage() throws Exception {
        mockMvcFor(new IllegalStateException("internal-vnpay-key-secret")).perform(get("/trigger-test").header("Accept-Language", "en"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An internal system error occurred. Please contact administrator."));

        mockMvcFor(new IllegalArgumentException("raw internal stack hint")).perform(get("/trigger-test").header("Accept-Language", "en"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Bad request"));
    }

    /** Kiểm thử P1-BE-12: ánh xạ uq_users_email / key (email)= sang EMAIL_EXISTS và uq_users_username / key (username)= sang USERNAME_EXISTS. */
    @Test
    void mapsNamedAndKeyFallbackUniqueConstraintsForEmailAndUsername() {
        var handler = new GlobalExceptionHandler();
        var emailByKey = handler.handleDataIntegrity(
                new DataIntegrityViolationException("ERROR: duplicate key value violates unique constraint \"uk6dotkott2kjsp8vw4d0m25fb7\" Detail: Key (email)=(a@b.com) already exists."));
        org.junit.jupiter.api.Assertions.assertEquals(409, emailByKey.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("EMAIL_EXISTS", emailByKey.getBody().getCode());

        var usernameByConstraint = handler.handleDataIntegrity(
                new DataIntegrityViolationException("ERROR: duplicate key value violates unique constraint \"uq_users_username\""));
        org.junit.jupiter.api.Assertions.assertEquals(409, usernameByConstraint.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("USERNAME_EXISTS", usernameByConstraint.getBody().getCode());

        var usernameByKey = handler.handleDataIntegrity(
                new DataIntegrityViolationException("Detail: Key (username)=(alice) already exists."));
        org.junit.jupiter.api.Assertions.assertEquals(409, usernameByKey.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals("USERNAME_EXISTS", usernameByKey.getBody().getCode());
    }

    /** Kiểm thử P1-BE-12 & P2-BE-15: các handler 4xx mới (413, 400 multipart/sort, 415, 406, ResponseStatusException) và lọc tên method ở ConstraintViolation. */
    @Test
    void standard4xxHandlersAndConstraintViolationLeafPathWork() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        var handler = new GlobalExceptionHandler(new MessageService(source));

        org.junit.jupiter.api.Assertions.assertEquals(413,
                handler.handleMaxUploadSize(new org.springframework.web.multipart.MaxUploadSizeExceededException(1024)).getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals(400,
                handler.handleMultipart(new org.springframework.web.multipart.MultipartException("bad multipart")).getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals(415,
                handler.handleMediaTypeNotSupported(new org.springframework.web.HttpMediaTypeNotSupportedException("text/plain")).getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals(406,
                handler.handleMediaTypeNotAcceptable(new org.springframework.web.HttpMediaTypeNotAcceptableException("not acceptable")).getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertEquals(404,
                handler.handleResponseStatus(new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "secret internal reason")).getStatusCode().value());

        @SuppressWarnings("unchecked")
        jakarta.validation.ConstraintViolation<Object> violation = org.mockito.Mockito.mock(jakarta.validation.ConstraintViolation.class);
        jakarta.validation.Path path = org.mockito.Mockito.mock(jakarta.validation.Path.class);
        org.mockito.Mockito.when(path.toString()).thenReturn("getAll.memberId");
        org.mockito.Mockito.when(violation.getPropertyPath()).thenReturn(path);
        org.mockito.Mockito.when(violation.getMessage()).thenReturn("{error.bad_request}");
        var cvRes = handler.handleConstraintViolation(new jakarta.validation.ConstraintViolationException(java.util.Set.of(violation)));
        org.junit.jupiter.api.Assertions.assertEquals(400, cvRes.getStatusCode().value());
        @SuppressWarnings("unchecked")
        java.util.Map<String, String> details = (java.util.Map<String, String>) cvRes.getBody().getDetails();
        org.junit.jupiter.api.Assertions.assertTrue(details.containsKey("memberId"));
        org.junit.jupiter.api.Assertions.assertFalse(details.containsKey("getAll.memberId"));
        org.junit.jupiter.api.Assertions.assertEquals("Yêu cầu không hợp lệ", details.get("memberId"));
    }

    /** Kiểm thử: giữ nguyên phản hồi của trigger PostgreSQL. */
    @ParameterizedTest
    @MethodSource("triggerFailures")
    void preservesPostgresTriggerResponses(TriggerFailure trigger, String databaseMessage, String language) throws Exception {
        SQLException sqlError = new SQLException("ERROR: " + databaseMessage, trigger.sqlState());
        DataAccessException translated = translate(sqlError);
        assertInstanceOf(DataIntegrityViolationException.class, translated);

        assertTriggerResponse(translated, trigger, language);
    }

    /** Kiểm thử: lỗi database không liên quan vẫn là lỗi server đã dịch. */
    @ParameterizedTest
    @MethodSource("unrelatedDatabaseFailures")
    void keepsUnrelatedDatabaseFailuresAsLocalizedServerErrors(SQLException sqlError, String language) throws Exception {
        DataAccessException translated = translate(sqlError);

        mockMvcFor(translated).perform(get("/trigger-test").header("Accept-Language", language))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.details").doesNotExist())
                .andExpect(jsonPath("$.message").value(language.equals("vi")
                        ? "Đã xảy ra lỗi hệ thống. Vui lòng liên hệ quản trị viên."
                        : "An internal system error occurred. Please contact administrator."));
    }

    /** Kiểm thử: phản hồi trigger mặc định bằng tiếng Việt. */
    @Test
    void defaultsTriggerResponseToVietnamese() throws Exception {
        mockMvcFor(translate(new SQLException(DB_CAPACITY_VI, "23514"))).perform(get("/trigger-test"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLASS_CAPACITY_EXCEEDED"))
                .andExpect(jsonPath("$.message").value(CAPACITY_VI));
    }

    /** Kiểm thử: các vi phạm CHECK khác vẫn là lỗi toàn vẹn dữ liệu chung. */
    @ParameterizedTest
    @MethodSource("unrelatedIntegrityFailures")
    void keepsOtherCheckViolationsAsGenericIntegrityErrors(String databaseMessage, String language) throws Exception {
        DataAccessException translated = translate(new SQLException(databaseMessage, "23514"));

        mockMvcFor(translated).perform(get("/trigger-test").header("Accept-Language", language))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DATA_INTEGRITY_VIOLATION"))
                .andExpect(jsonPath("$.message").value(language.equals("vi")
                        ? "Vi phạm ràng buộc toàn vẹn cơ sở dữ liệu."
                        : "Database integrity constraint violation."));
    }

    /** Hàm trợ giúp của test: khẳng định phản hồi của trigger. */
    private void assertTriggerResponse(DataAccessException failure, TriggerFailure trigger, String language) throws Exception {
        mockMvcFor(failure).perform(get("/trigger-test").header("Accept-Language", language))
                .andExpect(status().is(trigger.status()))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.status").value(trigger.status()))
                .andExpect(jsonPath("$.code").value(trigger.code()))
                .andExpect(jsonPath("$.details").doesNotExist())
                .andExpect(jsonPath("$.message").value(language.equals("vi") ? trigger.vietnamese() : trigger.english()));
    }

    /** Hàm trợ giúp của test: dịch một lỗi database thành phản hồi HTTP. */
    private static DataAccessException translate(SQLException sqlError) {
        PostgreSQLDialect dialect = new PostgreSQLDialect();
        StandardSQLExceptionConverter converter = new StandardSQLExceptionConverter(
                dialect.buildSQLExceptionConversionDelegate(), new SQLStateConversionDelegate(dialect));
        JDBCException hibernateError = converter.convert(sqlError, "could not execute statement", "insert into private_table values (?)");
        DataAccessException translated = new HibernateJpaDialect().translateExceptionIfPossible(hibernateError);
        assertNotNull(translated);
        return translated;
    }

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (mock mvc for). */
    private MockMvc mockMvcFor(RuntimeException failure) {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        source.setFallbackToSystemLocale(false);
        return MockMvcBuilders.standaloneSetup(new FailingController(failure))
                .setControllerAdvice(new GlobalExceptionHandler(new MessageService(source)))
                .setLocaleResolver(new I18nConfig().localeResolver())
                .build();
    }

    /** Hàm trợ giúp của test: cung cấp các lỗi trigger để test tham số hóa. */
    private static Stream<Arguments> triggerFailures() {
        return Stream.of(
                new TriggerFailure(DB_CAPACITY_VI, "trg_enrollments_check_capacity", "23514", 409,
                        "CLASS_CAPACITY_EXCEEDED", CAPACITY_VI, CAPACITY_EN),
                new TriggerFailure("Huấn luyện viên hoặc phòng tập đã có lịch trùng khung giờ này.",
                        "trg_sessions_check_conflict", "23P01", 409,
                        "SCHEDULE_CONFLICT", SCHEDULE_VI, SCHEDULE_EN),
                new TriggerFailure("Bộ môn này đã có lớp học khác trùng khung giờ.",
                        "trg_sessions_check_discipline_conflict", "23P01", 409,
                        "SCHEDULING_DISCIPLINE_CONFLICT", DISCIPLINE_CONFLICT_VI, DISCIPLINE_CONFLICT_EN),
                new TriggerFailure("trg_sessions_slot_discipline_limit", "trg_sessions_slot_discipline_limit", "23P01", 409,
                        "SCHEDULING_SLOT_DISCIPLINE_LIMIT", "Slot này đã có tối đa 2 bộ môn. Hãy chọn slot hoặc ngày khác.",
                        "This slot already has the maximum of 2 disciplines. Choose another slot or date."),
                new TriggerFailure("Học viên không có gói thành viên còn hiệu lực để đăng ký lớp.",
                        "trg_enrollments_check_membership", "23514", 403,
                        "MEMBERSHIP_INACTIVE_OR_EXPIRED", MEMBERSHIP_VI, MEMBERSHIP_EN),
                new TriggerFailure("Học viên không có gói thành viên còn hiệu lực để check-in.",
                        "trg_checkins_check_membership", "23514", 403,
                        "MEMBERSHIP_INACTIVE_OR_EXPIRED", CHECKIN_MEMBERSHIP_VI, CHECKIN_MEMBERSHIP_EN),
                new TriggerFailure("trg_schedule_invalid_slot",
                        "trg_schedule_invalid_slot", "23514", 400,
                        "SCHEDULING_INVALID_SLOT", INVALID_SLOT_VI, INVALID_SLOT_EN))
                .flatMap(trigger -> Stream.of(trigger.message(), trigger.constraint())
                        .flatMap(message -> Stream.of("vi", "en").map(language -> Arguments.of(trigger, message, language))));
    }

    /** Hàm trợ giúp của test: cung cấp các lỗi database không liên quan. */
    private static Stream<Arguments> unrelatedDatabaseFailures() {
        return Stream.of(
                new SQLException("syntax error at or near 'trg_enrollments_check_capacity'.", "42601"),
                new SQLException(CAPACITY_VI, "42601"),
                new SQLException("Unknown processing failure for gói and khung giờ.", "P0001"),
                new SQLException("Connection to private_database failed.", "08001"))
                .flatMap(error -> Stream.of("vi", "en").map(language -> Arguments.of(error, language)));
    }

    /** Hàm trợ giúp của test: cung cấp các lỗi toàn vẹn không liên quan. */
    private static Stream<Arguments> unrelatedIntegrityFailures() {
        return Stream.of("ERROR: invalid gói value.", "ERROR: invalid khung giờ value.")
                .flatMap(message -> Stream.of("vi", "en").map(language -> Arguments.of(message, language)));
    }

    /** Bản ghi mô tả một lỗi trigger dùng cho test tham số hóa. */
    private record TriggerFailure(String message, String constraint, String sqlState,
                                  int status, String code, String vietnamese, String english) { }

    /** Bộ kiểm thử cho controller FailingController (failing controller). */
    @RestController
    static class FailingController {
        private final RuntimeException failure;

        FailingController(RuntimeException failure) {
            this.failure = failure;
        }

        /** Hàm trợ giúp của test: tạo ngoại lệ lỗi trigger. */
        @GetMapping("/trigger-test")
        void fail() {
            throw failure;
        }
    }
}
