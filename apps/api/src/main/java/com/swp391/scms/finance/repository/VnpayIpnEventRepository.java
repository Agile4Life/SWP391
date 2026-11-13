package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.VnpayIpnEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface VnpayIpnEventRepository extends JpaRepository<VnpayIpnEvent, Long>, JpaSpecificationExecutor<VnpayIpnEvent> {
    long countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(
            Collection<String> rspCodes, LocalDateTime from, LocalDateTime to);

    List<VnpayIpnEvent> findAllByReferenceInOrderByReceivedAtAscIdAsc(Collection<String> references);
}
