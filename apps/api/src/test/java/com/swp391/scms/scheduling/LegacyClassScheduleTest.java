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
 * Bộ kiểm thử cho LegacyClassSchedule (lịch lớp học dữ liệu cũ).
 *
 * Lỗi đã báo cáo: lớp không có ngày lặp định kỳ lại hiển thị "Mon, Wed, Fri" (giá trị mặc định trên giao diện)
 * trong khi các buổi học thực tế diễn ra vào Thứ 3/Thứ 5. Danh sách lớp nay suy ra lịch học từ các buổi học thực tế.
 */
class LegacyClassScheduleTest {

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (session). */
    private static ClassSession session(LocalDate date, String status) {
        ClassSession s = new ClassSession();
        s.setSessionDate(date);
        s.setStartTime(LocalTime.of(17, 30));
        s.setEndTime(LocalTime.of(18, 30));
        s.setStatus(status);
        return s;
    }

    /** Kiểm thử: lớp không có lịch định kỳ thì lấy thứ trong tuần và ngày từ các buổi của nó. */
    @Test
    void classWithoutRecurringDaysTakesWeekdaysAndDatesFromItsSessions() {
        GymClass legacy = new GymClass();
        legacy.setName("Boxing Cardio Chiều");
        List<ClassSession> sessions = List.of(
                session(LocalDate.of(2026, 11, 5), "scheduled"),   // Thứ 5
                session(LocalDate.of(2026, 11, 10), "scheduled"),  // Thứ 3
                session(LocalDate.of(2026, 11, 26), "scheduled"),  // Thứ 5
                session(LocalDate.of(2026, 11, 30), "cancelled")); // Thứ 2, đã hủy: không tính vào lịch học

        GymClassDto dto = new SchedulingMapper().toDto(legacy, sessions);

        assertThat(dto.recurringDays()).isEqualTo("TUESDAY,THURSDAY");
        assertThat(dto.startDate()).isEqualTo(LocalDate.of(2026, 11, 5));
        assertThat(dto.endDate()).isEqualTo(LocalDate.of(2026, 11, 26));
        assertThat(dto.startTime()).isEqualTo(LocalTime.of(17, 30));
    }

    /** Kiểm thử: lớp đã có lịch riêng thì giữ nguyên, không bị ghi đè. */
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
