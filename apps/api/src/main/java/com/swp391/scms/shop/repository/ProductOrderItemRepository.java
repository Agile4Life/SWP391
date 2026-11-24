package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.ProductOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductOrderItemRepository extends JpaRepository<ProductOrderItem, Long> {
    /** Kiểm tra có tồn tại bản ghi có variant_Product_Id = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByVariant_Product_Id(Long productId);
    /** Kiểm tra có tồn tại bản ghi có variant_Id = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByVariant_Id(Long variantId);
}
