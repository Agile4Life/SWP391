package com.swp391.scms.membership.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Nhóm DTO phản hồi cho gói tập. */
public final class SubscriptionResponses {

    /** Lớp chỉ chứa các record, không cho tạo đối tượng. */
    private SubscriptionResponses() {}

    /**
     * Một kỳ gói trả cho client: gói, kỳ trước trong chuỗi, thời hạn, trạng thái, mã QR, thông tin bảo lưu,
     * ngày hết hạn thực tế đã trả, phí nâng cấp, giá chốt, phần quy đổi đã trừ và giá trị còn lại.
     */
    public record SubscriptionDto(
            Long id,
            Long memberId,
            Long packageId,
            String packageName,
            Long previousSubscriptionId,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            String qrCode,
            LocalDateTime createdAt,
            String holdStatus,
            String holdReason,
            LocalDateTime holdRequestedAt,
            LocalDateTime holdResolvedAt,
            LocalDate paidThroughDate,
            java.math.BigDecimal upgradeCharge,
            /** Pending registration or renewal: catalog price fixed when the request was made. */
            java.math.BigDecimal quotedPrice,
            /** Pending upgrade: unused value of the replaced period already deducted from the price. */
            java.math.BigDecimal creditApplied,
            /** Period active today: unused value that an upgrade would deduct (from the amount actually paid). */
            java.math.BigDecimal remainingValue
    ) {
        /** Constructor rút gọn không có giá chốt, phần quy đổi và giá trị còn lại. */
        public SubscriptionDto(Long id, Long memberId, Long packageId, String packageName,
                Long previousSubscriptionId, LocalDate startDate, LocalDate endDate, String status,
                String qrCode, LocalDateTime createdAt, String holdStatus, String holdReason,
                LocalDateTime holdRequestedAt, LocalDateTime holdResolvedAt, LocalDate paidThroughDate,
                java.math.BigDecimal upgradeCharge) {
            this(id, memberId, packageId, packageName, previousSubscriptionId, startDate, endDate, status, qrCode,
                    createdAt, holdStatus, holdReason, holdRequestedAt, holdResolvedAt, paidThroughDate, upgradeCharge,
                    null, null, null);
        }

        /** Constructor rút gọn không có phí nâng cấp. */
        public SubscriptionDto(Long id, Long memberId, Long packageId, String packageName,
                Long previousSubscriptionId, LocalDate startDate, LocalDate endDate, String status,
                String qrCode, LocalDateTime createdAt, String holdStatus, String holdReason,
                LocalDateTime holdRequestedAt, LocalDateTime holdResolvedAt, LocalDate paidThroughDate) {
            this(id, memberId, packageId, packageName, previousSubscriptionId, startDate, endDate,
                    status, qrCode, createdAt, holdStatus, holdReason, holdRequestedAt, holdResolvedAt, paidThroughDate, null, null, null, null);
        }

        /** Constructor rút gọn không có ngày hết hạn thực tế. */
        public SubscriptionDto(Long id, Long memberId, Long packageId, String packageName,
                Long previousSubscriptionId, LocalDate startDate, LocalDate endDate, String status,
                String qrCode, LocalDateTime createdAt, String holdStatus, String holdReason,
                LocalDateTime holdRequestedAt, LocalDateTime holdResolvedAt) {
            this(id, memberId, packageId, packageName, previousSubscriptionId, startDate, endDate,
                    status, qrCode, createdAt, holdStatus, holdReason, holdRequestedAt, holdResolvedAt, null, null, null, null, null);
        }

        /** Constructor rút gọn chỉ có thông tin kỳ gói cơ bản. */
        public SubscriptionDto(
                Long id,
                Long memberId,
                Long packageId,
                String packageName,
                Long previousSubscriptionId,
                LocalDate startDate,
                LocalDate endDate,
                String status,
                String qrCode,
                LocalDateTime createdAt) {
            this(id, memberId, packageId, packageName, previousSubscriptionId, startDate, endDate, status, qrCode, createdAt, null, null, null, null);
        }
    }

