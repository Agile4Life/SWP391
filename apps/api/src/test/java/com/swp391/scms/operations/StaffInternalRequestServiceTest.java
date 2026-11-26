package com.swp391.scms.operations;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.operations.dto.StaffInternalRequestCreateDto;
import com.swp391.scms.operations.dto.StaffInternalRequestDto;
import com.swp391.scms.operations.dto.StaffInternalRequestReviewDto;
import com.swp391.scms.operations.entity.StaffInternalRequest;
import com.swp391.scms.operations.repository.StaffInternalRequestRepository;
import com.swp391.scms.operations.service.StaffInternalRequestService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service StaffInternalRequestService (staff internal request service). */
@ExtendWith(MockitoExtension.class)
class StaffInternalRequestServiceTest {

    @Mock
    private StaffInternalRequestRepository requestRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    private static final Clock FIXED_CLOCK = Clock.fixed(
            Instant.parse("2026-11-26T03:00:00Z"),
            com.swp391.scms.common.CenterTime.ZONE);
    private static final LocalDate FIXED_TODAY = LocalDate.now(FIXED_CLOCK);
    private static final LocalDateTime FIXED_NOW = LocalDateTime.now(FIXED_CLOCK);

    private StaffInternalRequestService service;

    private User staffUser;
    private User managerUser;

    /** Chuẩn bị trước mỗi test: tạo StaffInternalRequestService với repository giả lập. */
    @BeforeEach
    void setUp() {
        var messages = new org.springframework.context.support.ResourceBundleMessageSource();
        messages.setBasename("i18n/messages");
        messages.setDefaultEncoding("UTF-8");
        org.springframework.context.i18n.LocaleContextHolder.setLocale(java.util.Locale.forLanguageTag("vi"));
        service = new StaffInternalRequestService(requestRepository, userRepository, notificationService,
                new com.swp391.scms.common.i18n.MessageService(messages));
        service.setClock(FIXED_CLOCK);

        Role staffRole = new Role();
        staffRole.setCode("STAFF");
        staffRole.setName("Nhân viên");

        Role managerRole = new Role();
        managerRole.setCode("MANAGER");
        managerRole.setName("Quản lý");

        staffUser = new User();
        staffUser.setId(10L);
        staffUser.setFullName("Nguyễn Văn Nhân Viên");
        staffUser.setEmail("staff@solfitness.vn");
        staffUser.setRole(staffRole);

        managerUser = new User();
        managerUser.setId(1L);
        managerUser.setFullName("Trần Quản Lý");
        managerUser.setEmail("manager@solfitness.vn");
        managerUser.setRole(managerRole);
    }

    /** Dọn dẹp sau mỗi test: đặt lại locale mặc định. */
    @org.junit.jupiter.api.AfterEach
    void resetLocale() {
        org.springframework.context.i18n.LocaleContextHolder.resetLocaleContext();
    }

