package com.swp391.scms.coaching;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.service.PtAttendanceService;
import com.swp391.scms.users.entity.Member;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/**
 * Bộ kiểm thử cho service PtAttendanceService.
 * Lượt check-in tại cổng phủ khung giờ buổi tập 1:1 chỉ được báo lại làm gợi ý, không bao giờ tự ghi nhận điểm danh đến buổi.
 */
class PtAttendanceServiceTest {
    private final CenterCheckinRepository checkins = mock(CenterCheckinRepository.class);
    private final PtAttendanceService service = new PtAttendanceService(checkins);

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (booking). */
    private CoachBooking booking() {
        Member member = new Member();
        member.setUserId(100L);
        CoachBooking b = new CoachBooking();
        b.setMember(member);
        b.setBookingDate(LocalDate.of(2026, 11, 9));
        b.setStartTime(LocalTime.of(17, 0));
        b.setEndTime(LocalTime.of(18, 0));
        return b;
    }

    /** Kiểm thử: ghi nhận lượt vào bắt đầu tới ba giờ trước và phủ buổi PT. */
    @Test
    void reportsAVisitThatBeganUpToThreeHoursBeforeAndCoveredTheSession() {
        CoachBooking b = booking();
        LocalDateTime cameIn = LocalDateTime.of(2026, 11, 9, 15, 30);
        when(checkins.findCoveringVisitStart(100L, LocalDateTime.of(2026, 11, 9, 14, 0),
                LocalDateTime.of(2026, 11, 9, 17, 0), LocalDateTime.of(2026, 11, 9, 18, 0))).thenReturn(cameIn);

        assertEquals(cameIn, service.gateCheckinFor(b));
        assertNull(b.getAttendedAt());
    }

    /** Kiểm thử: không ghi nhận gì khi không có lượt vào phủ hoặc lượt đặt chưa hoàn tất. */
    @Test
    void reportsNothingWithoutACoveringVisitOrForAnIncompleteBooking() {
        assertNull(service.gateCheckinFor(booking()));
        CoachBooking noTime = booking();
        noTime.setStartTime(null);
        assertNull(service.gateCheckinFor(noTime));
        assertNull(service.gateCheckinFor(null));
    }
}
