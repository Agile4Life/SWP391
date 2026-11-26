package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.dto.CancellationDtos;
import com.swp391.scms.membership.entity.MembershipCancellationRequest;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipCancellationRequestRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.wallet.WalletService;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Yêu cầu hủy gói tập và hoàn tiền: hội viên hoặc lễ tân gửi yêu cầu, quản lý duyệt hoặc từ chối. Khi duyệt,
 * các gói còn lại bị hủy, lịch đặt không còn được gói nào bao phủ bị hủy và tiền hoàn được cộng vào Ví hội
 * viên.
 */
@Service
public class MembershipCancellationService {
    private final MembershipCancellationRequestRepository requests;
    private final MembershipSubscriptionRepository subscriptions;
    private final MemberRepository members;
    private final UserRepository users;
    private final EnrollmentService enrollments;
    private final MessageService messages;
    private final Clock clock;
    private final PaymentRepository payments;
    private final EntityManager entityManager;

    @Autowired(required = false)
    private EntitlementRevocationService entitlementRevocation;

    @Autowired(required = false)
    private WalletService walletService;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired(required = false)
    private SubscriptionValueCalculator valueCalculator;

    /** Gán giá trị mới cho trường walletService. */
    public void setWalletService(WalletService walletService) {
        this.walletService = walletService;
    }

    /** Gán giá trị mới cho trường notificationService. */
    public void setNotificationService(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    /** Constructor Spring dùng với các repository và dịch vụ bắt buộc. */
    public MembershipCancellationService(MembershipCancellationRequestRepository requests,
            MembershipSubscriptionRepository subscriptions, MemberRepository members,
            UserRepository users, EnrollmentService enrollments, MessageService messages, Clock clock,
            PaymentRepository payments, EntityManager entityManager) {
        this.requests = requests;
        this.subscriptions = subscriptions;
        this.members = members;
        this.users = users;
        this.enrollments = enrollments;
        this.messages = messages;
        this.clock = clock;
        this.payments = payments;
        this.entityManager = entityManager;
    }

    /**
     * Hội viên gửi yêu cầu hủy gói của chính mình: gói phải đang hiệu lực, không có bảo lưu đang chờ, phải có
     * lý do và chưa có yêu cầu hủy nào đang chờ. Số tiền hoàn đề xuất là phần chưa dùng của số tiền thực trả.
     */
    @Transactional
    public CancellationDtos.Response request(AuthenticatedPrincipal principal, Long subscriptionId, CancellationDtos.Request body) {
        Member member = lockMember(principal.id());
        MembershipSubscription subscription = lockSubscription(subscriptionId);
        if (subscription.getMember() == null || !member.getUserId().equals(subscription.getMember().getUserId())) {
            throw new ForbiddenException("MEMBERSHIP_NOT_OWNER", "error.membership.not_owner", null, null);
        }
        if (!isActiveNow(subscription)) {
            throw new ConflictException("CANCELLATION_NOT_ACTIVE", "error.membership.cancellation_not_active", null, null);
        }
        if ("PENDING".equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING", "error.membership.hold_already_pending", null, null);
        }
        if ("APPROVED".equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_APPROVED", "error.membership.hold_already_requested", null, null);
        }
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty()) {
            throw new BadRequestException("CANCELLATION_REASON_REQUIRED", "validation.membership.cancellation_reason.not_blank", null, null);
        }
        if (requests.existsBySubscriptionIdAndStatus(subscriptionId, "PENDING")) {
            throw new ConflictException("CANCELLATION_PENDING_EXISTS", "error.membership.cancellation_pending_exists", null, null);
        }
        MembershipCancellationRequest request = new MembershipCancellationRequest();
        request.setMember(member);
        request.setSubscription(subscription);
        request.setReason(reason);
        request.setRefundAmount(defaultRefund(subscription));
        request.setRequestedAt(LocalDateTime.now(clock));
        return toDto(requests.saveAndFlush(request));
    }

