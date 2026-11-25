package com.swp391.scms.finance;

import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.finance.dto.PaymentDto;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.mapper.PaymentMapper;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.finance.service.PaymentService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.security.*;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.facilities.entity.MembershipPackage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Kiểm thử kết hợp chuỗi filter bảo mật thật, method security và PaymentService. */
@WebMvcTest(PaymentController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class, PaymentService.class})
/** Bộ kiểm thử cho PaymentMemberAccess (payment member access). */
class PaymentMemberAccessTest {
    @Autowired MockMvc mvc;
    @MockitoBean com.swp391.scms.finance.service.VnpayPaymentGuard vnpayGuard;
    @MockitoBean PaymentRepository payments;
    @MockitoBean MemberRepository members;
    @MockitoBean UserRepository users;
    @MockitoBean MembershipSubscriptionRepository subscriptions;
    @MockitoBean ClassEnrollmentRepository enrollments;
    // PaymentService dùng repository trial thật trong context; slice test phải khai báo mock tương ứng.
    @MockitoBean com.swp391.scms.membership.repository.MemberTrialRedemptionRepository trials;
    @MockitoBean PaymentMapper mapper;
    @MockitoBean JwtService jwt;
    @MockitoBean MessageService messages;
    @MockitoBean Clock clock;

    /** Hàm trợ giúp của test: tạo dữ liệu mẫu/giả lập (actor). */
    private static UsernamePasswordAuthenticationToken actor(String role) {
        return new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(2L, "review-member", role),
                null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
    }

