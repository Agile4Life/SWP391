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

/** Business logic for the membership package catalog (SCRUM-60). */
@Service
public class PackageService {

    private final MembershipPackageRepository packages;

    public PackageService(MembershipPackageRepository packages) {
        this.packages = packages;
    }

    @Transactional(readOnly = true)
    public List<PackageDto> list() {
        return packages.findAllByOrderByPriceAsc().stream().map(PackageDto::of).toList();
    }

    @Transactional
    @Audited(action = "PACKAGE_CREATE", entity = "membership_packages")
    public PackageDto create(PackageRequest request) {
        requireValidDuration(request.durationDays());
        MembershipPackage pkg = new MembershipPackage();
        apply(pkg, request);
        return PackageDto.of(packages.save(pkg));
    }

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

    private static void requireValidDuration(int days) {
        if (days != TRIAL_DAYS && (days < MIN_TERM_DAYS || days > MAX_TERM_DAYS)) {
            throw new com.swp391.scms.common.exception.BadRequestException(
                    "PACKAGE_DURATION_INVALID", "catalog.package.duration_invalid",
                    new Object[] {MIN_TERM_DAYS, MAX_TERM_DAYS}, null);
        }
    }

    private MembershipPackage find(Long id) {
        return packages.findById(id).orElseThrow(() -> new ResourceNotFoundException("resource.package", id));
    }

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

    /** A package that was ever sold is kept for history (set status to inactive instead). */
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
