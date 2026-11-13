package com.swp391.scms.facilities;

import com.swp391.scms.facilities.dto.CatalogRequests.DisciplineRequest;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest;
import com.swp391.scms.facilities.dto.CatalogRequests.RoomRequest;
import com.swp391.scms.facilities.service.DisciplineService;
import com.swp391.scms.facilities.service.PackageService;
import com.swp391.scms.facilities.service.RoomService;
import java.math.BigDecimal;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Seeds disciplines, rooms and packages (idempotent): 3-day trial, short-term 3 months, long-term 6/9/12 months. */
@Component
@Order(50)
public class CatalogSeeder implements ApplicationRunner {

    // --- GÓI TRẢI NGHIỆM 3 NGÀY ---
    public static final String TRIAL_PACKAGE_NAME = "Gói Trải Nghiệm 3 Ngày";
    public static final String TRIAL_PACKAGE_DESC = "GÓI TRẢI NGHIỆM – Khám phá SÖL Fitness trong 3 ngày\n"
            + "Quyền lợi:\n"
            + "- Nhận các dịch vụ của gói Gold (không gồm phòng VIP).\n"
            + "- Toàn quyền sử dụng khu vực gym tiêu chuẩn và trang thiết bị hiện đại.\n"
            + "- 01 buổi tập Personal Trainer 1:1 cùng Huấn luyện viên chuyên nghiệp.\n"
            + "- Sử dụng tủ khóa và tiện ích phòng thay đồ.\n"
            + "- Không đăng ký lớp Group Fitness và không áp dụng chính sách bảo lưu.";
    public static final BigDecimal TRIAL_PACKAGE_PRICE = BigDecimal.ZERO;
    public static final int TRIAL_PACKAGE_DURATION = 3;
    public static final Integer TRIAL_PACKAGE_CREDIT_LIMIT = 0;
    public static final String TRIAL_PACKAGE_TIER = "GOLD";

    // --- Gói trả phí: ngắn hạn = 3 tháng; dài hạn = 6, 9, 12 tháng (quy tắc 3-12 tháng của PackageService) ---
    // Tên gói: "<HẠNG> <n> THÁNG". Hạn mức khóa Group Fitness = số khóa/tháng của hạng x số tháng (PackageBenefits).
    public static final String BOXING_ROOM = "Boxing Studio";
    private static final int DAYS_PER_MONTH = 30;
    private static final int[] TERMS = {3, 6, 9, 12};
    private static final int LAST_SHORT_TERM_MONTHS = 3;
    private static final String[] SAVINGS = {null, "~10%", "~15%", "~20%"};

    /** Hạng gói: nhãn, giá theo kỳ hạn (3, 6, 9, 12 tháng) và quyền lợi. */
    private record Tier(String code, String label, int[] prices, int ptPerMonth, int holdDays, String[] perks) {}

    private static final Tier[] TIERS = {
        new Tier("SILVER", "BASIC", new int[] {549_000, 990_000, 1_390_000, 1_750_000}, 0, 7, new String[] {
            "Sử dụng khu vực tập luyện tiêu chuẩn, phòng thay đồ và tủ khóa chung.",
            "Miễn phí nước uống.",
            "Đánh giá thể trạng và chỉ số BMI ban đầu."}),
        new Tier("GOLD", "STANDARD", new int[] {799_000, 1_440_000, 2_040_000, 2_550_000}, 3, 15, new String[] {
            "Sử dụng khu vực máy tập nâng cao và khăn tập riêng mỗi buổi.",
            "Tủ khóa cá nhân cố định, đánh giá thể trạng định kỳ mỗi tháng.",
            "Kế hoạch tập luyện cá nhân cơ bản do huấn luyện viên soạn.",
            "Giảm 10% dịch vụ PT bổ sung, phí khóa học và sản phẩm tại trung tâm."}),
        new Tier("PLATINUM", "VIP", new int[] {1_599_000, 2_890_000, 4_090_000, 5_120_000}, 6, 30, new String[] {
            "Đặc quyền sử dụng phòng tập VIP riêng biệt và phòng xông hơi.",
            "Khăn tập, khăn tắm và tủ đồ cá nhân cao cấp.",
            "Đánh giá chỉ số cơ thể chuyên sâu: BMI, Body Fat, Muscle Mass.",
            "Giáo án tập luyện riêng theo mục tiêu và tư vấn dinh dưỡng cơ bản.",
            "Giảm 20% dịch vụ PT bổ sung, phí khóa học và sản phẩm tại trung tâm.",
            "Được mời tham gia các sự kiện và chương trình độc quyền."}),
    };

