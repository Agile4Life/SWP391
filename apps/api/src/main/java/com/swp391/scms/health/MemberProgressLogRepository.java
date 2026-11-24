package com.swp391.scms.health;

import com.swp391.scms.health.entity.MemberProgressLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberProgressLogRepository extends JpaRepository<MemberProgressLog, Long> {
    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo recordedAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<MemberProgressLog> findByMemberUserIdOrderByRecordedAtDesc(Long memberId);

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo recordedAt tăng dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<MemberProgressLog> findByMemberUserIdOrderByRecordedAtAsc(Long memberId);
}
