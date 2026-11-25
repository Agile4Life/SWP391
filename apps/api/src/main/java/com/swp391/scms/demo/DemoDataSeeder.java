package com.swp391.scms.demo;

import com.swp391.scms.attendance.entity.CenterCheckin;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.finance.entity.Invoice;
import com.swp391.scms.finance.entity.InvoiceItem;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.health.MemberProgressLogRepository;
import com.swp391.scms.health.entity.MemberProgressLog;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
 * Bộ dữ liệu demo tùy chọn (tài khoản quản lý, lễ tân, HLV, hội viên với nhiều tình huống gói tập, thanh toán,
 * hóa đơn, check-in, buổi PT và số đo cơ thể) gồm bản ghi quá khứ và hiện tại, để hội đồng thấy một hệ thống
 * đã được vận hành. Mặc định tắt ({@code app.demo.seed-enabled}); mang tính idempotent: tự bỏ qua khi tài khoản
 * quản lý demo đã tồn tại. Ngày tháng tính tương đối theo ngày chạy seeder, nên hãy seed trên database mới ngay
 * trước buổi demo. Các dòng quá khứ dùng trạng thái cuối (completed / DENIED) vì trigger database chỉ nhận dòng
 * "booked" hoặc GRANTED mới cho hội viên có subscription còn hiệu lực hôm nay.
 */
