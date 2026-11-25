package com.swp391.scms.users;

import com.swp391.scms.users.entity.Coach;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập bảng coaches (hồ sơ huấn luyện viên, khóa chính trùng id người dùng). */
@Repository
public interface CoachRepository extends JpaRepository<Coach, Long> {
    @Query("""
            select c from Coach c join fetch c.user u
            where c.employmentStatus = 'active' and u.status = 'active' and u.deletedAt is null
            order by u.fullName, c.userId
            """)
    /**
     * HLV đang làm việc có tài khoản active và chưa bị xóa, kèm thông tin User, sắp theo họ tên; dùng cho danh
     * sách HLV công khai.
     */
    List<Coach> findPublicCoaches();

    @Query("""
            SELECT c FROM Coach c JOIN FETCH c.user u
            WHERE LOWER(c.employmentStatus) = 'active'
              AND u.deletedAt IS NULL
              AND LOWER(u.status) = 'active'
            """)
    /** HLV đang làm việc (không phân biệt hoa thường) có tài khoản active, chưa xóa, kèm thông tin User. */
    List<Coach> findActiveWithUser();
}
