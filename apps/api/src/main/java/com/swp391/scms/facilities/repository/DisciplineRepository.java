package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.Discipline;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DisciplineRepository extends JpaRepository<Discipline, Long> {
    /**
     * Kiểm tra có tồn tại bản ghi có name bằng tham số (không phân biệt hoa thường) (Spring Data tự sinh truy
     * vấn từ tên hàm).
     */
    boolean existsByNameIgnoreCase(String name);
    /**
     * Kiểm tra có tồn tại bản ghi có name bằng tham số (không phân biệt hoa thường) và id khác tham số (Spring
     * Data tự sinh truy vấn từ tên hàm).
     */
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    /** Lấy mọi bản ghi, sắp xếp theo name tăng dần (Spring Data tự sinh truy vấn từ tên hàm). */
    List<Discipline> findAllByOrderByNameAsc();
}
