package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.CatalogSeeder;
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
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Gói trải nghiệm 3 ngày miễn phí cho hội viên mới: hội viên gửi yêu cầu kèm giấy tờ, lễ tân duyệt thì tạo kỳ
 * gói dùng thử. Mỗi giấy tờ (theo mã băm) và mỗi tài khoản chỉ được nhận một lần.
 */
@Service
public class MemberTrialService {

    public static final int TRIAL_DAYS = 3;
    static final long MAX_DOCUMENT_IMAGE_BYTES = 2L * 1024 * 1024;

    private final MemberTrialRedemptionRepository trialRedemptions;
    private final MemberRepository members;
    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPackageRepository packages;
    private final NotificationService notifications;
    private final MessageService messageService;
    private final Clock clock;
    private final CccdHasher cccdHasher;
    private final com.swp391.scms.users.KycCrypto kycCrypto;

    @Autowired(required = false)
    private jakarta.persistence.EntityManager entityManager;

    /** Constructor Spring dùng; thông báo, dịch, Clock và bộ mã hóa KYC là tùy chọn. */
    @Autowired
    public MemberTrialService(
            MemberTrialRedemptionRepository trialRedemptions,
            MemberRepository members,
            MembershipSubscriptionRepository subscriptions,
            MembershipPackageRepository packages,
            @Autowired(required = false) NotificationService notifications,
            @Autowired(required = false) MessageService messageService,
            @Autowired(required = false) Clock clock,
            CccdHasher cccdHasher,
            @Autowired(required = false) com.swp391.scms.users.KycCrypto kycCrypto
    ) {
        this.trialRedemptions = trialRedemptions;
        this.members = members;
        this.subscriptions = subscriptions;
        this.packages = packages;
        this.notifications = notifications;
        this.messageService = messageService;
        this.clock = clock != null ? clock : Clock.systemDefaultZone();
        this.cccdHasher = cccdHasher;
        this.kycCrypto = kycCrypto;
    }

    /** Dịch mã thông báo kèm tham số; không có MessageService thì trả lại chính mã. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Trạng thái gói trải nghiệm của hội viên: đã có yêu cầu thì trả theo yêu cầu đó; chưa có thì cho biết có
     * đủ điều kiện không (chỉ khi chưa từng có gói tập nào).
     */
    @Transactional(readOnly = true)
    public TrialStatusDto getTrialStatus(Long memberId) {
        var existing = trialRedemptions.findByMemberUserId(memberId);
        if (existing.isPresent()) {
            return toStatusDto(existing.get());
        }

        boolean hasAnySubscription = subscriptions.existsByMemberUserId(memberId);

        return new TrialStatusDto(
                !hasAnySubscription,
                false,
                "NONE",
                MemberTrialRedemption.DOC_CCCD,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                CatalogSeeder.TRIAL_PACKAGE_NAME,
                1
        );
    }

    /**
     * Kiểm tra số giấy tờ: bắt buộc nhập; hộ chiếu chỉ cho người nước ngoài và gồm 6-15 ký tự chữ số; CCCD phải
     * 9 hoặc 12 chữ số.
     */
    public void validateDocument(String docType, String docNumber, String nationality) {
        if (docNumber == null || docNumber.isBlank()) {
            throw new BadRequestException("TRIAL_DOCUMENT_REQUIRED", "validation.trial.document_number.required", null,
                    msg("validation.trial.document_number.required"));
        }
        String cleanDoc = docNumber.trim();
        if (MemberTrialRedemption.DOC_PASSPORT.equalsIgnoreCase(docType)) {
            if (nationality == null || nationality.isBlank() || isVietnamese(nationality)) {
                throw new BadRequestException("TRIAL_PASSPORT_FOREIGN_ONLY", "trial.passport.foreign_only", null,
                        msg("trial.passport.foreign_only"));
            }
            if (!cleanDoc.matches("^[A-Za-z0-9]{6,15}$")) {
                throw new BadRequestException("TRIAL_PASSPORT_INVALID", "trial.passport.format", null,
                        msg("trial.passport.format"));
            }
        } else {
            // CCCD
            if (!cleanDoc.matches("^(\\d{9}|\\d{12})$")) {
                throw new BadRequestException("TRIAL_CCCD_INVALID", "validation.trial.cccd.format", null,
                        msg("validation.trial.cccd.format"));
            }
        }
    }