    /**
     * Lễ tân/quản lý gửi yêu cầu hủy thay hội viên (theo kỳ gói hoặc theo hội viên, khi đó lấy gói đang hiệu
     * lực mới nhất). Có thể nhập số tiền hoàn (không vượt số đã trả). Gửi thông báo cho mọi quản lý đang hoạt
     * động để duyệt.
     */
    @Transactional
    public CancellationDtos.Response staffRequest(AuthenticatedPrincipal principal, CancellationDtos.StaffRequest body) {
        if (principal == null || !("RECEPTIONIST".equalsIgnoreCase(principal.role())
                || "STAFF".equalsIgnoreCase(principal.role())
                || "CENTER_MANAGER".equalsIgnoreCase(principal.role())
                || "MANAGER".equalsIgnoreCase(principal.role()))) {
            throw new ForbiddenException("CANCELLATION_STAFF_ONLY", "error.forbidden", null, null);
        }
        String reason = body == null || body.reason() == null ? "" : body.reason().trim();
        if (reason.isEmpty()) {
            throw new BadRequestException("CANCELLATION_REASON_REQUIRED", "validation.membership.cancellation_reason.not_blank", null, null);
        }

        Member member;
        MembershipSubscription subscription;
        if (body.subscriptionId() != null) {
            MembershipSubscription found = subscriptions.findById(body.subscriptionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", body.subscriptionId()));
            Long ownerId = found.getMember() != null ? found.getMember().getUserId() : null;
            if (ownerId == null || (body.memberId() != null && !ownerId.equals(body.memberId()))) {
                throw new BadRequestException("MEMBERSHIP_NOT_OWNER", "error.membership.not_owner", null, null);
            }
            member = lockMember(ownerId);
            subscription = lockSubscription(body.subscriptionId());
            if (subscription.getMember() == null || !ownerId.equals(subscription.getMember().getUserId())) {
                throw new BadRequestException("MEMBERSHIP_NOT_OWNER", "error.membership.not_owner", null, null);
            }
        } else if (body.memberId() != null) {
            member = lockMember(body.memberId());
            MembershipSubscription activeSub = subscriptions.findByMemberUserIdOrderByCreatedAtDesc(body.memberId())
                    .stream()
                    .filter(this::isActiveNow)
                    .findFirst()
                    .orElseThrow(() -> new ConflictException("CANCELLATION_NOT_ACTIVE", "error.membership.cancellation_not_active", null, null));
            subscription = lockSubscription(activeSub.getId());
        } else {
            throw new BadRequestException("CANCELLATION_TARGET_REQUIRED", "resource.subscription", null, null);
        }

        if (!isActiveNow(subscription)) {
            throw new ConflictException("CANCELLATION_NOT_ACTIVE", "error.membership.cancellation_not_active", null, null);
        }
        if ("PENDING".equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING", "error.membership.hold_already_pending", null, null);
        }
        if ("APPROVED".equalsIgnoreCase(subscription.getHoldStatus())) {
            throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_APPROVED", "error.membership.hold_already_requested", null, null);
        }
        if (requests.existsBySubscriptionIdAndStatus(subscription.getId(), "PENDING")) {
            throw new ConflictException("CANCELLATION_PENDING_EXISTS", "error.membership.cancellation_pending_exists", null, null);
        }

        BigDecimal defaultRefund = defaultRefund(subscription);
        BigDecimal refundAmount = (body.refundAmount() != null && body.refundAmount().compareTo(BigDecimal.ZERO) >= 0)
                ? body.refundAmount()
                : defaultRefund;
        ensureRefundWithinPaid(subscription, refundAmount);

        MembershipCancellationRequest request = new MembershipCancellationRequest();
        request.setMember(member);
        request.setSubscription(subscription);
        request.setReason(reason);
        request.setRefundAmount(refundAmount);
        request.setRequestedAt(LocalDateTime.now(clock));
        if (principal.id() != null && users != null) {
            users.findByIdAndDeletedAtIsNull(principal.id()).ifPresent(request::setRequestedBy);
        }
        MembershipCancellationRequest saved = requests.saveAndFlush(request);

        if (notificationService != null && users != null) {
            String memberName = member.getUser() != null ? member.getUser().getFullName() : ("#" + member.getUserId());
            String pkgName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
            for (User mgr : users.findActiveManagers()) {
                try {
                    String title = messages != null
                            ? messages.getMessage("notifications.membership.cancellation.staff_request.title")
                            : "Yêu cầu hủy gói tập & hoàn tiền mới";
                    String msgBody = messages != null
                            ? messages.getMessage("notifications.membership.cancellation.staff_request.body", memberName, pkgName, refundAmount.toPlainString(), "100", reason)
                            : ("Lễ tân vừa trình yêu cầu hủy gói " + pkgName + " của hội viên " + memberName
                                    + " (Hoàn dự kiến: " + refundAmount.toPlainString() + " đ). Lý do: " + reason);
                    notificationService.send(
                            mgr.getId(),
                            title,
                            msgBody,
                            "system",
                            "cancellation_request",
                            saved.getId(),
                            "/manager/reports");
                } catch (RuntimeException ignored) {
                }
            }
        }
        return toDto(saved);
    }

    /** Các yêu cầu hủy của hội viên đang đăng nhập, mới nhất trước. */
    @Transactional(readOnly = true)
    public List<CancellationDtos.Response> mine(AuthenticatedPrincipal principal) {
        return requests.findByMemberUserIdOrderByRequestedAtDesc(principal.id()).stream().map(this::toDto).toList();
    }

    /** Mọi yêu cầu hủy cho màn hình quản lý. */
    @Transactional(readOnly = true)
    public List<CancellationDtos.Response> all() {
        return requests.findAllForManager().stream()
                .map(this::toDto).toList();
    }

    /**
     * Quản lý duyệt/từ chối yêu cầu hủy (khóa hội viên và yêu cầu; yêu cầu phải đang chờ). Duyệt: gói phải còn
     * hiệu lực, là quyền lợi duy nhất còn lại, chuyển kỳ gói được yêu cầu sang
     * cancelled, hủy lịch không còn được bao phủ, ghi nhận hoàn tiền trên các khoản thanh toán và cộng vào Ví,
     * rồi thông báo hội viên và lễ tân đã gửi yêu cầu. Từ chối: thông báo kèm ghi chú. Cuối cùng lưu người
     * quyết định, thời điểm và ghi chú.
     */
    @Transactional
    public CancellationDtos.Response decide(AuthenticatedPrincipal principal, Long requestId,
            boolean approve, CancellationDtos.Decision body) {
        if (principal == null || !("CENTER_MANAGER".equalsIgnoreCase(principal.role())
                || "MANAGER".equalsIgnoreCase(principal.role()))) {
            throw new ForbiddenException("CANCELLATION_MANAGER_ONLY", "error.membership.cancellation_manager_only", null, null);
        }
        MembershipCancellationRequest initial = requests.findById(requestId)
            .orElseThrow(() -> new ResourceNotFoundException("resource.cancellation_request", requestId));
        Long memberId = initial.getMember().getUserId();
        lockMember(memberId);
        MembershipCancellationRequest request = requests.findByIdForUpdate(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.cancellation_request", requestId));
        if (entityManager != null) entityManager.refresh(request);
        if (!"PENDING".equals(request.getStatus())) {
            throw new ConflictException("CANCELLATION_ALREADY_DECIDED", "error.membership.cancellation_already_decided", null, null);
        }
        if (approve) {
            MembershipSubscription subscription = lockSubscription(request.getSubscription().getId());
            if (!isActiveNow(subscription)) {
                throw new ConflictException("CANCELLATION_NOT_ACTIVE", "error.membership.cancellation_not_active", null, null);
            }
            if ("PENDING".equalsIgnoreCase(subscription.getHoldStatus())) {
                throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_PENDING", "error.membership.hold_already_pending", null, null);
            }
            if ("APPROVED".equalsIgnoreCase(subscription.getHoldStatus())) {
                throw new ConflictException("MEMBERSHIP_HOLD_ALREADY_APPROVED", "error.membership.hold_already_requested", null, null);
            }
            // Đăng ký lớp tham chiếu tới hội viên và lớp học chứ không tham chiếu kỳ gói. Việc hủy trên toàn hội viên
            // bên dưới chỉ an toàn khi đây là quyền lợi duy nhất còn lại.
            ensureSoleEntitlement(memberId, subscription);

            BigDecimal refundAmount = (body != null && body.refundAmount() != null)
                    ? body.refundAmount()
                    : request.getRefundAmount();
            if (refundAmount == null) {
                refundAmount = defaultRefund(subscription);
            }
            ensureRefundWithinPaid(subscription, refundAmount);

            subscription.setStatus("cancelled");
            subscription.setHoldStatus(null);
            subscription.setHoldStartDate(null);
            subscription.setHoldEndDate(null);
            subscription.setHoldDaysCredited(false);
            subscription.setUpdatedAt(LocalDateTime.now(clock));
            subscriptions.saveAndFlush(subscription);
            String cancelReason = messages != null
                    ? messages.getMessage("scheduling.enrollment.cancelled_by_membership")
                    : "Gói tập đã được quản lý duyệt hủy.";
            if (entitlementRevocation != null) {
                entitlementRevocation.revokeUncoveredBookings(memberId, cancelReason);
            } else {
                enrollments.cancelFutureEnrollmentsForMember(memberId, cancelReason);
            }

            request.setRefundAmount(refundAmount);
            if (walletService != null && refundAmount != null && refundAmount.compareTo(BigDecimal.ZERO) > 0) {
                // Khoản thanh toán cũng phải thể hiện phần hoàn tiền, nếu không doanh thu sẽ bị tính thừa và /payments/{id}/refund có thể hoàn tiền lần nữa.
                recordRefundOnPayments(subscription, refundAmount, request.getReason());
                walletService.creditRefund(
                        memberId,
                        refundAmount,
                        "CANCEL_REQ_" + request.getId(),
                        request.getReason());
            } else if (notificationService != null) {
                try {
                    String pkgName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
                    String noteSuffix = (body != null && body.note() != null && !body.note().isBlank())
                            ? (messages != null
                                    ? messages.getMessage("notifications.membership.cancellation.manager_note", body.note().trim())
                                    : (" Ghi chú: " + body.note().trim()))
                            : "";
                    String title = messages != null
                            ? messages.getMessage("notifications.membership.cancellation.approved_no_refund.title")
                            : "Gói tập đã được duyệt hủy";
                    String msgBody = messages != null
                            ? messages.getMessage("notifications.membership.cancellation.approved_no_refund.body", pkgName, noteSuffix)
                            : ("Yêu cầu hủy gói tập của bạn đã được Quản lý phê duyệt." + noteSuffix);
                    notificationService.send(
                            memberId,
                            title,
                            msgBody,
                            "payment",
                            "cancellation_request",
                            request.getId(),
                            "/member/packages");
                } catch (RuntimeException ignored) {
                }
            }

            if (notificationService != null && request.getRequestedBy() != null && request.getRequestedBy().getId() != null) {
                String pkgName = subscription.getMembershipPackage() != null ? subscription.getMembershipPackage().getName() : "";
                String title = messages != null
                        ? messages.getMessage("notifications.membership.cancellation.approved_refund.title")
                        : "Quản lý đã duyệt yêu cầu hủy gói & hoàn tiền";
                String msgBody = messages != null
                        ? messages.getMessage("notifications.membership.cancellation.approved_refund.body", pkgName, refundAmount != null ? refundAmount.toPlainString() : "0", "100", "")
                        : "Yêu cầu hủy gói của hội viên đã được phê duyệt. Tiền hoàn đã chuyển vào Ví hội viên.";
                try {
                    notificationService.send(
                            request.getRequestedBy().getId(),
                            title,
                            msgBody,
                            "system",
                            "cancellation_request",
                            request.getId(),
                            "/staff/reception");
                } catch (RuntimeException ignored) {
                }
            }
        } else {
            if (notificationService != null) {
                String pkgName = request.getSubscription() != null && request.getSubscription().getMembershipPackage() != null
                        ? request.getSubscription().getMembershipPackage().getName()
                        : "";
                String noteSuffix = (body != null && body.note() != null && !body.note().isBlank())
                        ? (messages != null
                                ? messages.getMessage("notifications.membership.cancellation.manager_note", body.note().trim())
                                : (" Ghi chú: " + body.note().trim()))
                        : "";
                String title = messages != null
                        ? messages.getMessage("notifications.membership.cancellation.rejected.title")
                        : "Yêu cầu hủy gói tập bị từ chối";
                String msgBody = messages != null
                        ? messages.getMessage("notifications.membership.cancellation.rejected.body", pkgName, noteSuffix)
                        : ("Yêu cầu hủy gói tập chưa được Quản lý phê duyệt." + noteSuffix);
                try {
                    notificationService.send(
                            memberId,
                            title,
                            msgBody,
                            "system",
                            "cancellation_request",
                            request.getId(),
                            "/member/packages");
                } catch (RuntimeException ignored) {
                }
                if (request.getRequestedBy() != null && request.getRequestedBy().getId() != null) {
                    try {
                        notificationService.send(
                                request.getRequestedBy().getId(),
                                title,
                                msgBody,
                                "system",
                                "cancellation_request",
                                request.getId(),
                                "/staff/reception");
                    } catch (RuntimeException ignored) {
                    }
                }
            }
        }
        User manager = users.findByIdAndDeletedAtIsNull(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.manager", principal.id()));
        request.setStatus(approve ? "APPROVED" : "REJECTED");
        request.setResolvedBy(manager);
        request.setResolvedAt(LocalDateTime.now(clock));
        request.setResolutionNote(body == null || body.note() == null ? null : body.note().trim());
        return toDto(requests.saveAndFlush(request));
    }

    /**
     * Chỉ cho hủy khi đây là quyền lợi duy nhất: không còn khoản thanh toán khóa học chưa xong, không có kỳ gia
     * hạn trả trước trong tương lai, không có kỳ chờ thanh toán.
     */
    private void ensureSoleEntitlement(Long memberId, MembershipSubscription cancelling) {
        LocalDate today = LocalDate.now(clock);
        if (payments.hasUnsettledUpcomingEnrollmentPayment(memberId, today, LocalDateTime.now(clock).toLocalTime())) {
            throw new ConflictException("CANCELLATION_PAID_ENROLLMENT",
                    "error.membership.cancellation_paid_enrollment", null, null);
        }
        Long cancellingId = cancelling != null ? cancelling.getId() : null;
        List<MembershipSubscription> history = subscriptions.findByMemberUserId(memberId);
        for (MembershipSubscription other : history) {
            if (cancellingId != null && other.getId().equals(cancellingId)) continue;
            String status = other.getStatus();
            if (("active".equalsIgnoreCase(status) || "frozen".equalsIgnoreCase(status))
                    && other.getEndDate() != null && !other.getEndDate().isBefore(today)) {
                throw new ConflictException("CANCELLATION_OTHER_ENTITLEMENT", "error.membership.cancellation_paid_future", null, null);
            }
            if ("pending_payment".equalsIgnoreCase(status)) {
                throw new ConflictException("CANCELLATION_PENDING_PAYMENT", "error.membership.cancellation_pending_payment", null, null);
            }
        }
    }

    /** Khóa dòng hội viên để các thao tác trên cùng hội viên xếp hàng; không thấy thì báo 404. */
    private Member lockMember(Long memberId) {
        return members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
    }

    /** Khóa dòng kỳ gói và đọc lại dữ liệu mới nhất từ database; không thấy thì báo 404. */
    private MembershipSubscription lockSubscription(Long subscriptionId) {
        MembershipSubscription subscription = subscriptions.findByIdForUpdate(subscriptionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.subscription", subscriptionId));
        if (entityManager != null) entityManager.refresh(subscription);
        return subscription;
    }

    /**
     * Số tiền hoàn đề xuất: phần chưa sử dụng của số tiền hội viên thực trả cho kỳ này (bao gồm giá trị chuyển sang
     * từ gói đã nâng cấp), không bao giờ lấy theo giá niêm yết hiện tại. Quản lý vẫn có thể điều chỉnh.
     */
    private BigDecimal defaultRefund(MembershipSubscription subscription) {
        SubscriptionValueCalculator calculator = valueCalculator != null ? valueCalculator : new SubscriptionValueCalculator(payments);
        return calculator.remainingValue(subscription, LocalDate.now(clock));
    }

    /**
     * Số tiền hoàn không được vượt quá số tiền hội viên đã thực trả cho kỳ này (tiền mặt cộng phần quy đổi chuyển sang);
     * nếu vượt thì báo lỗi 400.
     */
    private void ensureRefundWithinPaid(MembershipSubscription subscription, BigDecimal refundAmount) {
        if (refundAmount == null) return;
        SubscriptionValueCalculator calculator = valueCalculator != null ? valueCalculator : new SubscriptionValueCalculator(payments);
        BigDecimal paid = calculator.paidValue(subscription);
        if (refundAmount.compareTo(paid) > 0) {
            throw new BadRequestException("CANCELLATION_REFUND_EXCEEDS_PAID", "error.membership.refund_exceeds_paid",
                    new Object[]{refundAmount.toPlainString(), paid.toPlainString()}, null);
        }
    }

    private static final int MAX_CHAIN_DEPTH = 20;

    /**
     * Phân bổ số tiền hoàn lên các khoản thanh toán thành công của kỳ (khoản cũ trước), cập nhật số đã hoàn và ghi
     * chú; khoản thanh toán được hoàn đủ sẽ chuyển sang trạng thái {@code refunded}. Khi kỳ bị hủy là gói nâng cấp
     * (mang theo phần quy đổi {@code creditApplied} từ kỳ trước), nếu số tiền hoàn vượt phần đã thu của kỳ hiện tại
     * thì tiếp tục đi ngược chuỗi {@code previousSubscription} (giới hạn {@value #MAX_CHAIN_DEPTH}) để ghi nhận đủ
     * phần hoàn lên các giao dịch gốc. Nhờ vậy báo cáo doanh thu chính xác và tránh hoàn trùng hai lần.
     */
    private void recordRefundOnPayments(MembershipSubscription subscription, BigDecimal refundAmount, String reason) {
        if (payments == null || subscription == null || subscription.getId() == null
                || refundAmount == null || refundAmount.signum() <= 0) return;
        BigDecimal remaining = refundAmount;
        MembershipSubscription current = subscription;
        java.util.Set<Long> visited = new java.util.HashSet<>();
        int depth = 0;
        while (current != null && current.getId() != null && remaining.signum() > 0
                && depth <= MAX_CHAIN_DEPTH && visited.add(current.getId())) {
            for (var payment : payments.findAllBySubscriptionId(current.getId()).stream()
                    .filter(p -> "success".equalsIgnoreCase(p.getStatus()))
                    .sorted(java.util.Comparator.comparing(com.swp391.scms.finance.entity.Payment::getId,
                            java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder())))
                    .toList()) {
                if (remaining.signum() <= 0) break;
                BigDecimal already = payment.getRefundedAmount() != null ? payment.getRefundedAmount() : BigDecimal.ZERO;
                BigDecimal net = payment.getAmount().subtract(already);
                if (net.signum() <= 0) continue;
                BigDecimal portion = net.min(remaining);
                payment.setRefundedAmount(already.add(portion));
                if (payment.getRefundedAmount().compareTo(payment.getAmount()) >= 0) {
                    payment.setStatus("refunded");
                }
                String note = "CANCEL_REQ refund " + portion.toPlainString() + (reason == null || reason.isBlank() ? "" : " - " + reason);
                String combined = payment.getNote() == null || payment.getNote().isBlank() ? note : payment.getNote() + " | " + note;
                payment.setNote(combined.length() > 255 ? combined.substring(0, 255) : combined);
                payments.save(payment);
                remaining = remaining.subtract(portion);
            }
            if (remaining.signum() <= 0) break;
            MembershipSubscription previous = current.getPreviousSubscription();
            if (previous == null || !isUpgradeLink(current, previous)) break;
            current = previous;
            depth++;
        }
    }

    /** Kỳ hiện tại có phải là kỳ nâng cấp từ kỳ trước không (có tín dụng chuyển tiếp, phí nâng cấp hoặc khác gói). */
    private static boolean isUpgradeLink(MembershipSubscription current, MembershipSubscription previous) {
        if (current.getCreditApplied() != null && current.getCreditApplied().signum() > 0) return true;
        if (current.getUpgradeCharge() != null) return true;
        return current.getMembershipPackage() != null && previous.getMembershipPackage() != null
                && current.getMembershipPackage().getId() != null
                && !current.getMembershipPackage().getId().equals(previous.getMembershipPackage().getId());
    }

    /** Kỳ gói đang active và chưa hết hạn tính tới hôm nay. */
    private boolean isActiveNow(MembershipSubscription subscription) {
        LocalDate today = LocalDate.now(clock);
        return "active".equalsIgnoreCase(subscription.getStatus())
                && subscription.getEndDate() != null && !subscription.getEndDate().isBefore(today);
    }

    /** Chuyển yêu cầu hủy sang DTO trả cho client (thiếu số tiền hoàn thì tính số đề xuất). */
    private CancellationDtos.Response toDto(MembershipCancellationRequest request) {
        Member member = request.getMember();
        MembershipSubscription subscription = request.getSubscription();
        BigDecimal refund = request.getRefundAmount();
        if (refund == null && subscription != null) {
            refund = defaultRefund(subscription);
        }
        return new CancellationDtos.Response(request.getId(), member.getUserId(),
                member.getUser() == null ? null : member.getUser().getFullName(),
                subscription.getId(), subscription.getMembershipPackage().getName(),
                request.getReason(), request.getStatus(), request.getRequestedAt(),
                request.getResolvedBy() == null ? null : request.getResolvedBy().getId(),
                request.getResolvedAt(), request.getResolutionNote(),
                refund,
                request.getRequestedBy() == null ? null : request.getRequestedBy().getId(),
                request.getRequestedBy() == null ? null : request.getRequestedBy().getFullName());
    }
}
