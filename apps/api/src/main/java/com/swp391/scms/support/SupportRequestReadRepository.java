package com.swp391.scms.support;

import com.swp391.scms.support.entity.SupportRequestRead;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupportRequestReadRepository extends JpaRepository<SupportRequestRead, Long> {
    Optional<SupportRequestRead> findBySupportRequestIdAndUserId(Long ticketId, Long userId);
}
