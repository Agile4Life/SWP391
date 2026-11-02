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
    void returnsCurrentPricesAndOnlyPublicCoachFieldsWithBoundedFutureSchedule() {
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
        when(sessions.findPublicSessions(LocalDate.of(2026, 10, 23), LocalDate.of(2026, 10, 29), LocalTime.of(10, 0)))
                .thenReturn(List.of());
        var result = new PublicCatalogService(packages, coaches, sessions, enrollments, new SchedulingMapper(), clock).getCatalog();
        assertEquals(new BigDecimal("789000"), result.packages().getFirst().price());
        assertEquals("Coach An", result.coaches().getFirst().name());
        assertEquals("Yoga", result.coaches().getFirst().specialization());
        assertTrue(result.sessions().isEmpty());
        verifyNoInteractions(enrollments);
        verify(sessions).findPublicSessions(LocalDate.of(2026, 10, 23), LocalDate.of(2026, 10, 29), LocalTime.of(10, 0));
    }

    @Test
    void sharesGroupedCountsAcrossSessionsOfTheSameClassAndDefaultsEmptyClassesToZero() {
        var packages = mock(MembershipPackageRepository.class);
        var coaches = mock(CoachRepository.class);
        var sessions = mock(ClassSessionRepository.class);
        var enrollments = mock(ClassEnrollmentRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-10-23T03:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        var yoga = new GymClass(); yoga.setId(11L); yoga.setName("Yoga"); yoga.setCapacity(20);
        var swim = new GymClass(); swim.setId(12L); swim.setName("Swimming"); swim.setCapacity(10);
        var first = new ClassSession(); first.setId(1L); first.setGymClass(yoga);
        var second = new ClassSession(); second.setId(2L); second.setGymClass(yoga);
        var third = new ClassSession(); third.setId(3L); third.setGymClass(swim);
        when(sessions.findPublicSessions(any(), any(), any())).thenReturn(List.of(first, second, third));
        when(enrollments.countByClassIdsAndStatus(List.of(11L, 12L), "booked"))
                .thenReturn(List.of(new ClassBookingCount(11L, 3L)));

        var result = new PublicCatalogService(packages, coaches, sessions, enrollments, new SchedulingMapper(), clock).getCatalog();

        assertEquals(List.of(3L, 3L, 0L), result.sessions().stream().map(s -> s.bookedCount()).toList());
        assertEquals(List.of(1L, 2L, 3L), result.sessions().stream().map(s -> s.id()).toList());
        verify(enrollments).countByClassIdsAndStatus(List.of(11L, 12L), "booked");
        verifyNoMoreInteractions(enrollments);
    }
}
