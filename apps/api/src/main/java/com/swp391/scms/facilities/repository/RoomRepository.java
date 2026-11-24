package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.Room;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoomRepository extends JpaRepository<Room, Long> {
    /** Kiểm tra có tồn tại bản ghi có disciplineId = tham số (Spring Data tự sinh truy vấn từ tên hàm). */
    boolean existsByDisciplineId(Long disciplineId);

    /** Lấy mọi bản ghi, sắp xếp theo name tăng dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<Room> findAllByOrderByNameAsc();

    @Query("""
            select r from Room r join fetch r.discipline d
            where r.status = 'available' and d.name in ('Tennis', 'Cầu lông', 'Bơi lội')
              and r.openTime is not null and r.closeTime is not null
              and (:discipline = '' or lower(d.name) = lower(:discipline))
            order by d.name, r.name, r.id
            """)
    List<Room> findAvailableCourts(@Param("discipline") String discipline);
}
