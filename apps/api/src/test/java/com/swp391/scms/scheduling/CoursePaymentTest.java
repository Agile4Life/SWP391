package com.swp391.scms.scheduling;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.dto.VnpayDtos;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.PaymentService;
import com.swp391.scms.finance.service.VnpayPaymentGuard;
import com.swp391.scms.finance.service.VnpayPaymentService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.CourseCheckoutDto;
import com.swp391.scms.scheduling.dto.EnrollmentResponses.UnpaidCourseEnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.wallet.WalletDto;
import com.swp391.scms.wallet.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho CoursePayment (course payment). */
class CoursePaymentTest {

    private ClassEnrollmentRepository enrollments = mock(ClassEnrollmentRepository.class);
    private GymClassRepository gymClasses = mock(GymClassRepository.class);
    private MembershipSubscriptionRepository subscriptions = mock(MembershipSubscriptionRepository.class);
    private MemberRepository members = mock(MemberRepository.class);
    private PaymentRepository paymentRepository = mock(PaymentRepository.class);
    private Clock clock = Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private EnrollmentService enrollmentService;

    /** Chuẩn bị trước mỗi test: dựng dịch vụ và dữ liệu thanh toán khóa học. */
    @BeforeEach
    void setUp() {
        enrollmentService = new EnrollmentService(
                enrollments,
                null,
                gymClasses,
                subscriptions,
                members,
                null,
                null,
                clock
        );
        enrollmentService.setPaymentRepository(paymentRepository);
    }

