package com.swp391.scms.scheduling.mapper;

import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Chuyển entity lớp học/buổi học sang DTO trả về client. */
@Component
public class SchedulingMapper {

    /**
     * Chuyển GymClass sang GymClassDto: thông tin lớp, bộ môn, HLV, phòng, sức chứa, giá và lịch định kỳ
     * (trường liên kết null thì để null).
     */
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
                gymClass.getStatus(),
                gymClass.getPrice(),
                gymClass.getStartDate(),
                gymClass.getEndDate(),
                gymClass.getRecurringDays(),
                gymClass.getStartTime(),
                gymClass.getEndTime()
        );
    }

    /**
     * True khi lớp thiếu dữ liệu lịch (ngày lặp, ngày bắt đầu/kết thúc) mà màn khóa học cần — thường là lớp tạo
     * trước khi có các trường này.
     *
     * True khi lớp thiếu các trường lịch mà màn khóa học cần (các lớp tạo trước khi có chúng).
     */
    public static boolean lacksSchedule(GymClass gymClass) {
        return gymClass.getRecurringDays() == null || gymClass.getRecurringDays().isBlank()
                || gymClass.getStartDate() == null || gymClass.getEndDate() == null;
    }

    /**
     * Như toDto(GymClass) nhưng nếu lớp thiếu lịch thì suy ra thứ trong tuần, ngày đầu/cuối và giờ học từ các
     * buổi thực tế (ưu tiên buổi chưa hủy).
     *
     * Giống {@link #toDto(GymClass)}, nhưng điền lịch còn thiếu (thứ, ngày đầu và cuối, giờ) từ các buổi thật
     * của lớp, để màn hình hiện đúng các ngày lớp thực sự học thay vì đoán mặc định.
     */
    public GymClassDto toDto(GymClass gymClass, List<ClassSession> classSessions) {
        GymClassDto dto = toDto(gymClass);
        if (!lacksSchedule(gymClass) || classSessions == null || classSessions.isEmpty()) return dto;
        List<ClassSession> held = classSessions.stream()
                .filter(s -> s.getSessionDate() != null && !"cancelled".equalsIgnoreCase(s.getStatus())).toList();
        if (held.isEmpty()) held = classSessions.stream().filter(s -> s.getSessionDate() != null).toList();
        if (held.isEmpty()) return dto;
        String days = dto.recurringDays() != null && !dto.recurringDays().isBlank() ? dto.recurringDays()
                : held.stream().map(s -> s.getSessionDate().getDayOfWeek()).distinct().sorted()
                        .map(DayOfWeek::name).collect(Collectors.joining(","));
        LocalDate first = held.stream().map(ClassSession::getSessionDate).min(Comparator.naturalOrder()).orElse(null);
        LocalDate last = held.stream().map(ClassSession::getSessionDate).max(Comparator.naturalOrder()).orElse(null);
        ClassSession sample = held.get(0);
        return new GymClassDto(dto.id(), dto.name(), dto.disciplineId(), dto.disciplineName(), dto.coachId(), dto.coachName(),
                dto.roomId(), dto.roomName(), dto.capacity(), dto.level(), dto.description(), dto.status(), dto.price(),
                dto.startDate() != null ? dto.startDate() : first,
                dto.endDate() != null ? dto.endDate() : last,
                days,
                dto.startTime() != null ? dto.startTime() : sample.getStartTime(),
                dto.endTime() != null ? dto.endTime() : sample.getEndTime());
    }

    /**
     * Chuyển ClassSession sang ClassSessionDto kèm thông tin lớp, bộ môn, HLV, phòng, sức chứa và số chỗ đã
     * đặt.
     */
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
