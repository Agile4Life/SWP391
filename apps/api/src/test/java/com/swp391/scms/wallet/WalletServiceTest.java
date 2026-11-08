package com.swp391.scms.wallet;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

    @Test
    void creditTopup_isIdempotentOnReference() {
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(100L, "REF123:TOPUP"))
                .thenReturn(false)
                .thenReturn(true);

        walletService.creditTopup(7L, new BigDecimal("200000"), "REF123");
        walletService.creditTopup(7L, new BigDecimal("200000"), "REF123");

        assertThat(wallet.getBalance()).isEqualByComparingTo("700000");
        verify(walletTransactionRepository, times(1)).save(any(WalletTransaction.class));
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/packages"));
    }

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

    @Test
    void debitForPayment_rejectsInsufficientBalance() {
        assertThatThrownBy(() -> walletService.debitForPayment(7L, new BigDecimal("600000"), "WALLET_PAY_56", "Thanh toán", "/member/packages"))
                .isInstanceOf(BadRequestException.class)
                .satisfies(ex -> assertThat(((BadRequestException) ex).getErrorCode()).isEqualTo("INSUFFICIENT_WALLET_BALANCE"));
        assertThat(wallet.getBalance()).isEqualByComparingTo("500000");
        verify(walletTransactionRepository, never()).save(any());
    }

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
        verify(notificationService, times(1)).send(eq(7L), any(), any(), eq("payment"), eq("wallet"), eq(100L), eq("/member/packages"));
    }
}
