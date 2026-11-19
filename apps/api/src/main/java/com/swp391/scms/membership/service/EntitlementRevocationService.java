package com.swp391.scms.membership.service;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.courts.entity.CourtBooking;
import com.swp391.scms.courts.repository.CourtBookingRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.service.EnrollmentService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.function.Predicate;

/**
 * Releases what a member booked once their membership no longer covers it (hold, cancellation, refund).
 * Classes, 1:1 coach sessions and courts all require an active membership on the day they take place,
 * so each upcoming booking is kept only while some active period still covers its date.
 */
@Service
public class EntitlementRevocationService {

    /** A 1:1 session is returned (quota slot or money) only if the hold is approved this many days before it. */
    static final int PT_HOLD_REFUND_DAYS = 3;
    /** A court is returned (quota slot or money) only if the hold is approved this many hours before it. */
    static final int COURT_HOLD_REFUND_HOURS = 2;

    private final MembershipSubscriptionRepository subscriptions;
    private final EnrollmentService enrollmentService;
    private final CoachBookingRepository coachBookings;
    private final CourtBookingRepository courtBookings;
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.notifications.NotificationService notificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.common.i18n.MessageService messageService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.finance.repository.PaymentRepository payments;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.wallet.WalletService walletService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.ClassEnrollmentRepository classEnrollments;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings;

    public EntitlementRevocationService(MembershipSubscriptionRepository subscriptions,
                                        EnrollmentService enrollmentService,
                                        CoachBookingRepository coachBookings,
                                        CourtBookingRepository courtBookings,
                                        Clock clock) {
        this.subscriptions = subscriptions;
        this.enrollmentService = enrollmentService;
        this.coachBookings = coachBookings;
        this.courtBookings = courtBookings;
        this.clock = clock;
    }

    /** Cancels upcoming bookings whose date no active period covers; returns how many were cancelled. */
    @Transactional
    public int revokeUncoveredBookings(Long memberId, String reason) {
        if (memberId == null) return 0;
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        LocalTime nowTime = now.toLocalTime();
        String cancelReason = reason == null || reason.isBlank() ? null
                : reason.length() > 255 ? reason.substring(0, 255) : reason;
        Predicate<LocalDate> covered = date -> subscriptions.hasActiveMembership(memberId, date)
                || coveredByDatedHold(memberId, date);

        int cancelled = enrollmentService.cancelFutureEnrollmentsForMember(memberId, cancelReason, covered);
        for (CoachBooking booking : coachBookings.findFutureConfirmedByMember(memberId, today)) {
            if (started(booking.getBookingDate(), booking.getStartTime(), today, nowTime)
                    || covered.test(booking.getBookingDate())) continue;
            booking.setStatus("cancelled");
            booking.setCancelledAt(now);
            booking.setCancelReason(cancelReason);
            cancelled++;
            notifyReleased(memberId, "notifications.membership.pt_released.body", booking.getId(),
                    booking.getBookingDate(), booking.getStartTime());
            if (booking.getCoach() != null) {
                notify(booking.getCoach().getUserId(), "notifications.coaching.booking.cancelled.title",
                        msg("notifications.coaching.booking.cancelled.body",
                                booking.getMember() != null && booking.getMember().getUser() != null
                                        ? booking.getMember().getUser().getFullName() : "",
                                booking.getBookingDate(), hhmm(booking.getStartTime()), hhmm(booking.getEndTime())),
                        booking.getId());
            }
        }
        for (CourtBooking booking : courtBookings.findUpcomingBookedByMember(memberId, today)) {
            if (started(booking.getBookingDate(), booking.getStartTime(), today, nowTime)
                    || covered.test(booking.getBookingDate())) continue;
            booking.setStatus("cancelled");
            booking.setCancelledAt(now);
            booking.setCancelReason(cancelReason);
            cancelled++;
            notifyReleased(memberId, "notifications.membership.court_released.body", booking.getId(),
                    booking.getBookingDate(), booking.getStartTime());
        }
        return cancelled;
    }

    /**
     * A frozen membership with an approved, dated hold still covers its own period: the days of the hold itself
     * and the days after it, up to the end date pushed back by the held days.
     * Without this the nightly sweep would cancel everything booked after the hold, as the member is "not active" yet.
     */
    private boolean coveredByDatedHold(Long memberId, LocalDate date) {
        return subscriptions.findByMemberUserIdAndStatus(memberId, "frozen").stream()
                .filter(sub -> "APPROVED".equalsIgnoreCase(sub.getHoldStatus())
                        && sub.getHoldStartDate() != null && sub.getHoldEndDate() != null
                        && sub.getStartDate() != null && sub.getEndDate() != null)
                .anyMatch(sub -> {
                    long heldDays = java.time.temporal.ChronoUnit.DAYS.between(sub.getHoldStartDate(), sub.getHoldEndDate()) + 1;
                    return !date.isBefore(sub.getStartDate()) && !date.isAfter(sub.getEndDate().plusDays(heldDays));
                });
    }

