package com.swp391.scms.scheduling.scheduler;

import com.swp391.scms.scheduling.service.WaitlistPromotionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * SCRUM-112: Background scheduler running every 15 minutes to expire overdue
 * waitlist notifications and promote waiting members.
 */
@Component
public class WaitlistPromotionScheduler {

    private static final Logger log = LoggerFactory.getLogger(WaitlistPromotionScheduler.class);

    private final WaitlistPromotionService promotionService;

    public WaitlistPromotionScheduler(WaitlistPromotionService promotionService) {
        this.promotionService = promotionService;
    }

    /**
     * Runs every 15 minutes: at second 0 of minute 0, 15, 30, 45.
     */
    @Scheduled(cron = "0 */15 * * * *")
    public void scheduleWaitlistPromotion() {
        log.info("Starting WaitlistPromotionScheduler trigger...");
        long start = System.currentTimeMillis();
        try {
            int expiredCount = promotionService.processExpiredWaitlists();
            long elapsed = System.currentTimeMillis() - start;
            log.info("Completed WaitlistPromotionScheduler in {} ms. Expired entries: {}", elapsed, expiredCount);
        } catch (Exception ex) {
            log.error("Error occurred during WaitlistPromotionScheduler execution: {}", ex.getMessage(), ex);
        }
    }
}
