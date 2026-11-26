package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.CatalogSeeder;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.HoldRequestDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipCancellationRequestRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Dịch vụ quản lý gói tập của hội viên (SCRUM-71): đăng ký/gia hạn/nâng cấp gói, chuỗi gia hạn liên tiếp, bảo lưu
 * (gửi yêu cầu, duyệt, bắt đầu, tự kết thúc, rút đơn, tiếp tục sớm), danh sách chờ thanh toán ở quầy và mã QR động
 * để check-in. Mọi thao tác thay đổi gói của một hội viên đều khóa dòng hội viên trước để các request song song
 * xếp hàng.
 */
@Service
public class MembershipSubscriptionService {

    private static final String STATUS_PENDING_PAYMENT = "pending_payment";
    private static final String STATUS_ACTIVE = "active";
    private static final String STATUS_FROZEN = "frozen";
    private static final String STATUS_EXPIRED = "expired";
    private static final String PACKAGE_ACTIVE = "active";

    private static final String HOLD_PENDING = "PENDING";
    private static final String HOLD_APPROVED = "APPROVED";
    /** Thời gian tối đa một gói tập có thể ở trạng thái frozen; sau mốc này gói tự động tiếp tục lại và được cộng bù đúng số ngày đó. */
    public static final int MAX_HOLD_DAYS = 90;
    /** Thời gian bảo lưu ngắn nhất mà hội viên có thể yêu cầu. */
    public static final int MIN_HOLD_DAYS = 3;
    /** Yêu cầu bảo lưu phải được gửi trước ngày bắt đầu ít nhất khoảng thời gian này. */
    public static final int HOLD_NOTICE_HOURS = 24;
    public static final long MAX_HOLD_DOCUMENT_BYTES = 5L * 1024 * 1024;
    public static final int MAX_HOLD_DOCUMENTS = 5;
    private static final java.util.Set<String> HOLD_DOCUMENT_TYPES =
            java.util.Set.of("image/jpeg", "image/png", "application/pdf");
    private static final String HOLD_REJECTED = "REJECTED";

    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final MemberRepository members;
    private final Clock clock;
    private final DynamicQrService dynamicQrService;
    private final EnrollmentService enrollmentService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;

    @Autowired(required = false)
    private PaymentRepository paymentRepository;

    @Autowired(required = false)
    private com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;

    @Autowired(required = false)
    private EntitlementRevocationService entitlementRevocation;

    @Autowired(required = false)
    private com.swp391.scms.membership.repository.MembershipHoldDocumentRepository holdDocuments;

    @Autowired(required = false)
    private com.swp391.scms.attendance.service.CourseAttendanceService courseAttendance;

    @Autowired(required = false)
    private MembershipCancellationRequestRepository cancellationRequests;

    @Autowired(required = false)
    private EntityManager entityManager;

    @Autowired(required = false)
    private SubscriptionValueCalculator valueCalculator;

    @Autowired(required = false)
    private com.swp391.scms.membership.repository.MemberTrialRedemptionRepository trialRedemptionRepository;

    /** Gán giá trị mới cho trường trialRedemptionRepository. */
    public void setTrialRedemptionRepository(com.swp391.scms.membership.repository.MemberTrialRedemptionRepository repo) {
        this.trialRedemptionRepository = repo;
    }

