package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Job nền hằng ngày chuyển các buổi PT 1:1 đã diễn ra và giáo án đã kết thúc sang trạng thái {@code completed}.
 * Buổi 1:1 giữ trạng thái confirmed trong {@link #PT_GRACE_DAYS} ngày để tác vụ quét điểm danh PT (tra cứu 3 ngày)
 * vẫn nhìn thấy chúng.
 */
@Service
public class CoachingCompletionScheduler {
    static final int PT_GRACE_DAYS = 3;
    private static final Logger log = LoggerFactory.getLogger(CoachingCompletionScheduler.class);
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final CoachBookingRepository coachBookings;
    private final TrainingPlanRepository plans;
    private final Clock clock;

    /** Khởi tạo với repository booking PT, repository giáo án và Clock (để test cố định thời gian). */
    public CoachingCompletionScheduler(CoachBookingRepository coachBookings, TrainingPlanRepository plans, Clock clock) {
        this.coachBookings = coachBookings;
        this.plans = plans;
        this.clock = clock;
    }

    /**
     * Chạy theo cron app.coaching.completion.cron (mặc định 00:35 mỗi ngày): gọi completeHeld và ghi log kết
     * quả; lỗi chỉ ghi cảnh báo.
     */
    @Scheduled(cron = "${app.coaching.completion.cron:0 35 0 * * ?}")
    public void sweep() {
        try {
            int[] done = completeHeld();
            log.info("[CoachingCompletion] completed {} 1:1 session(s), {} plan(s)", done[0], done[1]);
        } catch (RuntimeException ex) {
            log.warn("[CoachingCompletion] sweep failed", ex);
        }
    }

    /**
     * Tính "hôm nay" theo giờ Việt Nam; chuyển buổi 1:1 cũ hơn PT_GRACE_DAYS ngày và giáo án đã kết thúc sang
     * completed; trả về mảng {số buổi 1:1, số giáo án} đã chuyển.
     */
    @Transactional
    public int[] completeHeld() {
        LocalDateTime now = clock.instant().atZone(CENTER_ZONE).toLocalDateTime();
        LocalDate today = now.toLocalDate();
        int sessions = coachBookings.completeHeldBefore(today.minusDays(PT_GRACE_DAYS));
        int ended = plans.completeEndedBefore(today, now);
        return new int[]{sessions, ended};
    }
}
