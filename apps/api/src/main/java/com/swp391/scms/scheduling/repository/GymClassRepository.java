package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.GymClass;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/** Truy cập dữ liệu lớp/khóa học (bảng classes). */
@Repository
public interface GymClassRepository extends JpaRepository<GymClass, Long> {
    /** Kiểm tra có tồn tại bản ghi có roomId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByRoomId(Long roomId);

    /** Kiểm tra có tồn tại bản ghi có disciplineId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByDisciplineId(Long disciplineId);

    /** Kiểm tra bộ môn đã có lớp ở trạng thái chỉ định (mỗi bộ môn chỉ có tối đa 1 lớp active). */
    boolean existsByDisciplineIdAndStatus(Long disciplineId, String status);

    /** Kiểm tra bộ môn đã có lớp khác (id != classId) ở trạng thái chỉ định. */
    boolean existsByDisciplineIdAndStatusAndIdNot(Long disciplineId, String status, Long id);

    /** Lấy mọi bản ghi, sắp xếp theo id giảm dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<GymClass> findAllByOrderByIdDesc();

    /** Tìm các bản ghi có status = tham số, sắp xếp theo id giảm dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<GymClass> findByStatusOrderByIdDesc(String status);

    /** Tìm các bản ghi có coachUserId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    List<GymClass> findByCoachUserId(Long coachId);

    /** Lấy lớp theo id và khóa dòng (PESSIMISTIC_WRITE) để kiểm tra sức chứa khi ghi danh đồng thời. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GymClass c where c.id = :id")
    Optional<GymClass> findByIdForUpdate(@Param("id") Long id);
}