    /** Kiểm thử: thanh toán tạo khoản pending khi vượt hạn mức. */
    @Test
    void testCheckoutCreatesPendingPaymentWhenQuotaExceeded() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);

        when(members.findById(100L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 12, 31));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class))).thenReturn(true);

        // Đã đăng ký 2 khóa học -> vượt hạn mức
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(eq(100L), eq("booked"), any(), any()))
                .thenReturn(2L);

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Yoga Advanced");
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 12, 20));
        gymClass.setCapacity(20);
        gymClass.setPrice(new BigDecimal("500000.00"));

        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(5L);

        ClassEnrollment savedEnrollment = new ClassEnrollment();
        savedEnrollment.setId(777L);
        savedEnrollment.setGymClass(gymClass);
        savedEnrollment.setMember(member);
        savedEnrollment.setStatus("booked");
        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenReturn(savedEnrollment);

        Payment savedPayment = new Payment();
        savedPayment.setId(888L);
        savedPayment.setMember(member);
        savedPayment.setClassEnrollmentId(777L);
        savedPayment.setAmount(new BigDecimal("500000.00"));
        savedPayment.setMethod("cash");
        savedPayment.setStatus("pending");
        when(paymentRepository.save(any(Payment.class))).thenReturn(savedPayment);

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "cash");

        assertNotNull(result);
        assertEquals(777L, result.enrollmentId());
        assertEquals(888L, result.paymentId());
        assertEquals(new BigDecimal("500000.00"), result.amount());
        assertEquals("cash", result.paymentMethod());
        assertEquals("pending", result.paymentStatus());

        ArgumentCaptor<Payment> captor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(captor.capture());
        Payment captured = captor.getValue();
        assertEquals(new BigDecimal("500000.00"), captured.getAmount());
        assertEquals("cash", captured.getMethod());
        assertEquals(777L, captured.getClassEnrollmentId());
    }

    /** Kiểm thử: thanh toán tính chiết khấu theo hạng thành viên trên phí khóa học. */
    @Test
    void testCheckoutChargesTheTierDiscountOnTheCourseFee() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));
        MembershipPackage gold = new MembershipPackage();
        gold.setName("GOLD");
        gold.setTier("GOLD");
        gold.setDurationDays(30);
        gold.setClassCreditLimit(2);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(gold);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 12, 31));
        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class))).thenReturn(true);
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(eq(100L), eq("booked"), any(), any())).thenReturn(2L);
        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Yoga Advanced");
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 12, 20));
        gymClass.setCapacity(20);
        gymClass.setPrice(new BigDecimal("500000.00"));
        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(1L);
        ClassEnrollment saved = new ClassEnrollment();
        saved.setId(9L);
        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenReturn(saved);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        enrollmentService.setMemberDiscounts(new com.swp391.scms.membership.service.MemberDiscountService(subscriptions, clock));

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "cash");

        assertEquals(0, new BigDecimal("450000").compareTo(result.amount()));
        ArgumentCaptor<Payment> payment = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(payment.capture());
        assertEquals(0, new BigDecimal("450000").compareTo(payment.getValue().getAmount()));
        assertTrue(payment.getValue().getNote().contains("giảm 10%"));
    }

    /** Kiểm thử: hủy trước khi bắt đầu làm thất bại khoản thanh toán khóa đang chờ. */
    @Test
    void testCancelBeforeStartFailsThePendingCoursePayment() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Yoga Advanced");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(777L);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.save(any(ClassEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Payment pending = new Payment();
        pending.setId(888L);
        pending.setClassEnrollmentId(777L);
        pending.setStatus("pending");
        when(paymentRepository.findByClassEnrollmentId(777L)).thenReturn(Optional.of(pending));

        enrollmentService.cancelCourseEnrollment(principal, 50L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("failed", pending.getStatus());
        verify(paymentRepository).save(pending);
    }

    /** Kiểm thử: hủy vẫn giữ khoản thanh toán khóa đã thanh toán để đi theo luồng hoàn tiền. */
    @Test
    void testCancelKeepsASettledCoursePaymentForTheRefundFlow() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        Member member = new Member();
        member.setUserId(100L);
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(777L);
        enrollment.setGymClass(gymClass);
        enrollment.setMember(member);
        enrollment.setStatus("booked");
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.of(enrollment));
        when(enrollments.save(any(ClassEnrollment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Payment paid = new Payment();
        paid.setId(888L);
        paid.setClassEnrollmentId(777L);
        paid.setStatus("success");
        when(paymentRepository.findByClassEnrollmentId(777L)).thenReturn(Optional.of(paid));

        enrollmentService.cancelCourseEnrollment(principal, 50L);

        assertEquals("cancelled", enrollment.getStatus());
        assertEquals("success", paid.getStatus());
        verify(paymentRepository, never()).save(any(Payment.class));
    }

    /** Hàm trợ giúp dựng fixture hội viên hết quota và lớp có học phí cho các bài test thanh toán khóa học. */
    private GymClass stubQuotaExceededCheckoutFixture(BigDecimal coursePrice) {
        Member member = new Member();
        member.setUserId(100L);
        User user = new User();
        user.setId(100L);
        member.setUser(user);

        when(members.findById(100L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(100L)).thenReturn(Optional.of(member));

        MembershipPackage silver = new MembershipPackage();
        silver.setClassCreditLimit(2);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(silver);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 11, 1));
        sub.setEndDate(LocalDate.of(2026, 12, 31));

        when(subscriptions.findByMemberUserIdAndStatus(100L, "active")).thenReturn(List.of(sub));
        when(subscriptions.hasActiveMembership(eq(100L), any(LocalDate.class))).thenReturn(true);
        when(subscriptions.hasActiveMembershipCoveringSession(eq(100L), any(LocalDate.class), any(LocalDate.class))).thenReturn(true);
        when(enrollments.countByMemberUserIdAndStatusAndGymClassStartDateBetween(eq(100L), eq("booked"), any(), any()))
                .thenReturn(2L);

        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Boxing Conditioning");
        gymClass.setStatus("active");
        gymClass.setStartDate(LocalDate.of(2026, 11, 20));
        gymClass.setEndDate(LocalDate.of(2026, 12, 20));
        gymClass.setCapacity(20);
        gymClass.setPrice(coursePrice);

        when(gymClasses.findByIdForUpdate(50L)).thenReturn(Optional.of(gymClass));
        when(enrollments.findByGymClassIdAndMemberUserIdAndStatus(50L, 100L, "booked")).thenReturn(Optional.empty());
        when(enrollments.countByGymClassIdAndStatus(50L, "booked")).thenReturn(3L);

        ClassEnrollment savedEnrollment = new ClassEnrollment();
        savedEnrollment.setId(777L);
        savedEnrollment.setGymClass(gymClass);
        savedEnrollment.setMember(member);
        savedEnrollment.setStatus("booked");
        when(enrollments.saveAndFlush(any(ClassEnrollment.class))).thenReturn(savedEnrollment);
        return gymClass;
    }

    /** Kiểm thử P0-02: thanh toán khóa học bằng ví tất toán ngay qua VnpayPaymentService.payWithWallet, trả success và expiresAt=null. */
    @Test
    void testCheckoutViaOnlineWalletSettlesImmediatelyThroughVnpayPaymentService() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        stubQuotaExceededCheckoutFixture(new BigDecimal("500000.00"));

        WalletService walletService = mock(WalletService.class);
        when(walletService.getMyWallet(100L)).thenReturn(new WalletDto(new BigDecimal("800000.00"), null, List.of()));
        enrollmentService.setWallets(walletService);

        VnpayPaymentService vnpayPaymentService = mock(VnpayPaymentService.class);
        enrollmentService.setVnpayPaymentService(vnpayPaymentService);

        Payment savedPayment = new Payment();
        savedPayment.setId(888L);
        savedPayment.setClassEnrollmentId(777L);
        savedPayment.setAmount(new BigDecimal("500000.00"));
        savedPayment.setMethod("online_wallet");
        savedPayment.setStatus("pending");
        when(paymentRepository.save(any(Payment.class))).thenReturn(savedPayment);

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "online_wallet");

        assertEquals(777L, result.enrollmentId());
        assertEquals(888L, result.paymentId());
        assertEquals("online_wallet", result.paymentMethod());
        assertEquals("success", result.paymentStatus());
        assertNull(result.expiresAt());

        InOrder order = inOrder(enrollments, paymentRepository, vnpayPaymentService);
        order.verify(enrollments).saveAndFlush(any(ClassEnrollment.class));
        order.verify(paymentRepository).save(any(Payment.class));
        order.verify(paymentRepository).flush();
        order.verify(vnpayPaymentService).payWithWallet(eq(principal), eq(new VnpayDtos.CheckoutRequest(null, null, 888L)));
    }

    /** Kiểm thử P0-02: khi vnpayPaymentService vắng mặt (constructor legacy), online_wallet vẫn trừ ví và chốt payment success. */
    @Test
    void testCheckoutViaOnlineWalletFallsBackToDirectWalletDebitWhenVnpayServiceAbsent() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        stubQuotaExceededCheckoutFixture(new BigDecimal("500000.00"));

        WalletService walletService = mock(WalletService.class);
        when(walletService.getMyWallet(100L)).thenReturn(new WalletDto(new BigDecimal("600000.00"), null, List.of()));
        enrollmentService.setWallets(walletService);

        Payment savedPayment = new Payment();
        savedPayment.setId(889L);
        savedPayment.setClassEnrollmentId(777L);
        savedPayment.setAmount(new BigDecimal("500000.00"));
        savedPayment.setMethod("online_wallet");
        savedPayment.setStatus("pending");
        when(paymentRepository.save(any(Payment.class))).thenReturn(savedPayment);

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "online_wallet");

        assertEquals("success", result.paymentStatus());
        assertNull(result.expiresAt());
        assertEquals("success", savedPayment.getStatus());
        assertNotNull(savedPayment.getPaidAt());
        verify(walletService).debitForPayment(
                eq(100L),
                eq(new BigDecimal("500000.00")),
                eq("WALLET_PAY_889"),
                contains("889"),
                eq("/member/classes")
        );
    }

    /** Kiểm thử P0-02: online_wallet không bao giờ âm thầm tạo khoản pending nếu cả vnpayPaymentService lẫn wallets đều thiếu. */
    @Test
    void testCheckoutViaOnlineWalletRejectsWhenWalletUnavailable() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        stubQuotaExceededCheckoutFixture(new BigDecimal("500000.00"));

        Payment savedPayment = new Payment();
        savedPayment.setId(890L);
        when(paymentRepository.save(any(Payment.class))).thenReturn(savedPayment);

        ConflictException ex = assertThrows(ConflictException.class,
                () -> enrollmentService.checkoutCourse(principal, 50L, "online_wallet"));
        assertEquals("WALLET_UNAVAILABLE", ex.getErrorCode());
    }

    /** Kiểm thử P2-BE-18: khóa học giá 0đ (dù hết quota) trả paymentStatus=success và expiresAt=null. */
    @Test
    void testCheckoutZeroPriceCourseReturnsSuccessWithNullExpiry() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(100L, "member@test.com", "MEMBER");
        stubQuotaExceededCheckoutFixture(BigDecimal.ZERO);

        CourseCheckoutDto result = enrollmentService.checkoutCourse(principal, 50L, "cash");

        assertEquals(777L, result.enrollmentId());
        assertNull(result.paymentId());
        assertEquals("success", result.paymentStatus());
        assertNull(result.expiresAt());
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử P0-03: listUnpaidCourseEnrollments ánh xạ chính xác các khoản học phí chờ thu tại quầy. */
    @Test
    void testListUnpaidCourseEnrollmentsMapsRepositoryRows() {
        ClassEnrollmentRepository.UnpaidCourseEnrollmentRow row = mock(ClassEnrollmentRepository.UnpaidCourseEnrollmentRow.class);
        LocalDateTime createdAt = LocalDateTime.of(2026, 11, 9, 10, 30);
        when(row.getEnrollmentId()).thenReturn(777L);
        when(row.getPaymentId()).thenReturn(888L);
        when(row.getClassId()).thenReturn(50L);
        when(row.getClassName()).thenReturn("Yoga Flow");
        when(row.getDisciplineName()).thenReturn("Yoga");
        when(row.getStartDate()).thenReturn(LocalDate.of(2026, 11, 20));
        when(row.getEndDate()).thenReturn(LocalDate.of(2026, 12, 20));
        when(row.getMemberId()).thenReturn(100L);
        when(row.getMemberName()).thenReturn("Nguyễn Văn A");
        when(row.getMemberPhone()).thenReturn("0901234567");
        when(row.getMembershipCode()).thenReturn("SOL-00100");
        when(row.getAmount()).thenReturn(new BigDecimal("450000.00"));
        when(row.getMethod()).thenReturn("cash");
        when(row.getCreatedAt()).thenReturn(createdAt);
        when(enrollments.findUnpaidCourseEnrollments()).thenReturn(List.of(row));

        List<UnpaidCourseEnrollmentDto> list = enrollmentService.listUnpaidCourseEnrollments();

        assertEquals(1, list.size());
        UnpaidCourseEnrollmentDto dto = list.get(0);
        assertEquals(777L, dto.enrollmentId());
        assertEquals(888L, dto.paymentId());
        assertEquals(50L, dto.classId());
        assertEquals("Yoga Flow", dto.className());
        assertEquals("Yoga", dto.disciplineName());
        assertEquals(LocalDate.of(2026, 11, 20), dto.startDate());
        assertEquals(LocalDate.of(2026, 12, 20), dto.endDate());
        assertEquals(100L, dto.memberId());
        assertEquals("Nguyễn Văn A", dto.memberName());
        assertEquals("0901234567", dto.memberPhone());
        assertEquals("SOL-00100", dto.membershipCode());
        assertEquals(new BigDecimal("450000.00"), dto.amount());
        assertEquals("cash", dto.method());
        assertEquals(createdAt, dto.createdAt());
    }

    /** Kiểm thử P0-03: lễ tân xác nhận thu học phí khóa học cập nhật phương thức, thu ngân, tất toán qua PaymentService và gửi thông báo. */
    @Test
    void testConfirmCourseEnrollmentPaymentByReceptionistSettlesViaPaymentServiceAndNotifies() {
        NotificationService notifications = mock(NotificationService.class);
        enrollmentService = new EnrollmentService(
                enrollments, null, gymClasses, subscriptions, members, notifications, null, clock);
        enrollmentService.setPaymentRepository(paymentRepository);

        UserRepository userRepository = mock(UserRepository.class);
        PaymentService paymentService = mock(PaymentService.class);
        VnpayPaymentGuard vnpayGuard = mock(VnpayPaymentGuard.class);
        enrollmentService.setUserRepository(userRepository);
        enrollmentService.setPaymentService(paymentService);
        enrollmentService.setVnpayGuard(vnpayGuard);

        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(7L, "desk@sol.vn", "RECEPTIONIST");
        User cashier = new User();
        cashier.setId(7L);
        cashier.setFullName("Trần Lễ Tân");
        when(userRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(cashier));

        Member member = new Member();
        member.setUserId(100L);
        GymClass gymClass = new GymClass();
        gymClass.setId(50L);
        gymClass.setName("Boxing Sáng");

        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(777L);
        enrollment.setStatus("booked");
        enrollment.setMember(member);
        enrollment.setGymClass(gymClass);
        when(enrollments.findByIdForUpdate(777L)).thenReturn(Optional.of(enrollment));

        Payment pending = new Payment();
        pending.setId(888L);
        pending.setMember(member);
        pending.setClassEnrollmentId(777L);
        pending.setAmount(new BigDecimal("500000.00"));
        pending.setMethod("cash");
        pending.setStatus("pending");
        when(paymentRepository.findByClassEnrollmentId(777L)).thenReturn(Optional.of(pending));

        PaymentDto settledDto = new PaymentDto();
        settledDto.setId(888L);
        settledDto.setStatus("success");
        settledDto.setMethod("bank_transfer");
        settledDto.setInvoiceNumber("INV-2026-0001");
        when(paymentService.updatePaymentStatusByStaff(888L, "success")).thenReturn(settledDto);

        PaymentDto result = enrollmentService.confirmCourseEnrollmentPayment(receptionist, 777L, "bank_transfer");

        assertEquals("success", result.getStatus());
        assertEquals("bank_transfer", pending.getMethod());
        assertEquals(cashier, pending.getReceivedBy());
        assertEquals("INV-2026-0001", result.getInvoiceNumber());
        verify(vnpayGuard).enrollment(777L);
        verify(paymentRepository).save(pending);
        verify(paymentRepository).flush();
        verify(paymentService).updatePaymentStatusByStaff(888L, "success");
        verify(notifications).send(eq(100L), anyString(), anyString(), eq("payment"), eq("payment"), eq(888L), eq("/member/classes"));
    }

    /** Kiểm thử P0-03: chặn vai trò không phải quầy, phương thức không hợp lệ và lượt ghi danh không còn khoản chờ. */
    @Test
    void testConfirmCourseEnrollmentPaymentValidatesRoleMethodAndPendingState() {
        AuthenticatedPrincipal memberActor = new AuthenticatedPrincipal(100L, "m@test.com", "MEMBER");
        assertThrows(ForbiddenException.class,
                () -> enrollmentService.confirmCourseEnrollmentPayment(memberActor, 777L, "cash"));

        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(7L, "desk@sol.vn", "RECEPTIONIST");
        ClassEnrollment cancelled = new ClassEnrollment();
        cancelled.setId(778L);
        cancelled.setStatus("cancelled");
        when(enrollments.findByIdForUpdate(778L)).thenReturn(Optional.of(cancelled));
        ConflictException notBooked = assertThrows(ConflictException.class,
                () -> enrollmentService.confirmCourseEnrollmentPayment(receptionist, 778L, "cash"));
        assertEquals("SCHEDULING_COURSE_PAYMENT_NOT_PENDING", notBooked.getErrorCode());

        ClassEnrollment booked = new ClassEnrollment();
        booked.setId(779L);
        booked.setStatus("booked");
        when(enrollments.findByIdForUpdate(779L)).thenReturn(Optional.of(booked));
        Payment pending = new Payment();
        pending.setId(889L);
        pending.setClassEnrollmentId(779L);
        pending.setStatus("pending");
        pending.setMethod("cash");
        when(paymentRepository.findByClassEnrollmentId(779L)).thenReturn(Optional.of(pending));

        BadRequestException badMethod = assertThrows(BadRequestException.class,
                () -> enrollmentService.confirmCourseEnrollmentPayment(receptionist, 779L, "online_wallet"));
        assertEquals("INVALID_PAYMENT_METHOD", badMethod.getErrorCode());

        pending.setStatus("success");
        ConflictException alreadyPaid = assertThrows(ConflictException.class,
                () -> enrollmentService.confirmCourseEnrollmentPayment(receptionist, 779L, "cash"));
        assertEquals("SCHEDULING_COURSE_PAYMENT_NOT_PENDING", alreadyPaid.getErrorCode());
    }
}
