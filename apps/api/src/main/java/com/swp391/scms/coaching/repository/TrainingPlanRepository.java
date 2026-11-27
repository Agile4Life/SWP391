package com.swp391.scms.coaching.repository;

import com.swp391.scms.coaching.entity.TrainingPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Truy cập dữ liệu giáo án tập luyện (bảng training_plans). */
@Repository
public interface TrainingPlanRepository extends JpaRepository<TrainingPlan, Long> {

    @org.springframework.data.jpa.repository.Query("""
            select p from TrainingPlan p join fetch p.member m join fetch m.user u
            where p.coach.userId = :coachId and p.status = 'active'
              and p.startDate <= :today and p.endDate >= :today
              and u.deletedAt is null and u.status = 'active'
            order by p.createdAt desc
            """)
    /** Giáo án active đang trong thời hạn của một HLV với hội viên còn hoạt động, mới nhất trước. */
    List<TrainingPlan> findCurrentAssignments(@org.springframework.data.repository.query.Param("coachId") Long coachId,
            @org.springframework.data.repository.query.Param("today") java.time.LocalDate today);

    /**
     * Tìm các bản ghi có memberUserId = tham số và status = tham số, sắp xếp theo createdAt giảm dần (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    List<TrainingPlan> findByMemberUserIdAndStatusOrderByCreatedAtDesc(Long memberId, String status);

    /**
     * Các giáo án active khác mà cùng HLV giao cho một hội viên (trừ giáo án exceptId); không bao gồm giáo án từ các
     * HLV khác của hội viên đó.
     */
    @org.springframework.data.jpa.repository.Query("select p from TrainingPlan p where p.member.userId = :memberId and p.coach.userId = :coachId and p.status = 'active' and p.id <> :exceptId")
    List<TrainingPlan> findOtherActiveForMemberAndCoach(@org.springframework.data.repository.query.Param("memberId") Long memberId,
            @org.springframework.data.repository.query.Param("coachId") Long coachId,
            @org.springframework.data.repository.query.Param("exceptId") Long exceptId);

    /**
     * Tìm các bản ghi có memberUserId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<TrainingPlan> findByMemberUserIdOrderByCreatedAtDesc(Long memberId);

    /**
     * Tìm các bản ghi có coachUserId = tham số, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn
     * từ tên hàm).
     */
    List<TrainingPlan> findByCoachUserIdOrderByCreatedAtDesc(Long coachId);

    /** Lấy mọi bản ghi, sắp xếp theo createdAt giảm dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<TrainingPlan> findAllByOrderByCreatedAtDesc();

    /** Kiểm tra HLV đã từng lập giáo án cho hội viên chưa. */
    @org.springframework.data.jpa.repository.Query("select (count(p) > 0) from TrainingPlan p where p.coach.userId = :coachId and p.member.userId = :memberId")
    boolean existsForCoachAndMember(@org.springframework.data.repository.query.Param("coachId") Long coachId, @org.springframework.data.repository.query.Param("memberId") Long memberId);

    /** Kiểm tra có tồn tại giáo án nào gắn với lớp học này không (dùng trước khi xóa lớp). */
    boolean existsByGymClassId(Long classId);

    /**
     * Chuyển các giáo án active có chu kỳ kết thúc trước {@code today} sang completed và cập nhật updatedAt
     * (máy trạng thái 7); trả về số dòng cập nhật.
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update TrainingPlan p set p.status = 'completed', p.updatedAt = :now where p.status = 'active' and p.endDate < :today")
    int completeEndedBefore(@org.springframework.data.repository.query.Param("today") java.time.LocalDate today,
                            @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
}
