package com.swp391.scms.membership.repository;

import com.swp391.scms.membership.entity.MembershipCancellationRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

/** Truy cập bảng membership_cancellation_requests (yêu cầu hủy gói tập). */
public interface MembershipCancellationRequestRepository extends JpaRepository<MembershipCancellationRequest, Long> {
    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo requestedAt giảm dần (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    @EntityGraph(attributePaths = {"member", "member.user", "subscription", "subscription.membershipPackage", "resolvedBy", "requestedBy"})
    List<MembershipCancellationRequest> findByMemberUserIdOrderByRequestedAtDesc(Long memberId);

    @Query("""
            SELECT r FROM MembershipCancellationRequest r
            JOIN FETCH r.member m
            JOIN FETCH m.user u
            JOIN FETCH r.subscription s
            JOIN FETCH s.membershipPackage
            LEFT JOIN FETCH r.resolvedBy
            LEFT JOIN FETCH r.requestedBy
            WHERE u.deletedAt IS NULL
            ORDER BY r.requestedAt DESC
            """)
    /**
     * Mọi yêu cầu hủy của hội viên chưa bị xóa, nạp sẵn hội viên, kỳ gói, gói và người xử lý/gửi, mới nhất
     * trước; dùng cho màn hình quản lý.
     */
    List<MembershipCancellationRequest> findAllForManager();

    /**
     * Tìm các bản ghi có status = tham số, sắp xếp theo requestedAt tăng dần (Spring Data tự sinh truy vấn từ
     * tên hàm).
     */
    List<MembershipCancellationRequest> findByStatusOrderByRequestedAtAsc(String status);
    /**
     * Kiểm tra có tồn tại bản ghi có subscriptionId = tham số và status = tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    boolean existsBySubscriptionIdAndStatus(Long subscriptionId, String status);
    /**
     * Kiểm tra có tồn tại bản ghi có memberUserId = tham số và status = tham số (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    boolean existsByMemberUserIdAndStatus(Long memberId, String status);

    /** Lấy yêu cầu hủy và khóa dòng để ghi, tránh hai quản lý quyết định cùng lúc. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from MembershipCancellationRequest r where r.id = :id")
    Optional<MembershipCancellationRequest> findByIdForUpdate(@Param("id") Long id);
}
