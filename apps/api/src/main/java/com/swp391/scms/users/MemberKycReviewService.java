package com.swp391.scms.users;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The desk reviews identity documents before a member can buy a package: the declared number is checked against
 * the photos. Only receptionists and managers reach these methods.
 */
@Service
public class MemberKycReviewService {
    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";

    /** One submission waiting for review, with the readable number the reviewer compares to the photos. */
    public record KycReviewDto(Long memberId, String membershipCode, String fullName, String documentType,
                               String citizenId, String nationality, String frontImageUrl, String backImageUrl,
                               LocalDateTime submittedAt) {}

    private final MemberRepository members;
    private final UserRepository users;
    private final KycCrypto crypto;
    private final Clock clock;

    @Autowired(required = false)
    private NotificationService notifications;
    @Autowired(required = false)
    private MessageService messages;

    public MemberKycReviewService(MemberRepository members, UserRepository users, KycCrypto crypto, Clock clock) {
        this.members = members;
        this.users = users;
        this.crypto = crypto;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<KycReviewDto> listPending() {
        return members.findByKycStatusOrderByKycSubmittedAtAsc(PENDING).stream()
                .filter(m -> m.getUser() != null && m.getUser().getDeletedAt() == null)
                .map(m -> new KycReviewDto(m.getUserId(), m.getMembershipCode(), m.getUser().getFullName(),
                        m.getDocumentType(), readableNumber(m), m.getNationality(), m.getFrontImageUrl(),
                        m.getBackImageUrl(), m.getKycSubmittedAt()))
                .toList();
    }

    @Transactional
    @com.swp391.scms.audit.Audited(action = "MEMBER_KYC_APPROVE", entity = "members")
    public void approve(AuthenticatedPrincipal reviewer, Long memberId) {
        Member member = pending(memberId);
        LocalDateTime now = LocalDateTime.now(clock);
        member.setIdentityVerified(true);
        member.setIdentityVerifiedAt(now);
        member.setKycStatus(APPROVED);
        member.setKycReviewedAt(now);
        member.setKycRejectReason(null);
        users.findById(reviewer.id()).ifPresent(member::setKycReviewedBy);
        members.save(member);
        notify(memberId, "notifications.kyc.approved.title", "notifications.kyc.approved.body", null);
    }

    @Transactional
    @com.swp391.scms.audit.Audited(action = "MEMBER_KYC_REJECT", entity = "members")
    public void reject(AuthenticatedPrincipal reviewer, Long memberId, String reason) {
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("KYC_REJECT_REASON_REQUIRED", "error.kyc.reject_reason_required", null,
                    "A reason is required to reject an identity document");
        }
        Member member = pending(memberId);
        LocalDateTime now = LocalDateTime.now(clock);
        member.setIdentityVerified(false);
        member.setKycStatus(REJECTED);
        member.setKycReviewedAt(now);
        member.setKycRejectReason(trimmed.length() > 255 ? trimmed.substring(0, 255) : trimmed);
        users.findById(reviewer.id()).ifPresent(member::setKycReviewedBy);
        members.save(member);
        notify(memberId, "notifications.kyc.rejected.title", "notifications.kyc.rejected.body", trimmed);
    }

    private Member pending(Long memberId) {
        Member member = members.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (!PENDING.equals(member.getKycStatus())) {
            throw new ConflictException("KYC_NOT_PENDING", "error.kyc.not_pending", null,
                    "This identity document is not waiting for review");
        }
        return member;
    }

    private String readableNumber(Member member) {
        String plain = crypto.decrypt(member.getCitizenIdEncrypted());
        return plain != null ? plain : member.getCitizenId();
    }

    private void notify(Long memberId, String titleKey, String bodyKey, String arg) {
        if (notifications == null || messages == null) return;
        notifications.send(memberId, messages.getMessage(titleKey),
                arg == null ? messages.getMessage(bodyKey) : messages.getMessage(bodyKey, arg),
                "system", "member", memberId);
    }
}