    /**
     * Cancels upcoming 1:1 sessions and courts that fall inside {@code from..to} (an approved hold). Package slots and
     * paid fees go back to the member only inside the notice windows; course enrollments are handled by {@code EnrollmentService#releaseCoursesForHold}.
     */
    @Transactional
    public int releaseBookingsBetween(Long memberId, LocalDate from, LocalDate to, String reason) {
        if (memberId == null || from == null || to == null) return 0;
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        LocalTime nowTime = now.toLocalTime();
        String cancelReason = reason == null || reason.isBlank() ? null
                : reason.length() > 255 ? reason.substring(0, 255) : reason;
        Predicate<LocalDate> outside = date -> date.isBefore(from) || date.isAfter(to);
        int cancelled = 0;
        for (CoachBooking booking : coachBookings.findFutureConfirmedByMember(memberId, today)) {
            if (started(booking.getBookingDate(), booking.getStartTime(), today, nowTime)
                    || outside.test(booking.getBookingDate())) continue;
            booking.setStatus("cancelled");
            booking.setCancelledAt(now);
            booking.setCancelReason(cancelReason);
            cancelled++;
            // 1:1 sessions are given back only when the hold is approved at least PT_HOLD_REFUND_DAYS days ahead;
            // after that the package slot (or the money paid) counts as used.
            boolean inTime = !booking.getBookingDate().isBefore(today.plusDays(PT_HOLD_REFUND_DAYS));
            boolean quota = "package_quota".equalsIgnoreCase(booking.getPaymentMethod());
            java.math.BigDecimal[] money = settleCoachPayments(booking, inTime, cancelReason);
            if (quota && !inTime) booking.setQuotaForfeited(true);
            String ptKey = money[0].signum() == 0 && !quota ? "notifications.membership.pt_hold_released.unpaid"
                    : inTime ? (quota ? "notifications.membership.pt_hold_released.quota"
                                      : "notifications.membership.pt_hold_released.refunded")
                    : "notifications.membership.pt_hold_released.forfeited";
            notify(memberId, "notifications.membership.booking_released.title",
                    msg(ptKey, booking.getBookingDate(), hhmm(booking.getStartTime()), money[1].toBigInteger(),
                            PT_HOLD_REFUND_DAYS), booking.getId());
            if (booking.getCoach() != null) {
                notify(booking.getCoach().getUserId(), "notifications.coaching.booking.cancelled.title",
                        msg("notifications.coaching.booking.cancelled.body",
                                booking.getMember() != null && booking.getMember().getUser() != null
                                        ? booking.getMember().getUser().getFullName() : "",
                                booking.getBookingDate(), hhmm(booking.getStartTime()), hhmm(booking.getEndTime())),
                        booking.getId());
            }
        }
        for (CourtBooking booking : courtBookings.findUpcomingBookedByMember(memberId, today)) {
            if (started(booking.getBookingDate(), booking.getStartTime(), today, nowTime)
                    || outside.test(booking.getBookingDate())) continue;
            booking.setStatus("cancelled");
            booking.setCancelledAt(now);
            booking.setCancelReason(cancelReason);
            cancelled++;
            // A court is given back only when the hold is approved at least COURT_HOLD_REFUND_HOURS before it starts.
            boolean inTime = !booking.getBookingDate().atTime(booking.getStartTime())
                    .isBefore(now.plusHours(COURT_HOLD_REFUND_HOURS));
            boolean quota = "package_quota".equalsIgnoreCase(booking.getPaymentMethod());
            java.math.BigDecimal[] money = settleCourtPayments(booking, inTime, cancelReason);
            if (quota && !inTime) booking.setQuotaForfeited(true);
            String courtKey = money[0].signum() == 0 && !quota ? "notifications.membership.court_hold_released.free"
                    : inTime ? (quota ? "notifications.membership.court_hold_released.quota"
                                      : "notifications.membership.court_hold_released.refunded")
                    : "notifications.membership.court_hold_released.forfeited";
            notify(memberId, "notifications.membership.booking_released.title",
                    msg(courtKey, booking.getBookingDate(), hhmm(booking.getStartTime()), money[1].toBigInteger(),
                            COURT_HOLD_REFUND_HOURS), booking.getId());
        }
        return cancelled;
    }

