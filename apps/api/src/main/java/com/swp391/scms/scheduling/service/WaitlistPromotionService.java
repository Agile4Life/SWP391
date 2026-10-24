package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.entity.ClassWaitlist;
import com.swp391.scms.scheduling.event.WaitlistPromotedEvent;
import com.swp391.scms.scheduling.repository.ClassWaitlistRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

/**
 * SCRUM-112: Waitlist promotion service for expiring overdue notified waitlists
 * and automatically promoting the next member in the queue (24h promotion window).
 * Implements chunking/paging to prevent OutOfMemory when handling high volumes.
 */
@Service
public class WaitlistPromotionService {

    private static final Logger log = LoggerFactory.getLogger(WaitlistPromotionService.class);
    private static final int CHUNK_SIZE = 50;
    private static final int PROMOTION_WINDOW_HOURS = 24;

    private final ClassWaitlistRepository waitlistRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageService messageService;
    private final Clock clock;

    public WaitlistPromotionService(ClassWaitlistRepository waitlistRepository,
                                  NotificationService notificationService,
                                  ApplicationEventPublisher eventPublisher,
                                  MessageService messageService,
                                  Clock clock) {
        this.waitlistRepository = waitlistRepository;
        this.notificationService = notificationService;
        this.eventPublisher = eventPublisher;
        this.messageService = messageService;
        this.clock = clock;
    }

    public WaitlistPromotionService(ClassWaitlistRepository waitlistRepository,
                                  NotificationService notificationService,
                                  ApplicationEventPublisher eventPublisher) {
        this(waitlistRepository, notificationService, eventPublisher, null, Clock.systemUTC());
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Periodically processes expired waitlist entries using chunking,
     * expires overdue notifications (> 24 hours or past reservation expiry),
     * and promotes the next waiting users FIFO by requested_at.
     *
     * @return count of processed expired entries
     */
    @Transactional
    public int processExpiredWaitlists() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime cutoff24h = now.minusHours(PROMOTION_WINDOW_HOURS);
        Set<Long> affectedClassIds = new HashSet<>();
        int totalExpired = 0;

        // Process chunk by chunk using PageRequest(0, CHUNK_SIZE)
        // Since we update status to 'expired', subsequent page 0 calls fetch remaining unexpired items.
        while (true) {
            Page<ClassWaitlist> expiredPage = waitlistRepository.findByStatusAndNotifiedAtBefore(
                    "notified", cutoff24h, PageRequest.of(0, CHUNK_SIZE));

            if (expiredPage.isEmpty()) {
                // Also check for entries where reservationExpiresAt has passed
                expiredPage = waitlistRepository.findByStatusAndReservationExpiresAtLessThan(
                        "notified", now, PageRequest.of(0, CHUNK_SIZE));
                if (expiredPage.isEmpty()) {
                    break;
                }
            }

            for (ClassWaitlist item : expiredPage.getContent()) {
                item.setStatus("expired");
                waitlistRepository.save(item);
                totalExpired++;

                if (item.getGymClass() != null && item.getGymClass().getId() != null) {
                    affectedClassIds.add(item.getGymClass().getId());
                }

                if (item.getMember() != null && item.getMember().getUserId() != null) {
                    String className = item.getGymClass() != null ? item.getGymClass().getName() : "";
                    notificationService.send(
                            item.getMember().getUserId(),
                            msg("notifications.waitlist.expired.title"),
                            msg("notifications.waitlist.expired.body", className),
                            "schedule_change",
                            "class_session",
                            item.getId()
                    );
                }
            }
            waitlistRepository.flush();

            // Safety check to prevent infinite loop if database didn't update status
            if (expiredPage.getNumberOfElements() < CHUNK_SIZE) {
                break;
            }
        }

        // Promote next in line for each affected gym class
        int totalPromoted = 0;
        for (Long classId : affectedClassIds) {
            totalPromoted += promoteNextCandidate(classId, now);
        }

        log.info("Waitlist promotion job finished. Expired: {}, Promoted: {} across {} classes.",
                totalExpired, totalPromoted, affectedClassIds.size());
        return totalExpired;
    }

    /**
     * Promotes the next candidate for a specific gym class with 24 hours reservation window.
     */
    @Transactional
    public int promoteNextCandidate(Long classId, LocalDateTime now) {
        if (classId == null) {
            return 0;
        }

        Optional<ClassWaitlist> nextCandidateOpt = waitlistRepository
                .findFirstByGymClassIdAndStatusOrderByRequestedAtAsc(classId, "waiting");

        if (nextCandidateOpt.isEmpty()) {
            return 0;
        }

        ClassWaitlist next = nextCandidateOpt.get();
        next.setStatus("notified");
        next.setNotifiedAt(now);
        LocalDateTime expiry = now.plusHours(PROMOTION_WINDOW_HOURS);
        next.setReservationExpiresAt(expiry);
        ClassWaitlist saved = waitlistRepository.saveAndFlush(next);

        String className = saved.getGymClass() != null ? saved.getGymClass().getName() : "";
        Long memberUserId = saved.getMember() != null ? saved.getMember().getUserId() : null;

        // Publish event for decoupling and event-driven listeners
        WaitlistPromotedEvent event = new WaitlistPromotedEvent(
                saved.getId(),
                classId,
                className,
                memberUserId,
                now,
                expiry
        );
        eventPublisher.publishEvent(event);

        // Send in-app notification
        if (memberUserId != null) {
            notificationService.send(
                    memberUserId,
                    msg("notifications.waitlist.promoted.title"),
                    msg("notifications.waitlist.promoted.body", className),
                    "schedule_change",
                    "class_session",
                    saved.getId()
            );
        }

        log.info("Promoted waitlist entry {} for user {} in class {} with expiry at {}",
                saved.getId(), memberUserId, classId, expiry);
        return 1;
    }
}
