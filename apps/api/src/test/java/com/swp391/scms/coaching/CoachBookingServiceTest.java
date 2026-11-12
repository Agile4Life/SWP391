package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachAvailableSlotDto;
import com.swp391.scms.coaching.dto.CoachBookingCreateDto;
import com.swp391.scms.coaching.dto.CoachBookingDto;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CoachBookingServiceTest {

    @Mock private CoachBookingRepository coachBookingRepository;
    @Mock private CoachRepository coachRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private ClassSessionRepository classSessionRepository;
    @Mock private ClassEnrollmentRepository classEnrollmentRepository;
    @Mock private MembershipSubscriptionRepository subscriptionRepository;
    @Mock private DisciplineRepository disciplineRepository;

    private Clock fixedClock;
    private CoachBookingService service;

    private Member member;
    private Coach coach;
    private AuthenticatedPrincipal principal;

    @BeforeEach
    void setUp() {
        // Fix clock at 2026-10-31 08:00:00
        Instant fixedInstant = LocalDateTime.of(2026, 10, 31, 8, 0, 0)
                .atZone(com.swp391.scms.common.CenterTime.ZONE).toInstant();
        fixedClock = Clock.fixed(fixedInstant, com.swp391.scms.common.CenterTime.ZONE);

        service = new CoachBookingService(
                coachBookingRepository,
                coachRepository,
                memberRepository,
                classSessionRepository,
                classEnrollmentRepository,
                subscriptionRepository,
                disciplineRepository,
                fixedClock,
                null
        );

        User memberUser = new User();
        memberUser.setId(10L);
        memberUser.setFullName("Khoa Hội Viên");

        member = new Member();
        member.setUserId(10L);
        member.setUser(memberUser);

        User coachUser = new User();
        coachUser.setId(20L);
        coachUser.setFullName("Huấn luyện viên Hùng");

        coach = new Coach();
        coach.setUserId(20L);
        coach.setUser(coachUser);
        coach.setSpecialization("Gym & Fitness");
        coach.setEmploymentStatus("active");

        principal = new AuthenticatedPrincipal(10L, "khoa", "MEMBER");
    }

    @Test
    @DisplayName("Đặt lịch 1:1 thành công với hình thức trả phí theo giờ")
    void createBooking_success_hourlyPay() {
        MembershipSubscription active = new MembershipSubscription();
        active.setStartDate(LocalDate.of(2026, 10, 1));
        active.setEndDate(LocalDate.of(2026, 11, 30));
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active));

        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            b.setId(100L);
            return b;
        });

        // Booking at 14:00 (more than 2 hours from 08:00)
        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0),
                LocalTime.of(15, 0),
                "cash",
                "Mục tiêu tăng cơ giảm mỡ"
        );

        CoachBookingDto result = service.createBooking(principal, request);

        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(100L);
        assertThat(result.paymentMethod()).isEqualTo("cash");
        assertThat(result.paymentStatus()).isEqualTo("pending");
        assertThat(result.status()).isEqualTo("confirmed");
    }

    @Test
    @DisplayName("Chặn đặt lịch nếu thời gian bắt đầu cách dưới 2 tiếng")
    void createBooking_throws_whenTooSoon() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));

        // Attempt booking at 09:00 (only 1 hour from 08:00, less than 2 hours!)
        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(9, 0),
                LocalTime.of(10, 0),
                "cash",
                "Đặt gấp"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_TOO_SOON"));
    }

    @Test
    @DisplayName("Chặn đặt lịch nếu Huấn luyện viên đã có lịch dạy lớp trùng giờ")
    void createBooking_throws_whenCoachBusy() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));

        GymClass gymClass = new GymClass();
        gymClass.setName("Yoga Buổi Chiều");

        ClassSession busySession = new ClassSession();
        busySession.setGymClass(gymClass);
        busySession.setStartTime(LocalTime.of(14, 0));
        busySession.setEndTime(LocalTime.of(15, 0));

        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of(busySession));

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0),
                LocalTime.of(15, 0),
                "cash",
                "Tập riêng"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> assertThat(((ConflictException) e).getErrorCode()).isEqualTo("COACH_SCHEDULE_CONFLICT"));
    }

    @Test
    @DisplayName("Thành công trừ lượt PT của gói GOLD khi còn hạn mức")
    void createBooking_success_withPackageQuota() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("GOLD");

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        // Used 1 quota out of 3
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(1L);

        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            b.setId(101L);
            return b;
        });

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(16, 0),
                LocalTime.of(17, 0),
                "package_quota",
                "Tập kèm 1:1"
        );

        CoachBookingDto result = service.createBooking(principal, request);
        assertThat(result.paymentStatus()).isEqualTo("used_quota");
        assertThat(result.status()).isEqualTo("confirmed");
    }

    @Test
    @DisplayName("Thành công trừ lượt PT của Gói Trải Nghiệm 3 Ngày (tối đa 1 lượt)")
    void createBooking_success_withTrialQuota() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("Gói Trải Nghiệm 3 Ngày");
        pkg.setDurationDays(3);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 30));
        sub.setEndDate(LocalDate.of(2026, 11, 2));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        // Used 0 quota out of 1
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(0L);

        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            b.setId(102L);
            return b;
        });

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(16, 0),
                LocalTime.of(17, 0),
                "package_quota",
                "Tập thử HLV 1:1"
        );

        CoachBookingDto result = service.createBooking(principal, request);
        assertThat(result.paymentStatus()).isEqualTo("used_quota");
        assertThat(result.status()).isEqualTo("confirmed");
    }

    @Test
    @DisplayName("Báo lỗi khi Gói Trải Nghiệm 3 Ngày đã dùng hết 1 buổi PT 1:1")
    void createBooking_throws_whenTrialQuotaExceeded() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("Gói Trải Nghiệm 3 Ngày");
        pkg.setDurationDays(3);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 30));
        sub.setEndDate(LocalDate.of(2026, 11, 2));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        // Already used 1 session
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(1L);

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(16, 0),
                LocalTime.of(17, 0),
                "package_quota",
                "Đặt buổi thứ hai"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_TRIAL_QUOTA_EXCEEDED"));
    }

    @Test
    @DisplayName("Báo lỗi khi gói tập không có quyền lợi PT (như SILVER) mà chọn trừ lượt gói")
    void createBooking_throws_whenSilverHasNoPtQuota() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("SILVER");

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                LocalTime.of(16, 0),
                LocalTime.of(17, 0),
                "package_quota",
                "Tập riêng"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_PACKAGE_NO_QUOTA"));
    }

    @Test
    @DisplayName("Kiểm tra khung giờ khả dụng: đánh dấu slot dưới 2 tiếng là too_soon")
    void getAvailableSlots_marks_tooSoon() {
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());

        List<CoachAvailableSlotDto> slots = service.getAvailableSlots(20L, LocalDate.of(2026, 10, 31), 10L);

        // At 08:00, slots 06:00, 07:00, 08:00, 09:00 are too soon or past
        CoachAvailableSlotDto slot9 = slots.stream().filter(s -> s.startTime().equals(LocalTime.of(9, 0))).findFirst().orElseThrow();
        assertThat(slot9.available()).isFalse();
        assertThat(slot9.reason()).isEqualTo("too_soon");

        // Slot 11:00 (more than 2 hours) should be available
        CoachAvailableSlotDto slot11 = slots.stream().filter(s -> s.startTime().equals(LocalTime.of(11, 0))).findFirst().orElseThrow();
        assertThat(slot11.available()).isTrue();
    }
    @Test
    void unrelatedCoachCannotCancelAnotherCoachBooking() {
        CoachBooking booking = new CoachBooking();
        booking.setId(77L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setStatus("confirmed");
        when(coachBookingRepository.findByIdForUpdate(77L)).thenReturn(Optional.of(booking));
        assertThatThrownBy(() -> service.cancelBooking(new AuthenticatedPrincipal(99L, "other", "COACH"), 77L, null))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);
        assertThat(booking.getStatus()).isEqualTo("confirmed");
    }

    @Test
    void memberCannotCancelASessionThatStartedOrWasCompleted() {
        CoachBooking started = new CoachBooking();
        started.setId(78L); started.setMember(member); started.setCoach(coach); started.setStatus("confirmed");
        started.setBookingDate(java.time.LocalDate.now(fixedClock));
        started.setStartTime(java.time.LocalTime.now(fixedClock).minusMinutes(30));
        when(coachBookingRepository.findByIdForUpdate(78L)).thenReturn(Optional.of(started));
        AuthenticatedPrincipal owner = new AuthenticatedPrincipal(member.getUserId(), "member", "MEMBER");
        assertThatThrownBy(() -> service.cancelBooking(owner, 78L, null))
                .isInstanceOf(com.swp391.scms.common.exception.BadRequestException.class);
        assertThat(started.getStatus()).isEqualTo("confirmed");

        CoachBooking completed = new CoachBooking();
        completed.setId(79L); completed.setMember(member); completed.setCoach(coach); completed.setStatus("completed");
        completed.setBookingDate(java.time.LocalDate.now(fixedClock).plusDays(1));
        completed.setStartTime(java.time.LocalTime.of(9, 0));
        when(coachBookingRepository.findByIdForUpdate(79L)).thenReturn(Optional.of(completed));
        assertThatThrownBy(() -> service.cancelBooking(owner, 79L, null))
                .isInstanceOf(com.swp391.scms.common.exception.BadRequestException.class);
        assertThat(completed.getStatus()).isEqualTo("completed");
    }

    @Test
    void paidBookingRequiresActiveMembership() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0), LocalTime.of(15, 0), "cash", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("MEMBERSHIP_INACTIVE_OR_EXPIRED"));
        verify(coachBookingRepository, never()).save(any());
    }
    @Test
    void rejectsMultiHourBookingChargedAsOneSession() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0), LocalTime.of(18, 0), "package_quota", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("INVALID_COACH_BOOKING_SLOT"));
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    void availabilityIncludesMembersGroupClass() {
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        ClassSession session = new ClassSession();
        session.setStartTime(LocalTime.of(11, 0)); session.setEndTime(LocalTime.NOON);
        when(classSessionRepository.findActiveByMemberAndDate(10L, LocalDate.of(2026, 10, 31))).thenReturn(List.of(session));
        var slot = service.getAvailableSlots(20L, LocalDate.of(2026, 10, 31), 10L).stream()
                .filter(item -> item.startTime().equals(LocalTime.of(11, 0))).findFirst().orElseThrow();
        assertThat(slot.available()).isFalse();
        assertThat(slot.reason()).isEqualTo("member_busy");
    }
    @Test
    void rejectsUnknownPaymentMethod() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0), LocalTime.of(15, 0), "free_lunch", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("INVALID_PAYMENT_METHOD"));
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    void rejectsHourlyBookingWhenUnpaidLimitReached() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        MembershipSubscription sub = new MembershipSubscription();
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 1));
        sub.setEndDate(LocalDate.of(2026, 12, 31));
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        when(coachBookingRepository.countUnpaid(10L)).thenReturn(2L);
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                LocalTime.of(14, 0), LocalTime.of(15, 0), "cash", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    void deskConfirmsHourlyPaymentAndRecordsRevenue() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var notifications = org.mockito.Mockito.mock(com.swp391.scms.notifications.NotificationService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "paymentRepository", payments);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "notificationService", notifications);
        CoachBooking booking = new CoachBooking();
        booking.setId(90L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setBookingDate(LocalDate.of(2026, 10, 30));
        booking.setStartTime(LocalTime.of(14, 0));
        booking.setEndTime(LocalTime.of(15, 0));
        booking.setHourlyRate(new java.math.BigDecimal("200000.00"));
        booking.setPaymentMethod("cash");
        booking.setPaymentStatus("pending");
        booking.setStatus("completed");
        when(coachBookingRepository.findByIdForUpdate(90L)).thenReturn(Optional.of(booking));
        var desk = new AuthenticatedPrincipal(30L, "desk", "RECEPTIONIST");

        assertThatThrownBy(() -> service.confirmHourlyPayment(principal, 90L, null))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);

        var result = service.confirmHourlyPayment(desk, 90L, "cash");
        assertThat(result.paymentStatus()).isEqualTo("paid");
        assertThat(booking.getPaymentMethod()).isEqualTo("cash");
        var saved = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.finance.entity.Payment.class);
        verify(payments).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo("success");
        assertThat(saved.getValue().getAmount()).isEqualByComparingTo("200000.00");
        verify(notifications).send(
                eq(10L),
                eq("notifications.coaching.booking.payment_confirmed.title"),
                eq("notifications.coaching.booking.payment_confirmed.body"),
                eq("payment"),
                eq("payment"),
                eq(90L),
                eq("/member/classes?tab=pt")
        );

        assertThatThrownBy(() -> service.confirmHourlyPayment(desk, 90L, "cash"))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
    }

    @Test
    @DisplayName("Đặt lịch 1:1 trả phí tạo khoản chờ thanh toán và gửi thông báo thanh toán")
    void createHourlyBookingCreatesPendingPaymentAndSendsPaymentNotification() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var notifications = org.mockito.Mockito.mock(com.swp391.scms.notifications.NotificationService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "paymentRepository", payments);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "notificationService", notifications);

        MembershipSubscription active = new MembershipSubscription();
        active.setStartDate(LocalDate.of(2026, 10, 1));
        active.setEndDate(LocalDate.of(2026, 11, 30));
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active));
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            b.setId(150L);
            return b;
        });
        when(payments.save(any(com.swp391.scms.finance.entity.Payment.class))).thenAnswer(inv -> {
            com.swp391.scms.finance.entity.Payment p = inv.getArgument(0);
            p.setId(501L);
            return p;
        });

        CoachBookingDto result = service.createBooking(principal, new CoachBookingCreateDto(
                20L, null, LocalDate.of(2026, 10, 31), LocalTime.of(14, 0), LocalTime.of(15, 0), "cash", "Tập 1:1"
        ));

        assertThat(result.paymentStatus()).isEqualTo("pending");
        var paymentCaptor = org.mockito.ArgumentCaptor.forClass(com.swp391.scms.finance.entity.Payment.class);
        verify(payments).save(paymentCaptor.capture());
        assertThat(paymentCaptor.getValue().getStatus()).isEqualTo("pending");
        assertThat(paymentCaptor.getValue().getCoachBookingId()).isEqualTo(150L);
        assertThat(paymentCaptor.getValue().getAmount()).isEqualByComparingTo("200000.00");

        verify(notifications).send(
                eq(10L),
                eq("notifications.coaching.booking.payment_pending.title"),
                eq("notifications.coaching.booking.payment_pending.body"),
                eq("payment"),
                eq("payment"),
                eq(501L),
                eq("/member/classes?tab=pt")
        );
    }

    @Test
    @DisplayName("Hủy buổi tập 1:1 đã thanh toán trước giờ bắt đầu hoàn tiền về Ví hội viên")
    void cancelPaidBookingBeforeStartRefundsToWallet() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var wallets = org.mockito.Mockito.mock(com.swp391.scms.wallet.WalletService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "paymentRepository", payments);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "walletService", wallets);

        CoachBooking booking = new CoachBooking();
        booking.setId(160L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setBookingDate(LocalDate.of(2026, 11, 1));
        booking.setStartTime(LocalTime.of(14, 0));
        booking.setEndTime(LocalTime.of(15, 0));
        booking.setHourlyRate(new BigDecimal("200000.00"));
        booking.setPaymentMethod("online_wallet");
        booking.setPaymentStatus("paid");
        booking.setStatus("confirmed");
        when(coachBookingRepository.findByIdForUpdate(160L)).thenReturn(Optional.of(booking));

        com.swp391.scms.finance.entity.Payment paidPayment = new com.swp391.scms.finance.entity.Payment();
        paidPayment.setId(601L);
        paidPayment.setMember(member);
        paidPayment.setCoachBookingId(160L);
        paidPayment.setAmount(new BigDecimal("200000.00"));
        paidPayment.setStatus("success");
        when(payments.findAllByCoachBookingId(160L)).thenReturn(List.of(paidPayment));

        CoachBookingDto cancelled = service.cancelBooking(principal, 160L, "Bận việc đột xuất");

        assertThat(cancelled.status()).isEqualTo("cancelled");
        assertThat(paidPayment.getStatus()).isEqualTo("refunded");
        assertThat(paidPayment.getRefundedAmount()).isEqualByComparingTo("200000.00");
        verify(wallets).creditCoachBookingRefund(10L, new BigDecimal("200000.00"), "COACH_REFUND_160", "Bận việc đột xuất");
    }

    @Test
    void coachOnApprovedLeaveCannotBeBookedAndShowsNoFreeSlots() {
        var leaves = org.mockito.Mockito.mock(com.swp391.scms.operations.repository.StaffInternalRequestRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "staffRequestRepository", leaves);
        LocalDate day = LocalDate.of(2026, 11, 2);
        when(leaves.existsApprovedLeaveOn(20L, day)).thenReturn(true);
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, day, LocalTime.of(14, 0), LocalTime.of(15, 0), "package_quota", null);

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class)
                .satisfies(e -> assertThat(((com.swp391.scms.common.exception.ConflictException) e).getErrorCode())
                        .isEqualTo("COACH_ON_LEAVE"));
        assertThat(service.getAvailableSlots(20L, day, 10L))
                .allSatisfy(slot -> {
                    assertThat(slot.available()).isFalse();
                    assertThat(slot.reason()).isEqualTo("coach_on_leave");
                });
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("Đặt 1:1 định kỳ: tính năng đã bị vô hiệu hóa và ném ngoại lệ COACH_RECURRING_DISABLED")
    void createRecurringBooking_throwsDisabledException() {
        assertThatThrownBy(() -> service.createRecurringBooking(principal,
                new com.swp391.scms.coaching.dto.CoachRecurringBookingDto(20L, null, LocalDate.of(2026, 11, 2),
                        LocalTime.of(14, 0), LocalTime.of(15, 0), "week", List.of(1, 3, 5), "cash", null)))
                .isInstanceOf(com.swp391.scms.common.exception.AppException.class)
                .satisfies(e -> assertThat(((com.swp391.scms.common.exception.AppException) e).getErrorCode())
                        .isEqualTo("COACH_RECURRING_DISABLED"));
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    @DisplayName("getMemberQuotaStatus: Trả về đúng 1 lượt cho Gói Trải Nghiệm 3 Ngày (dù tên cũ là GOLD)")
    void getMemberQuotaStatus_returnsTrialQuotaCorrectly() {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("GOLD");
        pkg.setDurationDays(30);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 30));
        sub.setEndDate(LocalDate.of(2026, 11, 2)); // 3 days

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(0L);

        var quota = service.getMemberQuotaStatus(10L);
        assertThat(quota.packageName()).isEqualTo("Gói Trải Nghiệm 3 Ngày");
        assertThat(quota.monthlyQuota()).isEqualTo(1);
        assertThat(quota.remainingQuota()).isEqualTo(1);
    }

    @Test
    @DisplayName("getMemberQuotaStatus: Trả về đúng 3 lượt cho Gói GOLD 30 ngày chuẩn")
    void getMemberQuotaStatus_returnsGoldQuotaCorrectly() {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("GOLD");
        pkg.setDurationDays(30);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setMembershipPackage(pkg);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.of(2026, 10, 1));
        sub.setEndDate(LocalDate.of(2026, 11, 30)); // 60 days

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(1L);

        var quota = service.getMemberQuotaStatus(10L);
        assertThat(quota.packageName()).isEqualTo("GOLD");
        assertThat(quota.monthlyQuota()).isEqualTo(3);
        assertThat(quota.usedThisMonth()).isEqualTo(1);
        assertThat(quota.remainingQuota()).isEqualTo(2);
    }
    @Test
    void coachRestsAfterThreeConsecutivePtSlotsAndResumesAfterAnHour() {
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(coachBookingRepository.findActiveByCoachAndDate(20L, LocalDate.of(2026, 11, 2)))
                .thenReturn(ptSlots(10, 11, 12));
        var slots = service.getAvailableSlots(20L, LocalDate.of(2026, 11, 2), 10L);
        var rest = slots.stream().filter(s -> s.startTime().getHour() == 13).findFirst().orElseThrow();
        assertThat(rest.available()).isFalse();
        assertThat(rest.reason()).isEqualTo("coach_rest");
        assertThat(slots.stream().filter(s -> s.startTime().getHour() == 14).findFirst().orElseThrow().available()).isTrue();
    }

    @Test
    void rejectsFourthConsecutivePtSlotIncludingInsertionInTheMiddle() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        for (int requested : List.of(10, 11, 12, 13)) {
            when(coachBookingRepository.findActiveByCoachAndDate(20L, LocalDate.of(2026, 11, 2)))
                    .thenReturn(ptSlots(java.util.stream.IntStream.rangeClosed(10, 13).filter(h -> h != requested).toArray()));
            var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 11, 2),
                    LocalTime.of(requested, 0), LocalTime.of(requested + 1, 0), "cash", null);
            assertThatThrownBy(() -> service.createBooking(principal, request))
                    .isInstanceOf(ConflictException.class)
                    .satisfies(e -> assertThat(((ConflictException) e).getErrorCode()).isEqualTo("COACH_REST_REQUIRED"));
        }
        verify(coachBookingRepository, never()).save(any());
    }

    private List<CoachBooking> ptSlots(int... hours) {
        return java.util.Arrays.stream(hours).mapToObj(hour -> {
            CoachBooking booking = new CoachBooking();
            booking.setStartTime(LocalTime.of(hour, 0));
            booking.setEndTime(LocalTime.of(hour + 1, 0));
            return booking;
        }).toList();
    }


    private com.swp391.scms.coaching.entity.CoachBooking ptSession(long id, LocalDate date, LocalTime start, LocalTime end,
                                                                    LocalDateTime attendedAt) {
        com.swp391.scms.coaching.entity.CoachBooking b = new com.swp391.scms.coaching.entity.CoachBooking();
        org.springframework.test.util.ReflectionTestUtils.setField(b, "id", id);
        b.setMember(member);
        b.setCoach(coach);
        b.setBookingDate(date);
        b.setStartTime(start);
        b.setEndTime(end);
        b.setStatus("confirmed");
        b.setAttendedAt(attendedAt);
        return b;
    }

    @Test
    void attendanceScreenSplitsSessionsIntoAttendedMissedAndUpcomingAndScopesCoachesToTheirOwn() {
        // The clock is 2026-10-31 08:00.
        var attended = ptSession(1, LocalDate.of(2026, 10, 30), LocalTime.of(9, 0), LocalTime.of(10, 0), LocalDateTime.of(2026, 10, 30, 8, 50));
        var missed = ptSession(2, LocalDate.of(2026, 10, 30), LocalTime.of(15, 0), LocalTime.of(16, 0), null);
        var upcoming = ptSession(3, LocalDate.of(2026, 10, 31), LocalTime.of(17, 0), LocalTime.of(18, 0), null);
        var rows = List.of(upcoming, missed, attended);
        when(coachBookingRepository.findForAttendance(any(), any())).thenReturn(rows);
        when(coachBookingRepository.findForAttendanceByCoach(eq(20L), any(), any())).thenReturn(rows);
        var desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
        var coachPrincipal = new AuthenticatedPrincipal(20L, "hung", "COACH");

        assertThat(service.getAttendance(desk, null, null, "ALL")).extracting(d -> d.id()).containsExactly(3L, 2L, 1L);
        assertThat(service.getAttendance(desk, null, null, "MISSED")).extracting(d -> d.id()).containsExactly(2L);
        assertThat(service.getAttendance(desk, null, null, "attended")).extracting(d -> d.id()).containsExactly(1L);
        assertThat(service.getAttendance(desk, null, null, "UPCOMING")).extracting(d -> d.id()).containsExactly(3L);
        assertThat(service.getAttendance(coachPrincipal, null, null, null)).hasSize(3);
        verify(coachBookingRepository).findForAttendanceByCoach(eq(20L), any(), any());
        // A coach never reads the desk-wide query.
        verify(coachBookingRepository, org.mockito.Mockito.times(4)).findForAttendance(any(), any());
    }

    @Test
    void attendanceScreenRejectsMembersAndRangesLongerThanTwoMonths() {
        assertThatThrownBy(() -> service.getAttendance(principal, null, null, "ALL"))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);
        var desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
        assertThatThrownBy(() -> service.getAttendance(desk, LocalDate.of(2026, 7, 1), LocalDate.of(2026, 10, 31), "ALL"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.getAttendance(desk, LocalDate.of(2026, 10, 31), LocalDate.of(2026, 10, 1), "ALL"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void aCoachDeskOrManagerCanMarkAStartedSessionAttendedButOnlyTheOwnCoach() {
        // The clock is 2026-10-31 08:00; this session started at 07:00.
        var started = ptSession(7, LocalDate.of(2026, 10, 31), LocalTime.of(7, 0), LocalTime.of(8, 0), null);
        when(coachBookingRepository.findById(7L)).thenReturn(Optional.of(started));
        var otherCoach = new AuthenticatedPrincipal(99L, "other", "COACH");
        assertThatThrownBy(() -> service.markAttended(otherCoach, 7L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);
        assertThatThrownBy(() -> service.markAttended(principal, 7L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);

        var dto = service.markAttended(new AuthenticatedPrincipal(20L, "hung", "COACH"), 7L);

        assertThat(dto.attendedAt()).isEqualTo(LocalDateTime.of(2026, 10, 31, 8, 0));
        verify(coachBookingRepository).save(started);
        // A second mark by the desk keeps the first time and saves nothing more.
        var again = service.markAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 7L);
        assertThat(again.attendedAt()).isEqualTo(LocalDateTime.of(2026, 10, 31, 8, 0));
        verify(coachBookingRepository, times(1)).save(started);
    }

    @Test
    void aFutureOrCancelledSessionCannotBeMarkedAttended() {
        var future = ptSession(8, LocalDate.of(2026, 10, 31), LocalTime.of(17, 0), LocalTime.of(18, 0), null);
        var cancelled = ptSession(9, LocalDate.of(2026, 10, 30), LocalTime.of(9, 0), LocalTime.of(10, 0), null);
        cancelled.setStatus("cancelled");
        when(coachBookingRepository.findById(8L)).thenReturn(Optional.of(future));
        when(coachBookingRepository.findById(9L)).thenReturn(Optional.of(cancelled));
        var desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

        assertThatThrownBy(() -> service.markAttended(desk, 8L)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.markAttended(desk, 9L)).isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
        verify(coachBookingRepository, never()).save(any());
    }

    @Test
    void unmarkingRemovesTheArrivalAndLocksTheSessionAgainstTheScanAndTheSweep() {
        var attended = ptSession(11, LocalDate.of(2026, 10, 30), LocalTime.of(9, 0), LocalTime.of(10, 0), LocalDateTime.of(2026, 10, 30, 8, 55));
        when(coachBookingRepository.findById(11L)).thenReturn(Optional.of(attended));
        var otherCoach = new AuthenticatedPrincipal(99L, "other", "COACH");
        assertThatThrownBy(() -> service.unmarkAttended(otherCoach, 11L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);
        assertThatThrownBy(() -> service.unmarkAttended(principal, 11L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);

        var dto = service.unmarkAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 11L);

        assertThat(dto.attendedAt()).isNull();
        assertThat(attended.isAttendanceLocked()).isTrue();
        verify(coachBookingRepository).save(attended);
        // Unmarking again changes nothing; marking by hand unlocks it.
        service.unmarkAttended(new AuthenticatedPrincipal(20L, "hung", "COACH"), 11L);
        verify(coachBookingRepository, times(1)).save(attended);
        service.markAttended(new AuthenticatedPrincipal(20L, "hung", "COACH"), 11L);
        assertThat(attended.getAttendedAt()).isNotNull();
        assertThat(attended.isAttendanceLocked()).isFalse();
    }

    @Test
    void aCancelledSessionCannotBeUnmarked() {
        var cancelled = ptSession(12, LocalDate.of(2026, 10, 30), LocalTime.of(9, 0), LocalTime.of(10, 0), null);
        cancelled.setStatus("cancelled");
        when(coachBookingRepository.findById(12L)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> service.unmarkAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 12L))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
    }
}
