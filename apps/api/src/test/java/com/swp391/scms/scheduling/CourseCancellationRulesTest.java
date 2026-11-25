package com.swp391.scms.scheduling;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Bộ kiểm thử cho CourseCancellationRules (quy tắc hủy khóa học).
 *
 * Hội viên không thể hủy khóa học đã bắt đầu; nếu hủy trước khi bắt đầu thì khoản phí chưa thanh toán sẽ bị vô hiệu hóa.
 */
class CourseCancellationRulesTest {
    private final ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private final GymClassRepository gymClasses = mock(GymClassRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final PaymentRepository payments = mock(PaymentRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
    private final AuthenticatedPrincipal member = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");
    private EnrollmentService service;
    private ClassEnrollment enrollment;

    /** Chuẩn bị trước mỗi test: tạo dịch vụ ghi danh khóa học với repository giả lập. */
    @BeforeEach
    void setUp() {
        service = new EnrollmentService(enrollments, null, gymClasses, null, members, notifications, null, clock);
        service.setPaymentRepository(payments);
        Member owner = new Member();
        owner.setUserId(100L);
        enrollment = new ClassEnrollment();
        enrollment.setId(9L);
        enrollment.setMember(owner);
        enrollment.setStatus("booked");
        when(enrollments.findClassIdById(9L)).thenReturn(Optional.of(50L));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(new GymClass()));
        when(enrollments.findByIdForUpdate(9L)).thenReturn(Optional.of(enrollment));
        when(enrollments.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    /** Hàm trợ giúp của test: tạo khóa học bắt đầu vào một thời điểm cho trước. */
    private void courseStarting(LocalDate start) {
        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStartDate(start);
        enrollment.setGymClass(gymClass);
    }

    /** Kiểm thử: hội viên không được hủy khóa đã bắt đầu, nên lượt miễn phí không được hoàn lại. */
    @Test
    void aMemberCannotCancelACourseThatHasStartedSoTheCreditIsNotGivenBack() {
        courseStarting(LocalDate.of(2026, 11, 2));

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.cancel(member, 9L));

        assertEquals("SCHEDULING_CANNOT_CANCEL_STARTED_COURSE", ex.getErrorCode());
        assertEquals("booked", enrollment.getStatus());
        // Khóa học bắt đầu ngay hôm nay cũng được tính là đã bắt đầu.
        courseStarting(LocalDate.of(2026, 11, 9));
        assertThrows(BadRequestException.class, () -> service.cancel(member, 9L));
    }

    /** Kiểm thử: lễ tân vẫn được hủy thay hội viên sau khi khóa đã bắt đầu. */
    @Test
    void theDeskMayStillCancelOnBehalfOfAMemberAfterTheStart() {
        courseStarting(LocalDate.of(2026, 11, 2));

        service.cancel(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 9L);

        assertEquals("cancelled", enrollment.getStatus());
    }

    /** Kiểm thử: hủy trước khi khóa bắt đầu thì nhả chỗ và hủy khoản phí chưa thanh toán. */
    @Test
    void cancellingBeforeTheStartReleasesTheSeatAndVoidsTheUnpaidFee() {
        courseStarting(LocalDate.of(2026, 11, 20));
        Payment pending = new Payment();
        pending.setStatus("pending");
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(pending));

        service.cancel(member, 9L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("failed", pending.getStatus());
        verify(payments).save(pending);
    }

    /** Kiểm thử: hủy ghi danh theo mã khóa gửi thông báo class_enrollment cho hội viên. */
    @Test
    void cancelCourseEnrollmentNotifiesMember() {
        courseStarting(LocalDate.of(2026, 11, 20));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(enrollment.getMember()));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.empty());

        service.cancelCourseEnrollment(member, 50L);

        assertEquals("cancelled", enrollment.getStatus());
        verify(notifications).send(eq(100L), any(), any(), eq("system"), eq("class_enrollment"), eq(9L));
    }

