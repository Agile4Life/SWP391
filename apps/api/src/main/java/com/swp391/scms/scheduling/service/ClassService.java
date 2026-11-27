package com.swp391.scms.scheduling.service;

import com.swp391.scms.attendance.repository.SessionAttendanceRepository;
import com.swp391.scms.audit.Audited;
import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.CoachReviewRepository;
import com.swp391.scms.coaching.repository.SessionEvaluationRepository;
import com.swp391.scms.common.ScheduleSlot;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.facilities.entity.Discipline;
import com.swp391.scms.facilities.entity.Room;
import com.swp391.scms.facilities.repository.DisciplineRepository;
import com.swp391.scms.facilities.repository.RoomRepository;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.notifications.event.SessionCancelledEvent;
import com.swp391.scms.operations.entity.StaffInternalRequest;
import com.swp391.scms.operations.repository.StaffInternalRequestRepository;
import com.swp391.scms.scheduling.dto.CoachCourseRange;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateRecurringClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.CreateSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RecurringAvailabilityRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.RescheduleSessionRequest;
import com.swp391.scms.scheduling.dto.SchedulingRequests.UpdateClassRequest;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.CoachAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.CoachOptionDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.EnrolledStudentDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.GymClassDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.RecurringAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.RoomAvailabilityDto;
import com.swp391.scms.scheduling.dto.SchedulingResponses.SlotAvailabilityDto;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.entity.SessionBooking;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * SCRUM-72, SCRUM-131 & SCRUM-132: Nghiệp vụ quản lý lớp/khóa học và buổi học: tạo, sửa, đóng/xóa lớp, xếp và
 * dời buổi, tra cứu lịch và học viên.
 *
 * <p>Kiểm tra trùng lịch (Trigger P3) được thực thi cả ở tầng service (kèm thông báo chi tiết về xung đột phòng
 * và HLV) và ở tầng database qua trigger.
 */
@Service
public class ClassService {

    private static final String ROOM_AVAILABLE = "available";
    private static final String COACH_ACTIVE = "active";
    private static final String SESSION_SCHEDULED = "scheduled";
    private static final String CLASS_ACTIVE = "active";
    private static final String CLASS_INACTIVE = "inactive";
    private static final String ENROLLMENT_BOOKED = "booked";
    private static final String CLASS_DEACTIVATED_REASON = "Lớp học ngừng hoạt động";
    private static final long MAX_RECURRING_SPAN_DAYS = 365L;
    /** Một HLV dạy tối đa 3 khóa chạy đồng thời; khóa thứ 4 chỉ nhận được sau ngày kết thúc của một khóa. */
    static final int MAX_CONCURRENT_COURSES_PER_COACH = 3;

    private final GymClassRepository gymClasses;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;

    @Autowired(required = false)
    private SessionBookingRepository sessionBookings;
    @Autowired(required = false)
    private SessionAttendanceRepository sessionAttendances;
    @Autowired(required = false)
    private SessionEvaluationRepository sessionEvaluations;
    @Autowired(required = false)
    private CoachReviewRepository coachReviews;
    @Autowired(required = false)
    private PaymentRepository payments;
    @Autowired(required = false)
    private StaffInternalRequestRepository staffInternalRequestRepository;
    @Autowired(required = false)
    private CoachBookingRepository coachBookingRepository;
    @Autowired(required = false)
    private NotificationService notificationService;
    @Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private EnrollmentService enrollmentService;
    @Autowired(required = false)
    private ApplicationEventPublisher eventPublisher;
    @Autowired(required = false)
    private MessageService messageService;
    @Autowired(required = false)
    private EntityManager entityManager;

    private final DisciplineRepository disciplines;
    private final CoachRepository coaches;
    private final RoomRepository rooms;
    private final SchedulingMapper mapper;
    private final Clock clock;

    /**
     * Constructor chính: nhận các repository lớp, buổi, ghi danh, bộ môn, HLV, phòng, mapper và Clock.
     */
    @Autowired
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
     * Tạo lớp (một buổi, đã ngừng ở API): bộ môn/HLV/phòng phải tồn tại, HLV active, phòng sẵn sàng, sức chứa >
     * 0; nếu có ngày giờ thì kiểm tra xung đột rồi xếp buổi đầu tiên.
     *
     * SCRUM-72 BR-01..BR-02, BR-05 & SCRUM-132: tạo lớp. Bộ môn/HLV/phòng phải tồn tại, sức chứa &gt; 0,
     * phòng phải khả dụng và HLV phải đang hoạt động. Nếu có sessionDate, startTime, endTime thì kiểm tra
     * xung đột phòng/HLV trước rồi xếp buổi đầu một cách nguyên tử.
     */
    @Transactional
    @Audited(action = "CLASS_CREATE", entity = "classes")
    public GymClassDto createClass(CreateClassRequest request) {
        Discipline discipline = disciplines.findById(request.disciplineId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.discipline", request.disciplineId()));

        Coach coach = coaches.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));
        ensureCoachActive(coach);

        Room room = rooms.findById(request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.room", request.roomId()));
        if (!ROOM_AVAILABLE.equalsIgnoreCase(room.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ROOM_UNAVAILABLE",
                    "error.scheduling.room_unavailable",
                    null,
                    "Room is not available for scheduling");
        }
        validateRoomCapacity(room, request.capacity());

        if (request.sessionDate() != null && request.startTime() != null && request.endTime() != null) {
            if (!request.endTime().isAfter(request.startTime())) {
                throw new BadRequestException(
                        "SCHEDULING_INVALID_TIME_RANGE",
                        "error.scheduling.invalid_time_range",
                        null,
                        "End time must be after start time");
            }
            ScheduleSlot.requireValid(request.startTime(), request.endTime());
            SessionEligibility.ensureFuture(request.sessionDate(), request.startTime(), clock);
            ensureNoSessionConflict(
                    discipline.getId(),
                    coach.getUserId(),
                    room.getId(),
                    request.sessionDate(),
                    request.startTime(),
                    request.endTime(),
                    null,
                    null);
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

        return mapper.toDto(savedClass != null ? savedClass : gymClass);
    }

    /**
     * Tạo khóa định kỳ: kiểm tra bộ môn/HLV/phòng, sức chứa phòng, học phí không âm, sinh mọi buổi trong
     * [startDate, endDate] theo các thứ đã chọn và kiểm tra xung đột phòng/HLV/bộ môn cho từng buổi.
     */
    @Transactional
    @Audited(action = "CLASS_CREATE_RECURRING", entity = "classes")
    public GymClassDto createRecurringClass(CreateRecurringClassRequest request) {
        Discipline discipline = disciplines.findById(request.disciplineId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.discipline", request.disciplineId()));

        Coach coach = coaches.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));
        ensureCoachActive(coach);

        Room room = rooms.findById(request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.room", request.roomId()));
        if (!ROOM_AVAILABLE.equalsIgnoreCase(room.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ROOM_UNAVAILABLE",
                    "error.scheduling.room_unavailable",
                    null,
                    "Room is not available for scheduling");
        }
        validateRoomCapacity(room, request.capacity());

        if (request.price() != null && request.price().compareTo(java.math.BigDecimal.ZERO) < 0) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_PRICE",
                    "error.scheduling.invalid_price",
                    null,
                    "Course price cannot be negative");
        }

