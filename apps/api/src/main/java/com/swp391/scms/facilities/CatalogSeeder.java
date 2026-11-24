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

/**
 * Chạy khi khởi động: tạo dữ liệu danh mục mẫu cho Gym (bộ môn Gym, phòng Gym tiêu chuẩn, gói trải nghiệm, các
 * gói 1/3/6 tháng Silver/Gold/Platinum, thiết bị ban đầu) một cách lũy đẳng (idempotent — chạy lại nhiều lần không
 * tạo trùng và không ghi đè gói mà quản lý đã chỉnh sửa).
 */
@Component
@Order(50)
public class CatalogSeeder implements ApplicationRunner {

    // --- GÓI TRẢI NGHIỆM 3 NGÀY ---
    public static final String TRIAL_PACKAGE_NAME = "Gói Trải Nghiệm 3 Ngày";
    public static final String TRIAL_PACKAGE_DESC = "GÓI TRẢI NGHIỆM – Khám phá SÖL Fitness trong 3 ngày\n"
            + "Quyền lợi:\n"
            + "- Nhận các dịch vụ của gói Gold.\n"
            + "- Toàn quyền sử dụng khu vực gym tiêu chuẩn và trang thiết bị hiện đại.\n"
            + "- 01 buổi tập Personal Trainer 1:1 cùng Huấn luyện viên chuyên nghiệp.\n"
            + "- Sử dụng tủ khóa và tiện ích phòng thay đồ.\n"
            + "- Không áp dụng chính sách bảo lưu.";
    public static final BigDecimal TRIAL_PACKAGE_PRICE = BigDecimal.ZERO;
    public static final int TRIAL_PACKAGE_DURATION = 3;
    public static final Integer TRIAL_PACKAGE_CREDIT_LIMIT = 0;
    public static final String TRIAL_PACKAGE_TIER = "GOLD";

    // --- 1 THÁNG (30 NGÀY) - gói cũ, có trước quy tắc thời hạn 3–12 tháng ---
    // Vẫn seed qua PackageService.seedLegacyPackage để DB mới giống DB đang chạy (dữ liệu demo, lịch sử đăng ký
    // và e2e trỏ tới các gói này); PackageService.create (đường API) tiếp tục từ chối thời hạn 30 ngày.
    public static final String SILVER_NAME = "SILVER";
    public static final String SILVER_DESC = "BASIC – Cơ bản\n"
            + "Quyền lợi:\n"
            + "- Tập luyện không giới hạn trong giờ hoạt động.\n"
            + "- Sử dụng khu vực tập luyện tiêu chuẩn.\n"
            + "- Sử dụng phòng thay đồ và tủ khóa chung.\n"
            + "- Miễn phí nước uống.";
    public static final BigDecimal SILVER_PRICE = new BigDecimal("199000");
    public static final int SILVER_DURATION = 30;
    public static final Integer SILVER_CREDIT_LIMIT = 1;

    public static final String GOLD_NAME = "GOLD";
    public static final String GOLD_DESC = "STANDARD – Trung cấp\n"
            + "Toàn bộ quyền lợi Silver, cộng thêm:\n"
            + "- 03 buổi tập Personal Trainer 1:1 mỗi tháng.\n"
            + "- Sử dụng khu vực máy tập nâng cao.\n"
            + "- Cung cấp khăn tập riêng trong mỗi buổi tập.\n"
            + "- Tủ khóa cá nhân cố định.\n"
            + "- Xây dựng kế hoạch tập luyện cá nhân cơ bản.\n"
            + "- Giảm 10% dịch vụ PT bổ sung.";
    public static final BigDecimal GOLD_PRICE = new BigDecimal("299000");
    public static final int GOLD_DURATION = 30;
    public static final Integer GOLD_CREDIT_LIMIT = 2;

