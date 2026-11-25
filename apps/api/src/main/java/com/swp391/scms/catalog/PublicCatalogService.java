package com.swp391.scms.catalog;

import com.swp391.scms.common.CenterTime;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.scheduling.dto.ClassBookingCount;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.SessionBookingCount;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.users.CoachRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Dữ liệu công khai cho trang chủ và các trang bộ môn, lấy từ cùng danh mục gói, hồ sơ HLV và lịch lớp nhóm
 * mà portal đang dùng.
 */
@Service
public class PublicCatalogService {
    /** Thông tin HLV công khai: id, họ tên, chuyên môn, giới thiệu, chứng chỉ và ảnh đại diện. */
    public record CoachDto(Long id, String name, String specialization, String bio,
                           String certification, String avatarUrl) {}
    /** Danh mục công khai: gói tập, HLV và danh sách buổi lớp nhóm sắp tới trong 7 ngày. */
    public record CatalogDto(List<PackageDto> packages, List<CoachDto> coaches,
                             List<ClassSessionDto> sessions) {}

    private final MembershipPackageRepository packages;
    private final CoachRepository coaches;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;
    private final SessionBookingRepository sessionBookings;
    private final SchedulingMapper mapper;
    private final Clock clock;
    private final boolean classesEnabled;

    /** Constructor rút gọn dùng trong unit test chỉ kiểm tra gói và HLV. */
    public PublicCatalogService(MembershipPackageRepository packages, CoachRepository coaches) {
        this(packages, coaches, null, null, null, null, null, true);
    }

    /** Constructor đầy đủ dùng trong Spring và unit test có kiểm tra lịch lớp công khai. */
    @Autowired
    public PublicCatalogService(
            MembershipPackageRepository packages,
            CoachRepository coaches,
            @Autowired(required = false) ClassSessionRepository sessions,
            @Autowired(required = false) ClassEnrollmentRepository enrollments,
            @Autowired(required = false) SessionBookingRepository sessionBookings,
            @Autowired(required = false) SchedulingMapper mapper,
            @Autowired(required = false) Clock clock,
            @Value("${app.legacy.classes-enabled:true}") boolean classesEnabled) {
        this.packages = packages;
        this.coaches = coaches;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.sessionBookings = sessionBookings;
        this.mapper = mapper;
        this.clock = clock;
        this.classesEnabled = classesEnabled;
    }

    /**
     * Trả gói tập đang bán (giá tăng dần), HLV đang làm việc và các buổi lớp nhóm sắp tới trong 7 ngày tới
     * (khi tính năng lớp nhóm đang bật).
     */
    @Transactional(readOnly = true)
    public CatalogDto getCatalog() {
        var publicPackages = packages.findByStatusOrderByPriceAsc("active").stream().map(PackageDto::of).toList();
        var publicCoaches = coaches.findPublicCoaches().stream().map(c -> {
            String rawAvatar = c.getUser() != null ? c.getUser().getAvatarUrl() : null;
            String avatarUrl = rawAvatar != null && !rawAvatar.isBlank() ? rawAvatar.trim() : null;
            return new CoachDto(c.getUserId(),
                    c.getUser() != null ? c.getUser().getFullName() : null,
                    c.getSpecialization(), c.getBio(), c.getCertification(),
                    avatarUrl);
        }).toList();

        List<ClassSessionDto> publicSessions = List.of();
        if (classesEnabled && sessions != null && mapper != null) {
            var centerClock = (clock != null ? clock : Clock.system(CenterTime.ZONE)).withZone(CenterTime.ZONE);
            var now = LocalDateTime.now(centerClock);
            var today = now.toLocalDate();
            var visibleSessions = sessions.findPublicSessions(today, today.plusDays(6), now.toLocalTime());
            var classIds = visibleSessions.stream().map(s -> s.getGymClass().getId()).distinct().toList();
            var bookedCounts = enrollments == null || classIds.isEmpty() ? Map.<Long, Long>of()
                    : enrollments.countByClassIdsAndStatus(classIds, "booked").stream()
                            .collect(Collectors.toMap(ClassBookingCount::classId, ClassBookingCount::bookedCount));
            var sessionCounts = sessionBookings == null || visibleSessions.isEmpty() ? Map.<Long, Long>of()
                    : sessionBookings.countBookedBySessionIds(visibleSessions.stream().map(s -> s.getId()).toList()).stream()
                            .collect(Collectors.toMap(SessionBookingCount::sessionId, SessionBookingCount::bookedCount));
            publicSessions = visibleSessions.stream()
                    .map(s -> mapper.toDto(s, bookedCounts.getOrDefault(s.getGymClass().getId(), 0L)
                            + sessionCounts.getOrDefault(s.getId(), 0L)))
                    .toList();
        }

        return new CatalogDto(publicPackages, publicCoaches, publicSessions);
    }
}
