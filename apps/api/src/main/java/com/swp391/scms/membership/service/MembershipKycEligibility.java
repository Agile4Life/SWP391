package com.swp391.scms.membership.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.entity.Member;
import java.util.Locale;

/** Quy tắc KYC dùng chung khi mua mới; đơn cũ không chứng minh danh tính. */
public final class MembershipKycEligibility {
    private MembershipKycEligibility() {}

    public static void requireVerified(Member member, boolean approvedTrial) {
        // Kiểm tra KYC trước khi ghi giao dịch; gia hạn/nâng cấp giữ quy tắc hiện có.
        if (approvedTrial || (Boolean.TRUE.equals(member.getIdentityVerified())
                && !"PENDING".equals(member.getKycStatus()) && !"REJECTED".equals(member.getKycStatus()))) return;
        String suffix = "PENDING".equals(member.getKycStatus()) ? "pending" : "required";
        throw new BadRequestException("MEMBERSHIP_KYC_" + suffix.toUpperCase(Locale.ROOT),
                "error.membership.kyc_" + suffix, null, null);
    }
}
