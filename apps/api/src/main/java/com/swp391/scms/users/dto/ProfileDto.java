package com.swp391.scms.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Hồ sơ cá nhân đầy đủ trả cho client: thông tin chung, phần hội viên (mã, sức khỏe, mục tiêu, trình độ, liên
 * hệ khẩn cấp, giấy tờ KYC), phần HLV (chuyên môn, giới thiệu, chứng chỉ) và phần lễ tân (ca làm).
 */
public record ProfileDto(
    Long userId,
    @NotBlank(message = "{validation.users.full_name.not_blank}")
    @Size(max = 150, message = "{validation.users.full_name.size}")
    String fullName,
    @Email(message = "{validation.users.email.invalid}")
    String email,
    @jakarta.validation.constraints.Pattern(regexp = "^\\s*$|^(0|\\+84)(3|5|7|8|9)[0-9]{8}$", message = "{validation.users.phone.invalid}")
    @Size(max = 20, message = "{validation.users.phone.size}")
    String phone,
    LocalDate dob,
    String gender,
    @Size(max = 2800000)
    String avatarUrl,
    @Size(max = 255)
    String address,
    String membershipCode,
    @Size(max = 255)
    String healthNotes,
    @Size(max = 255)
    String fitnessGoal,
    String fitnessLevel,
    @Size(max = 100)
    String emergencyContactName,
    @Size(max = 20, message = "{validation.users.phone.size}")
    String emergencyContactPhone,
    @Size(max = 150, message = "{validation.users.coach.specialization.max}")
    String specialization,
    String bio,
    @Size(max = 255, message = "{validation.users.coach.certification.max}")
    String certification,
    @Size(max = 50, message = "{validation.users.receptionist.shift.max}")
    String shift,
    String documentType,
    String citizenId,
    String nationality,
    String frontImageUrl,
    String backImageUrl,
    Boolean identityVerified,
    /** PENDING, APPROVED hoặc REJECTED; null với hội viên được xác minh trước khi có bước duyệt. */
    String kycStatus,
    String kycRejectReason
) {
    /** Constructor rút gọn không có các trường KYC (dùng ở code cũ và test). */
    public ProfileDto(
        Long userId, String fullName, String email, String phone, LocalDate dob, String gender, String avatarUrl,
        String address, String membershipCode, String healthNotes, String fitnessGoal, String fitnessLevel,
        String emergencyContactName, String emergencyContactPhone, String specialization, String bio,
        String certification, String shift, String documentType, String citizenId, String nationality,
        String frontImageUrl, String backImageUrl, Boolean identityVerified
    ) {
        this(userId, fullName, email, phone, dob, gender, avatarUrl, address, membershipCode, healthNotes, fitnessGoal,
            fitnessLevel, emergencyContactName, emergencyContactPhone, specialization, bio, certification,
            shift, documentType, citizenId, nationality, frontImageUrl, backImageUrl, identityVerified, null, null);
    }

    /** Constructor rút gọn có giấy tờ nhưng chưa có trạng thái duyệt KYC. */
    public ProfileDto(
        Long userId,
        String fullName,
        String email,
        String phone,
        LocalDate dob,
        String gender,
        String avatarUrl,
        String address,
        String membershipCode,
        String healthNotes,
        String fitnessGoal,
        String fitnessLevel,
        String emergencyContactName,
        String emergencyContactPhone
    ) {
        this(
            userId,
            fullName,
            email,
            phone,
            dob,
            gender,
            avatarUrl,
            address,
            membershipCode,
            healthNotes,
            fitnessGoal,
            fitnessLevel,
            emergencyContactName,
            emergencyContactPhone,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );
    }
}