    public static String packageName(String tier, int months) {
        return tier + " " + months + " THÁNG";
    }

    /** Mô tả sinh từ hạng + kỳ hạn để quyền lợi luôn khớp {@link PackageBenefits}. */
    static String describe(Tier tier, int months, int termIndex) {
        int days = months * DAYS_PER_MONTH;
        StringBuilder sb = new StringBuilder(tier.label()).append(" – Gói ").append(months).append(" tháng (")
                .append(months > LAST_SHORT_TERM_MONTHS ? "Dài hạn" : "Ngắn hạn");
        if (SAVINGS[termIndex] != null) sb.append(", tiết kiệm ").append(SAVINGS[termIndex]);
        sb.append(")\nQuyền lợi:\n- Tập luyện không giới hạn trong giờ hoạt động suốt ").append(days).append(" ngày.\n");
        for (String perk : tier.perks()) sb.append("- ").append(perk).append('\n');
        if (tier.ptPerMonth() > 0) {
            sb.append("- ").append(tier.ptPerMonth() * months).append(" buổi tập Personal Trainer 1:1 trong ")
                    .append(months).append(" tháng.\n");
        }
        sb.append("- ").append(PackageBenefits.courseCredits(tier.code(), days)).append(" lượt đăng ký khóa Group Fitness.\n");
        sb.append("- Được bảo lưu tối đa ").append(tier.holdDays()).append(" ngày (một lần, cần giấy tờ y tế).");
        return sb.toString();
    }

    /** Tên gói Gold dùng làm phương án dự phòng cho gói trải nghiệm khi chưa seed (xem MemberTrialService). */
    public static final String GOLD_NAME = "GOLD";

    // Gói 1 tháng đã ngừng bán: chỉ chuyển về inactive nếu còn trong CSDL cũ (không xóa vì hội viên có thể đang dùng).
    private static final String[] RETIRED_ONE_MONTH_NAMES = {"SILVER", "GOLD", "PLATINUM"};

    private final DisciplineService disciplines;
    private final RoomService rooms;
    private final PackageService packages;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.facilities.repository.EquipmentRepository equipmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.facilities.repository.RoomRepository roomRepository;