        if (request.startDate() == null || request.endDate() == null) {
            throw new BadRequestException("SCHEDULING_INVALID_DATES", "error.scheduling.invalid_dates", null, "Ngày bắt đầu và ngày kết thúc không được để trống");
        }
        if (request.endDate().isBefore(request.startDate())
                || java.time.temporal.ChronoUnit.DAYS.between(request.startDate(), request.endDate()) > MAX_RECURRING_SPAN_DAYS) {
            throw new BadRequestException("SCHEDULING_INVALID_DATE_RANGE", "error.scheduling.invalid_date_range", null,
                    "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu và không vượt quá 365 ngày");
        }
        if (request.startTime() == null || request.endTime() == null || !request.endTime().isAfter(request.startTime())) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_TIME_RANGE",
                    "error.scheduling.invalid_time_range",
                    null,
                    "End time must be after start time");
        }
        ScheduleSlot.requireValid(request.startTime(), request.endTime());

        java.util.Set<java.time.DayOfWeek> selectedDays = parseRecurringDays(request.recurringDays());
        if (selectedDays.isEmpty()) {
            throw new BadRequestException("SCHEDULING_NO_RECURRING_DAYS", "error.scheduling.no_recurring_days", null, "Vui lòng chọn ít nhất một ngày trong tuần");
        }
        List<LocalDate> sessionDates = new ArrayList<>();
        for (LocalDate d = request.startDate(); !d.isAfter(request.endDate()); d = d.plusDays(1)) {
            if (selectedDays.contains(d.getDayOfWeek())) {
                sessionDates.add(d);
            }
        }
        if (sessionDates.isEmpty()) {
            throw new BadRequestException("SCHEDULING_NO_SESSIONS_MATCHED", "error.scheduling.no_sessions_matched", null, "Không có buổi học nào phù hợp với các thứ trong tuần đã chọn");
        }

        if (request.startDate().isBefore(SessionEligibility.today(clock))) {
            throw new BadRequestException("SCHEDULING_PAST_SESSION", "error.scheduling.past_session",
                    null, "Session must start in the future");
        }
        LocalDate firstDate = sessionDates.get(0);
        LocalDate lastDate = sessionDates.get(sessionDates.size() - 1);
        SessionEligibility.ensureFuture(firstDate, request.startTime(), clock);

        ensureCoachCourseLimit(coach, firstDate, lastDate, null);
        ensureNoRecurringSessionConflicts(
                discipline.getId(),
                coach.getUserId(),
                room.getId(),
                sessionDates,
                firstDate,
                lastDate,
                request.startTime(),
                request.endTime());

        GymClass gymClass = new GymClass();
        gymClass.setName(request.name());
        gymClass.setDiscipline(discipline);
        gymClass.setCoach(coach);
        gymClass.setRoom(room);
        gymClass.setCapacity(request.capacity());
        gymClass.setLevel(request.level() != null ? request.level() : "all");
        gymClass.setDescription(request.description());
        gymClass.setStatus(CLASS_ACTIVE);
        gymClass.setPrice(request.price() != null ? request.price() : java.math.BigDecimal.ZERO);
        gymClass.setStartDate(request.startDate());
        gymClass.setEndDate(request.endDate());
        gymClass.setRecurringDays(selectedDays.stream()
                .map(java.time.DayOfWeek::name)
                .collect(java.util.stream.Collectors.joining(",")));
        gymClass.setStartTime(request.startTime());
        gymClass.setEndTime(request.endTime());

        GymClass savedClass = gymClasses.save(gymClass);

        LocalDateTime now = LocalDateTime.now(clock);
        for (LocalDate sessionDate : sessionDates) {
            ClassSession session = new ClassSession();
            session.setGymClass(savedClass != null ? savedClass : gymClass);
            session.setSessionDate(sessionDate);
            session.setStartTime(request.startTime());
            session.setEndTime(request.endTime());
            session.setStatus(SESSION_SCHEDULED);
            session.setCreatedAt(now);
            session.setUpdatedAt(now);
            sessions.saveAndFlush(session);
        }

        return mapper.toDto(savedClass != null ? savedClass : gymClass);
    }

    /**
     * Quản lý cập nhật lớp: kiểm tra bộ môn/HLV/phòng và sức chứa; chuyển lớp sang ngừng hoạt động thì đóng lớp
     * như khi xóa để không còn lượt đặt sống.
     *
     * SCRUM-131 & SCRUM-132: Quản lý cập nhật lớp hiện có.
     */
    @Transactional
    @Audited(action = "CLASS_UPDATE", entity = "classes")
    public GymClassDto updateClass(Long classId, UpdateClassRequest request) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        Discipline discipline = disciplines.findById(request.disciplineId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.discipline", request.disciplineId()));

        String targetStatus = (request.status() != null && !request.status().isBlank())
                ? request.status().trim().toLowerCase(java.util.Locale.ROOT)
                : (gymClass.getStatus() != null ? gymClass.getStatus().trim().toLowerCase(java.util.Locale.ROOT) : CLASS_ACTIVE);
        boolean closingOrInactive = CLASS_INACTIVE.equals(targetStatus) || "archived".equals(targetStatus);
        boolean activating = !CLASS_ACTIVE.equalsIgnoreCase(gymClass.getStatus())
                && CLASS_ACTIVE.equals(targetStatus);

        Coach coach = coaches.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));
        if (!closingOrInactive) {
            ensureCoachActive(coach);
        }

        Room room = rooms.findById(request.roomId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.room", request.roomId()));
        if (!closingOrInactive && !ROOM_AVAILABLE.equalsIgnoreCase(room.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_ROOM_UNAVAILABLE",
                    "error.scheduling.room_unavailable",
                    null,
                    "Room is not available for scheduling");
        }
        if (!closingOrInactive) {
            validateRoomCapacity(room, request.capacity());
        }

        long bookedCount = enrollments.countByGymClassIdAndStatus(classId, ENROLLMENT_BOOKED) + busiestSession(classId);
        if (request.capacity() < bookedCount) {
            throw new BadRequestException(
                    "SCHEDULING_CAPACITY_BELOW_BOOKED",
                    "error.scheduling.capacity_below_booked",
                    new Object[]{bookedCount},
                    "Capacity cannot be less than current booked students (" + bookedCount + ")");
        }

        Long oldCoachId = gymClass.getCoach() != null ? gymClass.getCoach().getUserId() : null;
        Long oldRoomId = gymClass.getRoom() != null ? gymClass.getRoom().getId() : null;
        Long oldDisciplineId = gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null;
        boolean scheduleResourceChanged = !Objects.equals(oldCoachId, coach.getUserId())
                || !Objects.equals(oldRoomId, room.getId())
                || !Objects.equals(oldDisciplineId, discipline.getId());

        if (!closingOrInactive && (scheduleResourceChanged || activating)) {
            Long effectiveDisciplineId = CLASS_ACTIVE.equalsIgnoreCase(targetStatus) ? discipline.getId() : null;
            List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId);
            boolean coachTakesCourse = CLASS_ACTIVE.equals(targetStatus)
                    && (activating || !Objects.equals(oldCoachId, coach.getUserId()));
            if (coachTakesCourse && classSessions != null) {
                List<LocalDate> scheduledDates = classSessions.stream()
                        .filter(s -> SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus()) && s.getSessionDate() != null)
                        .map(ClassSession::getSessionDate)
                        .sorted()
                        .toList();
                if (!scheduledDates.isEmpty()) {
                    ensureCoachCourseLimit(coach, scheduledDates.get(0),
                            scheduledDates.get(scheduledDates.size() - 1), classId);
                }
            }
            if (classSessions != null) {
                for (ClassSession s : classSessions) {
                    if (SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus())) {
                        ensureNoSessionConflict(
                                effectiveDisciplineId,
                                coach.getUserId(),
                                room.getId(),
                                s.getSessionDate(),
                                s.getStartTime(),
                                s.getEndTime(),
                                s.getId(),
                                null);
                    }
                }
            }
        }

        gymClass.setName(request.name().trim());
        gymClass.setDiscipline(discipline);
        gymClass.setCoach(coach);
        gymClass.setRoom(room);
        gymClass.setCapacity(request.capacity());
        gymClass.setLevel(request.level() != null ? request.level() : "all");
        gymClass.setDescription(request.description());
        if (request.status() != null && !request.status().isBlank()) {
            String normalizedStatus = request.status().trim().toLowerCase(java.util.Locale.ROOT);
            boolean closing = !CLASS_INACTIVE.equalsIgnoreCase(gymClass.getStatus())
                    && !"archived".equalsIgnoreCase(gymClass.getStatus())
                    && (CLASS_INACTIVE.equals(normalizedStatus) || "archived".equals(normalizedStatus));
            if (closing) {
                // Cùng dây chuyền xử lý như khi xóa lớp, để việc dừng một lớp không bao giờ để sót lượt đặt còn
                // hiệu lực.
                closeClass(gymClass, enrollments.findByGymClassId(classId),
                        sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId), LocalDateTime.now(clock));
            }
            gymClass.setStatus(normalizedStatus);
        }
        gymClass.setUpdatedAt(LocalDateTime.now(clock));

        GymClass savedClass = gymClasses.saveAndFlush(gymClass);

        if (!closingOrInactive && (scheduleResourceChanged || activating)) {
            List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId);
            if (classSessions != null) {
                for (ClassSession s : classSessions) {
                    if (SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus())) {
                        s.setUpdatedAt(LocalDateTime.now(clock));
                        sessions.saveAndFlush(s);
                    }
                }
            }
        }

        return mapper.toDto(savedClass != null ? savedClass : gymClass);
    }

    /** Kiểm tra HLV đang làm việc và tài khoản người dùng tương ứng đang hoạt động, chưa bị xóa mềm. */
    private void ensureCoachActive(Coach coach) {
        User user = coach != null ? coach.getUser() : null;
        boolean activeEmployment = coach != null && COACH_ACTIVE.equalsIgnoreCase(coach.getEmploymentStatus());
        boolean activeUser = user != null
                && user.getDeletedAt() == null
                && COACH_ACTIVE.equalsIgnoreCase(user.getStatus());
        if (!activeEmployment || !activeUser) {
            throw new BadRequestException(
                    "SCHEDULING_COACH_INACTIVE",
                    "error.scheduling.coach_inactive",
                    null,
                    "Coach is not active");
        }
    }

    /** Kiểm tra sĩ số lớp không vượt quá sức chứa của phòng (bỏ qua khi sức chứa phòng chưa cấu hình / <= 0). */
    private void validateRoomCapacity(Room room, Integer requestedCapacity) {
        if (room != null && requestedCapacity != null && room.getCapacity() > 0 && requestedCapacity > room.getCapacity()) {
            String roomName = room.getName() != null ? room.getName() : ("#" + room.getId());
            throw new BadRequestException(
                    "SCHEDULING_CAPACITY_EXCEEDS_ROOM",
                    "error.scheduling.capacity_exceeds_room",
                    new Object[]{requestedCapacity, roomName, room.getCapacity()},
                    "Requested capacity (" + requestedCapacity + ") exceeds room " + roomName
                            + " capacity (" + room.getCapacity() + ")");
        }
    }

    /**
     * Đóng lớp: hủy các buổi chưa bắt đầu, nhả lượt đặt chỗ và ghi danh khóa, hoàn phí đã trả vào ví và thông
     * báo cho hội viên.
     *
     * Đóng lớp: hủy các buổi chưa bắt đầu, nhả lượt đặt và ghi danh khóa học, hoàn phí khóa đã thanh toán vào
     * ví và thông báo hội viên.
     */
    private void closeClass(GymClass gymClass, List<ClassEnrollment> classEnrollments, List<ClassSession> classSessions,
                            LocalDateTime now) {
        Long classId = gymClass.getId();
        String className = gymClass.getName() != null ? gymClass.getName() : "";

        if (classSessions != null) {
            for (ClassSession session : classSessions) {
                if (session == null || !SESSION_SCHEDULED.equalsIgnoreCase(session.getStatus())) {
                    continue;
                }
                // Các buổi đã diễn ra giữ nguyên lịch sử; chúng sẽ được chốt là completed sau.
                if (session.getSessionDate() != null && session.getStartTime() != null
                        && !LocalDateTime.of(session.getSessionDate(), session.getStartTime()).isAfter(now)) {
                    continue;
                }
                session.setStatus("cancelled");
                session.setCancelReason(CLASS_DEACTIVATED_REASON);
                session.setUpdatedAt(now);
                sessions.saveAndFlush(session);

                List<Long> affectedMemberUserIds = new ArrayList<>();
                String sessionDateStr = session.getSessionDate() != null ? session.getSessionDate().toString() : "";

                if (classEnrollments != null) {
                    for (ClassEnrollment enrollment : classEnrollments) {
                        if (enrollment != null && ENROLLMENT_BOOKED.equalsIgnoreCase(enrollment.getStatus())
                                && enrollment.getMember() != null && enrollment.getMember().getUserId() != null) {
                            Long memberId = enrollment.getMember().getUserId();
                            if (!affectedMemberUserIds.contains(memberId)) {
                                affectedMemberUserIds.add(memberId);
                                if (notificationService != null) {
                                    notificationService.send(
                                            memberId,
                                            msg("notifications.session.cancelled.title"),
                                            msg("notifications.session.cancelled.body", className, sessionDateStr, CLASS_DEACTIVATED_REASON),
                                            "schedule_change",
                                            "class_session",
                                            session.getId());
                                }
                            }
                        }
                    }
                }

                if (sessionBookings != null && session.getId() != null) {
                    for (SessionBooking booking : sessionBookings.findBySessionIdAndStatus(session.getId(), ENROLLMENT_BOOKED)) {
                        booking.setStatus("cancelled");
                        booking.setCancelledAt(now);
                        booking.setCancelReason(CLASS_DEACTIVATED_REASON);
                        sessionBookings.save(booking);
                        Member member = booking.getMember();
                        if (member != null && member.getUserId() != null) {
                            if (!affectedMemberUserIds.contains(member.getUserId())) {
                                affectedMemberUserIds.add(member.getUserId());
                                if (notificationService != null) {
                                    notificationService.send(
                                            member.getUserId(),
                                            msg("notifications.session.cancelled.title"),
                                            msg("notifications.session.cancelled.body", className, sessionDateStr, CLASS_DEACTIVATED_REASON),
                                            "schedule_change",
                                            "class_session",
                                            session.getId());
                                }
                            }
                        }
                    }
                }

                if (eventPublisher != null) {
                    eventPublisher.publishEvent(new SessionCancelledEvent(
                            session.getId(),
                            classId,
                            className,
                            session.getSessionDate(),
                            session.getStartTime(),
                            CLASS_DEACTIVATED_REASON,
                            affectedMemberUserIds));
                }
            }
        }

        if (classEnrollments != null) {
            for (ClassEnrollment enrollment : classEnrollments) {
                if (enrollment != null && ENROLLMENT_BOOKED.equalsIgnoreCase(enrollment.getStatus())) {
                    enrollment.setStatus("cancelled");
                    enrollment.setCancelledAt(now);
                    enrollment.setCancelReason(CLASS_DEACTIVATED_REASON);
                    enrollments.save(enrollment);
                    // Trung tâm đóng khóa học: khoản phí đã thanh toán được hoàn vào ví hội viên.
                    if (enrollmentService != null) {
                        enrollmentService.settleFeeOnClassClosure(enrollment, CLASS_DEACTIVATED_REASON);
                    }
                }
            }
        }
    }

    /**
     * SCRUM-131 AC & A4: Quản lý xóa lớp (sau khi xác nhận hai lần trên UI). Nếu có bản ghi lịch sử/phụ
     * thuộc, hủy kích hoạt mềm lớp, hủy các buổi đã xếp sắp tới với lý do "Lớp học ngừng hoạt động" và thông
     * báo cho các hội viên đã đặt chỗ.
     */
    @Transactional
    @Audited(action = "CLASS_DELETE", entity = "classes")
    public void deleteClass(Long classId) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        List<ClassEnrollment> classEnrollments = enrollments.findByGymClassId(classId);
        List<ClassSession> classSessions = sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(classId);

        if (hasDependentRecords(classId, classEnrollments, classSessions)) {
            LocalDateTime now = LocalDateTime.now(clock);
            closeClass(gymClass, classEnrollments, classSessions, now);

            gymClass.setStatus(CLASS_INACTIVE);
            gymClass.setUpdatedAt(now);
            gymClasses.save(gymClass);
            gymClasses.flush();
            return;
        }

        enrollments.deleteByGymClassId(classId);
        sessions.deleteByGymClassId(classId);
        gymClasses.delete(gymClass);
        gymClasses.flush();
    }

    /**
     * True nếu lớp đã có dữ liệu phụ thuộc (ghi danh, thanh toán, đặt chỗ, điểm danh, đánh giá, buổi không còn
     * scheduled) — khi đó chỉ đóng lớp chứ không xóa cứng.
     */
    private boolean hasDependentRecords(Long classId,
                                        List<ClassEnrollment> classEnrollments,
                                        List<ClassSession> classSessions) {
        if (classEnrollments != null && !classEnrollments.isEmpty()) {
            return true;
        }
        if (payments != null && payments.existsByClassEnrollmentGymClassId(classId)) {
            return true;
        }
        if (sessionBookings != null && !sessionBookings.findBookedByClassId(classId).isEmpty()) {
            return true;
        }
        if (classSessions != null) {
            for (ClassSession s : classSessions) {
                if (s == null) {
                    continue;
                }
                if (s.getStatus() != null && !SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus())) {
                    return true;
                }
                Long sid = s.getId();
                if (sid != null) {
                    if (sessionBookings != null && (
                            !sessionBookings.findBySessionIdAndStatus(sid, ENROLLMENT_BOOKED).isEmpty()
                                    || !sessionBookings.findBySessionIdAndStatus(sid, "cancelled").isEmpty()
                                    || !sessionBookings.findBySessionIdAndStatus(sid, "completed").isEmpty())) {
                        return true;
                    }
                    if (sessionAttendances != null && !sessionAttendances.findBySessionId(sid).isEmpty()) {
                        return true;
                    }
                    if (sessionEvaluations != null && !sessionEvaluations.findBySessionIdOrderByEvaluatedAtDesc(sid).isEmpty()) {
                        return true;
                    }
                    if (coachReviews != null && coachReviews.existsByClassSessionId(sid)) {
                        return true;
                    }
                }
            }
        }
        if (entityManager != null) {
            if (countQuery("SELECT COUNT(sb) FROM SessionBooking sb WHERE sb.session.gymClass.id = :cid", classId) > 0
                    || countQuery("SELECT COUNT(ce) FROM ClassEnrollment ce WHERE ce.gymClass.id = :cid", classId) > 0
                    || countQuery("SELECT COUNT(p) FROM Payment p WHERE p.classEnrollment.gymClass.id = :cid", classId) > 0
                    || countQuery("SELECT COUNT(sa) FROM SessionAttendance sa WHERE sa.session.gymClass.id = :cid", classId) > 0
                    || countQuery("SELECT COUNT(se) FROM SessionEvaluation se WHERE se.session.gymClass.id = :cid", classId) > 0
                    || countQuery("SELECT COUNT(cr) FROM CoachReview cr, ClassSession cs WHERE cr.classSessionId = cs.id AND cs.gymClass.id = :cid", classId) > 0) {
                return true;
            }
        }
        return false;
    }

    /** Chạy một câu JPQL đếm với tham số cid; lỗi (vd. entity không tồn tại) thì trả 0. */
    private long countQuery(String jpql, Long classId) {
        try {
            Long count = entityManager.createQuery(jpql, Long.class)
                    .setParameter("cid", classId)
                    .getSingleResult();
            return count != null ? count : 0L;
        } catch (RuntimeException ignored) {
            return 0L;
        }
    }

    /** Dịch message key kèm tham số; không có MessageService thì trả lại key. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /**
     * Xếp một buổi cho lớp: lớp active, giờ kết thúc sau giờ bắt đầu, buổi ở tương lai; kiểm tra trước xung đột
     * phòng/HLV và học viên rồi lưu.
     *
     * SCRUM-72 BR-03 & SCRUM-132: xếp một buổi. Giờ kết thúc phải sau giờ bắt đầu và buổi không được đặt
     * trong quá khứ. Kiểm tra trước xung đột phòng và HLV khi lưu.
     */
    @Transactional
    @Audited(action = "SESSION_CREATE", entity = "class_sessions")
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

        if (request.startTime() == null || request.endTime() == null || !request.endTime().isAfter(request.startTime())) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_TIME_RANGE",
                    "error.scheduling.invalid_time_range",
                    null,
                    "End time must be after start time");
        }

        ScheduleSlot.requireValid(request.startTime(), request.endTime());

        SessionEligibility.ensureFuture(request.sessionDate(), request.startTime(), clock);

        Long disciplineId = gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null;
        Long coachId = gymClass.getCoach() != null ? gymClass.getCoach().getUserId() : null;
        Long roomId = gymClass.getRoom() != null ? gymClass.getRoom().getId() : null;
        ensureNoSessionConflict(
                disciplineId,
                coachId,
                roomId,
                request.sessionDate(),
                request.startTime(),
                request.endTime(),
                null,
                classId);
        ensureNoMemberOverlap(classId, null, request.sessionDate(), request.startTime(), request.endTime());

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
     * Quản lý dời lịch một buổi: buổi phải thuộc lớp, chưa hủy, lớp active; kiểm tra giờ, tương lai và xung đột
     * phòng/HLV/học viên (trigger DB kiểm tra lại).
     *
     * SCRUM-131 & SCRUM-132: Quản lý dời lịch buổi học hiện có. Kiểm tra trước xung đột phòng và HLV và áp
     * dụng Trigger P3 ở database.
     */
    @Transactional
    @Audited(action = "SESSION_RESCHEDULE", entity = "class_sessions")
    public ClassSessionDto rescheduleSession(Long classId, Long sessionId, RescheduleSessionRequest request) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));

        ClassSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));

        if (session.getGymClass() == null || !classId.equals(session.getGymClass().getId())) {
            throw new ResourceNotFoundException("resource.class_session", sessionId);
        }

        if ("cancelled".equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_SESSION_CANCELLED",
                    "error.scheduling.session_cancelled",
                    null,
                    "This session has been cancelled");
        }
        if (!SESSION_SCHEDULED.equalsIgnoreCase(session.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_SESSION_NOT_SCHEDULED",
                    "error.scheduling.session_not_bookable",
                    null,
                    "Only a scheduled session can be rescheduled");
        }

        if (gymClass.getStatus() != null && !CLASS_ACTIVE.equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException(
                    "SCHEDULING_CLASS_INACTIVE",
                    "error.scheduling.class_inactive",
                    null,
                    "Class is currently inactive");
        }

        if (request.startTime() == null || request.endTime() == null || !request.endTime().isAfter(request.startTime())) {
            throw new BadRequestException(
                    "SCHEDULING_INVALID_TIME_RANGE",
                    "error.scheduling.invalid_time_range",
                    null,
                    "End time must be after start time");
        }

        ScheduleSlot.requireValid(request.startTime(), request.endTime());

        SessionEligibility.ensureFuture(request.sessionDate(), request.startTime(), clock);

        Long disciplineId = gymClass.getDiscipline() != null ? gymClass.getDiscipline().getId() : null;
        Long coachId = gymClass.getCoach() != null ? gymClass.getCoach().getUserId() : null;
        Long roomId = gymClass.getRoom() != null ? gymClass.getRoom().getId() : null;
        ensureNoSessionConflict(
                disciplineId,
                coachId,
                roomId,
                request.sessionDate(),
                request.startTime(),
                request.endTime(),
                sessionId,
                null);
        ensureNoMemberOverlap(classId, sessionId, request.sessionDate(), request.startTime(), request.endTime());

        LocalDate oldDate = session.getSessionDate();
        LocalTime oldStart = session.getStartTime();
        LocalTime oldEnd = session.getEndTime();

        session.setSessionDate(request.sessionDate());
        session.setStartTime(request.startTime());
        session.setEndTime(request.endTime());
        session.setUpdatedAt(LocalDateTime.now(clock));

        ClassSession saved = sessions.saveAndFlush(session);
        ClassSession effective = saved != null ? saved : session;
        notifySessionRescheduled(gymClass, effective, oldDate, oldStart, oldEnd);
        return mapper.toDto(effective, countBooked(effective));
    }

    /**
     * Kiểm tra trước lịch trống và xung đột cho khóa học định kỳ trên cả 5 slot cố định, danh sách phòng khả dụng
     * và danh sách HLV đang làm việc.
     */
    @Transactional(readOnly = true)
    public RecurringAvailabilityDto checkRecurringAvailability(RecurringAvailabilityRequest request) {
        Discipline discipline = disciplines.findById(request.disciplineId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.discipline", request.disciplineId()));

        if (request.startDate() == null || request.endDate() == null) {
            return invalidSchedule("SCHEDULING_INVALID_DATES", "error.scheduling.invalid_dates");
        }
        if (request.endDate().isBefore(request.startDate())
                || java.time.temporal.ChronoUnit.DAYS.between(request.startDate(), request.endDate()) > MAX_RECURRING_SPAN_DAYS) {
            return invalidSchedule("SCHEDULING_INVALID_DATE_RANGE", "error.scheduling.invalid_date_range");
        }

        java.util.Set<java.time.DayOfWeek> selectedDays = parseRecurringDays(request.recurringDays());
        if (selectedDays.isEmpty()) {
            return invalidSchedule("SCHEDULING_NO_RECURRING_DAYS", "error.scheduling.no_recurring_days");
        }

        List<LocalDate> sessionDates = new ArrayList<>();
        for (LocalDate d = request.startDate(); !d.isAfter(request.endDate()); d = d.plusDays(1)) {
            if (selectedDays.contains(d.getDayOfWeek())) {
                sessionDates.add(d);
            }
        }
        if (sessionDates.isEmpty()) {
            return invalidSchedule("SCHEDULING_NO_SESSIONS_MATCHED", "error.scheduling.no_sessions_matched");
        }

        ScheduleSlot selectedSlot;
        if (request.startTime() == null && request.endTime() == null) {
            selectedSlot = ScheduleSlot.SLOT_1;
        } else {
            Optional<ScheduleSlot> parsed = ScheduleSlot.fromRange(request.startTime(), request.endTime());
            if (parsed.isEmpty()) {
                return invalidSchedule("SCHEDULING_INVALID_SLOT", "error.scheduling.invalid_slot");
            }
            selectedSlot = parsed.get();
        }

        LocalDate firstDate = sessionDates.get(0);
        LocalDate lastDate = sessionDates.get(sessionDates.size() - 1);

        List<Room> rawRooms = rooms.findAll();
        List<Room> availableRooms = rawRooms == null ? List.of() : rawRooms.stream()
                .filter(r -> r != null && ROOM_AVAILABLE.equalsIgnoreCase(r.getStatus()))
                .toList();

        List<Coach> rawCoaches = coaches.findActiveWithUser();
        List<Coach> activeCoaches = rawCoaches == null ? List.of() : rawCoaches.stream()
                .filter(Objects::nonNull)
                .toList();

        List<ClassSession> rawScheduled = sessions.findScheduledSessionsBetweenDates(firstDate, lastDate);
        List<ClassSession> scheduledSessions = rawScheduled == null ? List.of() : rawScheduled;
        java.util.Map<LocalDate, List<ClassSession>> sessionsByDate = new java.util.HashMap<>();
        for (ClassSession s : scheduledSessions) {
            if (s != null && s.getSessionDate() != null
                    && (s.getStatus() == null || SESSION_SCHEDULED.equalsIgnoreCase(s.getStatus()))) {
                sessionsByDate.computeIfAbsent(s.getSessionDate(), k -> new ArrayList<>()).add(s);
            }
        }

        java.util.Map<Long, java.util.Set<LocalDate>> approvedLeaveDatesByCoach =
                loadApprovedLeaveDatesByCoach(activeCoaches, sessionDates, firstDate, lastDate);
        java.util.Map<Long, java.util.Map<LocalDate, List<CoachBooking>>> ptBookingsByCoachAndDate =
                loadConfirmedPtBookingsByCoachAndDate(firstDate, lastDate);
        java.util.Map<Long, String> courseLimitReasonByCoach = new java.util.HashMap<>();
        java.util.Map<Long, List<CoachCourseRange>> rangesByCoach = loadCourseRangesByCoach();
        for (Coach coach : activeCoaches) {
            String reason = coachCourseLimitReason(coach, rangesByCoach.getOrDefault(coach.getUserId(), List.of()),
                    firstDate, lastDate, null);
            if (reason != null) {
                courseLimitReasonByCoach.put(coach.getUserId(), reason);
            }
        }

        List<SlotAvailabilityDto> slotDtos = new ArrayList<>(ScheduleSlot.values().length);
        List<RoomAvailabilityDto> selectedRooms = List.of();
        List<CoachAvailabilityDto> selectedCoaches = List.of();
        boolean selectedSlotAvailable = false;
        String selectedSlotConflictCode = null;
        String selectedSlotConflictReason = null;

        LocalDate today = SessionEligibility.today(clock);
        boolean startDateInPast = request.startDate().isBefore(today);

        for (ScheduleSlot slot : ScheduleSlot.values()) {
            boolean past = startDateInPast || !SessionEligibility.isFuture(firstDate, slot.startTime(), clock);
            String disciplineConflictReason = findDisciplineConflictReason(
                    discipline, sessionDates, sessionsByDate, slot);
            boolean disciplineConflict = disciplineConflictReason != null;
            LocalDate slotLimitDate = sessionDates.stream()
                    .filter(date -> exceedsSlotDisciplineLimit(discipline.getId(), slot.startTime(), slot.endTime(),
                            sessionsByDate.getOrDefault(date, List.of()), null, null))
                    .findFirst().orElse(null);

            List<RoomAvailabilityDto> slotRooms = evaluateRoomsForSlot(
                    availableRooms, sessionDates, sessionsByDate, slot);
            int availableRoomCount = (int) slotRooms.stream().filter(RoomAvailabilityDto::available).count();

            List<CoachAvailabilityDto> slotCoaches = evaluateCoachesForSlot(
                    activeCoaches, sessionDates, sessionsByDate, approvedLeaveDatesByCoach,
                    ptBookingsByCoachAndDate, courseLimitReasonByCoach, slot);
            int availableCoachCount = (int) slotCoaches.stream().filter(CoachAvailabilityDto::available).count();

            boolean slotAvailable;
            String slotConflictCode;
            String slotConflictReason;
            if (past) {
                slotAvailable = false;
                slotConflictCode = "SCHEDULING_PAST_SESSION";
                slotConflictReason = msg("error.scheduling.past_session");
            } else if (disciplineConflict) {
                slotAvailable = false;
                slotConflictCode = "SCHEDULING_DISCIPLINE_CONFLICT";
                slotConflictReason = disciplineConflictReason;
            } else if (slotLimitDate != null) {
                slotAvailable = false;
                slotConflictCode = "SCHEDULING_SLOT_DISCIPLINE_LIMIT";
                slotConflictReason = msg("error.scheduling.slot_discipline_limit", slotLimitDate.format(CONFLICT_DATE_FORMAT),
                        formatTime(slot.startTime()), formatTime(slot.endTime()));
            } else if (availableRoomCount == 0) {
                slotAvailable = false;
                slotConflictCode = "SCHEDULING_NO_AVAILABLE_ROOM";
                slotConflictReason = msg("error.scheduling.no_available_room");
            } else if (availableCoachCount == 0) {
                slotAvailable = false;
                slotConflictCode = "SCHEDULING_NO_AVAILABLE_COACH";
                slotConflictReason = msg("error.scheduling.no_available_coach");
            } else {
                slotAvailable = true;
                slotConflictCode = null;
                slotConflictReason = null;
            }

            slotDtos.add(new SlotAvailabilityDto(
                    slot.slotNumber(),
                    slot.name(),
                    slot.startTime(),
                    slot.endTime(),
                    slotAvailable,
                    disciplineConflict,
                    slotConflictCode,
                    slotConflictReason,
                    availableRoomCount,
                    availableCoachCount));

            if (slot == selectedSlot) {
                selectedRooms = slotRooms;
                selectedCoaches = slotCoaches;
                selectedSlotAvailable = slotAvailable;
                selectedSlotConflictCode = slotConflictCode;
                selectedSlotConflictReason = slotConflictReason;
            }
        }

        return new RecurringAvailabilityDto(
                true,
                null,
                null,
                sessionDates.size(),
                firstDate,
                lastDate,
                selectedSlotAvailable,
                selectedSlotConflictCode,
                selectedSlotConflictReason,
                slotDtos,
                selectedRooms,
                selectedCoaches);
    }

    /** Tạo kết quả kiểm tra trước khi cấu hình lịch không hợp lệ. */
    private RecurringAvailabilityDto invalidSchedule(String errorCode, String messageKey) {
        return new RecurringAvailabilityDto(
                false,
                errorCode,
                msg(messageKey),
                0,
                null,
                null,
                false,
                null,
                null,
                List.of(),
                List.of(),
                List.of());
    }

    /** Phân tích danh sách tên thứ trong tuần (MONDAY..SUNDAY); trả tập rỗng nếu trống hoặc có giá trị sai. */
    private static java.util.Set<java.time.DayOfWeek> parseRecurringDays(List<String> rawDays) {
        if (rawDays == null || rawDays.isEmpty()) {
            return java.util.Set.of();
        }
        java.util.Set<java.time.DayOfWeek> result = java.util.EnumSet.noneOf(java.time.DayOfWeek.class);
        for (String raw : rawDays) {
            if (raw == null || raw.isBlank()) {
                return java.util.Set.of();
            }
            try {
                result.add(java.time.DayOfWeek.valueOf(raw.trim().toUpperCase(java.util.Locale.ROOT)));
            } catch (IllegalArgumentException ex) {
                return java.util.Set.of();
            }
        }
        return result;
    }

    /** Tải các ngày nghỉ phép đã duyệt của từng HLV trong danh sách ngày buổi học. */
    private java.util.Map<Long, java.util.Set<LocalDate>> loadApprovedLeaveDatesByCoach(
            List<Coach> activeCoaches,
            List<LocalDate> sessionDates,
            LocalDate firstDate,
            LocalDate lastDate) {
        java.util.Map<Long, java.util.Set<LocalDate>> result = new java.util.HashMap<>();
        if (staffInternalRequestRepository == null || activeCoaches.isEmpty()) {
            return result;
        }
        for (Coach coach : activeCoaches) {
            Long coachId = coach.getUserId();
            if (coachId == null) {
                continue;
            }
            List<StaffInternalRequest> leaves = staffInternalRequestRepository.findOverlappingLeaves(
                    coachId, firstDate, lastDate);
            if (leaves == null || leaves.isEmpty()) {
                continue;
            }
            java.util.Set<LocalDate> approvedDates = new java.util.HashSet<>();
            for (StaffInternalRequest leave : leaves) {
                if (leave == null || !"APPROVED".equalsIgnoreCase(leave.getStatus())
                        || leave.getStartDate() == null) {
                    continue;
                }
                if (leave.getRequestType() != null && !"LEAVE".equalsIgnoreCase(leave.getRequestType())) {
                    continue;
                }
                LocalDate leaveStart = leave.getStartDate();
                LocalDate leaveEnd = leave.getEndDate() != null ? leave.getEndDate() : leaveStart;
                for (LocalDate sessionDate : sessionDates) {
                    if (!sessionDate.isBefore(leaveStart) && !sessionDate.isAfter(leaveEnd)) {
                        approvedDates.add(sessionDate);
                    }
                }
            }
            if (!approvedDates.isEmpty()) {
                result.put(coachId, approvedDates);
            }
        }
        return result;
    }

    /** Tải toàn bộ buổi PT 1:1 đã xác nhận trong khoảng ngày và gom theo HLV + ngày. */
    private java.util.Map<Long, java.util.Map<LocalDate, List<CoachBooking>>> loadConfirmedPtBookingsByCoachAndDate(
            LocalDate firstDate,
            LocalDate lastDate) {
        java.util.Map<Long, java.util.Map<LocalDate, List<CoachBooking>>> result = new java.util.HashMap<>();
        if (coachBookingRepository == null) {
            return result;
        }
        List<CoachBooking> confirmedPts = coachBookingRepository.findConfirmedBetween(firstDate, lastDate);
        if (confirmedPts == null) {
            return result;
        }
        for (CoachBooking booking : confirmedPts) {
            if (booking == null || !"confirmed".equalsIgnoreCase(booking.getStatus())
                    || booking.getCoach() == null || booking.getCoach().getUserId() == null
                    || booking.getBookingDate() == null
                    || booking.getStartTime() == null || booking.getEndTime() == null) {
                continue;
            }
            result.computeIfAbsent(booking.getCoach().getUserId(), k -> new java.util.HashMap<>())
                    .computeIfAbsent(booking.getBookingDate(), k -> new ArrayList<>())
                    .add(booking);
        }
        return result;
    }

    /** Tìm lý do xung đột cùng bộ môn đầu tiên trong slot cho các ngày học; null nếu không xung đột. */
    private String findDisciplineConflictReason(Discipline discipline,
                                                List<LocalDate> sessionDates,
                                                java.util.Map<LocalDate, List<ClassSession>> sessionsByDate,
                                                ScheduleSlot slot) {
        Long disciplineId = discipline.getId();
        if (disciplineId == null) {
            return null;
        }
        // Gom mọi buổi trùng theo thứ trong tuần để báo đủ các thứ bị trùng, không chỉ ngày đầu tiên.
        java.util.Map<java.time.DayOfWeek, DisciplineConflictGroup> byWeekday = new java.util.TreeMap<>();
        ClassSession firstExisting = null;
        LocalDate firstDate = null;
        int total = 0;
        for (LocalDate sessionDate : sessionDates) {
            for (ClassSession existing : sessionsByDate.getOrDefault(sessionDate, List.of())) {
                if (existing.getStartTime() == null || existing.getEndTime() == null) {
                    continue;
                }
                if (!slot.startTime().isBefore(existing.getEndTime())
                        || !slot.endTime().isAfter(existing.getStartTime())) {
                    continue;
                }
                GymClass existingClass = existing.getGymClass();
                if (existingClass == null
                        || (existingClass.getStatus() != null && !CLASS_ACTIVE.equalsIgnoreCase(existingClass.getStatus()))
                        || existingClass.getDiscipline() == null
                        || !Objects.equals(disciplineId, existingClass.getDiscipline().getId())) {
                    continue;
                }
                if (firstExisting == null) {
                    firstExisting = existing;
                    firstDate = sessionDate;
                }
                total++;
                DisciplineConflictGroup group = byWeekday.computeIfAbsent(
                        sessionDate.getDayOfWeek(), k -> new DisciplineConflictGroup(sessionDate));
                group.count++;
                group.classNames.add(existingClass.getName() != null ? existingClass.getName() : "");
                break;
            }
        }
        if (firstExisting == null) {
            return null;
        }
        GymClass firstClass = firstExisting.getGymClass();
        String disciplineName = firstClass.getDiscipline().getName() != null
                ? firstClass.getDiscipline().getName()
                : (discipline.getName() != null ? discipline.getName() : ("#" + disciplineId));
        if (total == 1) {
            return msg(
                    "error.scheduling.discipline_conflict",
                    disciplineName,
                    firstClass.getName() != null ? firstClass.getName() : "",
                    formatTime(firstExisting.getStartTime()),
                    formatTime(firstExisting.getEndTime()),
                    firstDate.getDayOfWeek().getValue(),
                    firstDate.format(CONFLICT_DATE_FORMAT));
        }
        List<String> items = new ArrayList<>(byWeekday.size());
        byWeekday.forEach((day, group) -> items.add(msg(
                "error.scheduling.discipline_conflict_item",
                // {2},{3} bỏ trống: tham số choice (thứ, số buổi) phải ở chỉ số >= 4 theo MessageBundlesConsistencyTest.
                String.join(", ", group.classNames),
                group.firstDate.format(CONFLICT_DATE_FORMAT),
                null,
                null,
                day.getValue(),
                group.count)));
        return msg(
                "error.scheduling.discipline_conflict_summary",
                disciplineName,
                formatTime(slot.startTime()),
                formatTime(slot.endTime()),
                String.join("; ", items),
                total);
    }

    /** Các buổi trùng lịch cùng bộ môn rơi vào một thứ trong tuần. */
    private static final class DisciplineConflictGroup {
        private final LocalDate firstDate;
        private final java.util.Set<String> classNames = new java.util.LinkedHashSet<>();
        private int count;

        private DisciplineConflictGroup(LocalDate firstDate) {
            this.firstDate = firstDate;
        }
    }

    /** Đánh giá tình trạng trống/trùng lịch của từng phòng khả dụng trong một slot trên toàn bộ các ngày học. */
    private List<RoomAvailabilityDto> evaluateRoomsForSlot(List<Room> availableRooms,
                                                           List<LocalDate> sessionDates,
                                                           java.util.Map<LocalDate, List<ClassSession>> sessionsByDate,
                                                           ScheduleSlot slot) {
        List<RoomAvailabilityDto> result = new ArrayList<>(availableRooms.size());
        for (Room room : availableRooms) {
            String conflictCode = null;
            String conflictReason = null;
            outer:
            for (LocalDate sessionDate : sessionDates) {
                for (ClassSession existing : sessionsByDate.getOrDefault(sessionDate, List.of())) {
                    if (existing.getStartTime() == null || existing.getEndTime() == null) {
                        continue;
                    }
                    if (!slot.startTime().isBefore(existing.getEndTime())
                            || !slot.endTime().isAfter(existing.getStartTime())) {
                        continue;
                    }
                    GymClass existingClass = existing.getGymClass();
                    if (existingClass != null && existingClass.getRoom() != null
                            && Objects.equals(room.getId(), existingClass.getRoom().getId())) {
                        String roomName = room.getName() != null ? room.getName() : ("#" + room.getId());
                        String className = existingClass.getName() != null ? existingClass.getName() : "";
                        conflictCode = "SCHEDULING_ROOM_CONFLICT";
                        conflictReason = msg(
                                "error.scheduling.room_conflict",
                                roomName,
                                className,
                                formatTime(existing.getStartTime()),
                                formatTime(existing.getEndTime()),
                                sessionDate.getDayOfWeek().getValue(),
                                sessionDate.format(CONFLICT_DATE_FORMAT));
                        break outer;
                    }
                }
            }
            result.add(new RoomAvailabilityDto(
                    room.getId(),
                    room.getName(),
                    room.getLocation(),
                    room.getCapacity(),
                    room.getTier(),
                    conflictCode == null,
                    conflictCode,
                    conflictReason));
        }
        return result;
    }

    /** Đánh giá tình trạng trống/trùng lịch (nghỉ phép, PT 1:1, lớp nhóm) của từng HLV trong một slot. */
    private List<CoachAvailabilityDto> evaluateCoachesForSlot(
            List<Coach> activeCoaches,
            List<LocalDate> sessionDates,
            java.util.Map<LocalDate, List<ClassSession>> sessionsByDate,
            java.util.Map<Long, java.util.Set<LocalDate>> approvedLeaveDatesByCoach,
            java.util.Map<Long, java.util.Map<LocalDate, List<CoachBooking>>> ptBookingsByCoachAndDate,
            java.util.Map<Long, String> courseLimitReasonByCoach,
            ScheduleSlot slot) {
        List<CoachAvailabilityDto> result = new ArrayList<>(activeCoaches.size());
        for (Coach coach : activeCoaches) {
            Long coachId = coach.getUserId();
            User user = coach.getUser();
            String coachName = user != null && user.getFullName() != null
                    ? user.getFullName()
                    : ("#" + coachId);
            String coachEmail = user != null ? user.getEmail() : null;

            java.util.Set<LocalDate> leaveDates = approvedLeaveDatesByCoach.getOrDefault(coachId, java.util.Set.of());
            java.util.Map<LocalDate, List<CoachBooking>> ptByDate =
                    ptBookingsByCoachAndDate.getOrDefault(coachId, java.util.Map.of());

            String conflictReason = courseLimitReasonByCoach.get(coachId);
            String conflictCode = conflictReason != null ? "SCHEDULING_COACH_MAX_COURSES" : null;
            outer:
            for (LocalDate sessionDate : conflictReason != null ? List.<LocalDate>of() : sessionDates) {
                if (leaveDates.contains(sessionDate)) {
                    conflictCode = "COACH_ON_LEAVE";
                    conflictReason = msg(
                            "error.scheduling.coach_on_leave_date",
                            coachName,
                            sessionDate.format(CONFLICT_DATE_FORMAT));
                    break;
                }
                for (CoachBooking booking : ptByDate.getOrDefault(sessionDate, List.of())) {
                    if (slot.startTime().isBefore(booking.getEndTime())
                            && slot.endTime().isAfter(booking.getStartTime())) {
                        conflictCode = "SCHEDULING_COACH_PT_CONFLICT";
                        conflictReason = msg(
                                "error.scheduling.coach_pt_conflict",
                                coachName,
                                formatTime(booking.getStartTime()),
                                formatTime(booking.getEndTime()),
                                sessionDate.format(CONFLICT_DATE_FORMAT),
                                sessionDate.getDayOfWeek().getValue());
                        break outer;
                    }
                }
                for (ClassSession existing : sessionsByDate.getOrDefault(sessionDate, List.of())) {
                    if (existing.getStartTime() == null || existing.getEndTime() == null) {
                        continue;
                    }
                    if (!slot.startTime().isBefore(existing.getEndTime())
                            || !slot.endTime().isAfter(existing.getStartTime())) {
                        continue;
                    }
                    GymClass existingClass = existing.getGymClass();
                    if (existingClass != null && existingClass.getCoach() != null
                            && Objects.equals(coachId, existingClass.getCoach().getUserId())) {
                        String className = existingClass.getName() != null ? existingClass.getName() : "";
                        conflictCode = "SCHEDULING_COACH_CONFLICT";
                        conflictReason = msg(
                                "error.scheduling.coach_conflict",
                                coachName,
                                className,
                                formatTime(existing.getStartTime()),
                                formatTime(existing.getEndTime()),
                                sessionDate.getDayOfWeek().getValue(),
                                sessionDate.format(CONFLICT_DATE_FORMAT));
                        break outer;
                    }
                }
            }
            result.add(new CoachAvailabilityDto(
                    coachId,
                    coachName,
                    coachEmail,
                    conflictCode == null,
                    conflictCode,
                    conflictReason));
        }
        return result;
    }

    /** Thông báo tới các học viên đã ghi danh và HLV phụ trách khi buổi học được dời lịch. */
    private void notifySessionRescheduled(GymClass gymClass,
                                          ClassSession session,
                                          LocalDate oldDate,
                                          LocalTime oldStart,
                                          LocalTime oldEnd) {
        if (notificationService == null || gymClass == null || session == null) {
            return;
        }
        String className = gymClass.getName() != null ? gymClass.getName() : "";
        String oldDateStr = oldDate != null ? oldDate.format(CONFLICT_DATE_FORMAT) : "";
        String oldRange = formatTime(oldStart) + " – " + formatTime(oldEnd);
        String newDateStr = session.getSessionDate() != null ? session.getSessionDate().format(CONFLICT_DATE_FORMAT) : "";
        String newRange = formatTime(session.getStartTime()) + " – " + formatTime(session.getEndTime());
        String title = msg("notifications.session.rescheduled.title");

        java.util.Set<Long> memberRecipients = new java.util.LinkedHashSet<>();
        List<ClassEnrollment> classEnrollments = enrollments.findByGymClassId(gymClass.getId());
        if (classEnrollments != null) {
            for (ClassEnrollment enrollment : classEnrollments) {
                if (enrollment != null && ENROLLMENT_BOOKED.equalsIgnoreCase(enrollment.getStatus())
                        && enrollment.getMember() != null && enrollment.getMember().getUserId() != null) {
                    memberRecipients.add(enrollment.getMember().getUserId());
                }
            }
        }
        if (sessionBookings != null && session.getId() != null) {
            List<SessionBooking> perSession = sessionBookings.findBySessionIdAndStatus(session.getId(), ENROLLMENT_BOOKED);
            if (perSession != null) {
                for (SessionBooking booking : perSession) {
                    if (booking != null && booking.getMember() != null && booking.getMember().getUserId() != null) {
                        memberRecipients.add(booking.getMember().getUserId());
                    }
                }
            }
        }
        String memberBody = msg("notifications.session.rescheduled.body", className, oldDateStr, oldRange, newDateStr, newRange);
        for (Long memberId : memberRecipients) {
            notificationService.send(memberId, title, memberBody, "schedule_change", "class_session", session.getId());
        }
        if (gymClass.getCoach() != null && gymClass.getCoach().getUserId() != null) {
            String coachBody = msg("notifications.session.rescheduled.coach_body", className, oldDateStr, oldRange, newDateStr, newRange);
            notificationService.send(gymClass.getCoach().getUserId(), title, coachBody, "schedule_change", "class_session", session.getId());
        }
    }

    /** Khoảng ngày còn lịch của mọi khóa đang hoạt động, gom theo HLV. */
    private java.util.Map<Long, List<CoachCourseRange>> loadCourseRangesByCoach() {
        List<CoachCourseRange> ranges = sessions.findActiveCourseRanges();
        java.util.Map<Long, List<CoachCourseRange>> byCoach = new java.util.HashMap<>();
        if (ranges != null) {
            for (CoachCourseRange r : ranges) {
                if (r != null && r.coachId() != null && r.firstDate() != null && r.lastDate() != null) {
                    byCoach.computeIfAbsent(r.coachId(), k -> new ArrayList<>()).add(r);
                }
            }
        }
        return byCoach;
    }

    /**
     * Tham số thông báo nếu giao thêm khóa [firstDate, lastDate] khiến HLV dạy quá MAX_CONCURRENT_COURSES_PER_COACH
     * khóa cùng lúc tại một ngày nào đó; null nếu hợp lệ. Số khóa chồng nhau lớn nhất luôn đạt tại ngày bắt đầu
     * của khóa mới hoặc ngày bắt đầu của một khóa hiện có nằm trong khoảng đó.
     * Thứ tự: {0} tên HLV, {1} danh sách khóa đang chạy, {2} ngày kết thúc sớm nhất, {3} ngày bị vượt giới hạn.
     */
    public static Object[] coachCourseLimitArgs(Coach coach, List<CoachCourseRange> ranges, LocalDate firstDate,
                                         LocalDate lastDate, Long excludeClassId) {
        List<CoachCourseRange> overlapping = ranges.stream()
                .filter(r -> !Objects.equals(r.classId(), excludeClassId))
                .filter(r -> !r.lastDate().isBefore(firstDate) && !r.firstDate().isAfter(lastDate))
                .toList();
        if (overlapping.size() < MAX_CONCURRENT_COURSES_PER_COACH) {
            return null;
        }
        List<LocalDate> candidates = new ArrayList<>();
        candidates.add(firstDate);
        for (CoachCourseRange r : overlapping) {
            if (r.firstDate().isAfter(firstDate)) {
                candidates.add(r.firstDate());
            }
        }
        candidates.sort(null);
        for (LocalDate day : candidates) {
            List<CoachCourseRange> running = overlapping.stream()
                    .filter(r -> !r.firstDate().isAfter(day) && !r.lastDate().isBefore(day))
                    .sorted(java.util.Comparator.comparing(CoachCourseRange::lastDate))
                    .toList();
            if (running.size() >= MAX_CONCURRENT_COURSES_PER_COACH) {
                User user = coach.getUser();
                String coachName = user != null && user.getFullName() != null
                        ? user.getFullName() : ("#" + coach.getUserId());
                String names = running.stream()
                        .map(r -> "\"" + (r.className() != null ? r.className() : "#" + r.classId()) + "\" ("
                                + r.firstDate().format(CONFLICT_DATE_FORMAT) + " – "
                                + r.lastDate().format(CONFLICT_DATE_FORMAT) + ")")
                        .collect(java.util.stream.Collectors.joining(", "));
                return new Object[]{
                        coachName,
                        names,
                        running.get(0).lastDate().format(CONFLICT_DATE_FORMAT),
                        day.format(CONFLICT_DATE_FORMAT)};
            }
        }
        return null;
    }

    private String coachCourseLimitReason(Coach coach, List<CoachCourseRange> ranges, LocalDate firstDate,
                                          LocalDate lastDate, Long excludeClassId) {
        Object[] args = coachCourseLimitArgs(coach, ranges, firstDate, lastDate, excludeClassId);
        return args == null ? null : msg("error.scheduling.coach_max_courses", args);
    }

    /** Chặn (409 SCHEDULING_COACH_MAX_COURSES) khi giao khóa [firstDate, lastDate] khiến HLV dạy quá 3 khóa cùng lúc. */
    private void ensureCoachCourseLimit(Coach coach, LocalDate firstDate, LocalDate lastDate, Long excludeClassId) {
        Object[] args = coachCourseLimitArgs(coach,
                loadCourseRangesByCoach().getOrDefault(coach.getUserId(), List.of()),
                firstDate, lastDate, excludeClassId);
        if (args != null) {
            throw new ConflictException(
                    "SCHEDULING_COACH_MAX_COURSES",
                    "error.scheduling.coach_max_courses",
                    args,
                    "Coach already teaches " + MAX_CONCURRENT_COURSES_PER_COACH + " concurrent courses");
        }
    }

    /**
     * Kiểm tra xung đột cho toàn bộ các ngày của khóa định kỳ bằng 1 lượt truy vấn theo khoảng
     * {@code [firstDate, lastDate]} thay vì quét lại bảng cho từng ngày buổi học.
     */
    private void ensureNoRecurringSessionConflicts(Long disciplineId,
                                                   Long coachId,
                                                   Long roomId,
                                                   List<LocalDate> sessionDates,
                                                   LocalDate firstDate,
                                                   LocalDate lastDate,
                                                   LocalTime startTime,
                                                   LocalTime endTime) {
        if (sessionDates == null || sessionDates.isEmpty() || startTime == null || endTime == null) {
            return;
        }
        java.util.Set<LocalDate> coachLeaveDates = new java.util.HashSet<>();
        if (staffInternalRequestRepository != null && coachId != null) {
            List<StaffInternalRequest> leaves = staffInternalRequestRepository.findOverlappingLeaves(coachId, firstDate, lastDate);
            if (leaves != null) {
                for (StaffInternalRequest leave : leaves) {
                    if (leave == null || !"APPROVED".equalsIgnoreCase(leave.getStatus())
                            || leave.getStartDate() == null) {
                        continue;
                    }
                    if (leave.getRequestType() != null && !"LEAVE".equalsIgnoreCase(leave.getRequestType())) {
                        continue;
                    }
                    LocalDate leaveStart = leave.getStartDate();
                    LocalDate leaveEnd = leave.getEndDate() != null ? leave.getEndDate() : leaveStart;
                    for (LocalDate d : sessionDates) {
                        if (!d.isBefore(leaveStart) && !d.isAfter(leaveEnd)) {
                            coachLeaveDates.add(d);
                        }
                    }
                }
            }
        }

        java.util.Map<LocalDate, List<CoachBooking>> ptByDate = new java.util.HashMap<>();
        if (coachBookingRepository != null && coachId != null) {
            List<CoachBooking> confirmedPts = coachBookingRepository.findConfirmedBetween(firstDate, lastDate);
            if (confirmedPts != null) {
                for (CoachBooking b : confirmedPts) {
                    if (b == null || !"confirmed".equalsIgnoreCase(b.getStatus())
                            || b.getCoach() == null || !Objects.equals(coachId, b.getCoach().getUserId())
                            || b.getBookingDate() == null || b.getStartTime() == null || b.getEndTime() == null) {
                        continue;
                    }
                    ptByDate.computeIfAbsent(b.getBookingDate(), k -> new ArrayList<>()).add(b);
                }
            }
        }

        java.util.Map<LocalDate, List<ClassSession>> existingByDate = new java.util.HashMap<>();
        List<ClassSession> existingInRange = sessions.searchSessions(firstDate, lastDate, null, null);
        if (existingInRange != null) {
            for (ClassSession s : existingInRange) {
                if (s != null && s.getSessionDate() != null) {
                    existingByDate.computeIfAbsent(s.getSessionDate(), k -> new ArrayList<>()).add(s);
                }
            }
        }

        for (LocalDate sessionDate : sessionDates) {
            if (coachLeaveDates.contains(sessionDate)) {
                throw new ConflictException(
                        "COACH_ON_LEAVE",
                        "error.coach_booking.coach_on_leave",
                        new Object[]{sessionDate},
                        "The coach is on approved leave that day.");
            }
            checkPtBookingsConflict(coachId, sessionDate, startTime, endTime,
                    ptByDate.getOrDefault(sessionDate, List.of()));
            checkSessionsConflictOnDate(disciplineId, coachId, roomId, sessionDate, startTime, endTime,
                    null, null, existingByDate.getOrDefault(sessionDate, List.of()));
        }
    }

    /** Kiểm tra xung đột lịch PT 1:1 của HLV trên danh sách booking đã nạp của một ngày. */
    private void checkPtBookingsConflict(Long coachId,
                                         LocalDate sessionDate,
                                         LocalTime startTime,
                                         LocalTime endTime,
                                         List<CoachBooking> activePtBookings) {
        if (coachId == null || activePtBookings == null || activePtBookings.isEmpty()) {
            return;
        }
        for (CoachBooking booking : activePtBookings) {
            if (booking == null || !"confirmed".equalsIgnoreCase(booking.getStatus())
                    || booking.getStartTime() == null || booking.getEndTime() == null) {
                continue;
            }
            if (startTime.isBefore(booking.getEndTime()) && endTime.isAfter(booking.getStartTime())) {
                String coachName = booking.getCoach() != null && booking.getCoach().getUser() != null
                        && booking.getCoach().getUser().getFullName() != null
                        ? booking.getCoach().getUser().getFullName()
                        : ("#" + coachId);
                int dayOfWeek = sessionDate.getDayOfWeek().getValue();
                String conflictDate = sessionDate.format(CONFLICT_DATE_FORMAT);
                String rangeStart = formatTime(booking.getStartTime());
                String rangeEnd = formatTime(booking.getEndTime());
                throw new ConflictException(
                        "SCHEDULING_COACH_PT_CONFLICT",
                        "error.scheduling.coach_pt_conflict",
                        new Object[]{coachName, rangeStart, rangeEnd, conflictDate, dayOfWeek},
                        "Schedule conflict: Coach " + coachName + " already has a 1:1 PT session ("
                                + rangeStart + " - " + rangeEnd + " on " + sessionDate.getDayOfWeek()
                                + " " + conflictDate + ")");
            }
        }
    }

    /**
     * Kiểm tra trước xung đột: HLV không nghỉ phép đã duyệt, không trùng lịch PT 1:1 và không có buổi scheduled
     * khác cùng ngày trùng giờ ở cùng phòng, cùng HLV hoặc cùng bộ môn (lớp đang hoạt động).
     */
    private void ensureNoSessionConflict(Long disciplineId,
                                         Long coachId,
                                         Long roomId,
                                         LocalDate sessionDate,
                                         LocalTime startTime,
                                         LocalTime endTime,
                                         Long excludeSessionId,
                                         Long idempotentClassId) {
        if (sessionDate == null || startTime == null || endTime == null) {
            return;
        }
        if (staffInternalRequestRepository != null && coachId != null
                && staffInternalRequestRepository.existsApprovedLeaveOn(coachId, sessionDate)) {
            throw new ConflictException(
                    "COACH_ON_LEAVE",
                    "error.coach_booking.coach_on_leave",
                    new Object[]{sessionDate},
                    "The coach is on approved leave that day.");
        }
        if (coachBookingRepository != null && coachId != null) {
            checkPtBookingsConflict(coachId, sessionDate, startTime, endTime,
                    coachBookingRepository.findActiveByCoachAndDate(coachId, sessionDate));
        }
        List<ClassSession> existingOnDate = sessions.searchSessions(sessionDate, sessionDate, null, null);
        checkSessionsConflictOnDate(disciplineId, coachId, roomId, sessionDate, startTime, endTime,
                excludeSessionId, idempotentClassId, existingOnDate);
    }

    /** Đối chiếu trùng phòng, HLV và bộ môn trên danh sách buổi học đã nạp của một ngày. */
    private void checkSessionsConflictOnDate(Long disciplineId,
                                             Long coachId,
                                             Long roomId,
                                             LocalDate sessionDate,
                                             LocalTime startTime,
                                             LocalTime endTime,
                                             Long excludeSessionId,
                                             Long idempotentClassId,
                                             List<ClassSession> existingOnDate) {
        if (existingOnDate == null || existingOnDate.isEmpty()) {
            return;
        }
        ClassSession firstDisciplineConflict = null;
        for (ClassSession existing : existingOnDate) {
            if (existing == null || !SESSION_SCHEDULED.equalsIgnoreCase(existing.getStatus())) {
                continue;
            }
            if (excludeSessionId != null && Objects.equals(excludeSessionId, existing.getId())) {
                continue;
            }
            GymClass existingClass = existing.getGymClass();
            if (idempotentClassId != null
                    && existingClass != null
                    && Objects.equals(idempotentClassId, existingClass.getId())
                    && Objects.equals(sessionDate, existing.getSessionDate())
                    && Objects.equals(startTime, existing.getStartTime())
                    && Objects.equals(endTime, existing.getEndTime())) {
                continue;
            }
            if (existing.getStartTime() == null || existing.getEndTime() == null) {
                continue;
            }
            boolean overlaps = startTime.isBefore(existing.getEndTime()) && endTime.isAfter(existing.getStartTime());
            if (!overlaps) {
                continue;
            }

            String className = existingClass != null && existingClass.getName() != null ? existingClass.getName() : "";
            String rangeStart = formatTime(existing.getStartTime());
            String rangeEnd = formatTime(existing.getEndTime());
            // {4}: thứ trong tuần (1 = Thứ 2 … 7 = Chủ nhật), dịch bằng choice format trong i18n; {5}: ngày dd/MM/yyyy
            int dayOfWeek = sessionDate.getDayOfWeek().getValue();
            String conflictDate = sessionDate.format(CONFLICT_DATE_FORMAT);

            if (roomId != null && existingClass != null && existingClass.getRoom() != null
                    && Objects.equals(roomId, existingClass.getRoom().getId())) {
                String roomName = existingClass.getRoom().getName() != null
                        ? existingClass.getRoom().getName()
                        : ("#" + roomId);
                throw new ConflictException(
                        "SCHEDULING_ROOM_CONFLICT",
                        "error.scheduling.room_conflict",
                        new Object[]{roomName, className, rangeStart, rangeEnd, dayOfWeek, conflictDate},
                        "Schedule conflict: Room " + roomName + " is already booked for class " + className
                                + " (" + rangeStart + " - " + rangeEnd + " on " + sessionDate.getDayOfWeek()
                                + " " + conflictDate + ")");
            }

            if (coachId != null && existingClass != null && existingClass.getCoach() != null
                    && Objects.equals(coachId, existingClass.getCoach().getUserId())) {
                Coach existingCoach = existingClass.getCoach();
                String coachName = existingCoach.getUser() != null && existingCoach.getUser().getFullName() != null
                        ? existingCoach.getUser().getFullName()
                        : ("#" + coachId);
                throw new ConflictException(
                        "SCHEDULING_COACH_CONFLICT",
                        "error.scheduling.coach_conflict",
                        new Object[]{coachName, className, rangeStart, rangeEnd, dayOfWeek, conflictDate},
                        "Schedule conflict: Coach " + coachName + " is already teaching class " + className
                                + " (" + rangeStart + " - " + rangeEnd + " on " + sessionDate.getDayOfWeek()
                                + " " + conflictDate + ")");
            }

            if (firstDisciplineConflict == null
                    && disciplineId != null
                    && existingClass != null
                    && (existingClass.getStatus() == null || CLASS_ACTIVE.equalsIgnoreCase(existingClass.getStatus()))
                    && existingClass.getDiscipline() != null
                    && Objects.equals(disciplineId, existingClass.getDiscipline().getId())) {
                firstDisciplineConflict = existing;
            }
        }

        if (firstDisciplineConflict != null) {
            GymClass existingClass = firstDisciplineConflict.getGymClass();
            String disciplineName = existingClass.getDiscipline().getName() != null
                    ? existingClass.getDiscipline().getName()
                    : ("#" + disciplineId);
            String className = existingClass.getName() != null ? existingClass.getName() : "";
            String rangeStart = formatTime(firstDisciplineConflict.getStartTime());
            String rangeEnd = formatTime(firstDisciplineConflict.getEndTime());
            int dayOfWeek = sessionDate.getDayOfWeek().getValue();
            String conflictDate = sessionDate.format(CONFLICT_DATE_FORMAT);
            throw new ConflictException(
                    "SCHEDULING_DISCIPLINE_CONFLICT",
                    "error.scheduling.discipline_conflict",
                    new Object[]{disciplineName, className, rangeStart, rangeEnd, dayOfWeek, conflictDate},
                    "Schedule conflict: Discipline " + disciplineName + " already has class " + className
                            + " (" + rangeStart + " - " + rangeEnd + " on " + sessionDate.getDayOfWeek()
                            + " " + conflictDate + ")");
        }
        if (exceedsSlotDisciplineLimit(disciplineId, startTime, endTime, existingOnDate, excludeSessionId, idempotentClassId)) {
            String date = sessionDate.format(CONFLICT_DATE_FORMAT);
            throw new ConflictException("SCHEDULING_SLOT_DISCIPLINE_LIMIT", "error.scheduling.slot_discipline_limit",
                    new Object[]{date, formatTime(startTime), formatTime(endTime)},
                    "This slot already contains two disciplines on " + date + ".");
        }
    }

    /** Một ngày và slot chỉ có tối đa hai bộ môn đang hoạt động. */
    private boolean exceedsSlotDisciplineLimit(Long disciplineId, LocalTime start, LocalTime end,
                                                List<ClassSession> existing, Long excludeSessionId, Long excludeClassId) {
        if (disciplineId == null || existing == null) return false;
        java.util.Set<Long> ids = new java.util.HashSet<>();
        ids.add(disciplineId);
        for (ClassSession session : existing) {
            if (session == null || !SESSION_SCHEDULED.equalsIgnoreCase(session.getStatus())
                    || session.getStartTime() == null || session.getEndTime() == null
                    || !start.isBefore(session.getEndTime()) || !end.isAfter(session.getStartTime())
                    || (excludeSessionId != null && Objects.equals(excludeSessionId, session.getId()))) continue;
            GymClass c = session.getGymClass();
            if (c == null || (excludeClassId != null && Objects.equals(excludeClassId, c.getId()))
                    || (c.getStatus() != null && !CLASS_ACTIVE.equalsIgnoreCase(c.getStatus())) || c.getDiscipline() == null) continue;
            if (c.getDiscipline().getId() != null) ids.add(c.getDiscipline().getId());
        }
        return ids.size() > 2;
    }

    /**
     * Một hội viên chỉ học một lớp tại một thời điểm: buổi mới hoặc được dời không được chồng lên lớp khác mà
     * một thành viên của nó (ghi danh toàn lớp hoặc đặt chỗ trong buổi này) đang học. Trigger database
     * {@code trg_member_schedule_conflict} kiểm tra lặp lại quy tắc này.
     */
    private void ensureNoMemberOverlap(Long classId, Long sessionId, LocalDate sessionDate,
                                       LocalTime startTime, LocalTime endTime) {
        if (classId == null || sessionDate == null || startTime == null || endTime == null) {
            return;
        }
        List<ClassSession> overlaps = sessions.findMemberOverlaps(classId, sessionId != null ? sessionId : -1L,
                sessionDate, startTime, endTime);
        if (overlaps == null || overlaps.isEmpty()) {
            return;
        }
        ClassSession other = overlaps.get(0);
        String otherName = other.getGymClass() != null && other.getGymClass().getName() != null
                ? other.getGymClass().getName() : "";
        throw new ConflictException(
                "SCHEDULING_MEMBER_TIME_OVERLAP",
                "error.scheduling.session_member_overlap",
                new Object[]{otherName, formatTime(other.getStartTime()), formatTime(other.getEndTime())},
                "A booked member already attends class " + otherName + " at this time");
    }

    /** Định dạng giờ thành chuỗi HH:mm (null thành chuỗi rỗng). */
    private static String formatTime(LocalTime time) {
        if (time == null) return "";
        String raw = time.toString();
        return raw.length() >= 5 ? raw.substring(0, 5) : raw;
    }

    private static final java.time.format.DateTimeFormatter CONFLICT_DATE_FORMAT =
            java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");

    /**
     * Tra cứu lịch buổi học cho mọi role đã đăng nhập, lọc theo ngày, bộ môn, HLV; đếm số chỗ đã đặt theo lô
     * (2 truy vấn gộp thay vì 2N+1).
     *
     * SCRUM-72 BR-06: tra cứu lịch cho mọi vai trò đã xác thực với bộ lọc tùy chọn.
     */
    @Transactional(readOnly = true)
    public List<ClassSessionDto> searchSessions(LocalDate fromDate,
                                                LocalDate toDate,
                                                Long disciplineId,
                                                Long coachId) {
        List<ClassSession> found = sessions.searchSessions(fromDate, toDate, disciplineId, coachId);
        if (found == null || found.isEmpty()) {
            return List.of();
        }
        List<Long> classIds = found.stream()
                .map(ClassSession::getGymClass)
                .filter(Objects::nonNull)
                .map(GymClass::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        java.util.Map<Long, Long> classBookedCounts = new java.util.HashMap<>();
        if (!classIds.isEmpty()) {
            var counts = enrollments.countByClassIdsAndStatus(classIds, ENROLLMENT_BOOKED);
            if (counts != null) {
                for (var count : counts) {
                    if (count != null && count.classId() != null) {
                        classBookedCounts.put(count.classId(), count.bookedCount());
                    }
                }
            }
        }
        java.util.Map<Long, Long> sessionBookedCounts = new java.util.HashMap<>();
        if (sessionBookings != null) {
            List<Long> sessionIds = found.stream()
                    .map(ClassSession::getId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList();
            if (!sessionIds.isEmpty()) {
                var counts = sessionBookings.countBookedBySessionIds(sessionIds);
                if (counts != null) {
                    for (var count : counts) {
                        if (count != null && count.sessionId() != null) {
                            sessionBookedCounts.put(count.sessionId(), count.bookedCount());
                        }
                    }
                }
            }
        }
        return found.stream()
                .map(session -> {
                    Long classId = session.getGymClass() != null ? session.getGymClass().getId() : null;
                    long booked = (classId != null ? classBookedCounts.getOrDefault(classId, 0L) : 0L)
                            + (session.getId() != null ? sessionBookedCounts.getOrDefault(session.getId(), 0L) : 0L);
                    return mapper.toDto(session, booked);
                })
                .toList();
    }

    /** Danh sách lớp mới nhất trước; chỉ lớp cũ thiếu dữ liệu lịch mới phải đọc buổi học để suy ra lịch. */
    @Transactional(readOnly = true)
    public List<GymClassDto> listClasses() {
        return gymClasses.findAllByOrderByIdDesc().stream()
                // Chỉ các lớp cũ không có trường lịch mới cần đọc các buổi của chúng.
                .map(c -> SchedulingMapper.lacksSchedule(c)
                        ? mapper.toDto(c, sessions.findByGymClassIdOrderBySessionDateAscStartTimeAsc(c.getId()))
                        : mapper.toDto(c))
                .toList();
    }

    /** Danh sách HLV đang hoạt động dùng làm lựa chọn khi xếp lớp. */
    @Transactional(readOnly = true)
    public List<CoachOptionDto> listActiveCoaches() {
        return coaches.findActiveWithUser().stream()
                .map(c -> new CoachOptionDto(
                        c.getUserId(),
                        c.getUser().getFullName(),
                        c.getUser().getEmail(),
                        c.getUser().getPhone(),
                        c.getEmploymentStatus(),
                        c.getUser().getGender()))
                .toList();
    }

    /** Học viên của lớp: ghi danh chưa hủy cộng hội viên đặt chỗ từng buổi (không trùng lặp). */
    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getClassStudents(Long classId) {
        if (!gymClasses.existsById(classId)) {
            throw new ResourceNotFoundException("resource.gym_class", classId);
        }
        List<EnrolledStudentDto> students = new java.util.ArrayList<>(enrollments.findByGymClassId(classId).stream()
                .filter(e -> !"cancelled".equalsIgnoreCase(e.getStatus()))
                .map(this::toStudentDto)
                .toList());
        if (sessionBookings != null) {
            java.util.Set<Long> seen = new java.util.HashSet<>();
            students.forEach(s -> seen.add(s.memberId()));
            for (SessionBooking booking : sessionBookings.findBookedByClassId(classId)) {
                if (booking.getMember() != null && seen.add(booking.getMember().getUserId())) {
                    students.add(toStudentDto(booking));
                }
            }
        }
        return students;
    }

    /**
     * Học viên của một lớp theo người gọi: HLV chỉ xem lớp mình phụ trách, quầy lễ tân xem không kèm ghi chú
     * sức khỏe (dữ liệu y tế chỉ dành cho HLV huấn luyện hội viên và quản lý).
     */
    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getClassStudents(Long classId, com.swp391.scms.security.AuthenticatedPrincipal principal) {
        GymClass gymClass = gymClasses.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
        return scopeStudents(getClassStudents(classId), gymClass, principal);
    }

    /** Học viên của buổi học theo người xem (cùng quy tắc phạm vi như getClassStudents). */
    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getSessionStudents(Long sessionId, com.swp391.scms.security.AuthenticatedPrincipal principal) {
        ClassSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
        return scopeStudents(getSessionStudents(sessionId), session.getGymClass(), principal);
    }

    /**
     * Giới hạn dữ liệu học viên theo role: HLV chỉ lớp mình dạy, quản lý thấy đủ, lễ tân chỉ bị ẩn ghi chú sức
     * khỏe.
     */
    private static List<EnrolledStudentDto> scopeStudents(List<EnrolledStudentDto> students, GymClass gymClass,
                                                          com.swp391.scms.security.AuthenticatedPrincipal principal) {
        String role = principal == null || principal.role() == null ? "" : principal.role().toUpperCase(java.util.Locale.ROOT);
        if ("COACH".equals(role)) {
            if (gymClass == null || gymClass.getCoach() == null || !principal.id().equals(gymClass.getCoach().getUserId())) {
                throw new com.swp391.scms.common.exception.ForbiddenException("SCHEDULING_CLASS_NOT_OWNED",
                        "error.forbidden", null, "A coach can see the students of their own classes only.");
            }
            return students;
        }
        if ("CENTER_MANAGER".equals(role) || "MANAGER".equals(role)) {
            return students;
        }
        // Quầy lễ tân: cần thông tin liên hệ, không cần ghi chú y tế.
        return students.stream().map(s -> new EnrolledStudentDto(s.id(), s.memberId(), s.membershipCode(), s.fullName(),
                s.email(), s.phone(), s.avatarUrl(), s.fitnessGoal(), "", s.fitnessLevel(), s.emergencyContactName(),
                s.emergencyContactPhone(), s.enrolledAt(), s.status())).toList();
    }

    /** Học viên của một buổi: ghi danh chưa hủy của lớp cộng các lượt đặt chỗ booked của buổi (không trùng lặp). */
    @Transactional(readOnly = true)
    public List<EnrolledStudentDto> getSessionStudents(Long sessionId) {
        ClassSession session = sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
        List<EnrolledStudentDto> students = new java.util.ArrayList<>(enrollments.findByGymClassId(session.getGymClass().getId()).stream()
                .filter(e -> !"cancelled".equalsIgnoreCase(e.getStatus()))
                .map(this::toStudentDto)
                .toList());
        if (sessionBookings != null) {
            java.util.Set<Long> seen = new java.util.HashSet<>();
            students.forEach(s -> seen.add(s.memberId()));
            for (SessionBooking booking : sessionBookings.findBySessionIdAndStatus(sessionId, "booked")) {
                if (booking.getMember() != null && seen.add(booking.getMember().getUserId())) {
                    students.add(toStudentDto(booking));
                }
            }
        }
        return students;
    }

    /** Chuyển lượt ghi danh sang EnrolledStudentDto (giá trị trống được thay bằng mặc định). */
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

    /**
     * Số chỗ đã chiếm trong một buổi: ghi danh cả lớp cộng lượt đặt riêng buổi đó.
     *
     * Số chỗ đã dùng trong một buổi: ghi danh toàn lớp cộng các hội viên đã đặt buổi này.
     */
    private long countBooked(ClassSession session) {
        long classWide = enrollments.countByGymClassIdAndStatus(session.getGymClass().getId(), ENROLLMENT_BOOKED);
        return classWide + (sessionBookings != null && session.getId() != null
                ? sessionBookings.countBySessionIdAndStatus(session.getId(), ENROLLMENT_BOOKED) : 0);
    }

    /**
     * Số lượt đặt chỗ lớn nhất trong một buổi bất kỳ của lớp.
     *
     * Số lượt đặt theo buổi cao nhất ở bất kỳ buổi nào của lớp.
     */
    private long busiestSession(Long classId) {
        if (sessionBookings == null) return 0;
        return sessionBookings.countBookedGroupedBySession(classId).stream()
                .mapToLong(com.swp391.scms.scheduling.dto.SessionBookingCount::bookedCount).max().orElse(0);
    }

    /** Chuyển lượt đặt chỗ buổi sang EnrolledStudentDto (giá trị trống được thay bằng mặc định). */
    private EnrolledStudentDto toStudentDto(SessionBooking booking) {
        Member member = booking.getMember();
        User user = member != null ? member.getUser() : null;
        return new EnrolledStudentDto(
                booking.getId(),
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
                booking.getBookedAt(),
                booking.getStatus()
        );
    }
}
