package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.PackageBenefits;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassSession;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

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

    /** Kiểm tra thời điểm bắt đầu (ngày + giờ theo giờ Việt Nam) có nằm sau thời điểm hiện tại hay không. */
    static boolean isFuture(LocalDate date, LocalTime start, Clock clock) {
        return LocalDateTime.of(date, start).atZone(CENTER_ZONE).toInstant().isAfter(clock.instant());
    }

    /** Ném lỗi nếu thời điểm bắt đầu (ngày + giờ) không nằm trong tương lai. */
    static void ensureFuture(LocalDate date, LocalTime start, Clock clock) {
        if (!isFuture(date, start, clock)) {
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
        // Một kỳ đang hoạt động phải bao phủ cả hai ngày; không gộp các kỳ gia hạn tương lai.
        if (!subscriptions.hasActiveMembershipCoveringSession(memberId, today, sessionDate)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_NOT_COVERING_SESSION",
                    "error.scheduling.membership_session_not_covered", new Object[]{sessionDate}, "Gói tập hiện tại không bao phủ ngày học " + sessionDate + ". Vui lòng chọn buổi học nằm trong thời hạn gói tập hoặc gia hạn thêm.");
        }
    }

    /**
     * Khóa học phải bắt đầu từ hội viên đang có gói active không bảo lưu vào hôm nay, chuỗi gia hạn liền mạch
     * bao phủ xuyên suốt tới hết khóa ({@code coverageEnd >= endDate}), và không có đợt bảo lưu đã duyệt nào
     * chồng lên các buổi học của khóa.
     */
    static void ensureMembershipCoversCourse(MembershipSubscriptionRepository subscriptions,
                                             Long memberId,
                                             LocalDate startDate,
                                             LocalDate endDate,
                                             List<LocalDate> scheduledDates,
                                             Clock clock) {
        LocalDate today = today(clock);
        if (!subscriptions.hasActiveMembership(memberId, today)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_INVALID",
                    "error.scheduling.membership_expired_or_inactive", null,
                    "Bạn chưa đăng ký gói tập, gói tập chưa được kích hoạt hoặc đã hết hạn. Vui lòng đăng ký gói tập trước khi đặt lịch");
        }
        List<MembershipSubscription> activeSubs = safeList(subscriptions.findByMemberUserIdAndStatus(memberId, "active"));
        List<MembershipSubscription> frozenSubs = safeList(subscriptions.findByMemberUserIdAndStatus(memberId, "frozen"));

        if (subscriptions.existsApprovedHoldCovering(memberId, today) || isHeldOnAny(activeSubs, frozenSubs, today)) {
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                    new Object[]{today}, "Gói tập đang bảo lưu vào ngày " + today);
        }

        LocalDate effectiveStart = startDate != null ? startDate : today;
        LocalDate effectiveEnd = endDate != null ? endDate : effectiveStart;
        if (scheduledDates != null && !scheduledDates.isEmpty()) {
            LocalDate lastScheduled = scheduledDates.stream()
                    .filter(Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(null);
            if (lastScheduled != null && lastScheduled.isAfter(effectiveEnd)) {
                effectiveEnd = lastScheduled;
            }
        }

        LocalDate coveredUntil = coverageEnd(activeSubs, today);
        if (coveredUntil == null || coveredUntil.isBefore(effectiveEnd)) {
            if (endDate != null || coveredUntil != null) {
                throw new ForbiddenException("SCHEDULING_COURSE_EXCEEDS_MEMBERSHIP",
                        "error.scheduling.course_exceeds_membership",
                        new Object[]{effectiveEnd.toString(), String.valueOf(coveredUntil)},
                        "Khóa học kết thúc ngày " + effectiveEnd + " nhưng gói tập chỉ có hiệu lực đến "
                                + coveredUntil + ". Vui lòng gia hạn gói trước khi đăng ký khóa học này.");
            }
            throw new ForbiddenException("SCHEDULING_MEMBERSHIP_NOT_COVERING_SESSION",
                    "error.scheduling.membership_session_not_covered", new Object[]{effectiveStart},
                    "Gói tập hiện tại không bao phủ ngày học " + effectiveStart
                            + ". Vui lòng chọn buổi học nằm trong thời hạn gói tập hoặc gia hạn thêm.");
        }

        if (scheduledDates != null && !scheduledDates.isEmpty()) {
            for (LocalDate d : scheduledDates) {
                if (d != null && isHeldOnAny(activeSubs, frozenSubs, d)) {
                    throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                            new Object[]{d}, "Gói tập đang bảo lưu vào ngày " + d);
                }
            }
            if (subscriptions.existsApprovedHoldCovering(memberId, effectiveStart)) {
                throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                        new Object[]{effectiveStart}, "Gói tập đang bảo lưu vào ngày " + effectiveStart);
            }
        } else {
            LocalDate overlapDate = firstHoldOverlap(activeSubs, frozenSubs, effectiveStart, effectiveEnd);
            if (overlapDate != null) {
                throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                        new Object[]{overlapDate}, "Gói tập đang bảo lưu vào ngày " + overlapDate);
            }
            if (subscriptions.existsApprovedHoldCovering(memberId, effectiveStart)) {
                throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                        new Object[]{effectiveStart}, "Gói tập đang bảo lưu vào ngày " + effectiveStart);
            }
            if (!effectiveEnd.equals(effectiveStart) && subscriptions.existsApprovedHoldCovering(memberId, effectiveEnd)) {
                throw new ForbiddenException("SCHEDULING_MEMBERSHIP_ON_HOLD", "error.scheduling.membership_on_hold",
                        new Object[]{effectiveEnd}, "Gói tập đang bảo lưu vào ngày " + effectiveEnd);
            }
        }
    }

    /**
     * Ngày cuối của chuỗi chu kỳ gói đã trả tiền liền mạch phủ ngày from; null nếu không chu kỳ nào phủ.
     */
    static LocalDate coverageEnd(MembershipSubscriptionRepository subscriptions, Long memberId, LocalDate from) {
        return coverageEnd(safeList(subscriptions.findByMemberUserIdAndStatus(memberId, "active")), from);
    }

    /** Ngày cuối của chuỗi chu kỳ gói liền mạch phủ ngày {@code from} trên danh sách kỳ gói đã nạp. */
    private static LocalDate coverageEnd(List<MembershipSubscription> subs, LocalDate from) {
        if (from == null || subs == null || subs.isEmpty()) {
            return null;
        }
        var paid = subs.stream()
                .filter(s -> s != null && s.getStartDate() != null && s.getEndDate() != null)
                .sorted(Comparator.comparing(MembershipSubscription::getStartDate))
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
                                         Long memberId, Room room, LocalDate sessionDate) {
        if (room == null || !"PLATINUM".equalsIgnoreCase(room.getTier())) {
            return;
        }
        boolean hasPlatinum = safeList(subscriptions.findByMemberUserIdAndStatus(memberId, "active")).stream()
                .anyMatch(sub -> sub != null && sub.getStartDate() != null && sub.getEndDate() != null
                        && !sub.getStartDate().isAfter(sessionDate)
                        && !sub.getEndDate().isBefore(sessionDate)
                        && PackageBenefits.hasVipRoomAccess(sub));
        if (!hasPlatinum) {
            throw new ForbiddenException("SCHEDULING_ROOM_PLATINUM_REQUIRED",
                    "error.scheduling.room_platinum_required", null,
                    "Phòng Gym VIP chỉ dành cho hội viên sở hữu gói Platinum");
        }
    }

    /**
     * Phòng hạng PLATINUM yêu cầu hội viên có gói PLATINUM xuyên suốt toàn bộ các buổi học (hoặc trọn khoảng
     * {@code [startDate, endDate]} khi chưa có danh sách buổi).
     */
    static void ensurePlatinumRoomAccessForCourse(MembershipSubscriptionRepository subscriptions,
                                                  Long memberId,
                                                  Room room,
                                                  LocalDate startDate,
                                                  LocalDate endDate,
                                                  List<LocalDate> scheduledDates) {
        if (room == null || !"PLATINUM".equalsIgnoreCase(room.getTier())) {
            return;
        }
        List<MembershipSubscription> platinumSubs = safeList(subscriptions.findByMemberUserIdAndStatus(memberId, "active"))
                .stream()
                .filter(sub -> sub != null && sub.getStartDate() != null && sub.getEndDate() != null
                        && PackageBenefits.hasVipRoomAccess(sub.getMembershipPackage()))
                .toList();

        boolean covered;
        if (scheduledDates != null && !scheduledDates.isEmpty()) {
            covered = scheduledDates.stream()
                    .filter(Objects::nonNull)
                    .allMatch(date -> platinumSubs.stream()
                            .anyMatch(sub -> !sub.getStartDate().isAfter(date) && !sub.getEndDate().isBefore(date)));
        } else {
            LocalDate effectiveEnd = endDate != null ? endDate : startDate;
            LocalDate platinumUntil = coverageEnd(platinumSubs, startDate);
            covered = platinumUntil != null && (effectiveEnd == null || !platinumUntil.isBefore(effectiveEnd));
        }

        if (!covered) {
            throw new ForbiddenException("SCHEDULING_ROOM_PLATINUM_REQUIRED",
                    "error.scheduling.room_platinum_required", null,
                    "Phòng Gym VIP chỉ dành cho hội viên sở hữu gói Platinum");
        }
    }

    private static List<MembershipSubscription> safeList(List<MembershipSubscription> list) {
        return list == null ? List.of() : list;
    }

    private static boolean isHeldOn(MembershipSubscription sub, LocalDate date) {
        if (sub == null || date == null || !"APPROVED".equalsIgnoreCase(sub.getHoldStatus())) {
            return false;
        }
        LocalDate holdStart = sub.getHoldStartDate();
        LocalDate holdEnd = sub.getHoldEndDate();
        if (holdStart == null) {
            return false;
        }
        return !date.isBefore(holdStart) && (holdEnd == null || !date.isAfter(holdEnd));
    }

    private static boolean isHeldOnAny(List<MembershipSubscription> activeSubs,
                                       List<MembershipSubscription> frozenSubs,
                                       LocalDate date) {
        for (MembershipSubscription sub : activeSubs) {
            if (isHeldOn(sub, date)) {
                return true;
            }
        }
        for (MembershipSubscription sub : frozenSubs) {
            if (isHeldOn(sub, date)) {
                return true;
            }
        }
        return false;
    }

    private static LocalDate firstHoldOverlap(List<MembershipSubscription> activeSubs,
                                              List<MembershipSubscription> frozenSubs,
                                              LocalDate start,
                                              LocalDate end) {
        LocalDate earliest = null;
        for (List<MembershipSubscription> group : List.of(activeSubs, frozenSubs)) {
            for (MembershipSubscription sub : group) {
                if (sub == null || !"APPROVED".equalsIgnoreCase(sub.getHoldStatus())
                        || sub.getHoldStartDate() == null) {
                    continue;
                }
                LocalDate holdStart = sub.getHoldStartDate();
                LocalDate holdEnd = sub.getHoldEndDate();
                if (!holdStart.isAfter(end) && (holdEnd == null || !holdEnd.isBefore(start))) {
                    LocalDate candidate = holdStart.isAfter(start) ? holdStart : start;
                    if (earliest == null || candidate.isBefore(earliest)) {
                        earliest = candidate;
                    }
                }
            }
        }
        return earliest;
    }
}
