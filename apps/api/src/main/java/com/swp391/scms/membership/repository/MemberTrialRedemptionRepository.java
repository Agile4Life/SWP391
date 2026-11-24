package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MemberTrialRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Truy cập bảng member_trial_redemptions (yêu cầu/lượt nhận gói trải nghiệm). */
@Repository
public interface MemberTrialRedemptionRepository extends JpaRepository<MemberTrialRedemption, Long> {
    /** Kiểm tra có tồn tại bản ghi có cccdHash = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByCccdHash(String cccdHash);
    /**
     * Kiểm tra có tồn tại bản ghi có cccdHash = tham số và memberUserId khác tham số (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsByCccdHashAndMemberUserIdNot(String cccdHash, Long memberId);
    /** Kiểm tra có tồn tại bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByMemberUserId(Long memberId);
    /** Tìm các bản ghi có memberUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<MemberTrialRedemption> findByMemberUserId(Long memberId);
    /**
     * Tìm các bản ghi có status = tham số, sắp xếp theo redeemedAt giảm dần (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    List<MemberTrialRedemption> findByStatusOrderByRedeemedAtDesc(String status);
    /**
     * Lấy mọi bản ghi, sắp xếp theo redeemedAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<MemberTrialRedemption> findAllByOrderByRedeemedAtDesc();
}