    public static final String PLATINUM_NAME = "PLATINUM";
    public static final String PLATINUM_DESC = "VIP – Cao cấp\n"
            + "Toàn bộ quyền lợi Gold, cộng thêm:\n"
            + "- 06 buổi tập Personal Trainer 1:1 mỗi tháng.\n"
            + "- Sử dụng hệ thống máy tập cao cấp và thiết bị chuyên biệt.\n"
            + "- Khăn tập và khăn tắm cá nhân theo tiêu chuẩn VIP.\n"
            + "- Tủ đồ cá nhân cao cấp, có khóa riêng.\n"
            + "- Sử dụng phòng xông hơi.\n"
            + "- Miễn phí nước khoáng và đồ uống thể thao.\n"
            + "- Thiết kế giáo án tập luyện riêng theo mục tiêu.\n"
            + "- Tư vấn dinh dưỡng cơ bản cùng huấn luyện viên.\n"
            + "- Giảm 20% dịch vụ PT bổ sung.\n"
            + "- Được mời tham gia các sự kiện và chương trình độc quyền.";
    public static final BigDecimal PLATINUM_PRICE = new BigDecimal("599000");
    public static final int PLATINUM_DURATION = 30;
    public static final Integer PLATINUM_CREDIT_LIMIT = 4;

    // --- 3 THÁNG (90 NGÀY) & 6 THÁNG (180 NGÀY) ---
    public static final String SILVER_3M_NAME = "SILVER 3 THÁNG";
    public static final String SILVER_3M_DESC = "BASIC – Đồng hành 3 tháng\n"
            + "Quyền lợi:\n"
            + "- Tập luyện Gym không giới hạn trong giờ hoạt động suốt 90 ngày.\n"
            + "- Check-in ra/vào bằng thẻ QR động và trải nghiệm không gian 3D.\n"
            + "- Sử dụng đầy đủ khu vực tạ tự do, máy cardio và máy tập tiêu chuẩn.\n"
            + "- Sử dụng phòng thay đồ, tủ khóa chung và miễn phí nước uống.\n"
            + "- Hỗ trợ bảo lưu tối đa 07 ngày (khi có lý do hợp lệ).\n"
            + "- Có thể đặt thêm buổi tập PT 1:1 tính phí theo giờ khi có nhu cầu.";
    public static final BigDecimal SILVER_3M_PRICE = new BigDecimal("549000");
    public static final int SILVER_3M_DURATION = 90;
    public static final Integer SILVER_3M_CREDIT_LIMIT = 3;

    public static final String SILVER_6M_NAME = "SILVER 6 THÁNG";
    public static final String SILVER_6M_DESC = "BASIC – Đồng hành 6 tháng (Tiết kiệm ~10%)\n"
            + "Quyền lợi:\n"
            + "- Tập luyện Gym không giới hạn trong giờ hoạt động suốt 180 ngày.\n"
            + "- Check-in ra/vào bằng thẻ QR động và trải nghiệm không gian 3D.\n"
            + "- Sử dụng đầy đủ khu vực tạ tự do, máy cardio và máy tập tiêu chuẩn.\n"
            + "- Sử dụng phòng thay đồ, tủ khóa chung và miễn phí nước uống.\n"
            + "- Hỗ trợ bảo lưu tối đa 07 ngày (khi có lý do hợp lệ).\n"
            + "- Có thể đặt thêm buổi tập PT 1:1 tính phí theo giờ khi có nhu cầu.";
    public static final BigDecimal SILVER_6M_PRICE = new BigDecimal("990000");
    public static final int SILVER_6M_DURATION = 180;
    public static final Integer SILVER_6M_CREDIT_LIMIT = 6;

    public static final String GOLD_3M_NAME = "GOLD 3 THÁNG";
    public static final String GOLD_3M_DESC = "STANDARD – Gym + PT 1:1 & Giáo án (3 tháng)\n"
            + "Toàn bộ quyền lợi Silver, cộng thêm:\n"
            + "- Tặng 09 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).\n"
            + "- Được Huấn luyện viên xây dựng Giáo án tập luyện cá nhân hóa.\n"
            + "- Sử dụng tủ khóa cố định và khăn tập mỗi buổi.\n"
            + "- Hỗ trợ bảo lưu tối đa 15 ngày.\n"
            + "- Giảm 10% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.";
    public static final BigDecimal GOLD_3M_PRICE = new BigDecimal("799000");
    public static final int GOLD_3M_DURATION = 90;
    public static final Integer GOLD_3M_CREDIT_LIMIT = 6;

