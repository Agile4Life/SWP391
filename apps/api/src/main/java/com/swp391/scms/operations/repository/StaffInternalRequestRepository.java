package com.swp391.scms.operations.repository;

import com.swp391.scms.operations.entity.StaffInternalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StaffInternalRequestRepository extends JpaRepository<StaffInternalRequest, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from StaffInternalRequest r where r.id = :id")
    java.util.Optional<StaffInternalRequest> findByIdForUpdate(@Param("id") Long id);


    List<StaffInternalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<StaffInternalRequest> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    List<StaffInternalRequest> findAllByOrderByCreatedAtDesc();

    @Query("SELECT r FROM StaffInternalRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:requestType IS NULL OR r.requestType = :requestType) " +
           "ORDER BY r.createdAt DESC")
    List<StaffInternalRequest> findWithFilters(@Param("status") String status,
                                              @Param("requestType") String requestType);

    /** The user's pending or approved leaves that share at least one day with {@code start..end}. */
    @Query("""
            select r from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status in ('PENDING', 'APPROVED')
              and r.startDate <= :end and coalesce(r.endDate, r.startDate) >= :start
            order by r.startDate
            """)
    List<StaffInternalRequest> findOverlappingLeaves(@Param("userId") Long userId, @Param("start") java.time.LocalDate start,
                                                     @Param("end") java.time.LocalDate end);

    /** An approved leave covering {@code date}; a leave without an end date covers its start day only. */
    @Query("""
            select (count(r) > 0) from StaffInternalRequest r
            where r.user.id = :userId and r.requestType = 'LEAVE' and r.status = 'APPROVED'
              and r.startDate <= :date and coalesce(r.endDate, r.startDate) >= :date
            """)
    boolean existsApprovedLeaveOn(@Param("userId") Long userId, @Param("date") java.time.LocalDate date);
}

