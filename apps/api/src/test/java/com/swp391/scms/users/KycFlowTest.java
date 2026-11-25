package com.swp391.scms.users;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.dto.MemberKycRequest;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.time.Clock;
import java.time.Instant;
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
        member = new Member();
        member.setUserId(10L);
        member.setUser(user);
        member.setMembershipCode("MB-010");
        when(users.findByIdAndDeletedAtIsNull(10L)).thenReturn(Optional.of(user));
        when(members.findById(10L)).thenReturn(Optional.of(member));
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

    /** Kiểm thử: số giấy tờ cũ lưu plaintext được mã hóa một lần bằng backfill. */
    @Test
    void legacyPlaintextNumbersAreEncryptedOnceByTheBackfill() throws Exception {
        member.setCitizenId("012345678901");
        when(members.findAll()).thenReturn(List.of(member));

        new KycBackfill(members, crypto).run(null);

        assertEquals("********8901", member.getCitizenId());
        assertEquals("012345678901", crypto.decrypt(member.getCitizenIdEncrypted()));
        verify(members).save(member);
        // Chạy lại một lần nữa không thay đổi gì: cột đã được che bớt rồi.
        clearInvocations(members);
        new KycBackfill(members, crypto).run(null);
        verify(members, never()).save(any());
    }
}
