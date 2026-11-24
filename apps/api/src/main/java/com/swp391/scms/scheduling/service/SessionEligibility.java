package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassSession;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;

/**
 * Các hàm kiểm tra dùng chung khi đặt chỗ/ghi danh: thời gian theo giờ Việt Nam, buổi còn mở, gói tập còn hiệu
 * lực.
 */
final class SessionEligibility {
    private static final ZoneId CENTER_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Constructor private: lớp tiện ích chỉ có hàm static. */
    private SessionEligibility() {
    }

    /** Thời điểm hiện tại theo giờ Việt Nam từ Clock. */
    static LocalDateTime now(Clock clock) {
        return clock.instant().atZone(CENTER_ZONE).toLocalDateTime();
    }

    /** Ngày hôm nay theo giờ Việt Nam từ Clock. */
    static LocalDate today(Clock clock) {
        return clock.instant().atZone(CENTER_ZONE).toLocalDate();
    }

    /** Buổi phải đang scheduled (không bị hủy) và chưa bắt đầu; ngược lại ném BadRequestException. */
    static void ensureBookable(ClassSession session, Clock clock) {
        if ("cancelled".equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException("SCHEDULING_SESSION_CANCELLED", "error.scheduling.session_cancelled",
                    null, "This session has been cancelled");
        }
        if (!"scheduled".equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException("SCHEDULING_SESSION_NOT_BOOKABLE", "error.scheduling.session_not_bookable",
                    null, "This session is not open for booking");
        }
        ensureFuture(session.getSessionDate(), session.getStartTime(), clock);
    }

    /** Ném lỗi nếu thời điểm bắt đầu (ngày + giờ) không nằm trong tương lai. */
    static void ensureFuture(LocalDate date, LocalTime start, Clock clock) {
        if (!LocalDateTime.of(date, start).atZone(CENTER_ZONE).toInstant().isAfter(clock.instant())) {
            throw new BadRequestException("SCHEDULING_PAST_SESSION", "error.scheduling.past_session",
                    null, "Session must start in the future");
        }
    }

    /**
     * Kiểm tra gói tập: phải đang active hôm nay, không bảo lưu vào ngày buổi học và một chu kỳ active phải phủ
     * cả hôm nay lẫn ngày buổi học.
     */
    static void ensureMembershipCoversSession(MembershipSubscriptionRepository subscriptions,
                                             Long memberId, LocalDate sessionDate, Clock clock) {
        LocalDate today = clock.instant().atZone(CENTER_ZONE).toLocalDate();
        if (!subscriptions.hasActiveMembership(memberId, today)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_INVALID",
                    "error.scheduling.membership_expired_or_inactive", null, "Bạn chưa đăng ký gói tập, gói tập chưa được kích hoạt hoặc đã hết hạn. Vui lòng đăng ký gói tập trước khi đặt lịch");
        }
        if (subscriptions.existsApprovedHoldCovering(memberId, sessionDate)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                    new Object[]{sessionDate}, "Gói tập đang bảo lưu vào ngày " + sessionDate);
        }
        // One currently active period must cover both dates; do not combine future renewals.
        if (!subscriptions.hasActiveMembershipCoveringSession(memberId, today, sessionDate)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_NOT_COVERING_SESSION",
                    "error.scheduling.membership_session_not_covered", new Object[]{sessionDate}, "Gói tập hiện tại không bao phủ ngày học " + sessionDate + ". Vui lòng chọn buổi học nằm trong thời hạn gói tập hoặc gia hạn thêm.");
        }
    }

    /**
     * Khóa học phải kết thúc trong thời hạn gói: chu kỳ phủ ngày bắt đầu cộng các lần gia hạn liền mạch; nếu
     * không thì phải gia hạn trước.
     *
     * A course must finish inside the membership: the active period covering its start plus any paid renewal that
     * follows it without a gap. Otherwise the member has to renew first (spec 2026-11-09, section 1.3).
     */
    static void ensureMembershipCoversCourse(MembershipSubscriptionRepository subscriptions,
                                            Long memberId, LocalDate startDate, LocalDate endDate) {
        if (endDate == null) {
            return;
        }
        LocalDate coveredUntil = coverageEnd(subscriptions, memberId, startDate);
        if (coveredUntil == null || coveredUntil.isBefore(endDate)) {
            throw new ForbiddenException("SCHEDULING_COURSE_EXCEEDS_MEMBERSHIP",
                    "error.scheduling.course_exceeds_membership", new Object[]{endDate.toString(), String.valueOf(coveredUntil)},
                    "Khóa học kết thúc ngày " + endDate + " nhưng gói tập chỉ có hiệu lực đến "
                            + coveredUntil + ". Vui lòng gia hạn gói trước khi đăng ký khóa học này.");
        }
    }

    /**
     * Ngày cuối của chuỗi chu kỳ gói đã trả tiền liền mạch phủ ngày from; null nếu không chu kỳ nào phủ.
     *
     * Last day of the unbroken run of paid periods that covers {@code from}; null when nothing covers it.
     */
    static LocalDate coverageEnd(MembershipSubscriptionRepository subscriptions, Long memberId, LocalDate from) {
        var paid = subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .filter(s -> s.getStartDate() != null && s.getEndDate() != null)
                .sorted(java.util.Comparator.comparing(com.swp391.scms.membership.entity.MembershipSubscription::getStartDate))
                .toList();
        LocalDate end = null;
        for (var sub : paid) {
            if (end == null) {
                if (!sub.getStartDate().isAfter(from) && !sub.getEndDate().isBefore(from)) {
                    end = sub.getEndDate();
                }
            } else if (!sub.getStartDate().isAfter(end.plusDays(1)) && sub.getEndDate().isAfter(end)) {
                end = sub.getEndDate();
            }
        }
        return end;
    }

    /** Phòng hạng PLATINUM chỉ cho phép hội viên có gói PLATINUM đang hiệu lực bao phủ ngày học. */
    static void ensurePlatinumRoomAccess(MembershipSubscriptionRepository subscriptions,
                                         Long memberId, com.swp391.scms.facilities.entity.Room room, LocalDate sessionDate) {
        if (room == null || !"PLATINUM".equalsIgnoreCase(room.getTier())) {
            return;
        }
        boolean hasPlatinum = subscriptions.findByMemberUserIdAndStatus(memberId, "active").stream()
                .anyMatch(sub -> !sub.getStartDate().isAfter(sessionDate)
                        && !sub.getEndDate().isBefore(sessionDate)
                        && com.swp391.scms.facilities.PackageBenefits.hasVipRoomAccess(sub.getMembershipPackage()));
        if (!hasPlatinum) {
            throw new ForbiddenException("SCHEDULING_ROOM_PLATINUM_REQUIRED",
                    "error.scheduling.room_platinum_required", null,
                    "Phòng Gym VIP chỉ dành cho hội viên sở hữu gói Platinum");
        }
    }
}
