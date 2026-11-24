package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.VnpayIpnEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

/** Truy cập bảng vnpay_ipn_events (nhật ký callback VNPay), hỗ trợ truy vấn động. */
public interface VnpayIpnEventRepository extends JpaRepository<VnpayIpnEvent, Long>, JpaSpecificationExecutor<VnpayIpnEvent> {
    /**
     * Đếm số bản ghi có rspCode thuộc danh sách tham số và receivedAt ≥ tham số và receivedAt < tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    long countByRspCodeInAndReceivedAtGreaterThanEqualAndReceivedAtLessThan(
            Collection<String> rspCodes, LocalDateTime from, LocalDateTime to);

    /**
     * Tìm các bản ghi có reference thuộc danh sách tham số, sắp xếp theo receivedAt tăng dần, id tăng dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<VnpayIpnEvent> findAllByReferenceInOrderByReceivedAtAscIdAsc(Collection<String> references);
}
