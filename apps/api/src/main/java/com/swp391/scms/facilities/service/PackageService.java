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
 * Nghiệp vụ danh mục gói tập.
 *
 * Business logic for the membership package catalog (SCRUM-60).
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
     * Tạo gói 1 tháng kiểu cũ (có trước quy tắc 3-12 tháng) chỉ cho CatalogSeeder; không controller nào gọi nên
     * người dùng luôn đi qua kiểm tra thời hạn.
     *
     * Seeds a catalog entry that predates the 3-12 month rule: the 1-month SILVER/GOLD/PLATINUM plans, which existing
     * databases already hold and the demo dataset and older subscriptions reference. Seeding them keeps a fresh schema
     * identical to deployed ones. Only {@code CatalogSeeder} calls this; no controller exposes it, so Manager/API
     * callers always go through {@link #create(PackageRequest)} and {@code requireValidDuration}.
     */
    @Transactional
    @Audited(action = "PACKAGE_CREATE", entity = "membership_packages")
    public PackageDto seedLegacyPackage(PackageRequest request) {
        MembershipPackage pkg = new MembershipPackage();
        apply(pkg, request);
        return PackageDto.of(packages.save(pkg));
    }

    /**
     * Sửa gói: thời hạn mới phải hợp lệ; gói đã bán không được đổi tên/thời hạn (sẽ làm sai lịch sử mua) mà
     * phải tạo gói mới.
     */
    @Transactional
    @Audited(action = "PACKAGE_UPDATE", entity = "membership_packages")
    public PackageDto update(Long id, PackageRequest request) {
        MembershipPackage pkg = find(id);
        boolean durationChanged = request.durationDays() != pkg.getDurationDays();
        boolean nameChanged = !request.name().trim().equals(pkg.getName());
        if (durationChanged) {
            requireValidDuration(request.durationDays());
        }
        // Subscriptions point at the package row, so renaming/retiming a sold package would relabel history
        // (e.g. a "GOLD 6 THÁNG" purchase suddenly reading "GOLD 12 THÁNG"). Create a new package instead.
        if ((durationChanged || nameChanged) && subscriptions != null && subscriptions.existsByMembershipPackageId(id)) {
            throw new com.swp391.scms.common.exception.ConflictException(
                    "PACKAGE_IDENTITY_LOCKED", "catalog.package.identity_locked", null, null);
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

    /** Sellable terms are 3 to 12 months; the 3-day trial is the only shorter package. */
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
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipSubscriptionRepository subscriptions;

    /**
     * Xóa gói chưa từng bán; gói đã bán phải chuyển sang ngừng bán thay vì xóa.
     *
     * A package that was ever sold is kept for history (set status to inactive instead).
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
