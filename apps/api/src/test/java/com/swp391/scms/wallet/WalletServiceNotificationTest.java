package com.swp391.scms.wallet;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WalletServiceNotificationTest {

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private WalletTransactionRepository walletTransactionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    private WalletService walletService;

    @BeforeEach
    void setUp() {
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasenames("i18n/messages");
        messageSource.setDefaultEncoding("UTF-8");
        MessageService messageService = new MessageService(messageSource);
        walletService = new WalletService(
                walletRepository,
                walletTransactionRepository,
                userRepository,
                notificationService,
                messageService
        );
    }

    @Test
    void creditTopupSendsNotificationIncludingVnpayPaymentMethod() {
        User user = new User();
        user.setId(101L);
        Wallet wallet = new Wallet();
        wallet.setId(7L);
        wallet.setUser(user);
        wallet.setBalance(new BigDecimal("100000"));

        when(walletRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(wallet));
        when(walletTransactionRepository.existsByWallet_IdAndReferenceId(7L, "VNP888:TOPUP")).thenReturn(false);

        walletService.creditTopup(101L, new BigDecimal("250000"), "VNP888");

        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService).send(
                eq(101L),
                titleCaptor.capture(),
                bodyCaptor.capture(),
                eq("payment"),
                eq("wallet"),
                eq(7L),
                eq("/member/packages")
        );

        assertThat(bodyCaptor.getValue())
                .contains("250000")
                .contains("VNPay (#VNP888)")
                .contains("350000");
    }

    @Test
    void creditByReceptionistSendsNotificationIncludingCounterPaymentMethod() {
        User user = new User();
        user.setId(101L);
        Wallet wallet = new Wallet();
        wallet.setId(7L);
        wallet.setUser(user);
        wallet.setBalance(new BigDecimal("100000"));

        when(walletRepository.findByUserIdForUpdate(101L)).thenReturn(Optional.of(wallet));

        walletService.creditByReceptionist(101L, new BigDecimal("500000"), "bank_transfer", "CK tại quầy", 12L);

        ArgumentCaptor<String> titleCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(notificationService).send(
                eq(101L),
                titleCaptor.capture(),
                bodyCaptor.capture(),
                eq("payment"),
                eq("wallet"),
                eq(7L),
                eq("/member/packages")
        );

        assertThat(bodyCaptor.getValue())
                .contains("500000")
                .contains("Chuyển khoản tại quầy Lễ tân")
                .contains("600000");
    }
}
