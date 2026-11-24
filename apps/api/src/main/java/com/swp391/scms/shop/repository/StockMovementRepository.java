package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, Long> {
    /**
     * Tìm các bản ghi có variant_Id = tham số, sắp xếp theo createdAt giảm dần, id giảm dần (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    List<StockMovement> findAllByVariant_IdOrderByCreatedAtDescIdDesc(Long variantId);

    /**
     * Kiểm tra có tồn tại bản ghi có orderId = tham số và reason = tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    boolean existsByOrderIdAndReason(Long orderId, String reason);
}
