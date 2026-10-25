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
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.membership.service.DynamicQrService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
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

    public static final int ANTI_PASSBACK_TIMEOUT_HOURS = 12;
    public static final String AUTO_CHECKOUT_NOTE = "SYSTEM_AUTO_CHECKOUT";

    private static final String STATUS_ACTIVE = "active";
    private static final String RESULT_GRANTED = "GRANTED";
    private static final String RESULT_DENIED = "DENIED";

    private static final Set<String> STAFF_SCAN_ROLES = Set.of(
            "CENTER_MANAGER", "RECEPTIONIST", "ADMIN"
    );

    private final CenterCheckinRepository checkins;
    private final MembershipSubscriptionRepository subscriptions;
    private final UserRepository users;
    private final MemberRepository members;
    private final Clock clock;
    private final MessageService messageService;
    private final DynamicQrService dynamicQrService;

    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock) {
        this(checkins, subscriptions, users, members, clock, null, new DynamicQrService());
    }

    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock,
                                MessageService messageService) {
        this(checkins, subscriptions, users, members, clock, messageService, new DynamicQrService());
    }

    @Autowired
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock,
                                MessageService messageService,
                                @Autowired(required = false) DynamicQrService dynamicQrService) {
        this.checkins = checkins;
        this.subscriptions = subscriptions;
        this.users = users;
        this.members = members;
        this.clock = clock;
        this.messageService = messageService;
        this.dynamicQrService = dynamicQrService != null ? dynamicQrService : new DynamicQrService();
    }

    private String resolveMessage(String key) {
        return messageService != null ? messageService.getMessageOrDefault(key, key) : key;
    }

    /**
     * SCRUM-75 BR-01, BR-02, BR-03, BR-04 & Trigger P4:
     * - BR-01: Chỉ RECEPTIONIST và CENTER_MANAGER (hoặc barrier) mới được gọi API quét mã. Member bị 403.
     * - BR-02 & Trigger P4: Quét QR tra cứu membership_subscriptions (hỗ trợ cả Dynamic QR HMAC-SHA256 lẫn static QR).
     *   result = 'GRANTED' khi: qr tồn tại, subscription có status = 'active', end_date >= CURRENT_DATE.
     *   Nếu không thỏa: result = 'DENIED' kèm denial_reason.
     * - BR-03: MỌI lượt quét (GRANTED hay DENIED) bắt buộc lưu 1 bản ghi vào center_checkins với server time.
     * - BR-04: Anti-passback: Nếu hội viên đã GRANTED mà chưa checkout, chặn GRANTED thứ hai và log DENIED.
     *   Tự động đóng phiên treo quá 12 tiếng để tránh kẹt quyền vào cửa ngày hôm sau.
     */
    @Transactional
    public CheckinDto scan(AuthenticatedPrincipal principal, CheckinRequests.Scan request) {
        ensureStaff(principal);

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        User recorder = users.findById(principal.id()).orElse(null);

        String rawQr = request.qrCode() != null ? request.qrCode().trim() : "";
        Optional<MembershipSubscription> subOpt;

        // Xử lý Dynamic QR HMAC-SHA256 (nếu mã bắt đầu bằng DYN:)
        if (dynamicQrService.isDynamic(rawQr)) {
            long currentMillis = now.atZone(clock.getZone()).toInstant().toEpochMilli();
            DynamicQrService.VerificationResult qrResult = dynamicQrService.verify(rawQr, currentMillis);
            if (!qrResult.valid()) {
                String reasonKey = qrResult.expired() ? "error.attendance.qr_expired" : "error.attendance.qr_invalid";
                return saveDeniedRecord(null, now, request.gate(), recorder, reasonKey);
            }
            subOpt = subscriptions.findById(qrResult.subscriptionId());
            if (subOpt.isPresent() && (subOpt.get().getMember() == null || !subOpt.get().getMember().getUserId().equals(qrResult.userId()))) {
                return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.qr_invalid");
            }
        } else {
            subOpt = subscriptions.findByQrCode(rawQr);
        }

        // Trường hợp 1: Mã QR không tồn tại
        if (subOpt.isEmpty()) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.qr_invalid", null, null, null);
        }

        MembershipSubscription sub = subOpt.get();
        Member member = sub.getMember();
        String memberCode = member != null ? member.getMembershipCode() : null;
        String memberName = (member != null && member.getUser() != null) ? member.getUser().getFullName() : null;
        String avatarUrl = (member != null && member.getUser() != null) ? member.getUser().getAvatarUrl() : null;
        String packageName = sub.getMembershipPackage() != null ? sub.getMembershipPackage().getName() : null;
        Long remainingDays = (sub.getEndDate() != null) ? java.time.temporal.ChronoUnit.DAYS.between(today, sub.getEndDate()) : null;

        // Trường hợp 2: Không tìm thấy hội viên liên kết
        if (member == null) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.member_not_found", packageName, null, null);
        }

        // Serialize every QR belonging to the same member before checking for an open visit.
        member = members.findByUserIdForUpdate(member.getUserId()).orElse(null);
        if (member == null) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.member_not_found");
        }
        User memberUser = member.getUser();
        if (memberUser == null || memberUser.getDeletedAt() != null || !"active".equals(memberUser.getStatus())) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.member_inactive");
        }

        // Trường hợp 3: Gói tập chưa active (vd: pending_payment, cancelled)
        if (!STATUS_ACTIVE.equalsIgnoreCase(sub.getStatus())) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_not_active", packageName, avatarUrl, remainingDays);
        }

        // Trường hợp 4: Gói tập chưa đến ngày hoặc đã hết hạn
        if (sub.getStartDate() != null && sub.getStartDate().isAfter(today)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_not_active", packageName, avatarUrl, remainingDays);
        }
        if (sub.getEndDate() != null && sub.getEndDate().isBefore(today)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.subscription_expired", packageName, avatarUrl, remainingDays);
        }

        // Tự động đóng các lượt check-in GRANTED bị treo quá 12 tiếng của hội viên (giải phóng bẫy anti-passback)
        autoCheckoutStaleVisitsForMember(member.getUserId(), now);

        // Trường hợp 5 (BR-04 Anti-passback): Hội viên đang ở trong phòng tập chưa checkout
        if (checkins.existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(member.getUserId(), RESULT_GRANTED)) {
            return saveDeniedRecord(member, now, request.gate(), recorder, "error.attendance.already_checked_in", packageName, avatarUrl, remainingDays);
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

        CenterCheckin saved = checkins.saveAndFlush(checkin);
        return new CheckinDto(
                saved.getId(),
                member.getUserId(),
                memberCode,
                memberName,
                avatarUrl,
                packageName,
                remainingDays,
                saved.getCheckInTime(),
                saved.getCheckOutTime(),
                saved.getMethod(),
                saved.getGate(),
                saved.getStatus(),
                saved.getDenialReason()
        );
    }

    /**
     * Tự động checkout các lượt check-in GRANTED của member bị treo quá 12 tiếng.
     */
    @Transactional
    public void autoCheckoutStaleVisitsForMember(Long memberUserId, LocalDateTime now) {
        if (memberUserId == null) return;
        LocalDateTime cutoff = now.minusHours(ANTI_PASSBACK_TIMEOUT_HOURS);
        List<CenterCheckin> staleVisits = checkins
                .findByMemberUserIdAndStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(
                        memberUserId, RESULT_GRANTED, cutoff);
        for (CenterCheckin stale : staleVisits) {
            stale.setCheckOutTime(stale.getCheckInTime().plusHours(4).isBefore(now)
                    ? stale.getCheckInTime().plusHours(4) : now);
            stale.setNotes(AUTO_CHECKOUT_NOTE);
            checkins.save(stale);
        }
    }

    /**
     * Cron Job chạy lúc 03:00 AM hàng ngày: Tự động đóng các lượt check-in GRANTED chưa checkout của ngày hôm trước
     * với trạng thái ghi chú SYSTEM_AUTO_CHECKOUT, giải phóng hội viên khỏi bẫy anti-passback ngày hôm sau.
     */
    @Scheduled(cron = "${app.attendance.auto-checkout.cron:0 0 3 * * ?}")
    @Transactional
    public int autoCheckoutStaleVisits() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime cutoff = now.minusHours(ANTI_PASSBACK_TIMEOUT_HOURS);
        List<CenterCheckin> staleVisits = checkins
                .findByStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(RESULT_GRANTED, cutoff);
        for (CenterCheckin stale : staleVisits) {
            stale.setCheckOutTime(stale.getCheckInTime().plusHours(4).isBefore(now)
                    ? stale.getCheckInTime().plusHours(4) : now);
            stale.setNotes(AUTO_CHECKOUT_NOTE);
            checkins.save(stale);
        }
        return staleVisits.size();
    }

    private CheckinDto saveDeniedRecord(Member member, LocalDateTime now, String gate, User recorder, String reasonKey,
                                        String packageName, String avatarUrl, Long remainingDays) {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(now);
        checkin.setMethod("qr");
        checkin.setGate(gate);
        checkin.setRecordedBy(recorder);
        checkin.setStatus(RESULT_DENIED);
        checkin.setDenialReason(reasonKey);

        CenterCheckin saved = checkins.saveAndFlush(checkin);
        String memberName = (member != null && member.getUser() != null) ? member.getUser().getFullName() : null;
        String memberCode = member != null ? member.getMembershipCode() : null;
        return new CheckinDto(
                saved.getId(),
                member != null ? member.getUserId() : null,
                memberCode,
                memberName,
                avatarUrl,
                packageName,
                remainingDays,
                saved.getCheckInTime(),
                saved.getCheckOutTime(),
                saved.getMethod(),
                saved.getGate(),
                saved.getStatus(),
                saved.getDenialReason()
        );
    }

    /**
     * SCRUM-75 BR-05:
     * Ghi nhận giờ rời trung tâm (check_out_time = NOW()).
     * Không cho phép checkout bản ghi đã có check_out_time hoặc bản ghi DENIED.
     */
    @Transactional
    public CheckinDto checkout(AuthenticatedPrincipal principal, Long id) {
        ensureStaff(principal);

        CenterCheckin checkin = checkins.findByIdForUpdate(id)
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
        String memberCode = null;
        String avatarUrl = null;
        String packageName = null;
        Long remainingDays = null;
        if (member != null) {
            memberCode = member.getMembershipCode();
            if (member.getUser() != null) {
                memberName = member.getUser().getFullName();
                avatarUrl = member.getUser().getAvatarUrl();
            }
            List<MembershipSubscription> activeSubs = subscriptions.findByMemberUserIdAndStatus(member.getUserId(), STATUS_ACTIVE);
            if (activeSubs != null && !activeSubs.isEmpty()) {
                MembershipSubscription sub = activeSubs.get(0);
                if (sub.getMembershipPackage() != null) {
                    packageName = sub.getMembershipPackage().getName();
                }
                if (sub.getEndDate() != null) {
                    LocalDate today = LocalDate.now(clock);
                    remainingDays = java.time.temporal.ChronoUnit.DAYS.between(today, sub.getEndDate());
                }
            }
        }
        return new CheckinDto(
                c.getId(),
                member != null ? member.getUserId() : null,
                memberCode,
                memberName,
                avatarUrl,
                packageName,
                remainingDays,
                c.getCheckInTime(),
                c.getCheckOutTime(),
                c.getMethod(),
                c.getGate(),
                c.getStatus(),
                c.getDenialReason() != null ? resolveMessage(c.getDenialReason()) : null
        );
    }
}
