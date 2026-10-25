package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.MembershipPackage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipPackageRepository extends JpaRepository<MembershipPackage, Long> {
    List<MembershipPackage> findAllByOrderByPriceAsc();
    List<MembershipPackage> findByStatusOrderByPriceAsc(String status);
}
