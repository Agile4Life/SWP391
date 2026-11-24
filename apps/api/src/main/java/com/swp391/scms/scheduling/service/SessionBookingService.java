package com.swp391.scms.scheduling.service;

import com.swp391.scms.coaching.entity.CoachBooking;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.common.exception.AppException;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.scheduling.dto.SessionBookingRequests;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.BulkBookResult;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.BulkCancelResult;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.SessionBookingDto;
import com.swp391.scms.scheduling.dto.SessionBookingResponses.Skipped;
import com.swp391.scms.scheduling.entity.ClassEnrollment;
import com.swp391.scms.scheduling.entity.ClassSession;
import com.swp391.scms.scheduling.entity.GymClass;
import com.swp391.scms.scheduling.entity.SessionBooking;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.GymClassRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Predicate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nghiệp vụ đặt chỗ từng buổi học: đặt một/nhiều buổi, hủy một/nhiều lượt, nhả lượt khi gói bảo lưu/hết hạn và
 * xem lịch của hội viên.
 *
 * Đặt lớp theo từng buổi: hội viên giữ và nhả từng buổi riêng. Đặt một buổi, cả tuần, cả tháng hay bất kỳ tập
 * buổi chọn tay đều đi qua {@link #bookOne}, nên mỗi buổi được kiểm tra riêng (còn mở và ở tương lai,
 * membership bao phủ ngày đó, không đụng lượt đặt khác, còn chỗ) và buổi nào lỗi sẽ được báo lại thay vì làm
 * hỏng các buổi khác.
 *
 * <p>Seats are counted per session: the booked sessions plus any class-wide {@link ClassEnrollment} of the class.
 * Trigger database lặp lại kiểm tra sức chứa và membership, và một unique index cấm đặt một buổi hai lần.
 */
@Service
public class SessionBookingService {

    private static final String BOOKED = "booked";
    private static final String CANCELLED = "cancelled";
    private static final Set<String> STAFF_ROLES = Set.of("CENTER_MANAGER", "MANAGER", "STAFF", "RECEPTIONIST");

    private final SessionBookingRepository bookings;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final GymClassRepository gymClasses;
    private final MembershipSubscriptionRepository subscriptions;
    private final MemberRepository members;
    private final NotificationService notifications;
    private final MessageService messageService;
    private final Clock clock;

    @Autowired(required = false)
    private CoachBookingRepository coachBookingRepository;

    /** Constructor rút gọn (không có CoachBookingRepository) dùng trong test. */
    public SessionBookingService(SessionBookingRepository bookings, ClassSessionRepository sessions,
                                 ClassEnrollmentRepository enrollments, GymClassRepository gymClasses,
                                 MembershipSubscriptionRepository subscriptions, MemberRepository members,
                                 NotificationService notifications, MessageService messageService, Clock clock) {
        this(bookings, sessions, enrollments, gymClasses, subscriptions, members, notifications, messageService, clock, null);
    }

    /**
     * Constructor chính được Spring dùng: nhận đủ repository, NotificationService, MessageService, Clock và
     * repository PT (tùy chọn).
     */
    @Autowired
    public SessionBookingService(SessionBookingRepository bookings, ClassSessionRepository sessions,
                                 ClassEnrollmentRepository enrollments, GymClassRepository gymClasses,
                                 MembershipSubscriptionRepository subscriptions, MemberRepository members,
                                 NotificationService notifications, MessageService messageService, Clock clock,
                                 @Autowired(required = false) CoachBookingRepository coachBookingRepository) {
        this.bookings = bookings;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.gymClasses = gymClasses;
        this.subscriptions = subscriptions;
        this.members = members;
        this.notifications = notifications;
        this.messageService = messageService;
        this.clock = clock;
        this.coachBookingRepository = coachBookingRepository;
    }

    @Autowired(required = false)
    private MemberScheduleGuard scheduleGuard;

    /** Dịch message key kèm tham số; không có MessageService thì trả lại key. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }

    /** Lấy lý do dễ đọc từ AppException (dịch message key nếu được), nếu không thì trả mã lỗi. */
    private String reason(AppException e) {
        if (messageService != null && e.getMessageKey() != null) {
            try {
                return messageService.getMessage(e.getMessageKey(),
                        e.getMessageArgs() == null ? new Object[0] : e.getMessageArgs());
            } catch (RuntimeException ignored) {
                // quay về dùng mã lỗi.
            }
        }
        return e.getErrorCode();
    }

