package com.swp391.scms.wallet;

import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.InvoiceService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/**
 * Records a front-desk wallet top-up as a settled payment, so it shows up in the member's "Giao dịch & hóa đơn" like a
 * của VNPay và cho phép quầy xem lại các khoản nạp mà quầy đã thu.
 */
@Service
public class CounterTopupService {
    public static final String NOTE_PREFIX = "WALLET_TOPUP";
    public static final String COUNTER_NOTE = NOTE_PREFIX + ":COUNTER";
    public static final int ALL_TIME_DAYS = 0;
    public static final int TODAY_DAYS = 1;
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> COUNTER_METHODS = List.of("cash", "bank_transfer");

    /**
     * Một lần nạp Ví tại quầy trong lịch sử: khoản thanh toán, hội viên (id, mã, tên), số tiền, phương thức,
     * thời điểm và người nhận tiền.
     */
    public record TopupHistoryDto(
            Long paymentId,
            Long memberId,
            String membershipCode,
            String memberName,
            BigDecimal amount,
            String paymentMethod,
            LocalDateTime paidAt,
            String receivedByName) {}

    private final PaymentRepository payments;
    private final MemberRepository members;
    private final UserRepository users;
    private final InvoiceService invoices;
    private final Clock clock;
    private TransactionTemplate invoiceTransaction;

    /** Nhận repository thanh toán/hội viên/người dùng, dịch vụ hóa đơn và Clock. */
    public CounterTopupService(PaymentRepository payments, MemberRepository members, UserRepository users,
                               InvoiceService invoices, Clock clock) {
        this.payments = payments;
        this.members = members;
        this.users = users;
        this.invoices = invoices;
        this.clock = clock;
    }

    /**
     * Spring tiêm trình quản lý transaction: hóa đơn được tạo trong transaction riêng (REQUIRES_NEW) để lỗi hóa
     * đơn không thể hoàn tác lần nạp tiền.
     *
     * Hóa đơn có transaction riêng để lỗi ở đó không bao giờ làm rollback khoản nạp ví.
     */
    @Autowired(required = false)
    void setTransactionManager(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.invoiceTransaction = template;
    }

    /**
     * Đổi mã phương thức của quầy sang cash hoặc bank_transfer; POS bị từ chối, giá trị lạ khác
     * coi là tiền mặt.
     *
     * Giữ tương thích mặc định tiền mặt cho caller cũ; tuyệt đối không đổi POS thành tiền mặt.
     */
    static String normalizeMethod(String method) {
        String value = method == null ? "cash" : method.trim().toLowerCase(Locale.ROOT);
        if ("pos".equals(value)) {
            throw new com.swp391.scms.common.exception.BadRequestException(
                    "PAYMENT_POS_DISABLED", "finance.payment.pos_disabled", null, null);
        }
        return COUNTER_METHODS.contains(value) ? value : "cash";
    }

    /**
     * Ghi lần nạp Ví tại quầy thành một khoản thanh toán thành công (ghi chú WALLET_TOPUP:COUNTER, người nhận
     * tiền) để hiện trong "Giao dịch & hóa đơn" của hội viên; hóa đơn được xuất sau khi transaction nạp tiền đã
     * commit.
     */
    @Transactional
    public void record(Long memberId, BigDecimal amount, String paymentMethod, Long staffUserId) {
        // Kiểm tra trước khi ghi khoản thu; lịch sử POS cũ vẫn được đọc nguyên trạng.
        String method = normalizeMethod(paymentMethod);
        Member member = members.findById(memberId).orElse(null);
        if (member == null) return;
        Payment payment = new Payment();
        payment.setMember(member);
        payment.setAmount(amount);
        payment.setMethod(method);
        payment.setStatus("success");
        payment.setNote(COUNTER_NOTE);
        payment.setPaidAt(LocalDateTime.now(clock));
        if (staffUserId != null) {
            users.findByIdAndDeletedAtIsNull(staffUserId).ifPresent(payment::setReceivedBy);
        }
        Long paymentId = payments.save(payment).getId();
        // Chỉ phát hành hóa đơn sau khi khoản nạp đã commit: lỗi hóa đơn khi đó không thể đánh dấu transaction
        // của khoản nạp là rollback-only và hoàn tác số tiền hội viên đã đưa.
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                /** Được Spring gọi khi transaction nạp tiền commit thành công: xuất hóa đơn. */
                @Override
                public void afterCommit() {
                    issueInvoice(paymentId);
                }
            });
        } else {
            issueInvoice(paymentId);
        }
    }

    /** Xuất hóa đơn cho khoản thanh toán (trong transaction riêng nếu có); lỗi thì bỏ qua vì tiền đã nạp xong. */
    private void issueInvoice(Long paymentId) {
        try {
            if (invoiceTransaction != null) {
                invoiceTransaction.executeWithoutResult(status -> invoices.autoIssueInvoiceForPayment(paymentId));
            } else {
                invoices.autoIssueInvoiceForPayment(paymentId);
            }
        } catch (RuntimeException ignored) {
            // Hóa đơn là cố gắng tối đa (best effort); khoản nạp đã được commit rồi.
        }
    }

    /**
     * Lịch sử nạp Ví tại quầy trong số ngày gần đây (mặc định 30, tối đa 180), bỏ hội viên đã bị xóa, mới nhất
     * trước.
     */
    @Transactional(readOnly = true)
    public List<TopupHistoryDto> history(Integer days) {
        boolean allTime = days != null && days == ALL_TIME_DAYS;
        boolean todayOnly = days != null && days == TODAY_DAYS;
        int window = days == null ? DEFAULT_DAYS : Math.max(TODAY_DAYS, Math.min(MAX_DAYS, days));
        // ALL_TIME_DAYS (0) không cắt lịch sử; giữ mọi phương thức thu cũ để đối soát.
        LocalDateTime since = todayOnly ? LocalDate.now(clock).atStartOfDay() : LocalDateTime.now(clock).minusDays(window);
        List<Payment> topups = allTime
                ? payments.findByNoteAndStatusOrderByPaidAtDesc(COUNTER_NOTE, "success")
                : payments.findByNoteAndStatusAndPaidAtGreaterThanEqualOrderByPaidAtDesc(COUNTER_NOTE, "success", since);
        return topups
                .stream()
                .filter(p -> p.getMember() != null && p.getMember().getUser() != null
                        && p.getMember().getUser().getDeletedAt() == null)
                .map(p -> new TopupHistoryDto(
                        p.getId(),
                        p.getMember().getUserId(),
                        p.getMember().getMembershipCode(),
                        p.getMember().getUser().getFullName(),
                        p.getAmount(),
                        p.getMethod(),
                        p.getPaidAt(),
                        p.getReceivedBy() == null ? null : p.getReceivedBy().getFullName()))
                .toList();
    }
}