    public static final String GOLD_6M_NAME = "GOLD 6 THÁNG";
    public static final String GOLD_6M_DESC = "STANDARD – Gym + PT 1:1 & Giáo án (6 tháng · Tiết kiệm ~10%)\n"
            + "Toàn bộ quyền lợi Silver, cộng thêm:\n"
            + "- Tặng 18 buổi tập Personal Trainer 1:1 (03 buổi / mỗi chu kỳ 30 ngày).\n"
            + "- Được Huấn luyện viên xây dựng và điều chỉnh Giáo án tập luyện cá nhân hóa.\n"
            + "- Sử dụng tủ khóa cố định và khăn tập mỗi buổi.\n"
            + "- Hỗ trợ bảo lưu tối đa 15 ngày.\n"
            + "- Giảm 10% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.";
    public static final BigDecimal GOLD_6M_PRICE = new BigDecimal("1449000");
    public static final int GOLD_6M_DURATION = 180;
    public static final Integer GOLD_6M_CREDIT_LIMIT = 12;

    public static final String PLATINUM_3M_NAME = "PLATINUM 3 THÁNG";
    public static final String PLATINUM_3M_DESC = "VIP – Gym + PT 1:1 chuyên sâu (3 tháng)\n"
            + "Toàn bộ quyền lợi Gold, cộng thêm:\n"
            + "- Tặng 18 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).\n"
            + "- Thiết kế Giáo án tập luyện chuyên sâu theo mục tiêu từng giai đoạn.\n"
            + "- Tủ đồ cá nhân cao cấp có khóa riêng, khăn tập & khăn tắm VIP.\n"
            + "- Miễn phí nước khoáng và đồ uống thể thao.\n"
            + "- Hỗ trợ bảo lưu tối đa 30 ngày.\n"
            + "- Giảm 20% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.";
    public static final BigDecimal PLATINUM_3M_PRICE = new BigDecimal("1599000");
    public static final int PLATINUM_3M_DURATION = 90;
    public static final Integer PLATINUM_3M_CREDIT_LIMIT = 12;

    public static final String PLATINUM_6M_NAME = "PLATINUM 6 THÁNG";
    public static final String PLATINUM_6M_DESC = "VIP – Gym + PT 1:1 chuyên sâu (6 tháng · Tiết kiệm ~10%)\n"
            + "Toàn bộ quyền lợi Gold, cộng thêm:\n"
            + "- Tặng 36 buổi tập Personal Trainer 1:1 (06 buổi / mỗi chu kỳ 30 ngày).\n"
            + "- Thiết kế Giáo án tập luyện chuyên sâu theo mục tiêu từng giai đoạn.\n"
            + "- Tủ đồ cá nhân cao cấp có khóa riêng, khăn tập & khăn tắm VIP.\n"
            + "- Miễn phí nước khoáng và đồ uống thể thao.\n"
            + "- Hỗ trợ bảo lưu tối đa 30 ngày.\n"
            + "- Giảm 20% phí khi đặt thêm các buổi tập PT 1:1 ngoài định mức.";
    public static final BigDecimal PLATINUM_6M_PRICE = new BigDecimal("2899000");
    public static final int PLATINUM_6M_DURATION = 180;
    public static final Integer PLATINUM_6M_CREDIT_LIMIT = 24;


    private final DisciplineService disciplines;
    private final RoomService rooms;
    private final PackageService packages;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.facilities.repository.EquipmentRepository equipmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.facilities.repository.RoomRepository roomRepository;

    /** Nhận dịch vụ bộ môn, phòng và gói tập. */
    public CatalogSeeder(DisciplineService disciplines, RoomService rooms, PackageService packages) {
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.packages = packages;
    }

    /**
     * Tạo/cập nhật dữ liệu mẫu: bộ môn và phòng Gym, gói trải nghiệm, gói 3 và 6 tháng; đồng bộ một lần các gói
     * còn mô tả seed cũ sang quyền lợi mới; tạo thiết bị ban đầu nếu chưa có thiết bị nào. Không tự bật/tắt gói
     * (quản lý toàn quyền).
     */
    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        // Chỉ tạo dữ liệu mẫu cho Gym; dữ liệu lịch sử được giữ nguyên.
        upsertDiscipline("Gym", "Sức mạnh, thể lực và kỹ thuật tập tạ", "Olympic Strength");
        if (rooms.list().isEmpty()) {
            rooms.create(new RoomRequest("Phòng Gym Tiêu chuẩn", "Tầng 1 - Khu Gym Chính", 50, "available", null, null, null, "STANDARD"));
        }

