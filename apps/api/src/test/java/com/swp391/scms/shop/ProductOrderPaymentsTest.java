package com.swp391.scms.shop;

import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.shop.entity.OrderStatus;
import com.swp391.scms.shop.entity.ProductOrder;
import com.swp391.scms.shop.repository.ProductOrderRepository;
import com.swp391.scms.shop.service.ProductOrderPayments;
import com.swp391.scms.shop.service.ProductOrderRefunds;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Bộ kiểm thử cho ProductOrderPayments (product order payments). */
class ProductOrderPaymentsTest {
    final ProductOrderRepository orders = mock(ProductOrderRepository.class);
    final ProductOrderRefunds refunds = mock(ProductOrderRefunds.class);
    final NotificationService notifications = mock(NotificationService.class);
    final UserRepository users = mock(UserRepository.class);
    final MessageService messages = mock(MessageService.class);
    final Clock clock = Clock.fixed(Instant.parse("2026-11-05T07:00:00Z"), ZoneOffset.UTC);

    ProductOrderPayments service;
    Member member;

    /** Chuẩn bị trước mỗi test: tạo ProductOrderPayments với repository giả lập. */
    @BeforeEach
    void setUp() {
        member = new Member();
        member.setUserId(1L);
        service = new ProductOrderPayments(orders, refunds, notifications, users, messages, clock);
    }

    /** Kiểm thử: requirePayable từ chối đơn thanh toán tại quầy và đơn không ở trạng thái pending. */
    @Test
    void requirePayableRejectsCounterAndNonPendingOrders() {
        ProductOrder counterOrder = new ProductOrder();
        counterOrder.setId(9L);
        counterOrder.setMember(member);
        counterOrder.setStatus(OrderStatus.pending_payment.name());
        counterOrder.setPaymentMethod("counter");
        when(orders.findByIdForUpdate(9L)).thenReturn(Optional.of(counterOrder));

        assertThatThrownBy(() -> service.requirePayable(9L))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "VNPAY_TARGET_UNAVAILABLE");

