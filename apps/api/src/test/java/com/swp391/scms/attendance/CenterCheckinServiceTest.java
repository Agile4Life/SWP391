package com.swp391.scms.attendance;

import com.swp391.scms.attendance.dto.CheckinRequests;
import com.swp391.scms.attendance.dto.CheckinResponses.CheckinDto;
import com.swp391.scms.attendance.entity.CenterCheckin;
import com.swp391.scms.attendance.repository.CenterCheckinRepository;
import com.swp391.scms.attendance.service.CenterCheckinService;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.common.exception.ForbiddenException;
import com.swp391.scms.common.i18n.MessageService;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.security.AuthenticatedPrincipal;
import com.swp391.scms.users.UserRepository;
import com.swp391.scms.users.entity.Member;
import com.swp391.scms.users.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CenterCheckinServiceTest {

    @Mock
    private CenterCheckinRepository checkins;

    @Mock
    private MembershipSubscriptionRepository subscriptions;

    @Mock
    private UserRepository users;

    private Clock clock;
    private MessageService messageService;
    private CenterCheckinService service;

    private final AuthenticatedPrincipal receptionist = new AuthenticatedPrincipal(1L, "receptionist", "RECEPTIONIST");
    private final AuthenticatedPrincipal centerManager = new AuthenticatedPrincipal(2L, "manager", "CENTER_MANAGER");
    private final AuthenticatedPrincipal memberPrincipal = new AuthenticatedPrincipal(10L, "member", "MEMBER");

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(Instant.parse("2026-10-12T10:00:00Z"), ZoneId.of("UTC"));
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasenames("i18n/messages");
        source.setDefaultEncoding("UTF-8");
        messageService = new MessageService(source);

        service = new CenterCheckinService(checkins, subscriptions, users, clock, messageService);
    }

    private Member mockMember(Long userId, String name) {
        User user = new User();
        user.setId(userId);
        user.setFullName(name);

        Member member = new Member();
        member.setUser(user);
        member.setUserId(userId);
        return member;
    }

    private MembershipSubscription mockSubscription(Member member, String status, LocalDate start, LocalDate end) {
        MembershipSubscription sub = new MembershipSubscription();
        sub.setMember(member);
        sub.setStatus(status);
        sub.setStartDate(start);
        sub.setEndDate(end);
        return sub;
    }

    @Test
    @DisplayName("BR-01: Member tự gọi API scan phải bị chặn 403 Forbidden")
    void br01_memberCallingScan_throwsForbidden() {
        CheckinRequests.Scan request = new CheckinRequests.Scan("QR-CODE-123", "Gate 1");

        assertThrows(ForbiddenException.class, () -> service.scan(memberPrincipal, request));
        verify(checkins, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("BR-02 & BR-03: Mã QR không tồn tại -> Lưu bản ghi DENIED vào center_checkins")
    void br02_qrNotFound_logsDeniedRecord() {
        CheckinRequests.Scan request = new CheckinRequests.Scan("NON-EXISTENT", "Gate A");
        when(subscriptions.findByQrCode("NON-EXISTENT")).thenReturn(Optional.empty());
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> {
            CenterCheckin c = inv.getArgument(0);
            return c;
        });

        CheckinDto result = service.scan(receptionist, request);

        assertNotNull(result);
        assertEquals("DENIED", result.status());
        assertNotNull(result.denialReason());
        ArgumentCaptor<CenterCheckin> captor = ArgumentCaptor.forClass(CenterCheckin.class);
        verify(checkins).saveAndFlush(captor.capture());
        assertEquals("DENIED", captor.getValue().getStatus());
        assertNull(captor.getValue().getMember());
        assertEquals("Gate A", captor.getValue().getGate());
    }

    @Test
    @DisplayName("BR-02 & BR-03: Gói tập chưa active (pending_payment) -> Lưu bản ghi DENIED")
    void br02_inactiveSubscription_logsDeniedRecord() {
        Member member = mockMember(10L, "Nguyễn Văn B");
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = mockSubscription(member, "pending_payment", today.minusDays(1), today.plusDays(30));

        when(subscriptions.findByQrCode("QR-PENDING")).thenReturn(Optional.of(sub));
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDto result = service.scan(receptionist, new CheckinRequests.Scan("QR-PENDING", "Gate A"));

        assertEquals("DENIED", result.status());
        assertEquals(10L, result.memberId());
        ArgumentCaptor<CenterCheckin> captor = ArgumentCaptor.forClass(CenterCheckin.class);
        verify(checkins).saveAndFlush(captor.capture());
        assertEquals("DENIED", captor.getValue().getStatus());
        assertEquals(member, captor.getValue().getMember());
    }

    @Test
    @DisplayName("BR-02 & BR-03: Gói tập đã hết hạn -> Lưu bản ghi DENIED")
    void br02_expiredSubscription_logsDeniedRecord() {
        Member member = mockMember(10L, "Nguyễn Văn C");
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = mockSubscription(member, "active", today.minusDays(60), today.minusDays(1));

        when(subscriptions.findByQrCode("QR-EXPIRED")).thenReturn(Optional.of(sub));
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDto result = service.scan(receptionist, new CheckinRequests.Scan("QR-EXPIRED", "Gate A"));

        assertEquals("DENIED", result.status());
        ArgumentCaptor<CenterCheckin> captor = ArgumentCaptor.forClass(CenterCheckin.class);
        verify(checkins).saveAndFlush(captor.capture());
        assertEquals("DENIED", captor.getValue().getStatus());
    }

    @Test
    @DisplayName("BR-04 Anti-passback: Hội viên đang ở trong phòng tập (GRANTED chưa checkout) -> Chặn GRANTED thứ hai, log DENIED")
    void br04_antiPassback_alreadyInside_logsDeniedRecord() {
        Member member = mockMember(10L, "Nguyễn Văn D");
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = mockSubscription(member, "active", today.minusDays(1), today.plusDays(30));

        when(subscriptions.findByQrCode("QR-VALID")).thenReturn(Optional.of(sub));
        when(checkins.existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(10L, "GRANTED")).thenReturn(true);
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDto result = service.scan(receptionist, new CheckinRequests.Scan("QR-VALID", "Gate A"));

        assertEquals("DENIED", result.status());
        ArgumentCaptor<CenterCheckin> captor = ArgumentCaptor.forClass(CenterCheckin.class);
        verify(checkins).saveAndFlush(captor.capture());
        assertEquals("DENIED", captor.getValue().getStatus());
    }

    @Test
    @DisplayName("BR-02: Gói tập active, đúng hạn, chưa check-in -> result = GRANTED")
    void br02_validSubscription_granted() {
        Member member = mockMember(10L, "Nguyễn Văn E");
        LocalDate today = LocalDate.now(clock);
        MembershipSubscription sub = mockSubscription(member, "active", today.minusDays(1), today.plusDays(30));

        when(subscriptions.findByQrCode("QR-VALID")).thenReturn(Optional.of(sub));
        when(checkins.existsByMemberUserIdAndStatusAndCheckOutTimeIsNull(10L, "GRANTED")).thenReturn(false);
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDto result = service.scan(receptionist, new CheckinRequests.Scan("QR-VALID", "Gate A"));

        assertEquals("GRANTED", result.status());
        assertNull(result.denialReason());
        assertEquals(10L, result.memberId());
        assertEquals("Nguyễn Văn E", result.memberName());
        ArgumentCaptor<CenterCheckin> captor = ArgumentCaptor.forClass(CenterCheckin.class);
        verify(checkins).saveAndFlush(captor.capture());
        assertEquals("GRANTED", captor.getValue().getStatus());
        assertNull(captor.getValue().getDenialReason());
    }

    @Test
    @DisplayName("BR-05: Checkout bản ghi DENIED -> Bị từ chối BadRequestException")
    void br05_checkoutDeniedRecord_throwsBadRequest() {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setStatus("DENIED");
        when(checkins.findById(1L)).thenReturn(Optional.of(checkin));

        assertThrows(BadRequestException.class, () -> service.checkout(receptionist, 1L));
    }

    @Test
    @DisplayName("BR-05: Checkout bản ghi đã checkout -> Bị từ chối BadRequestException")
    void br05_checkoutAlreadyCheckedOut_throwsBadRequest() {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setStatus("GRANTED");
        checkin.setCheckOutTime(LocalDateTime.now(clock).minusMinutes(10));
        when(checkins.findById(2L)).thenReturn(Optional.of(checkin));

        assertThrows(BadRequestException.class, () -> service.checkout(receptionist, 2L));
    }

    @Test
    @DisplayName("BR-05: Checkout thành công cho lượt GRANTED đang mở")
    void br05_checkoutSuccess() {
        CenterCheckin checkin = new CenterCheckin();
        checkin.setStatus("GRANTED");
        checkin.setCheckInTime(LocalDateTime.now(clock).minusHours(1));
        checkin.setCheckOutTime(null);
        when(checkins.findById(3L)).thenReturn(Optional.of(checkin));
        when(checkins.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        CheckinDto result = service.checkout(receptionist, 3L);

        assertEquals("GRANTED", result.status());
        assertNotNull(result.checkOutTime());
    }

    @Test
    @DisplayName("BR-06: Member xem lịch sử -> chỉ lấy đúng danh sách của chính mình (principal.id)")
    void br06_memberViewsHistory_onlyGetsOwnRecords() {
        when(checkins.findByMemberUserIdAndCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
                eq(10L), any(), any()))
                .thenReturn(List.of(new CenterCheckin()));

        List<CheckinDto> list = service.history(memberPrincipal);

        assertEquals(1, list.size());
        verify(checkins).findByMemberUserIdAndCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(
                eq(10L), any(), any());
        verify(checkins, never()).findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(any(), any());
    }

    @Test
    @DisplayName("BR-06: Receptionist xem lịch sử -> lấy toàn bộ trong ngày")
    void br06_receptionistViewsHistory_getsAllRecords() {
        when(checkins.findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(any(), any()))
                .thenReturn(List.of(new CenterCheckin(), new CenterCheckin()));

        List<CheckinDto> list = service.history(receptionist);

        assertEquals(2, list.size());
        verify(checkins).findByCheckInTimeGreaterThanEqualAndCheckInTimeLessThanOrderByCheckInTimeDesc(any(), any());
    }
}