    // ------------------------------------------------------------------ booking

    /** Hội viên đặt một buổi: khóa dòng hội viên, gọi bookOne rồi gửi thông báo đặt thành công. */
    @Transactional
    public SessionBookingDto book(AuthenticatedPrincipal principal, Long sessionId) {
        Member member = lockMember(principal.id());
        SessionBooking booking = bookOne(member, findSession(sessionId), null);
        notifications.send(member.getUserId(), msg("notifications.booking.session_booked.title"),
                msg("notifications.booking.session_booked.body", className(booking), booking.getSession().getSessionDate().toString(),
                        timeRange(booking.getSession())),
                "system", "class_session", booking.getSession().getId());
        return toDto(booking);
    }

    /**
     * Đặt nhiều buổi: bỏ id trùng, sắp buổi theo lớp rồi thời gian để khóa dòng không deadlock, gắn chung
     * batchId; buổi nào lỗi thì ghi vào danh sách bỏ qua kèm lý do.
     *
     * Đặt mọi buổi trong danh sách có thể đặt được và báo các buổi còn lại kèm lý do từng buổi.
     */
    @Transactional
    public BulkBookResult bookMany(AuthenticatedPrincipal principal, List<Long> sessionIds) {
        List<Long> ids = distinctIds(sessionIds);
        Member member = lockMember(principal.id());
        List<Skipped> skipped = new ArrayList<>();
        List<ClassSession> found = new ArrayList<>();
        for (Long id : ids) {
            Optional<ClassSession> session = sessions.findById(id);
            if (session.isPresent()) {
                found.add(session.get());
            } else {
                skipped.add(new Skipped(id, null, "NOT_FOUND", msg("resource.class_session")));
            }
        }
        // Thứ tự cố định (lớp rồi giờ) giữ khóa dòng lớp không bị deadlock giữa các request đồng thời.
        found.sort(Comparator.comparing((ClassSession s) -> s.getGymClass().getId())
                .thenComparing(ClassSession::getSessionDate).thenComparing(ClassSession::getStartTime));
        String batchId = found.size() > 1 ? UUID.randomUUID().toString() : null;
        List<SessionBookingDto> booked = new ArrayList<>();
        for (ClassSession session : found) {
            try {
                booked.add(toDto(bookOne(member, session, batchId)));
            } catch (AppException e) {
                skipped.add(new Skipped(session.getId(), session.getSessionDate(), e.getErrorCode(), reason(e)));
            }
        }
        booked.sort(Comparator.comparing(SessionBookingDto::sessionDate).thenComparing(SessionBookingDto::startTime));
        skipped.sort(Comparator.comparing(Skipped::date, Comparator.nullsLast(Comparator.naturalOrder())));
        if (!booked.isEmpty()) {
            notifications.send(member.getUserId(), msg("notifications.booking.bulk_booked.title"),
                    msg("notifications.booking.bulk_booked.body", booked.size()), "system", "class_session",
                    booked.get(0).sessionId());
        }
        return new BulkBookResult(booked, skipped);
    }