    public CatalogSeeder(DisciplineService disciplines, RoomService rooms, PackageService packages) {
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.packages = packages;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        // Bộ môn chuẩn: Gym là bộ môn chính; Bơi lội, Boxing, Tennis, Cầu lông, Yoga là bộ môn phụ.
        upsertDiscipline("Gym", "Sức mạnh, thể lực và kỹ thuật tập tạ", "Olympic Strength");
        upsertDiscipline("Bơi lội", "Kỹ thuật bơi, sức bền dưới nước và phục hồi", "Thermal Aquatics");
        upsertDiscipline("Boxing", "Kỹ thuật đấm, phản xạ và thể lực theo hiệp", "Boxing & Kickfit");
        upsertDiscipline("Tennis", "Kỹ thuật đánh bóng, di chuyển và đánh đôi");
        upsertDiscipline("Cầu lông", "Bộ chân, phản xạ và kỹ thuật đánh cầu");
        upsertDiscipline("Yoga", "Hơi thở, thăng bằng và giãn cơ", "Mindful Yoga");
        if (rooms.list().isEmpty()) {
            rooms.create(new RoomRequest("Phòng Gym Tiêu chuẩn", "Tầng 1 - Khu Gym Chính", 50, "available", null, null, null, "STANDARD"));
            rooms.create(new RoomRequest("Phòng Gym VIP", "Tầng 2 - Khu VIP Platinum", 25, "available", null, null, null, "PLATINUM"));
            rooms.create(new RoomRequest("Zen Garden Studio", "Penthouse", 18, "available", null, null, null, "STANDARD"));
            rooms.create(new RoomRequest("Ring Arena 01", "Level 1 - East Wing", 14, "maintenance", null, null, null, "STANDARD"));
            rooms.create(new RoomRequest("Oasis Lap Pool", "Sub-level Oasis", 20, "available", null, null, null, "STANDARD"));
        }

        // Phòng Boxing riêng hạng tiêu chuẩn: các lớp Boxing mở cho mọi gói, không dồn vào phòng VIP.
        upsertRoom(BOXING_ROOM, "Tầng 1 - Khu Chiến đấu", 20, "available", "STANDARD");

        upsertPackageWithTier(TRIAL_PACKAGE_NAME, TRIAL_PACKAGE_DESC, TRIAL_PACKAGE_PRICE, TRIAL_PACKAGE_DURATION, TRIAL_PACKAGE_CREDIT_LIMIT, TRIAL_PACKAGE_TIER, "GOLD TRIAL", "Gói Tập Thử 3 Ngày", "Gói Thử Gold");

        // Ngắn hạn 3 tháng; dài hạn 6, 9, 12 tháng. Mỗi hạng một giá theo kỳ hạn.
        for (Tier tier : TIERS) {
            for (int i = 0; i < TERMS.length; i++) {
                int days = TERMS[i] * DAYS_PER_MONTH;
                upsertPackage(packageName(tier.code(), TERMS[i]), describe(tier, TERMS[i], i),
                        BigDecimal.valueOf(tier.prices()[i]), days, PackageBenefits.courseCredits(tier.code(), days));
            }
        }

        // Ngừng bán gói 1 tháng (nếu còn trong CSDL cũ).
        for (String retired : RETIRED_ONE_MONTH_NAMES) {
            retirePackage(retired);
        }

        if (equipmentRepository != null && roomRepository != null && equipmentRepository.count() == 0) {
            seedInitialEquipment();
        }
    }

    private void seedInitialEquipment() {
        upsertRoom("Phòng Gym Tiêu chuẩn", "Tầng 1 - Khu Gym Chính", 50, "available", "STANDARD");
        upsertRoom("Phòng Gym VIP", "Tầng 2 - Khu VIP Platinum", 25, "available", "PLATINUM");
        var allRooms = roomRepository.findAll();
        com.swp391.scms.facilities.entity.Room standard = allRooms.stream()
                .filter(r -> "Phòng Gym Tiêu chuẩn".equalsIgnoreCase(r.getName()))
                .findFirst().orElse(null);
        com.swp391.scms.facilities.entity.Room vip = allRooms.stream()
                .filter(r -> "Phòng Gym VIP".equalsIgnoreCase(r.getName()))
                .findFirst().orElse(null);

        if (standard != null) {
            seedEquipmentIfMissing("Máy chạy bộ điện Commercial Pro", "EQ-RUN-01", "Cardio", standard, 8, "active");
            seedEquipmentIfMissing("Xe đạp tập Upright Bike", "EQ-BIKE-01", "Cardio", standard, 6, "active");
            seedEquipmentIfMissing("Giàn tạ đa năng Smith Machine", "EQ-SMI-01", "Strength", standard, 3, "active");
            seedEquipmentIfMissing("Máy kéo xô đôi Dual Lat Pulldown", "EQ-LAT-01", "Strength", standard, 2, "active");
            seedEquipmentIfMissing("Dàn tạ tay cao su Dumbbell (2.5-40kg)", "EQ-DUMB-01", "Free Weights", standard, 2, "active");
            seedEquipmentIfMissing("Khung gánh tạ Squat Rack", "EQ-SQUAT-01", "Strength", standard, 2, "active");
            seedEquipmentIfMissing("Ghế đẩy ngực đa năng Adjustable Bench", "EQ-BENCH-01", "Free Weights", standard, 6, "active");
        }
        if (vip != null) {
            seedEquipmentIfMissing("Máy chạy bộ cao cấp Technogym Artis Run", "EQ-VIP-RUN-01", "Cardio", vip, 4, "active");
            seedEquipmentIfMissing("Máy tập toàn thân Synchro Elliptical VIP", "EQ-VIP-SYN-01", "Cardio", vip, 3, "active");
            seedEquipmentIfMissing("Dàn tạ khối thông minh Technogym Kinesis One", "EQ-VIP-KIN-01", "Strength", vip, 2, "active");
            seedEquipmentIfMissing("Dàn tạ đơn Urethane bọc crôm VIP", "EQ-VIP-DUMB-01", "Free Weights", vip, 1, "active");
            seedEquipmentIfMissing("Máy đo chỉ số cơ thể chuyên sâu InBody 770", "EQ-VIP-INBODY-01", "Diagnostic", vip, 1, "active");
        }
    }

