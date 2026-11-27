package com.swp391.scms.facilities.service;

import com.swp391.scms.audit.Audited;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiệp vụ danh mục gói tập (SCRUM-60).
 */
@Service
public class PackageService {

    private final MembershipPackageRepository packages;

    /** Nhận repository gói tập. */
    public PackageService(MembershipPackageRepository packages) {
        this.packages = packages;
    }

    /** Danh sách gói theo giá tăng dần. */
    @Transactional(readOnly = true)
    public List<PackageDto> list() {
        return packages.findAllByOrderByPriceAsc().stream().map(PackageDto::of).toList();
    }

    /** Tạo gói: thời hạn phải hợp lệ (3 ngày cho gói trải nghiệm, hoặc 90-365 ngày); có ghi audit. */
    @Transactional
    @Audited(action = "PACKAGE_CREATE", entity = "membership_packages")
    public PackageDto create(PackageRequest request) {
        requireValidDuration(request.durationDays());
        MembershipPackage pkg = new MembershipPackage();
        apply(pkg, request);
        return PackageDto.of(packages.save(pkg));
    }

    /**
     * Khởi tạo mục danh mục có trước quy tắc 3–12 tháng: các gói 1 tháng SILVER/GOLD/PLATINUM vốn đã có trong các
     * CSDL hiện hành và được bộ dữ liệu mẫu cùng các kỳ gói cũ tham chiếu. Việc seed giúp schema mới đồng nhất với
     * môi trường đã triển khai. Chỉ {@code CatalogSeeder} gọi hàm này; không controller nào mở ra ngoài, nên quản lý/API
     * luôn đi qua {@link #create(PackageRequest)} và {@code requireValidDuration}.
     */
    @Transactional
    @Audited(action = "PACKAGE_CREATE", entity = "membership_packages")
    public PackageDto seedLegacyPackage(PackageRequest request) {
        MembershipPackage pkg = new MembershipPackage();
        apply(pkg, request);
        return PackageDto.of(packages.save(pkg));
    }

    /**
     * Sửa gói: thời hạn mới phải hợp lệ. Các kỳ gói đã bán đã snapshot tên, hạng và quyền lợi lúc mua nên quản
     * lý được phép chỉnh sửa mọi thông tin gói cho khách mua mới mà không làm sai lịch sử hội viên hiện hữu.
     */
    @Transactional
    @Audited(action = "PACKAGE_UPDATE", entity = "membership_packages")
    public PackageDto update(Long id, PackageRequest request) {
        MembershipPackage pkg = find(id);
        if (request.durationDays() != pkg.getDurationDays()) {
            requireValidDuration(request.durationDays());
        }
        apply(pkg, request);
        return PackageDto.of(pkg);
    }

    /** Bật/tắt mở bán gói. */
    @Transactional
    @Audited(action = "PACKAGE_STATUS_CHANGE", entity = "membership_packages")
    public PackageDto updateStatus(Long id, String status) {
        MembershipPackage pkg = find(id);
        pkg.setStatus(status);
        return PackageDto.of(pkg);
    }

    /** Thời hạn mở bán từ 3 đến 12 tháng; gói trải nghiệm 3 ngày là gói ngắn hơn duy nhất. */
    public static final int TRIAL_DAYS = 3;
    public static final int MIN_TERM_DAYS = 90;
    public static final int MAX_TERM_DAYS = 365;

    /** Thời hạn hợp lệ: đúng 3 ngày (gói trải nghiệm) hoặc 90-365 ngày. */
    private static void requireValidDuration(int days) {
        if (days != TRIAL_DAYS && (days < MIN_TERM_DAYS || days > MAX_TERM_DAYS)) {
            throw new com.swp391.scms.common.exception.BadRequestException(
                    "PACKAGE_DURATION_INVALID", "catalog.package.duration_invalid",
                    new Object[] {MIN_TERM_DAYS, MAX_TERM_DAYS}, null);
        }
    }

    /** Lấy gói theo id; không thấy thì 404. */
    private MembershipPackage find(Long id) {
        return packages.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.package", id));
    }

    /** Gán dữ liệu từ request vào gói; hạng được suy ra nếu không truyền. */
    private void apply(MembershipPackage pkg, PackageRequest request) {
        pkg.setName(request.name().trim());
        pkg.setDescription(request.description());
        pkg.setPrice(request.price());
        pkg.setDurationDays(request.durationDays());
        pkg.setClassCreditLimit(request.classCreditLimit());
        if (request.status() != null && !request.status().isBlank()) {
            pkg.setStatus(request.status());
        }
        pkg.setTier(PackageDto.inferTier(request.name(), request.tier()));
        if (request.ptSessionsPerCycle() != null) {
            pkg.setPtSessionsPerCycle(request.ptSessionsPerCycle());
        }
        if (request.holdMaxDays() != null) {
            pkg.setHoldMaxDays(request.holdMaxDays());
        }
        if (request.discountPercent() != null) {
            pkg.setDiscountPercent(request.discountPercent());
        }
        if (request.vipRoomAccess() != null) {
            pkg.setVipRoomAccess(request.vipRoomAccess());
        }
        if (request.canViewWorkoutPlan() != null) {
            pkg.setCanViewWorkoutPlan(request.canViewWorkoutPlan());
        }
        if (request.allowsPeriodicAssessment() != null) {
            pkg.setAllowsPeriodicAssessment(request.allowsPeriodicAssessment());
        }
        if (request.allowsDeepAssessment() != null) {
            pkg.setAllowsDeepAssessment(request.allowsDeepAssessment());
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptions;

    /**
     * Xóa gói chưa từng bán; gói đã từng bán được giữ lại cho lịch sử (chuyển trạng thái sang inactive thay vì xóa).
     */
    @Transactional
    @Audited(action = "PACKAGE_DELETE", entity = "membership_packages")
    public void delete(Long id) {
        MembershipPackage pkg = find(id);
        if (subscriptions != null && subscriptions.existsByMembershipPackageId(id)) {
            throw new com.swp391.scms.common.exception.ConflictException("PACKAGE_IN_USE", "catalog.package.in_use", null, null);
        }
        packages.delete(pkg);
    }
}