        // Tạo hoặc cập nhật gói trải nghiệm 3 ngày
        upsertPackageWithTier(TRIAL_PACKAGE_NAME, TRIAL_PACKAGE_DESC, TRIAL_PACKAGE_PRICE, TRIAL_PACKAGE_DURATION, TRIAL_PACKAGE_CREDIT_LIMIT, TRIAL_PACKAGE_TIER, "GOLD TRIAL", "Gói Tập Thử 3 Ngày", "Gói Thử Gold");

        // Tạo hoặc cập nhật các gói cơ bản 1 tháng kiểu cũ (nằm ngoài quy tắc 3–12 tháng, xem seedLegacyPackage)
        upsertLegacyPackage(SILVER_NAME, SILVER_DESC, SILVER_PRICE, SILVER_DURATION, SILVER_CREDIT_LIMIT, "The Essential");
        upsertLegacyPackage(GOLD_NAME, GOLD_DESC, GOLD_PRICE, GOLD_DURATION, GOLD_CREDIT_LIMIT, "The Sanctuary VIP");
        upsertLegacyPackage(PLATINUM_NAME, PLATINUM_DESC, PLATINUM_PRICE, PLATINUM_DURATION, PLATINUM_CREDIT_LIMIT, "The Sovereign Annual");

        // Tạo hoặc cập nhật các gói dài hạn 3 tháng & 6 tháng
        upsertPackageWithTier(SILVER_3M_NAME, SILVER_3M_DESC, SILVER_3M_PRICE, SILVER_3M_DURATION, SILVER_3M_CREDIT_LIMIT, "SILVER");
        upsertPackageWithTier(SILVER_6M_NAME, SILVER_6M_DESC, SILVER_6M_PRICE, SILVER_6M_DURATION, SILVER_6M_CREDIT_LIMIT, "SILVER");
        upsertPackageWithTier(GOLD_3M_NAME, GOLD_3M_DESC, GOLD_3M_PRICE, GOLD_3M_DURATION, GOLD_3M_CREDIT_LIMIT, "GOLD");
        upsertPackageWithTier(GOLD_6M_NAME, GOLD_6M_DESC, GOLD_6M_PRICE, GOLD_6M_DURATION, GOLD_6M_CREDIT_LIMIT, "GOLD");
        upsertPackageWithTier(PLATINUM_3M_NAME, PLATINUM_3M_DESC, PLATINUM_3M_PRICE, PLATINUM_3M_DURATION, PLATINUM_3M_CREDIT_LIMIT, "PLATINUM");
        upsertPackageWithTier(PLATINUM_6M_NAME, PLATINUM_6M_DESC, PLATINUM_6M_PRICE, PLATINUM_6M_DURATION, PLATINUM_6M_CREDIT_LIMIT, "PLATINUM");

        // Đồng bộ lại mô tả, giá và trạng thái active cho 6 gói (3 tháng & 6 tháng) nếu trong DB vẫn là bản seed cũ.
        syncSeededPackage(SILVER_3M_NAME, SILVER_3M_DESC, SILVER_3M_PRICE, SILVER_3M_CREDIT_LIMIT, "SILVER");
        syncSeededPackage(SILVER_6M_NAME, SILVER_6M_DESC, SILVER_6M_PRICE, SILVER_6M_CREDIT_LIMIT, "SILVER");
        syncSeededPackage(GOLD_3M_NAME, GOLD_3M_DESC, GOLD_3M_PRICE, GOLD_3M_CREDIT_LIMIT, "GOLD");
        syncSeededPackage(GOLD_6M_NAME, GOLD_6M_DESC, GOLD_6M_PRICE, GOLD_6M_CREDIT_LIMIT, "GOLD");
        syncSeededPackage(PLATINUM_3M_NAME, PLATINUM_3M_DESC, PLATINUM_3M_PRICE, PLATINUM_3M_CREDIT_LIMIT, "PLATINUM");
        syncSeededPackage(PLATINUM_6M_NAME, PLATINUM_6M_DESC, PLATINUM_6M_PRICE, PLATINUM_6M_CREDIT_LIMIT, "PLATINUM");

