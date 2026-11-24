package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.dto.CoachReviewCreateDto;
import com.swp391.scms.coaching.dto.CoachReviewDto;
import com.swp391.scms.coaching.entity.CoachReview;
import com.swp391.scms.coaching.repository.CoachReviewRepository;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ResourceNotFoundException;
import com.swp391.scms.notifications.NotificationService;
import com.swp391.scms.users.CoachRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Coach;
import com.swp391.scms.users.entity.Member;
import org.springframework.beans.factory.annotation.Autowired;
import com.swp391.scms.common.i18n.MessageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Clock;
import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.exception.ConflictException;
import java.util.List;

/**
 * Nghiệp vụ đánh giá HLV của hội viên: tạo đánh giá, liệt kê đánh giá đã duyệt và đánh giá của chính mình (tính
 * năng đã ngừng, chỉ bật qua app.coaching.*).
 */
@Service
public class CoachReviewService {

    private final CoachReviewRepository reviewRepository;
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final NotificationService notificationService;
    private final MessageService messageService;
    private final CoachBookingRepository bookingRepository;
    private final ClassSessionRepository sessionRepository;
    private final ClassEnrollmentRepository enrollmentRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings;
    private final Clock clock;

    @Autowired(required = false)
    private com.swp391.scms.attendance.repository.SessionAttendanceRepository attendanceRepository;

