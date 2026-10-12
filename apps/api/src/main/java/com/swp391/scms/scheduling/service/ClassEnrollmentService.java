package com.swp391.scms.scheduling.service;

import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.scheduling.dto.ClassEnrollmentDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.entity.Coach;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ClassEnrollmentService {

    private final ClassEnrollmentRepository enrollmentRepository;
    private final ClassSessionRepository sessionRepository;

    public ClassEnrollmentService(ClassEnrollmentRepository enrollmentRepository,
                                  ClassSessionRepository sessionRepository) {
        this.enrollmentRepository = enrollmentRepository;
        this.sessionRepository = sessionRepository;
    }

    /**
     * Lấy danh sách đăng ký lớp học của hội viên hiện tại, giải quyết triệt để lỗi N+1 queries.
     *
     * @param principal hội viên đang đăng nhập
     * @param status bộ lọc trạng thái (booked, cancelled, completed), có thể null
     * @param upcoming true nếu chỉ lấy các buổi sắp tới, false nếu lấy lịch sử, null nếu lấy tất cả
     * @return danh sách ClassEnrollmentDto
     */
    public List<ClassEnrollmentDto> getMyEnrollments(AuthenticatedPrincipal principal, String status, Boolean upcoming) {
        if (principal == null || principal.id() == null) {
            return Collections.emptyList();
        }

        String filterStatus = (status != null && !status.isBlank()) ? status.trim() : null;
        List<ClassEnrollment> enrollments = enrollmentRepository.findByMemberUserIdWithDetails(principal.id(), filterStatus);

        if (enrollments.isEmpty()) {
            return Collections.emptyList();
        }

        // Lấy danh sách classId duy nhất để truy vấn ClassSession theo lô (batch query)
        List<Long> classIds = enrollments.stream()
                .map(e -> e.getGymClass().getId())
                .distinct()
                .toList();

        List<ClassSession> sessions = sessionRepository.findByGymClassIdIn(classIds);
        Map<Long, List<ClassSession>> sessionsByClass = sessions.stream()
                .collect(Collectors.groupingBy(s -> s.getGymClass().getId()));

        LocalDate today = LocalDate.now();

        List<ClassEnrollmentDto> dtos = enrollments.stream()
                .map(enrollment -> toDto(enrollment, sessionsByClass.get(enrollment.getGymClass().getId()), today))
                .collect(Collectors.toList());

        // Lọc theo upcoming / lịch sử nếu được yêu cầu
        if (Boolean.TRUE.equals(upcoming)) {
            return dtos.stream()
                    .filter(dto -> !"cancelled".equalsIgnoreCase(dto.getStatus())
                            && (dto.getSessionDate() == null || !dto.getSessionDate().isBefore(today)))
                    .collect(Collectors.toList());
        } else if (Boolean.FALSE.equals(upcoming)) {
            return dtos.stream()
                    .filter(dto -> "cancelled".equalsIgnoreCase(dto.getStatus())
                            || "completed".equalsIgnoreCase(dto.getStatus())
                            || (dto.getSessionDate() != null && dto.getSessionDate().isBefore(today)))
                    .collect(Collectors.toList());
        }

        return dtos;
    }

    private ClassEnrollmentDto toDto(ClassEnrollment enrollment, List<ClassSession> classSessions, LocalDate today) {
        GymClass gymClass = enrollment.getGymClass();

        // Xác định session phù hợp nhất cho enrollment này (ưu tiên buổi sắp tới gần nhất)
        ClassSession matchedSession = null;
        if (classSessions != null && !classSessions.isEmpty()) {
            matchedSession = classSessions.stream()
                    .filter(s -> !s.getSessionDate().isBefore(today) && !"cancelled".equalsIgnoreCase(s.getStatus()))
                    .min(Comparator.comparing(ClassSession::getSessionDate)
                            .thenComparing(ClassSession::getStartTime))
                    .orElse(null);

            // Nếu không có buổi sắp tới, lấy buổi gần nhất trong quá khứ
            if (matchedSession == null) {
                matchedSession = classSessions.stream()
                        .max(Comparator.comparing(ClassSession::getSessionDate)
                                .thenComparing(ClassSession::getStartTime))
                        .orElse(null);
            }
        }

        Coach coach = gymClass.getCoach();
        String coachName = (coach != null && coach.getUser() != null) ? coach.getUser().getFullName() : null;

        Room room = gymClass.getRoom();
        String roomName = (room != null) ? room.getName() : null;

        return new ClassEnrollmentDto(
                enrollment.getId(),
                gymClass.getId(),
                gymClass.getName(),
                coachName,
                roomName,
                matchedSession != null ? matchedSession.getSessionDate() : null,
                matchedSession != null ? matchedSession.getStartTime() : null,
                matchedSession != null ? matchedSession.getEndTime() : null,
                enrollment.getStatus(),
                enrollment.getEnrolledAt(),
                enrollment.getCancelledAt(),
                enrollment.getCancelReason()
        );
    }
}
