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

/** Identity documents: encrypted at rest, reviewed by the desk before they count (spec 2026-11-09 review). */
class KycFlowTest {
    private final UserRepository users = mock(UserRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final KycCrypto crypto = new KycCrypto("test-only-secret");
    private ProfileService profiles;
    private MemberKycReviewService review;
    private User user;
    private Member member;
    private final AuthenticatedPrincipal desk = new AuthenticatedPrincipal(2L, "desk", "RECEPTIONIST");

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

    private void submit() {
        profiles.submitMemberKyc(10L, new MemberKycRequest("CCCD", "012345678901", "NGUYEN VAN A", "Việt Nam", "front.jpg", "back.jpg"));
    }

    @Test
    void theNumberIsStoredEncryptedAndOnlyTheMaskedFormIsReadable() {
        submit();

        assertEquals("********8901", member.getCitizenId());
        assertTrue(member.getCitizenIdEncrypted().startsWith("enc:v1:"));
        assertFalse(member.getCitizenIdEncrypted().contains("012345678901"));
        assertEquals("012345678901", crypto.decrypt(member.getCitizenIdEncrypted()));
        // Every encryption uses a fresh IV.
        assertNotEquals(crypto.encrypt("012345678901"), crypto.encrypt("012345678901"));
        assertNull(crypto.decrypt("plain-text"));
    }

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
        // A reviewed submission cannot be reviewed again.
        assertThrows(ConflictException.class, () -> review.approve(desk, 10L));
    }

    @Test
    void aRejectionNeedsAReasonAndKeepsTheMemberUnverified() {
        submit();

        assertThrows(BadRequestException.class, () -> review.reject(desk, 10L, "  "));
        review.reject(desk, 10L, "Ảnh mờ, không đọc được số");

        assertFalse(member.getIdentityVerified());
        assertEquals("REJECTED", member.getKycStatus());
        assertEquals("Ảnh mờ, không đọc được số", member.getKycRejectReason());
        // The member can submit again, which puts the document back in the queue.
        submit();
        assertEquals("PENDING", member.getKycStatus());
        assertNull(member.getKycRejectReason());
    }

    @Test
    void theReviewerSeesTheReadableNumberAndOnlyPendingSubmissionsAreListed() {
        submit();
        when(members.findByKycStatusOrderByKycSubmittedAtAsc("PENDING")).thenReturn(List.of(member));

        var pending = review.listPending();

        assertEquals(1, pending.size());
        assertEquals("012345678901", pending.get(0).citizenId());
        assertEquals("MB-010", pending.get(0).membershipCode());
    }

    @Test
    void legacyPlaintextNumbersAreEncryptedOnceByTheBackfill() throws Exception {
        member.setCitizenId("012345678901");
        when(members.findAll()).thenReturn(List.of(member));

        new KycBackfill(members, crypto).run(null);

        assertEquals("********8901", member.getCitizenId());
        assertEquals("012345678901", crypto.decrypt(member.getCitizenIdEncrypted()));
        verify(members).save(member);
        // Running it again changes nothing: the column is already masked.
        clearInvocations(members);
        new KycBackfill(members, crypto).run(null);
        verify(members, never()).save(any());
    }
}
