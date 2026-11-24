package com.swp391.scms.facilities;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.dto.CatalogRequests.PackageRequest;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.facilities.service.PackageService;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Bộ kiểm thử cho service PackageService (package service). */
@ExtendWith(MockitoExtension.class)
class PackageServiceTest {

    @Mock MembershipPackageRepository packages;
    @InjectMocks PackageService service;

    /** Kiểm thử: tạo gói mặc định ở trạng thái hoạt động khi không nêu trạng thái. */
    @Test
    void createDefaultsToActiveWhenStatusOmitted() {
        when(packages.save(any(MembershipPackage.class))).thenAnswer(i -> i.getArgument(0));

        var dto = service.create(new PackageRequest("Basic", null, BigDecimal.TEN, 90, 8, null));

        assertEquals("active", dto.status());
        assertEquals(90, dto.durationDays());
    }

    /** Kiểm thử: tạo gói từ chối thời hạn ngoài khoảng 3-12 tháng. */
    @Test
    void createRejectsTermsOutsideThreeToTwelveMonths() {
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.create(new PackageRequest("Short", null, BigDecimal.TEN, 30, 8, null)));
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.create(new PackageRequest("Long", null, BigDecimal.TEN, 400, 8, null)));
    }

    /** Kiểm thử: seed gói cũ giữ các gói một tháng mà thao tác tạo sẽ từ chối. */
    @Test
    void seedLegacyPackageKeepsTheOneMonthPlansThatCreateRejects() {
        when(packages.save(any(MembershipPackage.class))).thenAnswer(i -> i.getArgument(0));

        var dto = service.seedLegacyPackage(new PackageRequest("SILVER", null, BigDecimal.TEN, 30, 1, "active", null));

        assertEquals(30, dto.durationDays());
        assertEquals("active", dto.status());
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.create(new PackageRequest("SILVER", null, BigDecimal.TEN, 30, 1, "active", null)));
    }

    /** Kiểm thử: gói đã bán không được đổi tên hay đổi thời hạn. */
    @Test
    void soldPackageCannotBeRenamedOrRetimed() {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setName("GOLD 6 THÁNG");
        pkg.setDurationDays(180);
        pkg.setPrice(BigDecimal.TEN);
        var subscriptions = org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptions", subscriptions);
        when(packages.findById(1L)).thenReturn(Optional.of(pkg));
        when(subscriptions.existsByMembershipPackageId(1L)).thenReturn(true);

        assertThrows(com.swp391.scms.common.exception.ConflictException.class,
                () -> service.update(1L, new PackageRequest("GOLD 9 THÁNG", null, BigDecimal.TEN, 270, 8, null)));
        // price/benefit edits that keep the name and term stay allowed
        assertEquals("GOLD 6 THÁNG", service.update(1L, new PackageRequest("GOLD 6 THÁNG", null, BigDecimal.ONE, 180, 8, null)).name());
    }

    /** Kiểm thử: cập nhật trạng thái để vô hiệu hóa gói. */
    @Test
    void updateStatusDeactivates() {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setPrice(BigDecimal.TEN);
        when(packages.findById(1L)).thenReturn(Optional.of(pkg));

        assertEquals("inactive", service.updateStatus(1L, "inactive").status());
    }

    /** Kiểm thử: cập nhật gói không tồn tại ném not found. */
    @Test
    void updateMissingThrowsNotFound() {
        when(packages.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.update(9L, new PackageRequest("A", null, BigDecimal.ONE, 90, null, null)));
    }

    /** Kiểm thử: xóa được gói chưa từng bán. */
    @Test
    void deleteRemovesPackageThatWasNeverSold() {
        MembershipPackage pkg = new MembershipPackage();
        var subscriptions = org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptions", subscriptions);
        when(packages.findById(1L)).thenReturn(Optional.of(pkg));
        service.delete(1L);
        org.mockito.Mockito.verify(packages).delete(pkg);
    }

    /** Kiểm thử: chặn xóa gói đã bán. */
    @Test
    void deleteBlockedWhenPackageWasSold() {
        var subscriptions = org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptions", subscriptions);
        when(packages.findById(1L)).thenReturn(Optional.of(new MembershipPackage()));
        when(subscriptions.existsByMembershipPackageId(1L)).thenReturn(true);
        assertThrows(com.swp391.scms.common.exception.ConflictException.class, () -> service.delete(1L));
        org.mockito.Mockito.verify(packages, org.mockito.Mockito.never()).delete(any(MembershipPackage.class));
    }
}
