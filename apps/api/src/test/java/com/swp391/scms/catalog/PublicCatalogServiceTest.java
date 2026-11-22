package com.swp391.scms.catalog;

import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.scheduling.dto.ClassBookingCount;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublicCatalogServiceTest {
    @Test
    void doesNotPublishLegacyGroupSessions() {
        var packages = mock(MembershipPackageRepository.class);
        var coaches = mock(CoachRepository.class);
        var sessions = mock(ClassSessionRepository.class);
        var enrollments = mock(ClassEnrollmentRepository.class);
        var result = new PublicCatalogService(packages, coaches, sessions, enrollments,
                new SchedulingMapper(), Clock.systemUTC()).getCatalog();

        assertTrue(result.sessions().isEmpty());
        verifyNoInteractions(sessions, enrollments);
    }
    @Test
    void returnsCurrentPricesAndOnlyPublicCoachFields() {
        var packages = mock(MembershipPackageRepository.class);
        var coaches = mock(CoachRepository.class);
        var sessions = mock(ClassSessionRepository.class);
        var enrollments = mock(ClassEnrollmentRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-10-23T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        var pkg = new MembershipPackage();
        pkg.setName("Updated package"); pkg.setPrice(new BigDecimal("789000")); pkg.setStatus("active");
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(pkg));
        var user = new User(); user.setFullName("Coach An"); user.setEmail("private@example.test");
        var coach = new Coach(); coach.setUserId(7L); coach.setUser(user); coach.setSpecialization("Yoga");
        when(coaches.findPublicCoaches()).thenReturn(List.of(coach));
        var result = new PublicCatalogService(packages, coaches, sessions, enrollments, new SchedulingMapper(), clock).getCatalog();
        assertEquals(new BigDecimal("789000"), result.packages().getFirst().price());
        assertEquals("Coach An", result.coaches().getFirst().name());
        assertEquals("Yoga", result.coaches().getFirst().specialization());
        assertTrue(result.sessions().isEmpty());
        verifyNoInteractions(enrollments);
        verifyNoInteractions(sessions);
    }

    @Test
    void normalizesBlankAvatar() {
        var packages = mock(MembershipPackageRepository.class);
        var coaches = mock(CoachRepository.class);
        var sessions = mock(ClassSessionRepository.class);
        var enrollments = mock(ClassEnrollmentRepository.class);
        // 2026-10-23T18:30:00Z is 2026-10-24T01:30:00+07:00 in Asia/Ho_Chi_Minh
        var utcClock = Clock.fixed(Instant.parse("2026-10-23T18:30:00Z"), ZoneOffset.UTC);
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of());
        var user = new User();
        user.setFullName("Huỳnh Đắc Tài");
        user.setAvatarUrl("   ");
        var coach = new Coach();
        coach.setUserId(9L);
        coach.setUser(user);
        coach.setSpecialization("Gym");
        when(coaches.findPublicCoaches()).thenReturn(List.of(coach));

        var result = new PublicCatalogService(packages, coaches, sessions, enrollments, new SchedulingMapper(), utcClock).getCatalog();

        assertNull(result.coaches().getFirst().avatarUrl());
        verifyNoInteractions(sessions);
    }
}
