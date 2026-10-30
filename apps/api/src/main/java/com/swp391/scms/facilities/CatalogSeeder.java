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
import org.springframework.stereotype.Component;

/** Seeds sample disciplines, rooms and packages into empty catalogs (idempotent). */
@Component
public class CatalogSeeder implements ApplicationRunner {

    public static final String SILVER_NAME = "SILVER";
    public static final String SILVER_DESC = "BASIC – Cơ bản\n"
            + "Quyền lợi:\n"
            + "- Tập luyện không giới hạn trong giờ hoạt động.\n"
            + "- Sử dụng khu vực tập luyện tiêu chuẩn.\n"
            + "- Sử dụng phòng thay đồ và tủ khóa chung.\n"
            + "- Miễn phí nước uống.\n"
            + "- 2 lượt đăng ký lớp Group Fitness cơ bản theo lịch.\n"
            + "- Đánh giá thể trạng và chỉ số BMI ban đầu.";
    public static final BigDecimal SILVER_PRICE = new BigDecimal("199000");
    public static final int SILVER_DURATION = 30;
    public static final Integer SILVER_CREDIT_LIMIT = 2;

    public static final String GOLD_NAME = "GOLD";
    public static final String GOLD_DESC = "STANDARD – Trung cấp\n"
            + "Toàn bộ quyền lợi Silver, cộng thêm:\n"
            + "- 03 buổi tập Personal Trainer 1:1 mỗi tháng.\n"
            + "- Sử dụng khu vực máy tập nâng cao.\n"
            + "- Cung cấp khăn tập riêng trong mỗi buổi tập.\n"
            + "- Tủ khóa cá nhân cố định.\n"
            + "- Được đánh giá thể trạng định kỳ mỗi tháng.\n"
            + "- Xây dựng kế hoạch tập luyện cá nhân cơ bản.\n"
            + "- 5 lượt đặt chỗ trong các lớp Group Fitness.\n"
            + "- Giảm 10% dịch vụ PT bổ sung và sản phẩm tại trung tâm.";
    public static final BigDecimal GOLD_PRICE = new BigDecimal("299000");
    public static final int GOLD_DURATION = 30;
    public static final Integer GOLD_CREDIT_LIMIT = 5;

    public static final String PLATINUM_NAME = "PLATINUM";
    public static final String PLATINUM_DESC = "VIP – Cao cấp\n"
            + "Toàn bộ quyền lợi Gold, cộng thêm:\n"
            + "- 06 buổi tập Personal Trainer 1:1 mỗi tháng.\n"
            + "- Đặc quyền sử dụng phòng tập VIP riêng biệt.\n"
            + "- Sử dụng hệ thống máy tập cao cấp và thiết bị chuyên biệt.\n"
            + "- Khăn tập và khăn tắm cá nhân theo tiêu chuẩn VIP.\n"
            + "- Tủ đồ cá nhân cao cấp, có khóa riêng.\n"
            + "- Sử dụng phòng xông hơi.\n"
            + "- Miễn phí nước khoáng và đồ uống thể thao.\n"
            + "- Đánh giá chỉ số cơ thể chuyên sâu: BMI, Body Fat, Muscle Mass.\n"
            + "- Thiết kế giáo án tập luyện riêng theo mục tiêu.\n"
            + "- Tư vấn dinh dưỡng cơ bản cùng huấn luyện viên.\n"
            + "- Ưu tiên đặt lịch PT và lớp học.\n"
            + "- Giảm 20% dịch vụ PT bổ sung và sản phẩm tại trung tâm.\n"
            + "- Được mời tham gia các sự kiện và chương trình độc quyền.";
    public static final BigDecimal PLATINUM_PRICE = new BigDecimal("599000");
    public static final int PLATINUM_DURATION = 30;
    public static final Integer PLATINUM_CREDIT_LIMIT = null;

    private final DisciplineService disciplines;
    private final RoomService rooms;
    private final PackageService packages;

