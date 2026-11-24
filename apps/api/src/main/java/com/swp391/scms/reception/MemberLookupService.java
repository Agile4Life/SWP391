package com.swp391.scms.reception;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.MemberRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Tra cứu nhanh hội viên cho lễ tân theo mã hội viên, họ tên, email hoặc SĐT.
 *
 * Tra cứu nhanh hội viên cho lễ tân theo mã membership, tên, email hoặc số điện thoại.
 */
@Service
public class MemberLookupService {

    private static final int MAX_RESULTS = 20;
    private static final int MIN_QUERY_LENGTH = 2;

    private final MemberRepository repository;

    /** Nhận repository hội viên. */
    public MemberLookupService(MemberRepository repository) {
        this.repository = repository;
    }

    /**
     * Từ khóa phải có ít nhất 2 ký tự (sau khi bỏ khoảng trắng); tìm không phân biệt hoa thường, trả tối đa 20
     * hội viên chưa bị xóa.
     */
    @Transactional(readOnly = true)
    public List<MemberLookupDto> search(String query) {
        String keyword = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (keyword.length() < MIN_QUERY_LENGTH) {
            throw new BadRequestException("QUERY_TOO_SHORT", "reception.lookup.query_too_short",
                    new Object[]{MIN_QUERY_LENGTH}, null);
        }
        return repository.search("%" + keyword + "%", PageRequest.of(0, MAX_RESULTS)).stream()
                .map(m -> new MemberLookupDto(m.getUserId(), m.getMembershipCode(), m.getUser().getFullName(),
                        m.getUser().getEmail(), m.getUser().getPhone(), m.getUser().getStatus(),
                        m.getIdentityVerified(), m.getKycStatus(), m.getDocumentType(),
                        com.swp391.scms.users.KycCrypto.mask(m.getCitizenId())))
                .toList();
    }
}
