package com.swp391.scms.demo;

import com.swp391.scms.attendance.entity.CenterCheckin;
import com.swp391.scms.attendance.entity.SessionAttendance;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.InvoiceItem;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.ReceptionistRepository;
import com.swp391.scms.users.RoleRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.Receptionist;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Optional demo dataset (accounts, subscriptions, payments, classes, attendance, PT bookings, progress logs) with
 * past and current records, so a panel can be shown a lived-in system. Off by default
 * ({@code app.demo.seed-enabled}); idempotent: skipped once the demo manager account exists.
 * Dates are relative to the day the seeder runs, so seed on a fresh database shortly before the demo.
 * Past rows use terminal statuses (completed / DENIED) because the database triggers only accept new "booked" or
 * GRANTED rows for members whose subscription is active today.
 */
@Component
@Order(200)
@ConditionalOnProperty(name = "app.demo.seed-enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    static final String DOMAIN = "@demo.sol.vn";
    static final String MANAGER_EMAIL = "manager" + DOMAIN;

    /** One member profile and the subscription story that goes with it. */
    private record MemberSpec(String key, String name, String gender, int age, String level, String goal,
                              String health, String pkg, String scenario, int joinedDaysAgo) {}

    private static final List<MemberSpec> MEMBERS = List.of(
            new MemberSpec("an", "Nguyễn Minh An", "male", 28, "advanced", "Tăng cơ, giảm mỡ", null,
                    "PLATINUM 3 THÁNG", "ACTIVE_LONG", 150),
            new MemberSpec("binh", "Trần Thu Bình", "female", 31, "intermediate", "Giảm cân, cải thiện sức bền", null,
                    "GOLD", "ACTIVE_MID", 75),
            new MemberSpec("chi", "Lê Khánh Chi", "female", 24, "beginner", "Làm quen với gym", null,
                    "SILVER", "ACTIVE_NEW", 5),
            new MemberSpec("dung", "Phạm Quốc Dũng", "male", 35, "intermediate", "Tăng sức bền", "Đau gối nhẹ",
                    "GOLD", "EXPIRED", 120),
            new MemberSpec("em", "Võ Ngọc Em", "female", 29, "beginner", "Yoga, thư giãn", null,
                    "SILVER", "FROZEN", 90),
            new MemberSpec("phuc", "Đặng Hoàng Phúc", "male", 22, "beginner", "Tăng cân lành mạnh", null,
                    "GOLD", "PENDING", 1),
            new MemberSpec("giang", "Bùi Hương Giang", "female", 33, "intermediate", "Boxing, giảm stress", null,
                    "GOLD", "RENEWED", 110),
            new MemberSpec("hieu", "Ngô Trung Hiếu", "male", 40, "advanced", "Duy trì thể lực", null,
                    "PLATINUM", "EXPIRING", 27),
            new MemberSpec("khoa", "Đỗ Anh Khoa", "male", 26, "beginner", "Bơi lội", null,
                    "SILVER", "CANCELLED", 60),
            new MemberSpec("lan", "Hồ Mỹ Lan", "female", 27, "beginner", "Chưa chọn gói", null,
                    null, "NO_PLAN", 2));

    private record CoachSpec(String key, String name, String gender, String specialization, String certification,
                             String bio, String discipline) {}

    private static final List<CoachSpec> COACHES = List.of(
            new CoachSpec("hung", "Trịnh Quang Hùng", "male", "Gym - Sức mạnh", "NSCA-CPT",
                    "8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.", "Gym"),
            new CoachSpec("mai", "Lý Thanh Mai", "female", "Yoga", "RYT-500",
                    "Giáo viên Yoga 6 năm kinh nghiệm, tập trung hơi thở, thăng bằng và phục hồi.", "Yoga"),
            new CoachSpec("long", "Phan Thành Long", "male", "Boxing", "AIBA Level 2",
                    "Cựu vận động viên Boxing, chuyên kỹ thuật đấm và thể lực theo hiệp.", "Boxing"),
            new CoachSpec("thao", "Vũ Phương Thảo", "female", "Bơi lội", "ASCA Level 2",
                    "Huấn luyện viên bơi 7 năm kinh nghiệm: kỹ thuật bơi và sức bền dưới nước.", "Bơi lội"));

    /** {@code fromDay}/{@code toDay}: window of sessions relative to the seed day; the class dates follow its sessions. */
    private record ClassSpec(String name, String coachKey, String room, String discipline, String level, int capacity,
                             Set<DayOfWeek> days, LocalTime start, LocalTime end, int price, int fromDay, int toDay) {
        ClassSpec(String name, String coachKey, String room, String discipline, String level, int capacity,
                  Set<DayOfWeek> days, LocalTime start, LocalTime end, int price) {
            this(name, coachKey, room, discipline, level, capacity, days, start, end, price, -28, 14);
        }
    }

    private static final List<ClassSpec> CLASSES = List.of(
            new ClassSpec("Strength Foundation", "hung", "Phòng Gym Tiêu chuẩn", "Gym", "all", 12,
                    Set.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(18, 0), LocalTime.of(19, 15), 0),
            new ClassSpec("Morning Flow Yoga", "mai", "Zen Garden Studio", "Yoga", "beginner", 10,
                    Set.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY), LocalTime.of(18, 0), LocalTime.of(19, 0), 0),
            new ClassSpec("Boxing Cardio Rounds", "long", "Phòng Gym VIP", "Boxing", "intermediate", 8,
                    Set.of(DayOfWeek.SATURDAY), LocalTime.of(9, 0), LocalTime.of(10, 15), 0),
            new ClassSpec("Aqua Technique", "thao", "Oasis Lap Pool", "Bơi lội", "all", 8,
                    Set.of(DayOfWeek.FRIDAY), LocalTime.of(17, 0), LocalTime.of(18, 0), 0),
            // Not started yet, so members can try enrolling in a whole course.
            new ClassSpec("Yoga Cơ Bản (khóa mới)", "mai", "Zen Garden Studio", "Yoga", "beginner", 12,
                    Set.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY), LocalTime.of(7, 0), LocalTime.of(8, 0), 0, 7, 34));

    private final UserRepository users;
    private final RoleRepository roles;
    private final MemberRepository members;
    private final CoachRepository coaches;
    private final ReceptionistRepository receptionists;
    private final MembershipPackageRepository packages;
    private final MembershipSubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final DisciplineRepository disciplines;
    private final RoomRepository rooms;
    private final GymClassRepository classes;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final SessionAttendanceRepository attendance;
    private final CenterCheckinRepository checkins;
    private final CoachBookingRepository coachBookings;
    private final MemberProgressLogRepository progressLogs;
    private final PasswordEncoder passwordEncoder;
    private final String demoPassword;

    public DemoDataSeeder(UserRepository users, RoleRepository roles, MemberRepository members,
                          CoachRepository coaches, ReceptionistRepository receptionists,
                          MembershipPackageRepository packages, MembershipSubscriptionRepository subscriptions,
                          PaymentRepository payments, DisciplineRepository disciplines, RoomRepository rooms,
                          GymClassRepository classes, ClassSessionRepository sessions,
                          ClassEnrollmentRepository enrollments, SessionAttendanceRepository attendance,
                          CenterCheckinRepository checkins, CoachBookingRepository coachBookings,
                          MemberProgressLogRepository progressLogs, PasswordEncoder passwordEncoder,
                          @Value("${app.demo.password:Demo@12345}") String demoPassword) {
        this.users = users;
        this.roles = roles;
        this.members = members;
        this.coaches = coaches;
        this.receptionists = receptionists;
        this.packages = packages;
        this.subscriptions = subscriptions;
        this.payments = payments;
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.classes = classes;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.attendance = attendance;
        this.checkins = checkins;
        this.coachBookings = coachBookings;
        this.progressLogs = progressLogs;
        this.passwordEncoder = passwordEncoder;
        this.demoPassword = demoPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.findByEmailIgnoreCase(MANAGER_EMAIL).isPresent()) {
            log.info("Demo data already present; skipping seed.");
            return;
        }
        LocalDate today = LocalDate.now(ZONE);
        String hash = passwordEncoder.encode(demoPassword);

        User manager = createStaff("CENTER_MANAGER", "manager", "Nguyễn Hoàng Quản Lý", "male", hash, today);
        User reception = createStaff("RECEPTIONIST", "letan", "Trần Bảo Ngọc", "female", hash, today);

        Map<String, Coach> coachByKey = new HashMap<>();
        for (CoachSpec spec : COACHES) {
            coachByKey.put(spec.key(), createCoach(spec, hash, today));
        }

        Map<String, Member> memberByKey = new HashMap<>();
        Map<String, MembershipSubscription> currentSub = new HashMap<>();
        for (MemberSpec spec : MEMBERS) {
            Member member = createMember(spec, hash, today);
            memberByKey.put(spec.key(), member);
            MembershipSubscription sub = createSubscriptions(spec, member, reception, today);
            if (sub != null) {
                currentSub.put(spec.key(), sub);
            }
        }

        List<String> activeKeys = List.of("an", "binh", "chi", "hieu", "giang");
        Map<String, List<ClassSession>> sessionsByClass = createClasses(manager, coachByKey, today);
        enroll(sessionsByClass, memberByKey, activeKeys, coachByKey, today);
        createCheckins(memberByKey, reception, today);
        createPtBookings(memberByKey, coachByKey, today);
        createProgress(memberByKey, coachByKey, today);
        log.info("Demo data seeded: 1 manager, 1 receptionist, {} coaches, {} members. Password from app.demo.password.",
                COACHES.size(), MEMBERS.size());
    }

    // ---- accounts -------------------------------------------------------------------------------------------

    private User newUser(String role, String key, String name, String gender, String hash, LocalDate today, int age,
                         int createdDaysAgo) {
        User user = new User();
        user.setRole(roles.findByCode(role).orElseThrow());
        user.setFullName(name);
        user.setEmail(key + DOMAIN);
        user.setPasswordHash(hash);
        user.setGender(gender);
        user.setDob(today.minusYears(age).minusDays(40));
        user.setPhone("09" + String.format("%08d", Math.abs((key + role).hashCode()) % 100_000_000));
        user.setAddress("Quận 1, TP. Hồ Chí Minh");
        user.setStatus("active");
        LocalDateTime now = LocalDateTime.now(ZONE);
        user.setCreatedAt(now.minusDays(createdDaysAgo));
        user.setUpdatedAt(now);
        user.setLastLoginAt(now.minusDays(1));
        return users.save(user);
    }

    private User createStaff(String role, String key, String name, String gender, String hash, LocalDate today) {
        User user = newUser(role, key, name, gender, hash, today, 34, 400);
        if ("RECEPTIONIST".equals(role)) {
            Receptionist receptionist = new Receptionist();
            receptionist.setUser(user);
            receptionist.setHireDate(today.minusYears(2));
            receptionist.setShift("Ca sáng 06:00 - 14:00");
            receptionist.setEmploymentStatus("active");
            receptionists.save(receptionist);
        }
        return user;
    }

    private Coach createCoach(CoachSpec spec, String hash, LocalDate today) {
        User user = newUser("COACH", spec.key(), spec.name(), spec.gender(), hash, today, 32, 400);
        Coach coach = new Coach();
        coach.setUser(user);
        coach.setSpecialization(spec.specialization());
        coach.setCertification(spec.certification());
        coach.setBio(spec.bio());
        coach.setHireDate(today.minusYears(2));
        coach.setEmploymentStatus("active");
        return coaches.save(coach);
    }

    private Member createMember(MemberSpec spec, String hash, LocalDate today) {
        User user = newUser("MEMBER", spec.key(), spec.name(), spec.gender(), hash, today, spec.age(),
                spec.joinedDaysAgo());
        Member member = new Member();
        member.setUser(user);
        member.setMembershipCode("DEMO-" + user.getId());
        member.setJoinDate(today.minusDays(spec.joinedDaysAgo()));
        member.setFitnessGoal(spec.goal());
        member.setFitnessLevel(spec.level());
        member.setHealthNotes(spec.health());
        member.setEmergencyContactName("Người thân của " + spec.name());
        member.setEmergencyContactPhone("0900000000");
        member.setPaymentRealtimeTopic(UUID.randomUUID());
        boolean verified = !"NO_PLAN".equals(spec.scenario()) && !"PENDING".equals(spec.scenario());
        member.setIdentityVerified(verified);
        member.setKycStatus(verified ? "APPROVED" : "PENDING");
        member.setKycSubmittedAt(LocalDateTime.now(ZONE).minusDays(Math.max(1, spec.joinedDaysAgo())));
        if (verified) {
            member.setKycReviewedAt(member.getKycSubmittedAt().plusHours(3));
            member.setIdentityVerifiedAt(member.getKycReviewedAt());
        }
        return members.save(member);
    }

    // ---- subscriptions & payments ---------------------------------------------------------------------------

    private MembershipSubscription createSubscriptions(MemberSpec spec, Member member, User receptionist,
                                                       LocalDate today) {
        if (spec.pkg() == null) {
            return null;
        }
        MembershipPackage pkg = findPackage(spec.pkg());
        int days = pkg.getDurationDays();
        return switch (spec.scenario()) {
            // 3 months bought 40 days ago -> a Gold month before it (history), a long active run now.
            case "ACTIVE_LONG" -> {
                MembershipPackage first = findPackage("GOLD");
                MembershipSubscription old = subscribe(member, first, today.minusDays(120), today.minusDays(91),
                        "expired", null, receptionist, "cash");
                yield subscribe(member, pkg, today.minusDays(40), today.minusDays(40).plusDays(days - 1L),
                        "active", old, receptionist, "bank_transfer");
            }
            case "ACTIVE_MID" -> subscribe(member, pkg, today.minusDays(12), today.minusDays(12).plusDays(days - 1L),
                    "active", null, receptionist, "pos");
            case "ACTIVE_NEW" -> subscribe(member, pkg, today.minusDays(5), today.minusDays(5).plusDays(days - 1L),
                    "active", null, receptionist, "online_wallet");
            case "EXPIRED" -> subscribe(member, pkg, today.minusDays(52), today.minusDays(52).plusDays(days - 1L),
                    "expired", null, receptionist, "cash");
            case "FROZEN" -> {
                MembershipSubscription sub = subscribe(member, pkg, today.minusDays(18),
                        today.minusDays(18).plusDays(days - 1L + 14), "frozen", null, receptionist, "cash");
                sub.setHoldStatus("APPROVED");
                sub.setHoldReason("Đi công tác xa hai tuần");
                sub.setHoldRequestedAt(LocalDateTime.now(ZONE).minusDays(8));
                sub.setHoldResolvedAt(LocalDateTime.now(ZONE).minusDays(7));
                sub.setHoldResolvedBy(receptionist);
                sub.setHoldStartDate(today.minusDays(7));
                sub.setHoldEndDate(today.plusDays(7));
                sub.setHoldUsed(true);
                yield subscriptions.save(sub);
            }
            case "PENDING" -> {
                MembershipSubscription sub = newSubscription(member, pkg, today, today.plusDays(days - 1L),
                        "pending_payment", null, receptionist);
                yield subscriptions.save(sub);
            }
            // Expired Silver month then renewed into Gold: shows the renewal chain.
            case "RENEWED" -> {
                MembershipPackage first = findPackage("SILVER");
                MembershipSubscription old = subscribe(member, first, today.minusDays(50), today.minusDays(21),
                        "expired", null, receptionist, "cash");
                yield subscribe(member, pkg, today.minusDays(20), today.minusDays(20).plusDays(days - 1L),
                        "active", old, receptionist, "pos");
            }
            case "EXPIRING" -> subscribe(member, pkg, today.minusDays(27), today.plusDays(3),
                    "active", null, receptionist, "bank_transfer");
            case "CANCELLED" -> {
                MembershipSubscription sub = newSubscription(member, pkg, today.minusDays(45),
                        today.minusDays(45).plusDays(days - 1L), "cancelled", null, receptionist);
                yield subscriptions.save(sub);
            }
            default -> null;
        };
    }

    private MembershipSubscription newSubscription(Member member, MembershipPackage pkg, LocalDate start,
                                                   LocalDate end, String status, MembershipSubscription previous,
                                                   User createdBy) {
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMember(member);
        sub.setMembershipPackage(pkg);
        sub.setPreviousSubscription(previous);
        sub.setStartDate(start);
        sub.setEndDate(end);
        sub.setStatus(status);
        sub.setQuotedPrice(pkg.getPrice());
        sub.setQrCode(UUID.randomUUID().toString());
        sub.setCreatedBy(createdBy);
        sub.setCreatedAt(start.atTime(9, 0));
        sub.setUpdatedAt(start.atTime(9, 0));
        return sub;
    }

    /** Saves a paid subscription together with its payment and invoice. */
    private MembershipSubscription subscribe(Member member, MembershipPackage pkg, LocalDate start, LocalDate end,
                                             String status, MembershipSubscription previous, User receptionist,
                                             String method) {
        MembershipSubscription sub = subscriptions.save(
                newSubscription(member, pkg, start, end, status, previous, receptionist));
        Payment payment = new Payment();
        payment.setMember(member);
        payment.setSubscriptionId(sub.getId());
        payment.setAmount(pkg.getPrice());
        payment.setMethod(method);
        payment.setStatus("success");
        payment.setPaidAt(start.atTime(9, 15));
        payment.setCreatedAt(start.atTime(9, 10));
        payment.setReceivedBy(receptionist);
        payment.setNote("Đăng ký gói " + pkg.getName());
        Invoice invoice = new Invoice();
        invoice.setPayment(payment);
        invoice.setInvoiceNumber("INV-DEMO-" + sub.getId());
        invoice.setIssuedAt(start.atTime(9, 16));
        invoice.setSubtotalAmount(pkg.getPrice());
        invoice.setTaxAmount(BigDecimal.ZERO);
        invoice.setCreatedAt(start.atTime(9, 16));
        invoice.addItem(new InvoiceItem("Gói " + pkg.getName(), 1, pkg.getPrice()));
        payment.setInvoice(invoice);
        payments.save(payment);
        return sub;
    }

    private MembershipPackage findPackage(String name) {
        return packages.findAllByOrderByPriceAsc().stream()
                .filter(p -> name.equalsIgnoreCase(p.getName())).findFirst()
                .orElseThrow(() -> new IllegalStateException("Demo seed needs package '" + name + "' (CatalogSeeder)"));
    }

    // ---- classes, sessions, course enrollments, attendance ------------------------------------------------------------

    private Map<String, List<ClassSession>> createClasses(User manager, Map<String, Coach> coachByKey,
                                                          LocalDate today) {
        Map<String, List<ClassSession>> result = new HashMap<>();
        Map<String, Room> roomByName = new HashMap<>();
        rooms.findAllByOrderByNameAsc().forEach(r -> roomByName.put(r.getName(), r));
        Map<String, Discipline> disciplineByName = new HashMap<>();
        disciplines.findAll().forEach(d -> disciplineByName.put(d.getName(), d));

        for (ClassSpec spec : CLASSES) {
            Room room = roomByName.get(spec.room());
            Discipline discipline = disciplineByName.get(spec.discipline());
            if (room == null || discipline == null) {
                log.warn("Demo seed: skip class '{}' (missing room or discipline)", spec.name());
                continue;
            }
            GymClass gymClass = new GymClass();
            gymClass.setName(spec.name());
            gymClass.setDiscipline(discipline);
            gymClass.setCoach(coachByKey.get(spec.coachKey()));
            gymClass.setRoom(room);
            gymClass.setCapacity(spec.capacity());
            gymClass.setLevel(spec.level());
            gymClass.setDescription("Lớp " + spec.name() + " do huấn luyện viên " + spec.coachKey() + " phụ trách.");
            gymClass.setStatus("active");
            gymClass.setPrice(BigDecimal.valueOf(spec.price()));
            List<LocalDate> dates = new ArrayList<>();
            for (LocalDate d = today.plusDays(spec.fromDay()); !d.isAfter(today.plusDays(spec.toDay())); d = d.plusDays(1)) {
                if (spec.days().contains(d.getDayOfWeek())) {
                    dates.add(d);
                }
            }
            if (dates.isEmpty()) {
                continue;
            }
            // The course runs exactly from its first to its last session: enrolment checks membership against these.
            gymClass.setStartDate(dates.get(0));
            gymClass.setEndDate(dates.get(dates.size() - 1));
            gymClass.setRecurringDays(String.join(",", spec.days().stream().map(DayOfWeek::name).toList()));
            gymClass.setStartTime(spec.start());
            gymClass.setEndTime(spec.end());
            gymClass.setCreatedBy(manager);
            gymClass = classes.save(gymClass);

            List<ClassSession> created = new ArrayList<>();
            for (LocalDate d : dates) {
                ClassSession session = new ClassSession();
                session.setGymClass(gymClass);
                session.setSessionDate(d);
                session.setStartTime(spec.start());
                session.setEndTime(spec.end());
                session.setStatus(d.isBefore(today) ? "completed" : "scheduled");
                created.add(sessions.save(session));
            }
            result.put(spec.name(), created);
        }
        return result;
    }

    private void enroll(Map<String, List<ClassSession>> sessionsByClass, Map<String, Member> memberByKey,
                        List<String> activeKeys, Map<String, Coach> coachByKey, LocalDate today) {
        // member key -> classes they follow
        Map<String, List<String>> plan = Map.of(
                "an", List.of("Strength Foundation", "Boxing Cardio Rounds"),
                "binh", List.of("Morning Flow Yoga", "Aqua Technique"),
                "chi", List.of("Morning Flow Yoga"),
                "hieu", List.of("Strength Foundation"),
                "giang", List.of("Boxing Cardio Rounds", "Morning Flow Yoga"));
        Map<String, String> coachOfClass = new HashMap<>();
        CLASSES.forEach(c -> coachOfClass.put(c.name(), c.coachKey()));

        for (String key : activeKeys) {
            Member member = memberByKey.get(key);
            for (String className : plan.getOrDefault(key, List.of())) {
                List<ClassSession> courseSessions = sessionsByClass.getOrDefault(className, List.of());
                if (courseSessions.isEmpty()) {
                    continue;
                }
                // Classes are recurring courses: a member enrols in the whole course, never in a single session.
                GymClass course = courseSessions.get(0).getGymClass();
                boolean hasUpcoming = courseSessions.stream().anyMatch(s -> !s.getSessionDate().isBefore(today));
                LocalDate firstDay = courseSessions.get(0).getSessionDate();
                LocalDate enrolledOn = firstDay.minusDays(3).isBefore(member.getJoinDate())
                        ? member.getJoinDate() : firstDay.minusDays(3);
                ClassEnrollment enrollment = new ClassEnrollment();
                enrollment.setGymClass(course);
                enrollment.setMember(member);
                enrollment.setStatus(hasUpcoming ? "booked" : "completed");
                enrollment.setEnrolledAt(enrolledOn.atTime(10, 0));
                enrollments.save(enrollment);

                int index = 0;
                for (ClassSession session : courseSessions) {
                    // A newer member (joined recently) has no earlier history.
                    if (session.getSessionDate().isBefore(member.getJoinDate())) {
                        continue;
                    }
                    if (session.getSessionDate().isBefore(today)) {
                        markAttendance(session, member, coachByKey.get(coachOfClass.get(className)), index++);
                    }
                }
            }
        }
    }

    /** Mostly present, with the occasional late or absent so the attendance report has variety. */
    private void markAttendance(ClassSession session, Member member, Coach coach, int index) {
        String status = index % 7 == 5 ? "absent" : index % 5 == 3 ? "late" : "present";
        SessionAttendance record = new SessionAttendance();
        record.setSession(session);
        record.setMember(member);
        record.setStatus(status);
        record.setRecordedBy(coach);
        if (!"absent".equals(status)) {
            LocalDateTime start = session.getSessionDate().atTime(session.getStartTime());
            record.setCheckedInAt("late".equals(status) ? start.plusMinutes(12) : start.minusMinutes(5));
        } else {
            record.setNotes("Vắng không báo trước");
        }
        attendance.save(record);
    }

    // ---- center check-ins -----------------------------------------------------------------------------------

    private void createCheckins(Map<String, Member> memberByKey, User receptionist, LocalDate today) {
        // key -> visits over the last N days (every 'step' days) for members whose plan is currently valid
        Map<String, int[]> visits = Map.of("an", new int[]{35, 1}, "binh", new int[]{12, 2},
                "chi", new int[]{5, 2}, "hieu", new int[]{26, 2}, "giang", new int[]{29, 2});
        visits.forEach((key, cfg) -> {
            Member member = memberByKey.get(key);
            for (int back = cfg[0]; back >= 0; back -= cfg[1]) {
                LocalDate day = today.minusDays(back);
                if (back == 0 && LocalTime.now(ZONE).isBefore(LocalTime.of(8, 0))) {
                    continue;
                }
                CenterCheckin checkin = new CenterCheckin();
                checkin.setMember(member);
                LocalDateTime in = day.atTime(back % 2 == 0 ? 6 : 17, 30 + back % 25);
                checkin.setCheckInTime(in);
                checkin.setCheckOutTime(back == 0 ? null : in.plusMinutes(75 + back % 40));
                checkin.setMethod(back % 6 == 0 ? "manual" : "qr");
                checkin.setRecordedBy("manual".equals(checkin.getMethod()) ? receptionist : null);
                checkin.setGate("Cổng chính");
                checkin.setStatus("GRANTED");
                checkins.save(checkin);
            }
        });
        // Expired member turned away at the gate: shows the denial flow.
        Member expired = memberByKey.get("dung");
        for (int back : new int[]{15, 9, 3}) {
            CenterCheckin denied = new CenterCheckin();
            denied.setMember(expired);
            denied.setCheckInTime(today.minusDays(back).atTime(18, 5));
            denied.setMethod("qr");
            denied.setGate("Cổng chính");
            denied.setStatus("DENIED");
            denied.setDenialReason("Gói thành viên đã hết hạn");
            checkins.save(denied);
        }
    }

    // ---- PT bookings ----------------------------------------------------------------------------------------

    private void createPtBookings(Map<String, Member> memberByKey, Map<String, Coach> coachByKey, LocalDate today) {
        Map<String, Discipline> disciplineByName = new HashMap<>();
        disciplines.findAll().forEach(d -> disciplineByName.put(d.getName(), d));
        // member, coach, days offset (negative = past), hour
        Object[][] rows = {
                {"an", "hung", -30, 7}, {"an", "hung", -23, 7}, {"an", "hung", -16, 7}, {"an", "hung", -9, 7},
                {"an", "hung", -2, 7}, {"an", "hung", 3, 7}, {"an", "hung", 10, 7},
                {"binh", "mai", -6, 10}, {"binh", "mai", 4, 10},
                {"giang", "long", -14, 11}, {"giang", "long", -7, 11}, {"giang", "long", 5, 11},
                {"hieu", "hung", -10, 9}, {"hieu", "hung", 2, 9},
                {"chi", "mai", 6, 10}};
        for (Object[] row : rows) {
            Member member = memberByKey.get((String) row[0]);
            Coach coach = coachByKey.get((String) row[1]);
            int offset = (Integer) row[2];
            LocalDate date = today.plusDays(offset);
            if (date.isBefore(member.getJoinDate())) {
                continue;
            }
            CoachBooking booking = new CoachBooking();
            booking.setMember(member);
            booking.setCoach(coach);
            booking.setDiscipline(disciplineByName.get(coachDiscipline((String) row[1])));
            booking.setBookingDate(date);
            booking.setStartTime(LocalTime.of((Integer) row[3], 0));
            booking.setEndTime(LocalTime.of((Integer) row[3] + 1, 0));
            booking.setHourlyRate(new BigDecimal("200000.00"));
            booking.setPaymentMethod("package_quota");
            booking.setPaymentStatus("used_quota");
            booking.setCreatedAt(date.minusDays(4).atTime(20, 0));
            if (offset < 0) {
                booking.setStatus("completed");
                booking.setAttendedAt(date.atTime((Integer) row[3], 2));
                booking.setNotes("Buổi PT 1:1 đã hoàn thành");
            } else {
                booking.setStatus("confirmed");
                booking.setNotes("Buổi PT 1:1 sắp tới");
            }
            coachBookings.save(booking);
        }
    }

    private String coachDiscipline(String coachKey) {
        return COACHES.stream().filter(c -> c.key().equals(coachKey)).findFirst().orElseThrow().discipline();
    }

    // ---- progress -------------------------------------------------------------------------------------------

    private void createProgress(Map<String, Member> memberByKey, Map<String, Coach> coachByKey, LocalDate today) {
        // key -> {start weight, monthly delta, start body fat, monthly fat delta, height cm, coach}
        Object[][] rows = {
                {"an", 82.0, -1.2, 22.0, -0.9, 176, "hung"},
                {"binh", 70.0, -1.5, 31.0, -1.1, 162, "mai"},
                {"giang", 64.0, -0.8, 28.0, -0.7, 160, "long"},
                {"hieu", 78.0, -0.5, 24.0, -0.4, 172, "hung"}};
        for (Object[] row : rows) {
            Member member = memberByKey.get((String) row[0]);
            User recordedBy = coachByKey.get((String) row[6]).getUser();
            for (int month = 0; month < 4; month++) {
                LocalDateTime at = today.minusDays(90L - month * 30L).atTime(9, 0);
                double weight = (Double) row[1] + (Double) row[2] * month;
                double fat = (Double) row[3] + (Double) row[4] * month;
                double heightM = ((Integer) row[5]) / 100.0;
                addMetric(member, recordedBy, at, "weight", weight, "kg");
                addMetric(member, recordedBy, at, "body_fat", fat, "%");
                addMetric(member, recordedBy, at, "bmi", weight / (heightM * heightM), "kg/m2");
                if (month == 0) {
                    addMetric(member, recordedBy, at, "height", ((Integer) row[5]).doubleValue(), "cm");
                }
            }
        }
    }

    private void addMetric(Member member, User recordedBy, LocalDateTime at, String metric, double value, String unit) {
        MemberProgressLog entry = new MemberProgressLog();
        entry.setMember(member);
        entry.setRecordedBy(recordedBy);
        entry.setRecordedAt(at);
        entry.setMetricName(metric);
        entry.setMetricValue(BigDecimal.valueOf(Math.round(value * 10) / 10.0));
        entry.setUnit(unit);
        progressLogs.save(entry);
    }
}
