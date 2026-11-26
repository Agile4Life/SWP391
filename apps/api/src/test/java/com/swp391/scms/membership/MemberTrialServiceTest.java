package com.swp391.scms.membership;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.ReceptionTrialDto;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.dto.TrialClaimRequest;
import com.swp391.scms.membership.dto.TrialStatusDto;
import com.swp391.scms.membership.entity.MemberTrialRedemption;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MemberTrialRedemptionRepository;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.CccdHasher;
import com.swp391.scms.membership.service.MemberTrialService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
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
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Bộ kiểm thử cho service MemberTrialService (member trial service). */
@ExtendWith(MockitoExtension.class)
class MemberTrialServiceTest {

    @Mock
    private MemberTrialRedemptionRepository trialRedemptions;

    @Mock
    private MemberRepository members;

    @Mock
    private MembershipSubscriptionRepository subscriptions;

    @Mock
    private MembershipPackageRepository packages;

    @Mock
    private NotificationService notifications;

    private final CccdHasher hasher = new CccdHasher("test-pepper");
    private final com.swp391.scms.users.KycCrypto kycCrypto = new com.swp391.scms.users.KycCrypto("test-kyc-secret-key-for-unit-test");
    private MemberTrialService service;
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-03T10:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));

    private Member testMember;
    private MembershipPackage goldPackage;

    /** Chuẩn bị trước mỗi test: tạo MemberTrialService với repository giả lập. */
    @BeforeEach
    void setUp() {
        service = new MemberTrialService(
                trialRedemptions,
                members,
                subscriptions,
                packages,
                notifications,
                null,
                clock,
                hasher,
                kycCrypto
        );

        User user = new User();
        user.setFullName("Nguyen Van A");
        user.setEmail("nguyenvana@gmail.com");

        testMember = new Member();
        testMember.setUserId(10L);
        testMember.setUser(user);
        testMember.setMembershipCode("MEM-10");

        goldPackage = new MembershipPackage();
        goldPackage.setId(2L);
        goldPackage.setName("GOLD");
        goldPackage.setPrice(new BigDecimal("299000"));
        goldPackage.setDurationDays(30);
    }

    /** Kiểm thử: trạng thái dùng thử khi đủ điều kiện. */
    @Test
    @DisplayName("getTrialStatus: Eligible when never claimed and never held a subscription")
    void testGetTrialStatus_Eligible() {
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(subscriptions.existsByMemberUserId(10L))
                .thenReturn(false);

        TrialStatusDto status = service.getTrialStatus(10L);

        assertTrue(status.eligible());
        assertFalse(status.alreadyClaimed());
        assertNull(status.cccd());
    }

    /** Kiểm thử: trạng thái dùng thử khi đã nhận. */
    @Test
    @DisplayName("getTrialStatus: Ineligible when already claimed trial")
    void testGetTrialStatus_AlreadyClaimed() {
        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(101L);
        MemberTrialRedemption redemption = new MemberTrialRedemption(testMember, hasher.hash("001200001234"), "1234", "Nguyen Van A", sub);
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.of(redemption));

        TrialStatusDto status = service.getTrialStatus(10L);

        assertFalse(status.eligible());
        assertTrue(status.alreadyClaimed());
        assertEquals("********1234", status.cccd());
        assertEquals("Nguyen Van A", status.fullName());
        assertEquals(101L, status.subscriptionId());
    }

    /** Kiểm thử: trạng thái dùng thử khi đang có subscription hoạt động. */
    @Test
    @DisplayName("getTrialStatus: Ineligible when member already had a subscription")
    void testGetTrialStatus_HasActiveSubscription() {
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(subscriptions.existsByMemberUserId(10L))
                .thenReturn(true);

        TrialStatusDto status = service.getTrialStatus(10L);

        assertFalse(status.eligible());
        assertFalse(status.alreadyClaimed());
    }

    /** Kiểm thử: nhận gói Gold dùng thử thành công. */
    @Test
    @DisplayName("claimGoldTrial: Successfully claims 3-day Gold trial")
    void testClaimGoldTrial_Success() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("001200001234", "Nguyen Van A");

        when(trialRedemptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.existsByCccdHash(hasher.hash("001200001234"))).thenReturn(false);
        when(subscriptions.existsByMemberUserId(10L))
                .thenReturn(false);
        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(goldPackage));

        when(subscriptions.saveAndFlush(any(MembershipSubscription.class))).thenAnswer(inv -> {
            MembershipSubscription s = inv.getArgument(0);
            s.setId(200L);
            return s;
        });

        SubscriptionDto result = service.claimGoldTrial(principal, request);

        assertNotNull(result);
        assertEquals(200L, result.id());
        assertEquals("active", result.status());
        assertEquals("GOLD", result.packageName());
        assertEquals(LocalDate.now(clock), result.startDate());
        assertEquals(LocalDate.now(clock).plusDays(2), result.endDate());

        verify(trialRedemptions).saveAndFlush(any(MemberTrialRedemption.class));
        verify(notifications).send(eq(10L), anyString(), anyString(), eq("system"), eq("membership_subscription"), eq(200L));
    }

    /** Kiểm thử: hội viên đã nhận gói dùng thử thì không nhận lại được. */
    @Test
    @DisplayName("claimGoldTrial: Throws ConflictException when member already claimed")
    void testClaimGoldTrial_MemberAlreadyClaimed() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("001200001234", "Nguyen Van A");

        when(trialRedemptions.existsByMemberUserId(10L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.claimGoldTrial(principal, request));
        verify(subscriptions, never()).saveAndFlush(any());
    }

    /** Kiểm thử: CCCD đã được dùng nhận gói thử. */
    @Test
    @DisplayName("claimGoldTrial: Throws ConflictException when CCCD is already used")
    void testClaimGoldTrial_CccdAlreadyUsed() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("001200001234", "Nguyen Van A");

        when(trialRedemptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.existsByCccdHash(hasher.hash("001200001234"))).thenReturn(true);

        assertThrows(ConflictException.class, () -> service.claimGoldTrial(principal, request));
        verify(subscriptions, never()).saveAndFlush(any());
    }

    /** Kiểm thử: không nhận được khi đã có subscription hoạt động. */
    @Test
    @DisplayName("claimGoldTrial: Throws ConflictException when member already had a subscription")
    void testClaimGoldTrial_ActiveSubExists() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("001200001234", "Nguyen Van A");

        when(trialRedemptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.existsByCccdHash(hasher.hash("001200001234"))).thenReturn(false);
        when(subscriptions.existsByMemberUserId(10L))
                .thenReturn(true);

        assertThrows(ConflictException.class, () -> service.claimGoldTrial(principal, request));
        verify(subscriptions, never()).saveAndFlush(any());
    }

    /** Kiểm thử: CccdHasher: không lưu số gốc, ổn định và phụ thuộc pepper */
    @Test
    @DisplayName("CccdHasher: không lưu số gốc, ổn định và phụ thuộc pepper")
    void testCccdHasher() {
        String h = hasher.hash("001200001234");
        assertEquals(64, h.length());
        assertNotEquals("001200001234", h);
        assertEquals(h, hasher.hash("001200001234"));
        assertNotEquals(h, new CccdHasher("other").hash("001200001234"));
        assertEquals("1234", hasher.last4("001200001234"));
    }
    /** Kiểm thử: phân loại trùng theo tên ràng buộc thay vì tên cột SQL. */
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({"uq_trial_member,TRIAL_ALREADY_CLAIMED", "uq_trial_cccd_hash,TRIAL_CCCD_ALREADY_USED"})
    void classifiesDuplicateByConstraintRatherThanSqlColumnNames(String constraintName, String expectedCode) {
        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(goldPackage));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        var duplicate = new org.hibernate.exception.ConstraintViolationException(
                "insert into member_trial_redemptions (cccd_hash, cccd_last4, member_id)",
                new java.sql.SQLException("duplicate value", "23505"), constraintName);
        when(trialRedemptions.saveAndFlush(any())).thenThrow(
                new org.springframework.dao.DataIntegrityViolationException("cccd_hash SQL insert failed", duplicate));
        var failure = assertThrows(ConflictException.class, () -> service.claimGoldTrial(
                new AuthenticatedPrincipal(10L, "member1", "MEMBER"),
                new TrialClaimRequest("001200001234", "Nguyen Van A")));
        assertEquals(expectedCode, failure.getErrorCode());
        verifyNoInteractions(notifications);
    }

    /** Kiểm thử: giữ nguyên lỗi toàn vẹn lạ thay vì báo đã nhận. */
    @Test
    void preservesUnknownIntegrityFailuresInsteadOfReportingAlreadyClaimed() {
        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(goldPackage));
        var failure = new org.springframework.dao.DataIntegrityViolationException("unrelated subscription foreign key");
        when(subscriptions.saveAndFlush(any())).thenThrow(failure);
        assertSame(failure, assertThrows(org.springframework.dao.DataIntegrityViolationException.class,
                () -> service.claimGoldTrial(new AuthenticatedPrincipal(10L, "member1", "MEMBER"),
                        new TrialClaimRequest("001200001234", "Nguyen Van A"))));
        verifyNoInteractions(notifications);
    }

    /** Kiểm thử: yêu cầu dùng thử bằng CCCD thành công. */
    @Test
    @DisplayName("requestTrial: Successfully submits CCCD trial request in PENDING_APPROVAL status")
    void testRequestTrial_CccdSuccess() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("CCCD", "001200001234", "001200001234", "Nguyen Van A", "VN", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(trialRedemptions.existsByCccdHash(anyString())).thenReturn(false);
        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> {
            MemberTrialRedemption r = inv.getArgument(0);
            r.setId(50L);
            return r;
        });

        TrialStatusDto status = service.requestTrial(principal, request);

        assertNotNull(status);
        assertEquals("PENDING_APPROVAL", status.status());
        assertFalse(status.alreadyClaimed());
        assertEquals("CCCD", status.documentType());
        assertEquals("Nguyen Van A", status.fullName());
        verify(notifications).send(eq(10L), anyString(), anyString(), eq("system"), eq("member_trial_redemption"), eq(50L));
        verify(notifications).notifyReceptionists("trial", 50L);
    }

    /** Kiểm thử: yêu cầu dùng thử bằng hộ chiếu nước ngoài thành công. */
    @Test
    @DisplayName("requestTrial: Successfully submits foreign passport request in PENDING_APPROVAL status")
    void testRequestTrial_ForeignPassportSuccess() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("PASSPORT", "P12345678", null, "John Doe", "United States", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", null);

        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(trialRedemptions.existsByCccdHash(anyString())).thenReturn(false);
        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> {
            MemberTrialRedemption r = inv.getArgument(0);
            r.setId(51L);
            return r;
        });

        TrialStatusDto status = service.requestTrial(principal, request);

        assertNotNull(status);
        assertEquals("PENDING_APPROVAL", status.status());
        assertEquals("PASSPORT", status.documentType());
        assertEquals("John Doe", status.fullName());
    }

    /** Kiểm thử: yêu cầu dùng thử bằng hộ chiếu Việt Nam bị từ chối. */
    @Test
    @DisplayName("requestTrial: Rejects Vietnamese citizen trying to use Passport")
    void testRequestTrial_VietnamesePassportRejected() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("PASSPORT", "P12345678", null, "Nguyen Van B", "Vietnam", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", null);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.requestTrial(principal, request));
        assertEquals("TRIAL_PASSPORT_FOREIGN_ONLY", ex.getErrorCode());
    }

    /** Kiểm thử: định dạng hộ chiếu không hợp lệ bị từ chối. */
    @Test
    @DisplayName("requestTrial: Rejects invalid passport number format")
    void testRequestTrial_InvalidPassportFormat() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("PASSPORT", "AB", null, "John Doe", "France", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", null);

        BadRequestException ex = assertThrows(BadRequestException.class, () -> service.requestTrial(principal, request));
        assertEquals("TRIAL_PASSPORT_INVALID", ex.getErrorCode());
    }

    /** Kiểm thử: duyệt yêu cầu dùng thử thành công. */
    @Test
    @DisplayName("approveTrial: Receptionist approves trial, syncs user fullName, and creates 3-day active subscription")
    void testApproveTrial_Success() {
        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(99L, "receptionist1", "RECEPTIONIST");
        MemberTrialRedemption pending = new MemberTrialRedemption();
        pending.setId(55L);
        pending.setMember(testMember);
        pending.setFullName("Nguyen Van Verified");
        pending.setDocumentNumberEnc(hasher.encrypt("001200001234"));
        pending.setStatus(MemberTrialRedemption.STATUS_PENDING);

        when(trialRedemptions.findById(55L)).thenReturn(Optional.of(pending));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.findByIdForUpdate(55L)).thenReturn(Optional.of(pending));
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(goldPackage));
        when(subscriptions.saveAndFlush(any(MembershipSubscription.class))).thenAnswer(inv -> {
            MembershipSubscription s = inv.getArgument(0);
            s.setId(300L);
            return s;
        });
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> inv.getArgument(0));

        ReceptionTrialDto result = service.approveTrial(receptionist, 55L);

        assertNotNull(result);
        assertEquals(300L, result.subscriptionId());
        assertEquals("APPROVED", result.status());
        assertEquals("Nguyen Van Verified", testMember.getUser().getFullName());
        assertEquals("********1234", testMember.getCitizenId());
        assertEquals("001200001234", kycCrypto.decrypt(testMember.getCitizenIdEncrypted()));
        assertNull(pending.getDocumentNumberEnc());
        assertNull(result.documentNumber());
        verify(notifications).send(eq(10L), anyString(), anyString(), eq("system"), eq("membership_subscription"), eq(300L));
    }

    /** Kiểm thử: từ chối yêu cầu dùng thử thành công. */
    @Test
    @DisplayName("rejectTrial: Receptionist rejects trial with a stated reason")
    void testRejectTrial_Success() {
        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(99L, "receptionist1", "RECEPTIONIST");
        MemberTrialRedemption pending = new MemberTrialRedemption();
        pending.setId(56L);
        pending.setMember(testMember);
        pending.setStatus(MemberTrialRedemption.STATUS_PENDING);

        when(trialRedemptions.findById(56L)).thenReturn(Optional.of(pending));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.findByIdForUpdate(56L)).thenReturn(Optional.of(pending));
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> inv.getArgument(0));

        ReceptionTrialDto result = service.rejectTrial(receptionist, 56L, "CCCD mờ không đọc được thông tin");

        assertNotNull(result);
        assertEquals("REJECTED", result.status());
        assertEquals("CCCD mờ không đọc được thông tin", result.rejectionReason());
        verify(notifications).send(eq(10L), anyString(), anyString(), eq("system"), eq("member_trial_redemption"), eq(56L));
    }

    /** Kiểm thử: liệt kê các yêu cầu dùng thử. */
    @Test
    @DisplayName("listTrials: Filters by status and search keyword")
    void testListTrials() {
        MemberTrialRedemption r1 = new MemberTrialRedemption();
        r1.setId(1L);
        r1.setFullName("Alice Smith");
        r1.setStatus("PENDING_APPROVAL");
        r1.setMember(testMember);

        MemberTrialRedemption r2 = new MemberTrialRedemption();
        r2.setId(2L);
        r2.setFullName("Bob Jones");
        r2.setStatus("PENDING_APPROVAL");
        r2.setMember(testMember);

        when(trialRedemptions.findByStatusOrderByRedeemedAtDesc("PENDING_APPROVAL")).thenReturn(List.of(r1, r2));

        List<ReceptionTrialDto> results = service.listTrials("PENDING_APPROVAL", "Alice");

        assertEquals(1, results.size());
        assertEquals("Alice Smith", results.get(0).documentFullName());
    }

    /** Kiểm thử: từ chối giải phóng giấy tờ và yêu cầu đã bị từ chối không duyệt lại được. */
    @Test
    void rejectingFreesTheDocumentAndARejectedRequestCannotBeApproved() {
        MemberTrialRedemption rejected = new MemberTrialRedemption();
        rejected.setId(70L);
        rejected.setMember(testMember);
        rejected.setCccdHash("real-hash");
        rejected.setStatus(MemberTrialRedemption.STATUS_PENDING);
        when(trialRedemptions.findById(70L)).thenReturn(java.util.Optional.of(rejected));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.findByIdForUpdate(70L)).thenReturn(Optional.of(rejected));
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> inv.getArgument(0));
        AuthenticatedPrincipal desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

        service.rejectTrial(desk, 70L, "Ảnh mờ");

        assertEquals("rejected-70", rejected.getCccdHash());
        assertThrows(com.swp391.scms.common.exception.ConflictException.class, () -> service.approveTrial(desk, 70L));
    }

    /** Kiểm thử: ảnh giấy tờ phải là ảnh tải lên chứ không phải liên kết. */
    @Test
    void documentPhotosMustBeUploadedImagesNotLinks() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest("CCCD", "001200001234", "001200001234", "Nguyen Van A", "VN",
                "https://attacker.example/x.png", null);
        assertThrows(com.swp391.scms.common.exception.BadRequestException.class, () -> service.requestTrial(principal, request));
    }

    /** Kiểm thử: yêu cầu dùng thử tái dùng KYC đã xác minh khi request không nêu thông tin giấy tờ. */
    @Test
    void requestTrialReusesVerifiedMemberKycWhenRequestOmitsDocumentDetails() {
        testMember.getUser().setFullName("Nguyen Van Test");
        testMember.setIdentityVerified(true);
        testMember.setKycStatus("APPROVED");
        testMember.setDocumentType("CCCD");
        testMember.setNationality("VN");
        testMember.setCitizenIdEncrypted(kycCrypto.encrypt("001200009999"));
        String validPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
        testMember.setFrontImageUrl(validPngDataUrl);
        testMember.setBackImageUrl(validPngDataUrl);

        when(members.findById(10L)).thenReturn(java.util.Optional.of(testMember));
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(trialRedemptions.existsByCccdHashAndMemberUserIdNot(hasher.hash("001200009999"), 10L)).thenReturn(false);
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> {
            MemberTrialRedemption r = inv.getArgument(0);
            r.setId(99L);
            return r;
        });

        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        TrialClaimRequest request = new TrialClaimRequest(null, null, null, null, null, null, null);

        var result = service.requestTrial(principal, request);

        assertEquals(MemberTrialRedemption.STATUS_PENDING, result.status());
        org.mockito.ArgumentCaptor<MemberTrialRedemption> captor = org.mockito.ArgumentCaptor.forClass(MemberTrialRedemption.class);
        verify(trialRedemptions).saveAndFlush(captor.capture());
        assertEquals(hasher.hash("001200009999"), captor.getValue().getCccdHash());
        assertEquals("Nguyen Van Test", captor.getValue().getFullName());
        assertEquals(validPngDataUrl, captor.getValue().getFrontImageUrl());
        assertEquals(validPngDataUrl, captor.getValue().getBackImageUrl());
    }

    /** Kiểm thử: yêu cầu dùng thử tái dùng KYC cũ dạng plaintext khi chưa có bản mã hóa. */
    @Test
    void requestTrialReusesLegacyPlainKycWhenNoEncryptedCopyExists() {
        testMember.setKycStatus("APPROVED");
        testMember.setDocumentType("CCCD");
        testMember.setNationality("VN");
        testMember.setCitizenIdEncrypted(null);
        testMember.setCitizenId("001200008888");

        when(members.findById(10L)).thenReturn(java.util.Optional.of(testMember));
        when(trialRedemptions.findByMemberUserId(10L)).thenReturn(Optional.empty());
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> inv.getArgument(0));

        service.requestTrial(new AuthenticatedPrincipal(10L, "member1", "MEMBER"),
                new TrialClaimRequest(null, null, null, null, null, null, null));

        org.mockito.ArgumentCaptor<MemberTrialRedemption> captor = org.mockito.ArgumentCaptor.forClass(MemberTrialRedemption.class);
        verify(trialRedemptions).saveAndFlush(captor.capture());
        assertEquals(hasher.hash("001200008888"), captor.getValue().getCccdHash());
    }

    /** Kiểm thử P1-BE-34: chuẩn hóa chữ hoa số hộ chiếu trước khi băm để không vượt qua kiểm tra trùng bằng khác hoa/thường. */
    @Test
    @DisplayName("requestTrial: Normalizes passport case to uppercase before hashing and duplicate checks")
    void requestTrial_normalizesPassportCaseBeforeHashing() {
        AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member1", "MEMBER");
        String img = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        TrialClaimRequest lowerCase = new TrialClaimRequest("PASSPORT", "p12345678", null, "John Doe", "United States", img, null);

        when(members.findById(10L)).thenReturn(Optional.of(testMember));
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(trialRedemptions.existsByCccdHashAndMemberUserIdNot(hasher.hash("P12345678"), 10L)).thenReturn(true);

        ConflictException ex = assertThrows(ConflictException.class, () -> service.requestTrial(principal, lowerCase));
        assertEquals("TRIAL_DOCUMENT_ALREADY_USED", ex.getErrorCode());
        verify(trialRedemptions, never()).saveAndFlush(any());
    }

    /** Kiểm thử P1-BE-34 & P2-BE-40: duyệt trial khóa hội viên trước rồi khóa yêu cầu, kiểm tra lại chưa có gói trả phí, lưu KYC che và đặt hạn đúng 3 ngày tính cả hôm nay. */
    @Test
    @DisplayName("approveTrial: Locks Member then Redemption, re-checks subscriptions, masks citizenId, and sets 3 inclusive days")
    void approveTrial_locksMemberThenRedemptionRechecksSubAndSetsInclusiveThreeDayWindow() {
        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(99L, "receptionist1", "RECEPTIONIST");
        MemberTrialRedemption pending = new MemberTrialRedemption();
        pending.setId(58L);
        pending.setMember(testMember);
        pending.setDocumentType("PASSPORT");
        pending.setFullName("Jane Roe");
        pending.setCccdLast4("5678");
        pending.setDocumentNumberEnc(hasher.encrypt("p12345678"));
        pending.setStatus(MemberTrialRedemption.STATUS_PENDING);

        when(trialRedemptions.findById(58L)).thenReturn(Optional.of(pending));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.findByIdForUpdate(58L)).thenReturn(Optional.of(pending));
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(false);
        when(packages.findByStatusOrderByPriceAsc("active")).thenReturn(List.of(goldPackage));
        org.mockito.ArgumentCaptor<MembershipSubscription> subCaptor = org.mockito.ArgumentCaptor.forClass(MembershipSubscription.class);
        when(subscriptions.saveAndFlush(subCaptor.capture())).thenAnswer(inv -> {
            MembershipSubscription s = inv.getArgument(0);
            s.setId(301L);
            return s;
        });
        when(trialRedemptions.saveAndFlush(any(MemberTrialRedemption.class))).thenAnswer(inv -> inv.getArgument(0));

        service.approveTrial(receptionist, 58L);

        org.mockito.InOrder order = inOrder(members, trialRedemptions, subscriptions);
        order.verify(members).findByUserIdForUpdate(10L);
        order.verify(trialRedemptions).findByIdForUpdate(58L);
        order.verify(subscriptions).existsByMemberUserId(10L);

        assertEquals(com.swp391.scms.users.KycCrypto.mask("P12345678"), testMember.getCitizenId());
        assertEquals("P12345678", kycCrypto.decrypt(testMember.getCitizenIdEncrypted()));
        assertEquals(LocalDate.now(clock), subCaptor.getValue().getStartDate());
        assertEquals(LocalDate.now(clock).plusDays(2), subCaptor.getValue().getEndDate());
    }

    /** Kiểm thử P1-BE-34: nếu hội viên đã mua gói trả phí trong lúc chờ duyệt thì từ chối duyệt dùng thử. */
    @Test
    @DisplayName("approveTrial: Rejects approval if member already acquired a subscription while waiting")
    void approveTrial_rejectsIfMemberBoughtSubscriptionWhileWaiting() {
        AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(99L, "receptionist1", "RECEPTIONIST");
        MemberTrialRedemption pending = new MemberTrialRedemption();
        pending.setId(59L);
        pending.setMember(testMember);
        pending.setStatus(MemberTrialRedemption.STATUS_PENDING);

        when(trialRedemptions.findById(59L)).thenReturn(Optional.of(pending));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(testMember));
        when(trialRedemptions.findByIdForUpdate(59L)).thenReturn(Optional.of(pending));
        when(subscriptions.existsByMemberUserId(10L)).thenReturn(true);

        ConflictException ex = assertThrows(ConflictException.class, () -> service.approveTrial(receptionist, 59L));
        assertEquals("TRIAL_NOT_NEW_MEMBER", ex.getErrorCode());
        verify(subscriptions, never()).saveAndFlush(any());
    }
}
