package com.swp391.scms.scheduling.service;

import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Job nền hằng ngày chốt các buổi lớp đã diễn ra, lượt đặt theo buổi và ghi danh khóa học đã kết thúc sang
 * trạng thái {@code completed}.
 *
 * <p>Các bản ghi được giữ mở thêm {@link #GRACE_DAYS} ngày sau buổi học để lượt quét tự động đánh vắng (nhìn lại
 * 7 ngày) và việc chỉnh sửa điểm danh trễ vẫn thấy chúng ở trạng thái booked.
 */
@Service
@ConditionalOnProperty(name = "app.legacy.classes-enabled", havingValue = "true")
public class SessionCompletionScheduler {
    public static final int GRACE_DAYS = 7;
    private static final Logger log = LoggerFactory.getLogger(SessionCompletionScheduler.class);
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ClassSessionRepository sessions;
    private final SessionBookingRepository bookings;
    private final ClassEnrollmentRepository enrollments;
    private final Clock clock;

    /** Khởi tạo với các repository buổi học, đặt chỗ, ghi danh và Clock. */
    public SessionCompletionScheduler(ClassSessionRepository sessions, SessionBookingRepository bookings,
                                      ClassEnrollmentRepository enrollments, Clock clock) {
        this.sessions = sessions;
        this.bookings = bookings;
        this.enrollments = enrollments;
        this.clock = clock;
    }

    /**
     * Chạy theo cron app.scheduling.completion.cron (mặc định 00:30 theo giờ trung tâm) trong một giao dịch duy
     * nhất để các câu lệnh {@code @Modifying} chạy nguyên tử; lỗi được rollback và scheduler ghi nhận.
     */
    @Scheduled(cron = "${app.scheduling.completion.cron:0 30 0 * * ?}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public void sweep() {
        int[] done = completeHeld();
        log.info("[SessionCompletion] completed {} session(s), {} booking(s), {} enrollment(s)", done[0], done[1], done[2]);
    }

    /**
     * Tính mốc cutoff = hôm nay − GRACE_DAYS; hoàn tất đặt chỗ và ghi danh trước rồi mới tới buổi học; trả về
     * {số buổi, số đặt chỗ, số ghi danh}.
     *
     * Trả về {sessions, bookings, enrollments} đã chuyển sang completed.
     */
    @Transactional
    public int[] completeHeld() {
        LocalDateTime now = clock.instant().atZone(CENTER_ZONE).toLocalDateTime();
        LocalDate cutoff = now.toLocalDate().minusDays(GRACE_DAYS);
        // Lượt đặt và ghi danh trước: truy vấn của chúng đọc ngày của buổi, không đọc trạng thái buổi.
        int booked = bookings.completeHeldBefore(cutoff);
        int enrolled = enrollments.completeFinishedBefore(cutoff);
        int held = sessions.completeHeldBefore(cutoff, now);
        return new int[]{held, booked, enrolled};
    }
}
