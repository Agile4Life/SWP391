package com.swp391.scms.auth.repository;

import com.swp391.scms.auth.entity.OtpChallenge;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/** Truy cập bảng otp_challenges (mã OTP đang chờ xác thực). */
public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, Long> {

    /**
     * Lấy mã OTP của địa chỉ đích (không phân biệt hoa thường) và khóa dòng để ghi (FOR UPDATE), tránh hai
     * request kiểm tra cùng lúc.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select challenge from OtpChallenge challenge where lower(challenge.target) = lower(:target)")
    Optional<OtpChallenge> findByTargetForUpdate(@Param("target") String target);

    // Xóa hàng loạt chạy ngay để lần chèn tiếp theo cùng đích duy nhất không bị va chạm.
    /**
     * Xóa mọi mã OTP của địa chỉ đích; chạy ngay (flush) để lần thêm mã mới sau đó không trùng ràng buộc
     * unique.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from OtpChallenge challenge where lower(challenge.target) = lower(:target)")
    void deleteByTargetIgnoreCase(@Param("target") String target);

    /** Xóa các mã OTP đã hết hạn trước thời điểm cutoff. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from OtpChallenge challenge where challenge.expiresAt < :cutoff")
    void deleteByExpiresAtBefore(@Param("cutoff") java.time.LocalDateTime cutoff);
}
