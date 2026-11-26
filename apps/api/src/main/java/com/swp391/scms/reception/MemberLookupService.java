package com.swp391.scms.reception;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.membership.repository.MemberTrialRedemptionRepository;
import com.swp391.scms.users.KycCrypto;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tra cứu nhanh hội viên cho lễ tân theo mã hội viên, họ tên, email hoặc SĐT.
 * Sử dụng truy vấn có escape ký tự LIKE và nạp hàng loạt trạng thái gói trải nghiệm để tránh truy vấn N+1.
 */
@Service
public class MemberLookupService {

    private static final int MAX_RESULTS = 20;
    private static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_QUERY_LENGTH = 100;

    private final MemberRepository repository;
    private final MemberTrialRedemptionRepository trials;
    private final ReceptionTrialLookupRepository trialLookup;
    private final ReceptionMemberLookupRepository memberLookup;

    /** Constructor cho test chỉ có repository hội viên. */
    public MemberLookupService(MemberRepository repository) {
        this(repository, null, null, null);
    }

    /** Constructor tương thích ngược cho test có MemberTrialRedemptionRepository. */
    public MemberLookupService(MemberRepository repository, MemberTrialRedemptionRepository trials) {
        this(repository, trials, null, null);
    }

    /** Constructor Spring dùng: nạp đầy đủ repository tra cứu có escape LIKE và truy vấn trial theo lô. */
    @Autowired
    public MemberLookupService(MemberRepository repository,
                               @Autowired(required = false) MemberTrialRedemptionRepository trials,
                               @Autowired(required = false) ReceptionTrialLookupRepository trialLookup,
                               @Autowired(required = false) ReceptionMemberLookupRepository memberLookup) {
        this.repository = repository;
        this.trials = trials;
        this.trialLookup = trialLookup;
        this.memberLookup = memberLookup;
    }

    /** Escape ký tự đại diện SQL LIKE (\\, %, _) để tìm kiếm khớp đúng ký tự người dùng nhập. */
    static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /**
     * Từ khóa phải từ 2 đến 100 ký tự (sau khi bỏ khoảng trắng); tìm không phân biệt hoa thường (đã escape
     * wildcard LIKE), trả tối đa 20 hội viên chưa bị xóa kèm cờ trial đã duyệt trong đúng 2 truy vấn SQL.
     */
    @Transactional(readOnly = true)
    public List<MemberLookupDto> search(String query) {
        String keyword = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (keyword.length() < MIN_QUERY_LENGTH) {
            throw new BadRequestException("QUERY_TOO_SHORT", "reception.lookup.query_too_short",
                    new Object[]{MIN_QUERY_LENGTH}, null);
        }
        if (keyword.length() > MAX_QUERY_LENGTH) {
            throw new BadRequestException("QUERY_TOO_LONG", "error.invalid_parameter", null,
                    "Search keyword must be at most " + MAX_QUERY_LENGTH + " characters");
        }

        String pattern = "%" + escapeLike(keyword) + "%";
        PageRequest limit = PageRequest.of(0, MAX_RESULTS);
        List<Member> members = memberLookup != null
                ? memberLookup.searchEscaped(pattern, limit)
                : repository.search(pattern, limit);
        if (members == null || members.isEmpty()) {
            return List.of();
        }

        Set<Long> approvedTrialMemberIds = resolveApprovedTrialMemberIds(members);
        return members.stream()
                .map(m -> new MemberLookupDto(
                        m.getUserId(),
                        m.getMembershipCode(),
                        m.getUser().getFullName(),
                        m.getUser().getEmail(),
                        m.getUser().getPhone(),
                        m.getUser().getStatus(),
                        m.getIdentityVerified(),
                        m.getKycStatus(),
                        m.getDocumentType(),
                        KycCrypto.mask(m.getCitizenId()),
                        // Trial đã duyệt có thể còn KYC PENDING/REJECTED cũ; giữ nguyên trạng thái hiển thị.
                        m.getUserId() != null && approvedTrialMemberIds.contains(m.getUserId())))
                .toList();
    }

    /** Nạp tập userId có gói trải nghiệm APPROVED bằng đúng 1 truy vấn lô (fallback chỉ dùng cho unit test cũ). */
    private Set<Long> resolveApprovedTrialMemberIds(List<Member> members) {
        List<Long> memberIds = members.stream()
                .map(Member::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (trialLookup != null) {
            if (memberIds.isEmpty()) {
                return Set.of();
            }
            List<Long> approved = trialLookup.findMemberUserIdsWithStatus(memberIds, "APPROVED");
            return approved == null || approved.isEmpty() ? Set.of() : new HashSet<>(approved);
        }
        if (trials == null) {
            return Set.of();
        }
        Set<Long> approved = new HashSet<>();
        for (Member m : members) {
            if (m.getUserId() != null && trials.findByMemberUserId(m.getUserId())
                    .map(trial -> "APPROVED".equalsIgnoreCase(trial.getStatus()))
                    .orElse(false)) {
                approved.add(m.getUserId());
            }
        }
        return approved;
    }
}