        // Đồng bộ quyền lợi cho Trial & legacy 1-month nếu còn nguyên mô tả seed cũ.
        alignBenefits(TRIAL_PACKAGE_NAME, TRIAL_PACKAGE_DESC, TRIAL_PACKAGE_CREDIT_LIMIT, TRIAL_PACKAGE_TIER, 3);
        alignBenefits(SILVER_NAME, SILVER_DESC, SILVER_CREDIT_LIMIT, "SILVER", 2);
        alignBenefits(GOLD_NAME, GOLD_DESC, GOLD_CREDIT_LIMIT, "GOLD", 5);
        alignBenefits(PLATINUM_NAME, PLATINUM_DESC, PLATINUM_CREDIT_LIMIT, "PLATINUM", null);

        // Không tự đổi trạng thái gói ở đây: việc ngừng bán gói 6/12 tháng cũ đã chạy trên mọi CSDL,
        // từ nay Manager toàn quyền bật/tắt gói (chạy lại mỗi lần khởi động sẽ tắt gói Manager vừa bật).

        if (equipmentRepository != null && roomRepository != null && equipmentRepository.count() == 0) {
            seedInitialEquipment();
        }
    }

    /** Tạo bộ thiết bị ban đầu cho phòng Gym tiêu chuẩn. */
    private void seedInitialEquipment() {
        upsertRoom("Phòng Gym Tiêu chuẩn", "Tầng 1 - Khu Gym Chính", 50, "available", "STANDARD");
        var allRooms = roomRepository.findAll();
        com.swp391.scms.facilities.entity.Room standard = allRooms.stream()
                .filter(r -> "Phòng Gym Tiêu chuẩn".equalsIgnoreCase(r.getName()))
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
    }

    /** Tạo thiết bị nếu chưa có thiết bị nào cùng mã. */
    private void seedEquipmentIfMissing(String name, String code, String category, com.swp391.scms.facilities.entity.Room room, int quantity, String status) {
        if (equipmentRepository != null && !equipmentRepository.existsByCode(code)) {
            equipmentRepository.save(new com.swp391.scms.facilities.entity.Equipment(name, code, category, room, quantity, status));
        }
    }

    /** Tạo phòng nếu chưa có; phòng đã có thì chỉ cập nhật hạng phòng nếu khác. */
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
    /**
     * Chuyển gói seed cũ sang quyền lợi mới (spec 2026-11-09). Chỉ đụng vào gói còn nguyên mô tả và hạn mức seed cũ;
     * gói mà Manager đã chỉnh sửa thì giữ nguyên, kể cả giá.
     */
    // Dòng đầu mô tả của các bản seed 3/6 tháng trước đây; chỉ gói còn nguyên một trong các dòng này mới được chuyển đổi.
    private static final java.util.Set<String> OLD_SEEDED_FIRST_LINES = java.util.Set.of(
            "BASIC – Đồng hành 3 tháng (Tiết kiệm 8%)",
            "STANDARD – Đồng hành 3 tháng (Tiết kiệm 11%)",
            "VIP – Đồng hành 3 tháng (Tiết kiệm 11%)",
            "VIP – Gym Cao cấp + PT 1:1 chuyên sâu (3 tháng)",
            "BASIC – Đồng hành 6 tháng (Tiết kiệm 16%)",
            "STANDARD – Đồng hành 6 tháng (Tiết kiệm 17%)",
            "VIP – Đồng hành 6 tháng (Đặc quyền VIP - Tiết kiệm 17%)",
            "VIP – Gym Cao cấp + PT 1:1 chuyên sâu (6 tháng · Tiết kiệm ~10%)");

    /**
     * Chuyển một lần gói 3/6 tháng còn mô tả seed cũ sang mô tả, giá, hạn mức mới và mở bán lại.
     * Sau khi chuyển, mô tả không còn khớp bản cũ nên các lần khởi động sau không đụng tới:
     * Manager toàn quyền đổi giá, mô tả và bật/tắt gói.
     */
    private void syncSeededPackage(String name, String desc, BigDecimal price, Integer creditLimit, String tier) {
        for (var pkg : packages.list()) {
            if (!name.equalsIgnoreCase(pkg.name())) continue;
            if (isOldSeededDescription(pkg.description())) {
                packages.update(pkg.id(), new PackageRequest(
                        pkg.name(), desc, price, pkg.durationDays(), creditLimit, "active", tier));
            }
            return;
        }
    }

    /** Mô tả có phải bản seed cũ không (dòng đầu khớp một trong các dòng seed cũ đã biết). */
    private static boolean isOldSeededDescription(String description) {
        if (description == null) return false;
        String firstLine = description.strip().lines().findFirst().orElse("").strip();
        return OLD_SEEDED_FIRST_LINES.contains(firstLine);
    }

    /**
     * Cập nhật quyền lợi (mô tả, hạn mức, hạng) cho gói còn nguyên bản seed cũ; gói quản lý đã chỉnh thì giữ
     * nguyên.
     */
    private void alignBenefits(String name, String desc, Integer creditLimit, String tier, Integer legacyCreditLimit) {
        String marker = desc.substring(0, desc.indexOf('\n'));
        for (var pkg : packages.list()) {
            if (!name.equalsIgnoreCase(pkg.name())) continue;
            boolean untouched = pkg.description() != null && pkg.description().startsWith(marker)
                    && java.util.Objects.equals(legacyCreditLimit, pkg.classCreditLimit());
            boolean upToDate = java.util.Objects.equals(desc, pkg.description())
                    && java.util.Objects.equals(creditLimit, pkg.classCreditLimit())
                    && tier.equalsIgnoreCase(pkg.tier());
            if (untouched && !upToDate) {
                packages.update(pkg.id(), new PackageRequest(pkg.name(), desc, pkg.price(), pkg.durationDays(),
                        creditLimit, pkg.status(), tier));
            }
            return;
        }
    }

    /** Tạo gói (không có hạng) nếu chưa có, hoặc đổi tên gói cũ theo bí danh. */
    private void upsertPackage(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String... legacyAliases) {
        upsertPackageWithTier(name, desc, price, duration, creditLimit, null, false, legacyAliases);
    }

    /** Tạo gói 1 tháng kiểu cũ (ngoài quy tắc 3-12 tháng) nếu chưa có. */
    private void upsertLegacyPackage(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String... legacyAliases) {
        upsertPackageWithTier(name, desc, price, duration, creditLimit, null, true, legacyAliases);
    }

    /** Tạo gói có hạng nếu chưa có. */
    private void upsertPackageWithTier(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String tier, String... legacyAliases) {
        upsertPackageWithTier(name, desc, price, duration, creditLimit, tier, false, legacyAliases);
    }

    /**
     * Tạo gói nếu chưa có tên này; nếu có gói mang tên cũ (bí danh) thì đổi tên gói đó (giữ giá quản lý đã
     * chỉnh), trừ khi gói đã bán thì bỏ qua để giữ lịch sử và tạo gói chuẩn mới.
     */
    private void upsertPackageWithTier(String name, String desc, BigDecimal price, int duration, Integer creditLimit, String tier,
                                       boolean legacyTerm, String... legacyAliases) {
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
                            // Đã từng bán dưới tên cũ: giữ nguyên lịch sử và tạo gói chuẩn ở bước bên dưới.
                            continue;
                        }
                        return;
                    }
                }
            }
        }
        PackageRequest request = new PackageRequest(name, desc, price, duration, creditLimit, "active", tier);
        if (legacyTerm) {
            packages.seedLegacyPackage(request);
        } else {
            packages.create(request);
        }
    }
    /**
     * Bảo toàn mọi mức giá mà quản lý đã tùy chỉnh trong CSDL; chỉ chuyển đổi mức giá seed gốc chưa chỉnh sửa khi đổi
     * tên các gói theo bí danh cũ ("The Essential", v.v.) lần đầu tiên.
     */
    private BigDecimal correctedLegacyPrice(String name, BigDecimal currentPrice) {
        if (currentPrice == null) return null;
        if ("The Essential".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("2800000")) == 0) return new BigDecimal("299000");
        if ("The Sanctuary VIP".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("7500000")) == 0) return new BigDecimal("499000");
        if ("The Sovereign Annual".equalsIgnoreCase(name) && currentPrice.compareTo(new BigDecimal("26000000")) == 0) return new BigDecimal("999000");
        return currentPrice;
    }
}
