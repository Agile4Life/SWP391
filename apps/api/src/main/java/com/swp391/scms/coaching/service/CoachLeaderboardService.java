package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.dto.CoachLeaderboardItemDto;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Computes the monthly Coach Leaderboard purely from sessions taught (PT 1:1 bookings and class sessions),
 * without depending on coach reviews or monthly review records.
 */
@Service
public class CoachLeaderboardService {

    private final CoachRepository coachRepository;
    private final CoachBookingRepository coachBookingRepository;
    private final ClassSessionRepository classSessionRepository;

    @Autowired
    public CoachLeaderboardService(CoachRepository coachRepository,
                                   CoachBookingRepository coachBookingRepository,
                                   ClassSessionRepository classSessionRepository) {
        this.coachRepository = coachRepository;
        this.coachBookingRepository = coachBookingRepository;
        this.classSessionRepository = classSessionRepository;
    }

    @Transactional(readOnly = true)
    public List<CoachLeaderboardItemDto> getLeaderboard(Integer year, Integer month) {
        LocalDate now = LocalDate.now();
        int targetYear = (year != null && year > 2000) ? year : now.getYear();
        int targetMonth = (month != null && month >= 1 && month <= 12) ? month : now.getMonthValue();

        LocalDate firstDay = LocalDate.of(targetYear, targetMonth, 1);
        LocalDate lastDay = firstDay.withDayOfMonth(firstDay.lengthOfMonth());

        List<Coach> coaches = coachRepository.findPublicCoaches();
        if (coaches == null || coaches.isEmpty()) {
            return List.of();
        }

        record CoachSessionCount(Coach coach, int totalSessions, String coachName) {}

        List<CoachSessionCount> ranked = new ArrayList<>();
        for (Coach coach : coaches) {
            int ptCount = countActivePtBookings(coach.getUserId(), firstDay, lastDay);
            int groupCount = countActiveGroupSessions(coach.getUserId(), firstDay, lastDay);
            int totalSessions = ptCount + groupCount;
            String coachName = coach.getUser() != null && coach.getUser().getFullName() != null
                    ? coach.getUser().getFullName()
                    : "Huấn luyện viên";
            ranked.add(new CoachSessionCount(coach, totalSessions, coachName));
        }

        ranked.sort(Comparator.comparingInt(CoachSessionCount::totalSessions).reversed()
                .thenComparing(CoachSessionCount::coachName, String.CASE_INSENSITIVE_ORDER)
                .thenComparing(entry -> entry.coach().getUserId(), Comparator.nullsLast(Long::compareTo)));

        List<CoachLeaderboardItemDto> result = new ArrayList<>(ranked.size());
        for (int i = 0; i < ranked.size(); i++) {
            int rank = i + 1;
            CoachSessionCount entry = ranked.get(i);
            Coach coach = entry.coach();
            String avatar = coach.getUser() != null ? coach.getUser().getAvatarUrl() : null;

            result.add(new CoachLeaderboardItemDto(
                    rank,
                    coach.getUserId(),
                    entry.coachName(),
                    coach.getSpecialization(),
                    avatar,
                    null,
                    0,
                    entry.totalSessions(),
                    badgeForRank(rank, entry.totalSessions()),
                    null,
                    null
            ));
        }
        return result;
    }

    private int countActivePtBookings(Long coachId, LocalDate firstDay, LocalDate lastDay) {
        List<CoachBooking> bookings = coachBookingRepository.findByCoachId(coachId);
        if (bookings == null) return 0;
        int count = 0;
        for (CoachBooking b : bookings) {
            if (b.getBookingDate() != null
                    && !b.getBookingDate().isBefore(firstDay)
                    && !b.getBookingDate().isAfter(lastDay)
                    && !"cancelled".equalsIgnoreCase(b.getStatus())) {
                count++;
            }
        }
        return count;
    }

    private int countActiveGroupSessions(Long coachId, LocalDate firstDay, LocalDate lastDay) {
        List<ClassSession> sessions = classSessionRepository.findByCoachId(coachId);
        if (sessions == null) return 0;
        int count = 0;
        for (ClassSession s : sessions) {
            if (s.getSessionDate() != null
                    && !s.getSessionDate().isBefore(firstDay)
                    && !s.getSessionDate().isAfter(lastDay)
                    && !"cancelled".equalsIgnoreCase(s.getStatus())) {
                count++;
            }
        }
        return count;
    }

    private static String badgeForRank(int rank, int totalSessions) {
        if (totalSessions <= 0) {
            return null;
        }
        return switch (rank) {
            case 1 -> "Top 1: HLV Năng Suất 🏆";
            case 2 -> "Top 2: HLV Tích Cực 🥈";
            case 3 -> "Top 3: HLV Tận Tâm 🥉";
            default -> null;
        };
    }
}
