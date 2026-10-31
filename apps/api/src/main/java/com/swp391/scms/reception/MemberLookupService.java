package com.swp391.scms.reception;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.MemberRepository;
import java.util.List;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Quick member lookup for the receptionist by membership code, name, email or phone. */
@Service
public class MemberLookupService {

    private static final int MAX_RESULTS = 20;
    private static final int MIN_QUERY_LENGTH = 2;

    private final MemberRepository repository;

    public MemberLookupService(MemberRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<MemberLookupDto> search(String query) {
        String keyword = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (keyword.length() < MIN_QUERY_LENGTH) {
            throw new BadRequestException("QUERY_TOO_SHORT", "reception.lookup.query_too_short",
                    new Object[]{MIN_QUERY_LENGTH}, null);
        }
        return repository.search("%" + keyword + "%", PageRequest.of(0, MAX_RESULTS)).stream()
                .map(m -> new MemberLookupDto(m.getUserId(), m.getMembershipCode(), m.getUser().getFullName(),
                        m.getUser().getEmail(), m.getUser().getPhone(), m.getUser().getStatus()))
                .toList();
    }
}
