package com.swp391.scms.operations.repository;

import com.swp391.scms.operations.entity.StaffInternalRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/** Truy cập bảng staff_internal_requests (đơn từ nội bộ của nhân viên). */
@Repository
public interface StaffInternalRequestRepository extends JpaRepository<StaffInternalRequest, Long> {

    /** Lấy đơn và khóa dòng để ghi, tránh hai người thao tác cùng lúc. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from StaffInternalRequest r where r.id = :id")
    Optional<StaffInternalRequest> findByIdForUpdate(@Param("id") Long id);

    /** Tìm các đơn của nhân viên kèm user/role/người thay/người duyệt, sắp xếp mới nhất trước. */
    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    List<StaffInternalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Tìm các đơn của nhân viên có phân trang/giới hạn kèm liên kết cần thiết. */
    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    List<StaffInternalRequest> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /** Tìm các đơn của nhân viên theo trạng thái kèm liên kết cần thiết. */
    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    List<StaffInternalRequest> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    /** Tìm các đơn của nhân viên theo trạng thái có phân trang/giới hạn kèm liên kết cần thiết. */
    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    List<StaffInternalRequest> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status, Pageable pageable);

    /** Lấy mọi bản ghi kèm liên kết cần thiết, sắp xếp theo createdAt giảm dần. */
    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    List<StaffInternalRequest> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    @Query("SELECT r FROM StaffInternalRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:requestType IS NULL OR r.requestType = :requestType) " +
           "ORDER BY r.createdAt DESC")
    /** Lọc đơn theo trạng thái và loại (tham số null là bỏ qua), mới nhất trước. */
    List<StaffInternalRequest> findWithFilters(@Param("status") String status,
                                               @Param("requestType") String requestType);

    @EntityGraph(attributePaths = {"user", "user.role", "replacementUser", "reviewedBy"})
    @Query("SELECT r FROM StaffInternalRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:requestType IS NULL OR r.requestType = :requestType) " +
           "ORDER BY r.createdAt DESC")
    /** Lọc đơn theo trạng thái và loại có giới hạn số lượng, nạp sẵn liên kết để tránh N+1. */
    List<StaffInternalRequest> findWithFilters(@Param("status") String status,
                                               @Param("requestType") String requestType,
                                               Pageable pageable);

    /** Các đơn nghỉ đang chờ hoặc đã duyệt của người dùng có ít nhất một ngày chung với {@code start..end}. */
    @Query("""
            select r from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status in ('PENDING', 'APPROVED')
              and r.startDate <= :end and coalesce(r.endDate, r.startDate) >= :start
            order by r.startDate
            """)
    List<StaffInternalRequest> findOverlappingLeaves(@Param("userId") Long userId, @Param("start") LocalDate start,
                                                     @Param("end") LocalDate end);

    /** Khóa và lấy các đơn nghỉ đã APPROVED của cùng nhân viên trùng khoảng {@code start..end} (trừ đơn hiện tại). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status = 'APPROVED'
              and r.id <> :excludeId
              and r.startDate <= :end and coalesce(r.endDate, r.startDate) >= :start
            order by r.startDate
            """)
    List<StaffInternalRequest> findApprovedOverlappingLeavesForUpdate(@Param("userId") Long userId,
                                                                      @Param("excludeId") Long excludeId,
                                                                      @Param("start") LocalDate start,
                                                                      @Param("end") LocalDate end);

    /** Nhân viên có đơn nghỉ đã duyệt bao phủ ngày cho trước không (đơn không có ngày kết thúc chỉ tính ngày bắt đầu). */
    @Query("""
            select (count(r) > 0) from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status = 'APPROVED'
              and r.startDate <= :date and coalesce(r.endDate, r.startDate) >= :date
            """)
    boolean existsApprovedLeaveOn(@Param("userId") Long userId, @Param("date") LocalDate date);

    /** Nhân viên có đơn nghỉ đã duyệt trùng ít nhất một ngày trong khoảng {@code start..end} không. */
    @Query("""
            select (count(r) > 0) from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status = 'APPROVED'
              and r.startDate <= :end and coalesce(r.endDate, r.startDate) >= :start
            """)
    boolean existsApprovedLeaveOverlapping(@Param("userId") Long userId,
                                           @Param("start") LocalDate start,
                                           @Param("end") LocalDate end);
}

