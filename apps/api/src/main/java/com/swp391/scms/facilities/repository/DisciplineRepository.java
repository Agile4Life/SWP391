package com.swp391.scms.facilities.repository;

import com.swp391.scms.facilities.entity.Discipline;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DisciplineRepository extends JpaRepository<Discipline, Long> {
    boolean existsByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    List<Discipline> findAllByOrderByNameAsc();
}
