package com.swp391.scms.coaching.service;

import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.coaching.entity.CoachBooking;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lượt check-in cổng quanh các buổi PT 1:1: quét cổng không bao giờ tự ghi nhận điểm danh mà do HLV hoặc quầy lễ tân
 * đánh dấu; lượt check-in bao phủ buổi tập chỉ được hiển thị như gợi ý. Buổi đã kết thúc mà không có ghi nhận đến
 * được tính là vắng mặt (no-show): lượt hạn mức vẫn bị tính đã dùng vì gói không có buổi học bù.
 */
@Service
public class PtAttendanceService {
    /** Lượt vào trung tâm bắt đầu trước giờ học tối đa từng này giờ vẫn bao phủ buổi tập (hội viên đến sớm và ở lại). */
    public static final int STAY_BEFORE_HOURS = 3;

    private final CenterCheckinRepository checkins;

    /** Khởi tạo với repository lượt check-in tại trung tâm. */
    public PtAttendanceService(CenterCheckinRepository checkins) {
        this.checkins = checkins;
    }

    /**
     * Thời điểm bắt đầu lượt check-in cổng hợp lệ khi hội viên ở trong trung tâm trong lúc buổi tập diễn ra
     * (bắt đầu tối đa {@value #STAY_BEFORE_HOURS} giờ trước giờ bắt đầu), hoặc null nếu không có/thiếu dữ liệu booking.
     * Chỉ hiển thị cho nhân viên làm gợi ý, không bao giờ tự ghi nhận điểm danh.
     */
    @Transactional(readOnly = true)
    public LocalDateTime gateCheckinFor(CoachBooking booking) {
        if (booking == null || booking.getMember() == null || booking.getBookingDate() == null
                || booking.getStartTime() == null || booking.getEndTime() == null) return null;
        LocalDateTime start = LocalDateTime.of(booking.getBookingDate(), booking.getStartTime());
        LocalDateTime end = LocalDateTime.of(booking.getBookingDate(), booking.getEndTime());
        return checkins.findCoveringVisitStart(booking.getMember().getUserId(), start.minusHours(STAY_BEFORE_HOURS), start, end);
    }
}
