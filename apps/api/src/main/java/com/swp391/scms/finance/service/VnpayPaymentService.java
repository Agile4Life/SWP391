package com.swp391.scms.finance.service;

import com.swp391.scms.common.exception.*;
import com.swp391.scms.finance.dto.VnpayDtos.*;
import com.swp391.scms.finance.entity.*;
import com.swp391.scms.finance.repository.*;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/**
 * Nghiệp vụ VNPay: tạo lượt thanh toán (gói, PT, khoản thu, đơn hàng, nạp ví), trả bằng ví, xem/hủy lượt,
 * và xử lý IPN (ghi nhận thanh toán, cộng ví khi nạp, hoàn vào ví nếu cổng báo trừ tiền cho khoản đã thanh
 * toán/đóng theo cách khác).
 */
@Service
@Transactional
public class VnpayPaymentService {
    private final VnpayTransactionRepository transactions;
    private final PaymentRepository payments;
    private final MemberRepository members;
    private final MembershipSubscriptionRepository subscriptions;
    private final PaymentService settlement;
    private final InvoiceService invoices;
    private final VnpayGateway gateway;
    private final Clock clock;
    private final EntityManager entities;
    private final CoachBookingRepository coaches;
    private final NotificationService notifications;
    private final MessageService messages;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.wallet.WalletService walletService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.shop.service.ProductOrderPayments orderPayments;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.shop.repository.ProductOrderRepository orders;

