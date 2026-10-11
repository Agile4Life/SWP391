package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.entity.CenterCheckin;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Service managing center access QR check-in and checkout (SCRUM-75).
 */
@Service
public class CenterCheckinService {

    private static final String STATUS_ACTIVE = "active";
    private static final Set<String> STAFF_ROLES = Set.of(
            "CENTER_MANAGER", "MANAGER", "STAFF", "RECEPTIONIST", "ADMIN"
    );

    private final CenterCheckinRepository checkins;
    private final MembershipSubscriptionRepository subscriptions;
    private final UserRepository users;
    private final Clock clock;

    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                Clock clock) {
        this.checkins = checkins;
        this.subscriptions = subscriptions;
        this.users = users;
        this.clock = clock;
    }

    /**
     * SCRUM-75 BR-01, BR-02, BR-04:
     * Quét mã QR thẻ hội viên.
     * Kiểm tra Trigger P4: chỉ cho vào khi có gói active và chưa hết hạn.
     * BR-04: Không cho check-in lặp khi hội viên đang ở trong trung tâm (chưa checkout).
     */
    @Transactional
    public CheckinDto scan(AuthenticatedPrincipal principal, CheckinRequests.Scan request) {
        ensureStaff(principal);

        MembershipSubscription sub = subscriptions.findByQrCode(request.qrCode().trim())
                .orElseThrow(() -> new ForbiddenException(
                        "CHECKIN_DENIED",
                        "error.attendance.checkin_denied",
                        null,
                        "QR code is invalid or does not exist"));

        LocalDate today = LocalDate.now(clock);
        if (!STATUS_ACTIVE.equalsIgnoreCase(sub.getStatus())
                || sub.getStartDate().isAfter(today)
                || sub.getEndDate().isBefore(today)) {
            throw new ForbiddenException(
                    "CHECKIN_DENIED",
                    "error.attendance.checkin_denied",
                    null,
                    "Membership is inactive or expired");
        }

        Member member = sub.getMember();
        if (member == null) {
            throw new BadRequestException(
                    "CHECKIN_MEMBER_NOT_FOUND",
                    "error.attendance.member_not_found",
                    null,
                    "Member associated with subscription not found");
        }

        if (checkins.existsByMemberUserIdAndCheckOutTimeIsNull(member.getUserId())) {
            throw new ConflictException(
                    "CHECKIN_ALREADY_INSIDE",
                    "error.attendance.already_checked_in",
                    null,
                    "Member is already checked in and has not checked out yet");
        }

        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(LocalDateTime.now(clock));
        checkin.setMethod("qr");
        checkin.setGate(request.gate());

        User recorder = users.findById(principal.id()).orElse(null);
        checkin.setRecordedBy(recorder);

        return toDto(checkins.saveAndFlush(checkin), "GRANTED");
    }

    /**
     * SCRUM-75 BR-05:
     * Ghi nhận giờ rời trung tâm (check_out_time = NOW()).
     */
    @Transactional
    public CheckinDto checkout(AuthenticatedPrincipal principal, Long id) {
        CenterCheckin checkin = checkins.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.checkin", id));

        boolean staff = isStaff(principal);
        boolean isOwner = checkin.getMember() != null
                && checkin.getMember().getUserId().equals(principal.id());
        if (!staff && !isOwner) {
            throw new ForbiddenException(
                    "CHECKIN_NOT_OWNER",
                    "error.attendance.not_owner",
                    null,
                    "Not allowed to checkout this check-in");
        }

        if (checkin.getCheckOutTime() != null) {
            throw new BadRequestException(
                    "CHECKIN_ALREADY_CHECKED_OUT",
                    "error.attendance.already_checked_out",
                    null,
                    "Already checked out");
        }

        checkin.setCheckOutTime(LocalDateTime.now(clock));
        return toDto(checkins.saveAndFlush(checkin), "GRANTED");
    }

    /**
     * SCRUM-75 BR-06:
     * Lấy lịch sử ra vào trong ngày tại các cổng (mới nhất trước).
     */
    @Transactional(readOnly = true)
    public List<CheckinDto> history(AuthenticatedPrincipal principal) {
        ensureStaff(principal);
        LocalDate today = LocalDate.now(clock);
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        return checkins.findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(startOfDay, endOfDay)
                .stream()
                .map(c -> toDto(c, "GRANTED"))
                .toList();
    }

    private void ensureStaff(AuthenticatedPrincipal principal) {
        if (!isStaff(principal)) {
            throw new ForbiddenException(
                    "CHECKIN_STAFF_REQUIRED",
                    "error.forbidden",
                    null,
                    "Staff access is required for this operation");
        }
    }

    private boolean isStaff(AuthenticatedPrincipal principal) {
        return principal != null
                && principal.role() != null
                && STAFF_ROLES.contains(principal.role().toUpperCase());
    }

    private CheckinDto toDto(CenterCheckin c, String status) {
        Member member = c.getMember();
        String memberName = null;
        if (member != null && member.getUser() != null) {
            memberName = member.getUser().getFullName();
        }
        return new CheckinDto(
                c.getId(),
                member != null ? member.getUserId() : null,
                memberName,
                c.getCheckInTime(),
                c.getCheckOutTime(),
                c.getMethod(),
                c.getGate(),
                status
        );
    }
}
