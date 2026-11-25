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

    /** Kiểm thử: không công khai các buổi lớp nhóm khi chưa cấu hình/tắt cờ classes. */
    @Test
    void doesNotPublishGroupSessionsWhenDisabled() {
        assertTrue(service.getCatalog().sessions().isEmpty());
    }

    /** Kiểm thử: công khai các buổi lớp nhóm sắp tới khi classesEnabled = true. */
    @Test
    void publishesUpcomingGroupClassSessionsWhenEnabled() {
        var sessionRepo = mock(com.swp391.scms.scheduling.repository.ClassSessionRepository.class);
        var enrollmentRepo = mock(com.swp391.scms.scheduling.repository.ClassEnrollmentRepository.class);
        var sessionBookingRepo = mock(com.swp391.scms.scheduling.repository.SessionBookingRepository.class);
        var mapper = new com.swp391.scms.scheduling.mapper.SchedulingMapper();
        var fixedClock = java.time.Clock.fixed(java.time.Instant.parse("2026-11-25T02:00:00Z"), com.swp391.scms.common.CenterTime.ZONE);
        var enabledService = new PublicCatalogService(
                packages, coaches, sessionRepo, enrollmentRepo, sessionBookingRepo, mapper, fixedClock, true);

        var yoga = new com.swp391.scms.facilities.entity.Discipline();
        org.springframework.test.util.ReflectionTestUtils.setField(yoga, "id", 6L);
        yoga.setName("Yoga");
        var gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setId(10L);
        gymClass.setName("Hatha Yoga Nền Tảng");
        gymClass.setDiscipline(yoga);
        gymClass.setCapacity(16);
        var session = new com.swp391.scms.scheduling.entity.ClassSession();
        session.setId(100L);
        session.setGymClass(gymClass);
        session.setSessionDate(java.time.LocalDate.of(2026, 11, 26));
        session.setStartTime(java.time.LocalTime.of(7, 30));
        session.setEndTime(java.time.LocalTime.of(8, 30));
        session.setStatus("scheduled");

        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of());
        when(coaches.findPublicCoaches()).thenReturn(List.of());
        when(sessionRepo.findPublicSessions(any(), any(), any())).thenReturn(List.of(session));
        when(enrollmentRepo.countByClassIdsAndStatus(List.of(10L), "booked")).thenReturn(List.of());
        when(sessionBookingRepo.countBookedBySessionIds(List.of(100L))).thenReturn(List.of());

        var result = enabledService.getCatalog();
        assertEquals(1, result.sessions().size());
        assertEquals("Hatha Yoga Nền Tảng", result.sessions().getFirst().className());
        assertEquals("Yoga", result.sessions().getFirst().disciplineName());
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