    /**
     * Đặt một buổi: khóa lớp, lớp phải active, buổi còn mở, gói tập phủ ngày học, chưa đặt/ghi danh, không
     * trùng lịch, còn chỗ; rồi lưu lượt đặt.
     */
    private SessionBooking bookOne(Member member, ClassSession session, String batchId) {
        Long memberId = member.getUserId();
        Long classId = session.getGymClass().getId();
        GymClass gymClass = gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
        if (gymClass.getStatus() != null && !"active".equalsIgnoreCase(gymClass.getStatus())) {
            throw new BadRequestException("SCHEDULING_CLASS_INACTIVE", "error.scheduling.class_inactive", null,
                    "Class is currently inactive");
        }
        SessionEligibility.ensureBookable(session, clock);
        SessionEligibility.ensureMembershipCoversSession(subscriptions, memberId, session.getSessionDate(), clock);

        SessionEligibility.ensurePlatinumRoomAccess(subscriptions, memberId, gymClass.getRoom(), session.getSessionDate());

        if (bookings.existsBySessionIdAndMemberUserIdAndStatus(session.getId(), memberId, BOOKED)) {
            throw new ConflictException("SCHEDULING_SESSION_ALREADY_BOOKED", "error.scheduling.session_already_booked",
                    null, "Member already booked this session");
        }
        if (enrollments.findByGymClassIdAndMemberUserIdAndStatus(classId, memberId, BOOKED).isPresent()) {
            throw new ConflictException("SCHEDULING_ALREADY_ENROLLED", "error.scheduling.already_enrolled", null,
                    "Member already has an active booking for this class");
        }
        ensureNoOverlap(memberId, session);
        if (scheduleGuard != null) {
            scheduleGuard.ensureFree(memberId, session.getSessionDate(), session.getStartTime(), session.getEndTime(), classId);
        }

        long taken = enrollments.countByGymClassIdAndStatus(classId, BOOKED)
                + bookings.countBySessionIdAndStatus(session.getId(), BOOKED);
        if (taken >= gymClass.getCapacity()) {
            throw new ConflictException("SCHEDULING_SESSION_FULL", "error.scheduling.session_full", null,
                    "This session is full");
        }

        SessionBooking booking = new SessionBooking();
        booking.setSession(session);
        booking.setMember(member);
        booking.setStatus(BOOKED);
        booking.setBookedAt(LocalDateTime.now(clock));
        booking.setBatchId(batchId);
        return bookings.saveAndFlush(booking);
    }