    /** Constructor rút gọn cho test: chỉ có repository đánh giá, HLV và hội viên. */
    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository) {
        this(reviewRepository, coachRepository, memberRepository, null);
    }

    /** Constructor rút gọn cho test: thêm NotificationService để gửi thông báo cho HLV. */
    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository,
                              NotificationService notificationService) {
        this(reviewRepository, coachRepository, memberRepository, notificationService, null);
    }

    /** Constructor rút gọn cho test: thêm MessageService để dịch thông báo. */
    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository,
                              NotificationService notificationService, MessageService messageService) {
        this(reviewRepository, coachRepository, memberRepository, notificationService, messageService, null, null, null, Clock.systemDefaultZone());
    }

    /** Constructor chính được Spring dùng: nhận đủ repository booking, buổi lớp, ghi danh và Clock. */
    @Autowired
    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository,
                              @Autowired(required = false) NotificationService notificationService, MessageService messageService,
                              CoachBookingRepository bookingRepository, ClassSessionRepository sessionRepository,
                              ClassEnrollmentRepository enrollmentRepository, Clock clock) {
        this.reviewRepository = reviewRepository;
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.notificationService = notificationService;
        this.messageService = messageService;
        this.bookingRepository = bookingRepository;
        this.sessionRepository = sessionRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.clock = clock;
    }

    /**
     * Tạo đánh giá mới: kiểm tra điểm 1–5, kiểm tra nguồn (buổi 1:1 hoặc buổi lớp đã tham dự, chưa đánh giá),
     * lưu và gửi thông báo cho HLV.
     */
    @Transactional
    public CoachReviewDto createReview(Long memberUserId, CoachReviewCreateDto request) {
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new BadRequestException("INVALID_RATING", "error.review.invalid_rating", null, "Số sao đánh giá phải từ 1 đến 5 sao.");
        }

        Member member = memberRepository.findById(memberUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberUserId));

        Coach coach = coachRepository.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));

        validateReviewSource(memberUserId, request);

        CoachReview review = new CoachReview();
        review.setCoach(coach);
        review.setMember(member);
        review.setBookingId(request.bookingId());
        review.setClassSessionId(request.classSessionId());
        review.setRating(request.rating());
        review.setComment(request.comment() != null ? request.comment().trim() : null);
        review.setIsAnonymous(Boolean.TRUE.equals(request.isAnonymous()));
        review.setStatus("approved");
        review.setCreatedAt(LocalDateTime.now());

        CoachReview saved = reviewRepository.save(review);

        // Send in-app notification to the Coach
        if (notificationService != null) {
            String authorName = review.getIsAnonymous() ? msg("coaching.review.anonymous")
                    : (member.getUser() != null ? member.getUser().getFullName() : msg("coaching.review.member"));
            String title = msg("notifications.coaching.review.title");
            String msg = msg("notifications.coaching.review.body", authorName, saved.getRating());
            notificationService.send(coach.getUserId(), title, msg, "system", null, saved.getId());
        }

        return mapToDto(saved, true);
    }

    /** Lấy danh sách đánh giá đã được duyệt của một HLV (góc nhìn công khai). */
    @Transactional(readOnly = true)
    public List<CoachReviewDto> getApprovedReviewsForCoach(Long coachId) {
        return reviewRepository.findApprovedByCoachId(coachId).stream()
                .map(r -> mapToDto(r, false))
                .toList();
    }

    /** Lấy toàn bộ đánh giá do hội viên hiện tại viết (góc nhìn chủ sở hữu). */
    @Transactional(readOnly = true)
    public List<CoachReviewDto> getMyReviews(Long memberUserId) {
        return reviewRepository.findByMemberId(memberUserId).stream()
                .map(r -> mapToDto(r, true))
                .toList();
    }

    /**
     * Chuyển entity CoachReview sang DTO; ownerView quyết định có hiện thông tin chỉ chủ đánh giá được thấy hay
     * không.
     */
    private CoachReviewDto mapToDto(CoachReview r, boolean ownerView) {
        String coachName = r.getCoach().getUser() != null ? r.getCoach().getUser().getFullName() : "Huấn luyện viên";
        String coachAvatar = r.getCoach().getUser() != null ? r.getCoach().getUser().getAvatarUrl() : null;
        String memberName = Boolean.TRUE.equals(r.getIsAnonymous())
                ? "Học viên ẩn danh"
                : (r.getMember().getUser() != null ? r.getMember().getUser().getFullName() : "Hội viên");

        return new CoachReviewDto(
                r.getId(),
                r.getCoach().getUserId(),
                coachName,
                r.getCoach().getSpecialization(),
                coachAvatar,
                !ownerView && Boolean.TRUE.equals(r.getIsAnonymous()) ? null : r.getMember().getUserId(),
                memberName,
                !ownerView && Boolean.TRUE.equals(r.getIsAnonymous()) ? null : r.getBookingId(),
                !ownerView && Boolean.TRUE.equals(r.getIsAnonymous()) ? null : r.getClassSessionId(),
                r.getRating(),
                r.getComment(),
                r.getIsAnonymous(),
                r.getStatus(),
                r.getCreatedAt()
        );
    }
    /**
     * Kiểm tra nguồn đánh giá: phải chọn đúng một trong booking 1:1 hoặc buổi lớp, của chính hội viên, không bị
     * hủy, đã điểm danh có mặt và chưa từng đánh giá.
     */
    private void validateReviewSource(Long memberId, CoachReviewCreateDto request) {
        if ((request.bookingId() == null) == (request.classSessionId() == null)) {
            throw new BadRequestException("INVALID_REVIEW_SOURCE", "error.review.invalid_source", null, "Choose exactly one completed session.");
        }
        if (request.bookingId() != null) {
            var booking = bookingRepository.findById(request.bookingId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.coach_booking", request.bookingId()));
            if (!booking.getMember().getUserId().equals(memberId)
                    || !booking.getCoach().getUserId().equals(request.coachId())) {
                throw new ForbiddenException("FORBIDDEN", "error.review.forbidden_source", null, "You cannot review this booking.");
            }
            if ("cancelled".equals(booking.getStatus())
                    || !LocalDateTime.of(booking.getBookingDate(), booking.getEndTime()).isBefore(LocalDateTime.now(clock))) {
                throw new BadRequestException("REVIEW_SESSION_NOT_FINISHED", "error.review.not_finished", null, "The session has not finished.");
            }
            // Same rule as courses: only a session the coach or desk marked as attended can be reviewed.
            if (booking.getAttendedAt() == null) {
                throw new ForbiddenException("REVIEW_NOT_ATTENDED", "error.review.not_attended", null,
                        "Only members who attended this session can review it.");
            }
            if (reviewRepository.existsByMemberUserIdAndBookingId(memberId, request.bookingId())) {
                throw new ConflictException("DUPLICATE_REVIEW", "error.review.duplicate", null, "This session was already reviewed.");
            }
        } else {
            var session = sessionRepository.findById(request.classSessionId())
                    .orElseThrow(() -> new ResourceNotFoundException("resource.class_session", request.classSessionId()));
            var gymClass = session.getGymClass();
            if (!gymClass.getCoach().getUserId().equals(request.coachId())
                    || (enrollmentRepository.findByGymClassId(gymClass.getId()).stream()
                        .noneMatch(e -> e.getMember() != null && memberId.equals(e.getMember().getUserId())
                                && !"cancelled".equals(e.getStatus()))
                        && (sessionBookings == null
                            || !sessionBookings.existsBySessionIdAndMemberUserIdAndStatusNot(session.getId(), memberId, "cancelled")))) {
                throw new ForbiddenException("FORBIDDEN", "error.review.forbidden_source", null, "You cannot review this session.");
            }
            if ("cancelled".equals(session.getStatus())
                    || !LocalDateTime.of(session.getSessionDate(), session.getEndTime()).isBefore(LocalDateTime.now(clock))) {
                throw new BadRequestException("REVIEW_SESSION_NOT_FINISHED", "error.review.not_finished", null, "The session has not finished.");
            }
            // Being enrolled is not enough: the coach must have marked the member present or late.
            if (attendanceRepository != null && attendanceRepository.findBySessionIdAndMemberUserId(session.getId(), memberId)
                    .filter(a -> "present".equalsIgnoreCase(a.getStatus()) || "late".equalsIgnoreCase(a.getStatus()))
                    .isEmpty()) {
                throw new ForbiddenException("REVIEW_NOT_ATTENDED", "error.review.not_attended", null,
                        "Only members who attended this session can review it.");
            }
            if (reviewRepository.existsByMemberUserIdAndClassSessionId(memberId, request.classSessionId())) {
                throw new ConflictException("DUPLICATE_REVIEW", "error.review.duplicate", null, "This session was already reviewed.");
            }
        }
    }

    /** Dịch message key qua MessageService; nếu không có MessageService (test) thì trả lại chính key. */
    private String msg(String key, Object... args) {
        return messageService != null ? messageService.getMessage(key, args) : key;
    }
}

