package com.swp391.scms.wallet;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service WalletService (wallet service). */
@ExtendWith(MockitoExtension.class)
class WalletServiceTest {

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private WalletTransactionRepository walletTransactionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private MessageService messageService;

    private WalletService walletService;
    private Wallet wallet;

    /** Chuẩn bị trước mỗi test: tạo WalletService với repository giả lập. */
    @BeforeEach
    void setUp() {
        walletService = new WalletService(
                walletRepository,
                walletTransactionRepository,
                userRepository,
                notificationService,
                messageService
        );
        User user = new User();
        user.setId(7L);
        wallet = new Wallet();
        wallet.setId(100L);
        wallet.setUser(user);
        wallet.setBalance(new BigDecimal("500000"));
        lenient().when(walletRepository.findByUserIdForUpdate(7L)).thenReturn(Optional.of(wallet));
        lenient().when(walletTransactionRepository.findTop50ByWallet_IdOrderByCreatedAtDescIdDesc(100L)).thenReturn(List.of());
    }

    /** Kiểm thử: nạp ví tại quầy từ chối mọi phương thức khác tiền mặt (kể cả chuỗi rỗng) trước khi ghi. */
    @ParameterizedTest
    @ValueSource(strings = {"pos", "bank_transfer", "online_wallet", "unknown", "", "   "})
    void counterTopupRejectsNonCashBeforeWriting(String method) {
        assertThatThrownBy(() -> walletService.creditByReceptionist(7L, new BigDecimal("10000"), method, null, 99L))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "COUNTER_TOPUP_CASH_ONLY");
        verify(walletRepository, never()).saveAndFlush(any());
        verify(walletTransactionRepository, never()).save(any());
    }

    /** Kiểm thử: bỏ trống paymentMethod (null) khi nạp ví tại quầy mặc định là tiền mặt theo OpenAPI. */
    @Test
    void counterTopupDefaultsOmittedMethodToCash() {
        walletService.creditByReceptionist(7L, new BigDecimal("50000"), null, "Thu tiền mặt", 99L, "REQ-NULL-CASH");
        assertThat(wallet.getBalance()).isEqualByComparingTo("550000");
        ArgumentCaptor<WalletTransaction> txCaptor = ArgumentCaptor.forClass(WalletTransaction.class);
        verify(walletTransactionRepository).save(txCaptor.capture());
        assertThat(txCaptor.getValue().getDescription()).contains("Tiền mặt tại quầy Lễ tân");
    }

    /** Kiểm thử: nạp ví idempotent theo mã tham chiếu. */

    @Test
    void creditTopup_isIdempotentOnReference() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "REF123:TOPUP"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.creditTopup(7L, new BigDecimal("200000"), "REF123");
        walletService.creditTopup(7L, new BigDecimal("200000"), "REF123");

        assertThat(wallet.getBalance()).isEqualByComparingTo("700000");
        verify(walletTransactionRepository, times(1)).save(any(WalletTransaction.class));
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/invoices"));
    }

    /** Kiểm thử: ghi nạp VNPay và trừ tiền ghi cả hai giao dịch idempotent và giữ nguyên số dư. */
    @Test
    void recordVnpayTopupAndDebit_recordsBothTransactionsIdempotentlyAndPreservesBalance() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "REF999:TOPUP"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.recordVnpayTopupAndDebit(7L, new BigDecimal("650000"), "REF999", "Thanh toán gói tập");
        walletService.recordVnpayTopupAndDebit(7L, new BigDecimal("650000"), "REF999", "Thanh toán gói tập");

        assertThat(wallet.getBalance()).isEqualByComparingTo("500000");
        verify(walletTransactionRepository, times(2)).save(any(WalletTransaction.class));
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/invoices"));
    }

    /** Kiểm thử: trừ tiền thanh toán chỉ trừ một lần và idempotent khi trùng mã tham chiếu. */
    @Test
    void debitForPayment_deductsOnceAndRemainsIdempotentOnDuplicateReferenceId() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "WALLET_PAY_55"))
                .thenReturn(false)
                .thenReturn(true);

        WalletDto first = walletService.debitForPayment(7L, new BigDecimal("300000"), "WALLET_PAY_55", "Thanh toán gói tập", "/member/packages");
        WalletDto second = walletService.debitForPayment(7L, new BigDecimal("300000"), "WALLET_PAY_55", "Thanh toán gói tập", "/member/packages");

        assertThat(first.balance()).isEqualByComparingTo("200000");
        assertThat(second.balance()).isEqualByComparingTo("200000");
        verify(walletTransactionRepository, times(1)).save(any(WalletTransaction.class));
        verify(walletRepository, times(1)).saveAndFlush(wallet);
    }

    /** Kiểm thử: từ chối trừ tiền khi số dư không đủ. */
    @Test
    void debitForPayment_rejectsInsufficientBalance() {
        assertThatThrownBy(() -> walletService.debitForPayment(7L, new BigDecimal("600000"), "WALLET_PAY_56", "Thanh toán", "/member/packages"))
                .isInstanceOf(BadRequestException.class)
                .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("INSUFFICIENT_WALLET_BALANCE"));
        assertThat(wallet.getBalance()).isEqualByComparingTo("500000");
        verify(walletTransactionRepository, never()).save(any());
    }

    /** Kiểm thử: hoàn tiền cộng số dương idempotent và bỏ qua số tiền 0. */
    @Test
    void creditRefund_creditsPositiveRefundIdempotentlyAndSkipsZeroAmount() {
        walletService.creditRefund(7L, BigDecimal.ZERO, "CANCEL_REQ_0", "Moving");
        verifyNoInteractions(walletTransactionRepository, notificationService);

        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "CANCEL_REQ_7"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.creditRefund(7L, new BigDecimal("110000"), "CANCEL_REQ_7", "Moving");
        walletService.creditRefund(7L, new BigDecimal("110000"), "CANCEL_REQ_7", "Moving");

        assertThat(wallet.getBalance()).isEqualByComparingTo("610000");
        verify(walletTransactionRepository, times(1)).save(any(WalletTransaction.class));
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/packages"));
    }

    /** Kiểm thử: lễ tân nạp ví cho hội viên và ghi giao dịch quầy. */
    @Test
    void creditByReceptionist_creditsMemberWalletAndRecordsCounterTransaction() {
        WalletDto dto = walletService.creditByReceptionist(
                7L,
                new BigDecimal("300000"),
                "cash",
                "Thu tiền mặt tại quầy",
                99L
        );

        assertThat(dto.balance()).isEqualByComparingTo("800000");
        assertThat(wallet.getBalance()).isEqualByComparingTo("800000");
        verify(walletTransactionRepository, times(1)).save(argThat(tx ->
                "TOPUP_COUNTER".equals(tx.getType())
                        && tx.getAmount().compareTo(new BigDecimal("300000")) == 0
                        && tx.getBalanceAfter().compareTo(new BigDecimal("800000")) == 0
                        && "COUNTER_TOPUP".equals(tx.getReferenceType())
                        && tx.getDescription().contains("Tiền mặt tại quầy Lễ tân")
        ));
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/invoices"));
    }

    /** Kiểm thử: gửi lại cùng request id của lễ tân chỉ nạp một lần. */
    @Test
    void creditByReceptionist_resendWithSameRequestIdCreditsOnce() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "POS-REQ-desk-req-0001"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.creditByReceptionist(7L, new BigDecimal("300000"), "cash", null, 99L, "desk-req-0001");
        WalletDto replay = walletService.creditByReceptionist(7L, new BigDecimal("300000"), "cash", null, 99L, "desk-req-0001");

        assertThat(replay.balance()).isEqualByComparingTo("800000");
        assertThat(wallet.getBalance()).isEqualByComparingTo("800000");
        verify(walletTransactionRepository, times(1)).save(argThat(tx ->
                "TOPUP_COUNTER".equals(tx.getType()) && "POS-REQ-desk-req-0001".equals(tx.getReferenceId())));
    }

    /** Kiểm thử: thanh toán cổng đến muộn chỉ cộng ví một lần theo mã tham chiếu. */
    @Test
    void creditLateGatewayPayment_creditsWalletOncePerReference() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "REF9:LATE_REFUND"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.creditLateGatewayPayment(7L, new BigDecimal("150000"), "REF9");
        walletService.creditLateGatewayPayment(7L, new BigDecimal("150000"), "REF9");

        assertThat(wallet.getBalance()).isEqualByComparingTo("650000");
        verify(walletTransactionRepository, times(1)).save(argThat(tx ->
                "REFUND_CREDIT".equals(tx.getType()) && "VNPAY_LATE_REFUND".equals(tx.getReferenceType())));
    }

    /** Kiểm thử P1-BE-33: chỉ tài khoản Hội viên đang hoạt động mới được nạp/xem ví hội viên tại quầy. */
    @Test
    void memberOnlyGuardRejectsStaffOrDeletedAccountsOnCounterTopupAndLookup() {
        var memberRepo = mock(com.swp391.scms.users.MemberRepository.class);
        walletService.setMemberRepository(memberRepo);

        when(memberRepo.existsById(99L)).thenReturn(false);
        assertThatThrownBy(() -> walletService.creditByReceptionist(99L, new BigDecimal("100000"), "cash", null, 2L))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);
        assertThatThrownBy(() -> walletService.getMemberWallet(99L))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);

        when(memberRepo.existsById(7L)).thenReturn(true);
        when(userRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> walletService.creditByReceptionist(7L, new BigDecimal("100000"), "cash", null, 2L))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);
        assertThatThrownBy(() -> walletService.getMemberWallet(7L))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);

        User activeUser = new User();
        activeUser.setId(7L);
        when(userRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(activeUser));
        when(walletRepository.findByUser_Id(7L)).thenReturn(Optional.of(wallet));
        assertThat(walletService.getMemberWallet(7L).balance()).isEqualByComparingTo("500000");
    }

    /** Kiểm thử P2-BE-42: dùng Clock múi giờ Asia/Ho_Chi_Minh và xử lý tạo ví lần đầu đồng thời an toàn. */
    @Test
    void usesCenterTimeClockAndHandlesConcurrentFirstWalletCreation() {
        java.time.Clock fixedUtcClock = java.time.Clock.fixed(
                java.time.Instant.parse("2026-11-26T00:15:00Z"), java.time.ZoneOffset.UTC);
        walletService.setClock(fixedUtcClock);
        java.time.LocalDateTime expectedVnTime = java.time.LocalDateTime.of(2026, 11, 26, 7, 15, 0);

        User newUser = new User();
        newUser.setId(42L);
        Wallet createdByPeer = new Wallet();
        createdByPeer.setId(200L);
        createdByPeer.setUser(newUser);
        createdByPeer.setBalance(BigDecimal.ZERO);

        when(userRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(Optional.of(newUser));
        when(walletRepository.findByUserIdForUpdate(42L))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(createdByPeer));

        walletService.creditPaymentRefund(42L, new BigDecimal("250000"), "PAYMENT_REFUND_55_250000", "Hoàn tiền");

        verify(walletRepository).insertIfAbsent(42L, expectedVnTime);
        assertThat(createdByPeer.getBalance()).isEqualByComparingTo("250000");
        assertThat(createdByPeer.getUpdatedAt()).isEqualTo(expectedVnTime);
        ArgumentCaptor<WalletTransaction> txCaptor = ArgumentCaptor.forClass(WalletTransaction.class);
        verify(walletTransactionRepository).save(txCaptor.capture());
        assertThat(txCaptor.getValue().getCreatedAt()).isEqualTo(expectedVnTime);
        assertThat(txCaptor.getValue().getReferenceId()).isEqualTo("PAYMENT_REFUND_55_250000");
    }
}
