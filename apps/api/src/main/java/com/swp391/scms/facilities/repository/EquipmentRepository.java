package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.Equipment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Truy cập bảng equipment (thiết bị). */
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {

    /** Mọi thiết bị kèm phòng, sắp theo tên. */
    @Query("SELECT e FROM Equipment e LEFT JOIN FETCH e.room ORDER BY e.name ASC")
    List<Equipment> findAllWithRoom();

    /** Thiết bị của một phòng, sắp theo tên. */
    @Query("SELECT e FROM Equipment e LEFT JOIN FETCH e.room WHERE e.room.id = :roomId ORDER BY e.name ASC")
    List<Equipment> findByRoomId(@Param("roomId") Long roomId);

    /** Một thiết bị kèm phòng. */
    @Query("SELECT e FROM Equipment e LEFT JOIN FETCH e.room WHERE e.id = :id")
    Optional<Equipment> findByIdWithRoom(@Param("id") Long id);

    /** Kiểm tra có tồn tại bản ghi có code = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByCode(String code);

    /**
     * Kiểm tra có tồn tại bản ghi có code = tham số và id khác tham số (Spring Data tự sinh truy vấn từ tên
     * hàm).
     */
    boolean existsByCodeAndIdNot(String code, Long id);

    /** Kiểm tra có tồn tại bản ghi có roomId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByRoomId(Long roomId);

    /** Đếm số bản ghi có status = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    long countByStatus(String status);
}