    /**
     * Hội viên không được giữ hai buổi trùng giờ, dù đặt từng buổi, qua ghi danh lớp hay buổi PT 1:1.
     *
     * Hội viên không thể giữ hai buổi chồng giờ nhau, dù đặt theo buổi, qua lớp hay PT 1:1.
     */
    private void ensureNoOverlap(Long memberId, ClassSession target) {
        List<ClassSession> sameDay = sessions.findActiveByMemberAndDate(memberId, target.getSessionDate());
        if (sameDay != null) {
            for (ClassSession other : sameDay) {
                if (other == null || other.getId() == null || other.getId().equals(target.getId())) {
                    continue;
                }
                if (target.getStartTime().isBefore(other.getEndTime()) && target.getEndTime().isAfter(other.getStartTime())) {
                    throw new ConflictException("SCHEDULING_MEMBER_TIME_OVERLAP", "error.scheduling.member_time_overlap",
                            new Object[]{other.getGymClass().getName(), target.getSessionDate().toString(),
                                    hhmm(other.getStartTime()), hhmm(other.getEndTime())},
                            "Member already has an overlapping booking");
                }
            }
        }
        if (coachBookingRepository != null && target.getSessionDate() != null) {
            List<CoachBooking> ptBookings = coachBookingRepository.findActiveByMemberAndDate(memberId, target.getSessionDate());
            if (ptBookings != null) {
                for (CoachBooking pt : ptBookings) {
                    if (pt == null || pt.getStartTime() == null || pt.getEndTime() == null) {
                        continue;
                    }
                    if (target.getStartTime().isBefore(pt.getEndTime()) && target.getEndTime().isAfter(pt.getStartTime())) {
                        throw new ConflictException("SCHEDULE_CONFLICT", "error.scheduling.session_conflict",
                                new Object[]{target.getSessionDate().toString(), hhmm(pt.getStartTime()), hhmm(pt.getEndTime())},
                                "Member already has an overlapping 1:1 PT session");
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ cancelling

    /** Hủy một lượt đặt chỗ (khóa dòng, kiểm tra quyền và thời gian) rồi gửi thông báo cho hội viên. */
    @Transactional
    public SessionBookingDto cancel(AuthenticatedPrincipal principal, Long bookingId) {
        SessionBooking booking = lockBooking(bookingId);
        SessionBookingDto dto = cancelLocked(principal, booking);
        notifications.send(booking.getMember().getUserId(), msg("notifications.booking.session_cancelled.title"),
                msg("notifications.booking.session_cancelled.body", className(booking),
                        booking.getSession().getSessionDate().toString()),
                "system", "class_session", booking.getSession().getId());
        return dto;
    }

    /**
     * Hủy nhiều lượt đặt chỗ; lượt lỗi được bỏ qua kèm lý do; gửi một thông báo gộp (hoặc thông báo đơn nếu chỉ
     * hủy một lượt).
     */
    @Transactional
    public BulkCancelResult cancelMany(AuthenticatedPrincipal principal, List<Long> bookingIds) {
        List<Long> ids = distinctIds(bookingIds);
        List<SessionBookingDto> cancelled = new ArrayList<>();
        List<Skipped> skipped = new ArrayList<>();
        Long notifyUser = null;
        for (Long id : ids) {
            try {
                SessionBooking booking = lockBooking(id);
                cancelled.add(cancelLocked(principal, booking));
                notifyUser = booking.getMember().getUserId();
            } catch (AppException e) {
                skipped.add(new Skipped(id, null, e.getErrorCode(), reason(e)));
            }
        }
        if (!cancelled.isEmpty() && notifyUser != null && cancelled.size() > 1) {
            notifications.send(notifyUser, msg("notifications.booking.bulk_cancelled.title"),
                    msg("notifications.booking.bulk_cancelled.body", cancelled.size()), "system", "class_session",
                    cancelled.get(0).sessionId());
        } else if (cancelled.size() == 1 && notifyUser != null) {
            notifications.send(notifyUser, msg("notifications.booking.session_cancelled.title"),
                    msg("notifications.booking.session_cancelled.body", cancelled.get(0).className(),
                            cancelled.get(0).sessionDate().toString()),
                    "system", "class_session", cancelled.get(0).sessionId());
        }
        return new BulkCancelResult(cancelled, skipped);
    }

    /** Khóa dòng lớp rồi khóa dòng lượt đặt chỗ (đúng thứ tự để tránh deadlock) và trả về lượt đặt. */
    private SessionBooking lockBooking(Long bookingId) {
        Long classId = bookings.findClassIdById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.session_booking", bookingId));
        gymClasses.findByIdForUpdate(classId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.gym_class", classId));
        return bookings.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.session_booking", bookingId));
    }

    /**
     * Hủy lượt đặt đã khóa: chỉ chủ sở hữu hoặc nhân viên, lượt phải đang booked và buổi chưa bắt đầu; ghi thời
     * điểm và lý do hủy.
     */
    private SessionBookingDto cancelLocked(AuthenticatedPrincipal principal, SessionBooking booking) {
        boolean staff = STAFF_ROLES.contains(principal.role());
        boolean owner = booking.getMember() != null && booking.getMember().getUserId().equals(principal.id());
        if (!staff && !owner) {
            throw new ForbiddenException("SCHEDULING_BOOKING_NOT_OWNER", "error.scheduling.booking_not_owner", null,
                    "Only the owner or staff may cancel this booking");
        }
        if (!BOOKED.equalsIgnoreCase(booking.getStatus())) {
            throw new BadRequestException("SCHEDULING_BOOKING_NOT_BOOKED", "error.scheduling.booking_not_booked", null,
                    "Only a booked session can be cancelled");
        }
        ClassSession session = booking.getSession();
        LocalDateTime now = SessionEligibility.now(clock);
        if (!LocalDateTime.of(session.getSessionDate(), session.getStartTime()).isAfter(now)) {
            throw new BadRequestException("SCHEDULING_BOOKING_TOO_LATE", "error.scheduling.booking_too_late", null,
                    "A session that has started can no longer be cancelled");
        }
        booking.setStatus(CANCELLED);
        booking.setCancelledAt(now);
        booking.setCancelReason(msg("scheduling.enrollment.cancelled_by_role", principal.role()));
        return toDto(bookings.saveAndFlush(booking));
    }

    /**
     * Nhả các lượt đặt sắp tới của hội viên khi gói bị bảo lưu/hủy/hết hạn; giữ lại buổi mà gói vẫn phủ
     * (coveredOn) và buổi đã kết thúc hôm nay; trả về số lượt đã hủy.
     *
     * Nhả các lượt đặt theo buổi sắp tới của hội viên khi membership bị tạm hoãn, hủy hoặc hết hạn;
     * {@code coveredOn} keeps the sessions whose date the membership still covers.
     */
    @Transactional
    public int cancelFutureForMember(Long memberId, String reason, Predicate<LocalDate> coveredOn) {
        if (memberId == null) {
            return 0;
        }
        LocalDateTime now = SessionEligibility.now(clock);
        int cancelled = 0;
        for (SessionBooking booking : bookings.findUpcomingBookedForMember(memberId, now.toLocalDate())) {
            ClassSession session = booking.getSession();
            if (coveredOn.test(session.getSessionDate())
                    || (session.getEndTime() != null && session.getSessionDate().equals(now.toLocalDate())
                    && session.getEndTime().isBefore(now.toLocalTime()))) {
                continue;
            }
            booking.setStatus(CANCELLED);
            booking.setCancelledAt(now);
            booking.setCancelReason(reason);
            bookings.saveAndFlush(booking);
            cancelled++;
        }
        if (cancelled > 0) {
            notifications.send(memberId, msg("notifications.booking.bulk_cancelled.title"),
                    msg("notifications.booking.bulk_cancelled.body", cancelled), "system", "class_session", null);
        }
        return cancelled;
    }

    // ------------------------------------------------------------------ reading

    /** Lấy lượt đặt chỗ của hội viên đang đăng nhập, lọc theo trạng thái (chuẩn hóa chữ thường) và khoảng ngày. */
    @Transactional(readOnly = true)
    public List<SessionBookingDto> myBookings(AuthenticatedPrincipal principal, String status,
                                              LocalDate from, LocalDate to) {
        members.findById(principal.id())
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", principal.id()));
        String normalized = status != null && !status.isBlank() ? status.trim().toLowerCase() : null;
        return bookings.findForMember(principal.id(), normalized, from, to).stream().map(this::toDto).toList();
    }

    // ------------------------------------------------------------------ helpers

    /** Chuẩn hóa danh sách id: bỏ null/âm/trùng, báo lỗi nếu rỗng hoặc vượt MAX_BULK phần tử. */
    private List<Long> distinctIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("SCHEDULING_BULK_EMPTY", "error.scheduling.bulk_empty", null, null);
        }
        Set<Long> distinct = new LinkedHashSet<>();
        for (Long id : ids) {
            if (id != null && id > 0) {
                distinct.add(id);
            }
        }
        if (distinct.isEmpty()) {
            throw new BadRequestException("SCHEDULING_BULK_EMPTY", "error.scheduling.bulk_empty", null, null);
        }
        if (distinct.size() > SessionBookingRequests.MAX_BULK) {
            throw new BadRequestException("SCHEDULING_BULK_TOO_MANY", "error.scheduling.bulk_too_many",
                    new Object[]{SessionBookingRequests.MAX_BULK}, null);
        }
        return new ArrayList<>(distinct);
    }

    /** Lấy hội viên theo id và khóa dòng để tránh đặt chỗ đồng thời. */
    private Member lockMember(Long memberId) {
        return members.findByUserIdForUpdate(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberId));
    }

    /** Lấy buổi học theo id, không có thì báo không tìm thấy. */
    private ClassSession findSession(Long sessionId) {
        return sessions.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", sessionId));
    }

    /** Định dạng giờ thành chuỗi HH:mm. */
    private static String hhmm(LocalTime time) {
        String raw = time.toString();
        return raw.length() >= 5 ? raw.substring(0, 5) : raw;
    }

    /** Tên lớp của buổi trong lượt đặt chỗ. */
    private static String className(SessionBooking booking) {
        return booking.getSession().getGymClass().getName();
    }

    /** Khung giờ của buổi dạng "HH:mm–HH:mm". */
    private static String timeRange(ClassSession session) {
        return hhmm(session.getStartTime()) + "–" + hhmm(session.getEndTime());
    }

    /** Chuyển lượt đặt chỗ sang DTO kèm thông tin buổi, lớp, phòng và HLV. */
    private SessionBookingDto toDto(SessionBooking booking) {
        ClassSession session = booking.getSession();
        GymClass gymClass = session.getGymClass();
        return new SessionBookingDto(
                booking.getId(),
                session.getId(),
                gymClass.getId(),
                gymClass.getName(),
                booking.getMember() != null ? booking.getMember().getUserId() : null,
                session.getSessionDate(),
                session.getStartTime(),
                session.getEndTime(),
                gymClass.getRoom() != null ? gymClass.getRoom().getName() : null,
                gymClass.getCoach() != null && gymClass.getCoach().getUser() != null
                        ? gymClass.getCoach().getUser().getFullName() : null,
                booking.getStatus(),
                booking.getBookedAt(),
                booking.getCancelledAt(),
                booking.getCancelReason(),
                booking.getBatchId());
    }
}
