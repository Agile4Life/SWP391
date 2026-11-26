package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.Room;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Truy cập bảng rooms (phòng tập). */
public interface RoomRepository extends JpaRepository<Room, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    /** Kiểm tra có tồn tại bản ghi có disciplineId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByDisciplineId(Long disciplineId);

    /** Lấy mọi bản ghi, sắp xếp theo name tăng dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<Room> findAllByOrderByNameAsc();
}
