package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.MembershipPackage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipPackageRepository extends JpaRepository<MembershipPackage, Long> {
    /** Tìm các bản ghi có  = tham số, sắp xếp theo price tăng dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<MembershipPackage> findAllByOrderByPriceAsc();
    /**
     * Tìm các bản ghi có status = tham số, sắp xếp theo price tăng dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<MembershipPackage> findByStatusOrderByPriceAsc(String status);
}