    /** Kiểm thử: Tạo đơn xin nghỉ phép thành công và gửi thông báo cho Manager */
    @Test
    @DisplayName("Tạo đơn xin nghỉ phép thành công và gửi thông báo cho Manager")
    void createRequest_Success() {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));
        when(userRepository.findActiveManagers()).thenReturn(List.of(staffUser, managerUser));

        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(invocation -> {
            StaffInternalRequest saved = invocation.getArgument(0);
            saved.setId(100L);
            return saved;
        });

        LocalDate today = FIXED_TODAY;
        StaffInternalRequestCreateDto dto = new StaffInternalRequestCreateDto(
                "LEAVE",
                "Xin nghỉ phép việc gia đình",
                "Tôi có việc bận gia đình cần nghỉ 2 ngày",
                today.plusDays(2),
                today.plusDays(3),
                null,
                null
        );

        StaffInternalRequestDto result = service.createRequest(10L, dto);

        assertNotNull(result);
        assertEquals(100L, result.id());
        assertEquals("LEAVE", result.requestType());
        assertEquals("PENDING", result.status());
        assertEquals("Xin nghỉ phép việc gia đình", result.title());

        verify(notificationService).send(
                eq(1L),
                contains("cần duyệt"),
                argThat(body -> body.contains("Nhân viên") && body.contains("Xin nghỉ phép")
                        && !body.contains("STAFF") && !body.contains("LEAVE")),
                eq("system"),
                isNull(),
                eq(100L),
                eq("/manager/requests")
        );
    }

    /** Kiểm thử: Tạo đơn với loại không hợp lệ ném BadRequestException */
    @Test
    @DisplayName("Tạo đơn với loại không hợp lệ ném BadRequestException")
    void createRequest_InvalidType_ThrowsBadRequest() {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));

        StaffInternalRequestCreateDto dto = new StaffInternalRequestCreateDto(
                "INVALID_TYPE",
                "Tiêu đề",
                "Lý do",
                null, null, null, null
        );

        assertThrows(BadRequestException.class, () -> service.createRequest(10L, dto));
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử: Hủy đơn thành công khi đơn còn đang PENDING */
    @Test
    @DisplayName("Hủy đơn thành công khi đơn còn đang PENDING")
    void cancelRequest_Success() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(50L);
        req.setUser(staffUser);
        req.setStatus("PENDING");
        req.setTitle("Đổi ca trực");

        when(requestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(req));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(i -> i.getArgument(0));

        StaffInternalRequestDto cancelled = service.cancelRequest(10L, 50L);

        assertEquals("CANCELLED", cancelled.status());
        verify(requestRepository).save(req);
    }

    /** Kiểm thử: Người dùng khác hủy đơn của đồng nghiệp bị ForbiddenException */
    @Test
    @DisplayName("Người dùng khác hủy đơn của đồng nghiệp bị ForbiddenException")
    void cancelRequest_Forbidden_WhenNotOwner() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(50L);
        req.setUser(staffUser);
        req.setStatus("PENDING");

        when(requestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(req));

        assertThrows(ForbiddenException.class, () -> service.cancelRequest(999L, 50L));
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử: Hủy đơn đã được duyệt hoặc từ chối ném BadRequestException */
    @Test
    @DisplayName("Hủy đơn đã được duyệt hoặc từ chối ném BadRequestException")
    void cancelRequest_BadRequest_WhenNotPending() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(50L);
        req.setUser(staffUser);
        req.setStatus("APPROVED");

        when(requestRepository.findByIdForUpdate(50L)).thenReturn(Optional.of(req));

        assertThrows(BadRequestException.class, () -> service.cancelRequest(10L, 50L));
    }

    /** Kiểm thử: Quản lý duyệt đơn (APPROVED) thành công và gửi thông báo cho nhân viên */
    @Test
    @DisplayName("Quản lý duyệt đơn (APPROVED) thành công và gửi thông báo cho nhân viên")
    void reviewRequest_Approve_Success() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(200L);
        req.setUser(staffUser);
        req.setStatus("PENDING");
        req.setRequestType("LEAVE");
        req.setTitle("Xin nghỉ phép");

        when(requestRepository.findByIdForUpdate(200L)).thenReturn(Optional.of(req));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(i -> i.getArgument(0));

        StaffInternalRequestReviewDto dto = new StaffInternalRequestReviewDto("APPROVED", "Đã bố trí nhân sự thay thế, đồng ý.");

        StaffInternalRequestDto reviewed = service.reviewRequest(1L, 200L, dto);

        assertEquals("APPROVED", reviewed.status());
        assertEquals("Đã bố trí nhân sự thay thế, đồng ý.", reviewed.managerNotes());
        assertEquals(1L, reviewed.reviewedByUserId());

        verify(notificationService).send(
                eq(10L),
                contains("đã được duyệt"),
                contains("CHẤP THUẬN"),
                eq("system"),
                isNull(),
                eq(200L)
        );
    }

    /** Kiểm thử: Quản lý từ chối đơn (REJECTED) bắt buộc phải có lý do */
    @Test
    @DisplayName("Quản lý từ chối đơn (REJECTED) bắt buộc phải có lý do")
    void reviewRequest_Reject_MissingReason_ThrowsBadRequest() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(200L);
        req.setUser(staffUser);
        req.setStatus("PENDING");

        when(requestRepository.findByIdForUpdate(200L)).thenReturn(Optional.of(req));

        StaffInternalRequestReviewDto dto = new StaffInternalRequestReviewDto("REJECTED", "   ");

        assertThrows(BadRequestException.class, () -> service.reviewRequest(1L, 200L, dto));
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử: Duyệt đơn đã xử lý trước đó ném BadRequestException */
    @Test
    @DisplayName("Duyệt đơn đã xử lý trước đó ném BadRequestException")
    void reviewRequest_AlreadyReviewed_ThrowsBadRequest() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(200L);
        req.setUser(staffUser);
        req.setStatus("REJECTED");

        when(requestRepository.findByIdForUpdate(200L)).thenReturn(Optional.of(req));

        StaffInternalRequestReviewDto dto = new StaffInternalRequestReviewDto("APPROVED", "Duyệt lại");

        assertThrows(BadRequestException.class, () -> service.reviewRequest(1L, 200L, dto));
    }
    /** Kiểm thử: tạo yêu cầu từ chối khoảng ngày bị đảo ngược. */
    @Test
    void createRequestRejectsReversedDateRange() {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));
        LocalDate today = FIXED_TODAY;
        var dto = new StaffInternalRequestCreateDto("LEAVE", "Leave", "Reason",
                today.plusDays(5), today.plusDays(3), null, null);
        assertThrows(BadRequestException.class, () -> service.createRequest(10L, dto));
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử: đơn nghỉ trùng ngày đã duyệt được cảnh báo trước và chỉ gửi sau khi xác nhận. */
    @Test
    void aLeaveOnDaysAlreadyApprovedIsWarnedFirstAndSentOnlyAfterConfirmation() {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));
        LocalDate start = FIXED_TODAY.plusDays(5);
        LocalDate end = start.plusDays(1);
        StaffInternalRequest approved = new StaffInternalRequest();
        approved.setUser(staffUser);
        approved.setRequestType("LEAVE");
        approved.setStatus("APPROVED");
        approved.setStartDate(start);
        approved.setEndDate(end);
        when(requestRepository.findOverlappingLeaves(10L, start, end))
                .thenReturn(java.util.List.of(approved));

        var again = new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Việc riêng",
                start, end, null, null);
        var error = assertThrows(com.swp391.scms.common.exception.ConflictException.class, () -> service.createRequest(10L, again));
        assertEquals("LEAVE_OVERLAP", error.getErrorCode());
        verify(requestRepository, never()).save(any());

        when(requestRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        var confirmed = new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Việc riêng",
                start, end, null, null, true);
        service.createRequest(10L, confirmed);
        verify(requestRepository).save(any());
    }

    /** Kiểm thử: người thay thế phải là nhân viên đang hoạt động khác cùng nhóm vai trò. */
    @Test
    void replacementMustBeAnotherActiveStaffMember() {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));
        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        User member = new User();
        member.setId(50L);
        member.setStatus("active");
        member.setRole(memberRole);
        when(userRepository.findByIdAndDeletedAtIsNull(50L)).thenReturn(Optional.of(member));
        LocalDate today = FIXED_TODAY;
        var dto = new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Việc riêng",
                today.plusDays(2), today.plusDays(3), null, 50L);

        var error = assertThrows(BadRequestException.class, () -> service.createRequest(10L, dto));
        assertEquals("INVALID_REPLACEMENT", error.getErrorCode());
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử P1-BE-41 & P3-BE-16: duyệt đơn nghỉ báo quản lý kèm actionPath /manager/coach-assignments, định dạng ngày dd/MM/yyyy và trả số buổi xung đột. */
    @Test
    void approvingLeaveTellsManagerWhatNeedsCover() {
        var sessions = mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        var bookings = mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "classSessionRepository", sessions);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "coachBookingRepository", bookings);
        LocalDate start = FIXED_TODAY.plusDays(5); // 01/12/2026
        LocalDate end = start.plusDays(5);         // 06/12/2026
        StaffInternalRequest leave = new StaffInternalRequest();
        leave.setId(100L);
        leave.setUser(staffUser);
        leave.setRequestType("LEAVE");
        leave.setTitle("Nghỉ phép");
        leave.setStartDate(start);
        leave.setEndDate(end);
        leave.setStatus("PENDING");
        when(requestRepository.findByIdForUpdate(100L)).thenReturn(Optional.of(leave));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(call -> call.getArgument(0));
        when(sessions.countScheduledForCoachBetween(10L, start, end)).thenReturn(2L);
        when(bookings.countConfirmedForCoachBetween(10L, start, end)).thenReturn(1L);

        StaffInternalRequestDto dto = service.reviewRequest(1L, 100L, new StaffInternalRequestReviewDto("APPROVED", null));

        assertEquals(2L, dto.affectedClassSessionCount());
        assertEquals(1L, dto.affectedPtSessionCount());
        verify(notificationService).send(eq(1L), any(),
                argThat(body -> body.contains("2 buổi lớp nhóm và 1 buổi PT 1:1")
                        && body.contains("01/12/2026") && body.contains("06/12/2026")
                        && !body.contains("2026-12-01")),
                eq("system"), isNull(), eq(100L),
                eq("/manager/coach-assignments"));
    }

    /** Kiểm thử P1-BE-41 & P3-BE-16: khi caller truyền confirmConflicts = false và có buổi xung đột thì chặn duyệt bằng 409 với ngày dd/MM/yyyy. */
    @Test
    void reviewRequestBlocksCoachLeaveWhenConfirmConflictsIsFalse() {
        var sessions = mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        var bookings = mock(com.swp391.scms.coaching.repository.CoachBookingRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "classSessionRepository", sessions);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "coachBookingRepository", bookings);
        LocalDate start = FIXED_TODAY.plusDays(5); // 01/12/2026
        LocalDate end = start.plusDays(2);         // 03/12/2026
        StaffInternalRequest leave = new StaffInternalRequest();
        leave.setId(101L);
        leave.setUser(staffUser);
        leave.setRequestType("LEAVE");
        leave.setStartDate(start);
        leave.setEndDate(end);
        leave.setStatus("PENDING");
        when(requestRepository.findByIdForUpdate(101L)).thenReturn(Optional.of(leave));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        when(sessions.countScheduledForCoachBetween(10L, start, end)).thenReturn(1L);
        when(bookings.countConfirmedForCoachBetween(10L, start, end)).thenReturn(0L);

        var ex = assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                () -> service.reviewRequest(1L, 101L, new StaffInternalRequestReviewDto("APPROVED", null, false)));
        assertEquals("COACH_LEAVE_HAS_CONFLICTS", ex.getErrorCode());
        // Không có buổi PT 1:1 -> câu chỉ nhắc buổi lớp nhóm.
        assertEquals("notifications.operations.leave_impact.body_classes", ex.getMessageKey());
        assertEquals("01/12/2026", ex.getMessageArgs()[1]);
        assertEquals("03/12/2026", ex.getMessageArgs()[2]);
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử P1-BE-42: duyệt/từ chối đơn của nhân sự đã xóa mềm không gọi notification và không bị 404 rollback. */
    @Test
    void reviewRequestOfSoftDeletedStaffSucceedsWithoutRollback() {
        staffUser.setDeletedAt(FIXED_NOW);
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(205L);
        req.setUser(staffUser);
        req.setStatus("PENDING");
        req.setRequestType("OTHER");
        req.setTitle("Đơn của nhân viên cũ");

        when(requestRepository.findByIdForUpdate(205L)).thenReturn(Optional.of(req));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(i -> i.getArgument(0));

        StaffInternalRequestDto reviewed = service.reviewRequest(1L, 205L, new StaffInternalRequestReviewDto("REJECTED", "Nhân sự đã nghỉ việc"));
        assertEquals("REJECTED", reviewed.status());
        verify(notificationService, never()).send(eq(10L), any(), any(), any(), any(), any());
    }

    /** Kiểm thử P1-BE-42: lỗi ResourceNotFoundException khi gửi thông báo kết quả không làm rollback duyệt đơn. */
    @Test
    void reviewRequestSwallowsResourceNotFoundFromNotificationService() {
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(206L);
        req.setUser(staffUser);
        req.setStatus("PENDING");
        req.setRequestType("OTHER");
        req.setTitle("Đơn hỗ trợ");

        when(requestRepository.findByIdForUpdate(206L)).thenReturn(Optional.of(req));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(i -> i.getArgument(0));
        doThrow(new com.swp391.scms.common.exception.ResourceNotFoundException("resource.user", 10L))
                .when(notificationService).send(eq(10L), any(), any(), any(), any(), eq(206L));

        StaffInternalRequestDto reviewed = service.reviewRequest(1L, 206L, new StaffInternalRequestReviewDto("APPROVED", "OK"));
        assertEquals("APPROVED", reviewed.status());
    }

    /** Kiểm thử P2-BE-43: chặn ngày quá khứ, khoảng nghỉ > 90 ngày, endDate mồ côi và kiểm tra @Size DTO. */
    @Test
    void createRequestRejectsPastDateExcessiveSpanOrphanEndDateAndOverlongText() throws Exception {
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));
        LocalDate today = FIXED_TODAY;

        assertThrows(BadRequestException.class, () -> service.createRequest(10L,
                new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Lý do",
                        today.minusDays(1), today, null, null)));
        assertThrows(BadRequestException.class, () -> service.createRequest(10L,
                new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Lý do",
                        today.plusDays(1), today.plusDays(95), null, null)));
        assertThrows(BadRequestException.class, () -> service.createRequest(10L,
                new StaffInternalRequestCreateDto("OTHER", "Đơn", "Lý do",
                        null, today.plusDays(1), null, null)));
        assertThrows(BadRequestException.class, () -> service.createRequest(10L,
                new StaffInternalRequestCreateDto("OTHER", "a".repeat(201), "Lý do",
                        null, null, null, null)));
        assertThrows(BadRequestException.class, () -> service.createRequest(10L,
                new StaffInternalRequestCreateDto("OTHER", "Đơn", "Lý do",
                        null, null, "s".repeat(101), null)));

        assertEquals(200, StaffInternalRequestCreateDto.class.getDeclaredField("title")
                .getAnnotation(jakarta.validation.constraints.Size.class).max());
        assertEquals(100, StaffInternalRequestCreateDto.class.getDeclaredField("targetShift")
                .getAnnotation(jakarta.validation.constraints.Size.class).max());
        assertEquals(2000, StaffInternalRequestCreateDto.class.getDeclaredField("reason")
                .getAnnotation(jakarta.validation.constraints.Size.class).max());
        assertEquals(2000, StaffInternalRequestReviewDto.class.getDeclaredField("managerNotes")
                .getAnnotation(jakarta.validation.constraints.Size.class).max());
    }

    /** Kiểm thử P2-BE-44: chặn tự duyệt đơn bằng 403 và chặn duyệt chồng đơn LEAVE đã APPROVED bằng 409. */
    @Test
    void reviewRequestRejectsSelfApprovalAndOverlappingApprovedLeave() {
        LocalDate start = FIXED_TODAY.plusDays(5);
        LocalDate end = start.plusDays(2);
        StaffInternalRequest req = new StaffInternalRequest();
        req.setId(300L);
        req.setUser(staffUser);
        req.setStatus("PENDING");
        req.setRequestType("LEAVE");
        req.setStartDate(start);
        req.setEndDate(end);

        when(requestRepository.findByIdForUpdate(300L)).thenReturn(Optional.of(req));

        assertThrows(ForbiddenException.class,
                () -> service.reviewRequest(10L, 300L, new StaffInternalRequestReviewDto("APPROVED", "Tự duyệt")));

        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(managerUser));
        StaffInternalRequest existingApproved = new StaffInternalRequest();
        existingApproved.setId(299L);
        existingApproved.setStartDate(start);
        existingApproved.setEndDate(end);
        when(requestRepository.findApprovedOverlappingLeavesForUpdate(10L, 300L, start, end))
                .thenReturn(List.of(existingApproved));

        assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                () -> service.reviewRequest(1L, 300L, new StaffInternalRequestReviewDto("APPROVED", "OK")));
        verify(requestRepository, never()).save(any());
    }

    /** Kiểm thử P2-BE-45: người thay thế phải cùng nhóm vai trò chức năng và không đang nghỉ phép đã duyệt. */
    @Test
    void createRequestEnforcesSameRoleGroupAndAvailabilityForReplacement() {
        LocalDate today = FIXED_TODAY;
        Role coachRole = new Role(); coachRole.setCode("COACH");
        Role receptionRole = new Role(); receptionRole.setCode("RECEPTIONIST");

        User coachA = new User(); coachA.setId(20L); coachA.setStatus("active"); coachA.setRole(coachRole);
        User coachB = new User(); coachB.setId(21L); coachB.setStatus("active"); coachB.setRole(coachRole);
        User receptionist = new User(); receptionist.setId(30L); receptionist.setStatus("active"); receptionist.setRole(receptionRole);

        when(userRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(coachA));
        when(userRepository.findByIdAndDeletedAtIsNull(30L)).thenReturn(Optional.of(receptionist));
        when(userRepository.findByIdAndDeletedAtIsNull(21L)).thenReturn(Optional.of(coachB));
        when(userRepository.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(staffUser));

        // COACH không thể nhờ RECEPTIONIST thay
        assertThrows(BadRequestException.class, () -> service.createRequest(20L,
                new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Bận",
                        today.plusDays(2), today.plusDays(3), null, 30L)));

        // COACH nhờ COACH khác đang nghỉ phép đã duyệt -> bị từ chối
        when(requestRepository.existsApprovedLeaveOverlapping(21L, today.plusDays(2), today.plusDays(3))).thenReturn(true);
        assertThrows(BadRequestException.class, () -> service.createRequest(20L,
                new StaffInternalRequestCreateDto("LEAVE", "Nghỉ", "Bận",
                        today.plusDays(2), today.plusDays(3), null, 21L)));

        // STAFF nhờ RECEPTIONIST (cùng nhóm DESK_STAFF) không nghỉ -> hợp lệ
        when(requestRepository.existsApprovedLeaveOverlapping(30L, today.plusDays(2), today.plusDays(3))).thenReturn(false);
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(i -> i.getArgument(0));
        StaffInternalRequestDto created = service.createRequest(10L,
                new StaffInternalRequestCreateDto("SHIFT_EXCHANGE", "Đổi ca", "Việc riêng",
                        today.plusDays(2), today.plusDays(3), "Sáng", 30L));
        assertEquals(30L, created.replacementUserId());
    }

    /** Kiểm thử: giá trị lọc ALL được bỏ qua ở bộ lọc trạng thái và loại và giới hạn số lượng trả về. */
    @Test
    void ignoresAllPlaceholderInStatusAndTypeFilters() {
        var limit = org.springframework.data.domain.PageRequest.of(0, 200);
        when(requestRepository.findByUserIdOrderByCreatedAtDesc(10L, limit)).thenReturn(List.of());
        when(requestRepository.findWithFilters(null, null, limit)).thenReturn(List.of());

        assertTrue(service.getMyRequests(10L, "ALL").isEmpty());
        assertTrue(service.getAllRequests("ALL", "all").isEmpty());

        verify(requestRepository).findByUserIdOrderByCreatedAtDesc(10L, limit);
        verify(requestRepository).findWithFilters(null, null, limit);
    }

    /** Kiểm thử P3-BE-16: thông báo tạo đơn dùng nhãn vai trò và loại đơn đã dịch (VI/EN), không ghép mã enum thô. */
    @Test
    void createRequestLocalizesRoleAndTypeInNotificationsForBothVietnameseAndEnglish() {
        Role coachRole = new Role();
        coachRole.setCode("COACH");
        User coach = new User();
        coach.setId(20L);
        coach.setFullName("HLV Minh");
        coach.setRole(coachRole);
        when(userRepository.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(coach));
        when(userRepository.findActiveManagers()).thenReturn(List.of(managerUser));
        when(requestRepository.save(any(StaffInternalRequest.class))).thenAnswer(inv -> {
            StaffInternalRequest s = inv.getArgument(0);
            s.setId(401L);
            return s;
        });

        var dto = new StaffInternalRequestCreateDto(
                "SHIFT_EXCHANGE", "Đổi ca sáng", "Bận công việc", FIXED_TODAY.plusDays(1), FIXED_TODAY.plusDays(1), "Sáng", null);
        service.createRequest(20L, dto);
        verify(notificationService).send(eq(1L), any(),
                argThat(body -> body.contains("Huấn luyện viên") && body.contains("Đổi ca trực")
                        && !body.contains("COACH") && !body.contains("SHIFT_EXCHANGE")),
                eq("system"), isNull(), eq(401L), eq("/manager/requests"));

        reset(notificationService);
        org.springframework.context.i18n.LocaleContextHolder.setLocale(java.util.Locale.ENGLISH);
        service.createRequest(20L, dto);
        verify(notificationService).send(eq(1L), any(),
                argThat(body -> body.contains("Coach") && body.contains("Shift exchange")
                        && !body.contains("COACH") && !body.contains("SHIFT_EXCHANGE")),
                eq("system"), isNull(), eq(401L), eq("/manager/requests"));
    }
}