    public CatalogSeeder(DisciplineService disciplines, RoomService rooms, PackageService packages) {
        this.disciplines = disciplines;
        this.rooms = rooms;
        this.packages = packages;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(ApplicationArguments args) {
        if (disciplines.list().isEmpty()) {
            disciplines.create(new DisciplineRequest("Reformer Pilates", "Core strength and spine recovery on Reformer machines"));
            disciplines.create(new DisciplineRequest("Olympic Strength", "Explosive strength with Olympic barbells"));
            disciplines.create(new DisciplineRequest("Mindful Yoga", "Breathwork, deep stretching and meditation"));
            disciplines.create(new DisciplineRequest("Boxing & Kickfit", "Combat tactics, reflexes and high-intensity fat burn"));
            disciplines.create(new DisciplineRequest("Thermal Aquatics", "Hydrodynamic swimming and warm-water recovery"));
        }
        if (rooms.list().isEmpty()) {
            rooms.create(new RoomRequest("Studio 01", "Level 2 - North Wing", 12, "available"));
            rooms.create(new RoomRequest("Arena 02 (Strength)", "Level 1 - Main Floor", 25, "available"));
            rooms.create(new RoomRequest("Zen Garden Studio", "Penthouse", 18, "available"));
            rooms.create(new RoomRequest("Ring Arena 01", "Level 1 - East Wing", 14, "maintenance"));
            rooms.create(new RoomRequest("Oasis Lap Pool", "Sub-level Oasis", 20, "available"));
        }

        var existingPackages = packages.list();
        if (existingPackages.isEmpty()) {
            packages.create(new PackageRequest(SILVER_NAME, SILVER_DESC, SILVER_PRICE, SILVER_DURATION, SILVER_CREDIT_LIMIT, "active"));
            packages.create(new PackageRequest(GOLD_NAME, GOLD_DESC, GOLD_PRICE, GOLD_DURATION, GOLD_CREDIT_LIMIT, "active"));
            packages.create(new PackageRequest(PLATINUM_NAME, PLATINUM_DESC, PLATINUM_PRICE, PLATINUM_DURATION, PLATINUM_CREDIT_LIMIT, "active"));
        } else {
            // SCRUM-130: Ensure existing packages are refined to the 3 standard monthly packages (SILVER, GOLD, PLATINUM)
            boolean hasSilver = false;
            boolean hasGold = false;
            boolean hasPlatinum = false;

            for (int i = 0; i < existingPackages.size(); i++) {
                var pkg = existingPackages.get(i);
                if (i == 0 || "The Essential".equalsIgnoreCase(pkg.name()) || SILVER_NAME.equalsIgnoreCase(pkg.name())) {
                    packages.update(pkg.id(), new PackageRequest(SILVER_NAME, SILVER_DESC, SILVER_PRICE, SILVER_DURATION, SILVER_CREDIT_LIMIT, "active"));
                    hasSilver = true;
                } else if (i == 1 || "The Sanctuary VIP".equalsIgnoreCase(pkg.name()) || GOLD_NAME.equalsIgnoreCase(pkg.name())) {
                    packages.update(pkg.id(), new PackageRequest(GOLD_NAME, GOLD_DESC, GOLD_PRICE, GOLD_DURATION, GOLD_CREDIT_LIMIT, "active"));
                    hasGold = true;
                } else if (i == 2 || "The Sovereign Annual".equalsIgnoreCase(pkg.name()) || PLATINUM_NAME.equalsIgnoreCase(pkg.name())) {
                    packages.update(pkg.id(), new PackageRequest(PLATINUM_NAME, PLATINUM_DESC, PLATINUM_PRICE, PLATINUM_DURATION, PLATINUM_CREDIT_LIMIT, "active"));
                    hasPlatinum = true;
                }
            }

            if (!hasSilver) {
                packages.create(new PackageRequest(SILVER_NAME, SILVER_DESC, SILVER_PRICE, SILVER_DURATION, SILVER_CREDIT_LIMIT, "active"));
            }
            if (!hasGold) {
                packages.create(new PackageRequest(GOLD_NAME, GOLD_DESC, GOLD_PRICE, GOLD_DURATION, GOLD_CREDIT_LIMIT, "active"));
            }
            if (!hasPlatinum) {
                packages.create(new PackageRequest(PLATINUM_NAME, PLATINUM_DESC, PLATINUM_PRICE, PLATINUM_DURATION, PLATINUM_CREDIT_LIMIT, "active"));
            }
        }
    }
}
