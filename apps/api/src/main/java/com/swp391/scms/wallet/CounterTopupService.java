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
    public static final int DEFAULT_DAYS = 30;
    public static final int MAX_DAYS = 180;
    private static final List<String> COUNTER_METHODS = List.of("cash", "pos", "bank_transfer");

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
     * Đổi mã phương thức của quầy sang giá trị bảng thanh toán cho phép (cash, pos, bank_transfer); giá trị lạ
     * coi là tiền mặt.
     *
     * Ánh xạ mã phương thức của quầy sang các phương thức thanh toán mà bảng cho phép; cái nào lạ thì là tiền
     * mặt.
     */
    static String normalizeMethod(String method) {
        String value = method == null ? "cash" : method.trim().toLowerCase(Locale.ROOT);
        return COUNTER_METHODS.contains(value) ? value : "cash";
    }

    /**
     * Ghi lần nạp Ví tại quầy thành một khoản thanh toán thành công (ghi chú WALLET_TOPUP:COUNTER, người nhận
     * tiền) để hiện trong "Giao dịch & hóa đơn" của hội viên; hóa đơn được xuất sau khi transaction nạp tiền đã
     * commit.
     */
    @Transactional
    public void record(Long memberId, BigDecimal amount, String paymentMethod, Long staffUserId) {
        Member member = members.findById(memberId).orElse(null);
        if (member == null) return;
        Payment payment = new Payment();
        payment.setMember(member);
        payment.setAmount(amount);
        payment.setMethod(normalizeMethod(paymentMethod));
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
        int window = days == null ? DEFAULT_DAYS : Math.max(1, Math.min(MAX_DAYS, days));
        LocalDateTime since = LocalDateTime.now(clock).minusDays(window);
        return payments.findByNoteAndStatusAndPaidAtGreaterThanEqualOrderByPaidAtDesc(COUNTER_NOTE, "success", since)
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
