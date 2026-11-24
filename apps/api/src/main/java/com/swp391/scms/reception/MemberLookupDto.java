package com.swp391.scms.reception;

/** Kết quả tra cứu hội viên: id, mã hội viên, họ tên, email, SĐT và trạng thái tài khoản. */
public record MemberLookupDto(Long userId, String membershipCode, String fullName, String email, String phone, String status, Boolean identityVerified, String kycStatus, String documentType, String citizenId) {
    public MemberLookupDto(Long userId, String membershipCode, String fullName, String email, String phone, String status) {
        this(userId, membershipCode, fullName, email, phone, status, false, null, null, null);
    }
}