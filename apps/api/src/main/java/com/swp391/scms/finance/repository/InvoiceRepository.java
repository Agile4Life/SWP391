package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    /** Tìm các bản ghi có invoiceNumber = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    /** Tìm các bản ghi có paymentId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Invoice> findByPaymentId(Long paymentId);

    /**
     * Tìm các bản ghi có paymentId = tham số và paymentMemberUserId = tham số và paymentStatus = tham số
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    Optional<Invoice> findByPaymentIdAndPaymentMemberUserIdAndPaymentStatus(Long paymentId, Long userId, String status);

    /** Kiểm tra có tồn tại bản ghi có invoiceNumber = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByInvoiceNumber(String invoiceNumber);
}