    /**
     * Ảnh giấy tờ chỉ nhận ảnh tải lên (JPEG/PNG/WebP, tối đa 2 MB), không bao giờ nhận liên kết ngoài; để trống thì bỏ qua.
     */
    private static void validateDocumentImage(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) return;
        com.swp391.scms.common.image.ImageDataUrlValidator.validate(dataUrl, MAX_DOCUMENT_IMAGE_BYTES,
                "KYC_IMAGE_INVALID", "error.kyc.image_invalid");
    }

    /** Số giấy tờ KYC đã lưu: bản mã hóa nếu có, nếu không thì bản rõ cũ (chưa backfill); bản đã che thì bỏ qua. */
    private String storedDocumentNumber(Member member) {
        if (member.getCitizenIdEncrypted() != null && kycCrypto != null) {
            return kycCrypto.decrypt(member.getCitizenIdEncrypted());
        }
        String plain = member.getCitizenId();
        return plain != null && !com.swp391.scms.users.KycCrypto.isMasked(plain) ? plain : null;
    }

    /** Quốc tịch có phải Việt Nam không (VN, VNM, VIETNAM, VIỆT NAM, VIET NAM). */
    private boolean isVietnamese(String nationality) {
        if (nationality == null) return false;
        String s = nationality.trim().toUpperCase(Locale.ROOT);
        return s.equals("VN") || s.equals("VNM") || s.equals("VIETNAM") || s.equals("VIỆT NAM") || s.equals("VIET NAM");
    }

    /**
     * Gửi yêu cầu gói trải nghiệm: chỉ hội viên chưa từng có gói. Không nhập số giấy tờ thì dùng lại KYC đã nộp
     * (đang chờ hoặc đã duyệt). Kiểm tra họ tên, giấy tờ, ảnh; số giấy tờ không được tài khoản khác dùng (so
     * bằng mã băm). Yêu cầu bị từ chối trước đó được cập nhật để duyệt lại; đang chờ hoặc đã duyệt thì báo
     * trùng. Lưu mã băm, 4 số cuối và bản mã hóa số giấy tờ, rồi gửi thông báo đã nhận yêu cầu.
     */
    @Transactional
    public TrialStatusDto requestTrial(AuthenticatedPrincipal principal, TrialClaimRequest request) {
        if (principal == null || principal.id() == null) {
            throw new BadRequestException("AUTH_REQUIRED", "error.unauthorized", null, "Authentication required");
        }
        Long memberId = principal.id();
        String docType = request.resolvedDocumentType();
        String docNumber = request.resolvedDocumentNumber();
        String fullName = request.fullName() != null ? request.fullName().trim() : "";
        String nationality = request.nationality() != null ? request.nationality().trim() : null;
        String frontImageUrl = request.frontImageUrl() != null ? request.frontImageUrl().trim() : null;
        String backImageUrl = request.backImageUrl() != null ? request.backImageUrl().trim() : null;

        // 2. Chỉ hội viên chưa từng có gói tập nào mới được gửi yêu cầu trải nghiệm
        if (subscriptions.existsByMemberUserId(memberId)) {
            throw new ConflictException("TRIAL_NOT_NEW_MEMBER", "trial.not_new_member", null,
                    msg("trial.not_new_member"));
        }

        Member member = null;
        if (docNumber.isBlank()) {
            member = members.findById(memberId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
            // Nếu hội viên đã nộp KYC trước đó (PENDING hoặc APPROVED) và chưa nhập lại số giấy tờ, tái sử dụng KYC đã lưu
            // Cùng điều kiện với giao diện (MemberPackagesPage.hasReusableKyc): có trạng thái hợp lệ và có số giấy tờ đã lưu.
            boolean hasReusableKyc = Boolean.TRUE.equals(member.getIdentityVerified())
                    || "APPROVED".equalsIgnoreCase(member.getKycStatus())
                    || "PENDING".equalsIgnoreCase(member.getKycStatus());
            if (hasReusableKyc) {
                String decryptedDoc = storedDocumentNumber(member);
                if (decryptedDoc != null && !decryptedDoc.isBlank()) {
                    docNumber = decryptedDoc.trim();
                    if (member.getDocumentType() != null && !member.getDocumentType().isBlank()) {
                        docType = member.getDocumentType().trim().toUpperCase(Locale.ROOT);
                    }
                    if (nationality == null || nationality.isBlank()) {
                        nationality = member.getNationality();
                    }
                    if (fullName.isBlank() && member.getUser() != null && member.getUser().getFullName() != null) {
                        fullName = member.getUser().getFullName().trim();
                    }
                    if (frontImageUrl == null || frontImageUrl.isBlank()) {
                        frontImageUrl = member.getFrontImageUrl();
                    }
                    if (backImageUrl == null || backImageUrl.isBlank()) {
                        backImageUrl = member.getBackImageUrl();
                    }
                }
            }
        }

        if (fullName.isBlank()) {
            throw new BadRequestException("TRIAL_FULL_NAME_REQUIRED", "validation.trial.full_name.required", null,
                    msg("validation.trial.full_name.required"));
        }

        // 1. Kiểm tra định dạng giấy tờ & quốc tịch
        validateDocument(docType, docNumber, nationality);
        validateDocumentImage(frontImageUrl);
        validateDocumentImage(backImageUrl);
        // Chuẩn hóa in hoa trước khi băm/mã hóa để hộ chiếu khác chữ hoa/thường không lách ràng buộc trùng lặp.
        docNumber = docNumber.trim().toUpperCase(Locale.ROOT);

        if (member == null) {
            member = members.findById(memberId)
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        }

        String docHash = cccdHasher.hash(docNumber);

        // 3. Kiểm tra số giấy tờ này đã được tài khoản khác sử dụng chưa
        if (trialRedemptions.existsByCccdHashAndMemberUserIdNot(docHash, memberId)) {
            throw new ConflictException("TRIAL_DOCUMENT_ALREADY_USED", "trial.already_claimed.document", null,
                    msg("trial.already_claimed.document"));
        }

        // 4. Kiểm tra đơn yêu cầu của chính hội viên này
        var existingOpt = trialRedemptions.findByMemberUserId(memberId);
        MemberTrialRedemption redemption;
        if (existingOpt.isPresent()) {
            redemption = existingOpt.get();
            if (MemberTrialRedemption.STATUS_APPROVED.equalsIgnoreCase(redemption.getStatus())) {
                throw new ConflictException("TRIAL_ALREADY_CLAIMED", "trial.already_claimed.member", null,
                        msg("trial.already_claimed.member"));
            }
            if (MemberTrialRedemption.STATUS_PENDING.equalsIgnoreCase(redemption.getStatus())) {
                throw new ConflictException("TRIAL_REQUEST_PENDING", "trial.request.already_pending", null,
                        msg("trial.request.already_pending"));
            }
            // Nếu đơn trước bị REJECTED: cập nhật lại thông tin mới để Lễ tân duyệt lại
            redemption.setDocumentType(docType);
            redemption.setCccdHash(docHash);
            redemption.setCccdLast4(cccdHasher.last4(docNumber));
            redemption.setDocumentNumberEnc(cccdHasher.encrypt(docNumber));
            redemption.setFullName(fullName);
            redemption.setNationality(nationality);
            redemption.setFrontImageUrl(frontImageUrl);
            redemption.setBackImageUrl(backImageUrl);
            redemption.setStatus(MemberTrialRedemption.STATUS_PENDING);
            redemption.setRejectionReason(null);
            redemption.setReviewedBy(null);
            redemption.setReviewedAt(null);
            redemption.setRedeemedAt(LocalDateTime.now(clock));
        } else {
            // Kiểm tra hash trên toàn bộ nếu chưa có bản ghi của member
            if (trialRedemptions.existsByCccdHash(docHash)) {
                throw new ConflictException("TRIAL_DOCUMENT_ALREADY_USED", "trial.already_claimed.document", null,
                        msg("trial.already_claimed.document"));
            }
            redemption = new MemberTrialRedemption();
            redemption.setMember(member);
            redemption.setDocumentType(docType);
            redemption.setCccdHash(docHash);
            redemption.setCccdLast4(cccdHasher.last4(docNumber));
            redemption.setDocumentNumberEnc(cccdHasher.encrypt(docNumber));
            redemption.setFullName(fullName);
            redemption.setNationality(nationality);
            redemption.setFrontImageUrl(frontImageUrl);
            redemption.setBackImageUrl(backImageUrl);
            redemption.setStatus(MemberTrialRedemption.STATUS_PENDING);
            redemption.setRedeemedAt(LocalDateTime.now(clock));
        }

        MemberTrialRedemption saved;
        try {
            saved = trialRedemptions.saveAndFlush(redemption);
        } catch (DataIntegrityViolationException e) {
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof org.hibernate.exception.ConstraintViolationException constraint) {
                    if ("uq_trial_cccd_hash".equalsIgnoreCase(constraint.getConstraintName())) {
                        throw new ConflictException("TRIAL_DOCUMENT_ALREADY_USED", "trial.already_claimed.document", null,
                                msg("trial.already_claimed.document"));
                    }
                    if ("uq_trial_member".equalsIgnoreCase(constraint.getConstraintName())) {
                        throw new ConflictException("TRIAL_ALREADY_CLAIMED", "trial.already_claimed.member", null,
                                msg("trial.already_claimed.member"));
                    }
                }
            }
            throw e;
        }

        if (notifications != null) {
            notifications.send(
                    memberId,
                    msg("trial.request.submitted_title"),
                    msg("trial.request.submitted_body"),
                    "system",
                    "member_trial_redemption",
                    saved.getId()
            );
        }

        if (notifications != null) notifications.notifyReceptionists("trial", saved.getId());
        return toStatusDto(saved);
    }

    /** Lễ tân duyệt yêu cầu gói trải nghiệm và trả thông tin yêu cầu sau khi duyệt. */
    @Transactional
    public ReceptionTrialDto approveTrial(AuthenticatedPrincipal reviewer, Long trialId) {
        MembershipSubscription savedSub = approveTrialInternal(reviewer, trialId);
        MemberTrialRedemption updated = trialRedemptions.findById(trialId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.trial", trialId));
        return toReceptionDto(updated);
    }

    /**
     * Duyệt: yêu cầu không được đã duyệt hoặc đang bị từ chối. Đồng bộ họ tên và giấy tờ sang hồ sơ hội viên
     * (đánh dấu đã xác minh), tìm gói trải nghiệm (không có thì dùng gói Gold), tạo kỳ gói active 3 ngày từ hôm
     * nay với mã QR mới, xóa bản mã hóa số giấy tờ, lưu người duyệt và gửi thông báo.
     */
    private MembershipSubscription approveTrialInternal(AuthenticatedPrincipal reviewer, Long trialId) {
        MemberTrialRedemption lookup = trialRedemptions.findById(trialId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.trial", trialId));
        if (lookup.getMember() == null || lookup.getMember().getUserId() == null) {
            throw new ResourceNotFoundException("resource.member", trialId);
        }
        Long memberId = lookup.getMember().getUserId();
        Member member = members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
        MemberTrialRedemption redemption = trialRedemptions.findByIdForUpdate(trialId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.trial", trialId));
        if (entityManager != null) {
            entityManager.refresh(member);
            entityManager.refresh(redemption);
        }

        if (MemberTrialRedemption.STATUS_APPROVED.equalsIgnoreCase(redemption.getStatus())) {
            throw new ConflictException("TRIAL_ALREADY_APPROVED", "trial.already_approved", null,
                    "Đơn đăng ký gói trải nghiệm này đã được phê duyệt trước đó.");
        }
        // Yêu cầu đã bị từ chối không còn giữ chỗ giấy tờ; hội viên phải nộp lại trước khi có thể được duyệt.
        if (MemberTrialRedemption.STATUS_REJECTED.equalsIgnoreCase(redemption.getStatus())) {
            throw new ConflictException("TRIAL_REJECTED_RESUBMIT", "trial.rejected.resubmit_required", null,
                    "Rejected request: the member must resubmit it first.");
        }
        // Kiểm tra lại dưới khóa hội viên phòng trường hợp hội viên đã mua gói trả phí trong lúc chờ duyệt.
        if (subscriptions.existsByMemberUserId(member.getUserId())) {
            throw new ConflictException("TRIAL_NOT_NEW_MEMBER", "trial.not_new_member", null,
                    msg("trial.not_new_member"));
        }

        // Đồng bộ họ tên User theo họ tên trên giấy tờ đã xác minh
        if (member.getUser() != null) {
            member.getUser().setFullName(redemption.getFullName());
        }
        member.setDocumentType(redemption.getDocumentType());
        String plainDoc = cccdHasher.decrypt(redemption.getDocumentNumberEnc());
        if (plainDoc != null && !plainDoc.isBlank()) {
            String normalizedDoc = plainDoc.trim().toUpperCase(Locale.ROOT);
            member.setCitizenId(com.swp391.scms.users.KycCrypto.mask(normalizedDoc));
            if (kycCrypto != null) {
                member.setCitizenIdEncrypted(kycCrypto.encrypt(normalizedDoc));
            }
        } else if (redemption.getCccdLast4() != null && !redemption.getCccdLast4().isBlank()) {
            member.setCitizenId(com.swp391.scms.users.KycCrypto.mask(redemption.getCccdLast4()));
        }
        member.setNationality(redemption.getNationality());
        member.setFrontImageUrl(redemption.getFrontImageUrl());
        member.setBackImageUrl(redemption.getBackImageUrl());
        // Trial đã đối chiếu giấy tờ: đồng bộ trạng thái để Member và POS không còn hiển thị chờ duyệt.
        member.setKycStatus("APPROVED");
        member.setKycRejectReason(null);
        member.setIdentityVerified(true);
        member.setIdentityVerifiedAt(LocalDateTime.now(clock));

        // Tìm gói tập trải nghiệm 3 ngày (fallback gói Gold nếu chưa seed)
        MembershipPackage trialPkg = packages.findByStatusOrderByPriceAsc("active").stream()
                .filter(p -> CatalogSeeder.TRIAL_PACKAGE_NAME.equalsIgnoreCase(p.getName())
                        || (p.getDurationDays() == 3 && p.getPrice().compareTo(BigDecimal.ZERO) == 0))
                .findFirst()
                .orElseGet(() -> packages.findByStatusOrderByPriceAsc("active").stream()
                        .filter(p -> CatalogSeeder.GOLD_NAME.equalsIgnoreCase(p.getName()))
                        .findFirst()
                        .orElseThrow(() -> new ResourceNotFoundException("resource.package", CatalogSeeder.TRIAL_PACKAGE_NAME)));

        LocalDate today = LocalDate.now(clock);
        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(trialPkg);
        subscription.setStartDate(today);
        subscription.setEndDate(today.plusDays(TRIAL_DAYS - 1L));
        subscription.setStatus("active");
        subscription.setUpgradeCharge(BigDecimal.ZERO);
        subscription.setQrCode(UUID.randomUUID().toString());

        MembershipSubscription savedSub = subscriptions.saveAndFlush(subscription);

        redemption.setSubscription(savedSub);
        redemption.setStatus(MemberTrialRedemption.STATUS_APPROVED);
        redemption.setDocumentNumberEnc(null);
        redemption.setReviewedBy(reviewer != null ? reviewer.id() : null);
        redemption.setReviewedAt(LocalDateTime.now(clock));
        trialRedemptions.saveAndFlush(redemption);

        if (notifications != null) {
            notifications.send(
                    member.getUserId(),
                    msg("trial.approved.title"),
                    msg("trial.approved.body"),
                    "system",
                    "membership_subscription",
                    savedSub.getId()
            );
        }

        return savedSub;
    }

    /**
     * Từ chối yêu cầu (không áp dụng cho yêu cầu đã duyệt): lưu lý do (mặc định "thông tin giấy tờ không
     * khớp"), xóa bản mã hóa và thay mã băm bằng giá trị giả để giấy tờ không bị giữ chỗ (phòng trường hợp ai
     * đó dùng giấy tờ người khác), rồi gửi thông báo kèm lý do.
     */
    @Transactional
    public ReceptionTrialDto rejectTrial(AuthenticatedPrincipal reviewer, Long trialId, String reason) {
        MemberTrialRedemption lookup = trialRedemptions.findById(trialId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.trial", trialId));
        if (lookup.getMember() != null && lookup.getMember().getUserId() != null) {
            members.findByUserIdForUpdate(lookup.getMember().getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.member", lookup.getMember().getUserId()));
        }
        MemberTrialRedemption redemption = trialRedemptions.findByIdForUpdate(trialId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.trial", trialId));
        if (entityManager != null) {
            entityManager.refresh(redemption);
        }

        if (MemberTrialRedemption.STATUS_APPROVED.equalsIgnoreCase(redemption.getStatus())) {
            throw new ConflictException("TRIAL_ALREADY_APPROVED", "trial.already_approved", null,
                    "Không thể từ chối đơn đăng ký đã được phê duyệt.");
        }

        String rejectionReason = (reason != null && !reason.isBlank()) ? reason.trim() : "Thông tin giấy tờ không khớp";
        redemption.setStatus(MemberTrialRedemption.STATUS_REJECTED);
        redemption.setDocumentNumberEnc(null);
        // Giấy tờ bị từ chối không được giữ chỗ: có thể ai đó đã gửi giấy tờ của người khác. Chủ sở hữu vẫn có thể
        // nộp lại, khi đó hệ thống sẽ ghi lại mã băm thật.
        redemption.setCccdHash("rejected-" + redemption.getId());
        redemption.setRejectionReason(rejectionReason);
        redemption.setReviewedBy(reviewer != null ? reviewer.id() : null);
        redemption.setReviewedAt(LocalDateTime.now(clock));

        MemberTrialRedemption saved = trialRedemptions.saveAndFlush(redemption);

        if (notifications != null && redemption.getMember() != null) {
            notifications.send(
                    redemption.getMember().getUserId(),
                    msg("trial.rejected.title"),
                    msg("trial.rejected.body", rejectionReason),
                    "system",
                    "member_trial_redemption",
                    saved.getId()
            );
        }

        return toReceptionDto(saved);
    }

    /**
     * Danh sách yêu cầu gói trải nghiệm cho quầy (mới nhất trước), lọc theo trạng thái và tìm theo họ tên, 4 số
     * cuối giấy tờ, mã hội viên, email hoặc SĐT.
     */
    @Transactional(readOnly = true)
    public List<ReceptionTrialDto> listTrials(String status, String search) {
        List<MemberTrialRedemption> list;
        if (status != null && !status.isBlank()) {
            list = trialRedemptions.findByStatusOrderByRedeemedAtDesc(status.trim().toUpperCase(Locale.ROOT));
        } else {
            list = trialRedemptions.findAllByOrderByRedeemedAtDesc();
        }

        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase(Locale.ROOT);
            list = list.stream().filter(r -> {
                String name = r.getFullName() != null ? r.getFullName().toLowerCase(Locale.ROOT) : "";
                String last4 = r.getCccdLast4() != null ? r.getCccdLast4() : "";
                Member m = r.getMember();
                User u = m != null ? m.getUser() : null;
                String code = m != null && m.getMembershipCode() != null ? m.getMembershipCode().toLowerCase(Locale.ROOT) : "";
                String email = u != null && u.getEmail() != null ? u.getEmail().toLowerCase(Locale.ROOT) : "";
                String phone = u != null && u.getPhone() != null ? u.getPhone().toLowerCase(Locale.ROOT) : "";
                return name.contains(q) || last4.contains(q) || code.contains(q) || email.contains(q) || phone.contains(q);
            }).toList();
        }

        return list.stream().map(this::toReceptionDto).toList();
    }

    /**
     * Phương thức nhận gói trải nghiệm tương thích ngược để kích hoạt trực tiếp (không qua duyệt): kiểm tra
     * chưa nhận, giấy tờ chưa dùng, hội viên chưa có gói, rồi tạo kỳ gói 3 ngày và bản ghi nhận gói.
     */
    @Transactional
    public SubscriptionDto claimGoldTrial(AuthenticatedPrincipal principal, TrialClaimRequest request) {
        if (principal == null || principal.id() == null) {
            throw new BadRequestException("AUTH_REQUIRED", "error.unauthorized", null, "Authentication required");
        }
        Long memberId = principal.id();
        String cccd = request.resolvedDocumentNumber().trim().toUpperCase(Locale.ROOT);
        String cccdHash = cccdHasher.hash(cccd);
        String fullName = request.fullName().trim();

        if (trialRedemptions.existsByMemberUserId(memberId)) {
            throw new ConflictException("TRIAL_ALREADY_CLAIMED", "trial.already_claimed.member", null,
                    msg("trial.already_claimed.member"));
        }

        if (trialRedemptions.existsByCccdHash(cccdHash)) {
            throw new ConflictException("TRIAL_CCCD_ALREADY_USED", "trial.already_claimed.cccd", null,
                    msg("trial.already_claimed.cccd"));
        }

        if (subscriptions.existsByMemberUserId(memberId)) {
            throw new ConflictException("TRIAL_NOT_NEW_MEMBER", "trial.not_new_member", null,
                    msg("trial.not_new_member"));
        }

        LocalDate today = LocalDate.now(clock);
        Member member = members.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));

        MembershipPackage trialPkg = packages.findByStatusOrderByPriceAsc("active").stream()
                .filter(p -> CatalogSeeder.TRIAL_PACKAGE_NAME.equalsIgnoreCase(p.getName())
                        || (p.getDurationDays() == 3 && p.getPrice().compareTo(BigDecimal.ZERO) == 0))
                .findFirst()
                .orElseGet(() -> packages.findByStatusOrderByPriceAsc("active").stream()
                        .filter(p -> CatalogSeeder.GOLD_NAME.equalsIgnoreCase(p.getName()))
                        .findFirst()
                        .orElseThrow(() -> new ResourceNotFoundException("resource.package", CatalogSeeder.TRIAL_PACKAGE_NAME)));

        MembershipSubscription subscription = new MembershipSubscription();
        subscription.setMember(member);
        subscription.setMembershipPackage(trialPkg);
        subscription.setStartDate(today);
        subscription.setEndDate(today.plusDays(TRIAL_DAYS - 1L));
        subscription.setStatus("active");
        subscription.setUpgradeCharge(BigDecimal.ZERO);
        subscription.setQrCode(UUID.randomUUID().toString());

        MembershipSubscription savedSub;
        try {
            savedSub = subscriptions.saveAndFlush(subscription);
            MemberTrialRedemption redemption = new MemberTrialRedemption(member, cccdHash, cccdHasher.last4(cccd), fullName, savedSub);
            trialRedemptions.saveAndFlush(redemption);
        } catch (DataIntegrityViolationException e) {
            for (Throwable cause = e; cause != null; cause = cause.getCause()) {
                if (cause instanceof org.hibernate.exception.ConstraintViolationException constraint) {
                    if ("uq_trial_cccd_hash".equalsIgnoreCase(constraint.getConstraintName())) {
                        throw new ConflictException("TRIAL_CCCD_ALREADY_USED", "trial.already_claimed.cccd", null,
                                msg("trial.already_claimed.cccd"));
                    }
                    if ("uq_trial_member".equalsIgnoreCase(constraint.getConstraintName())) {
                        throw new ConflictException("TRIAL_ALREADY_CLAIMED", "trial.already_claimed.member", null,
                                msg("trial.already_claimed.member"));
                    }
                }
            }
            throw e;
        }

        if (notifications != null) {
            notifications.send(
                    memberId,
                    msg("trial.claimed.title"),
                    msg("trial.claimed.success"),
                    "system",
                    "membership_subscription",
                    savedSub.getId()
            );
        }

        return toSubscriptionDto(savedSub);
    }

    /**
     * Chuyển yêu cầu sang TrialStatusDto cho hội viên (số giấy tờ chỉ hiện dạng che); dữ liệu cũ thiếu trạng
     * thái thì suy ra từ việc đã có kỳ gói hay chưa.
     */
    private TrialStatusDto toStatusDto(MemberTrialRedemption r) {
        String effectiveStatus = r.getStatus() != null
                ? r.getStatus()
                : (r.getSubscription() != null ? MemberTrialRedemption.STATUS_APPROVED : MemberTrialRedemption.STATUS_PENDING);
        String effectiveDocType = r.getDocumentType() != null
                ? r.getDocumentType()
                : MemberTrialRedemption.DOC_CCCD;
        boolean isApproved = MemberTrialRedemption.STATUS_APPROVED.equalsIgnoreCase(effectiveStatus);
        return new TrialStatusDto(
                false,
                isApproved,
                effectiveStatus,
                effectiveDocType,
                cccdHasher.mask(r.getCccdLast4()),
                r.getFullName(),
                r.getNationality(),
                r.getFrontImageUrl(),
                r.getBackImageUrl(),
                r.getRejectionReason(),
                r.getRedeemedAt(),
                r.getSubscription() != null ? r.getSubscription().getId() : null,
                CatalogSeeder.TRIAL_PACKAGE_NAME,
                1
        );
    }

    /** Chuyển yêu cầu sang ReceptionTrialDto cho màn hình quầy, kèm thông tin hội viên và người duyệt. */
    private ReceptionTrialDto toReceptionDto(MemberTrialRedemption r) {
        Member m = r.getMember();
        User u = m != null ? m.getUser() : null;
        MembershipSubscription s = r.getSubscription();
        String effectiveStatus = r.getStatus() != null
                ? r.getStatus()
                : (s != null ? MemberTrialRedemption.STATUS_APPROVED : MemberTrialRedemption.STATUS_PENDING);
        String effectiveDocType = r.getDocumentType() != null
                ? r.getDocumentType()
                : MemberTrialRedemption.DOC_CCCD;
        return new ReceptionTrialDto(
                r.getId(),
                m != null ? m.getUserId() : null,
                m != null ? m.getMembershipCode() : null,
                u != null ? u.getFullName() : r.getFullName(),
                u != null ? u.getEmail() : null,
                u != null ? u.getPhone() : null,
                effectiveDocType,
                cccdHasher.mask(r.getCccdLast4()),
                MemberTrialRedemption.STATUS_PENDING.equalsIgnoreCase(effectiveStatus) ? cccdHasher.decrypt(r.getDocumentNumberEnc()) : null,
                r.getFullName(),
                r.getNationality(),
                r.getFrontImageUrl(),
                r.getBackImageUrl(),
                effectiveStatus,
                r.getRedeemedAt(),
                r.getReviewedBy(),
                r.getReviewedAt(),
                r.getRejectionReason(),
                s != null ? s.getId() : null,
                s != null ? s.getStartDate() : null,
                s != null ? s.getEndDate() : null,
                s != null ? s.getStatus() : null
        );
    }

    /** Chuyển kỳ gói trải nghiệm sang SubscriptionDto. */
    private SubscriptionDto toSubscriptionDto(MembershipSubscription s) {
        return new SubscriptionDto(
                s.getId(),
                s.getMember() != null ? s.getMember().getUserId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getId() : null,
                s.getMembershipPackage() != null ? s.getMembershipPackage().getName() : null,
                s.getPreviousSubscription() != null ? s.getPreviousSubscription().getId() : null,
                s.getStartDate(),
                s.getEndDate(),
                s.getStatus(),
                s.getQrCode(),
                s.getCreatedAt(),
                s.getHoldStatus(),
                s.getHoldReason(),
                s.getHoldRequestedAt(),
                s.getHoldResolvedAt(),
                s.getEndDate(),
                s.getUpgradeCharge()
        );
    }
}
