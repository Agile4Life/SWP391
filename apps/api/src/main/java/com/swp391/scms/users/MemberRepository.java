package com.swp391.scms.users;

import com.swp391.scms.users.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

/** Truy cập bảng members (hồ sơ hội viên, khóa chính trùng id người dùng). */
@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {
    /** Tìm các bản ghi có membershipCode = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    Optional<Member> findByMembershipCode(String membershipCode);

    /**
     * Hội viên theo trạng thái KYC (kèm User), hồ sơ nộp sớm nhất đứng trước; dùng cho hàng chờ duyệt giấy tờ.
     *
     * Registered, active members nobody has measured yet: the people a coach may give a first assessment.
     */
    @Query("select m from Member m join fetch m.user where m.kycStatus = :status order by m.kycSubmittedAt asc")
    List<Member> findByKycStatusOrderByKycSubmittedAtAsc(@Param("status") String status);

    /**
     * Lấy hội viên và khóa dòng để ghi (FOR UPDATE), tránh hai thao tác song song trên cùng hội viên (ví dụ hai
     * lần gia hạn).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.userId = :memberId")
    Optional<Member> findByUserIdForUpdate(@Param("memberId") Long memberId);

    @Query("""
            select m from Member m join fetch m.user u
            where u.deletedAt is null
              and (lower(m.membershipCode) like :pattern or lower(u.fullName) like :pattern
                   or lower(u.email) like :pattern or u.phone like :pattern)
            order by u.fullName
            """)
    /**
     * Tìm hội viên chưa xóa theo mẫu (đã chuyển chữ thường, có %) trên mã hội viên, họ tên, email hoặc SĐT, sắp
     * theo họ tên, có phân trang.
     */
    List<Member> search(@Param("pattern") String pattern, Pageable pageable);

    /** Xóa mọi liên kết "bộ môn yêu thích" trỏ tới một bộ môn (dùng khi xóa bộ môn). */
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "delete from member_favorite_disciplines where discipline_id = :disciplineId", nativeQuery = true)
    void removeFavoriteDiscipline(@Param("disciplineId") Long disciplineId);
}
