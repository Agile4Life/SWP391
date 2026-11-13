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

@ExtendWith(MockitoExtension.class)
class PackageServiceTest {

    @Mock MembershipPackageRepository packages;
    @InjectMocks PackageService service;

    @Test
    void createDefaultsToActiveWhenStatusOmitted() {
        when(packages.save(any(MembershipPackage.class))).thenAnswer(i -> i.getArgument(0));

        var dto = service.create(new PackageRequest("Basic", null, BigDecimal.TEN, 90, 8, null));

        assertEquals("active", dto.status());
        assertEquals(90, dto.durationDays());
    }

    @Test
    void createRejectsTermsOutsideThreeToTwelveMonths() {
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.create(new PackageRequest("Short", null, BigDecimal.TEN, 30, 8, null)));
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class,
                () -> service.create(new PackageRequest("Long", null, BigDecimal.TEN, 400, 8, null)));
    }

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

    @Test
    void updateStatusDeactivates() {
        MembershipPackage pkg = new MembershipPackage();
        pkg.setPrice(BigDecimal.TEN);
        when(packages.findById(1L)).thenReturn(Optional.of(pkg));

        assertEquals("inactive", service.updateStatus(1L, "inactive").status());
    }

    @Test
    void updateMissingThrowsNotFound() {
        when(packages.findById(9L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class,
                () -> service.update(9L, new PackageRequest("A", null, BigDecimal.ONE, 90, null, null)));
    }

    @Test
    void deleteRemovesPackageThatWasNeverSold() {
        MembershipPackage pkg = new MembershipPackage();
        var subscriptions = org.mockito.Mockito.mock(com.swp391.scms.membership.repository.MembershipSubscriptionRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptions", subscriptions);
        when(packages.findById(1L)).thenReturn(Optional.of(pkg));
        service.delete(1L);
        org.mockito.Mockito.verify(packages).delete(pkg);
    }

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
