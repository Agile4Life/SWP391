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
    @Mock com.swp391.scms.membership.repository.MemberTrialRedemptionRepository trials;
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
        member.setCitizenId("012345678901"); member.setIdentityVerified(true); member.setKycStatus("APPROVED");
        when(repository.search(eq("%nguyen%"), any(Pageable.class))).thenReturn(List.of(member));

        List<MemberLookupDto> result = service.search("  Nguyen ");

        assertEquals(1, result.size());
        assertEquals("MEM-1", result.get(0).membershipCode());
        assertEquals("Nguyen An", result.get(0).fullName());
        assertEquals("********8901", result.get(0).citizenId());
        assertEquals(true, result.get(0).identityVerified());
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"PENDING", "REJECTED"})
    void exposesApprovedTrialWithoutChangingActualKyc(String status) {
        User user = new User(); user.setFullName("Member");
        Member member = new Member(); member.setUser(user); member.setIdentityVerified(true); member.setKycStatus(status);
        var trial = new com.swp391.scms.membership.entity.MemberTrialRedemption(); trial.setStatus("APPROVED");
        when(repository.search(any(), any())).thenReturn(List.of(member));
        when(trials.findByMemberUserId(member.getUserId())).thenReturn(java.util.Optional.of(trial));
        var result = service.search("member").get(0);
        assertEquals(true, result.approvedTrial());
        assertEquals(status, result.kycStatus());
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings = {"PENDING_APPROVAL", "REJECTED"})
    void doesNotTreatUnapprovedTrialAsPurchaseException(String status) {
        User user = new User(); Member member = new Member(); member.setUser(user); member.setKycStatus("PENDING");
        var trial = new com.swp391.scms.membership.entity.MemberTrialRedemption(); trial.setStatus(status);
        when(repository.search(any(), any())).thenReturn(List.of(member));
        when(trials.findByMemberUserId(member.getUserId())).thenReturn(java.util.Optional.of(trial));
        var result = service.search("member").get(0);
        assertEquals(false, result.approvedTrial());
        assertEquals("PENDING", result.kycStatus());
    }

}