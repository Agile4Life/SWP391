package com.swp391.scms.users;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.dto.MemberKycRequest;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.Role;
import com.swp391.scms.users.entity.User;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * Bộ kiểm thử cho KycFlow (luồng xác minh danh tính KYC).
 *
 * Giấy tờ tùy thân: được mã hóa khi lưu trữ và phải được lễ tân duyệt trước khi có hiệu lực (đặc tả 2026-11-09).
 */
class KycFlowTest {
    private final UserRepository users = mock(UserRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final KycCrypto crypto = new KycCrypto("test-only-secret");
    private ProfileService profiles;
    private MemberKycReviewService review;
    private User user;
    private Member member;
    private final AuthenticatedPrincipal desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

    /** Chuẩn bị trước mỗi test: tạo luồng KYC với repository giả lập. */
    @BeforeEach
    void setUp() {
        profiles = new ProfileService(users, members, mock(CoachRepository.class), mock(ReceptionistRepository.class));
        ReflectionTestUtils.setField(profiles, "kycCrypto", crypto);
        review = new MemberKycReviewService(members, users, crypto,
                Clock.fixed(Instant.parse("2026-11-09T08:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh")));
        user = new User();
        user.setId(10L);
        user.setFullName("Nguyen Van A");
        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        user.setRole(memberRole);
        member = new Member();
        member.setUserId(10L);
        member.setUser(user);
        member.setMembershipCode("MB-010");
        when(users.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(user));
        when(members.findByUserIdForUpdate(10L)).thenReturn(Optional.of(member));
        when(users.findById(2L)).thenReturn(Optional.of(new User()));
    }

    /** Hàm trợ giúp của test: gửi hồ sơ KYC mẫu. */
    private void submit() {
        profiles.submitMemberKyc(10L, new MemberKycRequest("CCCD", "012345678901", "NGUYEN VAN A", "Việt Nam", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="));
    }

    /** Kiểm thử: số giấy tờ lưu dạng mã hóa và chỉ đọc được dạng che bớt. */
    @Test void submissionNotifiesDeskOnlyAfterSavingPendingKyc() {
        var notifications = mock(com.swp391.scms.notifications.NotificationService.class);
        profiles = new ProfileService(users, members, mock(CoachRepository.class), mock(ReceptionistRepository.class), null, notifications, null);
        ReflectionTestUtils.setField(profiles, "kycCrypto", crypto);
        submit();
        var order = inOrder(members, notifications);
        order.verify(members).save(member);
        order.verify(notifications).notifyReceptionists("kyc", 10L);
        assertEquals("PENDING", member.getKycStatus());
    }

    @Test
    void theNumberIsStoredEncryptedAndOnlyTheMaskedFormIsReadable() {
        submit();

        assertEquals("********8901", member.getCitizenId());
        assertTrue(member.getCitizenIdEncrypted().startsWith("enc:v1:"));
        assertFalse(member.getCitizenIdEncrypted().contains("012345678901"));
        assertEquals("012345678901", crypto.decrypt(member.getCitizenIdEncrypted()));
        // Mỗi lần mã hóa sử dụng một IV mới.
        assertNotEquals(crypto.encrypt("012345678901"), crypto.encrypt("012345678901"));
        assertNull(crypto.decrypt("plain-text"));
    }

    /** Kiểm thử: hồ sơ gửi lên ở trạng thái chờ cho tới khi quầy duyệt. */
    @Test
    void aSubmissionIsPendingUntilTheDeskApprovesIt() {
        submit();

        assertFalse(member.getIdentityVerified());
        assertEquals("PENDING", member.getKycStatus());
        assertNotNull(member.getKycSubmittedAt());

        review.approve(desk, 10L);

        assertTrue(member.getIdentityVerified());
        assertEquals("APPROVED", member.getKycStatus());
        assertNotNull(member.getIdentityVerifiedAt());
        // Hồ sơ đã duyệt không thể duyệt lại lần nữa.
        assertThrows(ConflictException.class, () -> review.approve(desk, 10L));
    }

    /** Kiểm thử: từ chối cần có lý do và giữ hội viên ở trạng thái chưa xác minh. */
    @Test
    void aRejectionNeedsAReasonAndKeepsTheMemberUnverified() {
        submit();

        assertThrows(BadRequestException.class, () -> review.reject(desk, 10L, "  "));
        review.reject(desk, 10L, "Ảnh mờ, không đọc được số");

        assertFalse(member.getIdentityVerified());
        assertEquals("REJECTED", member.getKycStatus());
        assertEquals("Ảnh mờ, không đọc được số", member.getKycRejectReason());
        // Hội viên có thể gửi lại, đưa hồ sơ quay trở lại hàng chờ duyệt.
        submit();
        assertEquals("PENDING", member.getKycStatus());
        assertNull(member.getKycRejectReason());
    }

    /** Kiểm thử: người duyệt thấy số giấy tờ đọc được và chỉ liệt kê hồ sơ đang chờ. */
    @Test
    void theReviewerSeesTheReadableNumberAndOnlyPendingSubmissionsAreListed() {
        submit();
        when(members.findByKycStatusOrderByKycSubmittedAtAsc("PENDING")).thenReturn(List.of(member));

        var pending = review.listPending();

        assertEquals(1, pending.size());
        assertEquals("012345678901", pending.get(0).citizenId());
        assertEquals("MB-010", pending.get(0).membershipCode());
    }

    /** Kiểm thử P2-BE-12: số giấy tờ cũ lưu plaintext được mã hóa + băm một lần qua findUnmaskedCitizenIds (không findAll). */
    @Test
    void legacyPlaintextNumbersAreEncryptedOnceByTheBackfill() throws Exception {
        member.setCitizenId("012345678901");
        when(members.findUnmaskedCitizenIds()).thenReturn(List.of(member));

        new KycBackfill(members, crypto).run(null);

        assertEquals("********8901", member.getCitizenId());
        assertEquals("012345678901", crypto.decrypt(member.getCitizenIdEncrypted()));
        assertEquals(crypto.hash("012345678901"), member.getCitizenIdHash());
        verify(members).save(member);
        verify(members, never()).findAll();
        // Chạy lại một lần nữa không thay đổi gì: cột đã được che bớt rồi.
        clearInvocations(members);
        when(members.findUnmaskedCitizenIds()).thenReturn(List.of());
        new KycBackfill(members, crypto).run(null);
        verify(members, never()).save(any());
    }

    /** Kiểm thử P1-BE-08: nhân sự không phải MEMBER bị chặn nộp KYC, và người duyệt không thể tự duyệt/từ chối chính mình. */
    @Test
    void nonMemberCannotSubmitKycAndReviewerCannotSelfApproveOrReject() {
        Role recRole = new Role();
        recRole.setCode("RECEPTIONIST");
        user.setRole(recRole);
        assertThrows(ForbiddenException.class, this::submit);

        Role memberRole = new Role();
        memberRole.setCode("MEMBER");
        user.setRole(memberRole);
        submit();

        AuthenticatedPrincipal selfReviewer = new AuthenticatedPrincipal(10L, "self", "RECEPTIONIST");
        assertThrows(ForbiddenException.class, () -> review.approve(selfReviewer, 10L));
        assertThrows(ForbiddenException.class, () -> review.reject(selfReviewer, 10L, "Self reject"));
    }

    /** Kiểm thử P1-BE-09: chặn nộp đè khi đang PENDING hoặc đã APPROVED/verified, và xóa backImageUrl cũ khi chuyển sang PASSPORT. */
    @Test
    void kycStateMachineBlocksPendingOrApprovedResubmissionAndClearsPassportBackImage() {
        submit();
        assertThrows(ConflictException.class, this::submit);

        review.reject(desk, 10L, "Ảnh mờ");
        String png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        profiles.submitMemberKyc(10L, new MemberKycRequest("PASSPORT", "p98765432", "JOHN DOE", "United States", png, null));
        assertEquals("PASSPORT", member.getDocumentType());
        assertNull(member.getBackImageUrl());
        assertEquals(crypto.hash("P98765432"), member.getCitizenIdHash());

        review.approve(desk, 10L);
        assertThrows(ConflictException.class, this::submit);
    }

    /** Kiểm thử P1-BE-09: chặn trùng số CCCD/Hộ chiếu giữa hai hội viên khác nhau ở cả bước nộp và bước duyệt. */
    @Test
    void duplicateDocumentHashIsRejectedAtSubmitAndApprove() {
        String expectedHash = crypto.hash("012345678901");
        when(members.existsByCitizenIdHashAndUserIdNotAndUserDeletedAtIsNull(expectedHash, 10L)).thenReturn(true);
        ConflictException submitEx = assertThrows(ConflictException.class, this::submit);
        assertEquals("KYC_DOCUMENT_ALREADY_USED", submitEx.getErrorCode());

        // Trường hợp race: nộp lọt qua trước, nhưng tài khoản khác đã có cùng mã băm khi duyệt.
        when(members.existsByCitizenIdHashAndUserIdNotAndUserDeletedAtIsNull(expectedHash, 10L)).thenReturn(false);
        submit();
        when(members.existsByCitizenIdHashAndUserIdNotAndUserDeletedAtIsNull(expectedHash, 10L)).thenReturn(true);
        ConflictException approveEx = assertThrows(ConflictException.class, () -> review.approve(desk, 10L));
        assertEquals("KYC_DOCUMENT_ALREADY_USED", approveEx.getErrorCode());
    }

    /** Kiểm thử P1-BE-11, P2-BE-10, P2-BE-13: tài khoản xóa mềm bị từ chối duyệt, loại giấy tờ lạ trả 400, và fail-closed khi thiếu KycCrypto/PasswordEncoder. */
    @Test
    void deletedUserUnknownDocTypeAndMissingCryptoFailClosed() {
        String png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        BadRequestException badType = assertThrows(BadRequestException.class, () ->
                profiles.submitMemberKyc(10L, new MemberKycRequest("DRIVER_LICENSE", "012345678901", "NGUYEN VAN A", "Việt Nam", png, png)));
        assertEquals("INVALID_DOCUMENT_TYPE", badType.getErrorCode());

        submit();
        user.setDeletedAt(LocalDateTime.now());
        assertThrows(ResourceNotFoundException.class, () -> review.approve(desk, 10L));
        assertThrows(ResourceNotFoundException.class, () -> review.reject(desk, 10L, "Deleted"));

        ProfileService unconfigured = new ProfileService(users, members, mock(CoachRepository.class), mock(ReceptionistRepository.class));
        assertThrows(IllegalStateException.class, () -> unconfigured.changePassword(10L, "OldPass123", "NewPass456"));
        assertThrows(IllegalStateException.class, () ->
                unconfigured.submitMemberKyc(10L, new MemberKycRequest("CCCD", "012345678901", "NGUYEN VAN A", "Việt Nam", png, png)));
    }
}