@Component
@Order(200)
@ConditionalOnProperty(name = "app.demo.seed-enabled", havingValue = "true")
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    static final String DOMAIN = "@demo.sol.vn";
    static final String MANAGER_EMAIL = "manager" + DOMAIN;

    /**
     * Hồ sơ một hội viên demo và tình huống gói tập của họ.
     *
     * Một hồ sơ hội viên cùng câu chuyện subscription đi kèm.
     */
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
            new MemberSpec("em", "Võ Ngọc Em", "female", 29, "beginner", "Cải thiện sức khỏe", null,
                    "SILVER", "FROZEN", 90),
            new MemberSpec("phuc", "Đặng Hoàng Phúc", "male", 22, "beginner", "Tăng cân lành mạnh", null,
                    "GOLD", "PENDING", 1),
            new MemberSpec("giang", "Bùi Hương Giang", "female", 33, "intermediate", "Tăng thể lực, giảm stress", null,
                    "GOLD", "RENEWED", 110),
            new MemberSpec("hieu", "Ngô Trung Hiếu", "male", 40, "advanced", "Duy trì thể lực", null,
                    "PLATINUM", "EXPIRING", 27),
            new MemberSpec("khoa", "Đỗ Anh Khoa", "male", 26, "beginner", "Cải thiện sức bền", null,
                    "SILVER", "CANCELLED", 60),
            new MemberSpec("lan", "Hồ Mỹ Lan", "female", 27, "beginner", "Chưa chọn gói", null,
                    null, "NO_PLAN", 2));

    /** Hồ sơ một HLV demo. */
    private record CoachSpec(String key, String name, String gender, String specialization, String certification,
                             String bio, String discipline) {}

    private static final List<CoachSpec> COACHES = List.of(
            new CoachSpec("hung", "Trịnh Quang Hùng", "male", "Gym - Sức mạnh", "NSCA-CPT",
                    "8 năm huấn luyện sức mạnh, tăng cơ và giảm mỡ cho hội viên mọi trình độ.", "Gym"),
            new CoachSpec("mai", "Lý Thanh Mai", "female", "Yoga", "RYT-500",
                    "Giáo viên Yoga 6 năm kinh nghiệm, tập trung hơi thở, thăng bằng và phục hồi.", "Yoga"),
            new CoachSpec("long", "Phan Thành Long", "male", "Boxing", "AIBA Level 2",
                    "Cựu vận động viên Boxing, chuyên kỹ thuật đấm, di chuyển chân và thể lực.", "Boxing"),
            new CoachSpec("thao", "Vũ Phương Thảo", "female", "Yoga & Phục hồi", "RYT-200",
                    "Huấn luyện viên Yoga & Phục hồi 7 năm kinh nghiệm: hơi thở, giãn cơ và phục hồi thể lực.", "Yoga"));

    private final UserRepository users;
    private final RoleRepository roles;
    private final MemberRepository members;
    private final CoachRepository coaches;
    private final ReceptionistRepository receptionists;
    private final MembershipPackageRepository packages;
    private final MembershipSubscriptionRepository subscriptions;
    private final PaymentRepository payments;
    private final DisciplineRepository disciplines;
    private final CenterCheckinRepository checkins;
    private final CoachBookingRepository coachBookings;
    private final MemberProgressLogRepository progressLogs;
    private final PasswordEncoder passwordEncoder;
    private final String demoPassword;

    /** Nhận các repository, bộ mã hóa mật khẩu và mật khẩu chung của tài khoản demo (app.demo.password). */
    public DemoDataSeeder(UserRepository users, RoleRepository roles, MemberRepository members,
                          CoachRepository coaches, ReceptionistRepository receptionists,
                          MembershipPackageRepository packages, MembershipSubscriptionRepository subscriptions,
                          PaymentRepository payments, DisciplineRepository disciplines,
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
        this.checkins = checkins;
        this.coachBookings = coachBookings;
        this.progressLogs = progressLogs;
        this.passwordEncoder = passwordEncoder;
        this.demoPassword = demoPassword;
    }

    /**
     * Tạo toàn bộ dữ liệu demo theo thứ tự: nhân viên, HLV, hội viên kèm gói tập, check-in, buổi PT, số đo; bỏ
     * qua nếu đã có dữ liệu demo.
     */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (users.findByEmailIgnoreCase(MANAGER_EMAIL).isPresent()) {
            syncRetiredDemoCoaches();
            if (coachBookings.count() == 0) {
                reseedDemoPtBookings(LocalDate.now(ZONE));
            }
            log.info("Demo data already present; skipping seed.");
            return;
        }
        LocalDate today = LocalDate.now(ZONE);
        String hash = passwordEncoder.encode(demoPassword);

        createStaff("CENTER_MANAGER", "manager", "Nguyễn Hoàng Quản Lý", "male", hash, today);
        User reception = createStaff("RECEPTIONIST", "letan", "Trần Bảo Ngọc", "female", hash, today);

        Map<String, Coach> coachByKey = new HashMap<>();
        for (CoachSpec spec : COACHES) {
            coachByKey.put(spec.key(), createCoach(spec, hash, today));
        }

        Map<String, Member> memberByKey = new HashMap<>();
        for (MemberSpec spec : MEMBERS) {
            Member member = createMember(spec, hash, today);
            memberByKey.put(spec.key(), member);
            createSubscriptions(spec, member, reception, today);
        }

        createCheckins(memberByKey, reception, today);
        createPtBookings(memberByKey, coachByKey, today);
        createProgress(memberByKey, coachByKey, today);
        log.info("Demo data seeded: 1 manager, 1 receptionist, {} coaches, {} members. Password from app.demo.password.",
                COACHES.size(), MEMBERS.size());
    }

    /** Đồng bộ chuyên môn các HLV demo cũ nếu CSDL còn chứa bộ môn đã ngừng (Tennis, Bơi lội, Cầu lông). */
    private void syncRetiredDemoCoaches() {
        for (CoachSpec spec : COACHES) {
            if (!"long".equals(spec.key()) && !"thao".equals(spec.key())) {
                continue;
            }
            users.findByEmailIgnoreCase(spec.key() + DOMAIN)
                    .flatMap(u -> coaches.findById(u.getId()))
                    .ifPresent(coach -> {
                        String currentSpec = coach.getSpecialization();
                        String currentBio = coach.getBio();
                        if (com.swp391.scms.facilities.RetiredCatalogCleanupRunner.containsRetiredSport(currentSpec)
                                || com.swp391.scms.facilities.RetiredCatalogCleanupRunner.containsRetiredSport(currentBio)) {
                            coach.setSpecialization(spec.specialization());
                            if ("ASCA Level 2".equalsIgnoreCase(coach.getCertification())) {
                                coach.setCertification(spec.certification());
                            }
                            if (com.swp391.scms.facilities.RetiredCatalogCleanupRunner.containsRetiredSport(currentBio)) {
                                coach.setBio(spec.bio());
                            }
                            coaches.save(coach);
                        }
                    });
        }
    }

    // ---- tài khoản ------------------------------------------------------------------------------------------

    /**
     * Tạo tài khoản demo với email <key>@demo.sol.vn, SĐT sinh từ khóa, ngày sinh theo tuổi, ngày tạo lùi về
     * quá khứ và đã đăng nhập hôm qua.
     */
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

    /** Tạo tài khoản nhân viên; lễ tân có thêm hồ sơ ca sáng. */
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

    /** Tạo tài khoản HLV kèm hồ sơ chuyên môn, chứng chỉ và giới thiệu. */
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

    /**
     * Tạo hội viên kèm hồ sơ (mã DEMO-<id>, mục tiêu, trình độ, sức khỏe, liên hệ khẩn cấp); hội viên chưa có
     * gói hoặc chờ thanh toán thì KYC đang chờ duyệt, còn lại đã duyệt.
     */
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

    // ---- gói hội viên & thanh toán --------------------------------------------------------------------------

    /**
     * Tạo các kỳ gói theo tình huống của hội viên (đang tập lâu, mới đăng ký, hết hạn, đang bảo lưu, chờ thanh
     * toán, đã gia hạn, sắp hết hạn, đã hủy).
     */
    private MembershipSubscription createSubscriptions(MemberSpec spec, Member member, User receptionist,
                                                       LocalDate today) {
        if (spec.pkg() == null) {
            return null;
        }
        MembershipPackage pkg = findPackage(spec.pkg());
        int days = pkg.getDurationDays();
        return switch (spec.scenario()) {
            // Gói 3 tháng mua 40 ngày trước -> có một tháng Gold trước đó (lịch sử), hiện đang chạy kỳ dài hạn.
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
            // Tháng Silver đã hết hạn rồi gia hạn lên Gold: minh họa chuỗi gia hạn.
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

    /** Tạo đối tượng kỳ gói (chưa lưu) với giá chốt bằng giá gói và mã QR ngẫu nhiên. */
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

    /**
     * Lưu kỳ gói đã trả tiền kèm khoản thanh toán thành công và hóa đơn.
     *
     * Lưu subscription đã thanh toán cùng khoản thanh toán và hóa đơn của nó.
     */
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

    /** Tìm gói theo tên; thiếu gói (chưa chạy CatalogSeeder) thì báo lỗi. */
    private MembershipPackage findPackage(String name) {
        return packages.findAllByOrderByPriceAsc().stream()
                .filter(p -> name.equalsIgnoreCase(p.getName())).findFirst()
                .orElseThrow(() -> new IllegalStateException("Demo seed needs package '" + name + "' (CatalogSeeder)"));
    }

    // ---- check-in trung tâm ----------------------------------------------------------------------------------

    /**
     * Tạo lịch sử check-in cho các hội viên đang có gói (cách ngày đều đặn), và vài lượt bị từ chối của hội
     * viên hết hạn để minh họa luồng từ chối.
     */
    private void createCheckins(Map<String, Member> memberByKey, User receptionist, LocalDate today) {
        // key -> số lượt vào trong N ngày gần nhất (cách mỗi 'step' ngày) cho hội viên có gói đang hiệu lực.
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
        // Hội viên hết hạn bị từ chối ở cổng: minh họa luồng từ chối.
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

    // ---- buổi đặt PT -----------------------------------------------------------------------------------------

    /** Tải lại HLV/hội viên demo hiện có để seed lại các buổi PT 1:1 theo 5 slot cố định sau khi dọn lịch cũ. */
    private void reseedDemoPtBookings(LocalDate today) {
        Map<String, Coach> coachByKey = new HashMap<>();
        for (CoachSpec spec : COACHES) {
            users.findByEmailIgnoreCase(spec.key() + DOMAIN)
                    .flatMap(u -> coaches.findById(u.getId()))
                    .ifPresent(c -> coachByKey.put(spec.key(), c));
        }
        Map<String, Member> memberByKey = new HashMap<>();
        for (MemberSpec spec : MEMBERS) {
            users.findByEmailIgnoreCase(spec.key() + DOMAIN)
                    .flatMap(u -> members.findById(u.getId()))
                    .ifPresent(m -> memberByKey.put(spec.key(), m));
        }
        createPtBookings(memberByKey, coachByKey, today);
        log.info("Demo PT bookings reseeded with canonical 5-slot schedule.");
    }

    /** Tạo buổi PT 1:1 quá khứ (đã hoàn thành) và sắp tới (đã xác nhận) dùng đúng 5 slot cố định, không trùng lớp nhóm. */
    private void createPtBookings(Map<String, Member> memberByKey, Map<String, Coach> coachByKey, LocalDate today) {
        Map<String, Discipline> disciplineByName = new HashMap<>();
        disciplines.findAll().forEach(d -> disciplineByName.put(d.getName(), d));
        // hội viên, HLV, độ lệch ngày (âm = quá khứ), slot cố định (tránh trùng Slot 1 Gym / Slot 2 Yoga / Slot 5 Boxing của HLV).
        Object[][] rows = {
                {"an", "hung", -30, ScheduleSlot.SLOT_3}, {"an", "hung", -23, ScheduleSlot.SLOT_3},
                {"an", "hung", -16, ScheduleSlot.SLOT_3}, {"an", "hung", -9, ScheduleSlot.SLOT_3},
                {"an", "hung", -2, ScheduleSlot.SLOT_3}, {"an", "hung", 3, ScheduleSlot.SLOT_3},
                {"an", "hung", 10, ScheduleSlot.SLOT_3},
                {"binh", "mai", -6, ScheduleSlot.SLOT_3}, {"binh", "mai", 4, ScheduleSlot.SLOT_3},
                {"giang", "long", -14, ScheduleSlot.SLOT_2}, {"giang", "long", -7, ScheduleSlot.SLOT_2},
                {"giang", "long", 5, ScheduleSlot.SLOT_2},
                {"hieu", "hung", -10, ScheduleSlot.SLOT_4}, {"hieu", "hung", 2, ScheduleSlot.SLOT_4},
                {"chi", "mai", 6, ScheduleSlot.SLOT_4}};
        for (Object[] row : rows) {
            Member member = memberByKey.get((String) row[0]);
            Coach coach = coachByKey.get((String) row[1]);
            if (member == null || coach == null) {
                continue;
            }
            int offset = (Integer) row[2];
            ScheduleSlot slot = (ScheduleSlot) row[3];
            LocalDate date = today.plusDays(offset);
            if (member.getJoinDate() != null && date.isBefore(member.getJoinDate())) {
                continue;
            }
            if (offset >= 0 && !subscriptions.hasActiveMembershipCoveringSession(member.getUserId(), today, date)) {
                continue;
            }
            CoachBooking booking = new CoachBooking();
            booking.setMember(member);
            booking.setCoach(coach);
            booking.setDiscipline(disciplineByName.get(coachDiscipline((String) row[1])));
            booking.setBookingDate(date);
            booking.setStartTime(slot.startTime());
            booking.setEndTime(slot.endTime());
            booking.setHourlyRate(new BigDecimal("200000.00"));
            booking.setPaymentMethod("package_quota");
            booking.setPaymentStatus("used_quota");
            booking.setCreatedAt(date.minusDays(4).atTime(20, 0));
            if (offset < 0) {
                booking.setStatus("completed");
                booking.setAttendedAt(date.atTime(slot.startTime().plusMinutes(2)));
                booking.setNotes("Buổi PT 1:1 đã hoàn thành");
            } else {
                booking.setStatus("confirmed");
                booking.setNotes("Buổi PT 1:1 sắp tới");
            }
            coachBookings.save(booking);
        }
    }

    /** Bộ môn của HLV demo theo khóa. */
    private String coachDiscipline(String coachKey) {
        return COACHES.stream().filter(c -> c.key().equals(coachKey)).findFirst().orElseThrow().discipline();
    }

    // ---- tiến độ ---------------------------------------------------------------------------------------------

    /** Tạo số đo cân nặng, mỡ, BMI hằng tháng trong 4 tháng (và chiều cao lần đầu) để có biểu đồ tiến độ. */
    private void createProgress(Map<String, Member> memberByKey, Map<String, Coach> coachByKey, LocalDate today) {
        // key -> {cân nặng ban đầu, thay đổi mỗi tháng, mỡ cơ thể ban đầu, thay đổi mỡ mỗi tháng, chiều cao cm,
        // HLV}.
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

    /** Lưu một số đo (làm tròn 1 chữ số thập phân). */
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
