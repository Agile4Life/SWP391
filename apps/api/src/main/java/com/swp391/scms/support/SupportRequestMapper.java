package com.swp391.scms.support;

import com.swp391.scms.support.dto.SupportRequestDto;
import com.swp391.scms.support.entity.SupportRequest;
import org.springframework.stereotype.Component;

@Component
public class SupportRequestMapper {
    public SupportRequestDto toDto(SupportRequest entity) {
        if (entity == null) return null;
        
        return new SupportRequestDto(
            entity.getId(),
            entity.getMember() != null ? entity.getMember().getUserId() : null,
            (entity.getMember() != null && entity.getMember().getUser() != null) ? entity.getMember().getUser().getFullName() : null,
            entity.getAssignedTo() != null ? entity.getAssignedTo().getId() : null,
            entity.getAssignedTo() != null ? entity.getAssignedTo().getFullName() : null,
            entity.getSubject(),
            entity.getDescription(),
            entity.getStatus(),
            entity.getCreatedAt(),
            entity.getResolvedAt()
        );
    }
}

