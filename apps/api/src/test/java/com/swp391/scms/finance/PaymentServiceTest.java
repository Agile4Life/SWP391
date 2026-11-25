package com.swp391.scms.finance;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.finance.dto.PaymentCreateDto;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.mapper.PaymentMapper;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.PaymentService;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import com.swp391.scms.finance.dto.PaymentProcessDto;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service PaymentService (payment service). */
@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MembershipSubscriptionRepository membershipSubscriptionRepository;

    @Mock
    private ClassEnrollmentRepository classEnrollmentRepository;

    @Mock
    private PaymentMapper paymentMapper;

    private Clock clock;
    private PaymentService paymentService;

    /** Chuẩn bị trước mỗi test: tạo PaymentService với repository giả lập. */
    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-10-01T10:00:00Z"), ZoneOffset.UTC);
        paymentService = new PaymentService(paymentRepository, memberRepository, userRepository,
                membershipSubscriptionRepository, classEnrollmentRepository, paymentMapper, clock);
    }

    /** Kiểm thử: tạo thanh toán thành công. */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.NullSource
    @org.junit.jupiter.params.provider.ValueSource(strings = {"PENDING", "REJECTED"})
    void posCannotCreatePaidPackageWithoutKyc(String status) {
        Member member = new Member(); member.setUserId(2L); member.setKycStatus(status);
        MembershipPackage pkg = new MembershipPackage(); pkg.setId(5L); pkg.setStatus("active"); pkg.setPrice(BigDecimal.TEN);
        var packages = mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", packages);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(packages.findById(5L)).thenReturn(Optional.of(pkg));
        PaymentProcessDto dto = new PaymentProcessDto(); dto.setMemberId(2L); dto.setPackageId(5L); dto.setAmount(BigDecimal.TEN); dto.setMethod("cash");
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
        verify(membershipSubscriptionRepository, never()).save(any());
        verify(paymentRepository, never()).save(any());
        verifyNoInteractions(paymentMapper);
    }

    @Test void oldPendingPurchaseCannotCreateOrConfirmPaymentWithoutKyc() {
        Member member = new Member(); member.setUserId(2L); member.setKycStatus("REJECTED");
        MembershipSubscription sub = new MembershipSubscription(); sub.setId(10L); sub.setMember(member); sub.setStatus("pending_payment");
        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(sub));
        PaymentCreateDto create = new PaymentCreateDto(); create.setMemberId(2L); create.setSubscriptionId(10L); create.setAmount(BigDecimal.TEN);
        assertThrows(BadRequestException.class, () -> paymentService.createPayment(create));
        Payment payment = new Payment(); payment.setId(20L); payment.setMember(member); payment.setSubscriptionId(10L); payment.setStatus("pending");
        when(paymentRepository.findById(20L)).thenReturn(Optional.of(payment));
        assertThrows(BadRequestException.class, () -> paymentService.updatePaymentStatus(20L, "success"));
        assertEquals("pending", payment.getStatus()); assertEquals("pending_payment", sub.getStatus()); assertNull(sub.getQrCode());
        verify(paymentRepository, never()).save(any()); verify(membershipSubscriptionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should create payment successfully when member and cashier are valid")
    void shouldCreatePaymentSuccessfully() {
        PaymentCreateDto dto = new PaymentCreateDto();
        dto.setMemberId(2L);
        dto.setReceivedById(1L);
        dto.setAmount(new BigDecimal("1500000.00"));
        dto.setMethod("POS");
        dto.setStatus("SUCCESS");

        Member member = new Member();
        User receiver = new User();
        Payment payment = new Payment();
        PaymentDto expectedDto = new PaymentDto();
        expectedDto.setId(10L);

        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(receiver));
        when(paymentMapper.toEntity(dto)).thenReturn(payment);
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(paymentMapper.toDto(payment)).thenReturn(expectedDto);

        PaymentDto result = paymentService.createPayment(dto);

        assertNotNull(result);
        assertEquals(10L, result.getId());
        assertEquals("pos", payment.getMethod());
        assertEquals("success", payment.getStatus());
        assertEquals(LocalDateTime.now(clock), payment.getPaidAt());
        verify(paymentRepository).save(payment);
    }

    /** Kiểm thử: ném lỗi khi tạo thanh toán cho hội viên không tồn tại. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when member does not exist")
    void shouldThrowWhenCreatingPaymentWithNonExistentMember() {
        PaymentCreateDto dto = new PaymentCreateDto();
        dto.setMemberId(999L);

        when(memberRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> paymentService.createPayment(dto));
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: ném lỗi khi thu ngân đã bị xóa mềm. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when cashier receiver is soft-deleted")
    void shouldThrowWhenCreatingPaymentWithSoftDeletedCashier() {
        PaymentCreateDto dto = new PaymentCreateDto();
        dto.setMemberId(2L);
        dto.setReceivedById(1L);

        when(memberRepository.findById(2L)).thenReturn(Optional.of(new Member()));
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> paymentService.createPayment(dto));
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: lấy thanh toán theo id. */
    @Test
    @DisplayName("Should return PaymentDto by ID when payment exists")
    void shouldGetPaymentById() {
        Payment payment = new Payment();
        payment.setId(5L);
        PaymentDto expectedDto = new PaymentDto();
        expectedDto.setId(5L);

        when(paymentRepository.findById(5L)).thenReturn(Optional.of(payment));
        when(paymentMapper.toDto(payment)).thenReturn(expectedDto);

        PaymentDto result = paymentService.getPaymentById(5L);
        assertEquals(5L, result.getId());
    }

    /** Kiểm thử: ném lỗi khi không tìm thấy thanh toán. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when payment ID not found")
    void shouldThrowWhenPaymentNotFound() {
        when(paymentRepository.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> paymentService.getPaymentById(999L));
    }

    /** Kiểm thử: lấy thanh toán theo hội viên. */
    @Test
    @DisplayName("Should return list of payments for existing member")
    void shouldGetPaymentsByMemberId() {
        when(memberRepository.existsById(2L)).thenReturn(true);
        Payment payment = new Payment();
        when(paymentRepository.findByMemberUserId(2L)).thenReturn(List.of(payment));
        when(paymentMapper.toDtoList(List.of(payment))).thenReturn(List.of(new PaymentDto()));

        List<PaymentDto> results = paymentService.getPaymentsByMemberId(2L);
        assertEquals(1, results.size());
    }

    /** Kiểm thử: ném lỗi khi không tìm thấy hội viên cho lịch sử thanh toán. */
    @Test
    @DisplayName("Should throw ResourceNotFoundException when querying payments for non-existent member")
    void shouldThrowWhenMemberNotFoundForPaymentsHistory() {
        when(memberRepository.existsById(999L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> paymentService.getPaymentsByMemberId(999L));
    }

    /** Kiểm thử: cập nhật trạng thái từ pending sang success. */
    @Test
    @DisplayName("Should update payment status from pending to success and set paidAt")
    void shouldUpdatePaymentStatusFromPendingToSuccess() {
        Payment payment = new Payment();
        payment.setId(1L);
        payment.setStatus("pending");

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));
        when(paymentMapper.toDto(payment)).thenReturn(new PaymentDto());

        paymentService.updatePaymentStatus(1L, "success");

        assertEquals("success", payment.getStatus());
        assertEquals(LocalDateTime.now(clock), payment.getPaidAt());
    }

    /** Kiểm thử: từ chối chuyển từ success sang refunded qua cập nhật trạng thái. */
    @Test
    @DisplayName("Should reject success to refunded on the status endpoint; refunds go through refundPayment")
    void shouldRejectStatusUpdateFromSuccessToRefunded() {
        Payment payment = new Payment();
        payment.setId(1L);
        payment.setStatus("success");
        payment.setPaidAt(LocalDateTime.now(clock).minusHours(1));

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> paymentService.updatePaymentStatus(1L, "refunded"));
        assertEquals("success", payment.getStatus());
    }

    /** Kiểm thử: từ chối các chuyển trạng thái không được phép. */
    @Test
    @DisplayName("Should throw BadRequestException for invalid status transitions (e.g., refunded -> success)")
    void shouldRejectDisallowedStatusTransitions() {
        Payment payment = new Payment();
        payment.setId(1L);
        payment.setStatus("refunded");

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> paymentService.updatePaymentStatus(1L, "success"));
    }

    /** Kiểm thử: từ chối chuỗi trạng thái không hợp lệ. */
    @Test
    @DisplayName("Should throw BadRequestException when status string is unknown")
    void shouldRejectInvalidStatusString() {
        Payment payment = new Payment();
        payment.setId(1L);

        when(paymentRepository.findById(1L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> paymentService.updatePaymentStatus(1L, "invalid_status"));
    }

    /** Kiểm thử: xử lý thanh toán và kích hoạt subscription. */
    @Test
    @DisplayName("Should process payment and activate subscription with QR code generation")
    void shouldProcessPaymentAndActivateSubscription() {
        Member member = new Member(); member.setIdentityVerified(true);
        member.setUserId(2L);

        MembershipPackage pkg = new MembershipPackage();
        pkg.setPrice(new BigDecimal("1500000.00"));

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(10L);
        sub.setMember(member);
        sub.setMembershipPackage(pkg);
        sub.setStatus("pending_payment");

        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(sub));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentMapper.toDto(any(Payment.class))).thenReturn(new PaymentDto());

        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, null, new BigDecimal("1500000.00"), "pos", null, "Ghi chú");
        PaymentDto result = paymentService.processPayment(dto);

        assertNotNull(result);
        assertEquals("active", sub.getStatus());
        assertNotNull(sub.getQrCode());
        assertFalse(sub.getQrCode().isBlank());
        verify(membershipSubscriptionRepository).save(sub);
        verify(paymentRepository).save(any(Payment.class));
    }

    /** Kiểm thử: POS không kích hoạt được subscription đã hủy. */
    @Test
    void posCannotActivateCancelledSubscription() {
        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription cancelled = new MembershipSubscription(); cancelled.setId(10L);
        cancelled.setMember(member); cancelled.setStatus("cancelled");
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(cancelled));
        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, null,
                new BigDecimal("500000"), "pos", null, null);
        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        verify(paymentRepository, never()).save(any());
        assertEquals("cancelled", cancelled.getStatus());
    }

    /** Kiểm thử: POS tất toán thanh toán pending có sẵn mà không tạo bản trùng. */
    @Test
    void posSettlesExistingPendingPaymentWithoutCreatingDuplicate() {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pkg = new MembershipPackage(); pkg.setPrice(new BigDecimal("500000"));
        MembershipSubscription sub = new MembershipSubscription(); sub.setId(10L);
        sub.setMember(member); sub.setMembershipPackage(pkg); sub.setStatus("pending_payment");
        Payment pending = new Payment(); pending.setId(90L); pending.setMember(member);
        pending.setSubscriptionId(10L); pending.setStatus("pending"); pending.setAmount(new BigDecimal("500000"));
        pending.setMethod("bank_transfer"); pending.setNote("Awaiting transfer");
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(sub));
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of(pending));
        when(paymentRepository.save(pending)).thenReturn(pending);
        when(paymentMapper.toDto(pending)).thenReturn(new PaymentDto());
        paymentService.processPayment(new PaymentProcessDto(2L, 10L, null,
                new BigDecimal("500000"), "pos", null, "Paid at desk"));
        assertEquals("pos", pending.getMethod());
        assertEquals("Paid at desk", pending.getNote());
        assertEquals("success", pending.getStatus());
        assertEquals("active", sub.getStatus());
        verify(paymentRepository).save(pending);
        verify(paymentRepository, times(1)).save(any());
    }

    /** Kiểm thử: thanh toán subscription có sẵn không tất toán được ghi danh khác. */
    @Test
    void existingSubscriptionPaymentCannotSettleAnotherEnrollment() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage pkg = new MembershipPackage(); pkg.setPrice(new BigDecimal("500000"));
        MembershipSubscription sub = new MembershipSubscription(); sub.setId(10L);
        sub.setMember(member); sub.setMembershipPackage(pkg); sub.setStatus("pending_payment");
        Payment pending = new Payment(); pending.setId(90L); pending.setMember(member);
        pending.setSubscriptionId(10L); pending.setStatus("pending"); pending.setAmount(pkg.getPrice());
        ClassEnrollment enrollment = new ClassEnrollment(); enrollment.setMember(member); enrollment.setStatus("cancelled");
        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, 20L, pkg.getPrice(), "pos", null, null);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
        assertEquals("PAYMENT_MULTIPLE_TARGETS", ex.getErrorCode());
        assertEquals("pending_payment", sub.getStatus());
        assertEquals("pending", pending.getStatus());
        assertEquals("cancelled", enrollment.getStatus());
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: xác nhận thanh toán không kích hoạt lại yêu cầu đã hủy. */
    @Test
    void paymentConfirmationCannotReactivateCancelledRequest() {
        Member member = new Member(); member.setUserId(2L);
        Payment payment = new Payment(); payment.setId(90L); payment.setMember(member);
        payment.setSubscriptionId(10L); payment.setStatus("pending");
        MembershipSubscription cancelled = new MembershipSubscription(); cancelled.setId(10L);
        cancelled.setMember(member); cancelled.setStatus("cancelled");
        when(paymentRepository.findById(90L)).thenReturn(Optional.of(payment));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(cancelled));
        assertThrows(ConflictException.class, () -> paymentService.updatePaymentStatus(90L, "success"));
        assertEquals("cancelled", cancelled.getStatus());
    }

    /** Kiểm thử: từ chối thanh toán khi số tiền không khớp. */
    @Test
    @DisplayName("Should reject payment processing when amount does not match package price")
    void shouldRejectPaymentWhenAmountMismatches() {
        Member member = new Member();
        member.setUserId(2L);

        MembershipPackage pkg = new MembershipPackage();
        pkg.setPrice(new BigDecimal("1500000.00"));

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(10L);
        sub.setMember(member);
        sub.setMembershipPackage(pkg);

        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(sub));

        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, null, new BigDecimal("1000000.00"), "pos", null, null);
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
    }

    /** Kiểm thử: từ chối thanh toán khi thiếu đối tượng thanh toán. */
    @Test
    @DisplayName("Should reject payment processing when target subscription and enrollment are both null")
    void shouldRejectPaymentWhenTargetIsMissing() {
        PaymentProcessDto dto = new PaymentProcessDto(2L, null, null, new BigDecimal("1000000.00"), "pos", null, null);
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
    }

    /** Kiểm thử: hoàn tiền thanh toán thành công và hủy subscription. */
    @Test
    @DisplayName("Should refund payment successfully and cancel associated subscription")
    void shouldRefundPaymentSuccessfullyAndCancelSubscription() {
        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("1500000.00"));
        payment.setSubscriptionId(5L);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(5L);
        sub.setStatus("active");

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(5L)).thenReturn(Optional.of(sub));
        when(paymentRepository.save(payment)).thenReturn(payment);
        when(paymentMapper.toDto(payment)).thenReturn(new PaymentDto());

        PaymentDto result = paymentService.refundPayment(10L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Chuyển nhà", new BigDecimal("1500000.00")));
        assertNotNull(result);
        assertEquals("refunded", payment.getStatus());
        assertEquals("cancelled", sub.getStatus());
        assertTrue(payment.getNote().contains("HOÀN TIỀN"));
        verify(membershipSubscriptionRepository).save(sub);
        verify(paymentRepository).save(payment);
    }

    /** Kiểm thử: từ chối hoàn tiền khi thanh toán chưa thành công. */
    @Test
    @DisplayName("Should reject refund when payment is not in success status")
    void shouldRejectRefundWhenPaymentNotSuccess() {
        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("pending");
        payment.setAmount(new BigDecimal("1500000.00"));

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> paymentService.refundPayment(10L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Lỗi thu ngân")));
    }

    /** Kiểm thử: từ chối hoàn tiền khi số tiền vượt quá khoản thanh toán. */
    @Test
    @DisplayName("Should reject refund when refund amount is invalid or exceeds payment amount")
    void shouldRejectRefundWhenAmountExceedsPayment() {
        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("1500000.00"));

        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));

        assertThrows(BadRequestException.class, () -> paymentService.refundPayment(10L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Nhầm", new BigDecimal("2000000.00"))));
    }
    /** Kiểm thử: thanh toán gia hạn thất bại hủy kỳ chờ mà không kích hoạt nó. */
    @Test
    void failedRenewalPaymentCancelsPendingPeriodWithoutActivatingIt() {
        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setPreviousSubscription(previous);
        renewal.setStatus("pending_payment");
        Payment payment = new Payment(); payment.setId(11L); payment.setSubscriptionId(10L);
        payment.setStatus("pending");
        when(paymentRepository.findById(11L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(renewal));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(paymentMapper.toDto(payment)).thenReturn(new PaymentDto());
        paymentService.updatePaymentStatus(11L, "failed");
        assertEquals("failed", payment.getStatus());
        assertEquals("cancelled", renewal.getStatus());
        assertNull(renewal.getQrCode());
        verify(membershipSubscriptionRepository).save(renewal);
    }
    /** Kiểm thử: số tiền gia hạn được kiểm tra theo giá gói phía server. */
    @Test
    void renewalPaymentAmountIsCheckedAgainstServerPackagePrice() {
        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipPackage pack = new MembershipPackage(); pack.setPrice(new BigDecimal("1500000.00"));
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setPreviousSubscription(previous);
        renewal.setMembershipPackage(pack); renewal.setStatus("pending_payment");
        PaymentCreateDto dto = new PaymentCreateDto();
        dto.setMemberId(2L); dto.setSubscriptionId(10L);
        dto.setAmount(new BigDecimal("1.00")); dto.setMethod("bank_transfer");
        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(renewal));
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of());
        assertThrows(BadRequestException.class, () -> paymentService.createPayment(dto));
        verify(paymentRepository, never()).save(any());
    }
    /** Kiểm thử: yêu cầu thanh toán gia hạn không thể tạo hai lần. */
    @Test
    void renewalPaymentRequestCannotBeCreatedTwice() {
        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setPreviousSubscription(previous);
        renewal.setStatus("pending_payment");
        PaymentCreateDto dto = new PaymentCreateDto();
        dto.setMemberId(2L); dto.setSubscriptionId(10L);
        dto.setAmount(new BigDecimal("1500000.00")); dto.setMethod("bank_transfer");
        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(renewal));
        Payment settled = new Payment(); settled.setMember(member); settled.setStatus("success");
        settled.setAmount(dto.getAmount());
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of(settled));
        assertThrows(ConflictException.class, () -> paymentService.createPayment(dto));
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: POS với packageId từ chối kỳ gia hạn đang chờ và không đổi gói của nó. */
    @Test
    void posPackageIdRejectsPendingRenewalWithoutChangingItsPackage() {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        pack.setPrice(new BigDecimal("1500000.00"));
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setMembershipPackage(pack);
        renewal.setPreviousSubscription(previous); renewal.setStatus("pending_payment");
        PaymentProcessDto dto = new PaymentProcessDto(2L, null, null, pack.getPrice(), "pos", null, null);
        dto.setPackageId(5L);
        var packageRepository = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", packageRepository);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(packageRepository.findById(5L)).thenReturn(Optional.of(pack));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(renewal));
        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        assertSame(pack, renewal.getMembershipPackage());
        assertEquals("pending_payment", renewal.getStatus());
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: POS với packageId không đổi được lượt mua đang chờ hay tạo thanh toán trùng. */
    @Test
    void posPackageIdCannotChangePendingPurchaseOrDuplicateItsPayment() {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L); pack.setPrice(new BigDecimal("1500000.00"));
        MembershipPackage other = new MembershipPackage(); other.setId(6L);
        MembershipSubscription pending = new MembershipSubscription();
        pending.setId(10L); pending.setMember(member); pending.setMembershipPackage(other); pending.setStatus("pending_payment");
        PaymentProcessDto dto = new PaymentProcessDto(2L, null, null, pack.getPrice(), "pos", null, null);
        dto.setPackageId(5L);
        var packageRepository = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", packageRepository);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(packageRepository.findById(5L)).thenReturn(Optional.of(pack));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(pending));
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
        assertSame(other, pending.getMembershipPackage());
        pending.setMembershipPackage(pack);
        Payment settled = new Payment(); settled.setMember(member); settled.setStatus("success");
        settled.setAmount(pack.getPrice());
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of(settled));
        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: xác nhận cùng một khoản gia hạn hai lần chỉ kích hoạt một lần. */
    @Test
    void confirmingSameRenewalPaymentTwiceActivatesOnlyOnce() {
        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setPreviousSubscription(previous);
        renewal.setStatus("pending_payment");
        Payment payment = new Payment(); payment.setId(11L); payment.setSubscriptionId(10L);
        payment.setStatus("pending");
        when(paymentRepository.findById(11L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(renewal));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(paymentMapper.toDto(payment)).thenReturn(new PaymentDto());
        paymentService.updatePaymentStatus(11L, "success");
        paymentService.updatePaymentStatus(11L, "success");
        assertEquals("active", renewal.getStatus());
        verify(membershipSubscriptionRepository, times(1)).save(renewal);
    }

    /** Kiểm thử: POS lần mua đầu vẫn tạo subscription đã thanh toán. */
    @Test
    void posFirstPurchaseStillCreatesPaidSubscription() {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        pack.setPrice(new BigDecimal("1500000.00")); pack.setDurationDays(30);
        PaymentProcessDto dto = new PaymentProcessDto(2L, null, null, pack.getPrice(), "pos", null, null);
        dto.setPackageId(5L);
        var packageRepository = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", packageRepository);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(packageRepository.findById(5L)).thenReturn(Optional.of(pack));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of());
        when(membershipSubscriptionRepository.save(any(MembershipSubscription.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toDto(any(Payment.class))).thenReturn(new PaymentDto());
        paymentService.processPayment(dto);
        var saved = org.mockito.ArgumentCaptor.forClass(MembershipSubscription.class);
        verify(membershipSubscriptionRepository, atLeastOnce()).save(saved.capture());
        assertEquals("active", saved.getValue().getStatus());
        assertNull(saved.getValue().getPreviousSubscription());
        verify(paymentRepository, times(1)).save(any(Payment.class));
    }

    /** Kiểm thử: POS xác nhận khoản gia hạn đang chờ mà không tạo thêm khoản khác. */
    @Test
    void posConfirmsExistingPendingRenewalPaymentWithoutCreatingAnother() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        pack.setPrice(new BigDecimal("1500000.00"));
        MembershipSubscription previous = new MembershipSubscription(); previous.setId(9L);
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(10L); renewal.setMember(member); renewal.setMembershipPackage(pack);
        renewal.setPreviousSubscription(previous); renewal.setStatus("pending_payment");
        Payment pendingPayment = new Payment();
        pendingPayment.setId(11L); pendingPayment.setMember(member); pendingPayment.setSubscriptionId(10L);
        pendingPayment.setStatus("pending"); pendingPayment.setAmount(pack.getPrice());
        pendingPayment.setMethod("bank_transfer");
        User cashier = new User(); cashier.setId(1L);
        jakarta.persistence.EntityManager entityManager = mock(jakarta.persistence.EntityManager.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "entityManager", entityManager);
        // Refresh nạp lại giá trị đã lưu và bỏ các chỉnh sửa chưa flush của thu ngân.
        doAnswer(invocation -> {
            if (invocation.getArgument(0) != pendingPayment) return null;
            pendingPayment.setMethod("bank_transfer");
            pendingPayment.setReceivedBy(null);
            pendingPayment.setNote(null);
            return null;
        }).when(entityManager).refresh(any());
        when(userRepository.findByIdAndDeletedAtIsNull(1L)).thenReturn(Optional.of(cashier));
        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, null, pack.getPrice(), "pos", 1L, "Paid at desk");
        dto.setPackageId(5L);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(renewal));
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of(pendingPayment));
        when(paymentRepository.save(pendingPayment)).thenReturn(pendingPayment);
        when(paymentMapper.toDto(pendingPayment)).thenReturn(new PaymentDto());
        paymentService.processPayment(dto);
        assertEquals("pos", pendingPayment.getMethod());
        assertSame(cashier, pendingPayment.getReceivedBy());
        assertEquals("Paid at desk", pendingPayment.getNote());
        assertEquals("success", pendingPayment.getStatus());
        assertEquals("active", renewal.getStatus());
        verify(paymentRepository).save(pendingPayment);
        verify(membershipSubscriptionRepository, times(1)).save(renewal);
    }

    /** Kiểm thử: POS với packageId từ chối kỳ tương lai đã thanh toán. */
    @Test
    void posPackageIdRejectsAlreadyPaidFuturePeriod() {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        pack.setPrice(new BigDecimal("1500000.00"));
        MembershipSubscription future = new MembershipSubscription();
        future.setId(10L); future.setMember(member); future.setMembershipPackage(pack);
        future.setStatus("active"); future.setStartDate(java.time.LocalDate.of(2026, 11, 1));
        future.setEndDate(java.time.LocalDate.of(2026, 11, 30));
        PaymentProcessDto dto = new PaymentProcessDto(2L, null, null, pack.getPrice(), "pos", null, null);
        dto.setPackageId(5L);
        var packageRepository = org.mockito.Mockito.mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
        org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", packageRepository);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(packageRepository.findById(5L)).thenReturn(Optional.of(pack));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(future));
        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        verify(paymentRepository, never()).save(any());
        var order = inOrder(memberRepository, membershipSubscriptionRepository);
        order.verify(memberRepository).findByUserIdForUpdate(2L);
        order.verify(membershipSubscriptionRepository).findByMemberUserId(2L);
    }

    /** Kiểm thử: thanh toán gói qua POS từ chối packageId không khớp. */
    @Test
    void posSubscriptionCheckoutRejectsMismatchedPackageId() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        MembershipSubscription pending = new MembershipSubscription();
        pending.setId(10L); pending.setMember(member); pending.setMembershipPackage(pack);
        pending.setStatus("pending_payment");
        PaymentProcessDto dto = new PaymentProcessDto(2L, 10L, null,
                new BigDecimal("1500000.00"), "pos", null, null);
        dto.setPackageId(6L);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(pending));
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(dto));
        verify(paymentRepository, never()).save(any());
    }
    /** Kiểm thử: nâng cấp tính theo tỷ lệ giữ nguyên báo giá sau khi giá đổi. */
    @Test
    @DisplayName("A prorated upgrade paid later keeps its quote: price, credit and start day survive catalog repricing")
    void proratedUpgradeKeepsItsQuoteAfterRepricing() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage basic = new MembershipPackage();
        basic.setId(1L); basic.setPrice(new BigDecimal("199000")); basic.setDurationDays(30); basic.setStatus("active");
        MembershipPackage vip = new MembershipPackage();
        vip.setId(2L); vip.setPrice(new BigDecimal("299000")); vip.setDurationDays(30); vip.setStatus("active");
        MembershipSubscription current = new MembershipSubscription();
        current.setId(10L); current.setMember(member); current.setMembershipPackage(basic); current.setStatus("active");
        current.setStartDate(java.time.LocalDate.of(2026, 9, 15)); current.setEndDate(java.time.LocalDate.of(2026, 10, 14));
        MembershipSubscription upgrade = new MembershipSubscription();
        upgrade.setId(12L); upgrade.setMember(member); upgrade.setMembershipPackage(vip);
        upgrade.setPreviousSubscription(current); upgrade.setStatus("pending_payment");
        // Báo giá ngày 28/09: còn 17/30 ngày của gói đã trả 199.000 -> khấu trừ 112.000, cần trả 187.000.
        upgrade.setStartDate(java.time.LocalDate.of(2026, 9, 28)); upgrade.setEndDate(java.time.LocalDate.of(2026, 10, 27));
        upgrade.setCreditApplied(new BigDecimal("112000")); upgrade.setUpgradeCharge(new BigDecimal("187000"));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(12L)).thenReturn(Optional.of(upgrade));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(current, upgrade));

        // Báo giá đang chờ thanh toán không bị tính lại giá: giá mới tăng trong danh mục bị từ chối tại quầy.
        basic.setPrice(new BigDecimal("249000"));
        vip.setPrice(new BigDecimal("399000"));
        PaymentProcessDto repriced = new PaymentProcessDto(2L, 12L, null, new BigDecimal("399000"), "pos", null, null);
        repriced.setPackageId(2L);
        assertThrows(BadRequestException.class, () -> paymentService.processPayment(repriced));
        assertEquals("pending_payment", upgrade.getStatus());

        // Hội viên thanh toán đúng số tiền đã báo giá vào ngày 01/10.
        PaymentProcessDto dto = new PaymentProcessDto(2L, 12L, null, new BigDecimal("187000"), "pos", null, null);
        dto.setPackageId(2L);
        paymentService.processPayment(dto);

        assertEquals("active", upgrade.getStatus());
        assertEquals(new BigDecimal("187000"), upgrade.payableAmount());
        // Kỳ mới tính từ ngày báo giá; kỳ cũ kết thúc vào ngày đó để các ngày đã khấu trừ không bị dùng hai lần.
        assertEquals(java.time.LocalDate.of(2026, 9, 28), upgrade.getStartDate());
        assertEquals(java.time.LocalDate.of(2026, 10, 27), upgrade.getEndDate());
        assertEquals("expired", current.getStatus());
        assertEquals(java.time.LocalDate.of(2026, 9, 28), current.getEndDate());
        assertEquals(java.time.LocalDate.of(2026, 10, 14), upgrade.getReplacedEndDate());
    }

    /** Kiểm thử: POS không xác nhận nâng cấp khi xuất hiện kỳ gia hạn tương lai đã trả. */
    @Test
    void posCannotConfirmUpgradeWhenPaidFutureRenewalAppears() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage basic = new MembershipPackage();
        basic.setId(1L); basic.setPrice(new BigDecimal("500000"));
        MembershipPackage vip = new MembershipPackage();
        vip.setId(2L); vip.setPrice(new BigDecimal("1500000")); vip.setDurationDays(90);
        MembershipSubscription current = new MembershipSubscription();
        current.setId(10L); current.setMember(member); current.setMembershipPackage(basic);
        current.setStatus("active"); current.setEndDate(java.time.LocalDate.of(2026, 10, 10));
        MembershipSubscription future = new MembershipSubscription();
        future.setId(11L); future.setMember(member); future.setMembershipPackage(basic);
        future.setPreviousSubscription(current); future.setStatus("active");
        future.setStartDate(java.time.LocalDate.of(2026, 10, 11));
        future.setEndDate(java.time.LocalDate.of(2026, 11, 9));
        MembershipSubscription upgrade = new MembershipSubscription();
        upgrade.setId(12L); upgrade.setMember(member); upgrade.setMembershipPackage(vip);
        upgrade.setPreviousSubscription(current); upgrade.setStatus("pending_payment");
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(12L)).thenReturn(Optional.of(upgrade));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(current, future, upgrade));
        PaymentProcessDto dto = new PaymentProcessDto(2L, 12L, null, vip.getPrice(), "pos", null, null);
        dto.setPackageId(2L);

        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        assertEquals("pending_payment", upgrade.getStatus());
        assertEquals("active", current.getStatus());
        assertEquals("active", future.getStatus());
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: POS không kích hoạt gia hạn đang chờ khi gói nguồn đang đóng băng. */
    @Test
    void posCannotActivatePendingRenewalWhileSourceIsFrozen() {
        Member member = new Member(); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L); pack.setPrice(new BigDecimal("500000")); pack.setDurationDays(30);
        MembershipSubscription source = new MembershipSubscription();
        source.setId(10L); source.setMember(member); source.setMembershipPackage(pack);
        source.setStatus("frozen");
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(11L); renewal.setMember(member); renewal.setMembershipPackage(pack);
        renewal.setPreviousSubscription(source); renewal.setStatus("pending_payment");
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(11L)).thenReturn(Optional.of(renewal));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(source, renewal));
        PaymentProcessDto dto = new PaymentProcessDto(2L, 11L, null, pack.getPrice(), "pos", null, null);
        dto.setPackageId(1L);

        assertThrows(ConflictException.class, () -> paymentService.processPayment(dto));
        assertEquals("pending_payment", renewal.getStatus());
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử: POS tất toán đúng số tiền chờ ban đầu sau khi giá danh mục giảm. */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {true, false})
    void posSettlesOriginalPendingAmountAfterCatalogPriceReduction(boolean explicitSubscription) {
        Member member = new Member(); member.setIdentityVerified(true); member.setUserId(2L);
        MembershipPackage pack = new MembershipPackage(); pack.setId(5L);
        pack.setPrice(new BigDecimal("299000")); pack.setDurationDays(30);
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setId(10L); subscription.setMember(member); subscription.setMembershipPackage(pack);
        subscription.setStatus("pending_payment");
        Payment pendingPayment = new Payment(); pendingPayment.setId(11L);
        pendingPayment.setMember(member); pendingPayment.setSubscriptionId(10L);
        pendingPayment.setStatus("pending"); pendingPayment.setAmount(new BigDecimal("2800000"));
        var dto = new PaymentProcessDto(2L, explicitSubscription ? 10L : null, null, pendingPayment.getAmount(), "cash", null, null);
        if (!explicitSubscription) {
            dto.setPackageId(5L);
            var catalog = mock(com.swp391.scms.facilities.repository.MembershipPackageRepository.class);
            org.springframework.test.util.ReflectionTestUtils.setField(paymentService, "membershipPackageRepository", catalog);
            when(catalog.findById(5L)).thenReturn(Optional.of(pack));
            when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(subscription));
        }
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        if (explicitSubscription) when(membershipSubscriptionRepository.findById(10L)).thenReturn(Optional.of(subscription));
        when(paymentRepository.findAllBySubscriptionId(10L)).thenReturn(List.of(pendingPayment));
        when(paymentRepository.save(pendingPayment)).thenReturn(pendingPayment);
        when(paymentMapper.toDto(pendingPayment)).thenReturn(new PaymentDto());
        paymentService.processPayment(dto);
        assertEquals("success", pendingPayment.getStatus());
        assertEquals(new BigDecimal("2800000"), pendingPayment.getAmount());
        assertEquals("active", subscription.getStatus());
        verify(paymentRepository).save(pendingPayment);
    }


    /** Kiểm thử: hoàn tiền một phần giữ membership cho tới khi hoàn đủ. */
    @Test
    @DisplayName("A partial refund keeps the payment successful and the membership running; the rest ends it")
    void partialRefundKeepsMembershipUntilFullyRefunded() {
        Payment payment = new Payment();
        payment.setId(10L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("1500000.00"));
        payment.setSubscriptionId(5L);
        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(5L);
        sub.setStatus("active");
        when(paymentRepository.findById(10L)).thenReturn(Optional.of(payment));

        paymentService.refundPayment(10L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Ốm", new BigDecimal("500000.00")));
        assertEquals("success", payment.getStatus());
        assertEquals(0, new BigDecimal("500000.00").compareTo(payment.getRefundedAmount()));
        assertEquals(0, new BigDecimal("1000000.00").compareTo(payment.netAmount()));
        assertEquals("active", sub.getStatus());
        verify(membershipSubscriptionRepository, never()).findById(5L);

        assertThrows(BadRequestException.class, () -> paymentService.refundPayment(10L,
                new com.swp391.scms.finance.dto.PaymentRefundRequest("Quá số còn lại", new BigDecimal("1000000.01"))));

        when(membershipSubscriptionRepository.findById(5L)).thenReturn(Optional.of(sub));
        paymentService.refundPayment(10L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Chuyển nhà", null));
        assertEquals("refunded", payment.getStatus());
        assertEquals(0, payment.getAmount().compareTo(payment.getRefundedAmount()));
        assertEquals("cancelled", sub.getStatus());
    }

    /** Kiểm thử: hoàn tiền nâng cấp khôi phục kỳ đã bị thay. */
    @Test
    @DisplayName("Refunding an upgrade restores the period it replaced with its original expiry")
    void refundingUpgradeRestoresReplacedPeriod() {
        com.swp391.scms.facilities.entity.MembershipPackage basic = new com.swp391.scms.facilities.entity.MembershipPackage();
        basic.setId(1L);
        com.swp391.scms.facilities.entity.MembershipPackage premium = new com.swp391.scms.facilities.entity.MembershipPackage();
        premium.setId(2L);
        MembershipSubscription previous = new MembershipSubscription();
        previous.setId(4L);
        previous.setMembershipPackage(basic);
        previous.setStartDate(java.time.LocalDate.of(2026, 9, 1));
        previous.setEndDate(java.time.LocalDate.of(2026, 10, 1));
        previous.setStatus("expired");
        MembershipSubscription upgrade = new MembershipSubscription();
        upgrade.setId(5L);
        upgrade.setMembershipPackage(premium);
        upgrade.setPreviousSubscription(previous);
        upgrade.setStartDate(java.time.LocalDate.of(2026, 10, 1));
        upgrade.setReplacedEndDate(java.time.LocalDate.of(2026, 12, 31));
        upgrade.setStatus("active");
        Payment payment = new Payment();
        payment.setId(11L);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("900000.00"));
        payment.setSubscriptionId(5L);
        when(paymentRepository.findById(11L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(5L)).thenReturn(Optional.of(upgrade));

        paymentService.refundPayment(11L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Đổi ý", null));

        assertEquals("cancelled", upgrade.getStatus());
        assertEquals("active", previous.getStatus());
        assertEquals(java.time.LocalDate.of(2026, 12, 31), previous.getEndDate());
    }

    /** Kiểm thử: gia hạn trả muộn vẫn giữ đủ độ dài. */
    @Test
    @DisplayName("A renewal paid after its planned start keeps its full length from the payment day")
    void lateRenewalPaymentKeepsFullLength() {
        com.swp391.scms.facilities.entity.MembershipPackage pkg = new com.swp391.scms.facilities.entity.MembershipPackage();
        pkg.setId(1L);
        pkg.setDurationDays(30);
        Member member = new Member();
        member.setUserId(3L);
        MembershipSubscription previous = new MembershipSubscription();
        previous.setId(6L);
        previous.setMember(member);
        previous.setMembershipPackage(pkg);
        previous.setStatus("expired");
        MembershipSubscription renewal = new MembershipSubscription();
        renewal.setId(7L);
        renewal.setMember(member);
        renewal.setMembershipPackage(pkg);
        renewal.setPreviousSubscription(previous);
        renewal.setStartDate(java.time.LocalDate.of(2026, 9, 20));
        renewal.setEndDate(java.time.LocalDate.of(2026, 10, 19));
        renewal.setStatus("pending_payment");
        Payment payment = new Payment();
        payment.setId(12L);
        payment.setStatus("pending");
        payment.setSubscriptionId(7L);
        when(paymentRepository.findById(12L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(7L)).thenReturn(Optional.of(renewal));
        when(memberRepository.findByUserIdForUpdate(3L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findByMemberUserId(3L)).thenReturn(List.of(previous, renewal));

        paymentService.updatePaymentStatus(12L, "success");

        assertEquals("active", renewal.getStatus());
        assertEquals(java.time.LocalDate.of(2026, 10, 1), renewal.getStartDate());
        assertEquals(java.time.LocalDate.of(2026, 10, 30), renewal.getEndDate());
    }

    /** Kiểm thử: thanh toán ghi danh không bao giờ đổi trạng thái của nó. */
    @Test
    @DisplayName("Paying for an attended enrollment never reopens it; a cancelled one cannot be paid")
    void enrollmentPaymentNeverChangesItsStatus() {
        Payment payment = new Payment();
        payment.setId(13L);
        payment.setStatus("pending");
        payment.setClassEnrollmentId(8L);
        ClassEnrollment attended = new ClassEnrollment();
        attended.setStatus("completed");
        when(paymentRepository.findById(13L)).thenReturn(Optional.of(payment));
        when(classEnrollmentRepository.findById(8L)).thenReturn(Optional.of(attended));

        paymentService.updatePaymentStatus(13L, "success");
        assertEquals("success", payment.getStatus());
        assertEquals("completed", attended.getStatus());

        Payment second = new Payment();
        second.setId(14L);
        second.setStatus("pending");
        second.setClassEnrollmentId(9L);
        ClassEnrollment cancelled = new ClassEnrollment();
        cancelled.setStatus("cancelled");
        when(paymentRepository.findById(14L)).thenReturn(Optional.of(second));
        when(classEnrollmentRepository.findById(9L)).thenReturn(Optional.of(cancelled));
        assertThrows(ConflictException.class, () -> paymentService.updatePaymentStatus(14L, "success"));
        assertEquals("cancelled", cancelled.getStatus());
    }

    /** Kiểm thử: danh sách thanh toán của hội viên chỉ đánh dấu VNPay pending khi còn lần thử chưa hết hạn. */
    @Test
    @DisplayName("getPaymentsByMemberId sets vnpayPending only when a non-stale pending VnpayTransaction exists")
    void getPaymentsByMemberIdMarksVnpayPendingOnlyWhileUnexpiredAttemptExists() {
        var vnpayTxRepo = mock(com.swp391.scms.finance.repository.VnpayTransactionRepository.class);
        paymentService.setVnpayTransactionRepository(vnpayTxRepo);

        Payment activeOnline = new Payment();
        activeOnline.setId(21L);
        activeOnline.setStatus("pending");
        activeOnline.setMethod("online_wallet");
        activeOnline.setSubscriptionId(101L);

        Payment cancelledVnpayOnline = new Payment();
        cancelledVnpayOnline.setId(22L);
        cancelledVnpayOnline.setStatus("pending");
        cancelledVnpayOnline.setMethod("online_wallet");
        cancelledVnpayOnline.setSubscriptionId(102L);

        PaymentDto dtoActive = new PaymentDto();
        dtoActive.setId(21L);
        dtoActive.setStatus("pending");
        dtoActive.setMethod("online_wallet");

        PaymentDto dtoClosed = new PaymentDto();
        dtoClosed.setId(22L);
        dtoClosed.setStatus("pending");
        dtoClosed.setMethod("online_wallet");

        // clock là 2026-10-01T10:00:00Z -> 17:00 theo múi giờ Asia/Ho_Chi_Minh
        var liveAttempt = new com.swp391.scms.finance.entity.VnpayTransaction(
                "LIVE1", activeOnline, BigDecimal.TEN,
                LocalDateTime.of(2026, 10, 1, 16, 55), LocalDateTime.of(2026, 10, 1, 17, 10), "127.0.0.1");
        var closedAttempt = new com.swp391.scms.finance.entity.VnpayTransaction(
                "CLOSED1", cancelledVnpayOnline, BigDecimal.TEN,
                LocalDateTime.of(2026, 10, 1, 16, 55), LocalDateTime.of(2026, 10, 1, 17, 10), "127.0.0.1");
        closedAttempt.setStatus("failed");

        when(memberRepository.existsById(2L)).thenReturn(true);
        when(paymentRepository.findByMemberUserId(2L)).thenReturn(List.of(activeOnline, cancelledVnpayOnline));
        when(paymentMapper.toDtoList(List.of(activeOnline, cancelledVnpayOnline))).thenReturn(List.of(dtoActive, dtoClosed));
        when(vnpayTxRepo.findAllByPaymentId(21L)).thenReturn(List.of(liveAttempt));
        when(vnpayTxRepo.findAllByPaymentId(22L)).thenReturn(List.of(closedAttempt));

        List<PaymentDto> result = paymentService.getPaymentsByMemberId(2L);
        assertEquals(2, result.size());
        assertTrue(result.get(0).isVnpayPending());
        assertFalse(result.get(1).isVnpayPending());
    }

    /** Kiểm thử: nhân viên không tất toán được thanh toán HLV, đơn hàng hay nạp ví theo trạng thái. */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"coach", "order", "topup"})
    void staffCannotSettleCoachOrderOrTopupPaymentsByStatus(String kind) {
        Payment payment = new Payment(); payment.setId(91L); payment.setStatus("pending");
        switch (kind) {
            case "coach" -> payment.setCoachBookingId(1L);
            case "order" -> payment.setProductOrderId(1L);
            default -> payment.setNote("WALLET_TOPUP:COUNTER");
        }
        when(paymentRepository.findById(91L)).thenReturn(Optional.of(payment));
        assertThrows(BadRequestException.class, () -> paymentService.updatePaymentStatusByStaff(91L, "success"));
        assertEquals("pending", payment.getStatus());
    }

    @Test
    void createPaymentAndProcessPaymentRejectDualTargets() {
        PaymentCreateDto dualCreate = new PaymentCreateDto();
        dualCreate.setMemberId(2L);
        dualCreate.setSubscriptionId(10L);
        dualCreate.setClassEnrollmentId(20L);
        dualCreate.setAmount(new BigDecimal("500000"));
        dualCreate.setMethod("online_wallet");

        BadRequestException staffCreateEx = assertThrows(BadRequestException.class,
                () -> paymentService.createPayment(dualCreate));
        assertEquals("PAYMENT_MULTIPLE_TARGETS", staffCreateEx.getErrorCode());

        var memberPrincipal = new com.swp391.scms.security.AuthenticatedPrincipal(2L, "m", "MEMBER");
        BadRequestException memberCreateEx = assertThrows(BadRequestException.class,
                () -> paymentService.createPayment(memberPrincipal, dualCreate));
        assertEquals("PAYMENT_MULTIPLE_TARGETS", memberCreateEx.getErrorCode());

        PaymentProcessDto dualPkgEnroll = new PaymentProcessDto(2L, null, 20L, new BigDecimal("500000"), "cash", null, null);
        dualPkgEnroll.setPackageId(5L);
        BadRequestException processEx = assertThrows(BadRequestException.class,
                () -> paymentService.processPayment(dualPkgEnroll));
        assertEquals("PAYMENT_MULTIPLE_TARGETS", processEx.getErrorCode());
        verify(paymentRepository, never()).save(any());
    }

    @Test
    void createPaymentForClassEnrollmentValidatesDiscountedFeeAndBlocksDuplicates() {
        Member member = new Member(); member.setUserId(2L);
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setId(50L); gymClass.setPrice(new BigDecimal("1000000"));
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(20L); enrollment.setMember(member); enrollment.setGymClass(gymClass); enrollment.setStatus("booked");

        var discounts = mock(com.swp391.scms.membership.service.MemberDiscountService.class);
        when(discounts.percentFor(2L)).thenReturn(10); // Gold 10% -> học phí thực thu 900.000
        paymentService.setMemberDiscounts(discounts);

        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(classEnrollmentRepository.findById(20L)).thenReturn(Optional.of(enrollment));
        when(paymentRepository.findAllByClassEnrollmentId(20L)).thenReturn(List.of());

        // Số tiền tùy ý (1đ) bị từ chối với 400 PAYMENT_AMOUNT_MISMATCH
        PaymentCreateDto arbitrary = new PaymentCreateDto();
        arbitrary.setMemberId(2L); arbitrary.setClassEnrollmentId(20L);
        arbitrary.setAmount(new BigDecimal("1")); arbitrary.setMethod("online_wallet");
        BadRequestException wrongAmount = assertThrows(BadRequestException.class,
                () -> paymentService.createPayment(arbitrary));
        assertEquals("PAYMENT_AMOUNT_MISMATCH", wrongAmount.getErrorCode());
        verify(paymentRepository, never()).save(any());

        // Đúng học phí sau giảm (900.000) khi chưa có khoản thu nào -> tạo thành công
        PaymentCreateDto exact = new PaymentCreateDto();
        exact.setMemberId(2L); exact.setClassEnrollmentId(20L);
        exact.setAmount(new BigDecimal("900000")); exact.setMethod("online_wallet");
        Payment entity = new Payment(); entity.setClassEnrollmentId(20L); entity.setAmount(new BigDecimal("900000"));
        when(paymentMapper.toEntity(exact)).thenReturn(entity);
        when(paymentRepository.save(entity)).thenReturn(entity);
        when(paymentMapper.toDto(entity)).thenReturn(new PaymentDto());
        assertNotNull(paymentService.createPayment(exact));
        verify(paymentRepository, times(1)).save(entity);

        // Nếu khóa học đã có khoản thanh toán pending -> từ chối tạo bản thứ 2 (409)
        Payment existingPending = new Payment();
        existingPending.setId(77L); existingPending.setMember(member);
        existingPending.setClassEnrollmentId(20L); existingPending.setStatus("pending");
        existingPending.setAmount(new BigDecimal("900000"));
        when(paymentRepository.findAllByClassEnrollmentId(20L)).thenReturn(List.of(existingPending));
        ConflictException duplicate = assertThrows(ConflictException.class,
                () -> paymentService.createPayment(exact));
        assertEquals("PAYMENT_ALREADY_EXISTS", duplicate.getErrorCode());
        verify(paymentRepository, times(1)).save(any());
    }

    @Test
    void processPaymentForClassEnrollmentSettlesPendingAndRejectsDuplicateOrWrongAmount() {
        Member member = new Member(); member.setUserId(2L);
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setId(50L); gymClass.setPrice(new BigDecimal("800000"));
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(20L); enrollment.setMember(member); enrollment.setGymClass(gymClass); enrollment.setStatus("booked");

        Payment pending = new Payment();
        pending.setId(88L); pending.setMember(member); pending.setClassEnrollmentId(20L);
        pending.setStatus("pending"); pending.setAmount(new BigDecimal("800000"));

        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(classEnrollmentRepository.findById(20L)).thenReturn(Optional.of(enrollment));
        when(paymentRepository.findAllByClassEnrollmentId(20L)).thenReturn(List.of(pending));

        // Sai số tiền bị từ chối
        PaymentProcessDto wrong = new PaymentProcessDto(2L, null, 20L, new BigDecimal("100"), "cash", null, null);
        BadRequestException badAmt = assertThrows(BadRequestException.class, () -> paymentService.processPayment(wrong));
        assertEquals("PAYMENT_AMOUNT_MISMATCH", badAmt.getErrorCode());

        // Đúng số tiền -> tất toán khoản pending hiện có mà không tạo bản ghi thứ 2
        when(paymentRepository.save(pending)).thenReturn(pending);
        when(paymentMapper.toDto(pending)).thenReturn(new PaymentDto());
        PaymentProcessDto exact = new PaymentProcessDto(2L, null, 20L, new BigDecimal("800000"), "cash", null, "Thu học phí");
        paymentService.processPayment(exact);
        assertEquals("success", pending.getStatus());
        verify(paymentRepository, times(1)).save(pending);

        // Đã thanh toán thành công -> gọi lại bị từ chối 409 PAYMENT_ALREADY_EXISTS
        ConflictException alreadyPaid = assertThrows(ConflictException.class, () -> paymentService.processPayment(exact));
        assertEquals("PAYMENT_ALREADY_EXISTS", alreadyPaid.getErrorCode());
        verify(paymentRepository, times(1)).save(any());
    }

    /** Kiểm thử P1-BE-29: hoàn tiền khóa Member trước và chặn hoàn tiền gói cũ đã có kỳ nâng cấp/kế tiếp đang hoạt động hoặc chờ thanh toán. */
    @Test
    void refundPaymentLocksMemberAndRejectsSupersededSubscription() {
        Member member = new Member();
        member.setUserId(2L);
        Payment payment = new Payment();
        payment.setId(50L);
        payment.setMember(member);
        payment.setStatus("success");
        payment.setAmount(new BigDecimal("1000000"));
        payment.setSubscriptionId(10L);

        when(paymentRepository.findById(50L)).thenReturn(Optional.of(payment));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.existsByPreviousSubscriptionIdAndStatusIn(
                eq(10L), any())).thenReturn(true);

        ConflictException ex = assertThrows(ConflictException.class, () -> paymentService.refundPayment(
                50L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Muốn hoàn tiền gói cũ", null)));
        assertEquals("PAYMENT_SUBSCRIPTION_SUPERSEDED", ex.getErrorCode());
        assertEquals("success", payment.getStatus());
        verify(memberRepository).findByUserIdForUpdate(2L);
        verify(paymentRepository, never()).save(any());
    }

    /** Kiểm thử P1-BE-31: updatePaymentStatus kiểm tra khóa VNPay ở cả payment và subscription. */
    @Test
    void updatePaymentStatusGuardsBothPaymentAndSubscription() {
        var guard = mock(com.swp391.scms.finance.service.VnpayPaymentGuard.class);
        PaymentService guardedService = new PaymentService(paymentRepository, memberRepository, userRepository,
                membershipSubscriptionRepository, classEnrollmentRepository, paymentMapper, clock, guard);

        Member member = new Member(); member.setUserId(2L);
        MembershipSubscription sub = new MembershipSubscription(); sub.setId(77L); sub.setMember(member); sub.setStatus("pending_payment");
        Payment payment = new Payment();
        payment.setId(60L);
        payment.setMember(member);
        payment.setStatus("pending");
        payment.setMethod("cash");
        payment.setSubscriptionId(77L);
        when(paymentRepository.findById(60L)).thenReturn(Optional.of(payment));
        when(paymentRepository.findByIdForUpdate(60L)).thenReturn(Optional.of(payment));
        when(membershipSubscriptionRepository.findById(77L)).thenReturn(Optional.of(sub));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(paymentMapper.toDto(payment)).thenReturn(new PaymentDto());

        guardedService.updatePaymentStatus(60L, "failed");

        verify(guard).payment(60L);
        verify(guard).subscription(77L);
    }

    /** Kiểm thử P1-BE-32: chặn hoàn tiền WALLET_TOPUP, chặn hoàn một phần PT/đơn hàng, và cộng tiền lại Ví SÖL idempotent khi hoàn online_wallet. */
    @Test
    void refundPaymentRejectsTopupBlocksPartialCoachOrOrderRefundAndCreditsWalletForOnlinePayment() {
        Member member = new Member();
        member.setUserId(2L);
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));

        // 1. WALLET_TOPUP bị chặn hoàn trực tiếp
        Payment topup = new Payment();
        topup.setId(61L); topup.setMember(member); topup.setStatus("success");
        topup.setAmount(new BigDecimal("500000")); topup.setNote("WALLET_TOPUP");
        when(paymentRepository.findById(61L)).thenReturn(Optional.of(topup));
        BadRequestException topupEx = assertThrows(BadRequestException.class, () -> paymentService.refundPayment(
                61L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Hoàn nạp ví", null)));
        assertEquals("CANNOT_REFUND_WALLET_TOPUP", topupEx.getErrorCode());

        // 2. Hoàn MỘT PHẦN cho PT booking và product order cũng bị chặn (không chỉ hoàn toàn phần)
        Payment ptPayment = new Payment();
        ptPayment.setId(62L); ptPayment.setMember(member); ptPayment.setStatus("success");
        ptPayment.setAmount(new BigDecimal("200000")); ptPayment.setCoachBookingId(9L);
        when(paymentRepository.findById(62L)).thenReturn(Optional.of(ptPayment));
        BadRequestException ptEx = assertThrows(BadRequestException.class, () -> paymentService.refundPayment(
                62L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Hoàn 1 phần PT", new BigDecimal("50000"))));
        assertEquals("REFUND_VIA_CANCELLATION", ptEx.getErrorCode());

        Payment orderPayment = new Payment();
        orderPayment.setId(63L); orderPayment.setMember(member); orderPayment.setStatus("success");
        orderPayment.setAmount(new BigDecimal("400000")); orderPayment.setProductOrderId(15L);
        when(paymentRepository.findById(63L)).thenReturn(Optional.of(orderPayment));
        BadRequestException orderEx = assertThrows(BadRequestException.class, () -> paymentService.refundPayment(
                63L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Hoàn 1 phần đơn", new BigDecimal("100000"))));
        assertEquals("REFUND_VIA_CANCELLATION", orderEx.getErrorCode());

        // 3. Hoàn online_wallet cộng tiền lại vào Ví SÖL với mã idempotent gắn theo paymentId và tổng số tiền hoàn
        var walletService = mock(com.swp391.scms.wallet.WalletService.class);
        paymentService.setWalletService(walletService);
        Payment onlineSub = new Payment();
        onlineSub.setId(64L); onlineSub.setMember(member); onlineSub.setStatus("success");
        onlineSub.setMethod("online_wallet"); onlineSub.setAmount(new BigDecimal("1000000")); onlineSub.setSubscriptionId(12L);
        when(paymentRepository.findById(64L)).thenReturn(Optional.of(onlineSub));
        when(membershipSubscriptionRepository.existsByPreviousSubscriptionIdAndStatusIn(eq(12L), any())).thenReturn(false);

        paymentService.refundPayment(64L, new com.swp391.scms.finance.dto.PaymentRefundRequest("Hoàn một phần", new BigDecimal("300000")));
        verify(walletService).creditPaymentRefund(2L, new BigDecimal("300000"), "PAYMENT_REFUND_64_300000", "Hoàn một phần");
    }

    /** Kiểm thử P2-BE-39: suy ra receivedBy từ @AuthenticationPrincipal (bỏ qua receivedById giả mạo), khóa dòng payment và chặn xác nhận thủ công online_wallet. */
    @Test
    void staffOperationsDeriveReceivedByFromPrincipalLockRowAndBlockOnlineManualConfirmation() {
        var staffPrincipal = new com.swp391.scms.security.AuthenticatedPrincipal(42L, "desk01", "RECEPTIONIST");
        User deskUser = new User(); deskUser.setId(42L);
        Member member = new Member(); member.setUserId(2L); member.setIdentityVerified(true);

        when(userRepository.findByIdAndDeletedAtIsNull(42L)).thenReturn(Optional.of(deskUser));
        when(memberRepository.findById(2L)).thenReturn(Optional.of(member));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));

        // 1. createPayment bỏ qua receivedById client gửi lên (999L) và dùng principal.id() (42L)
        PaymentCreateDto createDto = new PaymentCreateDto();
        createDto.setMemberId(2L);
        createDto.setAmount(new BigDecimal("100000"));
        createDto.setMethod("cash");
        createDto.setStatus("pending");
        createDto.setReceivedById(999L);
        Payment mapped = new Payment(); mapped.setAmount(new BigDecimal("100000")); mapped.setMethod("cash"); mapped.setStatus("pending");
        when(paymentMapper.toEntity(createDto)).thenReturn(mapped);
        when(paymentRepository.save(mapped)).thenReturn(mapped);
        when(paymentMapper.toDto(mapped)).thenReturn(new PaymentDto());

        paymentService.createPayment(staffPrincipal, createDto);
        assertSame(deskUser, mapped.getReceivedBy());
        verify(userRepository, never()).findByIdAndDeletedAtIsNull(999L);

        // 2. processPayment cũng bỏ qua receivedById giả mạo (999L)
        com.swp391.scms.scheduling.entity.GymClass gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setPrice(new BigDecimal("500000"));
        ClassEnrollment enrollment = new ClassEnrollment();
        enrollment.setId(30L); enrollment.setMember(member); enrollment.setGymClass(gymClass); enrollment.setStatus("booked");
        when(classEnrollmentRepository.findById(30L)).thenReturn(Optional.of(enrollment));
        when(paymentRepository.findAllByClassEnrollmentId(30L)).thenReturn(List.of());
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentMapper.toDto(any(Payment.class))).thenReturn(new PaymentDto());

        PaymentProcessDto processDto = new PaymentProcessDto(2L, null, 30L, new BigDecimal("500000"), "cash", 999L, "Thu tại quầy");
        paymentService.processPayment(staffPrincipal, processDto);
        verify(paymentRepository, atLeastOnce()).save(argThat(p -> p.getClassEnrollmentId() != null && deskUser.equals(p.getReceivedBy())));
        verify(userRepository, never()).findByIdAndDeletedAtIsNull(999L);

        // 3. updatePaymentStatusByStaff khóa dòng payment, chặn xác nhận thủ công online_wallet và gán receivedBy cho cash
        Payment onlinePending = new Payment();
        onlinePending.setId(71L); onlinePending.setStatus("pending"); onlinePending.setMethod("online_wallet");
        when(paymentRepository.findById(71L)).thenReturn(Optional.of(onlinePending));
        when(paymentRepository.findByIdForUpdate(71L)).thenReturn(Optional.of(onlinePending));

        BadRequestException onlineEx = assertThrows(BadRequestException.class,
                () -> paymentService.updatePaymentStatusByStaff(staffPrincipal, 71L, "success"));
        assertEquals("PAYMENT_ONLINE_MANUAL_CONFIRM_FORBIDDEN", onlineEx.getErrorCode());
        verify(paymentRepository).findByIdForUpdate(71L);

        Payment cashPending = new Payment();
        cashPending.setId(72L); cashPending.setStatus("pending"); cashPending.setMethod("cash");
        when(paymentRepository.findById(72L)).thenReturn(Optional.of(cashPending));
        when(paymentRepository.findByIdForUpdate(72L)).thenReturn(Optional.of(cashPending));

        paymentService.updatePaymentStatusByStaff(staffPrincipal, 72L, "success");
        assertEquals("success", cashPending.getStatus());
        assertSame(deskUser, cashPending.getReceivedBy());
    }

    /** Kiểm thử P2-BE-41: từ chối kích hoạt nâng cấp cũ quá hạn (endDate < today) hoặc có creditApplied vượt quá giá trị đã trả của gói cũ. */
    @Test
    void activateSubscriptionRejectsStaleExpiredUpgradeAndExcessiveCredit() {
        var calc = mock(com.swp391.scms.membership.service.SubscriptionValueCalculator.class);
        paymentService.setValueCalculator(calc);

        Member member = new Member(); member.setUserId(2L); member.setIdentityVerified(true);
        MembershipPackage basic = new MembershipPackage(); basic.setId(1L); basic.setDurationDays(30); basic.setPrice(new BigDecimal("500000"));
        MembershipPackage vip = new MembershipPackage(); vip.setId(2L); vip.setDurationDays(30); vip.setPrice(new BigDecimal("1000000"));

        // 1. Nâng cấp prorated đã quá hạn (endDate trước ngày hiện tại 2026-10-01)
        MembershipSubscription previous = new MembershipSubscription();
        previous.setId(80L); previous.setMember(member); previous.setMembershipPackage(basic);
        previous.setStatus("active"); previous.setStartDate(java.time.LocalDate.of(2026, 8, 1));
        previous.setEndDate(java.time.LocalDate.of(2026, 8, 30));

        MembershipSubscription staleUpgrade = new MembershipSubscription();
        staleUpgrade.setId(81L); staleUpgrade.setMember(member); staleUpgrade.setMembershipPackage(vip);
        staleUpgrade.setPreviousSubscription(previous); staleUpgrade.setStatus("pending_payment");
        staleUpgrade.setStartDate(java.time.LocalDate.of(2026, 8, 15));
        staleUpgrade.setEndDate(java.time.LocalDate.of(2026, 9, 13));
        staleUpgrade.setCreditApplied(new BigDecimal("100000"));

        Payment p1 = new Payment(); p1.setId(801L); p1.setMember(member); p1.setSubscriptionId(81L); p1.setStatus("pending");
        when(paymentRepository.findById(801L)).thenReturn(Optional.of(p1));
        when(paymentRepository.findByIdForUpdate(801L)).thenReturn(Optional.of(p1));
        when(memberRepository.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(membershipSubscriptionRepository.findById(81L)).thenReturn(Optional.of(staleUpgrade));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(previous, staleUpgrade));

        ConflictException expiredEx = assertThrows(ConflictException.class, () -> paymentService.updatePaymentStatus(801L, "success"));
        assertEquals("PAYMENT_UPGRADE_EXPIRED", expiredEx.getErrorCode());
        assertEquals("active", previous.getStatus());
        assertEquals("pending_payment", staleUpgrade.getStatus());

        // 2. creditApplied lớn hơn paidValue(previous) -> bị chặn trước khi thay đổi trạng thái gói cũ
        previous.setEndDate(java.time.LocalDate.of(2026, 10, 20));
        MembershipSubscription overCredit = new MembershipSubscription();
        overCredit.setId(82L); overCredit.setMember(member); overCredit.setMembershipPackage(vip);
        overCredit.setPreviousSubscription(previous); overCredit.setStatus("pending_payment");
        overCredit.setStartDate(java.time.LocalDate.of(2026, 10, 1));
        overCredit.setEndDate(java.time.LocalDate.of(2026, 10, 30));
        overCredit.setCreditApplied(new BigDecimal("600000"));

        Payment p2 = new Payment(); p2.setId(802L); p2.setMember(member); p2.setSubscriptionId(82L); p2.setStatus("pending");
        when(paymentRepository.findById(802L)).thenReturn(Optional.of(p2));
        when(paymentRepository.findByIdForUpdate(802L)).thenReturn(Optional.of(p2));
        when(membershipSubscriptionRepository.findById(82L)).thenReturn(Optional.of(overCredit));
        when(membershipSubscriptionRepository.findByMemberUserId(2L)).thenReturn(List.of(previous, overCredit));
        when(calc.paidValue(previous)).thenReturn(new BigDecimal("500000"));

        ConflictException creditEx = assertThrows(ConflictException.class, () -> paymentService.updatePaymentStatus(802L, "success"));
        assertEquals("PAYMENT_UPGRADE_CREDIT_INVALID", creditEx.getErrorCode());
        assertEquals("active", previous.getStatus());
        assertEquals("pending_payment", overCredit.getStatus());
    }
}
