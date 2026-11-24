package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.ProductCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductCategoryRepository extends JpaRepository<ProductCategory, Long> {
    /**
     * Tìm các bản ghi có active là true, sắp xếp theo sortOrder tăng dần, id tăng dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    List<ProductCategory> findAllByActiveTrueOrderBySortOrderAscIdAsc();
    /**
     * Lấy mọi bản ghi, sắp xếp theo sortOrder tăng dần, id tăng dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<ProductCategory> findAllByOrderBySortOrderAscIdAsc();
    /** Tìm các bản ghi có slug = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<ProductCategory> findBySlug(String slug);
    /** Kiểm tra có tồn tại bản ghi có slug = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsBySlug(String slug);
    /**
     * Kiểm tra có tồn tại bản ghi có name bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsByNameIgnoreCase(String name);
    /**
     * Kiểm tra có tồn tại bản ghi có slug = tham số và id khác tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    boolean existsBySlugAndIdNot(String slug, Long id);
    /**
     * Kiểm tra có tồn tại bản ghi có name bằng tham số (không phân biệt hoa thường) và id khác tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
