package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.MemberAddress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberAddressRepository extends JpaRepository<MemberAddress, Long> {
    /**
     * Tìm các bản ghi có member_UserId = tham số, sắp xếp theo isDefault giảm dần, createdAt giảm dần, id giảm
     * dần (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<MemberAddress> findAllByMember_UserIdOrderByIsDefaultDescCreatedAtDescIdDesc(Long memberId);
    /** Tìm các bản ghi có id = tham số và member_UserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<MemberAddress> findByIdAndMember_UserId(Long id, Long memberId);
    /** Đếm số bản ghi có member_UserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByMember_UserId(Long memberId);
}
