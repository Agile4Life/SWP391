package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);

    Optional<Invoice> findByPaymentId(Long paymentId);

    Optional<Invoice> findByPaymentIdAndPaymentMemberUserIdAndPaymentStatus(Long paymentId, Long userId, String status);

    boolean existsByInvoiceNumber(String invoiceNumber);
}
