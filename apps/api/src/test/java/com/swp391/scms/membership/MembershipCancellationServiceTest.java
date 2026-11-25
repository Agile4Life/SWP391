package com.swp391.scms.membership;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.dto.CancellationDtos;
import com.swp391.scms.membership.entity.MembershipCancellationRequest;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipCancellationRequestRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MembershipCancellationService;
import com.swp391.scms.scheduling.service.EnrollmentService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service MembershipCancellationService (membership cancellation service). */
@ExtendWith(MockitoExtension.class)
class MembershipCancellationServiceTest {
    @Mock MembershipCancellationRequestRepository requests;
    @Mock MembershipSubscriptionRepository subscriptions;
    @Mock MemberRepository members;
    @Mock UserRepository users;
    @Mock EnrollmentService enrollments;
    @Mock MessageService messages;
    @Mock PaymentRepository payments;
    MembershipCancellationService service;
    Member member;
    MembershipSubscription active;
    MembershipCancellationRequest pending;
    AuthenticatedPrincipal owner = new AuthenticatedPrincipal(10L, "member", "MEMBER");
    AuthenticatedPrincipal manager = new AuthenticatedPrincipal(20L, "manager", "CENTER_MANAGER");

    /** Chuẩn bị trước mỗi test: tạo MembershipCancellationService với repository giả lập. */
    @BeforeEach
    void setup() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-22T08:00:00Z"), ZoneOffset.UTC);
        service = new MembershipCancellationService(requests, subscriptions, members, users, enrollments, messages, clock, payments, null);
        member = new Member(); member.setUserId(10L);
        User user = new User(); user.setId(10L); user.setFullName("Member"); member.setUser(user);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L); pack.setName("Essential");
        active = new MembershipSubscription(); active.setId(100L); active.setMember(member);
        active.setMembershipPackage(pack); active.setStatus("active");
        active.setStartDate(LocalDate.of(2026, 10, 1)); active.setEndDate(LocalDate.of(2026, 11, 1));
        pending = new MembershipCancellationRequest(); pending.setId(7L); pending.setMember(member);
        pending.setSubscription(active); pending.setReason("Moving"); pending.setStatus("PENDING");
        lenient().when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
    }

    /** Kiểm thử: yêu cầu hủy giữ membership còn hiệu lực và từ chối yêu cầu trùng. */
    @Test
    void requestKeepsMembershipActiveAndRejectsDuplicate() {
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        CancellationDtos.Response result = service.request(owner, 100L, new CancellationDtos.Request(" Moving "));
        assertThat(result.reason()).isEqualTo("Moving");
        assertThat(active.getStatus()).isEqualTo("active");
        verifyNoInteractions(enrollments);
        when(requests.existsBySubscriptionIdAndStatus(100L, "PENDING")).thenReturn(true);
        assertThatThrownBy(() -> service.request(owner, 100L, new CancellationDtos.Request("Moving")))
                .isInstanceOf(ConflictException.class);
    }

    /** Kiểm thử: yêu cầu gợi ý phần chưa dùng của số tiền đã trả chứ không phải giá danh mục. */
    @Test
    void requestSuggestsUnusedShareOfWhatWasPaidNotTheCatalogPrice() {
        // Đã mua với giá 320.000; sau đó quản lý đã tăng giá gói lên 500.000.
        active.getMembershipPackage().setPrice(new java.math.BigDecimal("500000"));
        com.swp391.scms.finance.entity.Payment paid = new com.swp391.scms.finance.entity.Payment();
        paid.setSubscriptionId(100L);
        paid.setAmount(new java.math.BigDecimal("320000"));
        paid.setStatus("success");
        when(payments.findAllBySubscriptionId(100L)).thenReturn(List.of(paid));
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CancellationDtos.Response result = service.request(owner, 100L, new CancellationDtos.Request("Moving"));

        // Từ 01/10–01/11 là 32 ngày; vào ngày 22/10 còn lại 11 ngày: 320.000 × 11/32 = 110.000.
        assertThat(result.refundAmount()).isEqualByComparingTo("110000");
    }

    /** Kiểm thử: yêu cầu cần đúng chủ sở hữu và lý do không trống. */
    @Test
    void requestRequiresOwnerAndNonblankReason() {
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        assertThatThrownBy(() -> service.request(new AuthenticatedPrincipal(11L, "other", "MEMBER"),
                100L, new CancellationDtos.Request("reason")))
                .isInstanceOf(com.swp391.scms.common.exception.ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.request(owner, 100L, new CancellationDtos.Request("   ")))
                .isInstanceOf(BadRequestException.class);
    }

    /** Kiểm thử: duyệt chỉ kết thúc membership duy nhất và đặt chỗ tương lai trong cùng transaction. */
    @Test
    void approvalEndsOnlySoleMembershipAndFutureBookingInSameTransaction() {
        stubDecision();
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active));
        when(messages.getMessage("scheduling.enrollment.cancelled_by_membership")).thenReturn("Membership cancelled");
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        service.decide(manager, 7L, true, new CancellationDtos.Decision("No refund"));
        assertThat(active.getStatus()).isEqualTo("cancelled");
        assertThat(pending.getStatus()).isEqualTo("APPROVED");
        verify(enrollments).cancelFutureEnrollmentsForMember(eq(10L), any());
    }

    /** Kiểm thử: duyệt giữ nguyên lớp sắp tới đã trả riêng. */
    @Test
    void approvalPreservesSeparatelyPaidUpcomingClass() {
        stubDecision();
        when(payments.hasUnsettledUpcomingEnrollmentPayment(eq(10L), any(), any())).thenReturn(true);

        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class);
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(pending.getStatus()).isEqualTo("PENDING");
        verifyNoInteractions(enrollments);
        verify(subscriptions, never()).saveAndFlush(any());
    }

    /** Kiểm thử: duyệt từ chối kỳ tương lai đã trả hoặc quyền lợi khác mà không thay đổi gì. */
    @Test
    void approvalRejectsPaidFutureOrOtherEntitlementWithoutMutation() {
        stubDecision();
        MembershipSubscription future = new MembershipSubscription(); future.setId(101L);
        future.setStatus("active"); future.setStartDate(LocalDate.of(2026, 11, 2));
        future.setEndDate(LocalDate.of(2026, 12, 2)); future.setPreviousSubscription(active);
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active, future));
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class);
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(pending.getStatus()).isEqualTo("PENDING");
        verifyNoInteractions(enrollments);
    }

    @Test
    void approvalRejectsOverlappingEntitlementWithoutMutation() {
        stubDecision();
        MembershipSubscription other = new MembershipSubscription(); other.setId(101L);
        other.setStatus("active"); other.setStartDate(LocalDate.of(2026, 10, 1));
        other.setEndDate(LocalDate.of(2026, 11, 1));
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active, other));
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class);
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(other.getStatus()).isEqualTo("active");
        verifyNoInteractions(enrollments);
    }

    /** Kiểm thử: duyệt từ chối khi hội viên còn kỳ gói đang bảo lưu (frozen) mà không thay đổi trạng thái. */
    @Test
    void approvalRejectsFrozenEntitlementWithoutMutation() {
        stubDecision();
        MembershipSubscription frozen = new MembershipSubscription(); frozen.setId(102L);
        frozen.setStatus("frozen"); frozen.setStartDate(LocalDate.of(2026, 10, 1));
        frozen.setEndDate(LocalDate.of(2026, 11, 15));
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active, frozen));
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "CANCELLATION_OTHER_ENTITLEMENT");
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(frozen.getStatus()).isEqualTo("frozen");
        verifyNoInteractions(enrollments);
    }

    /** Kiểm thử: duyệt từ chối khi hội viên còn kỳ gói đang chờ thanh toán (pending_payment). */
    @Test
    void approvalRejectsPendingPaymentEntitlementWithoutMutation() {
        stubDecision();
        MembershipSubscription pendingSub = new MembershipSubscription(); pendingSub.setId(103L);
        pendingSub.setStatus("pending_payment");
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active, pendingSub));
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "CANCELLATION_PENDING_PAYMENT");
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(pendingSub.getStatus()).isEqualTo("pending_payment");
        verifyNoInteractions(enrollments);
    }

    @Test
    void approvalDoesNotCancelExpiredHistory() {
        stubDecision();
        MembershipSubscription expired = new MembershipSubscription(); expired.setId(101L);
        expired.setStatus("active"); expired.setEndDate(LocalDate.of(2026, 9, 30));
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active, expired));
        when(messages.getMessage("scheduling.enrollment.cancelled_by_membership")).thenReturn("Membership cancelled");
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        service.decide(manager, 7L, true, new CancellationDtos.Decision("No refund"));
        assertThat(active.getStatus()).isEqualTo("cancelled");
        assertThat(expired.getStatus()).isEqualTo("active");
    }

    /** Kiểm thử: từ chối giữ membership và cho phép yêu cầu mới. */
    @Test
    void rejectionPreservesMembershipAndAllowsNewRequest() {
        when(requests.findById(7L)).thenReturn(Optional.of(pending));
        when(requests.findByIdForUpdate(7L)).thenReturn(Optional.of(pending));
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        service.decide(manager, 7L, false, new CancellationDtos.Decision("Keep active"));
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(pending.getStatus()).isEqualTo("REJECTED");
        verifyNoInteractions(enrollments);
    }

    /** Kiểm thử: hội viên không quyết định được và thử lại không hủy lặp. */
    @Test
    void memberCannotDecideAndRetryDoesNotRepeatCancellation() {
        assertThatThrownBy(() -> service.decide(owner, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ForbiddenException.class);
        pending.setStatus("APPROVED");
        when(requests.findById(7L)).thenReturn(Optional.of(pending));
        when(requests.findByIdForUpdate(7L)).thenReturn(Optional.of(pending));
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(enrollments);
    }

    /** Kiểm thử: yêu cầu và duyệt bị từ chối khi đang có yêu cầu tạm hoãn chờ xử lý. */
    @Test
    void requestAndApproveRejectWhenHoldRequestIsPending() {
        active.setHoldStatus("PENDING");
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        assertThatThrownBy(() -> service.request(owner, 100L, new CancellationDtos.Request("Moving")))
                .isInstanceOf(ConflictException.class);

        stubDecision();
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class);
        assertThat(active.getStatus()).isEqualTo("active");
        assertThat(pending.getStatus()).isEqualTo("PENDING");
        verifyNoInteractions(enrollments);
    }

    /** Hàm trợ giúp của test: giả lập các repository cho bước quyết định. */
    private void stubDecision() {
        when(requests.findById(7L)).thenReturn(Optional.of(pending));
        when(requests.findByIdForUpdate(7L)).thenReturn(Optional.of(pending));
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
    }

    /** Kiểm thử: danh sách dùng truy vấn dành cho quản lý thay vì findAll. */
    @Test
    void all_UsesFindAllForManagerQueryInsteadOfFindAll() {
        when(requests.findAllForManager()).thenReturn(List.of(pending));
        var list = service.all();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).memberName()).isEqualTo("Member");
        verify(requests).findAllForManager();
        verify(requests, never()).findAll();
    }

    /** Kiểm thử: yêu cầu của nhân viên cần vai trò nhân viên, lý do không trống và subscription đang hoạt động. */
    @Test
    void staffRequest_requiresStaffRoleNonBlankReasonAndActiveSubscription() {
        var receptionist = new AuthenticatedPrincipal(30L, "desk", "RECEPTIONIST");
        assertThatThrownBy(() -> service.staffRequest(owner, new CancellationDtos.StaffRequest(10L, 100L, "Moving", null)))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.staffRequest(receptionist, new CancellationDtos.StaffRequest(10L, 100L, "   ", null)))
                .isInstanceOf(BadRequestException.class);

        MembershipSubscription expired = new MembershipSubscription();
        expired.setId(101L); expired.setMember(member); expired.setMembershipPackage(active.getMembershipPackage());
        expired.setStatus("active");
        expired.setStartDate(LocalDate.of(2026, 9, 1));
        expired.setEndDate(LocalDate.of(2026, 10, 1));
        when(subscriptions.findById(101L)).thenReturn(Optional.of(expired));
        when(subscriptions.findByIdForUpdate(101L)).thenReturn(Optional.of(expired));
        assertThatThrownBy(() -> service.staffRequest(receptionist, new CancellationDtos.StaffRequest(10L, 101L, "Moving", null)))
                .isInstanceOf(ConflictException.class);
    }

    /** Kiểm thử: quyết định hoàn ví khi tiền hoàn dương và bỏ qua ví khi bằng 0. */
    @Test
    void decide_creditsWalletWhenRefundPositiveAndSkipsWalletWhenRefundZero() {
        var walletService = mock(com.swp391.scms.wallet.WalletService.class);
        service.setWalletService(walletService);
        stubDecision();
        pending.setRefundAmount(new java.math.BigDecimal("110000"));
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active));
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        com.swp391.scms.finance.entity.Payment paid = new com.swp391.scms.finance.entity.Payment();
        paid.setId(1L); paid.setSubscriptionId(100L); paid.setAmount(new java.math.BigDecimal("320000")); paid.setStatus("success");
        when(payments.findAllBySubscriptionId(100L)).thenReturn(List.of(paid));

        service.decide(manager, 7L, true, new CancellationDtos.Decision("Approved", new java.math.BigDecimal("110000")));
        verify(walletService).creditRefund(10L, new java.math.BigDecimal("110000"), "CANCEL_REQ_7", "Moving");
        // Khoản thanh toán ghi nhận phần đã hoàn, nên doanh thu giảm tương ứng và /payments/{id}/refund chỉ hoàn được phần còn lại.
        assertThat(paid.getRefundedAmount()).isEqualByComparingTo("110000");
        assertThat(paid.getStatus()).isEqualTo("success");
    }

    /** Kiểm thử: từ chối khoản hoàn vượt quá số đã trả. */
    @Test
    void decide_rejectsRefundAboveWhatWasPaid() {
        var walletService = mock(com.swp391.scms.wallet.WalletService.class);
        service.setWalletService(walletService);
        stubDecision();
        com.swp391.scms.finance.entity.Payment paid = new com.swp391.scms.finance.entity.Payment();
        paid.setId(1L); paid.setSubscriptionId(100L); paid.setAmount(new java.math.BigDecimal("320000")); paid.setStatus("success");
        when(payments.findAllBySubscriptionId(100L)).thenReturn(List.of(paid));
        lenient().when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active));
        lenient().when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> service.decide(manager, 7L, true,
                new CancellationDtos.Decision("Approved", new java.math.BigDecimal("320001"))))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(walletService);
    }

    /** Kiểm thử P0-10: chặn yêu cầu/duyệt hủy khi gói đang có đợt bảo lưu đã duyệt (chưa bắt đầu). */
    @Test
    void requestStaffRequestAndApproveRejectWhenHoldIsApproved() {
        active.setHoldStatus("APPROVED");
        active.setHoldDaysCredited(true);
        active.setHoldStartDate(LocalDate.of(2026, 10, 25));
        active.setHoldEndDate(LocalDate.of(2026, 11, 5));
        active.setEndDate(LocalDate.of(2026, 11, 13));

        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        assertThatThrownBy(() -> service.request(owner, 100L, new CancellationDtos.Request("Moving")))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "MEMBERSHIP_HOLD_ALREADY_APPROVED");

        var receptionist = new AuthenticatedPrincipal(30L, "desk", "RECEPTIONIST");
        when(subscriptions.findById(100L)).thenReturn(Optional.of(active));
        assertThatThrownBy(() -> service.staffRequest(receptionist, new CancellationDtos.StaffRequest(10L, 100L, "Moving", null)))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "MEMBERSHIP_HOLD_ALREADY_APPROVED");

        stubDecision();
        assertThatThrownBy(() -> service.decide(manager, 7L, true, new CancellationDtos.Decision(null)))
                .isInstanceOf(ConflictException.class)
                .hasFieldOrPropertyWithValue("errorCode", "MEMBERSHIP_HOLD_ALREADY_APPROVED");
        assertThat(active.getStatus()).isEqualTo("active");
        verifyNoInteractions(enrollments);
    }

    /** Kiểm thử P0-10: hủy gói sau khi bảo lưu đã kết thúc tính tiền hoàn chính xác theo 60 ngày thực tế. */
    @Test
    void requestAfterCompletedHoldComputesExactPostHoldRefund() {
        // Clock cố định ở 2026-10-22 (Day 32 tính từ 2026-09-21).
        LocalDate start = LocalDate.of(2026, 9, 21); // Day 1
        active.setStartDate(start);
        active.setEndDate(start.plusDays(89));       // Day 90 (60 gốc + 30 ngày bảo lưu)
        active.setHoldStartDate(start.plusDays(1));  // Day 2
        active.setHoldEndDate(start.plusDays(30));   // Day 31 (2026-10-21)
        active.setHoldStatus(null);
        active.setHoldUsed(true);
        active.setHoldDaysCredited(true);

        com.swp391.scms.finance.entity.Payment paid = new com.swp391.scms.finance.entity.Payment();
        paid.setSubscriptionId(100L);
        paid.setAmount(new java.math.BigDecimal("6000000"));
        paid.setStatus("success");
        when(payments.findAllBySubscriptionId(100L)).thenReturn(List.of(paid));
        when(subscriptions.findByIdForUpdate(100L)).thenReturn(Optional.of(active));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CancellationDtos.Response result = service.request(owner, 100L, new CancellationDtos.Request("Moving"));
        assertThat(result.refundAmount()).isEqualByComparingTo("5900000");
    }

    /** Kiểm thử P1-BE-29: hủy gói đã nâng cấp ghi nhận đủ tiền hoàn tràn ngược sang giao dịch kỳ trước. */
    @Test
    void decide_walksUpgradePredecessorChainToRecordCarryOverRefundOnOldPayments() {
        var walletService = mock(com.swp391.scms.wallet.WalletService.class);
        service.setWalletService(walletService);

        MembershipPackage silver = new MembershipPackage();
        silver.setId(1L); silver.setName("SILVER");
        MembershipPackage platinum = new MembershipPackage();
        platinum.setId(2L); platinum.setName("PLATINUM");

        MembershipSubscription oldSub = new MembershipSubscription();
        oldSub.setId(90L); oldSub.setMember(member); oldSub.setMembershipPackage(silver);
        oldSub.setStatus("expired");
        oldSub.setStartDate(LocalDate.of(2026, 9, 1));
        oldSub.setEndDate(LocalDate.of(2026, 10, 1));

        active.setMembershipPackage(platinum);
        active.setPreviousSubscription(oldSub);
        active.setUpgradeCharge(new java.math.BigDecimal("2000000"));
        active.setCreditApplied(new java.math.BigDecimal("900000"));

        com.swp391.scms.finance.entity.Payment p2 = new com.swp391.scms.finance.entity.Payment();
        p2.setId(2L); p2.setSubscriptionId(100L); p2.setAmount(new java.math.BigDecimal("2000000")); p2.setStatus("success");
        com.swp391.scms.finance.entity.Payment p1 = new com.swp391.scms.finance.entity.Payment();
        p1.setId(1L); p1.setSubscriptionId(90L); p1.setAmount(new java.math.BigDecimal("1500000")); p1.setStatus("success");

        stubDecision();
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(oldSub, active));
        when(payments.findAllBySubscriptionId(100L)).thenReturn(List.of(p2));
        when(payments.findAllBySubscriptionId(90L)).thenReturn(List.of(p1));
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        service.decide(manager, 7L, true, new CancellationDtos.Decision("Full upgrade cancel", new java.math.BigDecimal("2900000")));

        assertThat(p2.getRefundedAmount()).isEqualByComparingTo("2000000");
        assertThat(p2.getStatus()).isEqualTo("refunded");
        assertThat(p1.getRefundedAmount()).isEqualByComparingTo("900000");
        assertThat(p1.getStatus()).isEqualTo("success");
        verify(walletService).creditRefund(10L, new java.math.BigDecimal("2900000"), "CANCEL_REQ_7", "Moving");
    }

    /** Kiểm thử P3-BE-13: duyệt hủy gói xóa sạch trạng thái/ngày bảo lưu và staffRequest chặn lệch memberId. */
    @Test
    void approvalClearsHoldFieldsAndStaffRequestRejectsMismatchedMemberId() {
        active.setHoldStatus("REJECTED");
        active.setHoldStartDate(LocalDate.of(2026, 10, 5));
        active.setHoldEndDate(LocalDate.of(2026, 10, 10));
        active.setHoldDaysCredited(true);

        stubDecision();
        when(subscriptions.findByMemberUserId(10L)).thenReturn(List.of(active));
        when(messages.getMessage("scheduling.enrollment.cancelled_by_membership")).thenReturn("Membership cancelled");
        User managerUser = new User(); managerUser.setId(20L);
        when(users.findByIdAndDeletedAtIsNull(20L)).thenReturn(Optional.of(managerUser));
        when(requests.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        service.decide(manager, 7L, true, new CancellationDtos.Decision("Cleared"));

        assertThat(active.getStatus()).isEqualTo("cancelled");
        assertThat(active.getHoldStatus()).isNull();
        assertThat(active.getHoldStartDate()).isNull();
        assertThat(active.getHoldEndDate()).isNull();
        assertThat(active.getHoldDaysCredited()).isFalse();

        // staffRequest từ chối khi subscriptionId không thuộc memberId được truyền lên
        var receptionist = new AuthenticatedPrincipal(30L, "desk", "RECEPTIONIST");
        when(subscriptions.findById(100L)).thenReturn(Optional.of(active));
        assertThatThrownBy(() -> service.staffRequest(receptionist,
                new CancellationDtos.StaffRequest(99L, 100L, "Mismatch", null)))
                .isInstanceOf(BadRequestException.class)
                .hasFieldOrPropertyWithValue("errorCode", "MEMBERSHIP_NOT_OWNER");
    }
}
