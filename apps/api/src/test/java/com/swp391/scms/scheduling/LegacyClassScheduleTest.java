package com.swp391.scms.scheduling;

import static org.assertj.core.api.Assertions.assertThat;

import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Reported: a class without recurring days showed "Mon, Wed, Fri" (a UI default) while its sessions ran on Tue/Thu.
 * The class list now derives the schedule from the real sessions.
 */
class LegacyClassScheduleTest {

    private static ClassSession session(LocalDate date, String status) {
        ClassSession s = new ClassSession();
        s.setSessionDate(date);
        s.setStartTime(LocalTime.of(17, 30));
        s.setEndTime(LocalTime.of(18, 30));
        s.setStatus(status);
        return s;
    }

    @Test
    void classWithoutRecurringDaysTakesWeekdaysAndDatesFromItsSessions() {
        GymClass legacy = new GymClass();
        legacy.setName("Boxing Cardio Chiều");
        List<ClassSession> sessions = List.of(
                session(LocalDate.of(2026, 11, 5), "scheduled"),   // Thursday
                session(LocalDate.of(2026, 11, 10), "scheduled"),  // Tuesday
                session(LocalDate.of(2026, 11, 26), "scheduled"),  // Thursday
                session(LocalDate.of(2026, 11, 30), "cancelled")); // Monday, cancelled: not part of the schedule

        GymClassDto dto = new SchedulingMapper().toDto(legacy, sessions);

        assertThat(dto.recurringDays()).isEqualTo("TUESDAY,THURSDAY");
        assertThat(dto.startDate()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(dto.startTime()).isEqualTo(LocalTime.of(17, 30));
    }

    @Test
    void classWithItsOwnScheduleIsLeftAlone() {
        GymClass gymClass = new GymClass();
        gymClass.setRecurringDays("MONDAY,WEDNESDAY");
        gymClass.setStartDate(LocalDate.of(2026, 11, 2));
        gymClass.setEndDate(LocalDate.of(2026, 11, 25));

        assertThat(SchedulingMapper.lacksSchedule(gymClass)).isFalse();
        GymClassDto dto = new SchedulingMapper().toDto(gymClass, List.of(session(LocalDate.of(2026, 11, 5), "scheduled")));
        assertThat(dto.recurringDays()).isEqualTo("MONDAY,WEDNESDAY");
    }
}
