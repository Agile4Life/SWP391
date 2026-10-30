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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class CoachReviewService {

    private final CoachReviewRepository reviewRepository;
    private final CoachRepository coachRepository;
    private final MemberRepository memberRepository;
    private final NotificationService notificationService;

    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository) {
        this(reviewRepository, coachRepository, memberRepository, null);
    }

    @Autowired
    public CoachReviewService(CoachReviewRepository reviewRepository,
                              CoachRepository coachRepository,
                              MemberRepository memberRepository,
                              @Autowired(required = false) NotificationService notificationService) {
        this.reviewRepository = reviewRepository;
        this.coachRepository = coachRepository;
        this.memberRepository = memberRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public CoachReviewDto createReview(Long memberUserId, CoachReviewCreateDto request) {
        if (request.rating() == null || request.rating() < 1 || request.rating() > 5) {
            throw new BadRequestException("INVALID_RATING", "error.review.invalid_rating", "Số sao đánh giá phải từ 1 đến 5 sao.");
        }

        Member member = memberRepository.findById(memberUserId)
                .orElseThrow(() -> new ResourceNotFoundException("resource.member", memberUserId));

        Coach coach = coachRepository.findById(request.coachId())
                .orElseThrow(() -> new ResourceNotFoundException("resource.coach", request.coachId()));

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
            String authorName = review.getIsAnonymous() ? "Một học viên ẩn danh"
                    : (member.getUser() != null ? member.getUser().getFullName() : "Học viên");
            String title = "Đánh giá mới từ học viên";
            String msg = String.format("%s đã gửi đánh giá %d sao kèm nhận xét cho bạn.", authorName, saved.getRating());
            notificationService.send(coach.getUserId(), title, msg, "COACH_REVIEW", "COACH_REVIEW", saved.getId());
        }

        return mapToDto(saved);
    }

    @Transactional(readOnly = true)
    public List<CoachReviewDto> getApprovedReviewsForCoach(Long coachId) {
        return reviewRepository.findApprovedByCoachId(coachId).stream()
                .map(this::mapToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CoachReviewDto> getMyReviews(Long memberUserId) {
        return reviewRepository.findByMemberId(memberUserId).stream()
                .map(this::mapToDto)
                .toList();
    }

    private CoachReviewDto mapToDto(CoachReview r) {
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
                r.getMember().getUserId(),
                memberName,
                r.getBookingId(),
                r.getClassSessionId(),
                r.getRating(),
                r.getComment(),
                r.getIsAnonymous(),
                r.getStatus(),
                r.getCreatedAt()
        );
    }
}

