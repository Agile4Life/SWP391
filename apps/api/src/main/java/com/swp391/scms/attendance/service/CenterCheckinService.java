package com.swp391.scms.attendance.service;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.common.CenterTime;
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
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Nghiệp vụ ra vào cổng: chỉ cho vào khi gói đang hiệu lực; ghi lại mọi lượt quét (được vào hay bị từ chối) với
 * giờ server; chống quẹt hộ (anti-passback) khi hội viên đã ở trong mà chưa ra; tự đóng lượt bị treo quá 8 giờ.
 *
 * Service quản lý check-in QR vào trung tâm, check-out, nhật ký audit và lịch sử theo ngày (SCRUM-75).
 */
@Service
public class CenterCheckinService {


    public static final int ANTI_PASSBACK_TIMEOUT_HOURS = 8;
    public static final int MAX_HISTORY_DAYS = 31;
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
    private final GateQrService gateQrService;

    /** Constructor cho test với các phụ thuộc tối thiểu. */
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock) {
        this(checkins, subscriptions, users, members, clock, null, new DynamicQrService());
    }

    /** Constructor cho test có MessageService. */
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock,
                                MessageService messageService) {
        this(checkins, subscriptions, users, members, clock, messageService, new DynamicQrService());
    }

    /** Constructor cho test có DynamicQrService. */
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users,
                                MemberRepository members,
                                Clock clock,
                                MessageService messageService,
                                @Autowired(required = false) DynamicQrService dynamicQrService) {
        this(checkins, subscriptions, users, members, clock, messageService, dynamicQrService,
                new GateQrService(java.util.UUID.randomUUID().toString()));
    }

    /** Constructor Spring dùng. */
    @Autowired
    public CenterCheckinService(CenterCheckinRepository checkins,
                                MembershipSubscriptionRepository subscriptions,
                                UserRepository users, MemberRepository members, Clock clock,
                                MessageService messageService, DynamicQrService dynamicQrService,
                                GateQrService gateQrService) {
        this.checkins = checkins;
        this.subscriptions = subscriptions;
        this.users = users;
        this.members = members;
        this.clock = clock;
        this.messageService = messageService;
        this.dynamicQrService = dynamicQrService != null ? dynamicQrService : new DynamicQrService();
        this.gateQrService = gateQrService;
    }

    /** Quầy lấy mã QR cổng có chữ ký (chỉ nhân viên). */
    @Transactional(readOnly = true)
    public com.swp391.scms.attendance.dto.CheckinResponses.GateQrDto gateQr(AuthenticatedPrincipal principal, String gateId) {
        ensureStaff(principal);
        return gateQrService.generate(gateId, clock.millis());
    }

    /**
     * Hội viên tự quét QR cổng: QR cổng sai/hết hạn thì ghi lượt bị từ chối; không có gói hiệu lực hôm nay thì
     * từ chối; hợp lệ thì xét cho vào.
     */
    @Transactional
    public CheckinDto selfScan(AuthenticatedPrincipal principal, CheckinRequests.SelfScan request) {
        if (principal == null || !"MEMBER".equalsIgnoreCase(principal.role())) {
            throw new ForbiddenException("CHECKIN_MEMBER_REQUIRED", "error.forbidden", null, "error.forbidden");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        User recorder = users.findById(principal.id()).orElse(null);
        String gate;
        try {
            String gateId = gateQrService.verify(request.gateQr(), clock.millis());
            gate = gateQrService.gateName(gateId);
        } catch (BadRequestException invalidGate) {
            // Cũng ghi audit các thử thách cổng bị từ chối (giả mạo, sai định dạng hoặc hết hạn) thay vì âm
            // thầm bỏ qua.
            Member member = members.findByUserIdForUpdate(principal.id()).orElse(null);
            String reasonKey = "GATE_QR_EXPIRED".equals(invalidGate.getErrorCode())
                    ? "error.attendance.gate_qr_expired" : "error.attendance.gate_qr_invalid";
            return saveDeniedRecord(member, now, null, recorder, reasonKey);
        }
        Optional<MembershipSubscription> subscription = subscriptions
                .findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                        principal.id(), STATUS_ACTIVE, today, today)
                .filter(sub -> !sub.isHeldOn(today));
        if (subscription.isEmpty()) {
            Member member = members.findByUserIdForUpdate(principal.id()).orElse(null);
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.subscription_not_active");
        }
        return recordEntry(subscription.get(), now, gate, recorder);
    }

    /**
     * Hội viên tự quét QR cổng để ra: đóng lượt GRANTED đang mở của chính mình; không có lượt đang mở thì báo
     * lỗi.
     *
     * Hội viên rời trung tâm bằng cách quét QR cổng hợp lệ; đóng lượt vào GRANTED đang mở của chính họ.
     */
    @Transactional
    public CheckinDto selfCheckout(AuthenticatedPrincipal principal, CheckinRequests.SelfScan request) {
        if (principal == null || !"MEMBER".equalsIgnoreCase(principal.role())) {
            throw new ForbiddenException("CHECKIN_MEMBER_REQUIRED", "error.forbidden", null, "error.forbidden");
        }
        gateQrService.verify(request.gateQr(), clock.millis());
        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        CenterCheckin open = checkins
                .findFirstByMemberUserIdAndCheckOutTimeIsNullOrderByCheckInTimeDesc(principal.id())
                .orElseThrow(() -> new BadRequestException("CHECKIN_NO_OPEN_VISIT",
                        "error.attendance.no_open_visit", null, "No open check-in to check out"));
        open.setCheckOutTime(LocalDateTime.now(clock));
        return toDto(checkins.saveAndFlush(open));
    }

    /** Dịch mã lý do; không dịch được thì giữ nguyên mã. */
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
     *   Tự động đóng phiên treo quá 8 tiếng để tránh kẹt quyền vào cửa ngày hôm sau.
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
            // Khóa Member trước rồi khóa Subscription (đúng thứ tự Member -> Subscription, chống deadlock và đợi hủy/bảo lưu hoàn tất).
            members.findByUserIdForUpdate(qrResult.userId());
            subOpt = subscriptions.findByIdForUpdate(qrResult.subscriptionId());
            if (subOpt.isPresent() && (subOpt.get().getMember() == null || !subOpt.get().getMember().getUserId().equals(qrResult.userId()))) {
                return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.qr_invalid");
            }
        } else {
            // Mã tĩnh không bao giờ hết hạn, nên ảnh chụp thẻ bị chia sẻ sẽ mở cổng mãi mãi. Chỉ chấp nhận mã
            // ký xoay vòng (60 giây); hội viên mở thẻ để lấy mã mới.
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.static_qr_rejected");
        }

        // Trường hợp 1: Mã QR không tồn tại
        if (subOpt.isEmpty()) {
            return saveDeniedRecord(null, now, request.gate(), recorder, "error.attendance.qr_invalid");
        }

        return recordEntry(subOpt.get(), now, request.gate(), recorder);
    }

    /**
     * Xét cho vào: khóa dòng hội viên để các lượt quét song song xếp hàng; từ chối nếu không thấy hội viên, tài
     * khoản không active, gói chưa active/chưa tới ngày/đã hết hạn, hoặc hội viên đang ở trong trung tâm. Hợp
     * lệ thì ghi lượt GRANTED và trả kèm tên gói và số ngày còn lại.
     */
    private CheckinDto recordEntry(MembershipSubscription sub, LocalDateTime now, String gate, User recorder) {
        LocalDate today = now.toLocalDate();
        Member member = sub.getMember();

        // Trường hợp 2: Không tìm thấy hội viên liên kết
        if (member == null) {
            return saveDeniedRecord(null, now, gate, recorder, "error.attendance.member_not_found");
        }

        // Tuần tự hóa mọi QR của cùng một hội viên trước khi kiểm tra lượt vào đang mở.
        member = members.findByUserIdForUpdate(member.getUserId()).orElse(null);
        if (member == null) {
            return saveDeniedRecord(null, now, gate, recorder, "error.attendance.member_not_found");
        }
        User memberUser = member.getUser();
        if (memberUser == null || memberUser.getDeletedAt() != null || !"active".equals(memberUser.getStatus())) {
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.member_inactive");
        }

        // Trường hợp 3: Gói tập chưa active (vd: pending_payment, cancelled, frozen) hoặc đang trong khoảng bảo lưu đã duyệt hôm nay
        if (!STATUS_ACTIVE.equalsIgnoreCase(sub.getStatus()) || sub.isHeldOn(today)) {
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.subscription_not_active");
        }

        // Trường hợp 4: Gói tập chưa đến ngày hoặc đã hết hạn
        if (sub.getStartDate() != null && sub.getStartDate().isAfter(today)) {
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.subscription_not_active");
        }
        if (sub.getEndDate() != null && sub.getEndDate().isBefore(today)) {
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.subscription_expired");
        }

        // Tự động đóng các lượt check-in GRANTED bị treo quá 8 tiếng của hội viên (giải phóng bẫy anti-passback)
        autoCheckoutStaleVisitsForMember(member.getUserId(), now);

        // Trường hợp 5 (BR-04 Anti-passback): Hội viên đang ở trong phòng tập chưa checkout
        if (checkins.existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(member.getUserId(), RESULT_GRANTED)) {
            return saveDeniedRecord(member, now, gate, recorder, "error.attendance.already_checked_in");
        }

        // Hợp lệ -> GRANTED
        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(now);
        checkin.setMethod("qr");
        checkin.setGate(gate);
        checkin.setRecordedBy(recorder);
        checkin.setStatus(RESULT_GRANTED);
        checkin.setDenialReason(null);

        CheckinDto result = toDto(checkins.saveAndFlush(checkin));
        return new CheckinDto(result.id(), result.memberId(), result.memberName(), result.checkInTime(),
                result.checkOutTime(), result.method(), result.gate(), result.status(), result.denialReason(),
                memberUser.getAvatarUrl(), sub.getMembershipPackage() != null ? sub.getMembershipPackage().getName() : null,
                sub.getEndDate() != null ? ChronoUnit.DAYS.between(today, sub.getEndDate()) : null);
    }

    /**
     * Tự động checkout các lượt check-in GRANTED của member bị treo quá 8 tiếng.
     */
    @Transactional
    public void autoCheckoutStaleVisitsForMember(Long memberUserId, LocalDateTime now) {
        if (memberUserId == null) return;
        LocalDateTime cutoff = now.minusHours(ANTI_PASSBACK_TIMEOUT_HOURS);
        List<CenterCheckin> staleVisits = checkins
                .findByMemberUserIdAndStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(
                        memberUserId, RESULT_GRANTED, cutoff);
        closeStaleVisits(staleVisits, now);
    }

    /**
     * Cron Job chạy lúc 03:00 AM hàng ngày: Tự động đóng các lượt check-in GRANTED chưa checkout của ngày hôm trước
     * với trạng thái ghi chú SYSTEM_AUTO_CHECKOUT, giải phóng hội viên khỏi bẫy anti-passback ngày hôm sau.
     */
    @Scheduled(cron = "${app.attendance.auto-checkout.cron:0 0 3 * * ?}", zone = "Asia/Ho_Chi_Minh")
    @Transactional
    public int autoCheckoutStaleVisits() {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime cutoff = now.minusHours(ANTI_PASSBACK_TIMEOUT_HOURS);
        List<CenterCheckin> staleVisits = checkins
                .findByStatusAndCheckOutTimeIsNullAndCheckInTimeLessThan(RESULT_GRANTED, cutoff);
        return closeStaleVisits(staleVisits, now);
    }

    /** Đóng các lượt bị treo: giờ ra mặc định là 4 giờ sau giờ vào (không quá hiện tại), ghi chú tự động. */
    private int closeStaleVisits(List<CenterCheckin> staleVisits, LocalDateTime now) {
        for (CenterCheckin stale : staleVisits) {
            LocalDateTime defaultEnd = stale.getCheckInTime().plusHours(4);
            stale.setCheckOutTime(defaultEnd.isBefore(now) ? defaultEnd : now);
            stale.setNotes(AUTO_CHECKOUT_NOTE);
            checkins.save(stale);
        }
        return staleVisits.size();
    }

    /** Ghi một lượt bị từ chối (DENIED) kèm mã lý do, dùng để kiểm tra sau này. */
    private CheckinDto saveDeniedRecord(Member member, LocalDateTime now, String gate, User recorder, String reasonKey) {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setMember(member);
        checkin.setCheckInTime(now);
        checkin.setMethod("qr");
        checkin.setGate(gate);
        checkin.setRecordedBy(recorder);
        checkin.setStatus(RESULT_DENIED);
        checkin.setDenialReason(reasonKey);

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
        return history(principal, null, null);
    }

    /**
     * Lịch sử ra vào trong khoảng ngày (mặc định hôm nay, tối đa số ngày cho phép): nhân viên xem tất cả, hội
     * viên chỉ xem của mình.
     *
     * Lịch sử cho một khoảng ngày gồm cả hai đầu (mặc định là hôm nay, tối đa {@link #MAX_HISTORY_DAYS}
     * ngày).
     */
    @Transactional(readOnly = true)
    public List<CheckinDto> history(AuthenticatedPrincipal principal, LocalDate from, LocalDate to) {
        if (principal == null) {
            throw new ForbiddenException("CHECKIN_UNAUTHORIZED", "error.unauthorized", null, "Authentication required");
        }

        LocalDate today = LocalDate.now(clock);
        LocalDate first = from != null ? from : (to != null ? to : today);
        LocalDate last = to != null ? to : (from != null ? today : first);
        if (last.isBefore(first) || ChronoUnit.DAYS.between(first, last) >= MAX_HISTORY_DAYS) {
            throw new BadRequestException("CHECKIN_INVALID_RANGE", "error.attendance.invalid_range", null,
                    "Invalid history date range");
        }
        LocalDateTime startOfDay = first.atStartOfDay();
        LocalDateTime endOfDay = last.plusDays(1).atStartOfDay();

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


    /** Bắt buộc người gọi là nhân viên được phép quét; không thì 403. */
    private void ensureStaff(AuthenticatedPrincipal principal) {
        if (!isStaff(principal)) {
            throw new ForbiddenException(
                    "CHECKIN_STAFF_REQUIRED",
                    "error.forbidden",
                    null,
                    "Staff access is required for this operation");
        }
    }

    /** Người gọi có thuộc nhóm vai trò được quét/xem lịch sử toàn bộ không. */
    private boolean isStaff(AuthenticatedPrincipal principal) {
        return principal != null
                && principal.role() != null
                && STAFF_SCAN_ROLES.contains(principal.role().toUpperCase());
    }

    /** Chuyển lượt ra vào sang DTO (lý do từ chối được dịch). */
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
                c.getDenialReason() != null ? resolveMessage(c.getDenialReason()) : null
        );
    }
}
