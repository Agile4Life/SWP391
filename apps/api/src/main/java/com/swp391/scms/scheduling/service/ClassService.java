package com.swp391.scms.scheduling.service;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.CoachOptionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.EnrolledStudentDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * SCRUM-72: class and class-session management.
 *
 * <p>Schedule-conflict (Trigger P3) is enforced by the database; violations surface as
 * {@link org.springframework.dao.DataIntegrityViolationException} and are translated to
 * HTTP 409 with message key {@code error.scheduling.session_conflict} by the global handler.
 */
@Service
public class ClassService {

    private static final String ROOM_AVAILABLE = "available";
    private static final String COACH_ACTIVE = "active";
    private static final String SESSION_SCHEDULED = "scheduled";
    private static final String CLASS_ACTIVE = "active";
    private static final String ENROLLMENT_BOOKED = "booked";

    private final GymClassRepository gymClasses;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final DisciplineRepository disciplines;
    private final CoachRepository coaches;
    private final RoomRepository rooms;
    private final SchedulingMapper mapper;
    private final Clock clock;

    public ClassService(GymClassRepository gymClasses,
                        ClassSessionRepository sessions,
                        ClassEnrollmentRepository enrollments,
                        DisciplineRepository disciplines,
                        CoachRepository coaches,
                        RoomRepository rooms,
                        SchedulingMapper mapper,
                        Clock clock) {
        this.gymClasses = gymClasses;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.disciplines = disciplines;
        this.coaches = coaches;
        this.rooms = rooms;
        this.mapper = mapper;
        this.clock = clock;
    }

    /**
     * SCRUM-72 BR-01..BR-02, BR-05: create a class. Disciplines/coach/room must exist,
     * capacity &gt; 0, the room must be available and the coach must be active.
     * If sessionDate, startTime, and endTime are provided, schedules the first session atomically.
     */
    @Transactional
    public GymClassDto createClass(CreateClassRequest request) {
        Discipline discipline = disciplines.findById(request.disciplineId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.discipline", request.disciplineId()));

        Coach coach = coaches.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));
        if (!COACH_ACTIVE.equalsIgnoreCase(coach.getEmploymentStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_COACH_INACTIVE",
                    "error.scheduling.coach_inactive",
                    null,
                    "Coach is not active");
        }

        Room room = rooms.findById(request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.room", request.roomId()));
        if (!ROOM_AVAILABLE.equalsIgnoreCase(room.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ROOM_UNAVAILABLE",
                    "error.scheduling.room_unavailable",
                    null,
                    "Room is not available for scheduling");
        }

        if (request.sessionDate() != null && request.startTime() != null && request.endTime() != null) {
            if (!request.endTime().isAfter(request.startTime())) {
                throw new BadRequestException(
                        "SCHEDULING_INVALID_TIME_RANGE",
                        "error.scheduling.invalid_time_range",
                        null,
                        "End time must be after start time");
            }
            SessionEligibility.ensureFuture(request.sessionDate(), request.startTime(), clock);
        }

        GymClass gymClass = new GymClass();
        gymClass.setName(request.name());
        gymClass.setDiscipline(discipline);
        gymClass.setCoach(coach);
        gymClass.setRoom(room);
        gymClass.setCapacity(request.capacity());
        gymClass.setLevel(request.level() != null ? request.level() : "all");
        gymClass.setDescription(request.description());
        gymClass.setStatus(CLASS_ACTIVE);

        GymClass savedClass = gymClasses.save(gymClass);

        if (request.sessionDate() != null && request.startTime() != null && request.endTime() != null) {
            ClassSession initialSession = new ClassSession();
            initialSession.setGymClass(savedClass != null ? savedClass : gymClass);
            initialSession.setSessionDate(request.sessionDate());
            initialSession.setStartTime(request.startTime());
            initialSession.setEndTime(request.endTime());
            initialSession.setStatus(SESSION_SCHEDULED);
            initialSession.setCreatedAt(LocalDateTime.now(clock));
            initialSession.setUpdatedAt(LocalDateTime.now(clock));
            sessions.saveAndFlush(initialSession);
        }

        return mapper.toDto(savedClass);
    }

