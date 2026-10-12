package com.swp391.scms.scheduling.repository;

import com.swp391.scms.scheduling.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, Long> {

    List<ClassSession> findByGymClassId(Long classId);

    @Query("SELECT s FROM ClassSession s WHERE s.gymClass.id IN :classIds ORDER BY s.sessionDate ASC, s.startTime ASC")
    List<ClassSession> findByGymClassIdIn(@Param("classIds") Collection<Long> classIds);
}
