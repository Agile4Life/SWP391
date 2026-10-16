package com.swp391.scms.scheduling.mapper;

import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import org.springframework.stereotype.Component;

@Component
public class SchedulingMapper {

    public GymClassDto toDto(GymClass gymClass) {
        return new GymClassDto(
                gymClass.getId(),
                gymClass.getName(),
                gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null,
                gymClass.getDiscipline() != null ? gymClass.getDiscipline().getName() : null,
                gymClass.getCoach() != null ? gymClass.getCoach().getUserId() : null,
                gymClass.getCoach() != null && gymClass.getCoach().getUser() != null
                        ? gymClass.getCoach().getUser().getFullName() : null,
                gymClass.getRoom() != null ? gymClass.getRoom().getId() : null,
                gymClass.getRoom() != null ? gymClass.getRoom().getName() : null,
                gymClass.getCapacity(),
                gymClass.getLevel(),
                gymClass.getDescription(),
                gymClass.getStatus()
        );
    }

    public ClassSessionDto toDto(ClassSession session, long bookedCount) {
        GymClass gymClass = session.getGymClass();
        return new ClassSessionDto(
                session.getId(),
                gymClass != null ? gymClass.getId() : null,
                gymClass != null ? gymClass.getName() : null,
                gymClass != null && gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null,
                gymClass != null && gymClass.getDiscipline() != null ? gymClass.getDiscipline().getName() : null,
                gymClass != null && gymClass.getCoach() != null ? gymClass.getCoach().getUserId() : null,
                gymClass != null && gymClass.getCoach() != null && gymClass.getCoach().getUser() != null
                        ? gymClass.getCoach().getUser().getFullName() : null,
                gymClass != null && gymClass.getRoom() != null ? gymClass.getRoom().getId() : null,
                gymClass != null && gymClass.getRoom() != null ? gymClass.getRoom().getName() : null,
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                session.getStatus(),
                session.getCancelReason(),
                gymClass != null ? gymClass.getCapacity() : 0,
                bookedCount
        );
    }
}
