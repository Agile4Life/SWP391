package com.swp391.scms.finance.repository;

import com.swp391.scms.finance.entity.InvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập bảng invoice_items (dòng hàng của hóa đơn). */
@Repository
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {

    /** Tìm các bản ghi có invoiceId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<InvoiceItem> findByInvoiceId(Long invoiceId);
}