    private void seedEquipmentIfMissing(String name, String code, String category, com.swp391.scms.facilities.entity.Room room, int quantity, String status) {
        if (equipmentRepository != null && !equipmentRepository.existsByCode(code)) {
            equipmentRepository.save(new com.swp391.scms.facilities.entity.Equipment(name, code, category, room, quantity, status));
        }
    }

    private void upsertRoom(String name, String location, int capacity, String status, String tier) {
        for (var r : rooms.list()) {
            if (name.equalsIgnoreCase(r.name())) {
                if (tier != null && !tier.equalsIgnoreCase(r.tier())) {
                    rooms.update(r.id(), new RoomRequest(r.name(), r.location(), r.capacity(), r.status(), r.disciplineId(), r.openTime(), r.closeTime(), tier));
                }
                return;
            }
        }
        rooms.create(new RoomRequest(name, location, capacity, status, null, null, null, tier));
    }

    /** Tạo bộ môn chuẩn nếu chưa có; đổi tên bộ môn cũ tương ứng (giữ nguyên id và lớp học đang gắn). */
    private void upsertDiscipline(String name, String description, String... legacyNames) {
        var existingList = disciplines.list();
        for (var discipline : existingList) {
            if (name.equalsIgnoreCase(discipline.name())) {
                return;
            }
        }
        for (var discipline : existingList) {
            for (String legacy : legacyNames) {
                if (legacy.equalsIgnoreCase(discipline.name())) {
                    disciplines.update(discipline.id(), new DisciplineRequest(name,
                            discipline.description() != null ? discipline.description() : description));
                    return;
                }
            }
        }
        disciplines.create(new DisciplineRequest(name, description));
    }

    /** Đặt gói đang active về inactive (idempotent); không tạo mới, không xóa. */
    private void retirePackage(String name) {
        for (var pkg : packages.list()) {
            if (name.equalsIgnoreCase(pkg.name()) && "active".equals(pkg.status())) {
                packages.updateStatus(pkg.id(), "inactive");
            }
        }
    }

    private void upsertPackage(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String... legacyAliases) {
        upsertPackageWithTier(name, desc, price, duration, creditLimit, null, legacyAliases);
    }

    private void upsertPackageWithTier(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String tier,
                                       String... legacyAliases) {
        var existingList = packages.list();
        for (var pkg : existingList) {
            if (name.equalsIgnoreCase(pkg.name())) {
                return;
            }
        }
        if (legacyAliases != null) {
            for (var pkg : existingList) {
                for (String alias : legacyAliases) {
                    if (alias.equalsIgnoreCase(pkg.name())) {
                        try {
                            packages.update(pkg.id(), new PackageRequest(name, pkg.description(),
                                    correctedLegacyPrice(pkg.name(), pkg.price()), pkg.durationDays(), pkg.classCreditLimit(), pkg.status(), tier));
                        } catch (com.swp391.scms.common.exception.ConflictException sold) {
                            // Already sold under the legacy name: keep history intact and seed the standard package below.
                            continue;
                        }
                        return;
                    }
                }
            }
        }
        PackageRequest request = new PackageRequest(name, desc, price, duration, creditLimit, "active", tier);
        packages.create(request);
    }
    /**
     * Preserves any price customized by a Manager in the database; only converts the original
     * unedited seed prices when renaming legacy package aliases ("The Essential", etc.) for the first time.
     */
    private BigDecimal correctedLegacyPrice(String name, BigDecimal currentPrice) {
        if (currentPrice == null) return null;
        if ("The Essential".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("2800000")) == 0) return new BigDecimal("299000");
        if ("The Sanctuary VIP".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("7500000")) == 0) return new BigDecimal("499000");
        if ("The Sovereign Annual".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("26000000")) == 0) return new BigDecimal("999000");
        return currentPrice;
    }
}