    /** Chuẩn bị trước mỗi test: dựng MockMvc và dữ liệu cho test quyền truy cập thanh toán của hội viên. */
    @BeforeEach
    void setup() {
        when(clock.instant()).thenReturn(Instant.parse("2026-10-15T10:00:00Z"));
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    /** Kiểm thử: hội viên chỉ đọc được lịch sử của chính mình. */
    @Test
    void memberReadsOnlyOwnHistory() throws Exception {
        when(members.existsById(2L)).thenReturn(true);
        when(payments.findByMemberUserId(2L)).thenReturn(List.of());
        when(mapper.toDtoList(List.of())).thenReturn(List.of());
        mvc.perform(get("/api/v1/payments/my").with(authentication(actor("MEMBER"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        verify(payments).findByMemberUserId(2L);
        verifyNoMoreInteractions(payments);
    }

    /** Kiểm thử: hội viên tạo thanh toán pending của mình mà không kích hoạt subscription. */
    @Test
    void memberCreatesOwnPendingPaymentWithoutActivatingSubscription() throws Exception {
        Member member = new Member();
        member.setUserId(2L);
        // Các ca thu tiền hợp lệ dùng hội viên đã KYC; ca từ chối sẽ ghi đè trạng thái này.
        member.setIdentityVerified(true);
        member.setKycStatus("APPROVED");
        MembershipPackage membershipPackage = new MembershipPackage();
        membershipPackage.setPrice(new BigDecimal("500000"));
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setId(10L);
        subscription.setStatus("pending_payment");
        when(members.findById(2L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(subscriptions.findById(10L)).thenReturn(Optional.of(subscription));
        Payment saved = new Payment();
        when(mapper.toEntity(any())).thenReturn(saved);
        when(payments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDto(any())).thenReturn(new PaymentDto());
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isCreated());
        org.junit.jupiter.api.Assertions.assertEquals("pending", saved.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(saved.getPaidAt());
        org.junit.jupiter.api.Assertions.assertEquals("pending_payment", subscription.getStatus());
        verify(subscriptions, never()).save(any());
    }

    /** Hàm trợ giúp của test: tạo subscription đang chờ. */
    private MembershipSubscription pendingSubscription() {
        Member member = new Member();
        member.setUserId(2L);
        // Các ca thu tiền hợp lệ dùng hội viên đã KYC; ca từ chối sẽ ghi đè trạng thái này.
        member.setIdentityVerified(true);
        member.setKycStatus("APPROVED");
        MembershipPackage membershipPackage = new MembershipPackage();
        membershipPackage.setPrice(new BigDecimal("500000"));
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(membershipPackage);
        subscription.setId(10L);
        subscription.setStatus("pending_payment");
        when(members.findById(2L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(subscriptions.findById(10L)).thenReturn(Optional.of(subscription));
        return subscription;
    }

    /** Kiểm thử: thanh toán tiền mặt của hội viên bắt buộc có ảnh biên nhận. */
    @Test
    void memberCashPaymentRequiresReceiptPhoto() throws Exception {
        pendingSubscription();
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"cash"}
                                """))
                .andExpect(status().isBadRequest());
        verify(payments, never()).save(any());
    }

    /** Kiểm thử: thanh toán tiền mặt từ chối biên nhận không phải ảnh. */
    @Test
    void memberCashPaymentRejectsNonImageReceipt() throws Exception {
        pendingSubscription();
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"cash",
                                 "receiptImage":"data:text/html;base64,PHNjcmlwdD4="}
                                """))
                .andExpect(status().isBadRequest());
        verify(payments, never()).save(any());
    }

    /** Kiểm thử: thanh toán tiền mặt có biên nhận ở trạng thái pending. */
    @Test
    void memberCashPaymentWithReceiptStaysPending() throws Exception {
        pendingSubscription();
        Payment saved = new Payment();
        when(mapper.toEntity(any())).thenReturn(saved);
        when(payments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDto(any())).thenReturn(new PaymentDto());
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"cash",
                                 "receiptImage":"data:image/jpeg;base64,/9j/4AAQ"}
                                """))
                .andExpect(status().isCreated());
        org.junit.jupiter.api.Assertions.assertEquals("pending", saved.getStatus());
    }

    /** Không tạo khoản thu khi chưa KYC hoặc chỉ có cờ verified nhưng hồ sơ đang chờ/bị từ chối. */
    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"PENDING", "REJECTED"})
    void memberWithoutApprovedKycCannotCreateNewPackagePayment(String kycStatus) throws Exception {
        MembershipSubscription subscription = pendingSubscription();
        subscription.getMember().setIdentityVerified(kycStatus != null);
        subscription.getMember().setKycStatus(kycStatus);
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PENDING".equals(kycStatus)
                        ? "MEMBERSHIP_KYC_PENDING" : "MEMBERSHIP_KYC_REQUIRED"));
        verify(payments, never()).save(any());
        verify(subscriptions, never()).save(any());
        verify(mapper, never()).toEntity(any());
    }

    /** Trial đã duyệt giữ ngoại lệ hiện có, nhưng tạo payment không được kích hoạt gói ngay. */
    @Test
    void approvedTrialCanCreatePendingPaymentWithHistoricalPendingKyc() throws Exception {
        MembershipSubscription subscription = pendingSubscription();
        subscription.getMember().setIdentityVerified(false);
        subscription.getMember().setKycStatus("PENDING");
        var trial = new com.swp391.scms.membership.entity.MemberTrialRedemption();
        trial.setStatus("APPROVED");
        when(trials.findByMemberUserId(2L)).thenReturn(Optional.of(trial));
        Payment saved = new Payment();
        when(mapper.toEntity(any())).thenReturn(saved);
        when(payments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDto(any())).thenReturn(new PaymentDto());
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isCreated());
        org.junit.jupiter.api.Assertions.assertEquals("pending", saved.getStatus());
        org.junit.jupiter.api.Assertions.assertNull(saved.getPaidAt());
        org.junit.jupiter.api.Assertions.assertEquals("pending_payment", subscription.getStatus());
        org.junit.jupiter.api.Assertions.assertEquals("PENDING", subscription.getMember().getKycStatus());
        verify(subscriptions, never()).save(any());
    }

    /** Kiểm thử: hội viên không tạo được thanh toán cho người khác. */
    @Test
    void memberCannotCreatePaymentForAnotherMember() throws Exception {
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":3,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isForbidden());
        verifyNoInteractions(payments);
    }

    /** Kiểm thử: hội viên không giả mạo được thanh toán thành công hay thu ngân. */
    @Test
    void memberCannotForgeSuccessfulPaymentOrCashier() throws Exception {
        for (String extra : List.of(
                ",\"status\":\"success\"", ",\"receivedById\":1", ",\"paidAt\":\"2026-10-15T10:00:00\"")) {
            mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"memberId\":2,\"subscriptionId\":10,\"amount\":500000,\"method\":\"online_wallet\"" + extra + "}"))
                    .andExpect(status().isForbidden());
        }
        verifyNoInteractions(payments);
    }

    /** Kiểm thử: hội viên không gắn được subscription của người khác. */
    @Test
    void memberCannotAttachAnotherMembersSubscription() throws Exception {
        Member owner = new Member();
        owner.setUserId(3L);
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(owner);
        when(subscriptions.findById(10L)).thenReturn(Optional.of(subscription));
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isForbidden());
        verifyNoInteractions(payments);
    }

    /** Kiểm thử: hội viên không xác nhận, hoàn tiền, đổi trạng thái hay đọc thanh toán tùy ý. */
    @Test
    void memberCannotConfirmRefundChangeStatusOrReadArbitraryPayment() throws Exception {
        mvc.perform(post("/api/v1/payments/process").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/payments/99").with(authentication(actor("MEMBER"))))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/payments/99/status").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"success\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/payments/99/refund").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"test\",\"amount\":500000}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(payments);
    }

    @Test
    void memberCannotSubmitDualTargetOrArbitraryAmountClassEnrollmentPayment() throws Exception {
        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"subscriptionId":10,"classEnrollmentId":20,"amount":500000,"method":"online_wallet"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_MULTIPLE_TARGETS"));

        Member member = new Member(); member.setUserId(2L);
        var gymClass = new com.swp391.scms.scheduling.entity.GymClass();
        gymClass.setId(50L); gymClass.setPrice(new BigDecimal("600000"));
        var enrollment = new com.swp391.scms.scheduling.entity.ClassEnrollment();
        enrollment.setId(20L); enrollment.setMember(member); enrollment.setGymClass(gymClass); enrollment.setStatus("booked");
        when(enrollments.findById(20L)).thenReturn(Optional.of(enrollment));

        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"classEnrollmentId":20,"amount":1,"method":"online_wallet"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_AMOUNT_MISMATCH"));

        Payment existing = new Payment();
        existing.setId(55L); existing.setMember(member); existing.setClassEnrollmentId(20L);
        existing.setStatus("pending"); existing.setAmount(new BigDecimal("600000"));
        when(members.findById(2L)).thenReturn(Optional.of(member));
        when(members.findByUserIdForUpdate(2L)).thenReturn(Optional.of(member));
        when(payments.findAllByClassEnrollmentId(20L)).thenReturn(List.of(existing));

        mvc.perform(post("/api/v1/payments").with(authentication(actor("MEMBER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"memberId":2,"classEnrollmentId":20,"amount":600000,"method":"online_wallet"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAYMENT_ALREADY_EXISTS"));
        verify(payments, never()).save(any());
    }
}
