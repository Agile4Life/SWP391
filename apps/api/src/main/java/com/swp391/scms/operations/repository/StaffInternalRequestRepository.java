package com.swp391.scms.operations.repository;

import com.swp391.scms.operations.entity.StaffInternalRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StaffInternalRequestRepository extends JpaRepository<StaffInternalRequest, Long> {

    List<StaffInternalRequest> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<StaffInternalRequest> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);

    List<StaffInternalRequest> findAllByOrderByCreatedAtDesc();

    @Query("SELECT r FROM StaffInternalRequest r " +
           "WHERE (:status IS NULL OR r.status = :status) " +
           "AND (:requestType IS NULL OR r.requestType = :requestType) " +
           "ORDER BY r.createdAt DESC")
    List<StaffInternalRequest> findWithFilters(@Param("status") String status,
                                              @Param("requestType") String requestType);
}