        counterOrder.setPaymentMethod("online");
        counterOrder.setStatus(OrderStatus.paid.name());
        assertThatThrownBy(() -> service.requirePayable(9L))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "VNPAY_TARGET_UNAVAILABLE");

        counterOrder.setStatus(OrderStatus.pending_payment.name());
        counterOrder.setPaymentDueAt(java.time.LocalDateTime.of(2026, 11, 5, 13, 59));
        assertThatThrownBy(() -> service.requirePayable(9L))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "VNPAY_TARGET_UNAVAILABLE");
    }

    /** Kiểm thử: markPaid chuyển đơn pending sang đã thanh toán và thông báo hội viên cùng nhân viên. */
    @Test
    void markPaidTransitionsPendingOrderAndNotifiesMemberAndStaff() {
        ProductOrder order = new ProductOrder();
        order.setId(9L);
        order.setCode("SOL-261105-ABCD");
        order.setMember(member);
        order.setStatus(OrderStatus.pending_payment.name());
        order.setPaymentMethod("online");
        order.setTotal(new BigDecimal("1290000"));
        when(orders.findByIdForUpdate(9L)).thenReturn(Optional.of(order));

        User staff = new User();
        staff.setId(20L);
        staff.setStatus("active");
        when(users.findActiveStaffUsers()).thenReturn(List.of(staff));

        service.markPaid(9L, "online_wallet");

        assertThat(order.getStatus()).isEqualTo("paid");
        assertThat(order.getPaidAt()).isNotNull();
        verify(notifications).send(eq(1L), any(), any(), eq("order"), eq("product_order"), eq(9L), eq("/member/orders/9"));
        verify(notifications).send(eq(20L), any(), any(), eq("order"), eq("product_order"), eq(9L), eq("/staff/orders"));
    }

    /** Kiểm thử: thanh toán đến muộn sau khi hủy thì hoàn vào ví thay vì mở lại đơn. */
    @Test
    void latePaymentAfterCancellationRefundsWalletInsteadOfReopeningOrder() {
        ProductOrder cancelled = new ProductOrder();
        cancelled.setId(9L);
        cancelled.setCode("SOL-261105-ABCD");
        cancelled.setMember(member);
        cancelled.setStatus(OrderStatus.cancelled.name());
        cancelled.setTotal(new BigDecimal("1290000"));
        when(orders.findByIdForUpdate(9L)).thenReturn(Optional.of(cancelled));
        when(refunds.refundIfPaid(eq(cancelled), any())).thenReturn(new BigDecimal("1290000"));

        service.markPaid(9L, "online_wallet");

        assertThat(cancelled.getStatus()).isEqualTo("cancelled");
        verify(refunds).refundIfPaid(eq(cancelled), any());
        verify(orders, never()).save(any());
        verify(notifications).send(eq(1L), any(), any(), eq("order"), eq("product_order"), eq(9L), eq("/member/orders/9"));
    }

    /** Kiểm thử: thanh toán tại quầy chỉ thông báo hội viên chứ không thông báo mọi nhân viên. */
    @Test
    void counterPaymentNotifiesMemberButNotEveryStaffMember() {
        ProductOrder order = new ProductOrder();
        order.setId(9L);
        order.setCode("SOL-261105-ABCD");
        order.setMember(member);
        order.setStatus(OrderStatus.pending_payment.name());
        order.setPaymentMethod("counter");
        order.setTotal(new BigDecimal("1290000"));
        when(orders.findByIdForUpdate(9L)).thenReturn(Optional.of(order));

        service.markPaid(9L, "cash");

        assertThat(order.getStatus()).isEqualTo("paid");
        verify(notifications).send(eq(1L), any(), any(), eq("order"), eq("product_order"), eq(9L), eq("/member/orders/9"));
        verify(notifications, never()).send(any(), any(), any(), any(), any(), any(), eq("/staff/orders"));
        verify(users, never()).findActiveStaffUsers();
    }

    /** Kiểm thử P1-BE-56: thông báo đơn mới cho nhân viên truyền đủ 4 tham số và không để sót placeholder {2}/{3}. */
    @Test
    void markPaidFormatsAllFourStaffNotificationArgumentsWithoutRawPlaceholders() {
        var source = new org.springframework.context.support.ResourceBundleMessageSource();
        source.setBasename("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        MessageService realMessages = new MessageService(source);
        ProductOrderPayments realService = new ProductOrderPayments(orders, refunds, notifications, users, realMessages, clock);

        User memberUser = new User();
        memberUser.setId(1L);
        memberUser.setFullName("Nguyễn Minh Quân");
        member.setUser(memberUser);

        ProductOrder order = new ProductOrder();
        order.setId(9L);
        order.setCode("SOL-261105-ABCD");
        order.setMember(member);
        order.setStatus(OrderStatus.pending_payment.name());
        order.setPaymentMethod("online");
        order.setFulfillment("delivery");
        order.setTotal(new BigDecimal("1290000"));
        when(orders.findByIdForUpdate(9L)).thenReturn(Optional.of(order));

        User staff = new User();
        staff.setId(20L);
        staff.setStatus("active");
        when(users.findActiveStaffUsers()).thenReturn(List.of(staff));

        realService.markPaid(9L, "online_wallet");

        var bodyCaptor = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(notifications).send(eq(20L), any(), bodyCaptor.capture(), eq("order"), eq("product_order"), eq(9L), eq("/staff/orders"));
        String body = bodyCaptor.getValue();
        assertThat(body)
                .contains("Nguyễn Minh Quân")
                .contains("SOL-261105-ABCD")
                .contains("1290000")
                .contains("delivery")
                .doesNotContain("{0}", "{1}", "{2}", "{3}");
    }
}
