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
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

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

        GymClass gymClass = new GymClass();
        gymClass.setName(request.name());
        gymClass.setDiscipline(discipline);
        gymClass.setCoach(coach);
        gymClass.setRoom(room);
        gymClass.setCapacity(request.capacity());
        gymClass.setLevel(request.level() != null ? request.level() : "all");
        gymClass.setDescription(request.description());
        gymClass.setStatus(CLASS_ACTIVE);

        return mapper.toDto(gymClasses.save(gymClass));
    }

    /**
     * SCRUM-72 BR-03: schedule a session. End time must be after start time and the
     * session may not be placed in the past. Trigger P3 rejects overlaps at the database.
     */
    @Transactional
    public ClassSessionDto createSession(Long classId, CreateSessionRequest request) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        if (!request.endTime().isAfter(request.startTime())) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_TIME_RANGE",
                    "error.scheduling.invalid_time_range",
                    null,
                    "End time must be after start time");
        }

        if (request.sessionDate().isBefore(LocalDate.now(clock))) {
            throw new BadRequestException(
                    "SCHEDULING_PAST_SESSION",
                    "error.scheduling.past_session",
                    null,
                    "Cannot schedule a session in the past");
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

    private long countBooked(ClassSession session) {
        return enrollments.countByGymClassIdAndStatus(session.getGymClass().getId(), ENROLLMENT_BOOKED);
    }
}
