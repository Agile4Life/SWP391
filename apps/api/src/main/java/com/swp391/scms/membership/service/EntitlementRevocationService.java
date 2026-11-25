package com.swp391.scms.membership.service;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
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
 * Giải phóng các lịch đặt của hội viên khi gói hội viên không còn bao phủ (bảo lưu, hủy gói, hoàn tiền).
 * Lớp học và buổi tập 1:1 với HLV đều yêu cầu gói hội viên còn hiệu lực vào ngày diễn ra, nên mỗi lịch
 * sắp tới chỉ được giữ lại khi vẫn có kỳ gói active bao phủ ngày đó.
 */
@Service
public class EntitlementRevocationService {

    /** Buổi tập 1:1 chỉ được hoàn lại (lượt gói hoặc tiền) nếu yêu cầu bảo lưu được duyệt trước buổi tập ít nhất số ngày này. */
    public static final int PT_HOLD_REFUND_DAYS = 3;

    private final MembershipSubscriptionRepository subscriptions;
    private final EnrollmentService enrollmentService;
    private final CoachBookingRepository coachBookings;
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

    /** Nhận repository gói, dịch vụ đăng ký lớp, repository buổi PT và Clock. */
    public EntitlementRevocationService(MembershipSubscriptionRepository subscriptions,
                                        EnrollmentService enrollmentService,
                                        CoachBookingRepository coachBookings,
                                        Clock clock) {
        this.subscriptions = subscriptions;
        this.enrollmentService = enrollmentService;
        this.coachBookings = coachBookings;
        this.clock = clock;
    }

    /**
     * Hủy các lịch sắp tới (đăng ký lớp, buổi PT) có ngày diễn ra không còn được kỳ gói active (hoặc bảo lưu
     * có ngày đã duyệt) bao phủ; bỏ qua lịch đã bắt đầu. Thông báo cho hội viên và HLV. Trả về số lịch đã hủy.
     */
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
        return cancelled;
    }

    /**
     * Gói đang bảo lưu (frozen) có đợt bảo lưu theo ngày đã duyệt vẫn bao phủ thời hạn của chính nó: gồm các ngày
     * bảo lưu và các ngày sau đó cho đến ngày hết hạn đã được lùi thêm số ngày bảo lưu.
     * Nếu không có kiểm tra này, job quét hằng đêm sẽ hủy toàn bộ lịch đặt sau đợt bảo lưu vì hội viên chưa ở trạng thái "active".
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
     * Hủy các buổi PT 1:1 sắp tới rơi vào khoảng {@code from..to} (đợt bảo lưu đã duyệt). Lượt gói và phí đã trả
     * chỉ được hoàn lại cho hội viên khi nằm trong thời hạn báo trước (PT trước ít nhất 3 ngày); đăng ký khóa
     * học được xử lý riêng bởi {@code EnrollmentService#releaseCoursesForHold}. Thông báo kết quả cho hội viên
     * và HLV.
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
            // Buổi tập 1:1 chỉ được hoàn lại khi yêu cầu bảo lưu được duyệt trước ít nhất PT_HOLD_REFUND_DAYS ngày;
            // sau mốc đó lượt gói (hoặc số tiền đã trả) được tính là đã sử dụng.
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
        return cancelled;
    }

    /**
     * Đóng các khoản thanh toán của một buổi tập 1:1 bị hủy do bảo lưu: khoản pending chuyển failed; khoản đã thu
     * được hoàn vào ví nếu kịp hạn. Trả về {đã trả, đã hoàn}: số tiền hội viên đã trả và số tiền hoàn về ví
     * (bằng 0 khi {@code inTime} là false).
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

    /**
     * Danh sách hội viên đang có lịch đặt lớp học hoặc buổi tập 1:1 sắp tới;
     * job quét hằng ngày sẽ kiểm tra từng người.
     */
    @Transactional(readOnly = true)
    public java.util.Set<Long> membersWithUpcomingBookings() {
        LocalDate today = LocalDate.now(clock);
        java.util.Set<Long> ids = new java.util.TreeSet<>();
        if (classEnrollments != null) ids.addAll(classEnrollments.findMemberIdsWithBookedEnrollments());
        if (sessionBookings != null) ids.addAll(sessionBookings.findMemberIdsWithBooked());
        ids.addAll(coachBookings.findMemberIdsWithUpcomingSessions(today));
        ids.remove(null);
        return ids;
    }

    /** Gửi thông báo "lịch đặt đã được giải phóng" kèm ngày giờ. */
    private void notifyReleased(Long memberId, String bodyKey, Long bookingId, LocalDate date, LocalTime start) {
        notify(memberId, "notifications.membership.booking_released.title", msg(bodyKey, date, hhmm(start)), bookingId);
    }

    /** Gửi thông báo trong ứng dụng cho người dùng (bỏ qua nếu không có dịch vụ thông báo). */
    private void notify(Long userId, String titleKey, String body, Long bookingId) {
        if (notificationService == null || userId == null) return;
        notificationService.send(userId, msg(titleKey), body, "system", null, bookingId);
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** Định dạng giờ HH:mm. */
    private static String hhmm(LocalTime time) {
        return time == null ? "" : time.toString().substring(0, 5);
    }

    /** Lịch đã bắt đầu chưa (ngày đã qua, hoặc hôm nay và giờ bắt đầu không sau hiện tại). */
    private static boolean started(LocalDate date, LocalTime start, LocalDate today, LocalTime nowTime) {
        return date.isBefore(today) || (date.isEqual(today) && start != null && !start.isAfter(nowTime));
    }
}