    /** Constructor cho test với các phụ thuộc tối thiểu. */
    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock) {
        this(subscriptions, packages, members, clock, new DynamicQrService(), null, null, null, null);
    }

    /** Constructor cho test có DynamicQrService. */
    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock,
            DynamicQrService dynamicQrService) {
        this(subscriptions, packages, members, clock, dynamicQrService, null, null, null, null);
    }

    /** Constructor Spring dùng; các dịch vụ phụ (đăng ký lớp, thông báo, dịch) là tùy chọn. */
    @Autowired
    public MembershipSubscriptionService(MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            MemberRepository members,
            Clock clock,
            @Autowired(required = false) DynamicQrService dynamicQrService,
            @Autowired(required = false) EnrollmentService enrollmentService,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) NotificationService notificationService,
            @Autowired(required = false) MessageService messageService) {
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.members = members;
        this.clock = clock;
        this.dynamicQrService = dynamicQrService != null ? dynamicQrService : new DynamicQrService();
        this.enrollmentService = enrollmentService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * SCRUM-71 BR-01, BR-02, BR-04:
     * Tạo subscription mới ở trạng thái pending_payment.
     * Chỉ mua gói có status active.
     * Một hội viên chỉ có tối đa 1 subscription active tại một thời điểm.
     */
    @Transactional
    public SubscriptionDto create(AuthenticatedPrincipal principal, SubscriptionRequests.Create request) {
        Member member = findMember(principal.id());
        MembershipPackage membershipPackage = findActivePackage(request.packageId());
        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (subscriptions.existsByMemberUserIdAndStatus(member.getUserId(), STATUS_FROZEN)) {
            throw new ConflictException("MEMBERSHIP_FROZEN_EXISTS", "error.membership.frozen_exists", null, null);
        }

        LocalDate today = LocalDate.now(clock);
        if (subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(member.getUserId(), STATUS_ACTIVE,
                today)) {
            throw new ConflictException(
                    "MEMBERSHIP_ALREADY_ACTIVE",
                    "error.membership.already_active",
                    null,
                    "Member already has an active subscription");
        }
        if (subscriptions.existsByMemberUserIdAndStatus(member.getUserId(), STATUS_PENDING_PAYMENT)) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }

        // Kiểm tra KYC bắt buộc trước khi đăng ký gói tập đầu tiên
        // Mua mới cần KYC; đơn cũ không chứng minh danh tính, gia hạn/nâng cấp giữ quy tắc riêng.
        boolean approvedTrial = trialRedemptionRepository != null && trialRedemptionRepository.findByMemberUserId(member.getUserId())
                .map(t -> "APPROVED".equalsIgnoreCase(t.getStatus())).orElse(false);
        MembershipKycEligibility.requireVerified(member, approvedTrial);

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        int durationDays = Math.max(1, membershipPackage.getDurationDays());
        subscription.setStartDate(today);
        subscription.setEndDate(today.plusDays(durationDays - 1L));
        // Giá chốt lúc tạo yêu cầu, giống báo giá nâng cấp: Quản lý đổi giá sau đó không làm đổi số tiền phải thu.
        subscription.setQuotedPrice(membershipPackage.getPrice());
        subscription.setStatus(STATUS_PENDING_PAYMENT);
        subscription.setCreatedAt(LocalDateTime.now(clock));
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        MembershipSubscription savedRequest = subscriptions.saveAndFlush(subscription);
        if (notificationService != null) notificationService.notifyReceptionists("payment", savedRequest.getId());
        return toDto(savedRequest);
    }

    /**
     * SCRUM-71 BR-05, BR-06:
     * Gia hạn tạo subscription mới liên kết previous_subscription_id ở
     * pending_payment.
     * Nếu gói cũ còn hạn thì start_date mới = end_date cũ + 1 ngày (không mất ngày
     * đã mua).
     * Nếu đã hết hạn thì bắt đầu từ ngày hôm nay.
     */
    @Transactional
    public SubscriptionDto renew(AuthenticatedPrincipal principal, Long previousId) {
        MembershipSubscription requested = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", previousId));
        ensureOwner(requested, principal);
        SubscriptionDto result = renewForOwner(requested, principal.id(), previousId);
        if (notificationService != null) notificationService.notifyReceptionists("payment", result.id());
        return result;
    }

    /**
     * Lễ tân/quản lý xem các kỳ gói đã thanh toán (active hoặc expired) của một hội viên chưa bị xóa để chọn kỳ
     * gia hạn.
     */
    @Transactional(readOnly = true)
    public List<SubscriptionDto> renewalCandidatesForStaff(AuthenticatedPrincipal principal, Long memberId) {
        ensureReceptionStaff(principal);
        Member member = findMember(memberId);
        if (member.getUser() == null || member.getUser().getDeletedAt() != null) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(memberId).stream()
                .filter(this::isPaidPeriod).map(this::toDto).toList();
    }

    /**
     * Lễ tân gia hạn hộ hội viên: kỳ được chọn phải thuộc đúng hội viên và hội viên chưa bị xóa, rồi dùng chung
     * logic gia hạn với hội viên tự gia hạn.
     */
    @Transactional
    public SubscriptionDto renewForMember(AuthenticatedPrincipal principal, Long memberId, Long previousId) {
        ensureReceptionStaff(principal);
        MembershipSubscription requested = subscriptions.findById(previousId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", previousId));
        if (requested.getMember() == null || !memberId.equals(requested.getMember().getUserId())) {
            throw new ForbiddenException("MEMBERSHIP_NOT_OWNER", "error.membership.not_owner", null, null);
        }
        if (requested.getMember().getUser() != null && requested.getMember().getUser().getDeletedAt() != null) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        return renewForOwner(requested, memberId, previousId);
    }

    /** Chỉ lễ tân hoặc quản lý trung tâm được thao tác thay hội viên; người khác bị 403. */
    private void ensureReceptionStaff(AuthenticatedPrincipal principal) {
        if (principal == null || !("RECEPTIONIST".equalsIgnoreCase(principal.role())
                || "CENTER_MANAGER".equalsIgnoreCase(principal.role()))) {
            throw new ForbiddenException("MEMBERSHIP_FORBIDDEN", "error.forbidden", null, null);
        }
    }

    /**
     * Tạo kỳ gia hạn chờ thanh toán. Khóa dòng hội viên rồi đọc lại toàn bộ lịch sử. Từ chối nếu: có bảo lưu
     * đang chờ, các kỳ đã trả tiền chồng ngày nhau (trừ trường hợp nâng cấp), chuỗi gia hạn rẽ nhánh/lặp vòng,
     * đang có kỳ chờ thanh toán hoặc đang bảo lưu. Đi theo chuỗi các kỳ cùng gói tới kỳ cuối; kỳ mới bắt đầu từ
     * hôm nay (nếu kỳ cuối đã hết hạn) hoặc ngay ngày sau kỳ cuối, dài đúng số ngày của gói, và không được
     * trùng kỳ đã trả tiền nào.
     */
    private SubscriptionDto renewForOwner(MembershipSubscription requested, Long memberId, Long previousId) {
        if (!isPaidPeriod(requested)) {
            throw new BadRequestException("MEMBERSHIP_INVALID_RENEWAL_STATUS",
                    "membership.subscription.invalid_renewal_status", new Object[]{requested.getStatus()},
                    "Only a paid subscription can be renewed");
        }
        // Tuần tự hóa mọi yêu cầu gia hạn cho hội viên này, sau đó đọc lại chuỗi kỳ gói mới nhất.
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (entityManager != null) entityManager.refresh(requested);
        if (HOLD_PENDING.equalsIgnoreCase(requested.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending", null,
                    "Subscription already has a pending hold request");
        }
        List<MembershipSubscription> history = subscriptions.findByMemberUserId(memberId);
        if (history.stream().anyMatch(item -> STATUS_ACTIVE.equalsIgnoreCase(item.getStatus())
                && HOLD_PENDING.equalsIgnoreCase(item.getHoldStatus()))) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending", null,
                    "Subscription already has a pending hold request");
        }
        List<MembershipSubscription> paidPeriods = history.stream().filter(this::isPaidPeriod).toList();
        for (MembershipSubscription item : paidPeriods) {
            long siblings = paidPeriods.stream().filter(other -> other.getPreviousSubscription() != null
                    && item.getPreviousSubscription() != null
                    && item.getPreviousSubscription().getId().equals(other.getPreviousSubscription().getId()))
                    .count();
            if (siblings > 1) throw renewalConflict();
        }
        for (int i = 0; i < paidPeriods.size(); i++) {
            MembershipSubscription a = paidPeriods.get(i);
            if (!validPeriod(a)) throw renewalConflict();
            for (int j = i + 1; j < paidPeriods.size(); j++) {
                MembershipSubscription b = paidPeriods.get(j);
                if (!validPeriod(b) || (!a.getStartDate().isAfter(b.getEndDate())
                        && !a.getEndDate().isBefore(b.getStartDate())
                        && !isUpgradeTransition(a, b))) throw renewalConflict();
            }
        }
        MembershipSubscription tail = history.stream().filter(item -> previousId.equals(item.getId()))
                .findFirst().orElseThrow(this::renewalConflict);
        if (!isPaidPeriod(tail) || !validPeriod(tail)) throw renewalConflict();
        if (history.stream().anyMatch(item -> STATUS_PENDING_PAYMENT.equalsIgnoreCase(item.getStatus()))) {
            throw new ConflictException("MEMBERSHIP_PENDING_EXISTS", "error.membership.pending_exists", null,
                    "A subscription is still awaiting payment");
        }
        if (history.stream().anyMatch(item -> STATUS_FROZEN.equalsIgnoreCase(item.getStatus()))) throw renewalConflict();
        java.util.Set<Long> visited = new java.util.HashSet<>();
        while (true) {
            if (!visited.add(tail.getId())) throw renewalConflict();
            Long tailId = tail.getId();
            List<MembershipSubscription> next = history.stream()
                    .filter(item -> item.getPreviousSubscription() != null
                            && tailId.equals(item.getPreviousSubscription().getId()) && isPaidPeriod(item))
                    .toList();
            if (next.size() > 1) throw renewalConflict();
            if (next.isEmpty()) break;
            MembershipSubscription successor = next.get(0);
            if (!validPeriod(successor) || !successor.getStartDate().isAfter(tail.getEndDate())
                    || successor.getMembershipPackage() == null || tail.getMembershipPackage() == null
                    || !successor.getMembershipPackage().getId().equals(tail.getMembershipPackage().getId())) {
                throw renewalConflict();
            }
            tail = successor;
        }
        MembershipPackage membershipPackage = findActivePackage(tail.getMembershipPackage().getId());
        LocalDate today = LocalDate.now(clock);
        LocalDate startDate = tail.getEndDate().isBefore(today) ? today : tail.getEndDate().plusDays(1);
        LocalDate endDate = startDate.plusDays(Math.max(1, membershipPackage.getDurationDays()) - 1L);
        for (MembershipSubscription item : history) {
            if (isPaidPeriod(item) && validPeriod(item)
                    && !item.getStartDate().isAfter(endDate) && !item.getEndDate().isBefore(startDate)) {
                throw renewalConflict();
            }
        }
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setMember(tail.getMember());
        renewal.setMembershipPackage(membershipPackage);
        renewal.setPreviousSubscription(tail);
        renewal.setStartDate(startDate);
        renewal.setEndDate(endDate);
        renewal.setQuotedPrice(membershipPackage.getPrice());
        renewal.setStatus(STATUS_PENDING_PAYMENT);
        renewal.setCreatedAt(LocalDateTime.now(clock));
        renewal.setUpdatedAt(LocalDateTime.now(clock));
        return toDto(subscriptions.saveAndFlush(renewal));
    }

    /** Kỳ gói phải thuộc người đang đăng nhập; không thì báo 403. */
    private void ensureOwner(MembershipSubscription subscription, AuthenticatedPrincipal principal) {
        if (principal == null || subscription.getMember() == null || !principal.id().equals(subscription.getMember().getUserId())) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }
    }

    /** Kỳ gói có đang active và hiệu lực vào ngày cho trước không. */
    private boolean isActiveOn(MembershipSubscription subscription, LocalDate date) {
        return STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                && validPeriod(subscription)
                && !subscription.getStartDate().isAfter(date)
                && !subscription.getEndDate().isBefore(date);
    }

    /** Kỳ gói đã được thanh toán chưa (trạng thái active hoặc expired). */
    private boolean isPaidPeriod(MembershipSubscription subscription) {
        return subscription != null && (STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                || "expired".equalsIgnoreCase(subscription.getStatus()));
    }

    /** Kỳ gói có ngày bắt đầu, ngày kết thúc và kết thúc không trước bắt đầu. */
    private boolean validPeriod(MembershipSubscription subscription) {
        return subscription.getStartDate() != null && subscription.getEndDate() != null
                && !subscription.getEndDate().isBefore(subscription.getStartDate());
    }

    /**
     * Hai kỳ có phải là một lần nâng cấp nối tiếp không: kỳ mới trỏ về kỳ cũ, khác gói (hoặc có phí nâng cấp),
     * và kỳ mới bắt đầu đúng ngày kỳ cũ kết thúc. Trường hợp này được phép trùng một ngày.
     */
    private boolean isUpgradeTransition(MembershipSubscription a, MembershipSubscription b) {
        MembershipSubscription newer = b.getPreviousSubscription() != null
                && a.getId().equals(b.getPreviousSubscription().getId()) ? b
                : a.getPreviousSubscription() != null
                && b.getId().equals(a.getPreviousSubscription().getId()) ? a : null;
        MembershipSubscription older = newer == b ? a : newer == a ? b : null;
        return older != null && older.getMembershipPackage() != null
                && newer.getMembershipPackage() != null
                && (!older.getMembershipPackage().getId().equals(newer.getMembershipPackage().getId())
                    || newer.getUpgradeCharge() != null)
                && older.getEndDate().equals(newer.getStartDate());
    }

    /** Lỗi 409 "chuỗi gói cần quản lý kiểm tra trước khi gia hạn". */
    private ConflictException renewalConflict() {
        return new ConflictException("MEMBERSHIP_RENEWAL_CONFLICT", "error.membership.renewal_conflict",
                null, "Subscription chain needs review before renewal");
    }

    /**
     * Nâng cấp gói tập đang hoạt động lên gói tập cao hơn (chờ lễ tân xác nhận thanh toán tại quầy).
     */
    @Transactional
    public SubscriptionDto upgrade(AuthenticatedPrincipal principal, Long currentId, SubscriptionRequests.Upgrade request) {
        MembershipSubscription current = subscriptions.findById(currentId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", currentId));

        ensureOwner(current, principal);

        members.findByUserIdForUpdate(current.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", current.getMember().getUserId()));
        if (entityManager != null) entityManager.refresh(current);
        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(current, today)) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_REQUIRES_ACTIVE",
                    "error.membership.upgrade_requires_active",
                    null,
                    "Only an active subscription can be upgraded");
        }

        if (HOLD_PENDING.equalsIgnoreCase(current.getHoldStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending",
                    null,
                    "Subscription already has a pending hold request");
        }

        if (subscriptions.existsByMemberUserIdAndStatus(current.getMember().getUserId(), STATUS_PENDING_PAYMENT)
                || subscriptions.existsByPreviousSubscriptionIdAndStatusIn(currentId,
                        List.of(STATUS_PENDING_PAYMENT, STATUS_ACTIVE))) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }

        if (hasPaidFutureRenewal(current.getMember().getUserId(), today)) throw futurePaidConflict();

        MembershipPackage targetPackage = findActivePackage(request.packageId());
        MembershipPackage currentPackage = current.getMembershipPackage();
        BigDecimal targetPrice = targetPackage.getPrice() != null ? targetPackage.getPrice() : BigDecimal.ZERO;
        boolean trialUpgradeToPaid = isTrialSubscription(current) && targetPrice.signum() > 0;

        if (!trialUpgradeToPaid && !isHigherPackage(currentPackage, targetPackage)) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_NOT_HIGHER",
                    "error.membership.upgrade_not_higher",
                    null,
                    "Target package must be higher than current package");
        }

        // Phần quy đổi lấy từ tiền hội viên thực trả cho kỳ hiện tại; giá gói mới lấy theo danh mục lúc báo giá.
        // Cả hai được chốt trên yêu cầu nên Quản lý đổi giá sau đó không làm lệch số tiền phải thu.
        BigDecimal credit = valueCalculator().remainingValue(current, today);
        BigDecimal charge = SubscriptionValueCalculator.upgradeCharge(targetPrice, credit);
        if (charge.signum() <= 0) {
            throw new BadRequestException(
                    "MEMBERSHIP_UPGRADE_CREDIT_EXCEEDS",
                    "error.membership.upgrade_credit_exceeds",
                    new Object[]{credit.toPlainString(), targetPrice.toPlainString()},
                    "Unused value of the current period already covers the target package");
        }

        MembershipSubscription upgradeSub = new MembershipSubscription();
        upgradeSub.setMember(current.getMember());
        upgradeSub.setMembershipPackage(targetPackage);
        upgradeSub.setPreviousSubscription(current);
        int durationDays = Math.max(1, targetPackage.getDurationDays());
        // Ngày bắt đầu là ngày báo giá: phần quy đổi tính tới hôm nay, nên gói mới cũng tính từ hôm nay.
        upgradeSub.setStartDate(today);
        upgradeSub.setEndDate(today.plusDays(durationDays - 1L));
        upgradeSub.setCreditApplied(credit);
        upgradeSub.setUpgradeCharge(charge);
        upgradeSub.setStatus(STATUS_PENDING_PAYMENT);
        upgradeSub.setCreatedAt(LocalDateTime.now(clock));
        upgradeSub.setUpdatedAt(LocalDateTime.now(clock));

        MembershipSubscription savedUpgrade = subscriptions.saveAndFlush(upgradeSub);
        if (notificationService != null) notificationService.notifyReceptionists("payment", savedUpgrade.getId());
        return toDto(savedUpgrade);
    }

    /**
     * Hủy yêu cầu gói tập đang ở trạng thái chờ thanh toán (pending_payment).
     * Hội viên (chủ sở hữu) hoặc Lễ tân / Quản lý đều có thể hủy khi chưa thanh toán.
     */
    @Transactional
    public SubscriptionDto cancelPending(AuthenticatedPrincipal principal, Long subscriptionId) {
        return cancelPending(principal, subscriptionId, null);
    }

    @Transactional
    public SubscriptionDto cancelPending(AuthenticatedPrincipal principal, Long subscriptionId, String rawReason) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        boolean isStaff = principal != null && ("CENTER_MANAGER".equalsIgnoreCase(principal.role())
                || "RECEPTIONIST".equalsIgnoreCase(principal.role())
                || "MANAGER".equalsIgnoreCase(principal.role())
                || "STAFF".equalsIgnoreCase(principal.role()));
        boolean isOwner = principal != null
                && lookup.getMember() != null
                && lookup.getMember().getUserId().equals(principal.id());

        if (!isStaff && !isOwner) {
            throw new ForbiddenException(
                    "MEMBERSHIP_NOT_OWNER",
                    "error.membership.not_owner",
                    null,
                    "Subscription does not belong to the authenticated member");
        }

        Long memberId = lookup.getMember().getUserId();
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        if (entityManager != null) entityManager.refresh(subscription);

        if ("cancelled".equalsIgnoreCase(subscription.getStatus())) {
            return toDto(subscription);
        }

        if (!STATUS_PENDING_PAYMENT.equalsIgnoreCase(subscription.getStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_CANCEL_NOT_PENDING",
                    "error.membership.cancel_not_pending",
                    null,
                    "Only a pending payment subscription can be cancelled");
        }

        // Lý do của lễ tân chỉ áp dụng cho yêu cầu chưa thanh toán, không dùng cho hủy gói/hoàn tiền.
        boolean isReceptionist = "RECEPTIONIST".equalsIgnoreCase(principal.role()) || "STAFF".equalsIgnoreCase(principal.role());
        String reason = rawReason == null ? null : rawReason.replaceAll("(?U)^\\s+|\\s+$", "");
        if (isReceptionist && (reason == null || reason.isBlank())) {
            throw new BadRequestException("PENDING_CANCEL_REASON_REQUIRED", "validation.membership.pending_cancel_reason.required", null, null);
        }
        if (reason != null && reason.length() > 500) {
            throw new BadRequestException("PENDING_CANCEL_REASON_TOO_LONG", "validation.membership.pending_cancel_reason.size", null, null);
        }

        if (paymentRepository != null) {
            List<com.swp391.scms.finance.entity.Payment> subPayments = paymentRepository.findAllBySubscriptionId(subscriptionId);
            if (subPayments.stream().anyMatch(payment -> "success".equalsIgnoreCase(payment.getStatus()))) {
                throw new ConflictException("MEMBERSHIP_CANCEL_PAYMENT_UNSETTLED",
                        "error.membership.cancel_payment_unsettled", null, null);
            }
            // Một lượt VNPay mà cổng vẫn còn có thể quyết toán sẽ chặn mọi người; lượt bị bỏ dở sẽ được đóng tại đây.
            if (vnpayGuard != null) vnpayGuard.subscription(subscriptionId);
            // Hội viên có thể rút lượt thanh toán trực tuyến chưa trả; biên lai tiền mặt đang chờ duyệt do lễ tân quyết định.
            if (!isStaff && subPayments.stream().anyMatch(payment -> "pending".equalsIgnoreCase(payment.getStatus())
                    && !"online_wallet".equalsIgnoreCase(payment.getMethod()))) {
                throw new ConflictException("MEMBERSHIP_CANCEL_PAYMENT_UNSETTLED",
                        "error.membership.cancel_payment_unsettled", null, null);
            }
            subPayments.stream()
                    .filter(payment -> "pending".equalsIgnoreCase(payment.getStatus()))
                    .forEach(payment -> {
                        payment.setStatus("failed");
                        paymentRepository.save(payment);
                    });
        }

        subscription.setStatus("cancelled");
        subscription.setPendingCancellationReason(reason);
        subscription.setUpdatedAt(LocalDateTime.now(clock));

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);
        // Lưu trạng thái, lý do và thông báo cùng transaction; thử lại yêu cầu đã hủy không gửi lặp.
        if (isReceptionist && notificationService != null) {
            notificationService.send(memberId, msg("notifications.membership.pending_cancelled.title"),
                    msg("notifications.membership.pending_cancelled.body", saved.getId(),
                            saved.getMembershipPackage() == null ? "" : saved.getMembershipPackage().getName(), reason),
                    "system", "membership_subscription", saved.getId(), "/member/packages");
        }
        return toDto(saved);
    }

    /** Bộ tính giá trị còn lại của gói (dùng bản Spring tiêm vào, không có thì tự tạo). */
    private SubscriptionValueCalculator valueCalculator() {
        return valueCalculator != null ? valueCalculator : new SubscriptionValueCalculator(paymentRepository);
    }

    /**
     * Gói đích có "cao hơn" gói hiện tại không: giá cao hơn, hoặc cùng giá nhưng dài ngày hơn. Cùng gói thì
     * không.
     */
    private boolean isHigherPackage(MembershipPackage currentPackage, MembershipPackage targetPackage) {
        if (currentPackage == null || targetPackage == null) {
            return false;
        }
        if (currentPackage.getId() != null && currentPackage.getId().equals(targetPackage.getId())) {
            return false;
        }
        BigDecimal currentPrice = currentPackage.getPrice() != null ? currentPackage.getPrice() : BigDecimal.ZERO;
        BigDecimal targetPrice = targetPackage.getPrice() != null ? targetPackage.getPrice() : BigDecimal.ZERO;
        int priceComparison = targetPrice.compareTo(currentPrice);
        if (priceComparison > 0) {
            return true;
        }
        if (priceComparison == 0) {
            return targetPackage.getDurationDays() > currentPackage.getDurationDays();
        }
        return false;
    }

    /**
     * Hội viên chủ động gửi yêu cầu bảo lưu gói tập đang hoạt động kèm lý do.
     */
    @Transactional
    public SubscriptionDto requestHold(AuthenticatedPrincipal principal, Long subscriptionId, SubscriptionRequests.HoldRequest request) {
        return requestHold(principal, subscriptionId, request, null);
    }

    /**
     * Gửi yêu cầu bảo lưu (đặc tả 2026-11-09, mục 1.6): gói phải đang hiệu lực, cho phép bảo lưu và chưa dùng lượt
     * bảo lưu duy nhất; ngày bắt đầu cách hiện tại ít nhất 24 giờ, kéo dài từ 3 ngày đến hạn mức của gói và nằm trong
     * thời hạn gói; phải đính kèm giấy tờ y tế (tối đa 5 file JPG/PNG/PDF, mỗi file tối đa 5 MB). Không được có kỳ chờ
     * thanh toán, gia hạn trả trước hoặc yêu cầu hủy đang chờ.
     */
    @Transactional
    public SubscriptionDto requestHold(AuthenticatedPrincipal principal, Long subscriptionId,
                                       SubscriptionRequests.HoldRequest request, List<HoldDocumentUpload> documents) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        ensureOwner(subscription, principal);

        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        if (entityManager != null) entityManager.refresh(subscription);

        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(subscription, today)) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REQUIRES_ACTIVE",
                    "error.membership.hold_requires_active",
                    null,
                    "Only an active subscription can be placed on hold");
        }

        if (isTrialSubscription(subscription)) {
            throw new BadRequestException(
                    "MEMBERSHIP_TRIAL_CANNOT_HOLD",
                    "error.membership.trial_cannot_hold",
                    null,
                    "Gói tập trải nghiệm không hỗ trợ bảo lưu.");
        }

        if (HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException(
                    "MEMBERSHIP_HOLD_ALREADY_PENDING",
                    "error.membership.hold_already_pending",
                    null,
                    "Subscription already has a pending hold request");
        }

        ensureNoPendingOrCancellationHoldConflicts(principal.id(), subscriptionId, today);

        String reason = request != null && request.reason() != null ? request.reason().trim() : "";
        if (reason.isEmpty()) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REASON_REQUIRED",
                    "validation.membership.hold_reason.not_blank",
                    null,
                    "Hold reason is required");
        }
        if (reason.length() > 500) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_REASON_TOO_LONG",
                    "validation.membership.hold_reason.size",
                    null,
                    "Hold reason must not exceed 500 characters");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        validateHoldWindow(subscription, request, documents, now);
        subscription.setHoldStartDate(request.startDate());
        subscription.setHoldEndDate(request.endDate());
        subscription.setHoldStatus(HOLD_PENDING);
        subscription.setHoldReason(reason);
        subscription.setHoldRejectionReason(null);
        subscription.setHoldRequestedAt(now);
        subscription.setHoldResolvedAt(null);
        subscription.setHoldResolvedBy(null);
        subscription.setHoldDaysCredited(null);
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);
        storeHoldDocuments(saved, principal, documents);
        if (notificationService != null) notificationService.notifyReceptionists("hold", saved.getId());
        return toDto(saved);
    }

    /**
     * Dữ liệu byte của một file giấy tờ y tế đã tải lên, đã được đọc sẵn từ request multipart.
     */
    public record HoldDocumentUpload(String fileName, String contentType, byte[] content) {}

    /**
     * Kiểm tra khoảng bảo lưu và giấy tờ theo các quy tắc ở requestHold; vi phạm thì báo lỗi 400/409 với mã
     * riêng.
     */
    private void validateHoldWindow(MembershipSubscription subscription, SubscriptionRequests.HoldRequest request,
                                    List<HoldDocumentUpload> documents, LocalDateTime now) {
        int maxDays = com.swp391.scms.facilities.PackageBenefits.holdMaxDays(subscription.getMembershipPackage());
        if (maxDays <= 0) {
            throw new BadRequestException("MEMBERSHIP_HOLD_NOT_ALLOWED", "error.membership.hold_not_allowed", null,
                    "This package cannot be put on hold");
        }
        if (subscription.isHoldUsed()) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_USED", "error.membership.hold_already_used", null,
                    "A package can be put on hold only once");
        }
        LocalDate start = request == null ? null : request.startDate();
        LocalDate end = request == null ? null : request.endDate();
        if (start == null || end == null || end.isBefore(start)) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DATES_INVALID", "error.membership.hold_dates_invalid", null,
                    "Hold start and end dates are required and the end cannot be before the start");
        }
        if (start.atStartOfDay().isBefore(now.plusHours(HOLD_NOTICE_HOURS))) {
            throw new BadRequestException("MEMBERSHIP_HOLD_TOO_LATE", "error.membership.hold_too_late",
                    new Object[]{HOLD_NOTICE_HOURS}, "A hold must be requested at least 24 hours before it starts");
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1;
        if (days < MIN_HOLD_DAYS || days > maxDays) {
            throw new BadRequestException("MEMBERSHIP_HOLD_DURATION_INVALID", "error.membership.hold_duration_invalid",
                    new Object[]{MIN_HOLD_DAYS, maxDays}, "A hold must last between 3 days and the package allowance");
        }
        if (subscription.getStartDate() == null || subscription.getEndDate() == null
                || start.isBefore(subscription.getStartDate()) || end.isAfter(subscription.getEndDate())) {
            throw new BadRequestException("MEMBERSHIP_HOLD_OUT_OF_PERIOD", "error.membership.hold_out_of_period", null,
                    "The hold must fall inside the membership period");
        }
        if (documents != null && !documents.isEmpty()) {
            if (documents.size() > MAX_HOLD_DOCUMENTS) {
                throw new BadRequestException("MEMBERSHIP_HOLD_DOCUMENT_INVALID", "error.membership.hold_document_invalid",
                        new Object[]{MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES / (1024 * 1024)}, "Too many documents");
            }
            for (HoldDocumentUpload document : documents) {
                if (document == null || document.content() == null || document.content().length == 0
                        || document.content().length > MAX_HOLD_DOCUMENT_BYTES
                        || document.contentType() == null
                        || !HOLD_DOCUMENT_TYPES.contains(document.contentType().toLowerCase(java.util.Locale.ROOT))) {
                    throw new BadRequestException("MEMBERSHIP_HOLD_DOCUMENT_INVALID", "error.membership.hold_document_invalid",
                            new Object[]{MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES / (1024 * 1024)},
                            "Documents must be JPG, PNG or PDF files of at most 5 MB");
                }
            }
        }
    }

    /**
     * Lưu giấy tờ bảo lưu vào database (thay toàn bộ giấy tờ cũ của kỳ gói), ghi tên file (tối đa 255 ký tự),
     * loại, dung lượng, thời điểm và người tải lên.
     */
    private void storeHoldDocuments(MembershipSubscription subscription, AuthenticatedPrincipal principal,
                                    List<HoldDocumentUpload> documents) {
        if (holdDocuments == null || documents == null) return;
        holdDocuments.deleteBySubscriptionId(subscription.getId());
        for (HoldDocumentUpload upload : documents) {
            var document = new com.swp391.scms.membership.entity.MembershipHoldDocument();
            document.setSubscription(subscription);
            String name = upload.fileName() == null || upload.fileName().isBlank() ? "document" : upload.fileName().trim();
            document.setFileName(name.length() > 255 ? name.substring(name.length() - 255) : name);
            document.setContentType(upload.contentType().toLowerCase(java.util.Locale.ROOT));
            document.setSizeBytes(upload.content().length);
            document.setContent(upload.content());
            document.setUploadedAt(LocalDateTime.now(clock));
            if (principal != null && principal.id() != null && userRepository != null) {
                userRepository.findById(principal.id()).ifPresent(document::setUploadedBy);
            }
            holdDocuments.save(document);
        }
    }

    /**
     * Chặn bảo lưu khi hội viên còn kỳ chờ thanh toán, đã trả trước một kỳ gia hạn trong tương lai, hoặc gói
     * đang có yêu cầu hủy chờ duyệt.
     */
    private void ensureNoPendingOrCancellationHoldConflicts(Long memberId, Long subscriptionId, LocalDate today) {
        if (subscriptions.existsByMemberUserIdAndStatus(memberId, STATUS_PENDING_PAYMENT)) {
            throw new ConflictException(
                    "MEMBERSHIP_PENDING_EXISTS",
                    "error.membership.pending_exists",
                    null,
                    "Member already has a pending payment subscription");
        }
        if (hasPaidFutureRenewal(memberId, today)) {
            throw futurePaidConflict();
        }
        if (cancellationRequests != null
                && cancellationRequests.existsBySubscriptionIdAndStatus(subscriptionId, "PENDING")) {
            throw new ConflictException(
                    "CANCELLATION_PENDING_EXISTS",
                    "error.membership.cancellation_pending_exists",
                    null,
                    "A cancellation request is already pending for this membership");
        }
    }

    /**
     * Hội viên quay lại tập sớm (tiếp tục gói đang bảo lưu): gói phải đang frozen với bảo lưu đã duyệt và đã
     * bắt đầu; không được có gói active khác, kỳ chờ thanh toán hay gia hạn trả trước. Nếu ngày bảo lưu đã được
     * cộng lúc duyệt thì trừ lại số ngày chưa dùng; bảo lưu cũ chưa cộng thì cộng số ngày đã bảo lưu (tối đa
     * 90). Gói trở lại active và các buổi học trong phần bảo lưu còn lại không còn được miễn điểm danh.
     */
    @Transactional
    public SubscriptionDto resume(AuthenticatedPrincipal principal, Long subscriptionId) {
        members.findByUserIdForUpdate(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        if (entityManager != null) entityManager.refresh(subscription);
        ensureOwner(subscription, principal);
        LocalDate today = LocalDate.now(clock);
        LocalDate heldOn = subscription.getHoldStartDate() != null ? subscription.getHoldStartDate()
                : subscription.getHoldResolvedAt() == null ? null : subscription.getHoldResolvedAt().toLocalDate();
        if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                || heldOn == null || heldOn.isAfter(today) || !validPeriod(subscription)
                || heldOn.isBefore(subscription.getStartDate()) || heldOn.isAfter(subscription.getEndDate())) {
            throw new BadRequestException("MEMBERSHIP_RESUME_INVALID", "error.membership.resume_invalid", null, null);
        }
        if (subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(principal.id(), STATUS_ACTIVE, today)
                || subscriptions.existsByMemberUserIdAndStatus(principal.id(), STATUS_PENDING_PAYMENT)
                || hasPaidFutureRenewal(principal.id(), today)) {
            throw new ConflictException("MEMBERSHIP_RESUME_CONFLICT", "error.membership.resume_conflict", null, null);
        }
        // Giữ nguyên kỳ đã thanh toán gốc và lượt sử dụng lớp học; chỉ gia hạn ngày hết hạn thêm tối đa MAX_HOLD_DAYS.
        // Các đợt bảo lưu được duyệt từ khi áp dụng cộng ngày lúc duyệt sẽ trừ lại số ngày chưa dùng; các đợt bảo lưu cũ
        // chưa được cộng ngày lúc duyệt thì nay vẫn được cộng bù số ngày đã bảo lưu.
        if (subscription.isHoldDaysCredited() && subscription.getHoldEndDate() != null) {
            if (today.isBefore(subscription.getHoldEndDate())) {
                long unusedDays = java.time.temporal.ChronoUnit.DAYS.between(today, subscription.getHoldEndDate());
                subscription.setEndDate(subscription.getEndDate().minusDays(unusedDays));
            }
        } else {
            long heldDays = Math.min(java.time.temporal.ChronoUnit.DAYS.between(heldOn, today), MAX_HOLD_DAYS);
            subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
        }
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setHoldStatus(null);
        subscription.setHoldDaysCredited(null);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        MembershipSubscription resumed = subscriptions.saveAndFlush(subscription);
        // Quay lại tập sớm: phần thời gian còn lại của đợt bảo lưu không còn miễn điểm danh cho các buổi khóa học.
        if (courseAttendance != null) courseAttendance.releaseHoldExcuses(principal.id(), today);
        return toDto(resumed);
    }

    /**
     * Các gói đang bảo lưu (frozen) không có ngày kết thúc cụ thể đã đạt mốc MAX_HOLD_DAYS (cần tự tiếp tục).
     */
    @Transactional(readOnly = true)
    public List<Long> findHoldsDueForResume() {
        LocalDateTime cutoff = LocalDateTime.now(clock).minusDays(MAX_HOLD_DAYS);
        return subscriptions.findByStatusAndHoldStatusAndHoldResolvedAtLessThanEqual(STATUS_FROZEN, HOLD_APPROVED, cutoff)
                .stream().filter(sub -> sub.getHoldEndDate() == null).map(MembershipSubscription::getId).toList();
    }

    /**
     * Các gói đang bảo lưu (frozen) có ngày kết thúc cụ thể đã qua trước hôm nay (cần tự tiếp tục).
     */
    @Transactional(readOnly = true)
    public List<Long> findDatedHoldsDueForResume() {
        return subscriptions.findDatedHoldsDueForResume(LocalDate.now(clock));
    }

    /**
     * Các đợt bảo lưu đã duyệt đã đến ngày bắt đầu nhưng gói vẫn đang được tính ở trạng thái active (cần chuyển sang frozen).
     */
    @Transactional(readOnly = true)
    public List<Long> findHoldsDueToStart() {
        return subscriptions.findHoldsDueToStart(LocalDate.now(clock));
    }

    /**
     * Chuyển sang frozen một đợt bảo lưu đã duyệt vào ngày đầu tiên: khóa dòng hội viên và gói, kiểm tra lại điều kiện
     * rồi chuyển trạng thái; các lịch đặt trong khoảng bảo lưu đã được giải phóng từ lúc duyệt. Trả về true nếu đã chuyển.
     */
    @Transactional
    public boolean startHold(Long subscriptionId) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId).orElse(null);
        if (lookup == null || lookup.getMember() == null) return false;
        members.findByUserIdForUpdate(lookup.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", lookup.getMember().getUserId()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId).orElse(null);
        if (subscription == null) return false;
        if (entityManager != null) entityManager.refresh(subscription);
        LocalDate today = LocalDate.now(clock);
        if (!STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                || subscription.getHoldStartDate() == null || subscription.getHoldStartDate().isAfter(today)) {
            return false;
        }
        subscription.setStatus(STATUS_FROZEN);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        subscriptions.saveAndFlush(subscription);
        return true;
    }

    /**
     * Tự kết thúc đợt bảo lưu đã đạt MAX_HOLD_DAYS hoặc đã qua ngày cuối (với bảo lưu có ngày cụ thể): gói tập chạy
     * lại ở trạng thái active với số ngày bảo lưu được cộng vào hạn gói (nếu lúc duyệt chưa cộng) và gửi thông báo
     * hạn mới cho hội viên. Trả về true nếu đã kết thúc.
     */
    @Transactional
    public boolean autoResumeHold(Long subscriptionId) {
        MembershipSubscription lookup = subscriptions.findById(subscriptionId).orElse(null);
        if (lookup == null || lookup.getMember() == null) return false;
        members.findByUserIdForUpdate(lookup.getMember().getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", lookup.getMember().getUserId()));
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId).orElse(null);
        if (subscription == null) return false;
        if (entityManager != null) entityManager.refresh(subscription);
        LocalDateTime now = LocalDateTime.now(clock);
        long heldDays;
        if (subscription.getHoldEndDate() != null) {
            // Bảo lưu có ngày cụ thể: bao phủ từ ngày đầu đến ngày cuối (tính cả hai ngày) và kết thúc vào ngày hôm sau.
            if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                    || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                    || subscription.getEndDate() == null
                    || !subscription.getHoldEndDate().isBefore(now.toLocalDate())) {
                return false;
            }
            LocalDate from = subscription.getHoldStartDate() != null ? subscription.getHoldStartDate()
                    : subscription.getHoldEndDate();
            heldDays = java.time.temporal.ChronoUnit.DAYS.between(from, subscription.getHoldEndDate()) + 1;
            // Các bảo lưu đã duyệt có cộng ngày sẵn thì endDate đã bao gồm số ngày này; các bảo lưu duyệt cũ hơn được cộng ngay lúc này.
            if (!subscription.isHoldDaysCredited()) {
                subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
            }
        } else {
            if (!STATUS_FROZEN.equalsIgnoreCase(subscription.getStatus())
                    || !HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                    || subscription.getHoldResolvedAt() == null || subscription.getEndDate() == null
                    || subscription.getHoldResolvedAt().isAfter(now.minusDays(MAX_HOLD_DAYS))) {
                return false;
            }
            heldDays = Math.min(java.time.temporal.ChronoUnit.DAYS.between(
                    subscription.getHoldResolvedAt().toLocalDate(), now.toLocalDate()), MAX_HOLD_DAYS);
            subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
        }
        subscription.setStatus(STATUS_ACTIVE);
        subscription.setHoldStatus(null);
        subscription.setHoldDaysCredited(null);
        subscription.setUpdatedAt(now);
        subscriptions.saveAndFlush(subscription);
        if (notificationService != null) {
            String pkgName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
            notificationService.send(subscription.getMember().getUserId(),
                    msg("notifications.membership.hold_auto_resumed.title"),
                    msg("notifications.membership.hold_auto_resumed.body", pkgName, heldDays, subscription.getEndDate()),
                    "system", "membership_subscription", subscription.getId());
        }
        return true;
    }

    /**
     * Danh sách yêu cầu bảo lưu đang chờ lễ tân xử lý.
     */
    @Transactional(readOnly = true)
    public List<HoldRequestDto> listPendingHolds() {
        LocalDate today = LocalDate.now(clock);
        return subscriptions.findByHoldStatusOrderByHoldRequestedAtDesc(HOLD_PENDING).stream()
                .filter(s -> s.getMember() != null
                        && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null
                        && isActiveOn(s, today))
                .map(s -> toHoldRequestDto(s, 0))
                .toList();
    }

    /**
     * Mọi yêu cầu bảo lưu và dòng lịch sử bảo lưu cho màn hình quầy; {@code status} lọc theo PENDING/APPROVED/REJECTED/COMPLETED
     * (rỗng hoặc ALL là tất cả); bỏ qua hội viên đã bị xóa.
     */
    @Transactional(readOnly = true)
    public List<HoldRequestDto> listHolds(String status) {
        String wanted = status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)
                ? null : status.trim().toUpperCase(java.util.Locale.ROOT);
        return subscriptions.findAllWithHoldHistory().stream()
                .filter(s -> s.getMember() != null && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null)
                .filter(s -> wanted == null || wanted.equals(effectiveHoldStatus(s)))
                .map(s -> toHoldRequestDto(s, 0))
                .toList();
    }

    /**
     * Chi tiết bảo lưu của một kỳ gói dành cho chủ gói hoặc nhân viên quầy.
     */
    @Transactional(readOnly = true)
    public HoldRequestDto getHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwnerOrDesk(subscription, principal);
        return toHoldRequestDto(subscription, 0);
    }

    /**
     * Lấy một file giấy tờ của yêu cầu bảo lưu, chỉ dành cho chủ gói hoặc nhân viên quầy; file phải thuộc đúng kỳ gói.
     */
    @Transactional(readOnly = true)
    public com.swp391.scms.membership.entity.MembershipHoldDocument getHoldDocument(
            AuthenticatedPrincipal principal, Long subscriptionId, Long documentId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwnerOrDesk(subscription, principal);
        if (holdDocuments == null) throw new ResourceNotFoundException("resource.hold_document", documentId);
        return holdDocuments.findById(documentId)
                .filter(document -> document.getSubscription() != null
                        && subscriptionId.equals(document.getSubscription().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("resource.hold_document", documentId));
    }

    /**
     * Hạn mức và chính sách bảo lưu của một kỳ gói thuộc hội viên đang đăng nhập: có được bảo lưu không, đã dùng lượt
     * chưa, số ngày tối thiểu/tối đa, số giờ báo trước, số file và dung lượng giấy tờ tối đa.
     */
    @Transactional(readOnly = true)
    public com.swp391.scms.membership.dto.SubscriptionResponses.HoldPolicyDto holdPolicy(
            AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwner(subscription, principal);
        int maxDays = com.swp391.scms.facilities.PackageBenefits.holdMaxDays(subscription.getMembershipPackage());
        return new com.swp391.scms.membership.dto.SubscriptionResponses.HoldPolicyDto(
                maxDays > 0, subscription.isHoldUsed(), MIN_HOLD_DAYS, maxDays, HOLD_NOTICE_HOURS,
                MAX_HOLD_DOCUMENTS, MAX_HOLD_DOCUMENT_BYTES);
    }

    /**
     * Hội viên tự rút một yêu cầu bảo lưu chưa được quyết định (hoặc bảo lưu đã duyệt nhưng chưa bắt đầu).
     */
    @Transactional
    public SubscriptionDto cancelHoldRequest(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        ensureOwner(subscription, principal);
        return withdrawHold(subscription);
    }

    /**
     * Nhân viên quầy rút bảo lưu thay hội viên (hội viên yêu cầu tại quầy): áp dụng cho yêu cầu đang chờ duyệt hoặc
     * đợt bảo lưu đã duyệt nhưng chưa bắt đầu. Hội viên sẽ nhận được thông báo.
     */
    @Transactional
    public SubscriptionDto withdrawHoldForMember(AuthenticatedPrincipal principal, Long subscriptionId) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        if (!"RECEPTIONIST".equals(role) && !"CENTER_MANAGER".equals(role) && !"MANAGER".equals(role)) {
            throw new ForbiddenException("FORBIDDEN", "error.forbidden", null, "Only the front desk can withdraw a hold for a member");
        }
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        Long memberId = subscription.getMember() != null ? subscription.getMember().getUserId() : null;
        String packageName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
        SubscriptionDto result = withdrawHold(subscription);
        if (notificationService != null && memberId != null) {
            notificationService.send(memberId, msg("notifications.membership.hold_withdrawn_by_desk.title"),
                    msg("notifications.membership.hold_withdrawn_by_desk.body", packageName),
                    "system", "membership_subscription", subscriptionId);
        }
        return result;
    }

    /**
     * Rút bảo lưu: chỉ khi đang chờ duyệt, hoặc đã duyệt mà chưa tới ngày bắt đầu. Trường hợp đã duyệt: trả lại
     * lượt bảo lưu, bỏ miễn điểm danh, trừ lại số ngày đã cộng vào hạn gói; các lịch đã hủy lúc duyệt không
     * khôi phục. Xóa giấy tờ và mọi thông tin bảo lưu của kỳ gói.
     */
    private SubscriptionDto withdrawHold(MembershipSubscription subscription) {
        Long subscriptionId = subscription.getId();
        LocalDate today = LocalDate.now(clock);
        boolean approvedNotStarted = HOLD_APPROVED.equalsIgnoreCase(subscription.getHoldStatus())
                && STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())
                && subscription.getHoldStartDate() != null && subscription.getHoldStartDate().isAfter(today);
        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus()) && !approvedNotStarted) {
            throw new BadRequestException("MEMBERSHIP_HOLD_NOT_PENDING", "error.membership.hold_not_pending", null,
                    "Subscription does not have a hold request that can still be withdrawn");
        }
        if (approvedNotStarted) {
            // Đợt bảo lưu chưa từng bắt đầu nên gói tập được hoàn lại 1 lượt bảo lưu. Các lịch đặt đã hủy lúc duyệt vẫn giữ nguyên trạng thái đã hủy.
            subscription.setHoldUsed(false);
            if (courseAttendance != null) courseAttendance.releaseHoldExcuses(subscription.getMember().getUserId(), subscription.getHoldStartDate());
            if (subscription.isHoldDaysCredited() && subscription.getHoldStartDate() != null
                    && subscription.getHoldEndDate() != null && subscription.getEndDate() != null) {
                long heldDays = java.time.temporal.ChronoUnit.DAYS.between(subscription.getHoldStartDate(), subscription.getHoldEndDate()) + 1;
                subscription.setEndDate(subscription.getEndDate().minusDays(heldDays));
            }
        }
        if (holdDocuments != null) holdDocuments.deleteBySubscriptionId(subscriptionId);
        subscription.setHoldDaysCredited(null);
        subscription.setHoldStatus(null);
        subscription.setHoldReason(null);
        subscription.setHoldRequestedAt(null);
        subscription.setHoldStartDate(null);
        subscription.setHoldEndDate(null);
        subscription.setUpdatedAt(LocalDateTime.now(clock));
        return toDto(subscriptions.saveAndFlush(subscription));
    }

    /** Cho phép nhân viên quầy (lễ tân, quản lý); người khác phải là chủ kỳ gói. */
    private void ensureOwnerOrDesk(MembershipSubscription subscription, AuthenticatedPrincipal principal) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        if ("RECEPTIONIST".equals(role) || "CENTER_MANAGER".equals(role) || "MANAGER".equals(role)) return;
        ensureOwner(subscription, principal);
    }

    /**
     * Trạng thái bảo lưu để hiển thị: trạng thái hiện tại, hoặc COMPLETED nếu gói đã dùng lượt bảo lưu và không
     * còn yêu cầu nào.
     */
    private static String effectiveHoldStatus(MembershipSubscription s) {
        if (s.getHoldStatus() != null) return s.getHoldStatus().toUpperCase(java.util.Locale.ROOT);
        return s.isHoldUsed() ? "COMPLETED" : null;
    }

    /**
     * Lễ tân duyệt yêu cầu bảo lưu: chuyển gói tập sang trạng thái frozen và tự động hủy các lịch học đã đặt trong tương lai.
     */
    @Transactional
    public HoldRequestDto approveHold(AuthenticatedPrincipal principal, Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        Long memberId = subscription.getMember().getUserId();
        members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (entityManager != null) entityManager.refresh(subscription);
        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())
                || !STATUS_ACTIVE.equalsIgnoreCase(subscription.getStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_NOT_PENDING",
                    "error.membership.hold_not_pending",
                    null,
                    "Subscription does not have a pending hold request");
        }

        LocalDate today = LocalDate.now(clock);
        if (!isActiveOn(subscription, today)) {
            throw new BadRequestException("MEMBERSHIP_HOLD_REQUIRES_ACTIVE",
                    "error.membership.hold_requires_active", null, null);
        }
        ensureNoPendingOrCancellationHoldConflicts(memberId, subscriptionId, today);

        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate holdStart = subscription.getHoldStartDate();
        LocalDate holdEnd = subscription.getHoldEndDate();
        if (holdStart != null && holdEnd != null) {
            if (holdEnd.isBefore(today)) {
                throw new BadRequestException("MEMBERSHIP_HOLD_WINDOW_PASSED", "error.membership.hold_window_passed", null,
                        "The requested hold period has already passed");
            }
            if (holdStart.isBefore(today)) {
                // Duyệt muộn: những ngày hội viên đã trải qua không được tính bảo lưu, nên không cộng bù ngày cho các ngày đó.
                holdStart = today;
                subscription.setHoldStartDate(today);
            }
            long heldDays = java.time.temporal.ChronoUnit.DAYS.between(holdStart, holdEnd) + 1;
            if (subscription.getEndDate() != null) {
                subscription.setEndDate(subscription.getEndDate().plusDays(heldDays));
                subscription.setHoldDaysCredited(true);
            }
        }
        // Đợt bảo lưu có ngày cụ thể vẫn ở trạng thái active cho tới ngày đầu tiên; job quét hằng ngày sẽ chuyển sang frozen vào lúc đó.
        if (holdStart == null || !holdStart.isAfter(today)) {
            subscription.setStatus(STATUS_FROZEN);
        }
        subscription.setHoldUsed(true);
        subscription.setHoldStatus(HOLD_APPROVED);
        subscription.setHoldResolvedAt(now);
        if (principal != null && principal.id() != null && userRepository != null) {
            userRepository.findById(principal.id()).ifPresent(subscription::setHoldResolvedBy);
        }
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);

        int cancelledCount = 0;
        if (saved.getMember() != null && saved.getMember().getUserId() != null) {
            String cancelReason = msg("scheduling.enrollment.cancelled_by_hold");
            // Xử lý khóa học trước: bảo lưu được duyệt trước ngày khai giảng từ 3 ngày trở lên sẽ hoàn lại lượt hoặc học phí,
            // duyệt muộn hơn (hoặc với khóa đang diễn ra) sẽ mất lượt/phí. Các buổi PT 1:1 bên dưới không đụng tới đăng ký khóa học.
            if (enrollmentService != null) {
                var courses = enrollmentService.releaseCoursesForHold(
                        saved.getMember().getUserId(), cancelReason, holdStart, holdEnd);
                if (courses != null) cancelledCount += courses.cancelled();
            }
            if (holdStart != null && holdEnd != null) {
                // Chỉ giải phóng các buổi PT 1:1 rơi vào khoảng thời gian bảo lưu.
                if (entitlementRevocation != null) {
                    cancelledCount += entitlementRevocation.releaseBookingsBetween(
                            saved.getMember().getUserId(), holdStart, holdEnd, cancelReason);
                }
            } else if (entitlementRevocation != null) {
                // Kỳ đang frozen không bao phủ ngày nào, nên lớp học và buổi PT 1:1 đều bị giải phóng.
                cancelledCount += entitlementRevocation.revokeUncoveredBookings(saved.getMember().getUserId(), cancelReason);
            } else if (enrollmentService != null) {
                cancelledCount += enrollmentService.cancelFutureEnrollmentsForMember(
                        saved.getMember().getUserId(), cancelReason);
            }
        }

        if (notificationService != null && saved.getMember() != null && saved.getMember().getUserId() != null) {
            String pkgName = saved.getMembershipPackage() != null ? saved.getMembershipPackage().getName() : "";
            notificationService.send(
                    saved.getMember().getUserId(),
                    msg("notifications.membership.hold_approved.title"),
                    msg("notifications.membership.hold_approved.body", pkgName, cancelledCount),
                    "system",
                    "membership_subscription",
                    saved.getId());
        }

        return toHoldRequestDto(saved, cancelledCount);
    }

    /**
     * Lễ tân từ chối yêu cầu bảo lưu: giữ nguyên trạng thái gói tập active.
     */
    @Transactional
    public HoldRequestDto rejectHold(AuthenticatedPrincipal principal, Long subscriptionId, String rejectionReason) {
        MembershipSubscription subscription = subscriptions.findById(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));

        if (subscription.getMember() != null && subscription.getMember().getUserId() != null) {
            members.findByUserIdForUpdate(subscription.getMember().getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", subscription.getMember().getUserId()));
        }
        if (entityManager != null) entityManager.refresh(subscription);

        if (!HOLD_PENDING.equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new BadRequestException(
                    "MEMBERSHIP_HOLD_NOT_PENDING",
                    "error.membership.hold_not_pending",
                    null,
                    "Subscription does not have a pending hold request");
        }

        String reason = rejectionReason == null ? "" : rejectionReason.trim();
        if (reason.isEmpty()) {
            throw new BadRequestException("MEMBERSHIP_HOLD_REJECTION_REASON_REQUIRED",
                    "validation.membership.hold_rejection_reason.required", null,
                    "A rejection reason is required");
        }
        if (reason.length() > 500) {
            throw new BadRequestException("MEMBERSHIP_HOLD_REJECTION_REASON_TOO_LONG",
                    "validation.membership.hold_rejection_reason.size", null,
                    "Rejection reason must not exceed 500 characters");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        subscription.setHoldStatus(HOLD_REJECTED);
        subscription.setHoldRejectionReason(reason);
        subscription.setHoldResolvedAt(now);
        if (principal != null && principal.id() != null && userRepository != null) {
            userRepository.findById(principal.id()).ifPresent(subscription::setHoldResolvedBy);
        }
        subscription.setUpdatedAt(now);

        MembershipSubscription saved = subscriptions.saveAndFlush(subscription);

        if (notificationService != null && saved.getMember() != null && saved.getMember().getUserId() != null) {
            String pkgName = saved.getMembershipPackage() != null ? saved.getMembershipPackage().getName() : "";
            notificationService.send(
                    saved.getMember().getUserId(),
                    msg("notifications.membership.hold_rejected.title"),
                    msg("notifications.membership.hold_rejected.body", pkgName, reason),
                    "system",
                    "membership_subscription",
                    saved.getId());
        }

        return toHoldRequestDto(saved, 0);
    }

    /**
     * SCRUM-71 BR-01, BR-06:
     * Lấy subscription active hiện tại (start_date <= today <= end_date) của hội viên kèm mã QR định danh.
     * Không chọn nhầm các gói gia hạn trong tương lai (start_date > today).
     * Trả về null nếu hội viên chưa có gói hoặc gói đã hết hạn.
     */
    @Transactional(readOnly = true)
    public SubscriptionDto current(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        LocalDate today = LocalDate.now(clock);
        return subscriptions.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                        principal.id(), STATUS_ACTIVE, today, today)
                .map(current -> toDto(current, paidThroughDate(current,
                        subscriptions.findByMemberUserId(principal.id()))))
                .orElse(null);
    }

    /**
     * Ngày hết hạn thực tế đã trả tiền: đi tiếp theo chuỗi các kỳ gia hạn active cùng gói nối liền ngày (kỳ sau
     * bắt đầu ngay ngày sau kỳ trước) và trả ngày kết thúc của kỳ cuối.
     */
    private LocalDate paidThroughDate(MembershipSubscription current, List<MembershipSubscription> history) {
        MembershipSubscription tail = current;
        java.util.Set<Long> visited = new java.util.HashSet<>();
        while (visited.add(tail.getId())) {
            Long tailId = tail.getId();
            List<MembershipSubscription> successors = history.stream()
                    .filter(item -> item.getPreviousSubscription() != null
                            && tailId.equals(item.getPreviousSubscription().getId())
                            && STATUS_ACTIVE.equalsIgnoreCase(item.getStatus()))
                    .toList();
            if (successors.size() != 1) break;
            MembershipSubscription next = successors.get(0);
            if (visited.contains(next.getId()) || !validPeriod(next)
                    || !next.getStartDate().equals(tail.getEndDate().plusDays(1))
                    || next.getMembershipPackage() == null || tail.getMembershipPackage() == null
                    || !next.getMembershipPackage().getId().equals(tail.getMembershipPackage().getId())) break;
            tail = next;
        }
        return tail.getEndDate();
    }

    /**
     * SCRUM-71 BR-06:
     * Lấy danh sách lịch sử gói tập của chính hội viên.
     */
    @Transactional(readOnly = true)
    public List<SubscriptionDto> mine(AuthenticatedPrincipal principal) {
        findMember(principal.id());
        return subscriptions.findByMemberUserIdOrderByCreatedAtDesc(principal.id()).stream()
                .map(this::toDto)
                .toList();
    }

    /** Hội viên đã trả tiền trước cho một kỳ gia hạn bắt đầu trong tương lai chưa. */
    private boolean hasPaidFutureRenewal(Long memberId, LocalDate today) {
        return subscriptions.findByMemberUserId(memberId).stream()
                .anyMatch(item -> item.getPreviousSubscription() != null
                        && isPaidPeriod(item) && item.getStartDate() != null
                        && item.getStartDate().isAfter(today));
    }

    /** Lỗi 409 "đã có kỳ gia hạn trả trước, cần quản lý kiểm tra". */
    private ConflictException futurePaidConflict() {
        return new ConflictException("MEMBERSHIP_FUTURE_PAID_RENEWAL",
                "error.membership.future_paid_renewal", null,
                "Paid future renewal requires manager review");
    }

    /** Lấy hội viên theo id; không thấy thì báo 404. */
    private Member findMember(Long userId) {
        return members.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", userId));
    }

    /** Lấy gói đang mở bán (trạng thái active, số ngày > 0); không có thì báo 404, đã ngừng bán thì báo 400. */
    private MembershipPackage findActivePackage(Long packageId) {
        MembershipPackage membershipPackage = packages.findById(packageId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.package", packageId));
        if (!PACKAGE_ACTIVE.equalsIgnoreCase(membershipPackage.getStatus())
                || membershipPackage.getDurationDays() <= 0) {
            throw new BadRequestException(
                    "MEMBERSHIP_PACKAGE_INACTIVE",
                    "error.membership.package_inactive",
                    null,
                    "Membership package is inactive");
        }
        return membershipPackage;
    }

    /** Danh sách kỳ gói đang chờ thanh toán (mới nhất trước) cho quầy, bỏ hội viên đã bị xóa. */
    @Transactional(readOnly = true)
    public List<com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto> listPending() {
        return subscriptions.findByStatusOrderByCreatedAtDesc(STATUS_PENDING_PAYMENT).stream()
                .filter(s -> s.getMember() != null
                        && s.getMember().getUser() != null
                        && s.getMember().getUser().getDeletedAt() == null)
                .map(this::toPendingDto)
                .toList();
    }

    /**
     * Sinh mã QR động để check-in: hội viên phải có gói đang active; trả chuỗi QR, thời gian sống (giây) và
     * thời điểm tạo.
     */
    @Transactional(readOnly = true)
    public com.swp391.scms.membership.dto.SubscriptionResponses.DynamicQrDto generateDynamicQr(AuthenticatedPrincipal principal) {
        SubscriptionDto sub = current(principal);
        if (sub == null || !STATUS_ACTIVE.equalsIgnoreCase(sub.status())) {
            throw new BadRequestException(
                    "MEMBERSHIP_NOT_ACTIVE",
                    "error.attendance.subscription_not_active",
                    null,
                    "No active subscription found to generate dynamic QR");
        }
        long nowMillis = clock.instant().toEpochMilli();
        String qr = dynamicQrService.generate(principal.id(), sub.id(), nowMillis);
        return new com.swp391.scms.membership.dto.SubscriptionResponses.DynamicQrDto(
                qr, dynamicQrService.getTtlSeconds(), LocalDateTime.now(clock));
    }

    /** Chuyển kỳ gói sang SubscriptionDto (không có ngày hết hạn thực tế). */
    private SubscriptionDto toDto(MembershipSubscription s) {
        return toDto(s, null);
    }

    /**
     * Chuyển kỳ gói sang SubscriptionDto: tên gói (gói dùng thử hiển thị tên chuẩn), thông tin kỳ, bảo lưu,
     * giá, phí nâng cấp, phần trừ và giá trị còn lại (chỉ tính khi gói đang hiệu lực).
     */
    private SubscriptionDto toDto(MembershipSubscription s, LocalDate paidThroughDate) {
        String pkgName;
        if (isTrialSubscription(s)) {
            pkgName = CatalogSeeder.TRIAL_PACKAGE_NAME;
        } else {
            pkgName = s.getMembershipPackage() != null ? s.getMembershipPackage().getName() : null;
        }
        return new SubscriptionDto(
                s.getId(),
                s.getMember() != null ? s.getMember().getUserId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getId() : null,
                pkgName,
                s.getPreviousSubscription() != null ? s.getPreviousSubscription().getId() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getQrCode(),
                s.getCreatedAt(),
                s.getHoldStatus(),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                paidThroughDate,
                s.getUpgradeCharge(),
                s.getQuotedPrice(),
                s.getCreditApplied(),
                isActiveOn(s, LocalDate.now(clock)) ? valueCalculator().remainingValue(s, LocalDate.now(clock)) : null);
    }

    /**
     * Chuyển kỳ chờ thanh toán sang DTO cho quầy: thông tin hội viên, gói và số tiền cần thu (nếu có đúng một
     * khoản thanh toán đang chờ thì lấy số tiền của khoản đó).
     */
    private com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto toPendingDto(MembershipSubscription s) {
        Member m = s.getMember();
        com.swp391.scms.users.entity.User u = m != null ? m.getUser() : null;
        MembershipPackage pkg = s.getMembershipPackage();
        BigDecimal payablePrice = s.payableAmount();
        if (paymentRepository != null) {
            var pendingPayments = paymentRepository.findAllBySubscriptionId(s.getId()).stream()
                    .filter(payment -> "pending".equalsIgnoreCase(payment.getStatus())
                            && payment.getMember() != null && m != null
                            && m.getUserId().equals(payment.getMember().getUserId()))
                    .toList();
            if (pendingPayments.size() == 1) payablePrice = pendingPayments.getFirst().getAmount();
        }
        return new com.swp391.scms.membership.dto.SubscriptionResponses.PendingSubscriptionDto(
                s.getId(),
                m != null ? m.getUserId() : null,
                m != null ? m.getMembershipCode() : null,
                u != null ? u.getFullName() : null,
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                pkg != null ? pkg.getId() : null,
                pkg != null ? pkg.getName() : null,
                pkg != null ? pkg.getDurationDays() : null,
                payablePrice,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getCreatedAt(),
                s.getPreviousSubscription() != null ? s.getPreviousSubscription().getId() : null);
    }

    /** Danh sách thông tin giấy tờ bảo lưu (không kèm nội dung file) của một kỳ gói. */
    private List<com.swp391.scms.membership.dto.SubscriptionResponses.HoldDocumentDto> holdDocumentDtos(MembershipSubscription s) {
        if (holdDocuments == null || s.getId() == null) return List.of();
        return holdDocuments.findBySubscriptionIdOrderByIdAsc(s.getId()).stream()
                .map(d -> new com.swp391.scms.membership.dto.SubscriptionResponses.HoldDocumentDto(
                        d.getId(), d.getFileName(), d.getContentType(), d.getSizeBytes(), d.getUploadedAt()))
                .toList();
    }

    /**
     * Chuyển kỳ gói sang HoldRequestDto cho màn bảo lưu: hội viên, gói, thời hạn, trạng thái, lý do, các mốc
     * thời gian, khoảng bảo lưu, giấy tờ và lý do từ chối.
     */
    private HoldRequestDto toHoldRequestDto(MembershipSubscription s, int cancelledEnrollmentsCount) {
        Member m = s.getMember();
        com.swp391.scms.users.entity.User u = m != null ? m.getUser() : null;
        MembershipPackage pkg = s.getMembershipPackage();
        return new HoldRequestDto(
                s.getId(),
                m != null ? m.getUserId() : null,
                m != null ? m.getMembershipCode() : null,
                u != null ? u.getFullName() : null,
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                pkg != null ? pkg.getId() : null,
                pkg != null ? pkg.getName() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                effectiveHoldStatus(s),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                cancelledEnrollmentsCount,
                s.getHoldStartDate(),
                s.getHoldEndDate(),
                holdDocumentDtos(s),
                s.getHoldRejectionReason());
    }

    /** Đây có phải gói dùng thử không: tên gói chứa "TRẢI NGHIỆM"/"TRIAL", hoặc gói/kỳ chỉ dài tối đa 3 ngày. */
    private boolean isTrialSubscription(MembershipSubscription sub) {
        if (sub == null) return false;
        if (sub.getMembershipPackage() != null) {
            String name = sub.getMembershipPackage().getName();
            if (name != null) {
                String upper = name.toUpperCase(java.util.Locale.ROOT);
                if (upper.contains("TRẢI NGHIỆM") || upper.contains("TRIAL")) return true;
            }
            if (sub.getMembershipPackage().getDurationDays() > 0 && sub.getMembershipPackage().getDurationDays() <= 3) return true;
        }
        if (sub.getStartDate() != null && sub.getEndDate() != null) {
            long days = java.time.temporal.ChronoUnit.DAYS.between(sub.getStartDate(), sub.getEndDate());
            if (days <= 3) return true;
        }
        return false;
    }
}
