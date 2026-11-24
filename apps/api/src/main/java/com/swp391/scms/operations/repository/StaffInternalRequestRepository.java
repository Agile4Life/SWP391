package com.swp391.scms.operations.repository;

import com.swp391.scms.operations.entity.StaffInternalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập bảng staff_internal_requests (đơn từ nội bộ của nhân viên). */
@Repository
public interface StaffInternalRequestRepository extends JpaRepository<StaffInternalRequest, Long> {
    /** Lấy đơn và khóa dòng để ghi, tránh hai người thao tác cùng lúc. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from StaffInternalRequest r where r.id = :id")
    java.util.Optional<StaffInternalRequest> findByIdForUpdate(@Param("id") Long id);


    /**
     * Tìm các bản ghi có userId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    List<StaffInternalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Tìm các bản ghi có userId = tham số và status = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự
     * sinh truy vấn từ tên hàm).
     */
    List<StaffInternalRequest> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    /** Lấy mọi bản ghi, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<StaffInternalRequest> findAllByOrderByCreatedAtDesc();

    @Query("SELECT r FROM StaffInternalRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:requestType IS NULL OR r.requestType = :requestType) " +
           "ORDER BY r.createdAt DESC")
    /** Lọc đơn theo trạng thái và loại (tham số null là bỏ qua), mới nhất trước. */
    List<StaffInternalRequest> findWithFilters(@Param("status") String status,
                                              @Param("requestType") String requestType);

    /** Các đơn nghỉ đang chờ hoặc đã duyệt của người dùng có ít nhất một ngày chung với {@code start..end}. */
    @Query("""
            select r from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status in ('PENDING', 'APPROVED')
              and r.startDate <= :end and coalesce(r.endDate, r.startDate) >= :start
            order by r.startDate
            """)
    /** Các đơn nghỉ đang chờ hoặc đã duyệt của nhân viên có ít nhất một ngày trùng khoảng start..end. */
    List<StaffInternalRequest> findOverlappingLeaves(@Param("userId") Long userId, @Param("start") java.time.LocalDate start,
                                                     @Param("end") java.time.LocalDate end);

    /** Đơn nghỉ đã duyệt bao phủ {@code date}; đơn nghỉ không có ngày kết thúc chỉ bao phủ ngày bắt đầu. */
    @Query("""
            select (count(r) > 0) from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status = 'APPROVED'
              and r.startDate <= :date and coalesce(r.endDate, r.startDate) >= :date
            """)
    /**
     * Nhân viên có đơn nghỉ đã duyệt bao phủ ngày cho trước không (đơn không có ngày kết thúc chỉ tính ngày bắt
     * đầu).
     */
    boolean existsApprovedLeaveOn(@Param("userId") Long userId, @Param("date") java.time.LocalDate date);
}

