package com.swp391.scms.reception;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.membership.repository.MemberTrialRedemptionRepository;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

/** Bộ kiểm thử cho service MemberLookupService (member lookup service). */
@ExtendWith(MockitoExtension.class)
class MemberLookupServiceTest {

    @Mock MemberRepository repository;
    @Mock MemberTrialRedemptionRepository trials;
    @Mock ReceptionTrialLookupRepository trialLookup;
    @Mock ReceptionMemberLookupRepository memberLookup;

    private MemberLookupService service;

    @BeforeEach
    void setUp() {
        service = new MemberLookupService(repository, trials, trialLookup, memberLookup);
    }

    /** Kiểm thử: từ chối từ khóa quá ngắn hoặc vượt quá 100 ký tự. */
    @Test
    void rejectsTooShortOrTooLongKeyword() {
        assertThrows(BadRequestException.class, () -> service.search(" a "));
        assertThrows(BadRequestException.class, () -> service.search(null));
        assertThrows(BadRequestException.class, () -> service.search("a".repeat(101)));
        verifyNoInteractions(memberLookup, repository, trialLookup, trials);
    }

    /** Kiểm thử: tìm kiếm bằng mẫu wildcard viết thường đã escape và ánh xạ kết quả. */
    @Test
    void searchesWithLowercasedEscapedWildcardPatternAndMapsResult() {
        User user = new User();
        user.setFullName("Nguyen An");
        user.setEmail("an@x.com");
        user.setStatus("active");
        Member member = new Member();
        member.setUserId(10L);
        member.setUser(user);
        member.setMembershipCode("MEM-1");
        member.setCitizenId("012345678901");
        member.setIdentityVerified(true);
        member.setKycStatus("APPROVED");
        when(memberLookup.searchEscaped(eq("%nguyen%"), any(Pageable.class))).thenReturn(List.of(member));
        when(trialLookup.findMemberUserIdsWithStatus(List.of(10L), "APPROVED")).thenReturn(List.of());

        List<MemberLookupDto> result = service.search("  Nguyen ");

        assertEquals(1, result.size());
        assertEquals("MEM-1", result.get(0).membershipCode());
        assertEquals("Nguyen An", result.get(0).fullName());
        assertEquals("********8901", result.get(0).citizenId());
        assertEquals(true, result.get(0).identityVerified());
        verifyNoInteractions(trials);
    }

    /** Kiểm thử P2-BE-47: escape ký tự wildcard SQL LIKE (%, _, \\) trước khi truy vấn. */
    @Test
    void escapesSqlLikeWildcardsInSearchKeyword() {
        when(memberLookup.searchEscaped(eq("%\\%\\_\\\\%"), any(Pageable.class))).thenReturn(List.of());

        assertTrue(service.search("%_\\").isEmpty());
        verify(memberLookup).searchEscaped(eq("%\\%\\_\\\\%"), any(Pageable.class));
        verifyNoInteractions(trialLookup, trials);
    }

    /** Kiểm thử P1-BE-44: nạp hàng loạt trạng thái trial chỉ bằng 1 truy vấn lô thay vì N+1. */
    @Test
    void batchesApprovedTrialLookupIntoSingleQueryForMultipleMembers() {
        Member m1 = memberWith(1L, "An", "PENDING");
        Member m2 = memberWith(2L, "Binh", "APPROVED");
        Member m3 = memberWith(3L, "Chi", "REJECTED");
        when(memberLookup.searchEscaped(eq("%mem%"), any(Pageable.class))).thenReturn(List.of(m1, m2, m3));
        when(trialLookup.findMemberUserIdsWithStatus(List.of(1L, 2L, 3L), "APPROVED")).thenReturn(List.of(1L, 3L));

        List<MemberLookupDto> results = service.search("mem");

        assertEquals(3, results.size());
        assertTrue(results.get(0).approvedTrial());
        assertFalse(results.get(1).approvedTrial());
        assertTrue(results.get(2).approvedTrial());
        verify(trialLookup).findMemberUserIdsWithStatus(List.of(1L, 2L, 3L), "APPROVED");
        verify(trials, never()).findByMemberUserId(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "REJECTED"})
    void exposesApprovedTrialWithoutChangingActualKyc(String status) {
        Member member = memberWith(15L, "Member", status);
        member.setIdentityVerified(true);
        when(memberLookup.searchEscaped(any(), any())).thenReturn(List.of(member));
        when(trialLookup.findMemberUserIdsWithStatus(List.of(15L), "APPROVED")).thenReturn(List.of(15L));

        var result = service.search("member").get(0);
        assertTrue(result.approvedTrial());
        assertEquals(status, result.kycStatus());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING_APPROVAL", "REJECTED"})
    void doesNotTreatUnapprovedTrialAsPurchaseException(String status) {
        Member member = memberWith(16L, "Member", "PENDING");
        when(memberLookup.searchEscaped(any(), any())).thenReturn(List.of(member));
        when(trialLookup.findMemberUserIdsWithStatus(List.of(16L), "APPROVED")).thenReturn(List.of());

        var result = service.search("member").get(0);
        assertFalse(result.approvedTrial());
        assertEquals("PENDING", result.kycStatus());
    }

    /** Kiểm thử: JPQL của ReceptionMemberLookupRepository và ReceptionTrialLookupRepository biên dịch hợp lệ. */
    @Test
    void receptionJpqlQueriesCompileAgainstHibernateEntityMappings() throws Exception {
        var registry = new org.hibernate.boot.registry.StandardServiceRegistryBuilder()
                .applySetting("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect")
                .applySetting("hibernate.boot.allow_jdbc_metadata_access", "false")
                .build();
        try {
            var sources = new org.hibernate.boot.MetadataSources(registry);
            var scanner = new org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider(false);
            scanner.addIncludeFilter(new org.springframework.core.type.filter.AnnotationTypeFilter(jakarta.persistence.Entity.class));
            for (var bean : scanner.findCandidateComponents("com.swp391.scms")) {
                sources.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
            }
            try (var factory = sources.buildMetadata().buildSessionFactory();
                 var session = factory.openSession()) {
                var searchMethod = ReceptionMemberLookupRepository.class.getMethod(
                        "searchEscaped", String.class, Pageable.class);
                session.createQuery(searchMethod.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), Member.class)
                        .setParameter("pattern", "%nguyen%");

                var trialMethod = ReceptionTrialLookupRepository.class.getMethod(
                        "findMemberUserIdsWithStatus", java.util.Collection.class, String.class);
                session.createQuery(trialMethod.getAnnotation(org.springframework.data.jpa.repository.Query.class).value(), Long.class)
                        .setParameter("memberIds", List.of(1L, 2L))
                        .setParameter("status", "APPROVED");
            }
        } finally {
            org.hibernate.boot.registry.StandardServiceRegistryBuilder.destroy(registry);
        }
    }

    private static Member memberWith(Long id, String fullName, String kycStatus) {
        User user = new User();
        user.setId(id);
        user.setFullName(fullName);
        Member member = new Member();
        member.setUserId(id);
        member.setUser(user);
        member.setKycStatus(kycStatus);
        return member;
    }
}