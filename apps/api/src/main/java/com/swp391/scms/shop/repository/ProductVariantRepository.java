package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.ProductVariant;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Truy cập dữ liệu biến thể sản phẩm (bảng product_variants). */
@Repository
public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {
    /** Lấy nhiều biến thể kèm sản phẩm và khóa dòng, sắp theo id để tránh deadlock khi trừ kho. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from ProductVariant v join fetch v.product where v.id in :ids order by v.id")
    List<ProductVariant> findAllByIdInForUpdate(@Param("ids") Collection<Long> ids);

    /** Lấy một biến thể theo id và khóa dòng (PESSIMISTIC_WRITE). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from ProductVariant v where v.id = :id")
    Optional<ProductVariant> findByIdForUpdate(@Param("id") Long id);

    /** Lấy nhiều biến thể kèm sản phẩm và danh mục (không khóa), dùng khi báo giá. */
    @Query("select v from ProductVariant v join fetch v.product p join fetch p.category where v.id in :ids")
    List<ProductVariant> findAllWithProductByIdIn(@Param("ids") Collection<Long> ids);

    /**
     * Tìm các bản ghi có product_Id thuộc danh sách tham số, sắp xếp theo sortOrder tăng dần, id tăng dần
     * (Spring Data tự sinh truy vấn từ tên hàm).
     */
    List<ProductVariant> findAllByProduct_IdInOrderBySortOrderAscIdAsc(Collection<Long> productIds);

    /**
     * Kiểm tra có tồn tại bản ghi có sku bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsBySkuIgnoreCase(String sku);
    /**
     * Kiểm tra có tồn tại bản ghi có sku bằng tham số (không phân biệt hoa thường) và id khác tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);
    /**
     * Tìm các bản ghi có sku bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    Optional<ProductVariant> findBySkuIgnoreCase(String sku);

    /** Đếm biến thể đang bán của sản phẩm đang hoạt động có tồn kho dưới 10. */
    @Query("select count(v) from ProductVariant v join v.product p where p.active = true and v.active = true and v.stock < 10")
    long countLowStockActiveVariants();
}