    /** Kiểm thử P1-BE-15: DELETE /classes/enrollments/{id} hoàn học phí đã thanh toán vào ví và ghi nhận cancelledBy. */
    @Test
    void cancelByIdRefundsSuccessPaymentAndSetsCancelledByWhenBeforeCourseStart() {
        var wallets = mock(com.swp391.scms.wallet.WalletService.class);
        var userRepo = mock(com.swp391.scms.users.UserRepository.class);
        service.setWallets(wallets);
        service.setUserRepository(userRepo);

        var actorUser = new com.swp391.scms.users.entity.User();
        actorUser.setId(100L);
        when(userRepo.findById(100L)).thenReturn(Optional.of(actorUser));

        courseStarting(LocalDate.of(2026, 11, 20));
        Payment paid = new Payment();
        paid.setId(88L);
        paid.setClassEnrollmentId(9L);
        paid.setAmount(new java.math.BigDecimal("500000"));
        paid.setStatus("success");
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(paid));

        service.cancel(member, 9L);

        assertEquals("cancelled", enrollment.getStatus());
        assertSame(actorUser, enrollment.getCancelledBy());
        assertEquals("refunded", paid.getStatus());
        assertEquals(0, new java.math.BigDecimal("500000").compareTo(paid.getRefundedAmount()));
        verify(wallets).creditCourseRefund(eq(100L), eq(new java.math.BigDecimal("500000")),
                eq("COURSE_REFUND_9"), any());
    }

    /** Kiểm thử P1-BE-15: lễ tân hủy sau khi khóa đã bắt đầu vẫn ghi cancelledBy nhưng không tự động hoàn học phí. */
    @Test
    void staffCancelAfterCourseStartSetsCancelledByWithoutRefundingPaidFee() {
        var wallets = mock(com.swp391.scms.wallet.WalletService.class);
        var userRepo = mock(com.swp391.scms.users.UserRepository.class);
        service.setWallets(wallets);
        service.setUserRepository(userRepo);

        var staffUser = new com.swp391.scms.users.entity.User();
        staffUser.setId(2L);
        when(userRepo.findById(2L)).thenReturn(Optional.of(staffUser));

        courseStarting(LocalDate.of(2026, 11, 2));
        Payment paid = new Payment();
        paid.setId(88L);
        paid.setClassEnrollmentId(9L);
        paid.setAmount(new java.math.BigDecimal("500000"));
        paid.setStatus("success");
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(paid));

        service.cancel(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 9L);

        assertEquals("cancelled", enrollment.getStatus());
        assertSame(staffUser, enrollment.getCancelledBy());
        assertEquals("success", paid.getStatus());
        verifyNoInteractions(wallets);
    }

    /** Kiểm thử P1-BE-56 & P2-BE-20: cancelFutureEnrollmentsForMember không lưu {0} thô và đóng payment pending. */
    @Test
    void cancelFutureEnrollmentsResolvesHoldReasonWithoutLiteralPlaceholderAndFailsPendingPayment() {
        var messageSource = new org.springframework.context.support.ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        var realMessages = new com.swp391.scms.common.i18n.MessageService(messageSource);

        EnrollmentService localizedService = new EnrollmentService(
                enrollments, null, gymClasses, null, members, notifications, realMessages, clock);
        localizedService.setPaymentRepository(payments);

        courseStarting(LocalDate.of(2026, 11, 20));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(enrollment.getMember()));
        when(enrollments.findBookedClassIdsByMemberId(100L)).thenReturn(java.util.List.of(50L));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(enrollment.getGymClass()));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked"))
                .thenReturn(Optional.of(enrollment));

        Payment pending = new Payment();
        pending.setId(91L);
        pending.setClassEnrollmentId(9L);
        pending.setStatus("pending");
        when(payments.findByClassEnrollmentId(9L)).thenReturn(Optional.of(pending));

        int cancelled = localizedService.cancelFutureEnrollmentsForMember(100L, null);

        assertEquals(1, cancelled);
        assertEquals("cancelled", enrollment.getStatus());
        assertNotNull(enrollment.getCancelReason());
        assertFalse(enrollment.getCancelReason().contains("{0}"),
                "Cancel reason must never contain literal {0}: " + enrollment.getCancelReason());
        assertEquals("failed", pending.getStatus());
        verify(payments).save(pending);
    }
}
