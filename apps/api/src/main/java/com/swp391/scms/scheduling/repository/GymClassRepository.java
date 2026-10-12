package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.GymClass;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GymClassRepository extends JpaRepository<GymClass, Long> {

    List<GymClass> findAllByOrderByIdDesc();

    List<GymClass> findByStatusOrderByIdDesc(String status);
}
