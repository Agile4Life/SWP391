package com.swp391.scms.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.ReceptionistRepository;
import com.swp391.scms.users.RoleRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Bộ kiểm thử cho DemoDataSeeder (P1-BE-21 tránh xung đột PT ↔ lớp nhóm & P2-BE-25 khớp PackageBenefits). */
@ExtendWith(MockitoExtension.class)
class DemoDataSeederTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock UserRepository users;
    @Mock RoleRepository roles;
    @Mock MemberRepository members;
    @Mock CoachRepository coaches;
    @Mock ReceptionistRepository receptionists;
    @Mock MembershipPackageRepository packages;
    @Mock MembershipSubscriptionRepository subscriptions;
    @Mock PaymentRepository payments;
    @Mock DisciplineRepository disciplines;
    @Mock CenterCheckinRepository checkins;
    @Mock CoachBookingRepository coachBookings;
    @Mock MemberProgressLogRepository progressLogs;
    @Mock PasswordEncoder passwordEncoder;
    @Mock ClassSessionRepository classSessions;

    private DemoDataSeeder seeder;

    @BeforeEach
    void setUp() {
        seeder = new DemoDataSeeder(
                users, roles, members, coaches, receptionists, packages, subscriptions,
                payments, disciplines, checkins, coachBookings, progressLogs, passwordEncoder, "Demo@12345");
        seeder.setClassSessions(classSessions);
    }

    /** Kiểm thử P1-BE-21: reseedDemoPtBookings bỏ qua các buổi PT tương lai trùng lịch lớp nhóm của HLV hoặc hội viên. */
    @Test
    void reseedDemoPtBookingsSkipsRowsConflictingWithScheduledClassSessions() {
        LocalDate today = LocalDate.now(ZONE);
        User manager = new User();
        manager.setId(1L);
        manager.setEmail(DemoDataSeeder.MANAGER_EMAIL);
        when(coachBookings.count()).thenReturn(0L);

        // HLV Hùng (id=10) & Hội viên An (id=20)
        User hungUser = new User();
        hungUser.setId(10L);
        hungUser.setEmail("hung@demo.sol.vn");
        Coach hung = new Coach();
        hung.setUserId(10L);
        hung.setUser(hungUser);

        User anUser = new User();
        anUser.setId(20L);
        anUser.setEmail("an@demo.sol.vn");
        Member an = new Member();
        an.setUserId(20L);
        an.setUser(anUser);
        an.setJoinDate(today.minusDays(150));

        lenient().when(users.findByEmailIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(users.findByEmailIgnoreCase(DemoDataSeeder.MANAGER_EMAIL)).thenReturn(Optional.of(manager));
        when(users.findByEmailIgnoreCase("hung@demo.sol.vn")).thenReturn(Optional.of(hungUser));
        when(users.findByEmailIgnoreCase("an@demo.sol.vn")).thenReturn(Optional.of(anUser));
        when(coaches.findById(10L)).thenReturn(Optional.of(hung));
        when(members.findById(20L)).thenReturn(Optional.of(an));

        Discipline gym = new Discipline();
        gym.setName("Gym");
        when(disciplines.findAll()).thenReturn(List.of(gym));

        MembershipPackage plat3m = pkg("PLATINUM 3 THÁNG", "PLATINUM", 90, "1599000");
        MembershipSubscription anSub = new MembershipSubscription();
        anSub.setMembershipPackage(plat3m);
        anSub.setStatus("active");
        anSub.setStartDate(today.minusDays(40));
        anSub.setEndDate(today.plusDays(49));
        when(subscriptions.findByMemberUserIdAndStatus(20L, "active")).thenReturn(List.of(anSub));
        when(subscriptions.hasActiveMembershipCoveringSession(anyLong(), any(), any())).thenReturn(true);

        // Hôm nay + 3 có lớp nhóm của HLV Hùng ở SLOT_3 -> phải bỏ qua buổi PT (today + 3, SLOT_3)
        ClassSession coachConflict = new ClassSession();
        coachConflict.setSessionDate(today.plusDays(3));
        coachConflict.setStartTime(ScheduleSlot.SLOT_3.startTime());
        coachConflict.setEndTime(ScheduleSlot.SLOT_3.endTime());
        coachConflict.setStatus("scheduled");

        // Hôm nay + 10 có lớp nhóm của hội viên An ở SLOT_3 -> phải bỏ qua buổi PT (today + 10, SLOT_3)
        ClassSession memberConflict = new ClassSession();
        memberConflict.setSessionDate(today.plusDays(10));
        memberConflict.setStartTime(ScheduleSlot.SLOT_3.startTime());
        memberConflict.setEndTime(ScheduleSlot.SLOT_3.endTime());
        memberConflict.setStatus("scheduled");

        lenient().when(classSessions.findActiveByCoachAndDate(anyLong(), any())).thenReturn(List.of());
        lenient().when(classSessions.findActiveByMemberAndDate(anyLong(), any())).thenReturn(List.of());
        when(classSessions.findActiveByCoachAndDate(10L, today.plusDays(3))).thenReturn(List.of(coachConflict));
        when(classSessions.findActiveByMemberAndDate(20L, today.plusDays(10))).thenReturn(List.of(memberConflict));

        List<CoachBooking> saved = new ArrayList<>();
        when(coachBookings.save(any())).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            saved.add(b);
            return b;
        });

        seeder.run(null);

        // Các buổi quá khứ (completed) vẫn được seed, nhưng 2 buổi tương lai (confirmed) bị xung đột đều bị bỏ qua
        assertThat(saved).isNotEmpty();
        assertThat(saved).noneMatch(b -> "confirmed".equalsIgnoreCase(b.getStatus())
                && (today.plusDays(3).equals(b.getBookingDate()) || today.plusDays(10).equals(b.getBookingDate())));
    }

    /** Kiểm thử P2-BE-25: dữ liệu demo của Em (bảo lưu) và Chi (Silver PT) tuân thủ đúng PackageBenefits. */
    @Test
    void freshSeedAlignsDemoMemberHoldAndPtPerksWithPackageBenefits() {
        when(users.findByEmailIgnoreCase(DemoDataSeeder.MANAGER_EMAIL)).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");

        AtomicLong idSeq = new AtomicLong(100);
        when(roles.findByCode(anyString())).thenAnswer(inv -> {
            Role r = new Role();
            r.setCode(inv.getArgument(0));
            return Optional.of(r);
        });
        when(users.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(idSeq.getAndIncrement());
            return u;
        });
        when(coaches.save(any(Coach.class))).thenAnswer(inv -> {
            Coach c = inv.getArgument(0);
            c.setUserId(c.getUser().getId());
            return c;
        });
        when(members.save(any(Member.class))).thenAnswer(inv -> {
            Member m = inv.getArgument(0);
            m.setUserId(m.getUser().getId());
            return m;
        });

        List<MembershipPackage> catalog = List.of(
                pkg("SILVER", "SILVER", 30, "199000"),
                pkg("GOLD", "GOLD", 30, "299000"),
                pkg("PLATINUM", "PLATINUM", 30, "599000"),
                pkg("GOLD 3 THÁNG", "GOLD", 90, "799000"),
                pkg("PLATINUM 3 THÁNG", "PLATINUM", 90, "1599000"));
        when(packages.findAllByOrderByPriceAsc()).thenReturn(catalog);

        Map<Long, List<MembershipSubscription>> subsByMember = new HashMap<>();
        when(subscriptions.save(any(MembershipSubscription.class))).thenAnswer(inv -> {
            MembershipSubscription s = inv.getArgument(0);
            if (s.getId() == null) s.setId(idSeq.getAndIncrement());
            subsByMember.computeIfAbsent(s.getMember().getUserId(), k -> new ArrayList<>()).remove(s);
            subsByMember.get(s.getMember().getUserId()).add(s);
            return s;
        });
        when(subscriptions.findByMemberUserIdAndStatus(anyLong(), anyString())).thenAnswer(inv -> {
            Long memberId = inv.getArgument(0);
            String status = inv.getArgument(1);
            return subsByMember.getOrDefault(memberId, List.of()).stream()
                    .filter(s -> status.equalsIgnoreCase(s.getStatus()))
                    .toList();
        });
        when(subscriptions.hasActiveMembershipCoveringSession(anyLong(), any(), any())).thenReturn(true);

        Discipline gym = new Discipline(); gym.setName("Gym");
        Discipline yoga = new Discipline(); yoga.setName("Yoga");
        Discipline boxing = new Discipline(); boxing.setName("Boxing");
        when(disciplines.findAll()).thenReturn(List.of(gym, yoga, boxing));
        lenient().when(classSessions.findActiveByCoachAndDate(anyLong(), any())).thenReturn(List.of());
        lenient().when(classSessions.findActiveByMemberAndDate(anyLong(), any())).thenReturn(List.of());

        List<CoachBooking> savedPts = new ArrayList<>();
        when(coachBookings.save(any(CoachBooking.class))).thenAnswer(inv -> {
            CoachBooking b = inv.getArgument(0);
            savedPts.add(b);
            return b;
        });

        seeder.run(null);

        // 1. Hội viên "em" đang bảo lưu phải dùng gói được phép bảo lưu và số ngày bảo lưu <= PackageBenefits.holdMaxDays
        List<MembershipSubscription> frozenSubs = subsByMember.values().stream()
                .flatMap(List::stream)
                .filter(s -> "frozen".equalsIgnoreCase(s.getStatus()))
                .toList();
        assertThat(frozenSubs).hasSize(1);
        MembershipSubscription emSub = frozenSubs.get(0);
        int holdMax = PackageBenefits.holdMaxDays(emSub.getMembershipPackage());
        long holdDays = ChronoUnit.DAYS.between(emSub.getHoldStartDate(), emSub.getHoldEndDate()) + 1;
        assertThat(holdMax).isGreaterThan(0);
        assertThat(holdDays).isLessThanOrEqualTo(holdMax);

        // 2. Hội viên "chi" (SILVER, 0 lượt PT miễn phí) không được dùng package_quota/used_quota mà phải là PT trả phí
        List<CoachBooking> chiBookings = savedPts.stream()
                .filter(b -> "chi@demo.sol.vn".equalsIgnoreCase(b.getMember().getUser().getEmail()))
                .toList();
        assertThat(chiBookings).hasSize(1);
        assertThat(chiBookings.get(0).getPaymentMethod()).isEqualTo("cash");
        assertThat(chiBookings.get(0).getPaymentStatus()).isEqualTo("paid");

        // 3. Hội viên hạng GOLD/PLATINUM vẫn dùng package_quota/used_quota
        assertThat(savedPts.stream()
                .filter(b -> "an@demo.sol.vn".equalsIgnoreCase(b.getMember().getUser().getEmail()))
                .allMatch(b -> "package_quota".equals(b.getPaymentMethod()) && "used_quota".equals(b.getPaymentStatus())))
                .isTrue();
    }

    private static MembershipPackage pkg(String name, String tier, int days, String price) {
        MembershipPackage p = new MembershipPackage();
        p.setName(name);
        p.setTier(tier);
        p.setDurationDays(days);
        p.setPrice(new BigDecimal(price));
        return p;
    }
}
