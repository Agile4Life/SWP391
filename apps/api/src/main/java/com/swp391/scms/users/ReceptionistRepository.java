package com.swp391.scms.users;

import com.swp391.scms.users.entity.Receptionist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Truy cập bảng receptionists (hồ sơ lễ tân, khóa chính trùng id người dùng). */
@Repository
public interface ReceptionistRepository extends JpaRepository<Receptionist, Long> {
}