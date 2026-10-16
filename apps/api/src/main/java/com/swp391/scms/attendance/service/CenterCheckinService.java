package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.entity.CenterCheckin;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Service managing center access QR check-in, checkout, audit trail and daily history (SCRUM-75).
 */
@Service
public class CenterCheckinService {

    private static final String STATUS_ACTIVE = "active";
    private static final String RESULT_GRANTED = "GRANTED";
    private static final String RESULT_DENIED = "DENIED";

    private static final Set<String> STAFF_SCAN_ROLES = Set.of(
            "CENTER_MANAGER", "RECEPTIONIST", "ADMIN"
    );

    private final CenterCheckinRepository checkins;
    private final MembershipSubscriptionRepository subscriptions;
    private final UserRepository users;
    private final Clock clock;
    private final MessageService messageService;

    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                Clock clock) {
        this(checkins, subscriptions, users, clock, null);
    }

    @Autowired
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                Clock clock,
                                MessageService messageService) {
        this.checkins = checkins;
        this.subscriptions = subscriptions;
        this.users = users;
        this.clock = clock;
        this.messageService = messageService;
    }

    private String resolveMessage(String key) {
        return messageService != null ? messageService.getMessageOrDefault(key, key) : key;
    }

    /**
     * SCRUM-75 BR-01, BR-02, BR-03, BR-04 & Trigger P4:
     * - BR-01: Chỉ RECEPTIONIST và CENTER_MANAGER (hoặc barrier) mới được gọi API quét mã. Member bị 403.
     * - BR-02 & Trigger P4: Quét QR tra cứu membership_subscriptions.
     *   result = 'GRANTED' khi: qr tồn tại, subscription có status = 'active', end_date >= CURRENT_DATE.
     *   Nếu không thỏa: result = 'DENIED' kèm denial_reason.
     * - BR-03: MỌI lượt quét (GRANTED hay DENIED) bắt buộc lưu 1 bản ghi vào center_checkins với server time.
     * - BR-04: Anti-passback: Nếu hội viên đã GRANTED mà chưa checkout, chặn GRANTED thứ hai và log DENIED.
     */
    @Transactional
    public CheckinDto scan(AuthenticatedPrincipal principal, CheckinRequests.Scan request) {
        ensureStaff(principal);

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        User recorder = users.findById(principal.id()).orElse(null);

        String rawQr = request.qrCode() != null ? request.qrCode().trim() : "";
        Optional<MembershipSubscription> subOpt = subscriptions.findByQrCode(rawQr);

        // Trường hợp 1: Mã QR không tồn tại
        if (subOpt.isEmpty()) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.qr_invalid");
        }

        MembershipSubscription sub = subOpt.get();
        Member member = sub.getMember();

        // Trường hợp 2: Không tìm thấy hội viên liên kết
        if (member == null) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.member_not_found");
        }

        // Trường hợp 3: Gói tập chưa active (vd: pending_payment, cancelled)
        if (!STATUS_ACTIVE.equalsIgnoreCase(sub.getStatus())) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_not_active");
        }

        // Trường hợp 4: Gói tập chưa đến ngày hoặc đã hết hạn
        if (sub.getStartDate() != null && sub.getStartDate().isAfter(today)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_not_active");
        }
        if (sub.getEndDate() != null && sub.getEndDate().isBefore(today)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_expired");
        }

        // Trường hợp 5 (BR-04 Anti-passback): Hội viên đang ở trong phòng tập chưa checkout
        if (checkins.existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(member.getUserId(), RESULT_GRANTED)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.already_checked_in");
        }

        // Hợp lệ -> GRANTED
        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(now);
        checkin.setMethod("qr");
        checkin.setGate(request.gate());
        checkin.setRecordedBy(recorder);
        checkin.setStatus(RESULT_GRANTED);
        checkin.setDenialReason(null);

        return toDto(checkins.saveAndFlush(checkin));
    }

    private CheckinDto saveDeniedRecord(Member member, LocalDateTime now, String gate, User recorder, String reasonKey) {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(now);
        checkin.setMethod("qr");
        checkin.setGate(gate);
        checkin.setRecordedBy(recorder);
        checkin.setStatus(RESULT_DENIED);
        checkin.setDenialReason(resolveMessage(reasonKey));

        return toDto(checkins.saveAndFlush(checkin));
    }

    /**
     * SCRUM-75 BR-05:
     * Ghi nhận giờ rời trung tâm (check_out_time = NOW()).
     * Không cho phép checkout bản ghi đã có check_out_time hoặc bản ghi DENIED.
     */
    @Transactional
    public CheckinDto checkout(AuthenticatedPrincipal principal, Long id) {
        ensureStaff(principal);

        CenterCheckin checkin = checkins.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("resource.checkin", id));

        if (RESULT_DENIED.equalsIgnoreCase(checkin.getStatus())) {
            throw new BadRequestException(
                    "CHECKIN_CANNOT_CHECKOUT_DENIED",
                    "error.attendance.cannot_checkout_denied",
                    null,
                    "Cannot check out a denied check-in record");
        }

        if (checkin.getCheckOutTime() != null) {
            throw new BadRequestException(
                    "CHECKIN_ALREADY_CHECKED_OUT",
                    "error.attendance.already_checked_out",
                    null,
                    "Already checked out");
        }

        checkin.setCheckOutTime(LocalDateTime.now(clock));
        return toDto(checkins.saveAndFlush(checkin));
    }

    /**
     * SCRUM-75 BR-06:
     * Lấy lịch sử ra vào trong ngày tại các cổng (mới nhất trước).
     * Member chỉ được xem lịch sử của chính mình (principal.id()).
     * Staff/Manager xem toàn bộ lịch sử trong ngày.
     */
    @Transactional(readOnly = true)
    public List<CheckinDto> history(AuthenticatedPrincipal principal) {
        if (principal == null) {
            throw new ForbiddenException("CHECKIN_UNAUTHORIZED", "error.unauthorized", null, "Authentication required");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay();

        if (isStaff(principal)) {
            return checkins.findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(startOfDay, endOfDay)
                    .stream()
                    .map(this::toDto)
                    .toList();
        }

        // Member xem lịch sử của chính mình
        if ("MEMBER".equalsIgnoreCase(principal.role())) {
            return checkins.findByMemberUserIdAndCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
                    principal.id(), startOfDay, endOfDay)
                    .stream()
                    .map(this::toDto)
                    .toList();
        }

        throw new ForbiddenException("CHECKIN_FORBIDDEN", "error.forbidden", null, "Access denied");
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
                && STAFF_SCAN_ROLES.contains(principal.role().toUpperCase());
    }

    private CheckinDto toDto(CenterCheckin c) {
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
                c.getStatus(),
                c.getDenialReason()
        );
    }
}
