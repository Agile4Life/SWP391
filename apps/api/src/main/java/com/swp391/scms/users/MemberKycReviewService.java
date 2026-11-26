package com.swp391.scms.users;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
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
 * Lễ tân/quản lý duyệt giấy tờ tùy thân trước khi hội viên được mua gói: đối chiếu số giấy tờ đã khai với ảnh
 * chụp.
 *
 * Quầy duyệt giấy tờ định danh trước khi hội viên mua gói: số khai báo được đối chiếu với ảnh. Chỉ lễ tân và
 * quản lý gọi được các phương thức này.
 */
@Service
public class MemberKycReviewService {
    public static final String PENDING = "PENDING";
    public static final String APPROVED = "APPROVED";
    public static final String REJECTED = "REJECTED";

    /**
     * Một hồ sơ chờ duyệt: thông tin hội viên, loại giấy tờ, số giấy tờ đọc được, quốc tịch, ảnh mặt trước/sau
     * và thời điểm nộp.
     *
     * Một hồ sơ đang chờ duyệt, kèm số đọc được để người duyệt so với ảnh.
     */
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

    /** Nhận repository hội viên/người dùng, bộ mã hóa KycCrypto và Clock. */
    public MemberKycReviewService(MemberRepository members, UserRepository users, KycCrypto crypto, Clock clock) {
        this.members = members;
        this.users = users;
        this.crypto = crypto;
        this.clock = clock;
    }

    /** Danh sách hồ sơ PENDING (nộp sớm nhất trước), bỏ tài khoản đã xóa, kèm số giấy tờ đã giải mã. */
    @Transactional(readOnly = true)
    public List<KycReviewDto> listPending() {
        return members.findByKycStatusOrderByKycSubmittedAtAsc(PENDING).stream()
                .filter(m -> m.getUser() != null && m.getUser().getDeletedAt() == null)
                .map(m -> new KycReviewDto(m.getUserId(), m.getMembershipCode(), m.getUser().getFullName(),
                        m.getDocumentType(), readableNumber(m), m.getNationality(), m.getFrontImageUrl(),
                        m.getBackImageUrl(), m.getKycSubmittedAt()))
                .toList();
    }

    /**
     * Duyệt: chặn tự duyệt chính mình, khóa dòng hội viên, kiểm tra trùng mã băm giấy tờ với tài khoản khác,
     * đánh dấu đã xác minh danh tính, lưu thời điểm và người duyệt, xóa lý do từ chối cũ, gửi thông báo cho hội viên.
     */
    @Transactional
    @com.swp391.scms.audit.Audited(action = "MEMBER_KYC_APPROVE", entity = "members")
    public void approve(AuthenticatedPrincipal reviewer, Long memberId) {
        rejectSelfReview(reviewer, memberId);
        Member member = pending(memberId);
        String docHash = member.getCitizenIdHash();
        if (docHash == null || docHash.isBlank()) {
            String plain = readableNumber(member);
            if (plain != null && !plain.isBlank() && !KycCrypto.isMasked(plain)) {
                docHash = crypto.hash(plain);
                member.setCitizenIdHash(docHash);
            }
        }
        if (docHash != null && members.existsByCitizenIdHashAndUserIdNotAndUserDeletedAtIsNull(docHash, memberId)) {
            throw new ConflictException("KYC_DOCUMENT_ALREADY_USED", "invariant.duplicate_resource", null,
                    "This identity document is already registered to another member");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        member.setIdentityVerified(true);
        member.setIdentityVerifiedAt(now);
        member.setKycStatus(APPROVED);
        member.setKycReviewedAt(now);
        member.setKycRejectReason(null);
        if (reviewer != null && reviewer.id() != null) {
            users.findById(reviewer.id()).ifPresent(member::setKycReviewedBy);
        }
        members.save(member);
        notify(memberId, "notifications.kyc.approved.title", "notifications.kyc.approved.body", null);
    }

    /**
     * Từ chối: chặn tự xử lý chính mình, lý do bắt buộc (cắt còn 255 ký tự), khóa dòng hội viên, đánh dấu chưa
     * xác minh, xóa mã băm giấy tờ bị từ chối, lưu người duyệt và gửi thông báo kèm lý do.
     */
    @Transactional
    @com.swp391.scms.audit.Audited(action = "MEMBER_KYC_REJECT", entity = "members")
    public void reject(AuthenticatedPrincipal reviewer, Long memberId, String reason) {
        rejectSelfReview(reviewer, memberId);
        String trimmed = reason == null ? "" : reason.trim();
        if (trimmed.isEmpty()) {
            throw new BadRequestException("KYC_REJECT_REASON_REQUIRED", "error.kyc.reject_reason_required", null,
                    "A reason is required to reject an identity document");
        }
        String truncated = trimmed.length() > 255 ? trimmed.substring(0, 255) : trimmed;
        Member member = pending(memberId);
        LocalDateTime now = LocalDateTime.now(clock);
        member.setIdentityVerified(false);
        member.setKycStatus(REJECTED);
        member.setKycReviewedAt(now);
        member.setKycRejectReason(truncated);
        member.setCitizenIdHash(null);
        if (reviewer != null && reviewer.id() != null) {
            users.findById(reviewer.id()).ifPresent(member::setKycReviewedBy);
        }
        members.save(member);
        notify(memberId, "notifications.kyc.rejected.title", "notifications.kyc.rejected.body", truncated);
    }

    /** Chặn nhân viên tự duyệt hoặc tự từ chối hồ sơ KYC của chính mình. */
    private void rejectSelfReview(AuthenticatedPrincipal reviewer, Long memberId) {
        if (reviewer != null && reviewer.id() != null && reviewer.id().equals(memberId)) {
            throw new ForbiddenException("KYC_SELF_REVIEW_FORBIDDEN", "error.forbidden", null,
                    "Reviewers cannot approve or reject their own KYC submission");
        }
    }

    /** Khóa dòng hội viên chưa bị xóa và bắt buộc hồ sơ đang ở trạng thái PENDING; không thì báo 404/409. */
    private Member pending(Long memberId) {
        Member member = members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        if (member.getUser() == null || member.getUser().getDeletedAt() != null) {
            throw new ResourceNotFoundException("resource.member", memberId);
        }
        if (!PENDING.equals(member.getKycStatus())) {
            throw new ConflictException("KYC_NOT_PENDING", "error.kyc.not_pending", null,
                    "This identity document is not waiting for review");
        }
        return member;
    }

    /** Số giấy tờ đọc được: ưu tiên bản giải mã, dữ liệu cũ chưa mã hóa thì dùng cột thường. */
    private String readableNumber(Member member) {
        String plain = crypto.decrypt(member.getCitizenIdEncrypted());
        return plain != null ? plain : member.getCitizenId();
    }

    /**
     * Gửi thông báo trong ứng dụng cho hội viên với tiêu đề/nội dung đã dịch (bỏ qua nếu không có dịch vụ thông
     * báo).
     */
    private void notify(Long memberId, String titleKey, String bodyKey, String arg) {
        if (notifications == null || messages == null) return;
        notifications.send(memberId, messages.getMessage(titleKey),
                arg == null ? messages.getMessage(bodyKey) : messages.getMessage(bodyKey, arg),
                "system", "member", memberId);
    }
}
