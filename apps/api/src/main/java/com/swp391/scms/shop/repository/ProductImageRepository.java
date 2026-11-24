package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {
    /**
     * Tìm các bản ghi có product_Id thuộc danh sách tham số, sắp xếp theo sortOrder tăng dần, id tăng dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<ProductImage> findAllByProduct_IdInOrderBySortOrderAscIdAsc(Collection<Long> productIds);
    /**
     * Tìm các bản ghi có product_Id = tham số, sắp xếp theo sortOrder tăng dần, id tăng dần (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    List<ProductImage> findAllByProduct_IdOrderBySortOrderAscIdAsc(Long productId);

    @Query("select i from ProductImage i join fetch i.product p where i.id = :id")
    Optional<ProductImage> findByIdWithProduct(@Param("id") Long id);
}
