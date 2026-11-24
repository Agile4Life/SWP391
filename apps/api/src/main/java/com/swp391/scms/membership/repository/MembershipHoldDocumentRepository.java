package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MembershipHoldDocument;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MembershipHoldDocumentRepository extends JpaRepository<MembershipHoldDocument, Long> {
    /**
     * Tìm các bản ghi có subscriptionId = tham số, sắp xếp theo id tăng dần (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    List<MembershipHoldDocument> findBySubscriptionIdOrderByIdAsc(Long subscriptionId);

    /** Xóa các bản ghi có subscriptionId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    void deleteBySubscriptionId(Long subscriptionId);
}