    /**
     * Kỳ gói chờ thanh toán ở quầy: hội viên (mã, tên, email, SĐT), gói, số tiền cần thu, thời hạn, trạng thái
     * và thời điểm tạo.
     */
    public record PendingSubscriptionDto(
            Long id,
            Long memberId,
            String membershipCode,
            String memberName,
            String memberEmail,
            String memberPhone,
            Long packageId,
            String packageName,
            Integer durationDays,
            java.math.BigDecimal packagePrice,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            LocalDateTime createdAt
    ) {}

    /**
     * Một yêu cầu gói tập quầy đã xử lý: loại (REGISTER, RENEW, UPGRADE), kết quả (APPROVED đã thanh toán,
     * CANCELLED đã rút trước khi thanh toán), hội viên, gói mới/cũ, số tiền, phương thức, thời điểm và người xử
     * lý.
     *
     * A membership request the desk has finished with: {@code type} REGISTER, RENEW or UPGRADE; {@code outcome}
     * APPROVED (paid and activated) or CANCELLED (withdrawn before payment).
     */
    public record RequestHistoryDto(
            Long subscriptionId,
            String type,
            String outcome,
            Long memberId,
            String membershipCode,
            String memberName,
            String packageName,
            String previousPackageName,
            java.math.BigDecimal amount,
            String paymentMethod,
            LocalDateTime processedAt,
            String processedByName
    ) {}

    /**
     * Yêu cầu bảo lưu hiển thị ở quầy/hội viên: hội viên, gói, thời hạn, trạng thái gói và bảo lưu, lý do, các
     * mốc thời gian, số lịch đã hủy, khoảng bảo lưu, giấy tờ và lý do từ chối.
     */
    public record HoldRequestDto(
            Long id,
            Long memberId,
            String membershipCode,
            String memberName,
            String memberEmail,
            String memberPhone,
            Long packageId,
            String packageName,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            String holdStatus,
            String holdReason,
            LocalDateTime holdRequestedAt,
            LocalDateTime holdResolvedAt,
            int cancelledEnrollmentsCount,
            LocalDate holdStartDate,
            LocalDate holdEndDate,
            List<HoldDocumentDto> documents,
            String holdRejectionReason
    ) {
        /** Constructor rút gọn không có khoảng bảo lưu, giấy tờ và lý do từ chối. */
        public HoldRequestDto(Long id, Long memberId, String membershipCode, String memberName, String memberEmail,
                String memberPhone, Long packageId, String packageName, LocalDate startDate, LocalDate endDate,
                String status, String holdStatus, String holdReason, LocalDateTime holdRequestedAt,
                LocalDateTime holdResolvedAt, int cancelledEnrollmentsCount) {
            this(id, memberId, membershipCode, memberName, memberEmail, memberPhone, packageId, packageName, startDate,
                    endDate, status, holdStatus, holdReason, holdRequestedAt, holdResolvedAt, cancelledEnrollmentsCount,
                    null, null, List.of(), null);
        }
    }

    /**
     * Chính sách bảo lưu của gói (dùng để dựng form): có được bảo lưu không, đã dùng lượt chưa, số ngày tối
     * thiểu/tối đa, số giờ báo trước, số file và dung lượng giấy tờ tối đa.
     *
     * What a member may ask for when putting this subscription on hold; drives the request form.
     */
    public record HoldPolicyDto(
            boolean allowed,
            boolean alreadyUsed,
            int minDays,
            int maxDays,
            int noticeHours,
            int maxDocuments,
            long maxDocumentBytes
    ) {}

    /**
     * Thông tin một file giấy tờ bảo lưu (không kèm nội dung; tải qua endpoint riêng).
     *
     * Metadata of a medical document attached to a hold request; the bytes are fetched through the download endpoint.
     */
    public record HoldDocumentDto(
            Long id,
            String fileName,
            String contentType,
            long sizeBytes,
            LocalDateTime uploadedAt
    ) {}

    /** Mã QR động để check-in: chuỗi QR, thời gian sống (giây) và thời điểm tạo. */
    public record DynamicQrDto(
            String qrCode,
            long expiresInSeconds,
            LocalDateTime generatedAt
    ) {}
}
