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
 * Job nền hằng ngày chuyển buổi PT 1:1 đã diễn ra và giáo án đã hết hạn sang trạng thái completed.
 *
 * Settles held 1:1 sessions and ended training plans as {@code completed}. 1:1 sessions stay confirmed for
 * {@link #PT_GRACE_DAYS} days so the PT arrival sweep (3-day lookback) still sees them.
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
     * Tính "hôm nay" theo giờ Việt Nam; hoàn tất buổi 1:1 cũ hơn PT_GRACE_DAYS ngày và giáo án đã kết thúc; trả
     * về mảng {số buổi, số giáo án}.
     *
     * Returns {1:1 sessions, plans} moved to completed.
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
