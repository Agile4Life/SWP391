package com.swp391.scms.reports;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.swp391.scms.common.exception.BadRequestException;
import com.swp391.scms.facilities.entity.MembershipPackage;
import com.swp391.scms.finance.entity.Payment;
import com.swp391.scms.finance.repository.PaymentRepository;
import com.swp391.scms.membership.entity.MembershipSubscription;
import com.swp391.scms.membership.repository.MembershipSubscriptionRepository;
import com.swp391.scms.reports.dto.DailyRevenueDto;
import com.swp391.scms.reports.dto.PackageRevenueDto;
import com.swp391.scms.reports.dto.ReportSnapshotCreateDto;
import com.swp391.scms.reports.dto.ReportSnapshotDto;
import com.swp391.scms.reports.entity.ReportSnapshot;
import com.swp391.scms.reports.repository.ReportSnapshotRepository;
import com.swp391.scms.reports.service.RevenueReportService;
import com.swp391.scms.users.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RevenueReportServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private MembershipSubscriptionRepository subscriptionRepository;

    @Mock
    private ReportSnapshotRepository snapshotRepository;

    @Mock
    private UserRepository userRepository;

    private ObjectMapper objectMapper;
    private Clock clock;
    private RevenueReportService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        clock = Clock.fixed(Instant.parse("2026-10-05T10:00:00Z"), ZoneOffset.UTC);
        service = new RevenueReportService(paymentRepository, subscriptionRepository,
                snapshotRepository, userRepository, objectMapper, clock);
    }

    @Test
    @DisplayName("Should calculate daily revenue correctly for date range")
    void shouldCalculateDailyRevenueCorrectly() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 2);

        Payment p1 = new Payment();
        p1.setAmount(new BigDecimal("1000000.00"));
        p1.setStatus("success");
        p1.setPaidAt(LocalDateTime.of(2026, 10, 1, 9, 0));

        Payment p2 = new Payment();
        p2.setAmount(new BigDecimal("500000.00"));
        p2.setStatus("success");
        p2.setPaidAt(LocalDateTime.of(2026, 10, 1, 14, 30));

        Payment p3 = new Payment();
        p3.setAmount(new BigDecimal("2000000.00"));
        p3.setStatus("success");
        p3.setPaidAt(LocalDateTime.of(2026, 10, 2, 11, 0));

        when(paymentRepository.findByStatusAndPaidAtBetween(eq("success"), any(), any()))
                .thenReturn(List.of(p1, p2, p3));

        List<DailyRevenueDto> result = service.getDailyRevenue(start, end);

        assertEquals(2, result.size());
        assertEquals(new BigDecimal("1500000.00"), result.get(0).getRevenue());
        assertEquals(2, result.get(0).getTransactionCount());
        assertEquals(new BigDecimal("2000000.00"), result.get(1).getRevenue());
        assertEquals(1, result.get(1).getTransactionCount());
    }

    @Test
    @DisplayName("Should throw BadRequestException when start date is after end date")
    void shouldThrowWhenStartDateAfterEndDate() {
        LocalDate start = LocalDate.of(2026, 10, 10);
        LocalDate end = LocalDate.of(2026, 10, 1);

        assertThrows(BadRequestException.class, () -> service.getDailyRevenue(start, end));
    }

    @Test
    @DisplayName("Should calculate revenue by package with correct percentages")
    void shouldCalculateRevenueByPackageCorrectly() {
        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 5);

        MembershipPackage gold = new MembershipPackage();
        gold.setName("Gold 6 Tháng");
        try {
            var idField = MembershipPackage.class.getDeclaredField("id");
            idField.setAccessible(true);
            idField.set(gold, 1L);
        } catch (Exception ignored) {}

        MembershipSubscription sub1 = new MembershipSubscription();
        sub1.setMembershipPackage(gold);

        Payment p1 = new Payment();
        p1.setAmount(new BigDecimal("3000000.00"));
        p1.setStatus("success");
        p1.setPaidAt(LocalDateTime.of(2026, 10, 2, 10, 0));
        p1.setSubscriptionId(10L);

        when(paymentRepository.findByStatusAndPaidAtBetween(eq("success"), any(), any()))
                .thenReturn(List.of(p1));
        when(subscriptionRepository.findById(10L)).thenReturn(Optional.of(sub1));

        List<PackageRevenueDto> result = service.getRevenueByPackage(start, end);

        assertEquals(1, result.size());
        assertEquals("Gold 6 Tháng", result.get(0).getPackageName());
        assertEquals(new BigDecimal("3000000.00"), result.get(0).getRevenue());
        assertEquals(100.0, result.get(0).getPercentage());
    }

    @Test
    @DisplayName("Should generate snapshot when json data is valid")
    void shouldGenerateSnapshotWhenJsonIsValid() {
        ReportSnapshotCreateDto dto = new ReportSnapshotCreateDto(
                "revenue",
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 5),
                "{\"totalRevenue\": 3000000, \"orders\": 1}",
                null
        );

        when(snapshotRepository.save(any(ReportSnapshot.class))).thenAnswer(inv -> {
            ReportSnapshot saved = inv.getArgument(0);
            saved.setData(dto.getData());
            return saved;
        });

        ReportSnapshotDto result = service.generateSnapshot(dto, 1L);
        assertNotNull(result);
        assertEquals("revenue", result.getReportType());
        verify(snapshotRepository).save(any(ReportSnapshot.class));
    }

    @Test
    @DisplayName("Should reject snapshot generation when json data is invalid syntax")
    void shouldRejectSnapshotWhenJsonIsInvalid() {
        ReportSnapshotCreateDto dto = new ReportSnapshotCreateDto(
                "revenue",
                LocalDate.of(2026, 10, 1),
                LocalDate.of(2026, 10, 5),
                "{invalid_json_format",
                null
        );

        assertThrows(BadRequestException.class, () -> service.generateSnapshot(dto, 1L));
    }
}
