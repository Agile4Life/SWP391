package com.swp391.scms.catalog;

import com.swp391.scms.common.CenterTime;
import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.scheduling.repository.SessionBookingRepository;
import com.swp391.scms.scheduling.dto.SessionBookingCount;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.scheduling.dto.ClassBookingCount;
import com.swp391.scms.scheduling.mapper.SchedulingMapper;
import com.swp391.scms.scheduling.repository.ClassEnrollmentRepository;
import com.swp391.scms.scheduling.repository.ClassSessionRepository;
import com.swp391.scms.users.CoachRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public read model over the same catalogs and profiles used by the portal. */
@Service
public class PublicCatalogService {
    public record CoachDto(Long id, String name, String specialization, String bio,
                           String certification, String avatarUrl) {}
    public record CatalogDto(List<PackageDto> packages, List<CoachDto> coaches,
                             List<ClassSessionDto> sessions) {}

    private final MembershipPackageRepository packages;
    private final CoachRepository coaches;
    private final ClassSessionRepository sessions;
    private final ClassEnrollmentRepository enrollments;

    private final SessionBookingRepository sessionBookings;
    private final SchedulingMapper mapper;
    private final Clock clock;

    public PublicCatalogService(MembershipPackageRepository packages, CoachRepository coaches,
            ClassSessionRepository sessions, ClassEnrollmentRepository enrollments,
            SchedulingMapper mapper, Clock clock) {
        this(packages, coaches, sessions, enrollments, mapper, clock, null);
    }

    @Autowired
    public PublicCatalogService(MembershipPackageRepository packages, CoachRepository coaches,
            ClassSessionRepository sessions, ClassEnrollmentRepository enrollments,
            SchedulingMapper mapper, Clock clock, SessionBookingRepository sessionBookings) {
        this.sessionBookings = sessionBookings;
        this.packages = packages;
        this.coaches = coaches;
        this.sessions = sessions;
        this.enrollments = enrollments;
        this.mapper = mapper;
        this.clock = clock;
    }

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
        return new CatalogDto(publicPackages, publicCoaches, List.of());
    }
}
