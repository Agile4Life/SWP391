package com.swp391.scms.coaching;

import com.swp391.scms.coaching.dto.CoachLeaderboardItemDto;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.service.CoachLeaderboardService;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CoachLeaderboardServiceTest {

    @Mock
    private CoachRepository coachRepository;

    @Mock
    private CoachBookingRepository coachBookingRepository;

    @Mock
    private ClassSessionRepository classSessionRepository;

    private CoachLeaderboardService leaderboardService;

    private Coach coach1;
    private Coach coach2;

    @BeforeEach
    void setUp() {
        leaderboardService = new CoachLeaderboardService(
                coachRepository,
                coachBookingRepository,
                classSessionRepository
        );

        coach1 = coach(21L, "Coach One", "Gym");
        coach2 = coach(22L, "Coach Two", "Fitness");
    }

    private Coach coach(long id, String name, String specialization) {
        User u = new User();
        u.setId(id);
        u.setFullName(name);
        Coach c = new Coach();
        c.setUserId(id);
        c.setUser(u);
        c.setSpecialization(specialization);
        return c;
    }

    private CoachBooking ptBooking(LocalDate date, String status) {
        CoachBooking booking = new CoachBooking();
        booking.setBookingDate(date);
        booking.setStatus(status);
        return booking;
    }

    private ClassSession groupSession(LocalDate date, String status) {
        ClassSession session = new ClassSession();
        session.setSessionDate(date);
        session.setStatus(status);
        return session;
    }

    @Test
    void getLeaderboard_ranksByActiveSessionsWithoutReviewDependency() {
        when(coachRepository.findPublicCoaches()).thenReturn(List.of(coach1, coach2));

        // Coach 1: 1 active PT + 1 cancelled PT + 1 out-of-month session = 1 session
        when(coachBookingRepository.findByCoachId(21L)).thenReturn(List.of(
                ptBooking(LocalDate.of(2026, 11, 5), "booked"),
                ptBooking(LocalDate.of(2026, 11, 6), "cancelled")
        ));
        when(classSessionRepository.findByCoachId(21L)).thenReturn(List.of(
                groupSession(LocalDate.of(2026, 10, 31), "scheduled")
        ));

        // Coach 2: 2 active PT + 1 active group session = 3 sessions -> Rank 1
        when(coachBookingRepository.findByCoachId(22L)).thenReturn(List.of(
                ptBooking(LocalDate.of(2026, 11, 10), "completed"),
                ptBooking(LocalDate.of(2026, 11, 12), "booked")
        ));
        when(classSessionRepository.findByCoachId(22L)).thenReturn(List.of(
                groupSession(LocalDate.of(2026, 11, 15), "scheduled")
        ));

        List<CoachLeaderboardItemDto> result = leaderboardService.getLeaderboard(2026, 11);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).coachId()).isEqualTo(22L);
        assertThat(result.get(0).rankPosition()).isEqualTo(1);
        assertThat(result.get(0).totalSessions()).isEqualTo(3);
        assertThat(result.get(0).averageRating()).isNull();
        assertThat(result.get(0).totalReviews()).isZero();
        assertThat(result.get(0).badge()).contains("Top 1");

        assertThat(result.get(1).coachId()).isEqualTo(21L);
        assertThat(result.get(1).rankPosition()).isEqualTo(2);
        assertThat(result.get(1).totalSessions()).isEqualTo(1);
        assertThat(result.get(1).averageRating()).isNull();
        assertThat(result.get(1).totalReviews()).isZero();
    }

    @Test
    void getLeaderboard_returnsEmptyWhenNoPublicCoaches() {
        when(coachRepository.findPublicCoaches()).thenReturn(List.of());
        assertThat(leaderboardService.getLeaderboard(2026, 11)).isEmpty();
    }
}
