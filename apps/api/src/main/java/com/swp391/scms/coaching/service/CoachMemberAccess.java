package com.swp391.scms.coaching.service;

import com.swp391.scms.coaching.repository.CoachBookingRepository;
import com.swp391.scms.coaching.repository.TrainingPlanRepository;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kiểm tra quan hệ HLV – hội viên để quyết định HLV có làm việc với hội viên hay không (đã lập giáo án, có buổi PT 1:1,
 * hoặc dạy lớp mà hội viên đã đặt/tham dự). HLV chỉ được xem dữ liệu sức khỏe và huấn luyện của các hội viên này;
 * quản lý xem được tất cả.
 */
@Service
public class CoachMemberAccess {

    private final TrainingPlanRepository plans;
    private final CoachBookingRepository bookings;
    private final ClassEnrollmentRepository enrollments;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private com.swp391.scms.scheduling.repository.SessionBookingRepository sessionBookings;

    /** Khởi tạo với các repository giáo án, booking PT và ghi danh lớp dùng để xác định quan hệ. */
    public CoachMemberAccess(TrainingPlanRepository plans, CoachBookingRepository bookings,
                             ClassEnrollmentRepository enrollments) {
        this.plans = plans;
        this.bookings = bookings;
        this.enrollments = enrollments;
    }

    /**
     * Trả về true nếu HLV có giáo án, buổi 1:1, lớp đã ghi danh hoặc buổi đặt chỗ với hội viên này; thiếu id
     * thì trả false.
     */
    @Transactional(readOnly = true)
    public boolean coachesMember(Long coachId, Long memberId) {
        if (coachId == null || memberId == null) return false;
        return plans.existsForCoachAndMember(coachId, memberId)
                || bookings.existsForCoachAndMember(coachId, memberId)
                || enrollments.existsForCoachAndMember(coachId, memberId)
                || (sessionBookings != null && sessionBookings.existsForCoachAndMember(coachId, memberId));
    }

    /**
     * Chỉ áp dụng cho role COACH: ném lỗi nếu HLV không làm việc với hội viên; các role khác được kiểm tra ở nơi khác.
     */
    public void requireAccess(Long userId, String role, Long memberId) {
        if ("COACH".equalsIgnoreCase(role)) {
            requireCoachOf(userId, memberId);
        }
    }

    /** Ném ForbiddenException (COACH_MEMBER_NOT_ASSIGNED) khi HLV không làm việc với hội viên. */
    public void requireCoachOf(Long coachId, Long memberId) {
        if (!coachesMember(coachId, memberId)) {
            throw new ForbiddenException("COACH_MEMBER_NOT_ASSIGNED", "coaching.member.not_assigned", null,
                    "This member does not train with you.");
        }
    }
}
