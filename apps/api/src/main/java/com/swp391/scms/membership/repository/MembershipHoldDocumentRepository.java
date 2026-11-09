package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MembershipHoldDocument;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MembershipHoldDocumentRepository extends JpaRepository<MembershipHoldDocument, Long> {
    List<MembershipHoldDocument> findBySubscriptionIdOrderByIdAsc(Long subscriptionId);

    void deleteBySubscriptionId(Long subscriptionId);
}
