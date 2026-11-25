package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachAvailableSlotDto;
import com.swp391.scms.coaching.dto.CoachBookingCreateDto;
import com.swp391.scms.coaching.dto.CoachBookingDto;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.CoachBookingService;
import com.swp391.scms.common.ScheduleSlot;
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

/** Bộ kiểm thử cho service CoachBookingService (coach booking service). */
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

    /** Chuẩn bị trước mỗi test: tạo CoachBookingService với repository giả lập. */
    @BeforeEach
    void setUp() {
        // Cố định đồng hồ tại 2026-10-31 08:00:00
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

    /** Kiểm thử: Đặt lịch 1:1 thành công với hình thức trả phí theo giờ */
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

        // Đặt lịch Slot 4 (14:15–16:45, cách 08:00 hơn 2 tiếng)
        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_4.startTime(),
                ScheduleSlot.SLOT_4.endTime(),
                "cash",
                "Mục tiêu tăng cơ giảm mỡ"
        );

        CoachBookingDto result = service.createBooking(principal, request);

        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(100L);
        assertThat(result.paymentMethod()).isEqualTo("cash");
        assertThat(result.paymentStatus()).isEqualTo("pending");
        assertThat(result.status()).isEqualTo("confirmed");
        assertThat(result.hourlyRate()).isEqualByComparingTo("200000.00");
    }

    /** Kiểm thử: Chặn đặt lịch nếu thời gian bắt đầu cách dưới 2 tiếng */
    @Test
    @DisplayName("Chặn đặt lịch nếu thời gian bắt đầu cách dưới 2 tiếng")
    void createBooking_throws_whenTooSoon() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));

        // Thử đặt lịch Slot 2 lúc 09:45 (chỉ cách 08:00 đúng 1 giờ 45 phút, ít hơn 2 tiếng!)
        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_2.startTime(),
                ScheduleSlot.SLOT_2.endTime(),
                "cash",
                "Đặt gấp"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_TOO_SOON"));
    }

    /** Kiểm thử: Chặn đặt lịch nếu Huấn luyện viên đã có lịch dạy lớp trùng giờ */
    @Test
    @DisplayName("Chặn đặt lịch nếu Huấn luyện viên đã có lịch dạy lớp trùng giờ")
    void createBooking_throws_whenCoachBusy() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));

        GymClass gymClass = new GymClass();
        gymClass.setName("Yoga Buổi Chiều");

        ClassSession busySession = new ClassSession();
        busySession.setGymClass(gymClass);
        busySession.setStartTime(ScheduleSlot.SLOT_4.startTime());
        busySession.setEndTime(ScheduleSlot.SLOT_4.endTime());

        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of(busySession));

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_4.startTime(),
                ScheduleSlot.SLOT_4.endTime(),
                "cash",
                "Tập riêng"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> assertThat(((ConflictException) e).getErrorCode()).isEqualTo("COACH_SCHEDULE_CONFLICT"));
    }

    /** Kiểm thử: Thành công trừ lượt PT của gói GOLD khi còn hạn mức */
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
        // Đã dùng 1 trên tổng số 3 lượt
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
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime(),
                "package_quota",
                "Tập kèm 1:1"
        );

        CoachBookingDto result = service.createBooking(principal, request);
        assertThat(result.paymentStatus()).isEqualTo("used_quota");
        assertThat(result.status()).isEqualTo("confirmed");
    }

    /** Kiểm thử: Thành công trừ lượt PT của Gói Trải Nghiệm 3 Ngày (tối đa 1 lượt) */
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
        // Đã dùng 0 trên tổng số 1 lượt
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
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime(),
                "package_quota",
                "Tập thử HLV 1:1"
        );

        CoachBookingDto result = service.createBooking(principal, request);
        assertThat(result.paymentStatus()).isEqualTo("used_quota");
        assertThat(result.status()).isEqualTo("confirmed");
    }

    /** Kiểm thử: Báo lỗi khi Gói Trải Nghiệm 3 Ngày đã dùng hết 1 buổi PT 1:1 */
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
        // Đã dùng 1 buổi
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(1L);

        CoachBookingCreateDto request = new CoachBookingCreateDto(
                20L,
                null,
                LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime(),
                "package_quota",
                "Đặt buổi thứ hai"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_TRIAL_QUOTA_EXCEEDED"));
    }

    /** Kiểm thử: Báo lỗi khi gói tập không có quyền lợi PT (như SILVER) mà chọn trừ lượt gói */
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
                ScheduleSlot.SLOT_5.startTime(),
                ScheduleSlot.SLOT_5.endTime(),
                "package_quota",
                "Tập riêng"
        );

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("COACH_BOOKING_PACKAGE_NO_QUOTA"));
    }

    /** Kiểm thử: Kiểm tra 5 slot cố định và đánh dấu slot dưới 2 tiếng là too_soon */
    @Test
    @DisplayName("Kiểm tra 5 slot cố định và đánh dấu slot dưới 2 tiếng là too_soon")
    void getAvailableSlots_marks_tooSoon() {
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());

        List<CoachAvailableSlotDto> slots = service.getAvailableSlots(20L, LocalDate.of(2026, 10, 31), 10L);

        assertThat(slots).hasSize(5);
        assertThat(slots).extracting(CoachAvailableSlotDto::slotNumber).containsExactly(1, 2, 3, 4, 5);

        // Tại 08:00, Slot 1 (07:00) và Slot 2 (09:45, cách 1h45m < 2h) đều bị đánh dấu too_soon
        CoachAvailableSlotDto slot1 = slots.get(0);
        assertThat(slot1.available()).isFalse();
        assertThat(slot1.reason()).isEqualTo("too_soon");

        CoachAvailableSlotDto slot2 = slots.get(1);
        assertThat(slot2.startTime()).isEqualTo(ScheduleSlot.SLOT_2.startTime());
        assertThat(slot2.endTime()).isEqualTo(ScheduleSlot.SLOT_2.endTime());
        assertThat(slot2.available()).isFalse();
        assertThat(slot2.reason()).isEqualTo("too_soon");

        // Slot 3 (11:30–14:00, cách hơn 2 tiếng) phải còn trống
        CoachAvailableSlotDto slot3 = slots.get(2);
        assertThat(slot3.startTime()).isEqualTo(ScheduleSlot.SLOT_3.startTime());
        assertThat(slot3.endTime()).isEqualTo(ScheduleSlot.SLOT_3.endTime());
        assertThat(slot3.available()).isTrue();
        assertThat(slot3.reason()).isNull();
    }
    /** Kiểm thử: HLV không liên quan không hủy được buổi của HLV khác. */
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

    /** Kiểm thử: hội viên không hủy được buổi đã bắt đầu hoặc đã hoàn thành. */
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

    /** Kiểm thử: đặt có phí cần membership đang hoạt động. */
    @Test
    void paidBookingRequiresActiveMembership() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "cash", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("MEMBERSHIP_INACTIVE_OR_EXPIRED"));
        verify(coachBookingRepository, never()).save(any());
    }

    /** Kiểm thử: từ chối khung giờ ngoài 5 slot cố định (bao gồm đặt kéo dài nhiều giờ hoặc giờ lẻ). */
    @Test
    void rejectsMultiHourBookingChargedAsOneSession() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        for (LocalTime[] invalid : new LocalTime[][]{
                {LocalTime.of(14, 0), LocalTime.of(18, 0)},
                {LocalTime.of(8, 0), LocalTime.of(9, 0)},
                {LocalTime.of(7, 0), LocalTime.of(9, 0)},
                {LocalTime.of(19, 30), LocalTime.of(20, 30)}
        }) {
            var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 11, 1),
                    invalid[0], invalid[1], "package_quota", null);
            assertThatThrownBy(() -> service.createBooking(principal, request))
                    .isInstanceOf(BadRequestException.class)
                    .satisfies(e -> {
                        BadRequestException bre = (BadRequestException) e;
                        assertThat(bre.getErrorCode()).isEqualTo("INVALID_COACH_BOOKING_SLOT");
                        assertThat(bre.getMessageKey()).isEqualTo("error.coach_booking.invalid_slot");
                    });
        }
        verify(coachBookingRepository, never()).save(any());
    }

    /** Kiểm thử: lịch trống tính cả lớp nhóm của hội viên. */
    @Test
    void availabilityIncludesMembersGroupClass() {
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        ClassSession session = new ClassSession();
        session.setStartTime(ScheduleSlot.SLOT_3.startTime());
        session.setEndTime(ScheduleSlot.SLOT_3.endTime());
        when(classSessionRepository.findActiveByMemberAndDate(10L, LocalDate.of(2026, 10, 31))).thenReturn(List.of(session));
        var slot = service.getAvailableSlots(20L, LocalDate.of(2026, 10, 31), 10L).stream()
                .filter(item -> item.startTime().equals(ScheduleSlot.SLOT_3.startTime())).findFirst().orElseThrow();
        assertThat(slot.slotNumber()).isEqualTo(3);
        assertThat(slot.available()).isFalse();
        assertThat(slot.reason()).isEqualTo("member_busy");
    }

    /** Kiểm thử: từ chối phương thức thanh toán không biết. */
    @Test
    void rejectsUnknownPaymentMethod() {
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "free_lunch", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(BadRequestException.class)
                .satisfies(e -> assertThat(((BadRequestException) e).getErrorCode()).isEqualTo("INVALID_PAYMENT_METHOD"));
        verify(coachBookingRepository, never()).save(any());
    }

    /** Kiểm thử: từ chối đặt theo slot khi đã chạm giới hạn chưa thanh toán. */
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
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "cash", null);
        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
        verify(coachBookingRepository, never()).save(any());
    }

    /** Kiểm thử: quầy xác nhận thanh toán theo giờ và ghi nhận doanh thu. */
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

    /** Kiểm thử: Đặt lịch 1:1 trả phí tạo khoản chờ thanh toán và gửi thông báo thanh toán */
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
                20L, null, LocalDate.of(2026, 10, 31),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "cash", "Tập 1:1"
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

    /** Kiểm thử: Hủy buổi tập 1:1 đã thanh toán trước giờ bắt đầu hoàn tiền về Ví hội viên */
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

    /**
     * Kiểm thử: Học viên hủy buổi tập 1:1 dùng lượt gói trước 2 tiếng được hoàn lại lượt; hủy trong vòng 2
     * tiếng bị mất lượt
     */
    @Test
    @DisplayName("Học viên hủy buổi tập 1:1 dùng lượt gói trước 2 tiếng được hoàn lại lượt; hủy trong vòng 2 tiếng bị mất lượt")
    void memberCancelPackageQuotaRespectsTwoHourRefundWindow() {
        CoachBooking earlyBooking = new CoachBooking();
        earlyBooking.setId(161L);
        earlyBooking.setMember(member);
        earlyBooking.setCoach(coach);
        earlyBooking.setStatus("confirmed");
        earlyBooking.setPaymentMethod("package_quota");
        earlyBooking.setBookingDate(LocalDate.now(fixedClock));
        earlyBooking.setStartTime(LocalTime.now(fixedClock).plusHours(2));
        earlyBooking.setEndTime(LocalTime.now(fixedClock).plusHours(3));

        CoachBooking lateBooking = new CoachBooking();
        lateBooking.setId(162L);
        lateBooking.setMember(member);
        lateBooking.setCoach(coach);
        lateBooking.setStatus("confirmed");
        lateBooking.setPaymentMethod("package_quota");
        lateBooking.setBookingDate(LocalDate.now(fixedClock));
        lateBooking.setStartTime(LocalTime.now(fixedClock).plusMinutes(90));
        lateBooking.setEndTime(LocalTime.now(fixedClock).plusMinutes(150));

        when(coachBookingRepository.findByIdForUpdate(161L)).thenReturn(Optional.of(earlyBooking));
        when(coachBookingRepository.findByIdForUpdate(162L)).thenReturn(Optional.of(lateBooking));

        AuthenticatedPrincipal memberPrincipal = new AuthenticatedPrincipal(member.getUserId(), "member", "MEMBER");

        service.cancelBooking(memberPrincipal, 161L, "Đổi lịch sớm");
        service.cancelBooking(memberPrincipal, 162L, "Hủy sát giờ");

        assertThat(earlyBooking.getStatus()).isEqualTo("cancelled");
        assertThat(earlyBooking.isQuotaForfeited()).isFalse();
        assertThat(lateBooking.getStatus()).isEqualTo("cancelled");
        assertThat(lateBooking.isQuotaForfeited()).isTrue();
    }

    /** Kiểm thử: HLV hoặc quản lý hủy buổi tập trong vòng 2 tiếng không làm mất lượt gói của học viên */
    @Test
    @DisplayName("HLV hoặc quản lý hủy buổi tập trong vòng 2 tiếng không làm mất lượt gói của học viên")
    void staffCancelWithinTwoHoursDoesNotForfeitMemberQuota() {
        CoachBooking booking = new CoachBooking();
        booking.setId(163L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setStatus("confirmed");
        booking.setPaymentMethod("package_quota");
        booking.setBookingDate(LocalDate.now(fixedClock));
        booking.setStartTime(LocalTime.now(fixedClock).plusMinutes(60));
        booking.setEndTime(LocalTime.now(fixedClock).plusMinutes(120));

        when(coachBookingRepository.findByIdForUpdate(163L)).thenReturn(Optional.of(booking));
        AuthenticatedPrincipal coachPrincipal = new AuthenticatedPrincipal(coach.getUserId(), "coach", "COACH");

        service.cancelBooking(coachPrincipal, 163L, "HLV bận đột xuất");

        assertThat(booking.getStatus()).isEqualTo("cancelled");
        assertThat(booking.isQuotaForfeited()).isFalse();
    }

    /** Kiểm thử: Tự động hủy lịch PT 1:1 treo quá hạn chưa thanh toán và đóng giao dịch pending */
    @Test
    @DisplayName("Tự động hủy lịch PT 1:1 treo quá hạn chưa thanh toán và đóng giao dịch pending")
    void expireUnpaidBookingsCancelsStaleAndSkipsActiveVnpay() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var guard = org.mockito.Mockito.mock(com.swp391.scms.finance.service.VnpayPaymentGuard.class);
        CoachBookingService target = new CoachBookingService(
                coachBookingRepository, coachRepository, memberRepository, classSessionRepository,
                classEnrollmentRepository, subscriptionRepository, disciplineRepository,
                null, fixedClock, null, guard);
        org.springframework.test.util.ReflectionTestUtils.setField(target, "paymentRepository", payments);

        CoachBooking stale = new CoachBooking();
        stale.setId(170L);
        stale.setMember(member);
        stale.setCoach(coach);
        stale.setStatus("confirmed");
        stale.setPaymentMethod("cash");
        stale.setPaymentStatus("pending");
        stale.setBookingDate(LocalDate.now(fixedClock).plusDays(1));
        stale.setStartTime(LocalTime.of(10, 0));
        stale.setEndTime(LocalTime.of(11, 0));

        CoachBooking activeVnpay = new CoachBooking();
        activeVnpay.setId(171L);
        activeVnpay.setMember(member);
        activeVnpay.setCoach(coach);
        activeVnpay.setStatus("confirmed");
        activeVnpay.setPaymentMethod("bank_transfer");
        activeVnpay.setPaymentStatus("pending");
        activeVnpay.setBookingDate(LocalDate.now(fixedClock).plusDays(1));
        activeVnpay.setStartTime(LocalTime.of(14, 0));
        activeVnpay.setEndTime(LocalTime.of(15, 0));

        com.swp391.scms.finance.entity.Payment pendingPayment = new com.swp391.scms.finance.entity.Payment();
        pendingPayment.setStatus("pending");

        when(coachBookingRepository.findUnpaidStale(any(), any(), any(), any())).thenReturn(List.of(stale, activeVnpay));
        when(coachBookingRepository.findByIdForUpdate(170L)).thenReturn(Optional.of(stale));
        when(coachBookingRepository.findByIdForUpdate(171L)).thenReturn(Optional.of(activeVnpay));
        when(payments.findAllByCoachBookingId(170L)).thenReturn(List.of(pendingPayment));
        org.mockito.Mockito.doNothing().when(guard).coach(170L);
        org.mockito.Mockito.doThrow(new ConflictException("VNPAY_PENDING", "error", null, "pending")).when(guard).coach(171L);

        int cancelled = target.expireUnpaidBookings();

        verify(coachBookingRepository).findUnpaidStale(
                eq(LocalDateTime.now(fixedClock).minusMinutes(15)),
                eq(LocalDateTime.now(fixedClock).minusMinutes(5)),
                any(), any());
        verify(coachBookingRepository).findByIdForUpdate(170L);
        verify(coachBookingRepository).findByIdForUpdate(171L);
        verify(guard).coach(170L);
        verify(payments).findAllByCoachBookingId(170L);
        assertThat(cancelled).isEqualTo(1);
        assertThat(stale.getStatus()).isEqualTo("cancelled");
        assertThat(stale.getCancelledAt()).isNotNull();
        assertThat(pendingPayment.getStatus()).isEqualTo("failed");
        assertThat(activeVnpay.getStatus()).isEqualTo("confirmed");
        verify(coachBookingRepository).save(stale);
    }

    /** Kiểm thử P0-12: expireUnpaidBookings đọc lại dưới khóa FOR UPDATE và bỏ qua booking vừa thanh toán song song. */
    @Test
    @DisplayName("Bỏ qua lịch PT 1:1 vừa được thanh toán song song trước khi job hết hạn lấy được khóa dòng")
    void expireUnpaidBookingsSkipsBookingPaidConcurrentlyUnderRowLock() {
        var payments = org.mockito.Mockito.mock(com.swp391.scms.finance.repository.PaymentRepository.class);
        var guard = org.mockito.Mockito.mock(com.swp391.scms.finance.service.VnpayPaymentGuard.class);
        CoachBookingService target = new CoachBookingService(
                coachBookingRepository, coachRepository, memberRepository, classSessionRepository,
                classEnrollmentRepository, subscriptionRepository, disciplineRepository,
                null, fixedClock, null, guard);
        org.springframework.test.util.ReflectionTestUtils.setField(target, "paymentRepository", payments);

        // Bản ghi snapshot đọc trước khi có khóa vẫn đang pending
        CoachBooking staleSnapshot = new CoachBooking();
        staleSnapshot.setId(180L);
        staleSnapshot.setStatus("confirmed");
        staleSnapshot.setPaymentMethod("cash");
        staleSnapshot.setPaymentStatus("pending");

        // Khi lấy được FOR UPDATE, VNPay/Ví/Quầy đã kịp chốt thanh toán sang paid!
        CoachBooking lockedPaid = new CoachBooking();
        lockedPaid.setId(180L);
        lockedPaid.setMember(member);
        lockedPaid.setCoach(coach);
        lockedPaid.setStatus("confirmed");
        lockedPaid.setPaymentMethod("online_wallet");
        lockedPaid.setPaymentStatus("paid");

        // Booking thứ 2 còn pending trên row nhưng khoản thu đã thành công (phòng vệ nhiều lớp)
        CoachBooking paidPaymentBooking = new CoachBooking();
        paidPaymentBooking.setId(181L);
        paidPaymentBooking.setMember(member);
        paidPaymentBooking.setCoach(coach);
        paidPaymentBooking.setStatus("confirmed");
        paidPaymentBooking.setPaymentMethod("cash");
        paidPaymentBooking.setPaymentStatus("pending");
        var settledPayment = new com.swp391.scms.finance.entity.Payment();
        settledPayment.setStatus("success");

        when(coachBookingRepository.findUnpaidStale(any(), any(), any(), any()))
                .thenReturn(List.of(staleSnapshot, paidPaymentBooking));
        when(coachBookingRepository.findByIdForUpdate(180L)).thenReturn(Optional.of(lockedPaid));
        when(coachBookingRepository.findByIdForUpdate(181L)).thenReturn(Optional.of(paidPaymentBooking));
        when(payments.findAllByCoachBookingId(181L)).thenReturn(List.of(settledPayment));

        int cancelled = target.expireUnpaidBookings();

        assertThat(cancelled).isZero();
        assertThat(lockedPaid.getStatus()).isEqualTo("confirmed");
        assertThat(lockedPaid.getPaymentStatus()).isEqualTo("paid");
        assertThat(paidPaymentBooking.getStatus()).isEqualTo("confirmed");
        verify(coachBookingRepository, never()).save(any());
        verify(payments, never()).save(any());
    }

    /** Kiểm thử P0-12: lỗi ở một booking không rollback các booking hết hạn khác nhờ tách transaction độc lập. */
    @Test
    @DisplayName("Cô lập lỗi theo từng booking trong transaction REQUIRES_NEW khi tự động hủy PT quá hạn")
    void expireUnpaidBookingsIsolatesFailurePerBookingInIndependentTransactions() {
        var txManager = mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(txManager.getTransaction(any())).thenAnswer(inv -> new org.springframework.transaction.support.SimpleTransactionStatus());
        service.setTransactionManager(txManager);

        CoachBooking failing = new CoachBooking();
        failing.setId(190L);
        CoachBooking healthy = new CoachBooking();
        healthy.setId(191L);
        healthy.setMember(member);
        healthy.setCoach(coach);
        healthy.setStatus("confirmed");
        healthy.setPaymentMethod("cash");
        healthy.setPaymentStatus("pending");
        healthy.setBookingDate(LocalDate.now(fixedClock).plusDays(1));
        healthy.setStartTime(ScheduleSlot.SLOT_4.startTime());
        healthy.setEndTime(ScheduleSlot.SLOT_4.endTime());

        when(coachBookingRepository.findUnpaidStale(any(), any(), any(), any())).thenReturn(List.of(failing, healthy));
        when(coachBookingRepository.findByIdForUpdate(190L)).thenThrow(new RuntimeException("Lock timeout"));
        when(coachBookingRepository.findByIdForUpdate(191L)).thenReturn(Optional.of(healthy));

        int cancelled = service.expireUnpaidBookings();

        assertThat(cancelled).isEqualTo(1);
        assertThat(healthy.getStatus()).isEqualTo("cancelled");
        verify(coachBookingRepository).save(healthy);
        verify(txManager, times(2)).getTransaction(argThat(def ->
                def.getPropagationBehavior() == org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(txManager, times(1)).rollback(any());
        verify(txManager, times(1)).commit(any());
    }

    /**
     * Kiểm thử: Khi tắt lớp học nhóm (legacyClassesEnabled=false), các ClassSession cũ không chặn slot PT 1:1
     * của HLV
     */
    @Test
    @DisplayName("Khi tắt lớp học nhóm (legacyClassesEnabled=false), các ClassSession cũ không chặn slot PT 1:1 của HLV")
    void legacyClassSessionsAreIgnoredWhenClassesDisabled() {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "legacyClassesEnabled", false);
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());

        List<CoachAvailableSlotDto> slots = service.getAvailableSlots(20L, LocalDate.of(2026, 11, 26), 10L);
        CoachAvailableSlotDto slot17 = slots.stream().filter(s -> s.startTime().equals(LocalTime.of(17, 0))).findFirst().orElseThrow();

        assertThat(slot17.available()).isTrue();
        verify(classSessionRepository, never()).findActiveByCoachAndDate(any(), any());
        verify(classSessionRepository, never()).findActiveByMemberAndDate(any(), any());
    }

    /** Kiểm thử: Lượt PT miễn phí đã dùng ở gói Trial không trừ vào 3 lượt của gói Gold mới mua */
    @Test
    @DisplayName("Lượt PT miễn phí đã dùng ở gói Trial không trừ vào 3 lượt của gói Gold mới mua")
    void trialQuotaUsageDoesNotReduceSubsequentGoldPackageQuota() {
        MembershipPackage goldPkg = new MembershipPackage();
        goldPkg.setId(2L);
        goldPkg.setName("GOLD 3 THÁNG");
        goldPkg.setTier("GOLD");
        goldPkg.setDurationDays(90);

        MembershipSubscription goldSub = new MembershipSubscription();
        goldSub.setId(500L);
        goldSub.setMember(member);
        goldSub.setMembershipPackage(goldPkg);
        goldSub.setStatus("active");
        goldSub.setStartDate(LocalDate.now(fixedClock));
        goldSub.setEndDate(LocalDate.now(fixedClock).plusDays(90));
        goldSub.setCreatedAt(LocalDateTime.now(fixedClock));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(goldSub));
        when(coachBookingRepository.countSubscriptionQuotaUsage(
                eq(10L), any(), any(), eq("package_quota"), eq(List.of(500L)), eq(goldSub.getCreatedAt())))
                .thenReturn(0L);

        var quota = service.getMemberQuotaStatus(10L);

        assertThat(quota.monthlyQuota()).isEqualTo(3);
        assertThat(quota.usedThisMonth()).isEqualTo(0);
        assertThat(quota.remainingQuota()).isEqualTo(3);
    }

    /** Kiểm thử: Nâng cấp từ Gold lên Platinum ngay trong ngày vẫn giữ đủ 3 lượt PT đã dùng của Gold */
    @Test
    @DisplayName("Nâng cấp từ Gold lên Platinum ngay trong ngày vẫn giữ đủ 3 lượt PT đã dùng của Gold")
    void upgradingGoldToPlatinumSameDayCarriesOverGoldPtUsage() {
        MembershipPackage goldPkg = new MembershipPackage();
        goldPkg.setId(2L);
        goldPkg.setName("GOLD 3 THÁNG");
        goldPkg.setTier("GOLD");
        goldPkg.setDurationDays(90);

        MembershipPackage platPkg = new MembershipPackage();
        platPkg.setId(3L);
        platPkg.setName("PLATINUM 3 THÁNG");
        platPkg.setTier("PLATINUM");
        platPkg.setDurationDays(90);

        LocalDate today = LocalDate.now(fixedClock);
        // Khi nâng cấp Gold ngay trong ngày, endDate bị cắt về hôm nay (khoảng 0 ngày),
        // nên KHÔNG được phân loại nhầm thành gói dùng thử 3 ngày.
        MembershipSubscription goldSub = new MembershipSubscription();
        goldSub.setId(68L);
        goldSub.setMember(member);
        goldSub.setMembershipPackage(goldPkg);
        goldSub.setStatus("expired");
        goldSub.setStartDate(today);
        goldSub.setEndDate(today);
        goldSub.setCreatedAt(LocalDateTime.now(fixedClock).minusHours(1));

        MembershipSubscription platSub = new MembershipSubscription();
        platSub.setId(69L);
        platSub.setMember(member);
        platSub.setMembershipPackage(platPkg);
        platSub.setPreviousSubscription(goldSub);
        platSub.setUpgradeCharge(new BigDecimal("800000.00"));
        platSub.setStatus("active");
        platSub.setStartDate(today);
        platSub.setEndDate(today.plusDays(89));
        platSub.setCreatedAt(LocalDateTime.now(fixedClock));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(platSub));
        when(coachBookingRepository.countSubscriptionQuotaUsage(
                eq(10L), any(), any(), eq("package_quota"), eq(List.of(69L, 68L)), eq(goldSub.getCreatedAt())))
                .thenReturn(3L);

        var quota = service.getMemberQuotaStatus(10L);

        assertThat(quota.monthlyQuota()).isEqualTo(6);
        assertThat(quota.usedThisMonth()).isEqualTo(3);
        assertThat(quota.remainingQuota()).isEqualTo(3);
    }

    /** Kiểm thử: HLV đang nghỉ phép được duyệt không đặt được và không có khung trống. */
    @Test
    void coachOnApprovedLeaveCannotBeBookedAndShowsNoFreeSlots() {
        var leaves = org.mockito.Mockito.mock(com.swp391.scms.operations.repository.StaffInternalRequestRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "staffRequestRepository", leaves);
        LocalDate day = LocalDate.of(2026, 11, 2);
        when(leaves.existsApprovedLeaveOn(20L, day)).thenReturn(true);
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        var request = new CoachBookingCreateDto(20L, null, day,
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "package_quota", null);

        assertThatThrownBy(() -> service.createBooking(principal, request))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class)
                .satisfies(e -> assertThat(((com.swp391.scms.common.exception.ConflictException) e).getErrorCode())
                        .isEqualTo("COACH_ON_LEAVE"));
        assertThat(service.getAvailableSlots(20L, day, 10L))
                .hasSize(5)
                .allSatisfy(slot -> {
                    assertThat(slot.available()).isFalse();
                    assertThat(slot.reason()).isEqualTo("coach_on_leave");
                });
        verify(coachBookingRepository, never()).save(any());
    }

    /** Kiểm thử: getMemberQuotaStatus: Trả về đúng 1 lượt cho Gói Trải Nghiệm 3 Ngày (dù tên cũ là GOLD) */
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
        sub.setEndDate(LocalDate.of(2026, 11, 2)); // 3 ngày

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(0L);

        var quota = service.getMemberQuotaStatus(10L);
        assertThat(quota.packageName()).isEqualTo("Gói Trải Nghiệm 3 Ngày");
        assertThat(quota.monthlyQuota()).isEqualTo(1);
        assertThat(quota.remainingQuota()).isEqualTo(1);
    }

    /** Kiểm thử: getMemberQuotaStatus: Trả về đúng 3 lượt cho Gói GOLD 30 ngày chuẩn */
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
        sub.setEndDate(LocalDate.of(2026, 11, 30)); // 60 ngày

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(sub));
        when(coachBookingRepository.countMonthlyQuotaUsage(eq(10L), any(), any(), eq("package_quota"))).thenReturn(1L);

        var quota = service.getMemberQuotaStatus(10L);
        assertThat(quota.packageName()).isEqualTo("GOLD");
        assertThat(quota.monthlyQuota()).isEqualTo(3);
        assertThat(quota.usedThisMonth()).isEqualTo(1);
        assertThat(quota.remainingQuota()).isEqualTo(2);
    }
    /** Kiểm thử: HLV có thể nhận liên tiếp Slot 4 và Slot 5 sau 3 slot đầu mà không bị chặn nghỉ. */
    @Test
    void coachCanAcceptFourAndFiveConsecutivePtSlotsWithoutRestRestriction() {
        LocalDate day = LocalDate.of(2026, 11, 2);
        MembershipSubscription active = new MembershipSubscription();
        active.setStartDate(LocalDate.of(2026, 10, 1));
        active.setEndDate(LocalDate.of(2026, 11, 30));

        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active));
        when(classSessionRepository.findActiveByCoachAndDate(20L, day)).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(10L, day)).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(10L, day)).thenReturn(List.of());
        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking saved = inv.getArgument(0);
            saved.setId(900L);
            return saved;
        });

        // Khi HLV đã có Slot 1, 2, 3 -> Slot 4 và Slot 5 vẫn còn trống (không có lý do "coach_rest")
        when(coachBookingRepository.findActiveByCoachAndDate(20L, day))
                .thenReturn(ptSlots(ScheduleSlot.SLOT_1, ScheduleSlot.SLOT_2, ScheduleSlot.SLOT_3));
        var slots = service.getAvailableSlots(20L, day, 10L);
        assertThat(slots).hasSize(5);
        assertThat(slots.get(0).reason()).isEqualTo("coach_busy");
        assertThat(slots.get(1).reason()).isEqualTo("coach_busy");
        assertThat(slots.get(2).reason()).isEqualTo("coach_busy");
        assertThat(slots.get(3).available()).isTrue();
        assertThat(slots.get(3).reason()).isNull();
        assertThat(slots.get(4).available()).isTrue();
        assertThat(slots.get(4).reason()).isNull();

        // Đặt Slot 4 liên tiếp thứ 4 thành công
        var slot4Req = new CoachBookingCreateDto(20L, null, day,
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "cash", null);
        assertThat(service.createBooking(principal, slot4Req).status()).isEqualTo("confirmed");

        // Đặt Slot 5 liên tiếp thứ 5 cũng thành công
        when(coachBookingRepository.findActiveByCoachAndDate(20L, day))
                .thenReturn(ptSlots(ScheduleSlot.SLOT_1, ScheduleSlot.SLOT_2, ScheduleSlot.SLOT_3, ScheduleSlot.SLOT_4));
        var slot5Req = new CoachBookingCreateDto(20L, null, day,
                ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime(), "cash", null);
        assertThat(service.createBooking(principal, slot5Req).status()).isEqualTo("confirmed");
    }

    /** Hàm trợ giúp của test: tạo danh sách khung PT theo {@link ScheduleSlot}. */
    private List<CoachBooking> ptSlots(ScheduleSlot... slots) {
        return java.util.Arrays.stream(slots).map(slot -> {
            CoachBooking booking = new CoachBooking();
            booking.setStartTime(slot.startTime());
            booking.setEndTime(slot.endTime());
            return booking;
        }).toList();
    }


    /** Hàm trợ giúp của test: tạo một buổi PT. */
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

    /** Kiểm thử: màn điểm danh chia buổi thành đã dự, vắng và sắp tới, và giới hạn HLV trong buổi của mình. */
    @Test
    void attendanceScreenSplitsSessionsIntoAttendedMissedAndUpcomingAndScopesCoachesToTheirOwn() {
        // Đồng hồ đang ở 2026-10-31 08:00.
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
        // Huấn luyện viên không bao giờ gọi truy vấn toàn quầy lễ tân.
        verify(coachBookingRepository, org.mockito.Mockito.times(4)).findForAttendance(any(), any());
    }

    /** Kiểm thử: danh sách điểm danh hiện lượt vào cổng làm gợi ý mà không đánh dấu đã đến. */
    @Test
    void attendanceListShowsTheGateCheckinAsAHintWithoutMarkingTheArrival() {
        var missed = ptSession(2, LocalDate.of(2026, 10, 30), LocalTime.of(15, 0), LocalTime.of(16, 0), null);
        when(coachBookingRepository.findForAttendance(any(), any())).thenReturn(List.of(missed));
        var pt = org.mockito.Mockito.mock(com.swp391.scms.coaching.service.PtAttendanceService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "ptAttendance", pt);
        when(pt.gateCheckinFor(missed)).thenReturn(LocalDateTime.of(2026, 10, 30, 14, 50));

        var row = service.getAttendance(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), null, null, "ALL").get(0);

        assertThat(row.gateCheckinAt()).isEqualTo(LocalDateTime.of(2026, 10, 30, 14, 50));
        assertThat(row.attendedAt()).isNull();
    }

    /** Kiểm thử: màn điểm danh từ chối hội viên và khoảng dài hơn hai tháng. */
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

    /** Kiểm thử: HLV, quầy hoặc quản lý đánh dấu được đã dự, nhưng chỉ đúng HLV của buổi. */
    @Test
    void aCoachDeskOrManagerCanMarkAStartedSessionAttendedButOnlyTheOwnCoach() {
        // Đồng hồ đang ở 2026-10-31 08:00; buổi này bắt đầu lúc 07:00.
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
        // Lễ tân đánh dấu lần hai sẽ giữ nguyên mốc giờ đầu tiên và không lưu thêm gì.
        var again = service.markAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 7L);
        assertThat(again.attendedAt()).isEqualTo(LocalDateTime.of(2026, 10, 31, 8, 0));
        verify(coachBookingRepository, times(1)).save(started);
    }

    /** Kiểm thử: buổi tương lai hoặc đã hủy không đánh dấu đã dự được. */
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

    /** Kiểm thử: bỏ đánh dấu gỡ lượt đến và khóa buổi khỏi lượt quét và tác vụ quét. */
    @Test
    void unmarkingRemovesTheArrivalAndLocksTheSessionAgainstTheScanAndTheSweep() {
        var attended = ptSession(11, LocalDate.of(2026, 10, 31), LocalTime.of(7, 0), LocalTime.of(8, 0), LocalDateTime.of(2026, 10, 31, 7, 55));
        when(coachBookingRepository.findById(11L)).thenReturn(Optional.of(attended));
        var otherCoach = new AuthenticatedPrincipal(99L, "other", "COACH");
        assertThatThrownBy(() -> service.unmarkAttended(otherCoach, 11L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);
        assertThatThrownBy(() -> service.unmarkAttended(principal, 11L))
                .isInstanceOf(com.swp391.scms.common.exception.ForbiddenException.class);

        var dto = service.unmarkAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 11L);

        assertThat(dto.attendedAt()).isNull();
        assertThat(dto.attendanceLocked()).isTrue();
        assertThat(dto.status()).isEqualTo("confirmed");
        assertThat(attended.isAttendanceLocked()).isTrue();
        verify(coachBookingRepository).save(attended);
        // Bỏ đánh dấu lần nữa không thay đổi gì; đánh dấu thủ công sẽ mở khóa lại.
        service.unmarkAttended(new AuthenticatedPrincipal(20L, "hung", "COACH"), 11L);
        verify(coachBookingRepository, times(1)).save(attended);
        service.markAttended(new AuthenticatedPrincipal(20L, "hung", "COACH"), 11L);
        assertThat(attended.getAttendedAt()).isNotNull();
        assertThat(attended.isAttendanceLocked()).isFalse();
    }

    /** Kiểm thử: HLV chỉ được điểm danh và sửa điểm danh trong ngày diễn ra buổi tập; quá ngày sẽ bị từ chối. */
    @Test
    void coachCannotMarkOrUnmarkAttendanceForPastDays() {
        var pastSession = ptSession(13, LocalDate.of(2026, 10, 30), LocalTime.of(7, 0), LocalTime.of(8, 0), null);
        when(coachBookingRepository.findById(13L)).thenReturn(Optional.of(pastSession));
        var coachPrincipal = new AuthenticatedPrincipal(20L, "hung", "COACH");
        var deskPrincipal = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

        assertThatThrownBy(() -> service.markAttended(coachPrincipal, 13L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_BOOKING_ATTENDANCE_EXPIRED");

        assertThatThrownBy(() -> service.unmarkAttended(coachPrincipal, 13L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_BOOKING_ATTENDANCE_EXPIRED");

        // Lễ tân vẫn có thể ghi nhận và gỡ ghi nhận buổi ngày hôm trước
        var deskDto = service.markAttended(deskPrincipal, 13L);
        assertThat(deskDto.attendedAt()).isNotNull();
        var deskUnmarked = service.unmarkAttended(deskPrincipal, 13L);
        assertThat(deskUnmarked.attendedAt()).isNull();
        assertThat(deskUnmarked.attendanceLocked()).isTrue();
    }

    /** Kiểm thử: buổi đã hủy không bỏ đánh dấu được. */
    @Test
    void aCancelledSessionCannotBeUnmarked() {
        var cancelled = ptSession(12, LocalDate.of(2026, 10, 30), LocalTime.of(9, 0), LocalTime.of(10, 0), null);
        cancelled.setStatus("cancelled");
        when(coachBookingRepository.findById(12L)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> service.unmarkAttended(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), 12L))
                .isInstanceOf(com.swp391.scms.common.exception.ConflictException.class);
    }

    /** Kiểm thử: danh sách sắp tới loại buổi đang diễn ra và đã kết thúc theo mốc giờ Việt Nam. */
    @Test
    void upcomingExcludesOngoingAndEndedSessionsAtVietnamBoundaries() {
        var ended = ptSession(1, LocalDate.of(2026, 10, 31), LocalTime.of(7, 0), LocalTime.of(8, 0), null);
        var ongoing = ptSession(2, LocalDate.of(2026, 10, 31), LocalTime.of(8, 0), LocalTime.of(9, 0), null);
        var future = ptSession(3, LocalDate.of(2026, 10, 31), LocalTime.of(9, 0), LocalTime.of(10, 0), null);
        when(coachBookingRepository.findForAttendance(any(), any())).thenReturn(List.of(ended, ongoing, future));
        var desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");
        assertThat(service.getAttendance(desk, null, null, "UPCOMING")).extracting(d -> d.id()).containsExactly(3L);
        assertThat(service.getAttendance(desk, null, null, "MISSED")).extracting(d -> d.id()).containsExactly(1L);
        assertThat(service.getAttendance(desk, null, null, "ALL")).hasSize(3);
    }

    /** Kiểm thử: ngày điểm danh mặc định dùng giờ Việt Nam kể cả khi đồng hồ ở UTC. */
    @Test
    void defaultAttendanceDatesUseVietnamEvenWhenClockZoneIsUtc() {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "clock",
                Clock.fixed(Instant.parse("2026-10-31T17:01:00Z"), ZoneOffset.UTC));
        when(coachBookingRepository.findForAttendance(any(), any())).thenReturn(List.of());
        service.getAttendance(new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST"), null, null, "ALL");
        verify(coachBookingRepository).findForAttendance(LocalDate.of(2026, 10, 19), LocalDate.of(2026, 11, 1));
    }

    /** Kiểm thử: khi lớp nhóm bật và HLV đang có lịch dạy lớp thì khóa slot PT 1:1 và chặn đặt trùng giờ. */
    @Test
    void groupClassBlocksCoachPtSlotAndRejectsOverlappingBooking() {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "legacyClassesEnabled", true);
        LocalDate date = LocalDate.of(2026, 11, 1);

        com.swp391.scms.scheduling.entity.GymClass yoga = new com.swp391.scms.scheduling.entity.GymClass();
        yoga.setName("Yoga Sáng");
        com.swp391.scms.scheduling.entity.ClassSession teaching = new com.swp391.scms.scheduling.entity.ClassSession();
        teaching.setGymClass(yoga);
        teaching.setSessionDate(date);
        teaching.setStartTime(ScheduleSlot.SLOT_4.startTime());
        teaching.setEndTime(ScheduleSlot.SLOT_4.endTime());
        teaching.setStatus("scheduled");

        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(classSessionRepository.findActiveByCoachAndDate(20L, date)).thenReturn(List.of(teaching));
        when(coachBookingRepository.findActiveByCoachAndDate(20L, date)).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(10L, date)).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(10L, date)).thenReturn(List.of());

        List<CoachAvailableSlotDto> slots = service.getAvailableSlots(20L, date, 10L);
        CoachAvailableSlotDto slot4 = slots.stream().filter(s -> s.startTime().equals(ScheduleSlot.SLOT_4.startTime())).findFirst().orElseThrow();
        CoachAvailableSlotDto slot5 = slots.stream().filter(s -> s.startTime().equals(ScheduleSlot.SLOT_5.startTime())).findFirst().orElseThrow();
        assertThat(slot4.slotNumber()).isEqualTo(4);
        assertThat(slot4.available()).isFalse();
        assertThat(slot4.reason()).isEqualTo("coach_busy");
        assertThat(slot5.slotNumber()).isEqualTo(5);
        assertThat(slot5.available()).isTrue();

        CoachBookingCreateDto overlappingRequest = new CoachBookingCreateDto(
                20L, null, date, ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "package_quota", "Tập riêng");
        assertThatThrownBy(() -> service.createBooking(principal, overlappingRequest))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_SCHEDULE_CONFLICT");
    }

    /** Kiểm thử: khi hội viên đang có lớp nhóm trùng giờ thì slot PT báo member_busy và chặn đặt. */
    @Test
    void groupClassBlocksMemberPtSlotWhenMemberHasOverlappingClass() {
        org.springframework.test.util.ReflectionTestUtils.setField(service, "legacyClassesEnabled", true);
        LocalDate date = LocalDate.of(2026, 11, 1);

        com.swp391.scms.scheduling.entity.GymClass boxing = new com.swp391.scms.scheduling.entity.GymClass();
        boxing.setName("Boxing");
        com.swp391.scms.scheduling.entity.ClassSession attending = new com.swp391.scms.scheduling.entity.ClassSession();
        attending.setGymClass(boxing);
        attending.setSessionDate(date);
        attending.setStartTime(ScheduleSlot.SLOT_5.startTime());
        attending.setEndTime(ScheduleSlot.SLOT_5.endTime());
        attending.setStatus("scheduled");

        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(classSessionRepository.findActiveByCoachAndDate(20L, date)).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(20L, date)).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(10L, date)).thenReturn(List.of(attending));
        when(coachBookingRepository.findActiveByMemberAndDate(10L, date)).thenReturn(List.of());

        List<CoachAvailableSlotDto> slots = service.getAvailableSlots(20L, date, 10L);
        CoachAvailableSlotDto slot5 = slots.stream().filter(s -> s.startTime().equals(ScheduleSlot.SLOT_5.startTime())).findFirst().orElseThrow();
        assertThat(slot5.slotNumber()).isEqualTo(5);
        assertThat(slot5.available()).isFalse();
        assertThat(slot5.reason()).isEqualTo("member_busy");

        CoachBookingCreateDto overlappingRequest = new CoachBookingCreateDto(
                20L, null, date, ScheduleSlot.SLOT_5.startTime(), ScheduleSlot.SLOT_5.endTime(), "package_quota", "Tập riêng");
        assertThatThrownBy(() -> service.createBooking(principal, overlappingRequest))
                .isInstanceOf(ConflictException.class)
                .satisfies(e -> {
                    ConflictException ce = (ConflictException) e;
                    assertThat(ce.getErrorCode()).isEqualTo("MEMBER_SCHEDULE_CONFLICT");
                    assertThat(ce.getMessageKey()).isEqualTo("error.coach_booking.member_class_conflict");
                    assertThat(ce.getMessageArgs()).containsExactly("Boxing", "17:00", "19:30");
                });
    }

    /** Kiểm thử P1-BE-22: nâng cấp Trial → Platinum 30 ngày không reset quota ở 2 ngày cuối và nâng cấp Gold → Platinum giữa chu kỳ bị giới hạn theo tổng hạn mức 30 ngày. */
    @Test
    @DisplayName("P1-BE-22: Chặn trục lợi nhân đôi lượt PT khi nâng cấp Trial → Platinum hoặc Gold → Platinum giữa chu kỳ")
    void upgradeFromTrialOrMidCycleGoldCannotDoublePtQuota() {
        // 1. Trial 3 ngày (1/11–3/11) → Platinum 30 ngày (3/11–2/12). Vào 1/12 (2 ngày cuối), vẫn nằm trong chu kỳ 1 (3/11–2/12).
        Clock dec1Clock = Clock.fixed(
                LocalDateTime.of(2026, 12, 1, 8, 0).atZone(com.swp391.scms.common.CenterTime.ZONE).toInstant(),
                com.swp391.scms.common.CenterTime.ZONE);
        CoachBookingService dec1Service = new CoachBookingService(
                coachBookingRepository, coachRepository, memberRepository, classSessionRepository,
                classEnrollmentRepository, subscriptionRepository, disciplineRepository, dec1Clock, null);

        MembershipPackage trialPkg = new MembershipPackage();
        trialPkg.setName("Gói Trải Nghiệm 3 Ngày");
        trialPkg.setTier("GOLD");
        trialPkg.setDurationDays(3);

        MembershipPackage plat30Pkg = new MembershipPackage();
        plat30Pkg.setName("PLATINUM 1 THÁNG");
        plat30Pkg.setTier("PLATINUM");
        plat30Pkg.setDurationDays(30);

        MembershipSubscription trialSub = new MembershipSubscription();
        trialSub.setId(701L);
        trialSub.setMember(member);
        trialSub.setMembershipPackage(trialPkg);
        trialSub.setStatus("expired");
        trialSub.setStartDate(LocalDate.of(2026, 11, 1));
        trialSub.setEndDate(LocalDate.of(2026, 11, 3));

        MembershipSubscription platFromTrial = new MembershipSubscription();
        platFromTrial.setId(702L);
        platFromTrial.setMember(member);
        platFromTrial.setMembershipPackage(plat30Pkg);
        platFromTrial.setPreviousSubscription(trialSub);
        platFromTrial.setUpgradeCharge(new BigDecimal("1500000"));
        platFromTrial.setStatus("active");
        platFromTrial.setStartDate(LocalDate.of(2026, 11, 3));
        platFromTrial.setEndDate(LocalDate.of(2026, 12, 2));
        platFromTrial.setCreatedAt(LocalDateTime.of(2026, 11, 3, 9, 0));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(platFromTrial));
        when(coachBookingRepository.countSubscriptionQuotaUsage(
                eq(10L), eq(LocalDate.of(2026, 11, 3)), eq(LocalDate.of(2026, 12, 2)),
                eq("package_quota"), eq(List.of(702L)), eq(platFromTrial.getCreatedAt())))
                .thenReturn(6L);

        var trialUpgradeStatus = dec1Service.getMemberQuotaStatus(10L);
        assertThat(trialUpgradeStatus.remainingQuota()).isZero();
        assertThat(trialUpgradeStatus.usedThisMonth()).isEqualTo(6);

        // 2. Gold 30 ngày (1/11–30/11) nâng cấp ngày 15/11 lên Platinum 30 ngày (15/11–14/12):
        // đã dùng 6 buổi trên platSub trong 15/11–30/11 -> sang 1/12 (chu kỳ lẻ 1/12–14/12) remaining phải bằng 0!
        MembershipPackage gold30Pkg = new MembershipPackage();
        gold30Pkg.setName("GOLD 1 THÁNG");
        gold30Pkg.setTier("GOLD");
        gold30Pkg.setDurationDays(30);

        MembershipSubscription goldSub = new MembershipSubscription();
        goldSub.setId(703L);
        goldSub.setMember(member);
        goldSub.setMembershipPackage(gold30Pkg);
        goldSub.setStatus("expired");
        goldSub.setStartDate(LocalDate.of(2026, 11, 1));
        goldSub.setEndDate(LocalDate.of(2026, 11, 15));
        goldSub.setCreatedAt(LocalDateTime.of(2026, 11, 1, 9, 0));

        MembershipSubscription platFromGold = new MembershipSubscription();
        platFromGold.setId(704L);
        platFromGold.setMember(member);
        platFromGold.setMembershipPackage(plat30Pkg);
        platFromGold.setPreviousSubscription(goldSub);
        platFromGold.setUpgradeCharge(new BigDecimal("1000000"));
        platFromGold.setStatus("active");
        platFromGold.setStartDate(LocalDate.of(2026, 11, 15));
        platFromGold.setEndDate(LocalDate.of(2026, 12, 14));
        platFromGold.setCreatedAt(LocalDateTime.of(2026, 11, 15, 9, 0));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(platFromGold));
        // Chu kỳ 2 (1/12–14/12) chưa có buổi nào -> 0, nhưng tổng suốt thời hạn gói platFromGold (15/11–14/12) đã dùng đủ 6 buổi!
        when(coachBookingRepository.countSubscriptionQuotaUsage(
                eq(10L), eq(LocalDate.of(2026, 12, 1)), eq(LocalDate.of(2026, 12, 14)),
                eq("package_quota"), eq(List.of(704L, 703L)), eq(goldSub.getCreatedAt())))
                .thenReturn(0L);
        when(coachBookingRepository.countSubscriptionQuotaUsage(
                eq(10L), eq(LocalDate.of(2026, 11, 15)), eq(LocalDate.of(2026, 12, 14)),
                eq("package_quota"), eq(List.of(704L)), eq(platFromGold.getCreatedAt())))
                .thenReturn(6L);

        var midCycleStatus = dec1Service.getMemberQuotaStatus(10L);
        assertThat(midCycleStatus.monthlyQuota()).isEqualTo(6);
        assertThat(midCycleStatus.remainingQuota()).isZero();
        assertThat(midCycleStatus.usedThisMonth()).isEqualTo(6);

        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());

        var seventhAttempt = new CoachBookingCreateDto(
                20L, null, LocalDate.of(2026, 12, 2),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "package_quota", null);
        assertThatThrownBy(() -> dec1Service.createBooking(principal, seventhAttempt))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_BOOKING_QUOTA_EXCEEDED");
    }

    /** Kiểm thử P1-BE-22: sắp xếp activeSubs ổn định chọn gói có hạn mức PT cao nhất thay vì phần tử đầu ngẫu nhiên. */
    @Test
    void activeSubscriptionsAreSortedDeterministicallyByHighestPtQuota() {
        MembershipPackage silverPkg = new MembershipPackage();
        silverPkg.setName("SILVER");
        silverPkg.setTier("SILVER");
        silverPkg.setDurationDays(30);
        MembershipSubscription silverSub = new MembershipSubscription();
        silverSub.setId(1L);
        silverSub.setMembershipPackage(silverPkg);
        silverSub.setStatus("active");
        silverSub.setStartDate(LocalDate.of(2026, 10, 1));
        silverSub.setEndDate(LocalDate.of(2026, 11, 30));

        MembershipPackage platPkg = new MembershipPackage();
        platPkg.setName("PLATINUM");
        platPkg.setTier("PLATINUM");
        platPkg.setDurationDays(30);
        MembershipSubscription platSub = new MembershipSubscription();
        platSub.setId(2L);
        platSub.setMembershipPackage(platPkg);
        platSub.setStatus("active");
        platSub.setStartDate(LocalDate.of(2026, 10, 1));
        platSub.setEndDate(LocalDate.of(2026, 11, 30));
        platSub.setCreatedAt(LocalDateTime.of(2026, 10, 1, 8, 0));

        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active"))
                .thenReturn(List.of(silverSub, platSub));
        when(coachBookingRepository.countSubscriptionQuotaUsage(eq(10L), any(), any(), eq("package_quota"), eq(List.of(2L)), any()))
                .thenReturn(1L);

        var status = service.getMemberQuotaStatus(10L);
        assertThat(status.packageName()).isEqualTo("PLATINUM");
        assertThat(status.monthlyQuota()).isEqualTo(6);
        assertThat(status.remainingQuota()).isEqualTo(5);
    }

    /** Kiểm thử P2-BE-27: unmarkAttended chặn buổi chưa bắt đầu; markAttended/unmarkAttended dùng findByIdForUpdate và điền gateCheckinAt. */
    @Test
    void unmarkAttendedRejectsFutureSessionAndBothUseRowLockAndPopulateGateCheckin() {
        var pt = mock(com.swp391.scms.coaching.service.PtAttendanceService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "ptAttendance", pt);
        var desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

        var future = ptSession(81, LocalDate.of(2026, 10, 31), LocalTime.of(17, 0), LocalTime.of(19, 30), null);
        when(coachBookingRepository.findByIdForUpdate(81L)).thenReturn(Optional.of(future));
        assertThatThrownBy(() -> service.unmarkAttended(desk, 81L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_BOOKING_NOT_STARTED");

        var started = ptSession(82, LocalDate.of(2026, 10, 31), LocalTime.of(7, 0), LocalTime.of(9, 30), null);
        LocalDateTime checkinTime = LocalDateTime.of(2026, 10, 31, 6, 50);
        when(coachBookingRepository.findByIdForUpdate(82L)).thenReturn(Optional.of(started));
        when(pt.gateCheckinFor(started)).thenReturn(checkinTime);

        CoachBookingDto marked = service.markAttended(desk, 82L);
        assertThat(marked.gateCheckinAt()).isEqualTo(checkinTime);
        CoachBookingDto unmarked = service.unmarkAttended(desk, 82L);
        assertThat(unmarked.gateCheckinAt()).isEqualTo(checkinTime);
        verify(coachBookingRepository, times(2)).findByIdForUpdate(82L);
    }

    /** Kiểm thử P2-BE-28: chặn HLV có tài khoản bị khóa/xóa mềm ở cả getAvailableSlots lẫn createBooking, và báo 404 khi disciplineId không tồn tại. */
    @Test
    void rejectsInactiveOrDeletedCoachUserAndMissingDiscipline() {
        coach.getUser().setStatus("locked");
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        assertThatThrownBy(() -> service.getAvailableSlots(20L, LocalDate.of(2026, 11, 1), 10L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_INACTIVE");

        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        var req = new CoachBookingCreateDto(20L, 999L, LocalDate.of(2026, 11, 1),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "cash", null);
        assertThatThrownBy(() -> service.createBooking(principal, req))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_INACTIVE");

        coach.getUser().setStatus("active");
        coach.getUser().setDeletedAt(LocalDateTime.now(fixedClock));
        assertThatThrownBy(() -> service.getAvailableSlots(20L, LocalDate.of(2026, 11, 1), 10L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COACH_INACTIVE");

        coach.getUser().setDeletedAt(null);
        MembershipSubscription active = new MembershipSubscription();
        active.setStartDate(LocalDate.of(2026, 10, 1));
        active.setEndDate(LocalDate.of(2026, 11, 30));
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(active));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(disciplineRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.createBooking(principal, req))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);
    }

    /** Kiểm thử P2-BE-29: khi HLV hủy không có lý do thì không đổ lỗi cho hội viên, thông báo cho hội viên và bỏ qua tự thông báo HLV. */
    @Test
    void coachCancelNotifiesMemberWithoutSelfNotificationOrBlamingMember() {
        var notifications = mock(com.swp391.scms.notifications.NotificationService.class);
        var msgSource = new org.springframework.context.support.ResourceBundleMessageSource();
        msgSource.setBasenames("i18n/messages");
        msgSource.setDefaultEncoding("UTF-8");
        var messageService = new com.swp391.scms.common.i18n.MessageService(msgSource);
        CoachBookingService localizedService = new CoachBookingService(
                coachBookingRepository, coachRepository, memberRepository, classSessionRepository,
                classEnrollmentRepository, subscriptionRepository, disciplineRepository,
                notifications, fixedClock, messageService, null);

        CoachBooking booking = new CoachBooking();
        booking.setId(165L);
        booking.setMember(member);
        booking.setCoach(coach);
        booking.setStatus("confirmed");
        booking.setPaymentMethod("package_quota");
        booking.setBookingDate(LocalDate.of(2026, 11, 2));
        booking.setStartTime(ScheduleSlot.SLOT_4.startTime());
        booking.setEndTime(ScheduleSlot.SLOT_4.endTime());
        when(coachBookingRepository.findByIdForUpdate(165L)).thenReturn(Optional.of(booking));

        var coachPrincipal = new AuthenticatedPrincipal(20L, "hung", "COACH");
        CoachBookingDto cancelled = localizedService.cancelBooking(coachPrincipal, 165L, null);

        assertThat(cancelled.cancelReason()).doesNotContain("Hội viên").doesNotContain("Member");
        verify(notifications).send(eq(10L), anyString(), anyString(), eq("system"), isNull(), eq(165L), eq("/member/classes?tab=pt"));
        verify(notifications, never()).send(eq(20L), anyString(), anyString(), anyString(), any(), any(), any());
    }

    /** Kiểm thử P2-BE-32: hội viên gia hạn sớm được phép đặt lịch PT rơi vào kỳ gia hạn đã thanh toán tiếp theo. */
    @Test
    void earlyRenewedMemberCanBookPtInFuturePaidRenewalSubscription() {
        MembershipPackage goldPkg = new MembershipPackage();
        goldPkg.setName("GOLD");
        goldPkg.setTier("GOLD");
        goldPkg.setDurationDays(30);

        MembershipSubscription currentSub = new MembershipSubscription();
        currentSub.setId(801L);
        currentSub.setMembershipPackage(goldPkg);
        currentSub.setStatus("active");
        currentSub.setStartDate(LocalDate.of(2026, 10, 15));
        currentSub.setEndDate(LocalDate.of(2026, 11, 14));

        MembershipSubscription renewalSub = new MembershipSubscription();
        renewalSub.setId(802L);
        renewalSub.setMembershipPackage(goldPkg);
        renewalSub.setStatus("active");
        renewalSub.setStartDate(LocalDate.of(2026, 11, 15));
        renewalSub.setEndDate(LocalDate.of(2026, 12, 14));
        renewalSub.setCreatedAt(LocalDateTime.of(2026, 10, 30, 10, 0));

        when(memberRepository.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(coachRepository.findById(20L)).thenReturn(Optional.of(coach));
        when(classSessionRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByCoachAndDate(eq(20L), any())).thenReturn(List.of());
        when(coachBookingRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(classSessionRepository.findActiveByMemberAndDate(eq(10L), any())).thenReturn(List.of());
        when(subscriptionRepository.findByMemberUserIdAndStatus(10L, "active")).thenReturn(List.of(currentSub, renewalSub));
        when(coachBookingRepository.countSubscriptionQuotaUsage(eq(10L), any(), any(), eq("package_quota"), eq(List.of(802L)), any()))
                .thenReturn(0L);
        when(coachBookingRepository.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            b.setId(850L);
            return b;
        });

        var req = new CoachBookingCreateDto(20L, null, LocalDate.of(2026, 11, 20),
                ScheduleSlot.SLOT_4.startTime(), ScheduleSlot.SLOT_4.endTime(), "package_quota", null);
        CoachBookingDto booked = service.createBooking(principal, req);

        assertThat(booked.id()).isEqualTo(850L);
        assertThat(booked.paymentStatus()).isEqualTo("used_quota");
    }
}
