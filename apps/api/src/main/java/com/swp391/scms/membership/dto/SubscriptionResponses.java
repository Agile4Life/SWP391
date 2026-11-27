package com.swp391.scms.membership.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Nhóm DTO phản hồi cho gói tập. */
public final class SubscriptionResponses {

    /** Kỳ cha Trial bị ẩn có chủ đích: chỉ dữ liệu kiểm tra quan hệ, không chứa thông tin cá nhân/tài chính. */
    public record TrialAncestorDto(Long id, Long memberId, Long packageId, Long previousSubscriptionId,
                                   LocalDate startDate, LocalDate endDate, String status) {}

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
            /** Đăng ký hoặc gia hạn đang chờ thanh toán: giá niêm yết được chốt khi tạo yêu cầu. */
            java.math.BigDecimal quotedPrice,
            /** Nâng cấp đang chờ thanh toán: giá trị chưa sử dụng của kỳ bị thay thế đã được khấu trừ vào giá. */
            java.math.BigDecimal creditApplied,
            /** Kỳ gói đang hoạt động hôm nay: giá trị chưa sử dụng sẽ được khấu trừ khi nâng cấp (tính từ số tiền thực trả). */
            java.math.BigDecimal remainingValue,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
            List<TrialAncestorDto> excludedTrialAncestors
    ) {
        /** Giữ constructor và response cũ ngoài API candidates. */
        public SubscriptionDto(Long id, Long memberId, Long packageId, String packageName,
                Long previousSubscriptionId, LocalDate startDate, LocalDate endDate, String status,
                String qrCode, LocalDateTime createdAt, String holdStatus, String holdReason,
                LocalDateTime holdRequestedAt, LocalDateTime holdResolvedAt, LocalDate paidThroughDate,
                java.math.BigDecimal upgradeCharge, java.math.BigDecimal quotedPrice,
                java.math.BigDecimal creditApplied, java.math.BigDecimal remainingValue) {
            this(id, memberId, packageId, packageName, previousSubscriptionId, startDate, endDate, status,
                    qrCode, createdAt, holdStatus, holdReason, holdRequestedAt, holdResolvedAt, paidThroughDate,
                    upgradeCharge, quotedPrice, creditApplied, remainingValue, null);
        }

        /** Bổ sung metadata chỉ cho response candidates, không sửa entity hoặc quan hệ đã lưu. */
        public SubscriptionDto withExcludedTrialAncestors(List<TrialAncestorDto> ancestors) {
            return new SubscriptionDto(id, memberId, packageId, packageName, previousSubscriptionId, startDate,
                    endDate, status, qrCode, createdAt, holdStatus, holdReason, holdRequestedAt, holdResolvedAt,
                    paidThroughDate, upgradeCharge, quotedPrice, creditApplied, remainingValue, List.copyOf(ancestors));
        }

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
            LocalDateTime createdAt,
            Long previousSubscriptionId
    ) {}

    /**
     * Một yêu cầu gói tập quầy đã xử lý xong: {@code type} gồm REGISTER, RENEW hoặc UPGRADE; {@code outcome}
     * gồm APPROVED (dòng khoản thu đã settle, có thể đã hoàn) hoặc CANCELLED (chưa từng thanh toán).
     * amount là bí danh paidAmount; giá báo và các khoản hoàn tách riêng, không suy nguồn từ online_wallet.
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
            String processedByName,
            Long paymentId,
            String paymentStatus,
            String actualPaymentMethod,
            java.math.BigDecimal paidAmount,
            java.math.BigDecimal quotedAmount,
            java.math.BigDecimal refundedAmount,
            java.math.BigDecimal lateGatewayRefundedAmount
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
     * Chính sách bảo lưu mà hội viên có thể yêu cầu cho gói này (dùng để điều khiển form yêu cầu): có được bảo lưu
     * không, đã dùng lượt chưa, số ngày tối thiểu/tối đa, số giờ báo trước, số file và dung lượng giấy tờ tối đa.
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
     * Siêu dữ liệu (metadata) của một file giấy tờ y tế đính kèm yêu cầu bảo lưu; nội dung byte được tải qua endpoint riêng.
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