    /**
     * SCRUM-72 BR-03: schedule a session. End time must be after start time and the
     * session may not be placed in the past. Trigger P3 rejects overlaps at the database.
     */
    @Transactional
    public ClassSessionDto createSession(Long classId, CreateSessionRequest request) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        if (gymClass.getStatus() != null && !CLASS_ACTIVE.equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_CLASS_INACTIVE",
                    "error.scheduling.class_inactive",
                    null,
                    "Class is currently inactive");
        }

        if (!request.endTime().isAfter(request.startTime())) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_TIME_RANGE",
                    "error.scheduling.invalid_time_range",
                    null,
                    "End time must be after start time");
        }

        SessionEligibility.ensureFuture(request.sessionDate(), request.startTime(), clock);

        List<ClassSession> existingOnDate = sessions.searchSessions(request.sessionDate(), request.sessionDate(), null, null);
        if (existingOnDate != null) {
            Optional<ClassSession> sameSession = existingOnDate.stream()
                    .filter(s -> s.getGymClass() != null
                            && classId.equals(s.getGymClass().getId())
                            && request.sessionDate().equals(s.getSessionDate())
                            && request.startTime().equals(s.getStartTime())
                            && request.endTime().equals(s.getEndTime())
                            && SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus()))
                    .findFirst();
            if (sameSession.isPresent()) {
                return mapper.toDto(sameSession.get(), countBooked(sameSession.get()));
            }
        }

        ClassSession session = new ClassSession();
        session.setGymClass(gymClass);
        session.setSessionDate(request.sessionDate());
        session.setStartTime(request.startTime());
        session.setEndTime(request.endTime());
        session.setStatus(SESSION_SCHEDULED);
        session.setCreatedAt(LocalDateTime.now(clock));
        session.setUpdatedAt(LocalDateTime.now(clock));

        ClassSession saved = sessions.saveAndFlush(session);
        return mapper.toDto(saved, countBooked(saved));
    }

    /**
     * SCRUM-72 BR-06: schedule lookup for any authenticated role with optional filters.
     */
    @Transactional(readOnly = true)
    public List<ClassSessionDto> searchSessions(LocalDate fromDate,
                                                LocalDate toDate,
                                                Long disciplineId,
                                                Long coachId) {
        return sessions.searchSessions(fromDate, toDate, disciplineId, coachId).stream()
                .map(session -> mapper.toDto(session, countBooked(session)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<GymClassDto> listClasses() {
        return gymClasses.findAllByOrderByIdDesc().stream()
                .map(mapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CoachOptionDto> listActiveCoaches() {
        return coaches.findAll().stream()
                .filter(c -> COACH_ACTIVE.equalsIgnoreCase(c.getEmploymentStatus())
                        && c.getUser() != null
                        && c.getUser().getDeletedAt() == null
                        && "active".equalsIgnoreCase(c.getUser().getStatus()))
                .map(c -> new CoachOptionDto(
                        c.getUserId(),
                        c.getUser().getFullName(),
                        c.getUser().getEmail(),
                        c.getUser().getPhone(),
                        c.getEmploymentStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getClassStudents(Long classId) {
        if (!gymClasses.existsById(classId)) {
            throw new ResourceNotFoundException("resource.gym_class", classId);
        }
        return enrollments.findByGymClassId(classId).stream()
                .filter(e -> !"cancelled".equalsIgnoreCase(e.getStatus()))
                .map(this::toStudentDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getSessionStudents(Long sessionId) {
        ClassSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
        return getClassStudents(session.getGymClass().getId());
    }

    private EnrolledStudentDto toStudentDto(ClassEnrollment enrollment) {
        Member member = enrollment.getMember();
        User user = member != null ? member.getUser() : null;
        return new EnrolledStudentDto(
                enrollment.getId(),
                member != null ? member.getUserId() : null,
                member != null ? member.getMembershipCode() : null,
                user != null ? user.getFullName() : null,
                user != null ? user.getEmail() : null,
                user != null ? user.getPhone() : null,
                user != null ? user.getAvatarUrl() : null,
                member != null && member.getFitnessGoal() != null ? member.getFitnessGoal() : "",
                member != null && member.getHealthNotes() != null ? member.getHealthNotes() : "",
                member != null && member.getFitnessLevel() != null ? member.getFitnessLevel() : "beginner",
                member != null ? member.getEmergencyContactName() : null,
                member != null ? member.getEmergencyContactPhone() : null,
                enrollment.getEnrolledAt(),
                enrollment.getStatus()
        );
    }

    private long countBooked(ClassSession session) {
        return enrollments.countByGymClassIdAndStatus(session.getGymClass().getId(), ENROLLMENT_BOOKED);
    }
}
