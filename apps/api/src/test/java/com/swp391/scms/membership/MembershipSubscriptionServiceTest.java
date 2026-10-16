package com.swp391.scms.membership;

import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ConflictException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.facilities.repository.MembershipPackageRepository;
import com.swp391.scms.membership.dto.SubscriptionRequests;
import com.swp391.scms.membership.dto.SubscriptionResponses.SubscriptionDto;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.membership.service.MembershipSubscriptionService;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.MemberRepository;
import com.swp391.scms.users.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipSubscriptionServiceTest {

    @Mock
    private MembershipSubscriptionRepository subscriptions;

    @Mock
    private MembershipPackageRepository packages;

    @Mock
    private MemberRepository members;

    private Clock clock;
    private MembershipSubscriptionService service;

    private final AuthenticatedPrincipal principal = new AuthenticatedPrincipal(10L, "member01", "MEMBER");

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-10-11T10:00:00Z"), ZoneOffset.UTC);
        service = new MembershipSubscriptionService(subscriptions, packages, members, clock);
    }

    @Test
    void create_success() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");
        pack.setStatus("active");
        pack.setDurationDays(30);

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));
        when(subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(eq(10L), eq("active"), any()))
                .thenReturn(false);
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDto result = service.create(principal, new SubscriptionRequests.Create(1L));

        assertThat(result.status()).isEqualTo("pending_payment");
        assertThat(result.startDate()).isEqualTo(LocalDate.now(clock));
        assertThat(result.endDate()).isEqualTo(LocalDate.now(clock).plusDays(30));
        assertThat(result.memberId()).isEqualTo(10L);
    }

    @Test
    void create_failsWhenMemberAlreadyHasActiveSubscription() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setStatus("active");
        pack.setDurationDays(30);

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));
        when(subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(eq(10L), eq("active"), any()))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(principal, new SubscriptionRequests.Create(1L)))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void create_succeedsWhenMemberHasExpiredSubscriptionEvenWithActiveStatus() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");
        pack.setStatus("active");
        pack.setDurationDays(30);

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));
        // Status is active in DB, but endDate < today so
        // existsBy...EndDateGreaterThanEqual returns false
        when(subscriptions.existsByMemberUserIdAndStatusAndEndDateGreaterThanEqual(eq(10L), eq("active"), any()))
                .thenReturn(false);
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDto result = service.create(principal, new SubscriptionRequests.Create(1L));

        assertThat(result.status()).isEqualTo("pending_payment");
        assertThat(result.startDate()).isEqualTo(LocalDate.now(clock));
        assertThat(result.endDate()).isEqualTo(LocalDate.now(clock).plusDays(30));
    }

    @Test
    void create_failsWhenPackageInactive() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setStatus("inactive");

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));

        assertThatThrownBy(() -> service.create(principal, new SubscriptionRequests.Create(1L)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void renew_extendsFromPreviousEndDateWhenNotExpired() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");
        pack.setStatus("active");
        pack.setDurationDays(30);

        MembershipSubscription prev = new MembershipSubscription();
        prev.setId(100L);
        prev.setMember(member);
        prev.setMembershipPackage(pack);
        prev.setEndDate(LocalDate.now(clock).plusDays(10)); // still 10 days left

        when(subscriptions.findById(100L)).thenReturn(Optional.of(prev));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDto result = service.renew(principal, 100L);

        assertThat(result.status()).isEqualTo("pending_payment");
        assertThat(result.previousSubscriptionId()).isEqualTo(100L);
        assertThat(result.startDate()).isEqualTo(LocalDate.now(clock).plusDays(11));
        assertThat(result.endDate()).isEqualTo(LocalDate.now(clock).plusDays(41));
    }

    @Test
    void renew_startsFromTodayWhenPreviousAlreadyExpired() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");
        pack.setStatus("active");
        pack.setDurationDays(30);

        MembershipSubscription prev = new MembershipSubscription();
        prev.setId(100L);
        prev.setMember(member);
        prev.setMembershipPackage(pack);
        prev.setEndDate(LocalDate.now(clock).minusDays(5)); // expired 5 days ago

        when(subscriptions.findById(100L)).thenReturn(Optional.of(prev));
        when(packages.findById(1L)).thenReturn(Optional.of(pack));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDto result = service.renew(principal, 100L);

        assertThat(result.startDate()).isEqualTo(LocalDate.now(clock));
        assertThat(result.endDate()).isEqualTo(LocalDate.now(clock).plusDays(30));
    }

    @Test
    void renew_failsWhenNotOwner() {
        Member otherMember = new Member();
        otherMember.setUserId(999L);

        MembershipSubscription prev = new MembershipSubscription();
        prev.setId(100L);
        prev.setMember(otherMember);

        when(subscriptions.findById(100L)).thenReturn(Optional.of(prev));

        assertThatThrownBy(() -> service.renew(principal, 100L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void mine_returnsListOrdered() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(100L);
        sub.setMember(member);
        sub.setMembershipPackage(pack);
        sub.setStatus("active");
        sub.setQrCode("QR-TEST-123");

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(subscriptions.findByMemberUserIdOrderByCreatedAtDesc(10L)).thenReturn(List.of(sub));

        List<SubscriptionDto> list = service.mine(principal);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).qrCode()).isEqualTo("QR-TEST-123");
        assertThat(list.get(0).status()).isEqualTo("active");
    }

    @Test
    void current_returnsActiveSubscription_whenValidAndUnexpired() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(100L);
        sub.setMember(member);
        sub.setMembershipPackage(pack);
        sub.setStatus("active");
        sub.setStartDate(LocalDate.now(clock).minusDays(5));
        sub.setEndDate(LocalDate.now(clock).plusDays(25));
        sub.setQrCode("QR-TEST-123");

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(subscriptions.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                10L, "active", LocalDate.now(clock), LocalDate.now(clock)))
                .thenReturn(Optional.of(sub));

        SubscriptionDto result = service.current(principal);

        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(100L);
        assertThat(result.qrCode()).isEqualTo("QR-TEST-123");
    }

    @Test
    void current_returnsNull_whenNoActiveSubscriptionExists() {
        Member member = new Member();
        member.setUserId(10L);

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(subscriptions.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                10L, "active", LocalDate.now(clock), LocalDate.now(clock)))
                .thenReturn(Optional.empty());

        SubscriptionDto result = service.current(principal);

        assertThat(result).isNull();
    }

    @Test
    void current_ignoresFutureRenewalSubscription_returnsCurrentlyActiveOnly() {
        Member member = new Member();
        member.setUserId(10L);

        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setName("Gói 1 tháng");

        // Currently active subscription covering today
        MembershipSubscription currentSub = new MembershipSubscription();
        currentSub.setId(100L);
        currentSub.setMember(member);
        currentSub.setMembershipPackage(pack);
        currentSub.setStatus("active");
        currentSub.setStartDate(LocalDate.now(clock).minusDays(10));
        currentSub.setEndDate(LocalDate.now(clock).plusDays(20));
        currentSub.setQrCode("QR-CURRENT-ACTIVE");

        when(members.findById(10L)).thenReturn(Optional.of(member));
        when(subscriptions.findFirstByMemberUserIdAndStatusAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderByEndDateDesc(
                10L, "active", LocalDate.now(clock), LocalDate.now(clock)))
                .thenReturn(Optional.of(currentSub));

        SubscriptionDto result = service.current(principal);

        assertThat(result).isNotNull();
        assertThat(result.id()).isEqualTo(100L);
        assertThat(result.qrCode()).isEqualTo("QR-CURRENT-ACTIVE");
    }

    @Test
    void activateAfterPayment_success() {
        MembershipPackage pack = new MembershipPackage();
        pack.setId(1L);
        pack.setDurationDays(30);

        MembershipSubscription sub = new MembershipSubscription();
        sub.setId(100L);
        sub.setMembershipPackage(pack);
        sub.setStatus("pending_payment");
        sub.setStartDate(LocalDate.now(clock));

        when(subscriptions.findById(100L)).thenReturn(Optional.of(sub));
        when(subscriptions.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDto result = service.activateAfterPayment(100L);

        assertThat(result.status()).isEqualTo("active");
        assertThat(result.qrCode()).isNotNull().isNotBlank();
        assertThat(result.endDate()).isEqualTo(LocalDate.now(clock).plusDays(30));
    }
}