    /**
     * Closes the payments of a 1:1 session cancelled by a hold. Returns {paid, refunded}: what the member had paid,
     * and what went back to the wallet (nothing when {@code inTime} is false).
     */
    private java.math.BigDecimal[] settleCoachPayments(CoachBooking booking, boolean inTime, String reason) {
        java.math.BigDecimal paid = java.math.BigDecimal.ZERO;
        java.math.BigDecimal refunded = java.math.BigDecimal.ZERO;
        if (payments != null) {
            for (var payment : payments.findAllByCoachBookingId(booking.getId())) {
                if ("pending".equals(payment.getStatus())) {
                    payment.setStatus("failed");
                } else if ("success".equals(payment.getStatus()) && payment.netAmount() != null
                        && payment.netAmount().signum() > 0) {
                    java.math.BigDecimal net = payment.netAmount();
                    paid = paid.add(net);
                    if (inTime) {
                        payment.setRefundedAmount(payment.getAmount());
                        payment.setStatus("refunded");
                        refunded = refunded.add(net);
                    }
                }
            }
        }
        if (refunded.signum() > 0 && walletService != null && booking.getMember() != null) {
            walletService.creditCoachBookingRefund(booking.getMember().getUserId(), refunded,
                    "COACH_REFUND_" + booking.getId(), reason);
        }
        return new java.math.BigDecimal[]{paid, refunded};
    }

    /** Same as {@link #settleCoachPayments} for a court booking, including legacy bookings paid without a payment row. */
    private java.math.BigDecimal[] settleCourtPayments(CourtBooking booking, boolean inTime, String reason) {
        java.math.BigDecimal paid = java.math.BigDecimal.ZERO;
        java.math.BigDecimal refunded = java.math.BigDecimal.ZERO;
        boolean hasRows = false;
        if (payments != null) {
            for (var payment : payments.findAllByCourtBookingId(booking.getId())) {
                hasRows = true;
                if ("pending".equals(payment.getStatus())) {
                    payment.setStatus("failed");
                } else if ("success".equals(payment.getStatus()) && payment.netAmount() != null
                        && payment.netAmount().signum() > 0) {
                    java.math.BigDecimal net = payment.netAmount();
                    paid = paid.add(net);
                    if (inTime) {
                        payment.setRefundedAmount(payment.getAmount());
                        payment.setStatus("refunded");
                    }
                }
            }
        }
        if (!hasRows && "paid".equals(booking.getPaymentStatus()) && booking.getPrice() != null) {
            paid = booking.getPrice();
        }
        if (inTime) refunded = paid;
        if (paid.signum() > 0 && inTime) booking.setPaymentStatus("refunded");
        if (refunded.signum() > 0 && walletService != null && booking.getMember() != null) {
            walletService.creditCourtRefund(booking.getMember().getId(), refunded,
                    "COURT_REFUND_" + booking.getId(), reason);
        }
        return new java.math.BigDecimal[]{paid, refunded};
    }

    /** Members holding a class booking, an upcoming 1:1 session or an upcoming court; the daily sweep checks each. */
    @Transactional(readOnly = true)
    public java.util.Set<Long> membersWithUpcomingBookings() {
        LocalDate today = LocalDate.now(clock);
        java.util.Set<Long> ids = new java.util.TreeSet<>();
        if (classEnrollments != null) ids.addAll(classEnrollments.findMemberIdsWithBookedEnrollments());
        if (sessionBookings != null) ids.addAll(sessionBookings.findMemberIdsWithBooked());
        ids.addAll(coachBookings.findMemberIdsWithUpcomingSessions(today));
        ids.addAll(courtBookings.findMemberIdsWithUpcomingBookings(today));
        ids.remove(null);
        return ids;
    }

    private void notifyReleased(Long memberId, String bodyKey, Long bookingId, LocalDate date, LocalTime start) {
        notify(memberId, "notifications.membership.booking_released.title", msg(bodyKey, date, hhmm(start)), bookingId);
    }

    private void notify(Long userId, String titleKey, String body, Long bookingId) {
        if (notificationService == null || userId == null) return;
        notificationService.send(userId, msg(titleKey), body, "system", null, bookingId);
    }

    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    private static String hhmm(LocalTime time) {
        return time == null ? "" : time.toString().substring(0, 5);
    }

    private static boolean started(LocalDate date, LocalTime start, LocalDate today, LocalTime nowTime) {
        return date.isBefore(today) || (date.isEqual(today) && start != null && !start.isAfter(nowTime));
    }
}
