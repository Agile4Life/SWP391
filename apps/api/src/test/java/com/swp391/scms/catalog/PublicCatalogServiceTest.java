package com.swp391.scms.catalog;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service PublicCatalogService (public catalog service). */
class PublicCatalogServiceTest {
    private final MembershipPackageRepository packages = mock(MembershipPackageRepository.class);
    private final CoachRepository coaches = mock(CoachRepository.class);
    private final PublicCatalogService service = new PublicCatalogService(packages, coaches);

    /** Kiểm thử: không công khai các buổi lớp nhóm cũ. */
    @Test
    void doesNotPublishLegacyGroupSessions() {
        assertTrue(service.getCatalog().sessions().isEmpty());
    }

    /** Kiểm thử: trả giá hiện tại và chỉ các trường công khai của HLV. */
    @Test
    void returnsCurrentPricesAndOnlyPublicCoachFields() {
        var pkg = new MembershipPackage();
        pkg.setName("Updated package"); pkg.setPrice(new BigDecimal("789000")); pkg.setStatus("active");
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(pkg));
        var user = new User(); user.setFullName("Coach An"); user.setEmail("private@example.test");
        var coach = new Coach(); coach.setUserId(7L); coach.setUser(user); coach.setSpecialization("Yoga");
        when(coaches.findPublicCoaches()).thenReturn(List.of(coach));

        var result = service.getCatalog();

        assertEquals(new BigDecimal("789000"), result.packages().getFirst().price());
        assertEquals("Coach An", result.coaches().getFirst().name());
        assertEquals("Yoga", result.coaches().getFirst().specialization());
        assertTrue(result.sessions().isEmpty());
    }

    /** Kiểm thử: ảnh đại diện trống được chuẩn hóa. */
    @Test
    void normalizesBlankAvatar() {
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of());
        var user = new User();
        user.setFullName("Huỳnh Đắc Tài");
        user.setAvatarUrl("   ");
        var coach = new Coach();
        coach.setUserId(9L);
        coach.setUser(user);
        coach.setSpecialization("Gym");
        when(coaches.findPublicCoaches()).thenReturn(List.of(coach));

        assertNull(service.getCatalog().coaches().getFirst().avatarUrl());
    }
}
