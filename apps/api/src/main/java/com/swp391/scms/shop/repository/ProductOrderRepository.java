package com.swp391.scms.shop.repository;

import com.swp391.scms.shop.entity.ProductOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Truy cập dữ liệu đơn hàng shop (bảng product_orders). */
@Repository
public interface ProductOrderRepository extends JpaRepository<ProductOrder, Long> {
    /** Lấy đơn theo id và khóa dòng (PESSIMISTIC_WRITE) để đổi trạng thái an toàn. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from ProductOrder o where o.id = :id")
    Optional<ProductOrder> findByIdForUpdate(@Param("id") Long id);

    /**
     * Tìm các bản ghi có member_UserId = tham số và clientRequestId = tham số (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    Optional<ProductOrder> findByMember_UserIdAndClientRequestId(Long memberId, String clientRequestId);

    /** Tìm các bản ghi có id = tham số và member_UserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<ProductOrder> findByIdAndMember_UserId(Long id, Long memberId);

    /** Kiểm tra có tồn tại bản ghi có code = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByCode(String code);

    /** Đơn chờ thanh toán đã quá hạn thanh toán, hạn sớm nhất trước. */
    @Query("select o from ProductOrder o where o.status = 'pending_payment' and o.paymentDueAt < :now order by o.paymentDueAt asc, o.id asc")
    List<ProductOrder> findExpiredUnpaid(@Param("now") LocalDateTime now);

    /**
     * Tìm các bản ghi có member_UserId = tham số, sắp xếp theo createdAt giảm dần, id giảm dần (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    Page<ProductOrder> findByMember_UserIdOrderByCreatedAtDescIdDesc(Long memberId, Pageable pageable);

    /**
     * Đơn của hội viên có trạng thái thuộc danh sách, mới nhất trước, phân trang (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    Page<ProductOrder> findByMember_UserIdAndStatusInOrderByCreatedAtDescIdDesc(
            Long memberId,
            Collection<String> statuses,
            Pageable pageable
    );

    @Query("""
        select o from ProductOrder o join o.member m join m.user u
        where (:status = '' or o.status = :status)
          and (:counterPending = false or (o.status = 'pending_payment' and o.paymentMethod = 'counter'))
          and (:q = ''
               or lower(o.code) like concat('%', :q, '%')
               or lower(u.fullName) like concat('%', :q, '%')
               or lower(coalesce(u.phone, '')) like concat('%', :q, '%')
               or lower(coalesce(o.shipPhone, '')) like concat('%', :q, '%'))
        """)
    /**
     * Tìm đơn cho nhân viên: lọc theo trạng thái, đơn chờ thu tại quầy và từ khóa (mã đơn, tên, số điện thoại),
     * phân trang.
     */
    Page<ProductOrder> searchStaff(
            @Param("status") String status,
            @Param("counterPending") boolean counterPending,
            @Param("q") String q,
            Pageable pageable
    );

    /** Đếm số bản ghi có status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByStatus(String status);

    /** Đếm số bản ghi có status = tham số và paymentMethod = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByStatusAndPaymentMethod(String status, String paymentMethod);

    /** Đơn đang chờ xử lý (paid/processing) hoặc đã thanh toán từ mốc since; dùng cho thống kê quản lý. */
    @Query("select o from ProductOrder o where o.status in ('paid', 'processing') or o.paidAt >= :since")
    List<ProductOrder> findRecentAndActive(@Param("since") LocalDateTime since);
}
