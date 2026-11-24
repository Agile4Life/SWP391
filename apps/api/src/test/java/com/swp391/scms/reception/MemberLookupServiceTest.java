package com.swp391.scms.reception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import com.swp391.scms.users.MemberRepository;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.swp391.scms.users.MemberRepository;
import static org.mockito.ArgumentMatchers.any;
import com.swp391.scms.users.MemberRepository;
import static org.mockito.ArgumentMatchers.eq;
import com.swp391.scms.users.MemberRepository;
import static org.mockito.Mockito.never;
import com.swp391.scms.users.MemberRepository;
import static org.mockito.Mockito.verify;
import com.swp391.scms.users.MemberRepository;
import static org.mockito.Mockito.when;
import com.swp391.scms.users.MemberRepository;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.User;
import com.swp391.scms.users.MemberRepository;
import java.util.List;
import com.swp391.scms.users.MemberRepository;
import org.junit.jupiter.api.Test;
import com.swp391.scms.users.MemberRepository;
import org.junit.jupiter.api.extension.ExtendWith;
import com.swp391.scms.users.MemberRepository;
import org.mockito.InjectMocks;
import com.swp391.scms.users.MemberRepository;
import org.mockito.Mock;
import com.swp391.scms.users.MemberRepository;
import org.mockito.junit.jupiter.MockitoExtension;
import com.swp391.scms.users.MemberRepository;
import org.springframework.data.domain.Pageable;
import com.swp391.scms.users.MemberRepository;

/** Bộ kiểm thử cho service MemberLookupService (member lookup service). */
@ExtendWith(MockitoExtension.class)
class MemberLookupServiceTest {

    @Mock MemberRepository repository;
    @InjectMocks MemberLookupService service;

    /** Kiểm thử: từ chối từ khóa quá ngắn. */
    @Test
    void rejectsTooShortKeyword() {
        assertThrows(BadRequestException.class, () -> service.search(" a "));
        assertThrows(BadRequestException.class, () -> service.search(null));
        verify(repository, never()).search(any(), any());
    }

    /** Kiểm thử: tìm kiếm bằng mẫu wildcard viết thường và ánh xạ kết quả. */
    @Test
    void searchesWithLowercasedWildcardPatternAndMapsResult() {
        User user = new User();
        user.setFullName("Nguyen An");
        user.setEmail("an@x.com");
        user.setStatus("active");
        Member member = new Member();
        member.setUser(user);
        member.setMembershipCode("MEM-1");
        when(repository.search(eq("%nguyen%"), any(Pageable.class))).thenReturn(List.of(member));

        List<MemberLookupDto> result = service.search("  Nguyen ");

        assertEquals(1, result.size());
        assertEquals("MEM-1", result.get(0).membershipCode());
        assertEquals("Nguyen An", result.get(0).fullName());
    }
}