    /** Constructor Spring dùng. */
    public VnpayPaymentService(VnpayTransactionRepository transactions, PaymentRepository payments, MemberRepository members,
            MembershipSubscriptionRepository subscriptions, PaymentService settlement, InvoiceService invoices,
            VnpayGateway gateway, Clock clock, EntityManager entities, CoachBookingRepository coaches,
            NotificationService notifications, MessageService messages) {
        this.transactions=transactions; this.payments=payments; this.members=members; this.subscriptions=subscriptions;
        this.settlement=settlement; this.invoices=invoices; this.gateway=gateway; this.clock=clock; this.entities=entities;
        this.coaches=coaches; this.notifications=notifications; this.messages=messages;
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.shop.service.ProductOrderRefunds orderRefunds;

    /** Gán giá trị mới cho trường orderRefunds. */
    public void setOrderRefunds(com.swp391.scms.shop.service.ProductOrderRefunds orderRefunds) {
        this.orderRefunds = orderRefunds;
    }

    /** Gán giá trị mới cho trường orderPayments. */
    public void setOrderPayments(com.swp391.scms.shop.service.ProductOrderPayments orderPayments) {
        this.orderPayments = orderPayments;
    }

    /** Gán giá trị mới cho trường orders. */
    public void setOrders(com.swp391.scms.shop.repository.ProductOrderRepository orders) {
        this.orders = orders;
    }

    /** Gán giá trị mới cho trường walletService. */
    public void setWalletService(com.swp391.scms.wallet.WalletService walletService) {
        this.walletService = walletService;
    }
    /** VNPay có đang bật không. */
    public boolean enabled() { return gateway.enabled(); }
    /** Thời điểm hiện tại theo giờ trung tâm. */
    private LocalDateTime now() { return LocalDateTime.ofInstant(clock.instant(), ZoneId.of("Asia/Ho_Chi_Minh")); }
    /** Chỉ hội viên được dùng; không thì 403. */
    private void requireMember(AuthenticatedPrincipal principal) {
        if (principal==null || !"MEMBER".equals(principal.role())) throw new ForbiddenException("FORBIDDEN","error.forbidden",null,null);
    }
    /** Đối tượng thanh toán phải thuộc chính hội viên. */
    private void requireOwner(AuthenticatedPrincipal principal, Long memberId) {
        requireMember(principal);
        if (!principal.id().equals(memberId)) throw new ForbiddenException("PAYMENT_MEMBER_MISMATCH","finance.payment.member_mismatch",null,null);
    }
    /** Lỗi 409 "đối tượng không còn thanh toán được". */
    private ConflictException unavailable() { return new ConflictException("VNPAY_TARGET_UNAVAILABLE","finance.vnpay.target_unavailable",null,null); }
    /** Khóa dòng hội viên để các thao tác thanh toán song song xếp hàng. */
    private void lockMember(Long id) {
        members.findByUserIdForUpdate(id).orElseThrow(()->new ResourceNotFoundException("resource.member",id));
    }

    /** Nạp ví qua VNPay, dùng link quay về mặc định. */
    public Checkout topupWallet(AuthenticatedPrincipal principal, BigDecimal amount, String ip) {
        return topupWallet(principal, amount, ip, null);
    }

    /**
     * Nạp ví qua VNPay (10.000đ - 100.000.000đ): tạo khoản thu nạp ví đang chờ và lượt VNPay, trả link sang
     * cổng.
     */
    public Checkout topupWallet(AuthenticatedPrincipal principal, BigDecimal amount, String ip, String origin) {
        requireMember(principal);
        gateway.requireEnabled();
        if (amount == null || amount.compareTo(BigDecimal.valueOf(10_000)) < 0 || amount.compareTo(BigDecimal.valueOf(100_000_000)) > 0) {
            throw new BadRequestException("VNPAY_INVALID_AMOUNT", "error.wallet.topup_range", null, "Số tiền nạp vào Ví phải từ 10.000 đ đến 100.000.000 đ.");
        }
        lockMember(principal.id());
        Payment payment = new Payment();
        payment.setMember(members.findById(principal.id()).orElseThrow(this::unavailable));
        payment.setAmount(amount);
        payment.setMethod("online_wallet");
        payment.setNote("WALLET_TOPUP");
        payment.setStatus("pending");
        payment = payments.save(payment);

        String reference = UUID.randomUUID().toString().replace("-", "");
        var created = now();
        var transaction = new VnpayTransaction(reference, payment, payment.getAmount(), created, created.plusMinutes(gateway.timeoutMinutes()), ip);
        Checkout response = checkoutDto(transaction, origin);
        transactions.save(transaction);
        return response;
    }

    /** Khoản thu này có phải nạp ví không (phương thức/ghi chú nạp ví, hoặc không gắn đối tượng nào). */
    private boolean isWalletTopup(Payment p) {
        if (p == null) return false;
        if ("wallet_topup".equalsIgnoreCase(p.getMethod())) return true;
        if (p.getNote() != null && p.getNote().startsWith("WALLET_TOPUP")) return true;
        return p.getSubscriptionId() == null
                && p.getCoachBookingId() == null
                && p.getProductOrderId() == null
                && p.getClassEnrollmentId() == null;
    }

    /**
     * Trả một khoản bằng số dư ví: khoản thu phải đang chờ và không có lượt VNPay còn hiệu lực; trừ ví, ghi
     * khoản thu thành công và cập nhật đối tượng.
     */
    public com.swp391.scms.wallet.WalletDto payWithWallet(AuthenticatedPrincipal principal, CheckoutRequest request) {
        requireMember(principal);
        if (walletService == null) {
            throw new ConflictException("WALLET_UNAVAILABLE", "error.wallet.unavailable", null, "Tính năng Ví điện tử hiện không khả dụng.");
        }
        Payment payment = resolveTargetPayment(principal, request, true);
        if (!"pending".equals(payment.getStatus())) throw unavailable();
        if (payment.getId() != null) {
            var existing = transactions.findFirstByPaymentIdAndStatusOrderByCreatedAtDesc(payment.getId(), "pending");
            if (existing.isPresent()) {
                VnpayTransaction current = existing.get();
                if (!current.getExpiresAt().plus(VnpayPaymentGuard.SETTLEMENT_GRACE).isBefore(now())) {
                    throw new ConflictException("VNPAY_AWAITING_CONFIRMATION", "finance.vnpay.awaiting_confirmation", null, null);
                }
                current.setStatus("failed");
                transactions.save(current);
            }
        }
        payment.setMethod("online_wallet");
        payment = payments.saveAndFlush(payment);

        com.swp391.scms.wallet.WalletDto updatedWallet = walletService.debitForPayment(
                principal.id(),
                payment.getAmount(),
                "WALLET_PAY_" + payment.getId(),
                walletDescription(payment, String.valueOf(payment.getId())),
                targetPath(payment)
        );
        settlement.updatePaymentStatus(payment.getId(), "success");
        markBookingPaid(payment);
        invoices.autoIssueInvoiceForPayment(payment.getId());
        return updatedWallet;
    }

    // Hàm tương thích ngược và điểm vào thanh toán gói hội viên.
    /** Thanh toán gói qua VNPay (cách gọi cũ theo kỳ gói). */
    public Checkout checkout(AuthenticatedPrincipal principal, Long subscriptionId, String ip) {
        return checkout(principal, new CheckoutRequest(subscriptionId, null, null), ip);
    }
    /** Thanh toán qua VNPay với link quay về mặc định. */
    public Checkout checkout(AuthenticatedPrincipal principal, CheckoutRequest request, String ip) {
        return checkout(principal, request, ip, null);
    }

    /**
     * Tạo lượt thanh toán: tìm/tạo khoản thu của đối tượng, nếu lượt cũ còn hiệu lực thì dùng lại, lượt đã hết
     * hạn thì chờ hết thời gian IPN rồi mới tạo lượt mới; trả link sang cổng.
     */
    public Checkout checkout(AuthenticatedPrincipal principal, CheckoutRequest request, String ip, String origin) {
        requireMember(principal); gateway.requireEnabled();
        Payment payment = resolveTargetPayment(principal, request, true);
        if (!"pending".equals(payment.getStatus())) throw unavailable();
        payment=payments.save(payment);
        var existing=transactions.findFirstByPaymentIdAndStatusOrderByCreatedAtDesc(payment.getId(),"pending");
        if(existing.isPresent()) {
            VnpayTransaction current=existing.get();
            if(current.getExpiresAt().isAfter(now())) return checkoutDto(current, origin);
            // Cổng từ chối thanh toán sau khi hết hạn; chờ hết thời gian gia hạn IPN rồi mới tạo lượt mới.
            if(!current.getExpiresAt().plus(VnpayPaymentGuard.SETTLEMENT_GRACE).isBefore(now()))
                throw new ConflictException("VNPAY_AWAITING_CONFIRMATION","finance.vnpay.awaiting_confirmation",null,null);
            current.setStatus("failed");
            transactions.save(current);
        }
        String reference=UUID.randomUUID().toString().replace("-","");
        var created=now();
        var transaction=new VnpayTransaction(reference,payment,payment.getAmount(),created,created.plusMinutes(gateway.timeoutMinutes()),ip);
        Checkout response=checkoutDto(transaction, origin); // kiểm tra hợp lệ trước khi lưu lượt thanh toán
        payment.setMethod("online_wallet");
        transactions.save(transaction);
        return response;
    }

    /**
     * Tìm khoản thu cho đúng một đối tượng (kỳ gói chờ thanh toán, buổi PT chưa trả, khoản thu, đơn hàng
     * của mình); kiểm tra quyền sở hữu trước khi khóa dòng để không dò được đơn của người khác.
     */
    private Payment resolveTargetPayment(AuthenticatedPrincipal principal, CheckoutRequest request, boolean requireKyc) {
        Long[] targets={request.subscriptionId(),request.coachBookingId(),request.paymentId(),request.productOrderId()};
        if (Arrays.stream(targets).filter(Objects::nonNull).count()!=1 || Arrays.stream(targets).filter(Objects::nonNull).anyMatch(id->id<1))
            throw new BadRequestException("VNPAY_TARGET_REQUIRED","finance.vnpay.target_required",null,null);
        Payment payment;
        if (request.paymentId()!=null) {
            payment=payments.findById(request.paymentId()).orElseThrow(()->new ResourceNotFoundException("resource.payment",request.paymentId()));
            requireOwner(principal,payment.getMember().getUserId()); lockMember(principal.id()); lockTargets(payment); entities.refresh(payment);
            if (payment.getSubscriptionId()!=null) {
                var sub=subscriptions.findById(payment.getSubscriptionId()).orElseThrow(this::unavailable);
                entities.refresh(sub); if (!"pending_payment".equals(sub.getStatus())) throw unavailable();
                if (requireKyc) {
                    settlement.requireSubscriptionPaymentKyc(sub);
                }
            }
            validateBooking(payment);
        } else if(request.subscriptionId()!=null) {
            var sub=subscriptions.findById(request.subscriptionId()).orElseThrow(()->new ResourceNotFoundException("resource.subscription",request.subscriptionId()));
            requireOwner(principal,sub.getMember().getUserId()); lockMember(principal.id()); entities.refresh(sub);
            if (!"pending_payment".equals(sub.getStatus())) throw unavailable();
            if (requireKyc) {
                settlement.requireSubscriptionPaymentKyc(sub);
            }
            payment=findOrCreate(payments.findAllBySubscriptionId(sub.getId()),principal.id(),sub.payableAmount());
            payment.setSubscriptionId(sub.getId());
        } else if(request.coachBookingId()!=null) {
            var booking=coaches.findById(request.coachBookingId()).orElseThrow(this::unavailable);
            requireOwner(principal,booking.getMember().getUserId()); lockMember(principal.id());
            coaches.findByIdForUpdate(booking.getId()).orElseThrow(this::unavailable); entities.refresh(booking);
            if (!Set.of("confirmed","completed").contains(booking.getStatus()) || !"pending".equals(booking.getPaymentStatus())) throw unavailable();
            payment=findOrCreate(payments.findAllByCoachBookingId(booking.getId()),principal.id(),booking.getHourlyRate());
            payment.setCoachBookingId(booking.getId());
        } else {
            if (orderPayments == null) throw unavailable();
            // Xác minh quyền sở hữu trước khi khóa dòng để hội viên không thể khóa hay dò đơn hàng của người khác.
            if (orders != null) {
                var owned = orders.findById(request.productOrderId()).orElseThrow(this::unavailable);
                // Trả cùng phản hồi như khi không tìm thấy đơn: không được để phân biệt được đơn của hội viên khác.
                if (owned.getMember() == null || !principal.id().equals(owned.getMember().getUserId())) throw unavailable();
            }
            lockMember(principal.id());
            var order = orderPayments.requirePayable(request.productOrderId());
            requireOwner(principal, order.getMember().getUserId());
            payment = findOrCreate(payments.findAllByProductOrderId(order.getId()), principal.id(), order.getTotal());
            payment.setProductOrderId(order.getId());
        }
        return payment;
    }

    /** Dùng lại khoản thu đang chờ đúng số tiền hoặc tạo khoản mới. */
    private Payment findOrCreate(List<Payment> existing,Long memberId,BigDecimal amount) {
        if(existing!=null && !existing.isEmpty()) {
            if(existing.stream().anyMatch(p -> !"pending".equals(p.getStatus()))) throw unavailable();
            List<Payment> reusable = existing.stream()
                    .filter(p -> p.getReceiptImage() == null || p.getReceiptImage().isBlank())
                    .toList();
            if(reusable.size() > 1) throw unavailable();
            if(reusable.size() == 1) {
                Payment p=reusable.getFirst(); entities.refresh(p); if(!"pending".equals(p.getStatus())) throw unavailable();
                if(p.getReceiptImage() == null || p.getReceiptImage().isBlank()) return p;
            }
        }
        Payment p=new Payment();p.setMember(members.findById(memberId).orElseThrow(this::unavailable));
        p.setAmount(amount);p.setMethod("online_wallet");p.setStatus("pending");return p;
    }
    /** Tạo kết quả trả về kèm link cổng. */
    private Checkout checkoutDto(VnpayTransaction t, String origin) {
        return new Checkout(t.getReference(),gateway.paymentUrl(t.getReference(),t.getAmount(),t.getCreatedAt(),t.getExpiresAt(),t.getIpAddress(), origin),t.getAmount(),t.getExpiresAt());
    }
    /** Trạng thái một lượt thanh toán của chính hội viên kèm trang cần quay về. */
    @Transactional(readOnly=true)
    public Status status(AuthenticatedPrincipal principal,String reference) {
        String normalizedRef = reference == null ? "" : reference.trim();
        if (normalizedRef.isEmpty()) {
            throw new ResourceNotFoundException("resource.payment", reference);
        }
        var t=transactions.findById(normalizedRef).orElseThrow(()->new ResourceNotFoundException("resource.payment",normalizedRef));
        Payment p=t.getPayment();requireOwner(principal,p.getMember().getUserId());
        String status="refunded".equals(p.getStatus())?"refunded":t.getStatus();
        return new Status(normalizedRef,p.getId(),p.getSubscriptionId(),t.getAmount(),status,t.getExpiresAt(),targetPath(p));
    }

    /**
     * Giải phóng lượt thanh toán VNPay chưa quyết toán khi hội viên sở hữu thoát khỏi cổng mà chưa thanh toán.
     * Nếu một IPN thành công đến muộn sau đó, {@link #ipn} vẫn quyết toán hoặc hoàn tiền về ví của hội viên.
     */
    public Status cancel(AuthenticatedPrincipal principal, String reference) {
        String normalizedRef = reference == null ? "" : reference.trim();
        if (normalizedRef.isEmpty()) {
            throw new ResourceNotFoundException("resource.payment", reference);
        }
        var t = transactions.findById(normalizedRef)
                .orElseThrow(() -> new ResourceNotFoundException("resource.payment", normalizedRef));
        Payment p = t.getPayment();
        requireOwner(principal, p.getMember().getUserId());
        lockMember(principal.id());
        lockTargets(p);
        entities.refresh(t);
        entities.refresh(p);
        if ("pending".equals(t.getStatus()) && t.getGatewayTransactionNo() == null) {
            closePendingAttempt(t, p);
        }
        String status = "refunded".equals(p.getStatus()) ? "refunded" : t.getStatus();
        return new Status(normalizedRef, p.getId(), p.getSubscriptionId(), t.getAmount(), status, t.getExpiresAt(), targetPath(p));
    }

    /**
     * Giải phóng mọi lượt VNPay đang chờ chưa quyết toán trên khoản thanh toán/lịch đặt thuộc hội viên.
     */
    public void cancelTarget(AuthenticatedPrincipal principal, CheckoutRequest request) {
        requireMember(principal);
        Payment payment = resolveTargetPayment(principal, request, false);
        if (payment.getId() == null) return;
        var attempts = transactions.findAllByPaymentId(payment.getId());
        boolean closedAny = false;
        if (attempts != null) {
            for (VnpayTransaction attempt : attempts) {
                entities.refresh(attempt);
                if ("pending".equals(attempt.getStatus()) && attempt.getGatewayTransactionNo() == null) {
                    attempt.setStatus("failed");
                    transactions.saveAndFlush(attempt);
                    closedAny = true;
                }
            }
        }
        if (closedAny) {
            closeOrphanWalletTopup(payment);
        }
    }

    /** Đóng một lượt đang chờ. */
    private void closePendingAttempt(VnpayTransaction t, Payment p) {
        t.setStatus("failed");
        transactions.saveAndFlush(t);
        closeOrphanWalletTopup(p);
    }

    /** Khoản nạp ví đang chờ không còn lượt nào thì chuyển failed. */
    private void closeOrphanWalletTopup(Payment p) {
        if (isWalletTopup(p) && "pending".equals(p.getStatus())
                && (p.getId() == null || (!transactions.existsByPaymentIdAndStatus(p.getId(), "pending")
                    && !transactions.existsByPaymentIdAndStatus(p.getId(), "success")))) {
            p.setStatus("failed");
            payments.save(p);
        }
    }
    /**
     * Xử lý IPN: kiểm tra chữ ký, mã tham chiếu, số tiền; xử lý trường hợp IPN muộn sau khi lượt đã đóng, đơn
     * đã hủy hoặc khoản thu đã trả cách khác (hoàn vào ví); thành công thì ghi nhận thanh toán, cộng/trừ ví,
     * cập nhật đối tượng và gửi thông báo; trạng thái tạm thì giữ chờ (99); thất bại rõ ràng thì đóng lượt. Trả
     * mã cho VNPay (00 là đã xử lý).
     */
    public String ipn(Map<String,String> fields) {
        if(!gateway.validSignature(fields)) return "97";
        String reference=fields.get("vnp_TxnRef");
        if(reference==null || !reference.matches("[A-Za-z0-9]{1,32}")) return "01";
        var optional=transactions.findById(reference); if(optional.isEmpty()) return "01";
        var t=optional.get();Payment p=t.getPayment();
        lockMember(p.getMember().getUserId());lockTargets(p);entities.refresh(t);entities.refresh(p);
        String amount=fields.get("vnp_Amount");
        if(amount==null || !amount.matches("[0-9]{1,12}") || t.getAmount().multiply(BigDecimal.valueOf(100)).compareTo(new BigDecimal(amount))!=0) return "04";
        // Một lượt bị đóng cục bộ sau khi hết hạn trên cổng vẫn có thể báo thành công muộn: ghi nhận nó khi
        // khoản thu chưa quyết toán để tiền của khách không bao giờ bị trừ mà đơn không được thanh toán.
        boolean lateAfterLocalExpiry="failed".equals(t.getStatus()) && t.getGatewayTransactionNo()==null
                && "pending".equals(p.getStatus());
        String lateOrderCode=refundLateOrderPayment(fields,t,p,reference);
        if(lateOrderCode!=null) return lateOrderCode;
        String settledElsewhereCode=refundPaymentSettledElsewhere(fields,t,p,reference);
        if(settledElsewhereCode!=null) return settledElsewhereCode;
        if((!"pending".equals(t.getStatus()) && !lateAfterLocalExpiry) || !"pending".equals(p.getStatus())) return "02";
        String response=fields.get("vnp_ResponseCode"),status=fields.getOrDefault("vnp_TransactionStatus", response);
        if(response==null || status==null || !response.matches("[0-9]{2}") || !status.matches("[0-9]{2}")) return "97";
        if("00".equals(response) && "00".equals(status)) {
            String gatewayId=fields.get("vnp_TransactionNo");
            if(gatewayId==null || !gatewayId.matches("[0-9]{1,15}") || gatewayId.matches("0+")) return "97";
            if (p.getSubscriptionId() != null) {
                var sub = subscriptions.findById(p.getSubscriptionId()).orElseThrow(this::unavailable);
                entities.refresh(sub);
                try {
                    settlement.requireSubscriptionPaymentKyc(sub);
                } catch (BadRequestException ex) {
                    if (!Set.of("MEMBERSHIP_KYC_REQUIRED", "MEMBERSHIP_KYC_PENDING").contains(ex.getErrorCode())) throw ex;
                    // KYC thay đổi sau checkout: giữ khoản thu chờ, hoàn số tiền cổng đã trừ vào ví đúng một lần.
                    if (walletService == null) return "99";
                    t.setGatewayTransactionNo(gatewayId); t.setStatus("success");
                    transactions.saveAndFlush(t);
                    walletService.creditLateGatewayPayment(p.getMember().getUserId(), t.getAmount(), reference);
                    return "00";
                }
            }
            validateBooking(p);
            t.setGatewayTransactionNo(gatewayId);t.setStatus("success");
            transactions.saveAndFlush(t); // bộ chặn nhìn thấy giao dịch đã kết thúc trong cùng phép quyết toán nguyên tử
            settlement.updatePaymentStatus(p.getId(),"success");
            markBookingPaid(p);
            try {
                invoices.autoIssueInvoiceForPayment(p.getId());
            } catch (RuntimeException ignored) {
            }
            if (walletService != null) {
                boolean isDirectTopup = isWalletTopup(p);

                if (isDirectTopup) {
                    walletService.creditTopup(p.getMember().getUserId(), t.getAmount(), reference);
                } else {
                    walletService.recordVnpayTopupAndDebit(p.getMember().getUserId(), t.getAmount(), reference,
                            walletDescription(p, reference));
                }
            }
            if (notifications != null && messages != null) {
                try {
                    notifications.send(p.getMember().getUserId(), messages.getMessage("notifications.payment.vnpay_success.title"),
                            messages.getMessage("notifications.payment.vnpay_success.body", t.getAmount().toPlainString(), reference),
                            "payment", "payment", p.getId());
                } catch (RuntimeException ignored) {
                }
            }
        } else {
            if (lateAfterLocalExpiry) return "02"; // đã đóng ở trạng thái failed
            // Trạng thái cổng tạm thời/đang xử lý (05, 06, hoặc mã phản hồi 00 kèm trạng thái 01 chưa hoàn tất) giữ nguyên pending;
            // các phản hồi thất bại/hủy khác 00 rõ ràng (ví dụ 24 + 01 khi hủy trên VNPay Sandbox) đóng ngay lập tức.
            if (Set.of("05", "06").contains(status) || ("00".equals(response) && "01".equals(status))) return "99";
            closePendingAttempt(t, p);
        }
        return "00";
    }
    /**
     * Đơn hàng bị hủy khi lượt VNPay chưa quyết toán sẽ đóng khoản thanh toán thành {@code failed}. Nếu cổng vẫn báo
     * thành công cho lượt đó thì hội viên đã bị trừ tiền: cộng tiền vào ví và ghi nhận khoản thanh toán là đã hoàn.
     * Trả về mã IPN để phản hồi, hoặc {@code null} nếu không phải trường hợp này.
     */
    private String refundLateOrderPayment(Map<String,String> fields, VnpayTransaction t, Payment p, String reference) {
        if(p.getProductOrderId()==null || orders==null || orderRefunds==null) return null;
        if(!"failed".equals(p.getStatus()) || t.getGatewayTransactionNo()!=null
                || !Set.of("pending","failed").contains(t.getStatus())) return null;
        var order=orders.findById(p.getProductOrderId()).orElse(null);
        if(order==null || !"cancelled".equals(order.getStatus())) return null;
        String response=fields.get("vnp_ResponseCode"),status=fields.get("vnp_TransactionStatus");
        if(response==null || status==null || !response.matches("[0-9]{2}") || !status.matches("[0-9]{2}")) return "97";
        if(!"00".equals(response) || !"00".equals(status)) return "02"; // không bị trừ tiền, lượt giữ nguyên trạng thái đã đóng
        String gatewayId=fields.get("vnp_TransactionNo");
        if(gatewayId==null || !gatewayId.matches("[0-9]{1,15}") || gatewayId.matches("0+")) return "97";
        t.setGatewayTransactionNo(gatewayId);t.setStatus("success");
        transactions.saveAndFlush(t);
        orderRefunds.refundLatePayment(order,p,t.getAmount(),reference);
        notifications.send(p.getMember().getUserId(),
                messages.getMessage("notifications.shop.cancelled.title", order.getCode()),
                messages.getMessage("notifications.shop.refunded.body", order.getCode(), t.getAmount().toPlainString()),
                "order","product_order",order.getId(),"/member/orders/"+order.getId());
        return "00";
    }
    /**
     * Cổng xác nhận trừ tiền cho lượt mà khoản thu không còn pending: khoản thu đã được quyết toán theo cách khác
     * (tiền mặt, ví, lượt VNPay mới hơn) hoặc đã đóng (hủy lịch đặt) sau khi lượt này hết hạn cục bộ. Hội viên đã bị
     * trừ tiền hai lần nên số tiền được cộng vào ví và lượt được ghi nhận đã quyết toán.
     * Trả về mã IPN để phản hồi, hoặc {@code null} nếu không phải trường hợp này.
     */
    private String refundPaymentSettledElsewhere(Map<String,String> fields, VnpayTransaction t, Payment p, String reference) {
        if("pending".equals(p.getStatus()) || t.getGatewayTransactionNo()!=null
                || !Set.of("pending","failed").contains(t.getStatus())) return null;
        String response=fields.get("vnp_ResponseCode"),status=fields.getOrDefault("vnp_TransactionStatus", response);
        if(!"00".equals(response) || !"00".equals(status)) return null; // không bị trừ tiền: phản hồi như đã xử lý
        String gatewayId=fields.get("vnp_TransactionNo");
        if(gatewayId==null || !gatewayId.matches("[0-9]{1,15}") || gatewayId.matches("0+")) return "97";
        if(walletService==null) {
            LATE_LOG.error("VNPay charged attempt {} for payment {} already {}, but no wallet is available to refund it",
                    reference, p.getId(), p.getStatus());
            return "99";
        }
        t.setGatewayTransactionNo(gatewayId);t.setStatus("success");
        transactions.saveAndFlush(t);
        walletService.creditLateGatewayPayment(p.getMember().getUserId(), t.getAmount(), reference);
        LATE_LOG.warn("VNPay confirmed attempt {} after payment {} was already {}; credited {} to the member wallet",
                reference, p.getId(), p.getStatus(), t.getAmount().toPlainString());
        return "00";
    }
    private static final org.slf4j.Logger LATE_LOG = org.slf4j.LoggerFactory.getLogger(VnpayPaymentService.class);
    /**
     * Trang hội viên quay về sau khi thanh toán, gom về một chỗ để ví, VNPay và trạng thái luôn thống nhất.
     */
    private static String targetPath(Payment p) {
        if (p.getProductOrderId() != null) return "/member/orders/" + p.getProductOrderId();
        if (p.getCoachBookingId() != null) return "/member/classes?tab=pt";
        if (p.getClassEnrollmentId() != null) return "/member/classes";
        if (p.getSubscriptionId() != null) return "/member/packages";
        return "/member/invoices";
    }

    /**
     * Dòng mô tả trong lịch sử ví cho khoản thanh toán, giống nhau bất kể trả từ ví hay qua VNPay.
     */
    private String walletDescription(Payment p, String ref) {
        if (p.getProductOrderId() != null) return orderWalletDescription(p);
        if (p.getSubscriptionId() != null) return "Thanh toán gói tập hội viên (#" + ref + ")";
        if (p.getCoachBookingId() != null) return "Thanh toán lịch PT 1:1 (#" + ref + ")";
        if (p.getClassEnrollmentId() != null) return "Thanh toán học phí khóa học (#" + ref + ")";
        return "Thanh toán dịch vụ (#" + ref + ")";
    }

    /** Dòng mô tả trong lịch sử ví cho đơn hàng. */
    private String orderWalletDescription(Payment p) {
        String code = "#" + p.getProductOrderId();
        if (orders != null && p.getProductOrderId() != null) {
            code = orders.findById(p.getProductOrderId())
                    .map(com.swp391.scms.shop.entity.ProductOrder::getCode)
                    .filter(c -> c != null && !c.isBlank())
                    .orElse(code);
        }
        if (messages != null) {
            String msg = messages.getMessage("wallet.description.product_order", code);
            if (msg != null && !msg.isBlank()) return msg;
        }
        return "Thanh toán đơn hàng " + code;
    }
    /** Khóa dòng đối tượng (buổi PT, đơn hàng) trước khi ghi nhận thanh toán. */
    private void lockTargets(Payment p) {
        if(p.getCoachBookingId()!=null) coaches.findByIdForUpdate(p.getCoachBookingId()).orElseThrow(this::unavailable);
        if(p.getProductOrderId()!=null && orders!=null) orders.findByIdForUpdate(p.getProductOrderId()).orElseThrow(this::unavailable);
    }
    /** Kiểm tra buổi PT/đơn hàng vẫn còn hợp lệ để ghi nhận thanh toán. */
    private void validateBooking(Payment p) {
        if(p.getCoachBookingId()!=null) {
            var b=coaches.findById(p.getCoachBookingId()).orElseThrow(this::unavailable);entities.refresh(b);
            if(!Set.of("confirmed","completed").contains(b.getStatus()) || !"pending".equals(b.getPaymentStatus())) throw unavailable();
        }
        if(p.getProductOrderId()!=null && orderPayments!=null) {
            orderPayments.requirePayable(p.getProductOrderId());
        }
    }
    /** Đánh dấu buổi PT/đơn hàng đã thanh toán và gửi thông báo cho hội viên. */
    private void markBookingPaid(Payment p) {
        if(p.getCoachBookingId()!=null) {
            var b=coaches.findById(p.getCoachBookingId()).orElseThrow(this::unavailable);
            b.setPaymentStatus("paid");
            b.setPaymentMethod("online_wallet");
            if (notifications != null && messages != null && b.getMember() != null && b.getMember().getUserId() != null
                    && b.getBookingDate() != null && b.getStartTime() != null && b.getEndTime() != null) {
                try {
                    String coachName = b.getCoach() != null && b.getCoach().getUser() != null
                            ? b.getCoach().getUser().getFullName() : "Huấn luyện viên";
                    String startStr = b.getStartTime().toString().substring(0, 5);
                    String endStr = b.getEndTime().toString().substring(0, 5);
                    BigDecimal amount = p.getAmount() != null ? p.getAmount()
                            : (b.getHourlyRate() != null ? b.getHourlyRate() : BigDecimal.valueOf(200_000));
                    notifications.send(
                            b.getMember().getUserId(),
                            messages.getMessage("notifications.coaching.booking.payment_confirmed.title"),
                            messages.getMessage("notifications.coaching.booking.payment_confirmed.body",
                                    coachName, b.getBookingDate(), startStr, endStr, amount.stripTrailingZeros().toPlainString()),
                            "payment",
                            "payment",
                            p.getId() != null ? p.getId() : b.getId(),
                            "/member/classes?tab=pt"
                    );
                } catch (RuntimeException ignored) {
                }
            }
        }
        if(p.getProductOrderId()!=null && orderPayments!=null) { orderPayments.markPaid(p.getProductOrderId(), "online_wallet"); }
    }
}
