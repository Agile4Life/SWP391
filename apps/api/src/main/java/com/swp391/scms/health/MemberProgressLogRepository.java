package com.swp391.scms.health;

import com.swp391.scms.health.entity.MemberProgressLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemberProgressLogRepository extends JpaRepository<MemberProgressLog, Long> {
    List<MemberProgressLog> findByMemberUserIdOrderByRecordedAtDesc(Long memberId);

    List<MemberProgressLog> findByMemberUserIdOrderByRecordedAtAsc(Long memberId);
}
