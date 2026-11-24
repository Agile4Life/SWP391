package com.swp391.scms.reception;

/** Kết quả tra cứu hội viên: id, mã hội viên, họ tên, email, SĐT và trạng thái tài khoản. */
public record MemberLookupDto(Long userId, String membershipCode, String fullName, String email, String phone, String status) {
}