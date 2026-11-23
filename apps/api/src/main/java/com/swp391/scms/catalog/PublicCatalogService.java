package com.swp391.scms.catalog;

import com.swp391.scms.facilities.dto.CatalogResponses.PackageDto;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.scheduling.dto.SchedulingResponses.ClassSessionDto;
import com.swp391.scms.users.CoachRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public read model over the same catalogs and profiles used by the portal. */
@Service
public class PublicCatalogService {
    public record CoachDto(Long id, String name, String specialization, String bio,
                           String certification, String avatarUrl) {}
    /** {@code sessions} stays in the contract for existing clients but is always empty: group classes are out of scope. */
    public record CatalogDto(List<PackageDto> packages, List<CoachDto> coaches,
                             List<ClassSessionDto> sessions) {}

    private final MembershipPackageRepository packages;
    private final CoachRepository coaches;

    public PublicCatalogService(MembershipPackageRepository packages, CoachRepository coaches) {
        this.packages = packages;
        this.coaches = coaches;
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
